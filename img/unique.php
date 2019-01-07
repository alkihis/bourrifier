<?php

// Fonctions pour shitstorm unique

/**
 * Génération de shitstorm
 *
 * @param integer $idSub
 * ID de la shitstorm à générer
 * @param boolean $complete
 * Si la shitstorm doit comporter les flèches précédent/suivant, ainsi que le formulaire de post de réponse, et les commentaires
 * @return void
 */
function generateUniqueShitstorm(int $idSub, bool $complete = false) {
    global $connexion;
    // require_once(ROOT . '/inc/postDelete.php');

    $idUsrP = 0;
    $pubCom = null;
    $row = null;
    $done = false;
    $queryAnswer = false;

    // Vérifie l'existance de la shitstorm
    if($idSub > 0){
        $res = mysqli_query($connexion, "SELECT idUsr, idSub, title FROM Shitstorms WHERE idSub='$idSub';");
    }

    if($res && mysqli_num_rows($res) > 0){
        $row = mysqli_fetch_assoc($res);

        $res = mysqli_query($connexion, "SELECT *, (SELECT COUNT(*) FROM Comment WHERE idSub='$idSub') c FROM Shitstorms WHERE idSub='$idSub';");

        if($res && mysqli_num_rows($res) > 0){
            $done = true;
            $row = mysqli_fetch_assoc($res);
        }
    }

    if($done){
        $year = explode("-", $row['dateShit']);
        $month = getTextualMonth($year[1]);
    }

    if(!$res || @mysqli_num_rows($res) == 0){
        echo "<h4>Aucune shitstorm correspondant à l'identifiant n'a été trouvée.</h4>";
    }
    else{
        // Définition du titre de la page
        $GLOBALS['pageTitle'] = htmlspecialchars($row['title']) . ' - Journal des Shitstorms';

        $img_shitstorm_array = getAllImageLinksRelatedToShitstorm($idSub);
        $img_shitstorm = DEFAULT_CARD_IMG;
        if($img_shitstorm_array){
            $img_shitstorm = &$img_shitstorm_array[0];
        }

        if($GLOBALS['additionnals'] === 'new_answer') {
            $queryAnswer = true;
        }

        // Set les headers meta de la page
        $GLOBALS['addMeta'] = '<meta name="twitter:title" content="'.htmlspecialchars($row['title']).'"/>
        <meta name="twitter:description" content="Shitstorm du '.formatDate($row['dateShit'], false).'"/>
        <meta name="twitter:image" content="'.$img_shitstorm.'"/>';
        $htmled_dscr = $row['dscr'];
        // Trim de la description à 150 caractères max et ajouts de ... si besoin
        $GLOBALS['add_meta_description'] = strlen($htmled_dscr) > 150 ? substr($htmled_dscr, 0, 150)."..." : $htmled_dscr;

        // Affichage des boutons shitstorm précédente / suivante
        $idPrevious = getIDFromPreviousSS($idSub, $row['dateShit']);
        $idNext = getIDFromNextSS($idSub, $row['dateShit']);
        

        $GLOBALS['turn_off_container'] = true;

        // Récup du premier lien de la shitstorm (les possibles suivants ne sont pas chargés dans le journal)
        $linksres = mysqli_query($connexion, "SELECT * FROM Links WHERE idSub='$idSub' ORDER BY idLink ASC;");
        if(!$linksres || @mysqli_num_rows($linksres) == 0){
            echo "<p class='empty'>Impossible de charger les liens correspondants à la shitstorm. Veuillez recharger la page.</p>";
            exit();
        }
        $nbLink = mysqli_num_rows($linksres);

        // Récup de(s) possible(s) réponse(s)
        $linkAnswer = mysqli_query($connexion, "SELECT a.*, u.usrname, u.realname FROM Answers a JOIN Users u ON a.idUsrA=u.id WHERE idSub='$idSub';");
        $hasAnswer = NULL;
        $answer = NULL;
        if(!$linkAnswer || mysqli_num_rows($linkAnswer) == 0){
            $hasAnswer = false;
        }
        else{
            $hasAnswer = mysqli_num_rows($linkAnswer);
        }

        // Récupération du nombre de likes
        $nbLikes = recupereNbLikes($idSub);
        if(!$nbLikes){
            $nbLikes = '0';
        }
        
        // Récupération du nombre de commentaires
        $nbCom = 0;
        $resCom = mysqli_query($connexion, "SELECT COUNT(*) c FROM Comment WHERE idSub='$idSub';");
        if($resCom && mysqli_num_rows($resCom)){
            $rowCom = mysqli_fetch_assoc($resCom);
            $nbCom = $rowCom['c'];
        }

        // Récupération si l'utilisateur courant a like ou dislike
        $hasLiked = false;
        $hasDisliked = false;

        if(isset($_SESSION['id']) && isset($_SESSION['connected']) && $_SESSION['connected']){
            $resPresence = mysqli_query($connexion, "SELECT * FROM ShitLikes WHERE idUsr='{$_SESSION['id']}' AND idSub='$idSub';");
            if($resPresence && mysqli_num_rows($resPresence) > 0){
                $rowPres = mysqli_fetch_assoc($resPresence);
                if($rowPres['isLike']){
                    $hasLiked = true;
                }
                else{
                    $hasDisliked = true;
                }
            }
        }

        // Bouton de suivi de la shitstorm
        if(isset($_SESSION['id'], $_SESSION['connected']) && $_SESSION['connected']){ 
            // Vérification si elle est suivi par l'utilisateur connectée
            $resFol = mysqli_query($connexion, "SELECT withMail FROM ShitFollowings WHERE idFollowed='$idSub' AND idFollower='{$_SESSION['id']}';");

            $with_mail = false;
            $is_followed = false;

            if($resFol && mysqli_num_rows($resFol)){
                $rowFol = mysqli_fetch_assoc($resFol);
                $with_mail = $rowFol['withMail'];
                $is_followed = true;
            }
            ?>
            <!-- Dropdown Structure -->
            <ul id='follow_shit_drop<?= $idSub ?>' class='dropdown-content' data-title='<?= htmlspecialchars($row['title'], ENT_QUOTES) ?>'>
                <li>
                    <span>
                        <input class='follow-activate follow-shitstorm-checkbox' data-idsub='<?= $idSub ?>' type='checkbox' id='followed_shit<?= $idSub ?>' <?= ($is_followed ? 'checked' : '') ?>>
                        <label class='black-text' for="followed_shit<?= $idSub ?>"><?= $is_followed ? 'Suivie' : 'Suivre' ?></label>
                    </span>
                </li>
                <li>
                    <span>
                        <input class='follow-activate email-shitstorm-checkbox' data-idsub='<?= $idSub ?>' type='checkbox' id='followed_shit_with_mail<?= $idSub ?>' <?= ($with_mail ? 'checked' : '') ?>>
                        <label class='black-text' for="followed_shit_with_mail<?= $idSub ?>">E-mails</label>
                    </span>
                </li>
            </ul> <?php 
        }

        $s_num = ($hasAnswer ? 4 : 6);

        $onglets = "<li class='tab col s$s_num'><a class='active' href='#shitstorm'>Lien" . ($nbLink > 1 ? 's' : '') . "</a></li>" . 
                ($hasAnswer ? "<li class='tab col s$s_num'><a href='#answer_b'>Réponse".($hasAnswer > 1 ? 's' : '')."</a></li>" : '') . 
                "<li class='tab col s$s_num'><a id='comment_tab_trigger' data-comment-count='$nbCom' href='#comments_b'>Commentaires ($nbCom)</a></li>";

        $uniqid = md5(random_bytes(4));
        // ------------
        // PUBLICATION
        // ------------
        if($complete) { ?>
            <script src="<?= HTTPS_URL ?>js/unique.js"></script>
        <?php }
        else {
            echo '<script>'. file_get_contents(ROOT . '/js/unique_without_follow.js') .'</script>';
        }
        ?>

        <!-- Début affichage -->
        <?php if($img_shitstorm != DEFAULT_CARD_IMG) { ?>
            <div class="parallax-container parallax-container-shitstorm <?= ($complete ? '' : 'force-mobile') ?>"
                style='background-image: url("<?= $img_shitstorm ?>");'>
                <?= ($complete ? '<div class="parallax not-on-mobile no-z-index"><img src="' . $img_shitstorm . '"></div>' : '') ?>
                <span class="title title-unique-shit title-parallax white-text with-border"><?= htmlspecialchars($row['title']) ?></span>
            </div>
            <div class="row no-margin"><ul class="tabs"><div class="col s12 l8 offset-l2"><?= $onglets ?></div></ul></div>
        <?php }
        
        else { ?>
            <div class="row no-margin"><ul class="tabs"><div class="col s12 l8 offset-l2"><?= $onglets ?></div></ul></div>
            <div class="section" style='margin-bottom: 0; padding-bottom: 0;'>
                <div class='row' style='margin-bottom: 0; margin-top: 15px;'>
                    <div class='col s12 l10 offset-l1'>
                        <span class="title title-unique-shit title-no-parallax"><?= htmlspecialchars($row['title']) ?></span>
                    </div>
                </div>
            </div>
        <?php } ?>

        <!-- Description, boutons d'interactions -->
        <div class="section">
            <div class='left hide-on-med-and-down' style='width: 15%'> 
                <?php if($complete) { ?>
                <span class="pag <?= ($idPrevious ? 'waves-effect' : 'disabled') ?>"><a href="<?= ($idPrevious ? HTTPS_URL . "shitstorm/$idPrevious" : '#!' ) ?>"><i class="material-icons pag">chevron_left</i></a></span>
                <?php } ?>
            </div>
            <div class='right hide-on-med-and-down' style='width: 15%'> 
                <?php if($complete) { ?>
                <span class="pag right <?= ($idNext ? 'waves-effect' : 'disabled') ?>"><a href="<?= ($idNext ? HTTPS_URL . "shitstorm/$idNext" : '#!' ) ?>"><i class="material-icons pag">chevron_right</i></a></span>
                <?php } ?>
            </div>

            <div class="row container">
                <h2 class="header"><?= formatDate($row['dateShit'], false) ?></h2>
                <p class="flow-text black-text" style='margin-bottom: 0'>
                    <?= detectTransformLink(preg_replace('/\n/', '<br>', htmlspecialchars($row['dscr']))) ?>
                </p>
                <?php if(!$complete) { ?>
                    <p class="flow-text black-text" style='margin-bottom: 0'>
                        <a href='<?= HTTPS_URL ?>shitstorm/<?= $row['idSub'] ?>' title='Voir la shitstorm'>Voir la shitstorm entière</a>
                    </p>
                <?php } ?>
                <p class='black-text' style='font-size: small; font-style: italic;'>
                    Postée par
                    <?php if($row['idUsr'] > 0){ ?>
                        <a href='<?= HTTPS_URL ?>profil/<?= $row['idUsr'] ?>'><?= htmlspecialchars($row['pseudo']) ?></a>
                    <?php }
                    else{
                        echo htmlspecialchars($row['pseudo']);
                    } ?>
                    le <?= formatDate($row['approvalDate'], 0) ?>
                </p>

                <!-- Description -->
                <p style="margin-bottom: 1em;">
                    <!-- Boutons like/dislike -->
                    <div style="margin-bottom: 1em;">
                        <span class='likeButtons'>
                            <?php
                            if(isset($_SESSION['id']) && isset($_SESSION['connected'])): ?>
                                <button type='button' class='btn-floating blue lighten-2 tooltipped left' data-position="bottom" data-delay="10" data-tooltip="+1" 
                                    style='margin-right: 10px;' name='favSub'>
                                    <i class='material-icons<?= ($hasLiked ? ' liked' : '') ?> like-button' data-shitstorm-id='<?= $row['idSub'] ?>'
                                        >keyboard_arrow_up</i>
                                </button> 
                                <button type='button' class='btn-floating red lighten-3 tooltipped left' data-position="bottom" data-delay="10" data-tooltip="-1" 
                                    style='margin-right: 10px;' name='unfavSub'>
                                    <i class='material-icons<?= ($hasDisliked ? ' disliked' : '') ?> dislike-button' data-shitstorm-id='<?= $row['idSub'] ?>'
                                        >keyboard_arrow_down</i>
                                </button> 
                                <?php
                            endif;
                            ?>
                            
                            <button class="btn-floating orange darken-5 tooltipped shitstorm-rates-button" data-position="bottom" data-delay="10" data-tooltip="Note" 
                                style="float: left; margin-bottom: 1em;" data-shitstorm-id='<?= $row['idSub'] ?>'
                                ><?= $nbLikes ?>
                            </button> 
                            <?php if($complete && isset($_SESSION['id'], $_SESSION['connected']) && $_SESSION['connected']) { ?>
                                <button class='left btn-floating <?= $is_followed ? 'green' : 'grey' ?> dropdown-button' style='margin-left: 10px;' 
                                    id='follow_shit_button<?= $idSub ?>' data-activates='follow_shit_drop<?= $idSub ?>'>
                                    <i id='follow_shit_bell<?= $idSub ?>' class='material-icons'><?= $is_followed ? 'notifications' : 'notifications_off' ?></i>
                                </button>
                            <?php } ?>
                        </span> 
                    </div>

                    <!-- Boutons éditions / proposer réponse -->
                    <div> <?php 
                        if((isset($_SESSION['id']) && $_SESSION['id'] == $row['idUsr']) || (isset($_SESSION['mod']) && $_SESSION['mod'] > 0)){ ?>
                            <a href='<?= HTTPS_URL ?>modify/<?= $idSub ?>'>
                                <button style='float: left; margin-bottom: 1em; margin-left: 10px;' name='edit' class='btn-floating waves-effect waves-light teal tooltipped'
                                    data-position='bottom' data-delay='10' data-tooltip='Éditer'>
                                    <i class='material-icons left'>mode_edit</i>
                                </button>
                            </a>
                        <?php } 
                        if ($complete && (!$hasAnswer || $hasAnswer < MAX_ANSWER_COUNT)){ ?>
                            <a href='#!' onclick='$("#new_answer").slideToggle(200);'>
                                <button class='btn-floating waves-effect waves-light teal lighten-2 tooltipped' data-position='bottom' data-delay='10' data-tooltip='Proposer une réponse'
                                    style='float: left; margin-bottom: 1em; margin-left: 10px;'><i class="material-icons right">announcement</i>
                                </button>
                            </a>
                        <?php } ?>
                    </div>

                    <div class='left' style='margin-left: .8em; margin-top: 9px;'>
                        <span>
                            <a class="twitter-share-button" 
                                href="https://twitter.com/intent/tweet?text=<?= urlencode($row['title']) ?>&url=<?= urlencode('https://shitstorm.fr/shitstorm/'.$row['idSub']) ?>">
                            </a>
                        </span>
                    </div>
                </p>
            </div>
        </div>

        <?php if($complete && (!$hasAnswer || $hasAnswer < MAX_ANSWER_COUNT)) { 
            $full = explode('-', $row['dateShit']);
            $month = $full[1];
            $day = $full[2];
            $year = $full[0];
            ?>
            <div class="section" id="new_answer" style="display: none;">
                <div class="row container">
                    <?php require_once(PAGES_DIR . 'queryAnswer.php'); ?>
                    <script src='<?= HTTPS_URL ?>js/date.js'></script>
                    <script>
                        changeMinDate(<?= "$year, $month, $day" ?>);
                    </script>
                </div>
            </div>
        <?php } ?>

        <!-- Liens -->
        <div class="section" id='shitstorm'>
            <div class="row container">
                <h2 class="header">Lien<?= $nbLink > 1 ? 's' : '' ?></h2>
                <div class='link center'>
                    <?php generateUniqueShitTweetsFromMysqliLinksRes($linksres); ?>
                    <div class='clearb'></div>
                </div>
            </div>
        </div>

        <?php if($hasAnswer){ ?>
        <div class='section' id='answer_b'>
            <div class='row container'>
                <h2 class="header">Réponse<?=($hasAnswer > 1 ? 's' : '') ?></h2>
                <?php
                    // REPONSE DU CREATEUR 
                    if(!generateAnswersForUniqueShit($linkAnswer)){
                        echo "<h4>Une erreur est survenue lors de la génération des réponses.</h4>";
                    } 
                ?>
            </div>
        </div>
        <?php } ?>

        <div class="section" id='comments_b'>
            <div class="row container">
                <h2 class="header">Commentaires</h2>
                <div class='col s12 l10 offset-l1'>
                    <!-- Commentaires -->
                    <div>
                        <div id='sorting_comment_block' class='card-new-flow' style="padding-top: .8em; display: none;">
                            <h6 class='center'>Tri des commentaires</h6>
                            <form>
                                <select id='selecttype' data-sub='<?= $row['idSub'] ?>' name='selecttype' class='col s5'>
                                    <option value='date' selected>Date</option>
                                    <option value='rate'>Note</option>
                                </select>
                                <select id='selectsort' data-sub='<?= $row['idSub'] ?>' name='selectsort' class='col s5 offset-s2'>
                                    <option value='asc'>Croissante</option>
                                    <option value='desc' selected>Décroissante</option>
                                </select>
                                <div class='clearb'></div>
                            </form>
                        </div>

                        <div id='comment_parent_block'>
                        </div>
                        <script async>
                            $(document).ready(function () {
                                initComment(<?= $row['idSub'] ?>);
                            });
                        </script>
                        <div class='clearb'></div>

                        <?php
                        if(isset($_SESSION['connected']) && $_SESSION['connected']){?>
                            <div class='card-user-new border-user new-comment-card'>                              
                                    <textarea style="margin-bottom: 0.5em;" id='contentCom' name="contentCom" rows="5" cols="50" placeholder="Ecrivez un nouveau commentaire..."
                                        data-idsub='' maxlength="<?= strval(MAX_LEN_COMMENT) ?>" class="materialize-textarea comment-textaera" required><?php 
                                        if($pubCom)
                                            echo htmlentities($_POST['contentCom']);
                                    ?></textarea>
                                    <input type='hidden' id='reply_to' name='in_reply_to_id' value='0'>
                                    <div class="row" style='margin-bottom: 0'>
                                        <span class='flow-text right' style='margin-right: .7em;'><a id='pubCom' name="pubCom" class='card-pointer' onclick="postComment(<?= $row['idSub'] ?>)">Publier</a></span>
                                    </div>
                                </div>
                            </div> <?php
                        }
                        else{
                            echo "<p style='margin-bottom: 0.9em; font-style: italic;'>Connectez-vous pour pouvoir commenter cette shitstorm</p>";
                        }
                        ?>
                    </div>
                </div>
            </div>
        </div>
        
        <?php if(count($img_shitstorm_array) > 1) { ?>
            <div class="parallax-container parallax-container-shitstorm <?= ($complete ? '' : 'force-mobile') ?>" 
                style='background-image: url("<?= $img_shitstorm_array[1] ?>")'>
                <?= ($complete ? '<div class="parallax not-on-mobile no-z-index"><img src="' . $img_shitstorm_array[1] . '"></div>' : '') ?>
            </div>
        <?php } 
        
        if($complete && ($idPrevious || $idNext)) { ?>
            <script>
                var isPrev = <?= ($idPrevious ? $idPrevious : 0) ?>;
                var isNext = <?= ($idNext ? $idNext : 0) ?>;
                var hammertime = new Hammer(document.getElementsByTagName('main')[0], {});
                hammertime.on('swipe', function(ev) {
                    if(ev.direction === 4 && isPrev){ // On veut voir le précédent (glisser de gauche à droite)
                        window.location = https_url + "shitstorm/" + String(isPrev);
                    }
                    else if(ev.direction === 2 && isNext){ // On veut voir le suivant (glisser de droite à gauche)
                        window.location = https_url + "shitstorm/" + String(isNext);
                    }
                });
            </script>
        <?php }
    }

}
