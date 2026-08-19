// ============================================================
//  XLDiff — help.js
//  Onboarding et aide, mutualisés pour toutes les pages.
//
//  Deux dispositifs complémentaires, volontairement légers :
//    • la VISITE GUIDÉE — 3 ou 4 bulles qui pointent tour à tour
//      les zones de la page. Elle ne se déclenche qu'au premier
//      passage sur CETTE page (mémorisé dans localStorage) et se
//      passe d'un clic ;
//    • le VOLET D'AIDE — ouvert par le bouton « ? » de l'en-tête,
//      il donne l'aide complète de la page (étapes, options,
//      lecture des résultats, questions fréquentes) et permet de
//      rejouer la visite guidée à tout moment.
//
//  La page ne fournit qu'une variable, avant ce script :
//      <script>window.XLDIFF_PAGE = 'advanced';</script>
//  Tout le reste (bouton « ? », voile, bulles, volet) est injecté
//  ici — aucune page n'a de balisage d'aide à porter.
//
//  Aucune dépendance : ni SheetJS ni les autres scripts XLDiff.
// ============================================================

(() => {
  // Bump uniquement quand le CONTENU d'une visite change : les
  // usagers qui l'ont déjà vue la reverront alors une fois.
  const VERSION_VISITE = '3.0';

  // ---------- Contenu, par page ----------
  //   visite   : bulles successives { cible, titre, texte }
  //              cible = sélecteur (ou liste : la 1re zone visible
  //              gagne) ; si rien n'est visible, la bulle s'affiche
  //              au centre, sans flèche.
  //   sections : aide détaillée du volet
  //   faq      : questions fréquentes (repliées)

  const AIDE = {
    home: {
      titre: 'Accueil',
      visite: [
        {
          cible: '.choice-grid',
          titre: 'Commencez par le type d\'analyse',
          texte: 'Les <strong>différences</strong>, ce sont les lignes présentes dans un fichier et absentes de l\'autre. Les <strong>doublons</strong>, ce sont les lignes que l\'on retrouve dans plusieurs fichiers. Cliquez sur la carte qui correspond à votre besoin.',
        },
        {
          cible: ['#modeSectionDiff.visible', '#modeSectionDupes.visible', '.choice-grid'],
          titre: 'Puis dites si vos fichiers se ressemblent',
          texte: 'Une seconde question apparaît : <strong>vos fichiers ont-ils les mêmes colonnes ?</strong> Si oui, le mode <strong>simple</strong> fait tout automatiquement. Sinon, le mode <strong>avancé</strong> vous laisse associer vous-même les colonnes — et accepte un troisième fichier.',
        },
        {
          cible: '.privacy-note',
          titre: 'Vos fichiers restent sur votre poste',
          texte: 'Tout est calculé dans votre navigateur : aucun fichier n\'est envoyé sur le réseau. Cette présentation ne s\'affiche qu\'une fois — le bouton <strong>?</strong> en haut à droite la rouvre quand vous voulez.',
        },
      ],
      sections: [
        {
          titre: 'Les deux analyses',
          html: `<ul>
            <li><strong>Les différences</strong> — les lignes présentes dans un fichier mais absentes d'un autre. C'est le choix pour contrôler ce qui a été ajouté ou retiré entre deux extractions.</li>
            <li><strong>Les doublons</strong> — les lignes présentes à la fois dans plusieurs fichiers. C'est le choix pour repérer ce qui se recoupe entre deux listes.</li>
          </ul>`,
        },
        {
          titre: 'Simple ou avancé ?',
          html: `<ul>
            <li><strong>Simple</strong> : vos fichiers viennent du même export Excel et portent les mêmes colonnes. Rien à régler.</li>
            <li><strong>Avancé</strong> : vos fichiers sont différents. Vous choisissez la feuille de chaque classeur, puis vous associez les colonnes qui se correspondent. Un troisième fichier est possible.</li>
          </ul>`,
        },
        {
          titre: 'Formats acceptés',
          html: `<p><code>.xlsx</code>, <code>.xls</code>, <code>.csv</code> et <code>.htm</code> / <code>.html</code> (exports Excel au format page web). Si un classeur contient plusieurs feuilles, XLDiff vous laisse choisir celle à analyser.</p>`,
        },
      ],
      faq: [
        {
          q: 'Mes fichiers sont-ils envoyés quelque part ?',
          r: 'Non. XLDiff fonctionne entièrement dans votre navigateur : les fichiers ne quittent jamais votre poste, même sur le site en ligne.',
        },
        {
          q: 'Puis-je analyser trois fichiers ?',
          r: 'Oui, dans les deux modes avancés (comparatif avancé et doublons avancé). Le troisième fichier est facultatif : déposez-en deux, et un troisième si vous en avez besoin.',
        },
        {
          q: 'Combien de lignes XLDiff accepte-t-il ?',
          r: 'Des fichiers de plusieurs centaines de milliers de lignes passent sans difficulté. L\'affichage ne charge que les lignes visibles à l\'écran, le défilement reste fluide.',
        },
      ],
    },

    simple: {
      titre: 'Comparatif simple',
      visite: [
        {
          cible: '.drop-row',
          titre: 'Déposez vos deux fichiers',
          texte: 'Glissez-déposez un fichier dans chaque zone, ou cliquez pour le choisir. Formats acceptés : <code>.xlsx</code>, <code>.xls</code>, <code>.csv</code>, <code>.htm</code>. Si le classeur contient plusieurs feuilles, un menu vous laisse choisir laquelle analyser.',
        },
        {
          cible: ['#btnCompare', '.action-bar'],
          titre: 'Lancez la comparaison',
          texte: 'Les colonnes communes aux deux fichiers sont détectées toutes seules : vous n\'avez rien à régler. La comparaison porte sur <strong>toutes</strong> ces colonnes — deux lignes sont identiques si toutes leurs valeurs le sont.',
        },
        {
          cible: ['#results.visible', '.action-bar'],
          titre: 'Lisez le résultat',
          texte: 'Le résultat commence par un <strong>résumé en phrases simples</strong>, suivi du détail ligne par ligne dans des onglets. Le bouton <strong>Exporter .xlsx</strong> enregistre tout dans un fichier Excel, et <strong>Recommencer</strong> repart d\'une page vierge.',
        },
      ],
      sections: [
        {
          titre: 'Quand utiliser ce mode',
          html: `<p>Le comparatif simple est fait pour <strong>deux fichiers issus du même export Excel</strong> : mêmes colonnes, mêmes intitulés. Si vos fichiers viennent de deux outils différents, passez par le <strong>comparatif avancé</strong>.</p>`,
        },
        {
          titre: 'Comment les lignes sont comparées',
          html: `<ul>
            <li>Les colonnes portant le même nom dans les deux fichiers sont retenues automatiquement.</li>
            <li>Deux lignes se correspondent si <strong>toutes</strong> ces colonnes sont identiques.</li>
            <li>Les répétitions comptent : une ligne présente 3 fois dans A et 1 fois dans B laisse 2 lignes signalées « uniquement A ».</li>
          </ul>`,
        },
        {
          titre: 'Lire les résultats',
          html: `<ul>
            <li><strong>Toutes les différences</strong> — la liste complète ; la colonne <em>Source</em> dit de quel fichier vient chaque ligne.</li>
            <li><strong>Uniquement A</strong> / <strong>Uniquement B</strong> — le détail fichier par fichier.</li>
            <li>Le numéro affiché est celui de la ligne dans le fichier Excel d'origine (l'en-tête est la ligne 1).</li>
          </ul>`,
        },
      ],
      faq: [
        {
          q: '« Aucune colonne commune » : que faire ?',
          r: 'Les deux fichiers n\'ont aucun intitulé de colonne en commun — ils ne viennent probablement pas du même export. Utilisez le comparatif avancé, qui vous laisse associer les colonnes à la main.',
        },
        {
          q: 'Mon fichier a plusieurs onglets',
          r: 'XLDiff pré-sélectionne l\'onglet contenant le plus de données et affiche un menu pour en changer.',
        },
        {
          q: 'Une même ligne apparaît plusieurs fois',
          r: 'C\'est normal : les répétitions sont comptées. Si une ligne existe 3 fois d\'un côté et 1 fois de l\'autre, les 2 exemplaires en trop sont signalés.',
        },
      ],
    },

    doublons: {
      titre: 'Doublons simple',
      visite: [
        {
          cible: '.drop-row',
          titre: 'Déposez vos deux fichiers',
          texte: 'Glissez-déposez un fichier dans chaque zone, ou cliquez pour le choisir. Formats acceptés : <code>.xlsx</code>, <code>.xls</code>, <code>.csv</code>, <code>.htm</code>. Si le classeur contient plusieurs feuilles, un menu vous laisse choisir laquelle analyser.',
        },
        {
          cible: ['#btnCompare', '.action-bar'],
          titre: 'Lancez la recherche',
          texte: 'Les colonnes communes aux deux fichiers sont détectées toutes seules. Deux lignes sont <strong>en double</strong> si toutes leurs colonnes sont identiques — c\'est l\'inverse exact de la recherche de différences.',
        },
        {
          cible: ['#results.visible', '.action-bar'],
          titre: 'Lisez le résultat',
          texte: 'Un <strong>résumé en phrases simples</strong>, puis le détail : les lignes en double vues côté A, puis côté B. Le bouton <strong>Exporter .xlsx</strong> enregistre la liste dans un fichier Excel.',
        },
      ],
      sections: [
        {
          titre: 'Ce que cherche ce mode',
          html: `<p>Les <strong>lignes communes aux deux fichiers</strong> : celles qui figurent à la fois dans A et dans B. Il ne s'agit pas des lignes répétées à l'intérieur d'un même fichier.</p>`,
        },
        {
          titre: 'Comment les doublons sont trouvés',
          html: `<ul>
            <li>Les colonnes portant le même nom dans les deux fichiers sont retenues automatiquement.</li>
            <li>Deux lignes sont en double si <strong>toutes</strong> ces colonnes sont identiques.</li>
            <li>Les répétitions comptent : une ligne présente 3 fois dans A et 1 fois dans B compte pour 1 doublon.</li>
          </ul>`,
        },
        {
          titre: 'Lire les résultats',
          html: `<ul>
            <li><strong>Tous les doublons</strong> — la liste complète, la colonne <em>Source</em> indiquant le fichier d'origine.</li>
            <li><strong>Doublons côté A</strong> / <strong>côté B</strong> — la même information vue depuis chaque fichier, avec le numéro de ligne d'origine.</li>
          </ul>`,
        },
      ],
      faq: [
        {
          q: '« Aucune colonne commune » : que faire ?',
          r: 'Vos fichiers ne viennent pas du même export. Utilisez les doublons avancé : vous y associez les colonnes vous-même.',
        },
        {
          q: 'Je veux les doublons à l\'intérieur d\'un seul fichier',
          r: 'XLDiff compare des fichiers entre eux ; il ne cherche pas les répétitions internes à un fichier. Un contournement : déposer le même fichier des deux côtés.',
        },
        {
          q: 'Puis-je chercher sur trois fichiers ?',
          r: 'Oui, avec les doublons avancé : le fichier C y est facultatif et la colonne « Présente dans » indique dans quels fichiers chaque ligne se retrouve.',
        },
      ],
    },

    advanced: {
      titre: 'Comparatif avancé',
      visite: [
        {
          cible: '.drop-row',
          titre: 'Déposez vos fichiers',
          texte: 'Deux fichiers suffisent ; le <strong>fichier C est facultatif</strong> et permet de comparer trois fichiers d\'un coup. Ils peuvent venir d\'outils différents et n\'ont pas besoin d\'avoir les mêmes colonnes.',
        },
        {
          cible: ['#mappingPanel.visible', '#mappingPanel', '.drop-row'],
          titre: 'Colonnes de rapprochement',
          texte: 'Ce sont les colonnes qui <strong>identifient une même ligne</strong> d\'un fichier à l\'autre — par exemple le nom et la date de naissance. Une ligne sans équivalent dans un autre fichier est signalée comme différence. Les colonnes de même nom sont pré-associées.',
        },
        {
          cible: ['#comparePanel.visible', '#comparePanel', '.drop-row'],
          titre: 'Colonnes à comparer (facultatif)',
          texte: 'Une fois la ligne retrouvée, XLDiff vérifie le contenu de ces colonnes — l\'adresse, par exemple. Les lignes retrouvées dont une valeur diffère ne sont pas des absences : elles remontent dans l\'onglet <strong>Retrouvées mais différentes</strong>.',
        },
        {
          cible: '.action-bar',
          titre: 'Comparez, puis exportez',
          texte: 'Deux exports vous attendent : <strong>Exporter .xlsx</strong> pour la liste des différences, et <strong>Exporter le fichier A annoté</strong> pour reprendre votre fichier A tel quel avec le verdict de l\'analyse ajouté à droite.',
        },
      ],
      sections: [
        {
          titre: 'Les étapes',
          html: `<ol>
            <li><strong>Choix des feuilles</strong> — n'apparaît que si un classeur contient plusieurs onglets ; la feuille la plus fournie est pré-sélectionnée.</li>
            <li><strong>Colonnes de rapprochement</strong> — la clé qui identifie une ligne (nom + date de naissance, n° de dossier…). Obligatoire.</li>
            <li><strong>Colonnes à comparer</strong> — facultatif : le contenu vérifié une fois la ligne retrouvée.</li>
            <li><strong>Comparer</strong> — puis lecture du résumé, du détail et des exports.</li>
          </ol>`,
        },
        {
          titre: 'Les deux sortes de colonnes',
          html: `<p>Les colonnes de <strong>rapprochement</strong> servent à <em>retrouver</em> la ligne : elles sont comparées caractère par caractère. Les colonnes <strong>à comparer</strong> servent à <em>contrôler</em> son contenu : là, les majuscules, les espaces en trop et le format des dates sont ignorés.</p>`,
        },
        {
          titre: 'Les options',
          html: `<ul>
            <li><strong>Ignorer les lignes en double au sein d'un même fichier</strong> — une ligne présente dans tous les fichiers n'est plus signalée, même si elle s'y répète un nombre de fois différent. Seules les lignes absentes d'un fichier remontent.</li>
            <li><strong>Afficher toutes les colonnes</strong> — bascule entre les seules colonnes rapprochées et comparées, et l'intégralité des colonnes.</li>
          </ul>`,
        },
        {
          titre: 'Lire les résultats',
          html: `<ul>
            <li><strong>Toutes les différences</strong> — les lignes absentes d'au moins un fichier.</li>
            <li><strong>Retrouvées mais différentes</strong> — les lignes présentes partout dont une colonne comparée diverge, affichées <em>valeur A → valeur B</em>.</li>
            <li>Un onglet par fichier, et avec trois fichiers une colonne <strong>Présente dans</strong> (« A + B » = ligne absente de C).</li>
          </ul>`,
        },
        {
          titre: 'Les exports',
          html: `<ul>
            <li><strong>Exporter .xlsx</strong> — la liste des différences, plus une feuille pour les lignes retrouvées mais différentes (une colonne par fichier).</li>
            <li><strong>Exporter le fichier A annoté</strong> — votre fichier A complet, avec à droite <em>Statut</em>, <em>Présente dans</em>, <em>Colonnes en écart</em>, la valeur des autres fichiers et la ligne d'origine. Les lignes venues de B ou C sont ajoutées à la suite.</li>
          </ul>`,
        },
      ],
      faq: [
        {
          q: 'Quelle différence entre les deux panneaux de colonnes ?',
          r: 'Le premier sert à retrouver la ligne (la clé), le second à vérifier son contenu. Une ligne retrouvée dont une colonne comparée diffère n\'est pas une absence : elle est listée à part.',
        },
        {
          q: 'Deux personnes portent le même nom',
          r: 'Si la clé n\'est pas unique, les occurrences sont appariées dans leur ordre d\'apparition (la 1re avec la 1re, la 2e avec la 2e) et le surplus est signalé comme absence. Ajoutez une colonne de rapprochement plus discriminante si besoin.',
        },
        {
          q: 'Comment comparer trois fichiers ?',
          r: 'Déposez un fichier dans la zone C. Chaque fichier reçoit son onglet de lignes absentes ailleurs, et la colonne « Présente dans » indique où chaque ligne se trouve.',
        },
        {
          q: 'Une date apparaît en écart alors qu\'elle est identique',
          r: 'Sur les colonnes comparées, les dates sont ramenées au format JJ/MM/AAAA avant comparaison, justement pour éviter ce cas. Si l\'écart persiste, la valeur est sans doute du texte d\'un côté et une vraie date de l\'autre, avec un contenu réellement différent.',
        },
      ],
    },

    'doublons-avance': {
      titre: 'Doublons avancé',
      visite: [
        {
          cible: '.drop-row',
          titre: 'Déposez vos fichiers',
          texte: 'Deux fichiers suffisent ; le <strong>fichier C est facultatif</strong> et permet de chercher les doublons sur trois fichiers. Ils peuvent venir d\'outils différents et n\'ont pas besoin d\'avoir les mêmes colonnes.',
        },
        {
          cible: ['#mappingPanel.visible', '#mappingPanel', '.drop-row'],
          titre: 'Associez les colonnes',
          texte: 'Indiquez quelles colonnes se correspondent d\'un fichier à l\'autre — par exemple <em>Nom</em> dans A et <em>Raison sociale</em> dans B. Deux lignes sont <strong>en double</strong> si toutes les colonnes associées sont identiques. Les colonnes de même nom sont pré-associées.',
        },
        {
          cible: '.action-bar',
          titre: 'Cherchez, puis exportez',
          texte: 'Le résultat s\'ouvre sur un résumé en phrases simples, puis le détail par fichier. Avec trois fichiers, une ligne est en double dès qu\'elle se retrouve dans <strong>au moins un autre fichier</strong> : la colonne <strong>Présente dans</strong> dit lesquels.',
        },
      ],
      sections: [
        {
          titre: 'Ce que cherche ce mode',
          html: `<p>Les <strong>lignes communes à plusieurs fichiers</strong>, quand ces fichiers n'ont pas les mêmes colonnes. Vous décidez vous-même ce qui fait qu'une ligne est « la même » en associant les colonnes.</p>`,
        },
        {
          titre: 'Les étapes',
          html: `<ol>
            <li><strong>Choix des feuilles</strong> — n'apparaît que si un classeur contient plusieurs onglets.</li>
            <li><strong>Association des colonnes</strong> — les colonnes qui doivent coïncider pour parler de doublon.</li>
            <li><strong>Rechercher les doublons</strong> — puis lecture du résumé, du détail et de l'export.</li>
          </ol>`,
        },
        {
          titre: 'Avec trois fichiers',
          html: `<ul>
            <li>Une ligne est en double dès que sa clé existe dans <strong>au moins un autre fichier</strong> : c'est l'inverse exact de la recherche de différences.</li>
            <li>La colonne <strong>Présente dans</strong> indique les fichiers concernés : « A + B », « B + C », « A + B + C ».</li>
            <li>Un onglet par fichier montre ses propres lignes en double, avec leur numéro de ligne d'origine.</li>
          </ul>`,
        },
      ],
      faq: [
        {
          q: 'Les colonnes associées doivent-elles porter le même nom ?',
          r: 'Non. C\'est tout l\'intérêt de ce mode : vous associez « Nom » d\'un côté à « Raison sociale » de l\'autre. Les colonnes de même nom sont simplement pré-associées pour vous faire gagner du temps.',
        },
        {
          q: 'Une ligne se répète plusieurs fois dans un fichier',
          r: 'Les répétitions sont comptées : si une ligne existe 3 fois dans A et 1 fois dans B, elle compte pour 1 doublon de chaque côté.',
        },
        {
          q: 'Pourquoi ma ligne n\'est-elle pas vue comme un doublon ?',
          r: 'Les colonnes associées sont comparées caractère par caractère : un espace en trop, un accent ou une casse différente suffisent à séparer deux lignes. Réduisez le nombre de colonnes associées pour un rapprochement plus large.',
        },
      ],
    },
  };

  const PAGE = window.XLDIFF_PAGE;
  const contenu = AIDE[PAGE];
  if (!contenu) return; // page sans aide (changelog…)

  const rAF = window.requestAnimationFrame
    ? window.requestAnimationFrame.bind(window)
    : cb => setTimeout(cb, 16);

  // ---------- Mémorisation « déjà vu » ----------

  let stockageOk = true;
  const CLE = 'xldiff.visite.' + PAGE;

  function lire(cle) {
    try { return window.localStorage.getItem(cle); } catch (e) { stockageOk = false; return null; }
  }
  function ecrire(cle, valeur) {
    try { window.localStorage.setItem(cle, valeur); } catch (e) { stockageOk = false; }
  }

  // ---------- Bouton « ? » de l'en-tête ----------

  function injecterBouton() {
    const header = document.querySelector('.header');
    if (!header) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'header-help';
    btn.id = 'btnAide';
    btn.title = 'Aide et présentation de cette page';
    btn.setAttribute('aria-label', 'Aide');
    btn.textContent = '?';
    btn.addEventListener('click', ouvrirPanneau);
    const accueil = header.querySelector('.header-home');
    if (accueil) header.insertBefore(btn, accueil);
    else header.appendChild(btn);
  }

  // ---------- Volet d'aide ----------

  let panneau = null;
  let voilePanneau = null;

  function construirePanneau() {
    voilePanneau = document.createElement('div');
    voilePanneau.className = 'xld-voile';
    voilePanneau.addEventListener('click', fermerPanneau);

    panneau = document.createElement('aside');
    panneau.className = 'xld-panneau';
    panneau.setAttribute('role', 'dialog');
    panneau.setAttribute('aria-label', 'Aide — ' + contenu.titre);

    const sections = contenu.sections.map(s =>
      `<section class="xld-section"><h3>${s.titre}</h3>${s.html}</section>`).join('');
    const faq = contenu.faq.map(f =>
      `<details class="xld-faq"><summary>${f.q}</summary><p>${f.r}</p></details>`).join('');
    const lienNouveautes = PAGE === 'home' ? 'pages/changelog.html' : 'changelog.html';

    panneau.innerHTML =
      `<div class="xld-panneau-tete">
         <span>Aide — ${contenu.titre}</span>
         <button type="button" class="xld-fermer" aria-label="Fermer l'aide">✕</button>
       </div>
       <div class="xld-panneau-corps">
         <button type="button" class="xld-revoir">▸ Revoir la présentation de la page</button>
         ${sections}
         <section class="xld-section"><h3>Questions fréquentes</h3>${faq}</section>
         <p class="xld-panneau-pied">
           <a href="${lienNouveautes}">Nouveautés de cette version</a> · 100 % local, aucune donnée envoyée sur le réseau.
         </p>
       </div>`;

    panneau.querySelector('.xld-fermer').addEventListener('click', fermerPanneau);
    panneau.querySelector('.xld-revoir').addEventListener('click', () => {
      fermerPanneau();
      demarrerVisite();
    });

    document.body.appendChild(voilePanneau);
    document.body.appendChild(panneau);
  }

  function ouvrirPanneau() {
    if (!panneau) construirePanneau();
    voilePanneau.classList.add('visible');
    panneau.classList.add('visible');
    document.body.classList.add('xld-fige');
    panneau.querySelector('.xld-fermer').focus();
  }

  function fermerPanneau() {
    if (!panneau) return;
    voilePanneau.classList.remove('visible');
    panneau.classList.remove('visible');
    document.body.classList.remove('xld-fige');
  }

  // ---------- Visite guidée ----------

  let visiteDom = null;
  let etape = 0;

  function estVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  // Première zone visible parmi les sélecteurs proposés ; null si
  // aucune (la bulle s'affiche alors au centre, sans flèche).
  function trouverCible(cible) {
    const liste = Array.isArray(cible) ? cible : [cible];
    for (const sel of liste) {
      const el = document.querySelector(sel);
      if (estVisible(el)) return el;
    }
    return null;
  }

  function construireVisite() {
    const voile = document.createElement('div');
    voile.className = 'xld-visite-voile';

    const spot = document.createElement('div');
    spot.className = 'xld-spot';

    const bulle = document.createElement('div');
    bulle.className = 'xld-bulle';
    bulle.setAttribute('role', 'dialog');
    bulle.innerHTML =
      `<button type="button" class="xld-bulle-fermer" aria-label="Fermer la présentation">✕</button>
       <div class="xld-bulle-etape"></div>
       <div class="xld-bulle-titre"></div>
       <div class="xld-bulle-texte"></div>
       <div class="xld-bulle-actions">
         <button type="button" class="xld-lien xld-passer">Passer</button>
         <span class="xld-bulle-espace"></span>
         <button type="button" class="xld-btn-sec xld-prec">‹ Précédent</button>
         <button type="button" class="xld-btn-pri xld-suiv">Suivant ›</button>
       </div>`;

    document.body.appendChild(voile);
    document.body.appendChild(spot);
    document.body.appendChild(bulle);

    bulle.querySelector('.xld-passer').addEventListener('click', finirVisite);
    bulle.querySelector('.xld-bulle-fermer').addEventListener('click', finirVisite);
    bulle.querySelector('.xld-prec').addEventListener('click', () => allerA(etape - 1));
    bulle.querySelector('.xld-suiv').addEventListener('click', () => allerA(etape + 1));
    voile.addEventListener('click', finirVisite);

    visiteDom = { voile, spot, bulle };
    return visiteDom;
  }

  function demarrerVisite() {
    if (!contenu.visite || !contenu.visite.length) return;
    if (!visiteDom) construireVisite();
    document.body.classList.add('xld-fige');
    visiteDom.voile.classList.add('visible');
    visiteDom.bulle.classList.add('visible');
    document.addEventListener('keydown', touche);
    allerA(0);
  }

  function allerA(n) {
    const pas = contenu.visite;
    if (n < 0) return;
    if (n >= pas.length) { finirVisite(); return; }
    etape = n;
    const { bulle, spot } = visiteDom;
    const p = pas[n];

    bulle.querySelector('.xld-bulle-etape').textContent = `Étape ${n + 1} sur ${pas.length}`;
    bulle.querySelector('.xld-bulle-titre').textContent = p.titre;
    bulle.querySelector('.xld-bulle-texte').innerHTML = p.texte;
    bulle.querySelector('.xld-prec').style.display = n === 0 ? 'none' : '';
    bulle.querySelector('.xld-suiv').textContent = n === pas.length - 1 ? 'Terminer' : 'Suivant ›';

    const cible = trouverCible(p.cible);
    if (cible && typeof cible.scrollIntoView === 'function') {
      try { cible.scrollIntoView({ block: 'center' }); } catch (e) { /* navigateur ancien */ }
    }
    spot.style.display = cible ? 'block' : 'none';
    // Le placement se fait après le rendu : la bulle doit avoir sa
    // taille définitive, et le défilement doit être terminé.
    rAF(() => placer(cible));
  }

  function placer(cible) {
    const { bulle, spot, voile } = visiteDom;
    const marge = 16;
    const vw = window.innerWidth || 1200;
    const vh = window.innerHeight || 800;
    bulle.classList.remove('fleche-haut', 'fleche-bas');

    if (!cible) {
      voile.classList.add('sombre');
      bulle.style.top = Math.max(16, (vh - bulle.offsetHeight) / 2) + 'px';
      bulle.style.left = Math.max(16, (vw - bulle.offsetWidth) / 2) + 'px';
      return;
    }
    voile.classList.remove('sombre');

    const r = cible.getBoundingClientRect();
    spot.style.top = (r.top - 6) + 'px';
    spot.style.left = (r.left - 6) + 'px';
    spot.style.width = (r.width + 12) + 'px';
    spot.style.height = (r.height + 12) + 'px';

    const bw = bulle.offsetWidth;
    const bh = bulle.offsetHeight;
    let top;
    if (r.bottom + marge + bh <= vh - 12) {
      top = r.bottom + marge;
      bulle.classList.add('fleche-haut'); // flèche sur le dessus de la bulle
    } else if (r.top - marge - bh >= 12) {
      top = r.top - marge - bh;
      bulle.classList.add('fleche-bas');
    } else {
      top = Math.max(12, (vh - bh) / 2);
    }
    let left = r.left + r.width / 2 - bw / 2;
    left = Math.min(Math.max(12, left), Math.max(12, vw - bw - 12));
    bulle.style.top = top + 'px';
    bulle.style.left = left + 'px';
    const fleche = Math.min(Math.max(24, r.left + r.width / 2 - left), bw - 24);
    bulle.style.setProperty('--fleche-x', fleche + 'px');
  }

  function finirVisite() {
    if (!visiteDom) return;
    visiteDom.voile.classList.remove('visible');
    visiteDom.bulle.classList.remove('visible');
    visiteDom.spot.style.display = 'none';
    document.body.classList.remove('xld-fige');
    document.removeEventListener('keydown', touche);
    ecrire(CLE, VERSION_VISITE);
  }

  function touche(e) {
    if (e.key === 'Escape') finirVisite();
    else if (e.key === 'ArrowRight') allerA(etape + 1);
    else if (e.key === 'ArrowLeft') allerA(etape - 1);
  }

  // Échap ferme aussi le volet d'aide
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && panneau && panneau.classList.contains('visible')) fermerPanneau();
  });

  window.addEventListener('resize', () => {
    if (visiteDom && visiteDom.bulle.classList.contains('visible')) {
      placer(trouverCible(contenu.visite[etape].cible));
    }
  });

  // ---------- Démarrage ----------

  injecterBouton();

  // La visite ne doit jamais couper l'herbe sous le pied : si l'usager
  // a déjà cliqué, tapé ou déposé un fichier pendant le court délai
  // d'attente, elle ne s'ouvre pas d'elle-même (le bouton « ? » reste là).
  let interagi = false;
  const marquer = () => { interagi = true; };
  ['pointerdown', 'keydown', 'drop', 'change'].forEach(ev => {
    document.addEventListener(ev, marquer, true);
  });

  // Premier passage seulement : la visite ne s'impose jamais deux fois.
  // Si le navigateur refuse le stockage (page ouverte en file:// sur
  // certains postes), on s'abstient plutôt que de la rejouer sans fin.
  const dejaVue = lire(CLE);
  if (stockageOk && dejaVue !== VERSION_VISITE) {
    setTimeout(() => { if (!interagi) demarrerVisite(); }, 450);
  }

  // Utile aux captures d'écran et aux tests
  window.XLDiffAide = { visite: demarrerVisite, ouvrir: ouvrirPanneau, fermer: fermerPanneau };
})();
