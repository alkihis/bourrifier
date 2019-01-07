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
    fs.writeFileSync('./saves/settings.json', JSON.stringify(settings));
}

///// FIN DE L'INITIALISATION

// TESTS
const fs = require('fs');
let twitter = new Twitter(consumer_token, consumer_secret, access_token, access_token_secret);

let tries = 5;
let time_last_try = Date.now();
let settings = {};
let credentials = null;
let on_reset = false;

if (fs.existsSync('./saves/settings.json')) {
    settings = JSON.parse(fs.readFileSync('./saves/settings.json'));
}

async function listenStreamAndAnswer() {
    on_reset = false;

    let twitter_stream = new TwitterStream({
        consumer_key: consumer_token,
        consumer_secret,
        token: access_token,
        token_secret: access_token_secret
    }, true);

    // Récupération du screen_name du bot
    if (!credentials) {
        log.silly("Récupération des credentials du bot");
        try {
            credentials = JSON.parse(await twitter.getCredentials());
        } catch (e) {
            log.error('Impossible de récupérer les credentials: ' + String(e));
            return;
        }
    }

    log.silly("Credentials récupérées, initialisation du stream...");

    twitter_stream.stream('statuses/filter', { // Initialisation du stream
        track: '@' + credentials.screen_name,
        stall_warnings: true
    });

    twitter_stream.on('connection aborted', function () {
        if (time_last_try < (Date.now() - 60*60*3*1000)) { // Si le dernier essai a plus de trois heures (Date.now() est en millisecondes)
            log.warn("Cela fait plus de trois heures depuis le dernier essai. Réessayage.");
            time_last_try = Date.now();
            tries = 5;
        }

        tries--;

        if (tries > 0) {
            if (!on_reset) {
                log.warn("La connexion au stream a été perdue. La connexion va être relancée dans 30 secondes.");
                on_reset = true;

                setTimeout(listenStreamAndAnswer, 1000*30);
            }
            else {
                log.info("Le stream est déjà en cours de reset.");
            }
        }
        else {
            log.error("La connexion au stream a été perdue. Trop d'échecs ont été rencontrés récemment. Le script se termine ici.");
        }
    });

    twitter_stream.on('connection success', function (uri) {
        log.silly("Stream ok, bot prêt. (" + uri + ")");

        twitter_stream.close();
    });

    twitter_stream.on('connection error network', function (error) {
        log.warn("La connexion au stream a échoué. Tentative de reconnexion... (" + String(error) + ")");
    });

    twitter_stream.on('connection error stall', function () {
        log.debug("Un stall twitter a été reçu. Le stream continue malgré tout.");
    });

    twitter_stream.on('connection rate limit', function (httpStatusCode) {
        log.warn("Un rate limit a été atteint (Code HTTP " + httpStatusCode + "). La connexion sera relancée dans 60 secondes.");
    });

    twitter_stream.on('connection error http', function (httpStatusCode) {
        log.error("Erreur de connexion. (Code HTTP " + httpStatusCode + "). Reconnexion après 5 secondes...");
    });

    twitter_stream.on('connection error unknown', function (error) {
        log.error("Une erreur inconnue a été rencontrée. Fin du stream. (" + String(error) + ").");
        twitter_stream.close();
    });

    twitter_stream.on('data error', function (error) {
        log.error("Un objet inconnu a été rencontré. (" + String(error) + ").");
    });
}

log.silly("-----------------------------------------------------");
log.silly("Bienvenue ! Initialisation du bot de réponse bourrée.");
log.silly("-----------------------------------------------------");
listenStreamAndAnswer();
