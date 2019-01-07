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
    bot_user_dir
} = require('./constants');

const rp = require('request-promise-native');

///// FIN DE L'INITIALISATION
// NETTOYAGE DES VIEILLES SOURCES

const fs = require('fs');
const glob = require('glob');

let files_of_dir = glob.sync(bot_user_dir + '*.json');
const current_timestamp = Date.now();
const one_week = 60*60*24*7;

for (const f of files_of_dir) {
    if (fs.statSync(f).mtime < new Date(current_timestamp - one_week)) {
        log.warn("Date du fichier: ", fs.statSync(f).mtime, current_timestamp - one_week);
	// fs.unlink(f, () => {});
    }
}

// FIN NETTOYAGE
// DEBUT DU SCRIPT

let twitter = new Twitter(consumer_token, consumer_secret, access_token, access_token_secret);

function analyseListAndSendTweet() {
    twitter.getList(0).then(function (res) {
        let json = JSON.parse(res);
    
        // Le JSON est prêt à l'emploi !
        sendNewBourrifedTweet(json);
    }).catch(function (error) {
        log.warn(error);
    })
}

async function sendNewBourrifedTweet(json_tweets) {
    let bourrifier = new Bourrifier(json_tweets);

    let tries = 5;

    while (tries--) {
        let choosen_tweets = bourrifier.pickRandomCombinaison();
        var poss = [];
    
        let combinaison = bourrifier.buildCombinaison(choosen_tweets, poss);
    
        let final_tweet = bourrifier.bourrification(combinaison);
    
        log.info("Tweet à envoyer: " + final_tweet);

        if (final_tweet.length <= 280) {
            // Envoyer le tweet
            try {
                const tweet = await twitter.sendTweet(Bourrifier.decodeHTML(final_tweet));

                bourrifier.saveLog(JSON.parse(tweet));
    
                tries = 0;
            } catch (e) {
                log.error("Impossible d'envoyer le tweet (" + final_tweet + "): " + String(e));
            }  
        }
    }
}

analyseListAndSendTweet();
