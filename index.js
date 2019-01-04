const OAuth = require('oauth-1.0a');
const Twitter = require('./src/twitter');
const Bourrifier = require('./src/bourrifier');
const log = require('electron-log');
log.transports.file.level = 'info';

const {
    consumer_token,
    consumer_secret,
    access_token,
    access_token_secret
} = require('./constants');

const rp = require('request-promise-native');

///// FIN DE L'INITIALISATION

// twitter.sendTweet('Coucou, ne fais pas attention à moi', {in_reply_to_status_id: '1080881608117403649'})

// twitter.sendChunkedMedia('./jfc.mp4').then(function(media_id) {
//     console.log(media_id);

//     if (media_id) {
//         twitter.sendTweet('Nouvelle réponse en vidéo', {in_reply_to_status_id: '1080881608117403649', media_ids: media_id})
//     }
// });

// twitter.sendMedia('./test.jpg').then(function(media_id) {
//     console.log(media_id);

//     if (media_id) {
//         // twitter.sendTweet('Nouvelle réponse en vidéo', {in_reply_to_status_id: '1080881608117403649', media_ids: media_id})
//     }
// });

// TESTS
const fs = require('fs');
json_tweets = JSON.parse(fs.readFileSync('example.json'));
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
                const tweet = await twitter.sendTweet(final_tweet, {in_reply_to_status_id: '1081278753953775616'});

                bourrifier.saveLog(JSON.parse(tweet));
    
                tries = 0;
            } catch (e) {
                log.error("Impossible d'envoyer le tweet (" + final_tweet + "): " + String(e));
            }  
        }
    }
}

analyseListAndSendTweet();
