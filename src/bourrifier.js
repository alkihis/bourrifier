
// MODULE BOURRIFIER
// TAKE LIST OF TWEETS IN ARGUMENTS

const AUTHORIZED = ['alkihis', 'mayakolyyn', 'wydrops', 'erykyucc', 'zabreix', 'saw_dah', 'halquihisse', 'iarwainPi', 'angerydrop'];
const REPLACEMENT_LETTERS = {
    'a': ['a', 'z', 'q', 's'],
    'z': ['z', 'b', 'j', 'h'],
    'e': ['e', 'r', 's', 'd'],
    'r': ['r', 'e', 'd', 'g'],
    't': ['t', 'g', 'y', 'f'],
    'y': ['y', 'u', 'j', 'g'],
    'u': ['u', 'i', 'o', 'k'],
    'i': ['i', 'u', 'o', 'l'],
    's': ['s', 'd', 'q', 'x'],
    'h': ['h', 'g', 'b', 'j'],
    'k': ['k', 'l', 'i', "'"],
    'b': ['b', 'n', 'g', 'h'],
    'n': ['n', 'b', 'j', 'h']
};

const INSULTS = ["putain", "fdp", "sa mère", "connard", "wala", "ntm", "wesh", "hein", "hihi", "haha"];

let PERCENTAGE = randomInt(15, 75);
if (randomInt(1, 100) <= 8) {
    PERCENTAGE = 0;
}

const PERCENTAGE_DRUNK = PERCENTAGE;
const IS_DRUNK = PERCENTAGE != 0;
const RAND_MULTIPLE_TWEETS = 7500;
const RAND_MULTIPLE_MORE = 900;
const RAND_MAKE_SQUAREP = randomInt(1800, 4800);
const RAND_LIMIT_PONCTUATION = 520 * PERCENTAGE;
const RAND_LIMIT_DOTS = 34 * PERCENTAGE;
const RAND_LIMIT_S = 160 * PERCENTAGE;
const RAND_LIMIT_INSULTE = 118 * PERCENTAGE;
const RAND_LIMIT_ADDCHARS = 158 * PERCENTAGE;
const RAND_LIMIT_LETTER = 160 * PERCENTAGE;
const RAND_LIMIT_RANCHAR = (92 * PERCENTAGE) + 750;
const RAND_LIMIT_ADDING = randomInt(2100, 4800);

const BOT_USER_DIR = require('../constants').bot_user_dir;

const log = require('electron-log');
log.transports.file.level = 'info';
const fs = require('fs');

function randomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function ctype_upper(txt) {
    return txt === txt.toLocaleUpperCase();
}

function strReplaceAt(str, index, replacement) {
    return str.substr(0, index) + replacement+ str.substr(index + replacement.length);
}

function insertString(parent, child, pos) { // Insère la chaîne child dans la chaîne parent à la position pos
    if(pos == parent.length){
        return parent + child;
    }
    return parent.substr(0, pos) + child + parent.substr(pos);
}

function str_split(string, splitLength) {
    if (splitLength === null) {
      splitLength = 1
    }
    if (string === null || splitLength < 1) {
      return false
    }
  
    string += ''
    var chunks = []
    var pos = 0
    var len = string.length
  
    while (pos < len) {
      chunks.push(string.slice(pos, pos += splitLength))
    }
  
    return chunks
  }

module.exports = class Bourrifier {
    constructor(tweets) {
        if (Array.isArray(tweets))
            this.original_tweets = tweets;
        else
            this.original_tweets = [tweets];

        this.used_tweets = [];
        this.fusion_positions = [];
    }

    static tweetToFetchCount(length) {
        let to_fetch = 1;

        if (length > 1 && randomInt(0, 8192) < RAND_MULTIPLE_TWEETS) { // Plusieurs tweets à fetch
            to_fetch = 2;

            while (randomInt(0, 8192) < RAND_MULTIPLE_MORE && to_fetch < 5 && length > to_fetch) {
                to_fetch++;
            }
        }
        
        return to_fetch;
    }

    pickRandomCombinaison() {
        // Sélection du nombre de tweets a choisir
        let number = this.constructor.tweetToFetchCount(this.original_tweets.length);

        // Tirage des tweets à utiliser
        let used_tweets = [];

        while (used_tweets.length < number) {
            let used = Math.floor(Math.random() * (this.original_tweets.length));

            if (!used_tweets.includes(used)) {
                used_tweets.push(used);
            }
        }

        // Tweets choisis:
        log.debug("Tweets utilisés: " + used_tweets.join(' '));

        this.used_tweets = used_tweets.map(index => this.original_tweets[index]);

        return used_tweets.map(index => this.original_tweets[index]);
    }

    static deleteMentions(text) {
        // Supprime les @ trouvés en début du tweet précisé. Si le tweet devient vide, retourne null.
        let new_tweet = text;
        if (text.match(/^(@\w+ ){1,}/)) {
            new_tweet = text.replace(/^(@\w+ ){1,} */, '');

            log.debug("Mention(s) supprimée(s); Tweet initial: " + text + "; Tweet sans mention(s): " + new_tweet);

            if (new_tweet === "") { // Si le tweet devient vide si on lui enlève les @ qu'il contient au début
                return "null";
            }
        }

        return new_tweet;
    }

    buildCombinaison(tweets, poss = []) {
        function getString(element) {
            if (element.constructor === String) {
                return element;
            }

            if (element.retweeted_status) {
                // Suppression des mentions du texte de RT
                return Bourrifier.deleteMentions(element.retweeted_status.full_text);
            }
            else {
                return Bourrifier.deleteMentions(element.full_text);
            }
        }

        if (tweets.length === 0) {
            throw "Array cannot be empty";
        }

        let first_string = getString(tweets[0]);
        let current_offset = 1;
        let second_string;

        let offset = 1;

        let remaining = tweets.length - 1;

        while (remaining) {
            second_string = getString(tweets[current_offset]);

            remaining--;
            current_offset++;

            let f_array = first_string.split(' ');
            let s_array = second_string.split(' ');

            let pos1 = this.findKeyword(f_array, offset);
            let pos2 = this.searchEndAnchor(s_array);

            offset = pos1 + 1;

            first_string = this.combineTweets(f_array, s_array, pos1, pos2, poss);
        }

        this.fusion_positions = poss;

        return first_string;
    }

    findKeyword(tweet, offset) {
        let keywords = [];

        for (const [index, word] of tweet.entries()) {
            if (index < offset) {
                continue;
            }

            if (word.match(/(.*)(\.|,|!|\?|:)$/)) {
                // Recheche une position vers une ponctuation
                keywords.push(index);
            }
            else if (word.match(/(^et$)|(^de$)|(^des$)|(^du$)|(^car$)|(^donc$)|(^alors$)|(^mais$)|(^plus$)/i)) {
                // Recherche un mot clé
                keywords.push(index);
            }
        }

        if (keywords.length === 0 || randomInt(1, 8192) < 2500) { // Si aucun mot clé / chance de choisir une position au hasard
            let begin = Math.floor(tweet.length / 3);

            if (begin < offset && tweet.length > offset) {
                begin = offset;
            }

            return randomInt(begin, (tweet.length - 1));
        }

        // Sinon, on retourne un mot clé aléatoire
        return keywords[randomInt(0, keywords.length - 1)];
    }

    searchEndAnchor(tweet) {
        for (const [key, word] of tweet.entries()) {
            if (word.match(/(.*)(\.|,|!|\?|:)$/)) {
                // Recheche une position vers une ponctuation
                if (tweet.length < key + 1) {
                    return key+1;
                }
            }
            else if (word.match(/(^et$)|(^de$)|(^des$)|(^du$)|(^car$)|(^donc$)|(^alors$)|(^mais$)|(^plus$)/i)) {
                // Recherche un mot clé
                if (tweet.length < key + 1) {
                    return key+1;
                }
            }
        }

        let se_count = tweet.length;

        if (se_count < 4 && se_count > 0){
            return randomInt(0, Math.floor((se_count - 1) / 2))
        }
        else if (se_count === 0) {
            return null;
        }
        else {
            return randomInt(0, se_count - 1);
        }
    }

    combineTweets(first, second, pos1, pos2, poss) {
        let new_tweet = [...first.slice(0, pos1), ...second.slice(pos2, second.length)];

        poss.push([pos1, pos2]);
        // Suppression des liens multiples dans le tweet
        new_tweet = this.removeMultiplesLinks(new_tweet);
        
        return new_tweet.join(' ');
    }

    removeMultiplesLinks(tweet) {
        let new_t = [];

        let occ = 0;
        for (const word of tweet) {
            if (word.match(/^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/)) {
                occ++;
                if (occ === 1){
                    new_t.push(word);
                }
            }
            else {
                new_t.push(word);
            }
        }

        return new_t;
    }

    bourrification(text) {
        let square_pants = randomInt(0, 32768) < RAND_MAKE_SQUAREP;

        text = text.replace(/(\b)?([\w_@:\/\.,'\?&=-]+)(\b)?/gu, (corresp, m1, m2, m3, decalage, m0) => {
            return (m1 ? m1 : '') + this.wordCompute(m2, square_pants) + (m3 ? m3 : '');
        });

        text = text.replace(/(^|\n|\t| )(!|\?)($|\n|\t| )/g, (corresp, m1, m2, m3, decalage, m0) => {
            return (m1 ? m1 : '') + this.makePunctuation(m2) + (m3 ? m3 : '');
        });

        text = text.replace(/(?<!\.)(\.{1})([\n\t| ]|$)/g, (corresp, m1, m2, decalage, m0) => {
            return this.addDots(m1) + (m2 ? m2 : '');
        });

        return text;
    }

    wordCompute(word, squarePants) {
        // Vérification si le word est un lien ou un arobase : aucun traitement à effectuer dans ce cas
        if (this.isALinkOrAtSign(word)) {
            return word;
        }

        // Recherche et suppression des s en bout de word
        if (word.match(/^\w+(s)$/ui)) {
            word = this.deleteS(word);
        }
        
        // Ajoute possiblement des insultes avant un point ou une virgule précédée d'un word.
        word = this.addInsult(word);
        
        // Gestion du fait que certains caractères soient aléatoirement déplacés dans la phrase à 2-3 caractères près
        word = this.randomizeChars(word);
        
        // Rajouter aléatoirement des caractères dans les words ou à la fin des caractères proches sur le clavier du carac précédent
        word = this.addRandomChars(word);
        
        // Remplacement aléatoire de certains caractères. Pour le moment e, i, r, a et n.
        word = this.replaceLetters(word);

        // Ecriture façon mocking spongebob si l'aléatoire l'a décidé
        if (squarePants) {
            word = this.squarePants(word);
        }

        return word;
    }

    isALinkOrAtSign(word) {
         // Si le mot passé est un @username ou un lien, la fonction renvoie vrai.
        if (word.match(/^(@\w)+/)) {
            return true;
        }
        if (word.match(/^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/)) {
            return true;
        }
        return false;
    }

    deleteS(word) {
        if (randomInt(1, 32768) < RAND_LIMIT_S){
            word = word.replace(/s$/gi, '');
        }

        return word;
    }

    addInsult(word) {
        // Traitement des virgules et points en bout de mot
        if (word.match(/(.+)(,|\.)(.*)/u)) {
            word = word.replace(/(.+)(,|\.)(.*)/u, (corresp, m1, m2, m3, decalage, m0) => {
                if (randomInt(1, 32768) < RAND_LIMIT_INSULTE) {
                    let pos_insult = randomInt(0, INSULTS.length - 1);

                    return m1 + " " + (ctype_upper(m1) ? INSULTS[pos_insult].toLocaleUpperCase() : INSULTS[pos_insult]) + m2 + m3;
                }

                return m0;
            });
        }
        return word;
    }

    randomizeChars(word) {
        let taille = word.length;
    
        // Nombre de caractères à inverser : dépendant de la taille du mot ; On considère deux chances si le mot est supérieur ou égal à 8 caractères, trois si >= 12...
        let chances = taille / 4;
        chances = Math.floor(chances);
        if (chances < 1) chances = 1;
        
        while (chances > 0) {
            if (randomInt(1, 32768) < RAND_LIMIT_RANCHAR && taille > 1) {
                let letter1 = randomInt(0, taille-1);
                if (word[letter1].match(/[a-z]/i)) {
                    let min;
                    // Ce bloc de 4 lignes permet de savoir quelles sont les bornes d'échanges de lettre. Par défaut, lettre-2 : lettre+2. Cependant, si on touche le min ou le max du mot, on les fixe.
                    if (letter1 - 2 < 0) min = 0;
                    else min = letter1 - 2;

                    let max;
                    if (letter1 + 2 > taille - 1) max = taille-1;
                    else max = letter1+2;
                    
                    let letter2 = letter1;
                    while (letter2 == letter1){
                        letter2 = randomInt(min, max);
                    } // On tire jusqu'à ce que les deux lettres tirées soient différentes. C'est forcément possible car on a vérifié au début que $taille > 1.

                    if (word[letter2].match(/[a-z]/i)) { // Si la lettre tirée est bien une lettre (non unicode, certes), on continue
                        let tmp2 = word[letter2];
                        let tmp1 = word[letter1];
                        let real_letter2 = (ctype_upper(tmp2) ? tmp1.toLocaleUpperCase() : tmp1.toLocaleLowerCase());
                        word = strReplaceAt(word, letter2, real_letter2);

                        let real_letter1 = (ctype_upper(tmp1) ? tmp2.toLocaleUpperCase() : tmp2.toLocaleLowerCase());
                        word = strReplaceAt(word, letter1, real_letter1);
                    }
                }
            }
            
            chances--;
        }

        return word;
    }

    addRandomChars(word) {
        let word_length = word.length;
        
        if (word_length > 2 && randomInt(1, 32768) < RAND_LIMIT_ADDCHARS) {
            let mixedres = str_split(word, this.subWordLength(word.length));

            let splitted_word_length = mixedres.length;

            if (splitted_word_length === 1) { // Le tableau ne contient qu'un seul élément : le mot n'a pas été scindé
                let letter = randomInt(0, word.length-1);
                let back_front = randomInt(0, 1); // Tire si la(s) nouvelle(s) lettre(s) est/sont placé(s) à gauche ou à droite de la lettre tirée
                let generated = this.generateChars(word[letter]);

                if(back_front == 0){
                    word = insertString(word, generated, letter);
                }
                else{
                    word = insertString(word, generated, letter+1);
                }
            }
            else { // Le tableau contient plusieurs parties (classes) : Choix de la classe
                // Tirage de la classe
                let $class = randomInt(0, splitted_word_length - 1);
                if ($class < splitted_word_length / 2) { // Nouveau tirage pour biaiser le choix de la classe vers les classes les plus élevées
                    $class = randomInt(0, splitted_word_length - 1);
                }
                // Classe choisie : Choix du caractère à l'intérieur de la classe
                let tailleclasse = mixedres[$class].length;
                let letter = randomInt(0, tailleclasse - 1);
                let back_front = randomInt(0, 1);
                let generated = this.generateChars(mixedres[$class][letter]);
                
                if(back_front == 0){
                    mixedres[$class] = insertString(mixedres[$class], generated, letter);
                }
                else{
                    mixedres[$class] = insertString(mixedres[$class], generated, letter + 1);
                }

                word = mixedres.join('');
            }
        }
        else if (word !== '') { // Si le word est petit et non vide
            let rand = randomInt(1, 32768);
            if (rand < RAND_LIMIT_ADDCHARS) {
                if (rand < RAND_LIMIT_ADDCHARS/2) { // Rajout d'un ou plusieurs caractères aléatoires au début
                    word = this.generateChars(word[0]) + word;
                }
                else { // Rajout d'un ou plusieurs caractères aléatoires à la fin
                    word += this.generateChars(word[word.length - 1]);
                }
            }
        }

        return word;
    }

    subWordLength(len) {
        let div = Math.floor(len / 4);

        if (div < 2) {
            return Math.floor(len + 1);
        }
        return div;
    }

    generateChars(char) {
        // Mémorisation si la lettre est en majuscule
        let is_up = false;
        if (ctype_upper(char)) {
            char = char.toLocaleLowerCase();
            is_up = true;
        }
        
        if (!REPLACEMENT_LETTERS[char]){
            return '';
        }
        // Nombre de remplacements possibles pour la lettre en cours
        let possible_replacements = REPLACEMENT_LETTERS[char].length;

        let numlettre = randomInt(0, possible_replacements - 1);
        // Sélection aléatoire de la lettre à ajouter depuis le tableau
        let res = REPLACEMENT_LETTERS[char][numlettre];
        
        let i = 0;
        // Chances de rajout supplémentaire : Limitaion à trois caractères supplémentaires (i < 3) soit 4 caractères maximum pour la chaîne retournée
        while (randomInt(1, 32768) < RAND_LIMIT_ADDCHARS && i < 3) {
            numlettre = randomInt(0, possible_replacements - 1);
            res += REPLACEMENT_LETTERS[char][numlettre];
            i++;
        }
        
        if (is_up) {
            res = res.toLocaleUpperCase();
        }
        return char;
    }

    static decodeHTML(text) {
        var entities = [
            ['amp', '&'],
            ['apos', '\''],
            ['#x27', '\''],
            ['#x2F', '/'],
            ['#39', '\''],
            ['#47', '/'],
            ['lt', '<'],
            ['gt', '>'],
            ['nbsp', ' '],
            ['quot', '"']
        ];
    
        for (var i = 0, max = entities.length; i < max; ++i) 
            text = text.replace(new RegExp('&'+entities[i][0]+';', 'g'), entities[i][1]);
    
        return text;
    }

    replaceLetters(word) {
        let tabLettre = {
            'e': ['e', 'r', 's', 'd'],
            'i': ['i', 'u', 'o', 'l'],
            'r': ['r', 'e', 'd', 'g'],
            'a': ['a', 'z', 'q', 's'],
            'n': ['n', 'b', 'j', 'h'],
        };
    
        for (const [letter, replacements] in Object.entries(tabLettre)) {
            word = word.replace(new RegExp(letter, 'ig'), (corresp, decalage, m0) => {
                if (randomInt(1, 32768) < RAND_LIMIT_LETTER && replacements) { // TODO replacements undefined
                    let letter = randomInt(0, replacements.length - 1);

                    if (ctype_upper(m0)) { // mat[0] correspond à l'entière chaîne capturée. L'expression rationnelle ne précisant qu'un caractère, mat[0] n'est qu'un simple caractère égal à $let.
                        return replacements[letter].toLocaleUpperCase();
                    }
                    else {
                        return replacements[letter];
                    }
                }
                else if (!replacements || !replacements.length) {
                    log.error("Replacement est indéfini: [" + String(index) + ", " + typeof replacements + "]");
                }

                return m0;
            });
        }

        return word;
    }

    squarePants(word) {
        let up = randomInt(0, 1);
        word = word.replace(/([a-z])/gi, (corresp, m1, decalage, m0) => {
            if (up) { // majuscule
                up = !(randomInt(0,9) <= 8);
                return m1.toLocaleUpperCase();
            }
            else {
                up = randomInt(0,9) <= 7;
                return m1.toLocaleLowerCase();
            }
        });

        return word;
    }

    makePunctuation(word) {
        // Multiplication des ! ou ? seuls
        if (randomInt(1, 32768) >= RAND_LIMIT_PONCTUATION) return word;
        
        if (word === '!') {
            let nb = randomInt(1, 5);
            while (nb > 1) {
                word += '!';
                nb--;
            }
        }
        else if (word === '?') {
            let nb = randomInt(1, 5);
            while (nb > 1) {
                word += '?';
                nb--;
            }
        }

        return word;
    }

    addDots(word) {
        if (randomInt(1, 32768) < RAND_LIMIT_DOTS) {
            let nb = randomInt(1, 5);
            let ch = '.';
            while (nb > 1) {
                ch += '.';
                nb--;
            }
            return ch;
        }

        return word;
    }

    saveLog(sended_tweet, poss = this.fusion_positions) {
        const to_save = {
            save_type: 'drunked',
            used_tweets: this.used_tweets,
            count: this.used_tweets.length,
            tweet: sended_tweet,
            misc: {
                drunk_percentage: PERCENTAGE_DRUNK,
                fusion_positions: poss
            }
        }

        const id_str_tweet = sended_tweet.id_str;

        fs.writeFileSync(BOT_USER_DIR + `${id_str_tweet}.json`, JSON.stringify(to_save));
    }

    static inUsedTweets(user_id_str, tweet_id_str) {
        const path = BOT_USER_DIR + `${tweet_id_str}.json`;

        if (fs.existsSync(path)) {
            const tweets = JSON.parse(fs.readFileSync(path, {flag: 'r'}));

            for (const tweet of tweets.used_tweets) {
                if (tweet.user.id_str === user_id_str) {
                    return true;
                }
            }
        }

        return false;
    }

    static getSourcesFromTweet(id_str, user_screen_name = null) {
        if (!id_str) {
            return null;
        }

        const path = BOT_USER_DIR + `${id_str}.json`;

        if (fs.existsSync(path)) {
            const tweets = JSON.parse(fs.readFileSync(path, {flag: 'r'}));

            let str = `Il y a ${tweets.count} tweet${tweets.count > 1 ? 's' : ''} utilisé${tweets.count > 1 ? 's' : ''}.\n`;

            if (tweets.count > 1) {
                let i = 1;

                for (const t of tweets.used_tweets) {
                    if (t.retweeted_status) { // le tweet choisi était un RT
                        let screen_name_rter = (t.user.screen_name === user_screen_name ? 
                                         'vous' : '@.' + t.user.screen_name);
                        str += `[${i}] RT @.${t.retweeted_status.user.screen_name} par ${screen_name_rter} :\n`;
                        str += "https://twitter.com/" + t.retweeted_status.user.screen_name + "/status/" + t.id_str + "\n";
                    }
                    else {
                        str += `[${i}] Tweet @.${t.user.screen_name} :\n`;
                        str += "https://twitter.com/" + t.user.screen_name + "/status/" + t.id_str + "\n";
                    }

                    i++;
                }
            }
            else {
                const t = tweets.used_tweets[0];

                if (t.retweeted_status) { // le tweet choisi était un RT
                    let screen_name_rter = (t.user.screen_name === user_screen_name ? 
                                     'vous' : '@.' + t.user.screen_name);
                    str += `RT @.${t.retweeted_status.user.screen_name} par ${screen_name_rter} :\n`;
                    str += "https://twitter.com/" + t.retweeted_status.user.screen_name + "/status/" + t.id_str + "\n";
                }
                else {
                    str += `Tweet @.${t.user.screen_name} :\n`;
                    str += "https://twitter.com/" + t.user.screen_name + "/status/" + t.id_str + "\n";
                }
            }

            str += "Log: https://alkihis.fr/get_sourced_log.php?tweet_id=" + id_str + "\n";

            return str;
        }

        return null;
    }

    static isTweetToSourced(text) {
        return text.match(/^(source|contexte?) ?\?*$/i) !== null;
    }

    static isTweetToDab(text) {
        return text.match(/^\*.*dab.*\* ?\?*$/i) !== null;
    }
    
    static isTweetToAcab(text) {
        return text.match(/^acab$/i) !== null;
    }

    static isTweetToMichelBaie(text) {
        return text.match(/^Mich( ?mich)*(el)? baie/i) !== null;
    }

    static isTweetToDelete(text, screen_name, status_id_str, user_id_str) {
        if (text.trim().match(/^supprime\.*$/i)) {
            for (const user of AUTHORIZED) {
                if (user.match(screen_name)) {
                    return true;
                }
            }
    
            if (status_id_str && user_id_str) {
                if (this.inUsedTweets(user_id_str, status_id_str)) {
                    return true;
                }
            }
        }

        return false;
    }

    addWordOnBeginning(text) {
        let adding = '';
        // Ajoute possiblement un mot au début du tweet
        if (randomInt(0, 32768) < RAND_LIMIT_ADDING) {
            adding = this.interestingWordIn(text); // Recherche un mot à mettre

            let punc = '';
            if(randomInt(0, 1) == 1){
                punc = '!';
            }
            else {
                punc = '?';
            }
            adding += ' ' + this.makePunctuation(punc); // Ajoute une ponctuation avec le mot intéressant
        }

        return adding;
    }

    interestingWordIn(text) {
        const NOT_INTERESTING = ['de', 'un', 'une', 'des', 'ça', 'ce', 'le', 'la', 'les', 'du', 'se', 'ses', 'ces',
                'je', 'suis', 'est', 'es', 'ai', 'ait', 'tu', 'il', 'elle',
                'iel', 'ils', 'elles', 'ont', 'sont', 'et'];

        // Split le tweets en mots (tableau)
        let mots = text.split(' ');

        let alea = 0;
        let tries = 0;
        let will_continue = true;

        do {
            alea = randomInt(0, mots.length-1);
            tries++;

            if (mots[alea] === '') {
                continue;
            }

            for (const word in NOT_INTERESTING) {
                if (!word.match(new RegExp(mots[alea], 'i'))) {
                    will_continue = false;
                    break;
                }
            }
        } while (will_continue && tries < 20);

        if (tries >= 20){
            return null;
        }
        else {
            return mots[alea];
        }
    }
}
