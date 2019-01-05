const OAuth = require('oauth-1.0a');
const Twitter = require('./src/twitter');
const Bourrifier = require('./src/bourrifier');
const log = require('electron-log');
log.transports.file.level = 'info';

const {
    consumer_token,
    consumer_secret,
    access_token,
    access_token_secret,
    bot_user_dir,
    img_user_dir
} = require('./constants');

const rp = require('request-promise-native');
const TwitterStream = require('twitter-stream-api');

function randomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function saveSettings(settings) {
    const fs = require('fs');

    fs.writeFileSync(JSON.stringify(settings));
}

///// FIN DE L'INITIALISATION

// TESTS
const fs = require('fs');
let twitter = new Twitter(consumer_token, consumer_secret, access_token, access_token_secret);

let tries = 5;
let time_last_try = Date.now();
let settings = JSON.parse(fs.readFileSync('./settings.json'));

async function listenStreamAndAnswer() {
    tries--;

    let twitter_stream = new TwitterStream({
        consumer_key: consumer_token,
        consumer_secret,
        token: access_token,
        token_secret: access_token_secret
    }, true);

    // Récupération du screen_name du bot
    let credentials;
    log.silly("Récupération des credentials du bot");
    try {
        credentials = JSON.parse(await twitter.getCredentials());
    } catch (e) {
        log.error('Impossible de récupérer les credentials: ' + String(e));
        return;
    }

    log.silly("Credentials récupérées, initialisation du stream...");

    twitter_stream.stream('statuses/filter', { // Initialisation du stream
        track: '@' + credentials.screen_name,
        stall_warnings: true
    });

    twitter_stream.on('connection aborted', function () {
        if (time_last_try < (Date.now() - 60*60*3)) { // Si le dernier essai a plus de trois heures
            time_last_try = Date.now();
            tries = 5;
        }

        if (tries > 0) {
            log.warn("La connexion au stream a été perdue. La connexion va être relancée.");
            try {
                twitter_stream.close();
            } catch (e) {
                // Impossible de fermer: il est déjà fermé
            }
            
            listenStreamAndAnswer();
        }
        else {
            log.error("La connexion au stream a été perdue. Trop d'échecs ont été rencontrés récemment. Le script se termine ici.");
            twitter_stream.close();
        }
    });

    twitter_stream.on('connection success', function (uri) {
        log.silly("Stream ok, bot prêt. (" + uri + ")");
    });

    twitter_stream.on('connection error network', function (error) {
        log.warn("La connexion au stream a échoué. Tentative de reconnexion... (" + String(error) + ")");
    });

    twitter_stream.on('connection error stall', function () {
        log.debug("Un stall twitter a été reçu. Le stream continue malgré tout.");
    });

    twitter_stream.on('connection rate limit', function (httpStatusCode) {
        log.warn("Un rate limit a été atteint (Code HTTP " + httpStatusCode + ").");
    });

    twitter_stream.on('connection error http', function (httpStatusCode) {
        log.error("Erreur de connexion. (Code HTTP " + httpStatusCode + "). Reconnexion après 5 secondes...");
    });

    twitter_stream.on('connection error unknown', function (error) {
        log.error("Une erreur inconnue a été rencontrée. Fin du stream. (" + String(error) + ").");
        twitter_stream.close();
    });

    twitter_stream.on('data', async function (obj) {
        // Si on reçoit bien un tweet
        if (obj.text && obj.in_reply_to_screen_name && obj.in_reply_to_screen_name === credentials.screen_name) {
            // Sauvegarde de l'ID str du tweet
            settings.last_id_str = obj.id_str;
            saveSettings(settings);

            obj.full_text = obj.text;

            const regex = new RegExp(/^((@\w+ ){1,})(.*)/);
            const matches = regex.exec(obj.full_text);

            // Vérifie si il est mentionné correctement (soit pas dans les mentions de tête, soit en premier dans les mentions de tête)
            const is_not_badly_mentionned = !(matches.length > 1) || 
                (matches[1].match(new RegExp(`(^@${credentials.screen_name})`, 'i')) || !matches[1].match(new RegExp(`@${credentials.screen_name}`, 'i')));
            
            // Récupère le texte du tweet sans mentions
            let text_from_tweet = (matches.length > 3 ? matches[3] : obj.full_text);

            log.info("Mention reçue: " + Bourrifier.decodeHTML(text_from_tweet));

            // Si le bot est mentionné correctement, il peut commencer à analyser le tweet pour y répondre
            if (is_not_badly_mentionned) {
                if (Bourrifier.isTweetToSourced(text_from_tweet)) {
                    let text_to_send = Bourrifier.getSourcesFromTweet(obj.in_reply_to_status_id_str, obj.user.screen_name);
                    log.info("Récupération des sources pour le tweet [" + obj.in_reply_to_status_id_str + "], depuis l'utilisateur @" + obj.user.screen_name);

                    if (!text_to_send) {
                        text_to_send = "Impossible d'obtenir le contexte de ce tweet.";
                        log.debug("Sources indisponibles pour le tweet [" + obj.in_reply_to_status_id_str + "]");
                    }
    
                    try {
                        // Tente d'envoyer le tweet
                        await twitter.replyTo(obj.id_str, Bourrifier.decodeHTML(text_to_send));
                    } catch (e) {
                        log.error("Impossible d'envoyer les sources: " + String(e));
                    }  
                }
                else if (Bourrifier.isTweetToDab(text_from_tweet)) {
                    log.debug("Tweet to dab demandé.");
                    try {
                        // Sélection d'une photo aléatoirement
                        let path;
                        const glob = require('glob');
                        let files = [...glob.sync(img_user_dir + '*.jpg'), ...glob.sync(img_user_dir + '*.png')];

                        if (files.length > 0) {
                            const choosen_file = files[randomInt(0, files.length - 1)];

                            // Envoi de la photo
                            const media_id = await twitter.sendMedia(choosen_file);
    
                            // Tente d'envoyer le tweet
                            await twitter.replyTo(obj.id_str, "", {media_ids: media_id});
                        }
                        else {
                            log.debug("Aucun fichier de dab trouvé.");
                        }
                    } catch (e) {
                        log.debug("Impossible d'envoyer le tweet dab. " + String(e));
                    }
                }
                else if (Bourrifier.isTweetToAcab(text_from_tweet)) {
                    log.debug("Tweet to acab demandé.");
                    try {
                        // Envoi de la photo
                        const media_id = await twitter.sendMedia(img_user_dir + "01.acab_jpg");

                        // Tente d'envoyer le tweet
                        await twitter.replyTo(obj.id_str, "", {media_ids: media_id});
                    } catch (e) {
                        log.debug("Impossible d'envoyer le tweet michel baie. " + String(e));
                    }
                }
                else if (Bourrifier.isTweetToMichelBaie(text_from_tweet)) {
                    log.debug("Tweet michel baie demandé.");
                    // Post de la vidéo de michel baie
                    try {
                        // Envoi de la vidéo
                        const media_id = await twitter.sendChunkedMedia(img_user_dir + "michel.mp4");

                        // Tente d'envoyer le tweet
                        await twitter.replyTo(obj.id_str, "", {media_ids: media_id});
                    } catch (e) {
                        log.debug("Impossible d'envoyer le tweet michel baie. " + String(e));
                    }
                }
                else if (obj.in_reply_to_screen_name === credentials.screen_name && 
                    Bourrifier.isTweetToDelete(text_from_tweet, obj.user.screen_name, obj.in_reply_to_status_id_str, obj.user.id_str)) { 
                    
                    log.debug("Tweet à supprimer : " + obj.in_reply_to_status_id_str);
                    // Le Tweet doit être supprimé et l'utilisateur le demandant est autorisé
                    // Vérifie que le tweet à supprimer lui appartient
                    twitter.deleteTweet(obj.in_reply_to_status_id_str);
                }
                else {
                    // On répond à l'user avec ses propres tweets
                    log.silly("Récupération des tweets de @" + obj.user.screen_name + ".");

                    let tweets;
                    try {
                        tweets = JSON.parse(await twitter.getUserTimeline(obj.user.id_str));
                    } catch (e) {
                        log.warn("Impossible de récupérer les tweets de l'utilisateur @" + obj.user.screen_name + ".");
                        return;
                    }

                    let tries = 3; // Se donne trois essais de bourrification / envoi
                    let sended_tweet = false;

                    do {
                        // Création du bourrifier
                        const bourrifier = new Bourrifier(tweets);

                        // Sélection d'un mot à ajouter au début du tweet
                        const adding = bourrifier.addWordOnBeginning(obj.full_text);

                        // Choisit aléatoirement des tweets parmi la listr
                        let choosen_tweets = bourrifier.pickRandomCombinaison();
                        let poss = [];
                    
                        let combinaison = bourrifier.buildCombinaison(choosen_tweets, poss);
                    
                        // Combine et bourrifie
                        let final_tweet = bourrifier.bourrification(combinaison);

                        if (adding) { // Ajoute le "adding" si jamais il y en a un
                            final_tweet = adding + " " + final_tweet; 
                        }
                    
                        log.info("Tweet à envoyer en réponse: " + final_tweet);

                        if (final_tweet.length <= 280) {
                            try {
                                // Tente d'envoyer le tweet
                                const tweet = await twitter.replyTo(obj.id_str, Bourrifier.decodeHTML(final_tweet));
                
                                // Sauvegarde le tweet sur le disque
                                bourrifier.saveLog(JSON.parse(tweet));
                    
                                sended_tweet = true;
                            } catch (e) {
                                log.error("Impossible d'envoyer le tweet (" + final_tweet + "): " + String(e));
                            }  
                        } 

                        tries--;
                    } while (tries > 0 && !sended_tweet);
                }
            }
            else {
                log.info("Rien à faire avec tweet ID [" + obj.id_str + "]");
            }
        }
    });

    twitter_stream.on('data error', function (error) {
        log.error("Un objet inconnu a été rencontré. (" + String(error) + ").");
    });
}

log.silly("Bienvenue ! Initialisation du bot de réponse bourrée.");
listenStreamAndAnswer();
