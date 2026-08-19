// ============================================================
//  XLDiff — help.js
//  Onboarding et aide, mutualisés pour toutes les pages.
//
//  Deux dispositifs complémentaires, volontairement légers :
//    • la VISITE GUIDÉE — des bulles qui désignent les zones de
//      la page. Elle ne s'ouvre d'elle-même qu'au premier passage
//      sur CETTE page (mémorisé dans localStorage) ;
//    • le VOLET D'AIDE — ouvert par le bouton « ? » de l'en-tête,
//      il donne l'aide complète de la page et permet de rejouer
//      la visite à tout moment.
//
//  LA VISITE SUIT L'USAGER. Une bulle ne parle jamais d'une zone
//  qui n'est pas à l'écran : chaque étape porte le sélecteur de
//  sa zone, et l'état de l'interface est lu dans ce sélecteur
//  (« #mappingPanel.visible », « #btnCompare:not([disabled]) »).
//  D'où deux temps :
//    1. À L'OUVERTURE — les étapes dont la zone est déjà affichée
//       s'enchaînent, page assombrie, comme une visite classique.
//    2. PLUS TARD — les étapes suivantes attendent que leur zone
//       apparaisse (fichiers déposés, résultats affichés). Elles
//       se montrent alors en BULLE DISCRÈTE : pas de voile, rien
//       n'est bloqué, et la bulle s'efface dès que l'usager fait
//       autre chose.
//  Une étape peut aussi attendre une action (`attendClic`) quand
//  c'est le clic de l'usager qui fait apparaître la suite — le
//  cas de l'accueil, où le type d'analyse commande l'affichage.
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
  const VERSION_VISITE = '3.1';

  // ---------- Contenu, par page ----------
  //   visite   : étapes { cible, titre, texte, attendClic }
  //              cible = sélecteur (ou liste : la 1re zone visible
  //              gagne). Le sélecteur décrit AUSSI l'état attendu
  //              de l'interface : tant qu'il ne désigne rien de
  //              visible, l'étape patiente.
  //   sections : aide détaillée du volet
  //   faq      : questions fréquentes (repliées)

  const AIDE = {
    home: {
      titre: 'Accueil',
      visite: [
        {
          cible: '.choice-grid',
          attendClic: true,
          titre: 'Commencez par le type d\'analyse',
          texte: 'Les <strong>différences</strong>, ce sont les lignes présentes dans un fichier et absentes de l\'autre. Les <strong>doublons</strong>, ce sont les lignes que l\'on retrouve dans plusieurs fichiers. <strong>Cliquez sur la carte</strong> qui correspond à votre besoin : la suite s\'affichera juste en dessous.',
        },
        {
          cible: ['#modeSectionDiff.visible', '#modeSectionDupes.visible'],
          titre: 'Vos fichiers se ressemblent-ils ?',
          texte: 'Si vos fichiers viennent du <strong>même export Excel</strong>, prenez le mode <strong>simple</strong> : tout est automatique. S\'ils viennent d\'outils différents, prenez le mode <strong>avancé</strong> : vous y associez vous-même les colonnes, et vous pouvez ajouter un troisième fichier.',
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
          texte: 'Glissez-déposez un fichier dans chaque zone, ou cliquez pour le choisir. Formats acceptés : <code>.xlsx</code>, <code>.xls</code>, <code>.csv</code>, <code>.htm</code>. Si le classeur contient plusieurs feuilles, un menu vous laissera choisir laquelle analyser.',
        },
        {
          cible: '#btnCompare:not([disabled])',
          titre: 'Vos fichiers sont prêts',
          texte: 'Les colonnes communes aux deux fichiers ont été détectées toutes seules : vous n\'avez rien à régler. La comparaison porte sur <strong>toutes</strong> ces colonnes — deux lignes sont identiques si toutes leurs valeurs le sont. Cliquez sur <strong>Comparer</strong>.',
        },
        {
          cible: '#results.visible',
          titre: 'Lisez le résultat',
          texte: 'Le résultat commence par un <strong>résumé en phrases simples</strong>, suivi du détail ligne par ligne dans des onglets. <strong>Exporter .xlsx</strong> enregistre tout dans un fichier Excel, et <strong>Recommencer</strong> repart d\'une page vierge.',
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
          texte: 'Glissez-déposez un fichier dans chaque zone, ou cliquez pour le choisir. Formats acceptés : <code>.xlsx</code>, <code>.xls</code>, <code>.csv</code>, <code>.htm</code>. Si le classeur contient plusieurs feuilles, un menu vous laissera choisir laquelle analyser.',
        },
        {
          cible: '#btnCompare:not([disabled])',
          titre: 'Vos fichiers sont prêts',
          texte: 'Les colonnes communes ont été détectées toutes seules. Deux lignes sont <strong>en double</strong> si toutes leurs colonnes sont identiques — c\'est l\'inverse exact de la recherche de différences. Cliquez sur <strong>Rechercher les doublons</strong>.',
        },
        {
          cible: '#results.visible',
          titre: 'Lisez le résultat',
          texte: 'Un <strong>résumé en phrases simples</strong>, puis le détail : les lignes en double vues côté A, puis côté B, avec leur numéro de ligne d\'origine. <strong>Exporter .xlsx</strong> enregistre la liste dans un fichier Excel.',
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
          texte: 'Deux fichiers suffisent ; le <strong>fichier C est facultatif</strong> et permet de comparer trois fichiers d\'un coup. Ils peuvent venir d\'outils différents et n\'ont pas besoin d\'avoir les mêmes colonnes. Les réglages apparaîtront ici même une fois les fichiers chargés.',
        },
        {
          cible: '#sheetPanel.visible',
          titre: 'Choisissez la feuille',
          texte: 'Un de vos classeurs contient plusieurs feuilles (onglets Excel). XLDiff a pré-sélectionné la plus fournie : changez-la ici si ce n\'est pas la bonne.',
        },
        {
          cible: '#mappingPanel.visible',
          titre: 'Colonnes de rapprochement',
          texte: 'Ce sont les colonnes qui <strong>identifient une même ligne</strong> d\'un fichier à l\'autre — par exemple le nom et la date de naissance. Une ligne sans équivalent dans un autre fichier est signalée comme différence. Les colonnes de même nom sont déjà associées.',
        },
        {
          cible: '#comparePanel.visible',
          titre: 'Colonnes à comparer (facultatif)',
          texte: 'Une fois la ligne retrouvée, XLDiff peut vérifier le contenu de ces colonnes — l\'adresse, par exemple. Les lignes retrouvées dont une valeur diffère ne sont pas des absences : elles remontent dans l\'onglet <strong>Retrouvées mais différentes</strong>.',
        },
        {
          cible: '#results.visible',
          titre: 'Lisez le résultat, puis exportez',
          texte: 'Un résumé en phrases simples, puis le détail par onglets — avec trois fichiers, la colonne <strong>Présente dans</strong> dit où chaque ligne se trouve. Deux exports : <strong>Exporter .xlsx</strong> pour la liste, et <strong>Exporter le fichier A annoté</strong> pour reprendre votre fichier A avec le verdict ajouté à droite.',
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
          texte: 'Deux fichiers suffisent ; le <strong>fichier C est facultatif</strong> et permet de chercher les doublons sur trois fichiers. Ils peuvent venir d\'outils différents et n\'ont pas besoin d\'avoir les mêmes colonnes. Les réglages apparaîtront ici même une fois les fichiers chargés.',
        },
        {
          cible: '#sheetPanel.visible',
          titre: 'Choisissez la feuille',
          texte: 'Un de vos classeurs contient plusieurs feuilles (onglets Excel). XLDiff a pré-sélectionné la plus fournie : changez-la ici si ce n\'est pas la bonne.',
        },
        {
          cible: '#mappingPanel.visible',
          titre: 'Associez les colonnes',
          texte: 'Indiquez quelles colonnes se correspondent d\'un fichier à l\'autre — par exemple <em>Nom</em> dans A et <em>Raison sociale</em> dans B. Deux lignes sont <strong>en double</strong> si toutes les colonnes associées sont identiques. Les colonnes de même nom sont déjà associées.',
        },
        {
          cible: '#results.visible',
          titre: 'Lisez le résultat',
          texte: 'Un résumé en phrases simples, puis le détail par fichier. Avec trois fichiers, une ligne est en double dès qu\'elle se retrouve dans <strong>au moins un autre fichier</strong> : la colonne <strong>Présente dans</strong> dit lesquels.',
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
  const PAS = contenu.visite || [];

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

  function panneauOuvert() {
    return !!panneau && panneau.classList.contains('visible');
  }

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
    // Une bulle discrète en attente ne doit pas se superposer au volet
    masquerBulle();
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
    // La visite reprend la main si elle attendait une zone
    verifier();
  }

  // ---------- Visite guidée ----------

  let visiteDom = null;
  let etape = -1;
  // 'inactive' | 'ouverture' (bulles modales enchaînées) | 'differee'
  // (bulles discrètes, déclenchées par l'apparition de leur zone)
  let phase = 'inactive';
  let observateur = null;
  let minuteur = null;
  // Étapes dont la zone était déjà à l'écran quand la bulle courante a
  // été affichée : elles ne sont pas « nouvelles » et ne doivent donc
  // pas chasser la bulle en cours (les deux panneaux de colonnes
  // apparaissent ensemble — on ne veut qu'une bulle, pas deux).
  let dejaLa = new Set();
  // Étapes réellement affichées, pour que « Précédent » revienne à la
  // bulle précédente et non à l'étape i-1, qui a pu être enjambée.
  let historique = [];

  function estVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 || r.height > 0;
  }

  // Première zone visible parmi les sélecteurs proposés. Le sélecteur
  // porte l'état attendu (« .visible », « :not([disabled]) ») : tant
  // qu'il ne désigne rien, l'étape n'a pas lieu d'être.
  function zoneDe(pas) {
    if (!pas) return null;
    const liste = Array.isArray(pas.cible) ? pas.cible : [pas.cible];
    for (const sel of liste) {
      let el = null;
      try { el = document.querySelector(sel); } catch (e) { el = null; }
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
      `<button type="button" class="xld-bulle-fermer" aria-label="Fermer">✕</button>
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
    bulle.querySelector('.xld-bulle-fermer').addEventListener('click', () => passerAuSuivant(true));
    bulle.querySelector('.xld-prec').addEventListener('click', retour);
    bulle.querySelector('.xld-suiv').addEventListener('click', () => suite());
    // Cliquer le voile met fin à la visite ; entrer avec un fichier
    // glissé la referme aussi, pour ne pas gêner le dépôt.
    voile.addEventListener('click', finirVisite);
    voile.addEventListener('dragenter', finirVisite);

    visiteDom = { voile, spot, bulle };
    return visiteDom;
  }

  function demarrerVisite() {
    if (!PAS.length) return;
    if (!visiteDom) construireVisite();
    // Vue une fois : elle ne se relancera plus d'elle-même, même si
    // l'usager quitte la page avant la fin du parcours.
    ecrire(CLE, VERSION_VISITE);
    document.removeEventListener('keydown', touche);
    document.addEventListener('keydown', touche);
    phase = 'ouverture';
    etape = -1;
    historique = [];
    afficherOuAttendre(0);
  }

  // Première étape, à partir de `depuis`, dont la zone est à l'écran.
  // Les étapes dont la zone n'existe pas encore sont enjambées : le
  // panneau « Choix des feuilles » n'apparaît que si un classeur a
  // plusieurs onglets, et la visite ne doit pas rester bloquée dessus.
  function prochaineVisible(depuis) {
    for (let i = Math.max(0, depuis); i < PAS.length; i++) {
      const zone = zoneDe(PAS[i]);
      if (zone) return { i, zone };
    }
    return null;
  }

  // Affiche la prochaine étape affichable, sinon se met en attente.
  function afficherOuAttendre(depuis) {
    if (depuis >= PAS.length) { finirVisite(); return; }
    const trouve = prochaineVisible(depuis);
    if (trouve) { afficher(trouve.i, trouve.zone); return; }
    etape = depuis;
    phase = 'differee';
    masquerBulle();
    armerObservateur();
  }

  // Passer à la suite.
  //   implicite = l'usager n'a pas demandé la suite, il s'est remis au
  //   travail (clic ailleurs, Échap, croix). On n'enchaîne alors pas
  //   sur une zone déjà à l'écran : on attend le prochain écran.
  function passerAuSuivant(implicite) {
    let i = etape + 1;
    if (implicite) {
      while (i < PAS.length && zoneDe(PAS[i])) i++;
      if (i >= PAS.length) { finirVisite(); return; }
      etape = i;
      phase = 'differee';
      masquerBulle();
      armerObservateur();
      return;
    }
    afficherOuAttendre(i);
  }

  function suite() {
    if (phase === 'ouverture' && etape >= 0) historique.push(etape);
    passerAuSuivant(false);
  }

  // Revient à la bulle précédemment affichée (enchaînement d'ouverture)
  function retour() {
    const j = historique.pop();
    if (j == null) return;
    const zone = zoneDe(PAS[j]);
    if (zone) afficher(j, zone);
  }

  function afficher(i, zone) {
    etape = i;
    const p = PAS[i];
    const discret = phase !== 'ouverture';
    const { bulle, spot, voile } = visiteDom;

    dejaLa = new Set();
    for (let j = 0; j < PAS.length; j++) if (zoneDe(PAS[j])) dejaLa.add(j);

    bulle.querySelector('.xld-bulle-etape').textContent = `Étape ${i + 1} sur ${PAS.length}`;
    bulle.querySelector('.xld-bulle-titre').textContent = p.titre;
    bulle.querySelector('.xld-bulle-texte').innerHTML = p.texte;

    const prec = bulle.querySelector('.xld-prec');
    const suiv = bulle.querySelector('.xld-suiv');
    // « Précédent » n'a de sens que dans l'enchaînement d'ouverture
    prec.style.display = (!discret && historique.length) ? '' : 'none';

    if (p.attendClic) {
      // C'est l'action de l'usager qui fait apparaître la suite
      suiv.style.display = 'none';
    } else if (i + 1 >= PAS.length) {
      suiv.style.display = '';
      suiv.textContent = 'Terminer';
    } else if (prochaineVisible(i + 1)) {
      suiv.style.display = '';
      suiv.textContent = 'Suivant ›';
    } else {
      // La suite viendra quand sa zone s'affichera : on ne promet pas
      // un « Suivant » qui ne mènerait nulle part.
      suiv.style.display = '';
      suiv.textContent = 'J\'ai compris';
    }

    bulle.classList.toggle('discret', discret);
    bulle.classList.add('visible');
    voile.classList.toggle('visible', !discret);
    // Une étape qui attend un clic ne doit pas bloquer ce clic
    voile.classList.toggle('traversant', !!p.attendClic);
    spot.classList.toggle('discret', discret);
    document.body.classList.toggle('xld-fige', !discret);

    if (discret) {
      // La page reste utilisable : la bulle s'efface dès que
      // l'usager fait autre chose.
      document.addEventListener('pointerdown', clicAilleurs, true);
      // Si la zone est hors écran, on l'amène doucement à la vue
      const r = zone.getBoundingClientRect();
      const h = window.innerHeight || 800;
      if ((r.bottom < 0 || r.top > h) && typeof zone.scrollIntoView === 'function') {
        try { zone.scrollIntoView({ block: 'center' }); } catch (e) { /* navigateur ancien */ }
      }
    } else if (typeof zone.scrollIntoView === 'function') {
      try { zone.scrollIntoView({ block: 'center' }); } catch (e) { /* navigateur ancien */ }
    }

    // Une étape qui attend un clic doit surveiller l'apparition de la suite
    if (p.attendClic) armerObservateur();

    rAF(() => placer(zone, discret));
  }

  // Positionnement : en ouverture la bulle est fixe (la page est
  // figée) ; en mode discret elle est ancrée dans le document, pour
  // rester collée à sa zone quand l'usager fait défiler la page.
  function placer(zone, discret) {
    const { bulle, spot } = visiteDom;
    const marge = 16;
    const vw = window.innerWidth || 1200;
    const vh = window.innerHeight || 800;
    const dx = discret ? (window.scrollX || 0) : 0;
    const dy = discret ? (window.scrollY || 0) : 0;

    bulle.classList.remove('fleche-haut', 'fleche-bas');
    bulle.classList.toggle('ancree', discret);
    spot.classList.toggle('ancree', discret);

    if (!zone) {
      spot.style.display = 'none';
      bulle.style.top = (Math.max(16, (vh - bulle.offsetHeight) / 2) + dy) + 'px';
      bulle.style.left = (Math.max(16, (vw - bulle.offsetWidth) / 2) + dx) + 'px';
      return;
    }

    const r = zone.getBoundingClientRect();
    spot.style.display = 'block';
    spot.style.top = (r.top - 6 + dy) + 'px';
    spot.style.left = (r.left - 6 + dx) + 'px';
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
    bulle.style.top = (top + dy) + 'px';
    bulle.style.left = (left + dx) + 'px';
    const fleche = Math.min(Math.max(24, r.left + r.width / 2 - left), bw - 24);
    bulle.style.setProperty('--fleche-x', fleche + 'px');
  }

  function masquerBulle() {
    if (!visiteDom) return;
    visiteDom.bulle.classList.remove('visible');
    visiteDom.voile.classList.remove('visible', 'traversant');
    visiteDom.spot.style.display = 'none';
    document.body.classList.remove('xld-fige');
    document.removeEventListener('pointerdown', clicAilleurs, true);
  }

  // L'usager reprend son travail : la bulle discrète s'efface et
  // l'étape suivante se met en attente de sa zone.
  function clicAilleurs(e) {
    if (!visiteDom || !visiteDom.bulle.classList.contains('visible')) return;
    if (visiteDom.bulle.contains(e.target)) return;
    passerAuSuivant(true);
  }

  function finirVisite() {
    phase = 'inactive';
    etape = -1;
    historique = [];
    masquerBulle();
    document.removeEventListener('keydown', touche);
    if (observateur) { observateur.disconnect(); observateur = null; }
    if (minuteur) { clearTimeout(minuteur); minuteur = null; }
    ecrire(CLE, VERSION_VISITE);
  }

  function touche(e) {
    if (phase === 'inactive') return;
    if (e.key === 'Escape') {
      // Échap ferme la visite d'ouverture ; en mode discret, il écarte
      // simplement la bulle et laisse venir le prochain écran.
      if (phase === 'ouverture') finirVisite();
      else passerAuSuivant(true);
    } else if (phase === 'ouverture' && visiteDom.bulle.classList.contains('visible')) {
      if (e.key === 'ArrowRight') suite();
      else if (e.key === 'ArrowLeft') retour();
    }
  }

  // ---------- Surveillance des zones qui apparaissent ----------

  // Les panneaux et les résultats s'affichent en gagnant la classe
  // « visible », le bouton Comparer en perdant « disabled » : un
  // observateur de mutations suffit à savoir quand une étape devient
  // pertinente, sans que les autres scripts aient à prévenir.
  function armerObservateur() {
    if (observateur || !window.MutationObserver) return;
    observateur = new window.MutationObserver(() => {
      if (minuteur) return;
      minuteur = setTimeout(() => { minuteur = null; verifier(); }, 150);
    });
    observateur.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'disabled'],
    });
  }

  function verifier() {
    if (phase === 'inactive' || !visiteDom) return;
    if (panneauOuvert()) return; // on ne se superpose pas au volet d'aide
    // En attente d'un clic : c'est l'étape suivante que l'on guette
    if (visiteDom.bulle.classList.contains('visible')) {
      // Une bulle est à l'écran : seule une zone qui vient VRAIMENT
      // d'apparaître, et plus loin dans le parcours, prend sa place.
      for (let j = etape + 1; j < PAS.length; j++) {
        if (dejaLa.has(j)) continue;
        const zone = zoneDe(PAS[j]);
        if (!zone) continue;
        phase = 'differee';
        afficher(j, zone);
        return;
      }
      return;
    }
    if (etape < 0 || etape >= PAS.length) return;
    const trouve = prochaineVisible(etape);
    if (!trouve) return;
    phase = 'differee'; // tout ce qui arrive après l'ouverture est discret
    afficher(trouve.i, trouve.zone);
  }

  window.addEventListener('resize', () => {
    if (visiteDom && visiteDom.bulle.classList.contains('visible')) {
      placer(zoneDe(PAS[etape]), visiteDom.bulle.classList.contains('discret'));
    }
  });

  // Échap ferme aussi le volet d'aide
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && panneauOuvert()) fermerPanneau();
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
  window.XLDiffAide = {
    visite: demarrerVisite,
    ouvrir: ouvrirPanneau,
    fermer: fermerPanneau,
    etat: () => ({ phase, etape }),
  };
})();
