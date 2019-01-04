// TWITTER HANDLER

const OAuth = require('oauth-1.0a');
const rp = require('request-promise-native');
const crypto = require('crypto');
const fs = require('fs');
const mime = require('mime-types');
const log = require('electron-log');
log.transports.file.level = 'info';

module.exports = class Twitter {
    constructor(consumer, secret, access_token, access_token_secret) {
        this.oauth = OAuth({
            consumer: { key: consumer, secret: secret },
            signature_method: 'HMAC-SHA1',
            hash_function(base_string, key) {
                return crypto.createHmac('sha1', key).update(base_string).digest('base64');
            }
        });

        this.access_token = access_token;
        this.access_token_secret = access_token_secret;

        this.lastResponse = undefined;
    }

    setToken(access_token, access_token_secret) {
        this.access_token = access_token;
        this.access_token_secret = access_token_secret;
    }

    make_request(url, method, form_data = {}, headers = {}) {
        method = method.toUpperCase();

        let request_data = {
            url,
            method,
            data: form_data
        };

        let base_rq = { // Lance une promise dans le tableau avec la requête en cours
            uri: request_data.url, 
            method: request_data.method,
            headers
        };

        if (request_data.method === 'POST') {
            base_rq.form = this.oauth.authorize(request_data, {key: this.access_token, secret: this.access_token_secret});
        }
        else if (headers && headers['Content-Type'] && headers['Content-Type'] === 'application/x-www-form-urlencoded') {
            base_rq.body = this.oauth.authorize(request_data, {key: this.access_token, secret: this.access_token_secret});
        }
        else {
            base_rq.qs = this.oauth.authorize(request_data, {key: this.access_token, secret: this.access_token_secret});
        }
        
        this.lastResponse = rp(base_rq);

        return this.lastResponse;
    }

    sendTweet(text, args = {}) {
        args.tweet_mode = 'extended';
        args.status = text;

        if (args.in_reply_to_status_id && !args.auto_populate_reply_metadata) {
            args.auto_populate_reply_metadata = true;
        }

        return this.make_request('https://api.twitter.com/1.1/statuses/update.json', 'POST', args);
    }

    replyTo(tweet_id_str, text, additionnals_args = {}) {
        additionnals_args.in_reply_to_status_id = tweet_id_str;

        return this.sendTweet(text, additionnals_args);
    }

    getCredentials() {
        return this.make_request('https://api.twitter.com/1.1/account/verify_credentials.json', 'GET', { skip_status: true });
    }

    async getList(list_number = 0, since_id = "1", count = 50) {
        let all_lists = await this.make_request('https://api.twitter.com/1.1/lists/list.json', 'GET');

        // Tableau des listes existantes
        all_lists = JSON.parse(all_lists);

        if (all_lists.length === 0) {
            return null;
        }
        else if (all_lists.length <= list_number) {
            // Liste trop haute
            list_number = 0;
        }

        const screen_name = all_lists[list_number].user.screen_name;
        const slug = all_lists[list_number].slug;

        // Requête à envoyer
        return this.make_request('https://api.twitter.com/1.1/lists/statuses.json', 'GET', {
            slug, 
            owner_screen_name: screen_name, 
            include_rts: true, 
            include_entities: true, 
            count, 
            since_id, 
            tweet_mode: 'extended'
        });
    }

    getUserTimeline(id_str, count = 100) {
        return this.make_request('https://api.twitter.com/1.1/statuses/user_timeline.json', 'GET', {
            user_id: id_str,
            count,
            exclude_replies: false,
            tweet_mode: 'extended'
        });
    }

    deleteTweet(id_str) {
        return this.make_request('https://api.twitter.com/1.1/statuses/destroy/' + id_str + '.json', 'POST');
    }

    async sendMedia(path) {
        const URL_MEDIA = 'https://upload.twitter.com/1.1/media/upload.json';

        if (fs.existsSync(path)) {
            let args = {
                media_data: fs.readFileSync(path, {flag:'r'}).toString('base64')
            }

            let req;
            try {
                req = await this.make_request(URL_MEDIA, 'POST', args, {'Content-Type': 'application/x-www-form-urlencoded'});
            } catch (e) {
                throw {error:2, message:"Media upload request fails", exception:e};
            }

            req = JSON.parse(req);

            return req.media_id_string;
        }

        throw {error:1, message:"File does not exists"};
    }

    async sendChunkedMedia(path) {
        const URL_MEDIA = 'https://upload.twitter.com/1.1/media/upload.json';

        if (fs.existsSync(path)) {
            // Lecture de la taille du fichier et définition de la taille d'un chunk
            const stats = fs.statSync(path);
            const LEN_CHUNK = 1024*512;

            const size = stats.size;

            let args = {
                command: "INIT",
                total_bytes: size,
                media_type: mime.lookup(path) // Définition du MIME type
            }

            // Si le mime type dit que c'est une vidéo, définit le media_category pour permettre les vidéos longues
            if (args.media_type.split('/')[0] === 'video') {
                args.media_category = 'tweet_video';
            }

            let init_request;
            // Ordonne l'initialisation de l'envoi
            try {
                init_request = await this.make_request(URL_MEDIA, 'POST', args, {'Content-Type': 'application/x-www-form-urlencoded'});
            } catch (e) {
                throw {error:2, message:"Init request fails", exception:e};
            }
            
            init_request = JSON.parse(init_request); // Les requêtes sont à parser à chaque fois

            const MEDIA_ID = init_request.media_id_string;

            let i = 0;
            let nb_part = Math.ceil(size / LEN_CHUNK);

            // Création d'un buffer pour contenu le chunk
            let buffer = Buffer.alloc(LEN_CHUNK);
            let fd = fs.openSync(path, 'r');

            let nread;

            // Lecture du chunk par segments de LEN_CHUNK
            while (nread = fs.readSync(fd, buffer, 0, LEN_CHUNK)) {
                let data;
                if (nread < LEN_CHUNK)
                    data = buffer.slice(0, nread);
                else
                    data = buffer;

                // Encode en base64
                let encoded = data.toString('base64');

                // Envoie la partie
                if (encoded) {
                    args = {
                        command: 'APPEND',
                        media_id: MEDIA_ID,
                        segment_index: i,
                        media_data: encoded
                    }

                    // Envoi du chunk numéro i
                    try {
                        await this.make_request(URL_MEDIA, 'POST', args, {'Content-Type': 'application/x-www-form-urlencoded'});
                    } catch (e) {
                        throw {error:3, message:"Chunk sending issue", exception:e};
                    }

                    i++;
                    log.info(`MEDIA ID [${MEDIA_ID}] : Partie ` + i + ' sur ' + nb_part + ' envoyée(s).');
                }
            }

            args = {
                command: 'FINALIZE',
                media_id: MEDIA_ID
            }

            // Finalise l'opération
            let final_request;
            try {
                final_request = await this.make_request(URL_MEDIA, 'POST', args, {'Content-Type': 'application/x-www-form-urlencoded'});
            } catch (e) {
                throw {error:4, message:"Finalize request fails", exception:e};
            }

            final_request = JSON.parse(final_request);

            // Si la vidéo est en cours de traitement, on attend
            if (final_request.processing_info) {
                let complete = false;
                args = {
                    command: 'STATUS',
                    media_id: MEDIA_ID
                }

                // Tant qu'on a pas réussi, on recommence des requêtes en boucle
                while (!complete) {
                    if (!final_request.processing_info.check_after_secs) {
                        throw {error:7, message:"Cant check waiting time"};
                    }

                    // On attend le nombre de secondes que twitter nous dit d'attendre
                    await this.sleep(final_request.processing_info.check_after_secs * 1000);

                    try {
                        final_request = await this.make_request(URL_MEDIA, 'GET', args);
                    } catch (e) {
                        throw {error:5, message:"Check info request fails", exception:e};
                    }
                    final_request = JSON.parse(final_request);

                    if (!final_request.processing_info.state) {
                        throw {error:6, message:"Cant check file state"};
                    }

                    log.info(`MEDIA ID [${MEDIA_ID}] : ` + 'Traité à ' + final_request.processing_info.progress_percent);

                    // Si c'est succeeded, on peut s'arrêter là !
                    if (final_request.processing_info.state === 'succeeded') {
                        complete = true;
                    }
                    else if (final_request.processing_info.state === 'failed') {
                        log.warn(`MEDIA ID [${MEDIA_ID}] : ` + 'Média invalide');
                        throw {error:8, message:"Media is invalid and cannot be computed by Twitter", request:final_request};
                    }
                }
            }

            return MEDIA_ID; // Retourne le media_id contenant le média, il est prêt à être utilisé
        }
        else {
            throw {error:1, message:"File does not exists"};
        }
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
