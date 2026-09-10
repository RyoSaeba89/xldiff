# XLDiff — Notes de version

Ces notes sont aussi lisibles dans l'application, page **Nouveautés** : <https://ryosaeba89.github.io/xldiff/pages/changelog.html>

## Version 3.7 — 10 septembre 2026

### Vous choisissez ce que contient le fichier exporté

- **« Exporter .xlsx » vous demande d'abord ce que vous voulez exporter.** Un panneau s'ouvre sous le bouton et liste les onglets affichés à l'écran, chacun avec son nombre de lignes : décochez ceux dont vous n'avez pas besoin, le classeur ne contiendra que les autres. Le fichier reprenait jusqu'ici tous les onglets, sans autre choix possible.
- **Tout est coché à l'ouverture**, et le reste à chaque nouvel export : un fichier incomplet ne peut pas sortir d'un réglage laissé de côté la fois précédente. Un lien **Tout décocher** vide la liste d'un coup, et **Tout cocher** la remplit.
- **Annuler, `Échap` ou un clic à côté referment le panneau sans rien écrire.** Tant qu'aucune case n'est cochée, le bouton **Exporter** reste inactif : un classeur sans aucune feuille n'existe pas.
- Le contenu des feuilles ne change pas : mêmes colonnes, même ordre qu'à l'écran. Le bouton **Exporter le fichier A annoté**, qui ne produit qu'une seule feuille, n'est pas concerné.

### Et vous pouvez renommer les onglets au passage

- **Une case « Renommer les onglets avant l'export »**, décochée par défaut, ouvre sous chaque onglet retenu un champ déjà rempli avec son nom actuel. Ce que vous y écrivez devient le nom de la feuille dans le fichier Excel ; un champ laissé tel quel donne exactement le fichier d'avant.
- **Les champs suivent vos cases** : décocher un onglet retire le sien, et le recocher vous rend ce que vous aviez déjà tapé. Comme le reste du panneau, tout repart à zéro à l'ouverture suivante.
- **Un nom qu'Excel refuserait est signalé sous le champ et bloque l'export**, au lieu d'être corrigé en douce en un nom que vous n'avez pas choisi : nom vide, plus de 31 caractères, caractères `\ / ? * [ ]` ou deux-points, apostrophe en début ou en fin, ou nom déjà pris par un autre onglet.
- Depuis un champ, `Entrée` lance l'export dès que tous les noms sont acceptables.

## Version 3.6 — 1er septembre 2026

### Un onglet qui portait un nom trompeur

- **L'onglet « Toutes les différences » s'appelle maintenant « Présentes d'un seul côté »** (« Absentes d'au moins un fichier » quand vous comparez trois fichiers). Son nom promettait un total qu'il n'a jamais contenu : il ne liste **que** les lignes sans équivalent dans l'autre fichier, jamais celles qui ont été retrouvées avec un contenu différent. Lire « 124 » sur cet onglet et « 139 » sur « Retrouvées mais différentes » n'a donc rien de contradictoire — ce sont deux natures d'écart distinctes, qui ne se recouvrent jamais.
- **Le résumé annonce désormais les deux nombres.** Il disait « Il y a 124 différences entre les fichiers » en passant les écarts de contenu sous silence ; il dit maintenant « Il y a 124 lignes présentes d'un seul côté, et 139 lignes retrouvées des deux côtés dont le contenu diffère ».
- La feuille correspondante de l'export `.xlsx` suit le nouveau nom, comme toujours.

## Version 3.5 — 1er septembre 2026

### Ce que vous voyez à l'écran est exactement ce que vous exportez

- **L'export `.xlsx` contient les mêmes onglets que l'écran** : « Toutes les différences », « Retrouvées mais différentes », « Uniquement dans A », « Uniquement dans B » — et un onglet par fichier quand vous en comparez trois. Le fichier exporté ne contenait jusqu'ici qu'un seul onglet, tous fichiers mélangés. La recherche de doublons suit la même règle (« Tous les doublons », « Doublons côté A », « Doublons côté B »). Un onglet vide donne une feuille réduite à son en-tête, pour qu'on la retrouve dans le classeur comme on la voit à l'écran.
- **Le numéro de ligne est juste, même quand le fichier contient des lignes vides.** Une seule ligne vide au milieu du fichier décalait toutes les suivantes : une ligne réellement en ligne 4 était annoncée en ligne 3. Corrigé à l'écran, dans l'export et dans le fichier A annoté.
- **Les résultats ne restent plus affichés quand ils ne valent plus rien.** Changer une association de colonnes, la feuille d'un classeur ou un fichier après avoir comparé retire les résultats et coupe les exports jusqu'à ce que vous relanciez la comparaison. Le bouton exportait jusqu'ici, sans rien dire, la comparaison précédente.
- **Le nombre de lignes annoncé sous un fichier déposé** est désormais celui des lignes réellement lues, donc le même que celui du résumé.
- L'onglet « Uniquement A » s'appelle maintenant **« Uniquement dans A »**, à l'écran comme dans le classeur exporté.

## Version 3.4 — 19 août 2026

### La présentation revient à chaque visite — ou plus jamais, à votre main

- **Elle se lance à chaque venue sur le site et à chaque ouverture de l'application**, et non plus une seule fois pour toutes. Une seule fois par page et par visite : passer d'un écran à l'autre ne la rejoue pas (trace de portée session).
- **Nouveau bouton « Je sais utiliser l'application »** sur la première bulle : il coupe la présentation **définitivement et sur toutes les pages** (trace durable). À ne pas confondre avec *Passer*, qui l'écarte seulement pour cette visite.
- En cas de changement d'avis, le bouton **« ? »** propose de **réafficher la présentation à chaque visite**.

## Version 3.3.1 — 19 août 2026

### La présentation se lance dans plus de situations

- **Navigateur qui refuse la mémorisation** (navigation privée, stratégie d'entreprise) : la présentation ne se lançait jamais. Repli sur la mémoire de session, puis sur la mémoire vive — elle se lance au moins une fois par session.
- **Un clic dans le décor ne l'annule plus** : seuls un dépôt de fichier, une frappe ou un clic sur un élément actif comptent comme « déjà au travail ».
- `XLDiffAide.etat()` dit désormais pourquoi la présentation ne s'est pas lancée (déjà vue, stockage refusé, usager actif) et `XLDiffAide.oublier()` permet de la rejouer depuis zéro.

## Version 3.3 — 19 août 2026

### La présentation s'adapte à toutes les tailles d'écran

- **La bulle ne masque plus ce dont elle parle** : elle cherche sa place dans l'ordre dessous, dessus, à droite, à gauche ; si rien ne tient, elle se range contre le bord qui recouvre le moins la zone, en laissant voir son titre et ses premiers champs.
- **La page se positionne pour lui faire de la place** avant l'affichage, au lieu de subir le défilement en cours.
- **Sur petit écran**, la bulle s'élargit en bandeau, s'allège et défile à l'intérieur plutôt que de dépasser de la fenêtre.
- Correction d'un défaut d'affichage sur l'accueil : le défilement animé déclenché par le choix du type d'analyse pouvait décaler la page sous la bulle.

## Version 3.2 — 19 août 2026

### Une bulle à la fois, et rien d'autre

- **L'application est figée tant qu'une bulle est affichée** : tout le reste de la page est assombri et ne réagit plus au clic — ni les tuiles derrière, ni les boutons.
- **Mais la zone dont parle la bulle reste utilisable** : on peut cliquer directement la carte, le bouton ou le menu expliqué, sans fermer la bulle d'abord. Sur tous les écrans.
- **La main revient partout dès que la bulle est masquée** : bouton, croix, clic à côté ou touche *Échap*. Un fichier glissé sur la fenêtre masque aussi la bulle, pour que le dépôt aboutisse.

## Version 3.1 — 19 août 2026

### La présentation suit ce que vous voyez

- **Fini les explications en avance** : la présentation ne commente plus une zone qui n'est pas encore à l'écran. À l'ouverture, elle ne montre que ce qui est affiché — les zones de dépôt. Les explications sur les colonnes ou sur les résultats arrivent **au moment où le panneau concerné apparaît**.
- **Une bulle discrète, qui ne coupe pas le travail en cours** : ces explications-là ne noircissent plus la page et ne bloquent rien ; la bulle s'efface dès que l'on clique ailleurs.
- **Sur l'accueil**, la présentation attend le choix (les différences ou les doublons) avant d'expliquer la question suivante, celle des colonnes.
- **Les étapes sans objet sont passées** : si aucun classeur n'a plusieurs onglets, la bulle sur le choix des feuilles ne s'affiche pas.

## Version 3.0 — 19 août 2026

### Doublons avancé

- **Chercher les doublons sur trois fichiers** : comme le comparatif avancé, la recherche de doublons accepte un troisième fichier. La zone **Fichier C** reste facultative — avec deux fichiers, rien ne change. Avec trois fichiers, une ligne est en double dès qu'elle se retrouve dans **au moins un autre fichier**, la colonne **« Présente dans »** indique lesquels (« A + B », « B + C », « A + B + C »), et chaque fichier a son onglet de lignes en double.

### Aide et prise en main

- **Une présentation guidée au premier passage** : trois bulles (quatre dans le comparatif avancé) montrent où déposer les fichiers, ce qu'il y a à régler et comment lire le résultat. Un clic sur *Passer* suffit à l'écarter, et elle ne revient plus ensuite.
- **Un bouton « ? » dans le bandeau vert**, sur chaque page : il ouvre l'aide complète de la page — étapes, options, lecture des résultats, questions fréquentes — et permet de **revoir la présentation** quand on le souhaite.
- **Plus de guide Word à chercher** : l'aide vit désormais dans l'application, au plus près de l'écran concerné, et suit chaque évolution de l'outil. Le guide utilisateur diffusé jusqu'à la version 2.5 n'est plus mis à jour.

## Version 2.5 — 18 août 2026

### Gros fichiers

- **Beaucoup moins de mémoire** : sur trois fichiers de 200 000, 100 000 et 10 000 lignes, XLDiff consommait environ 11 Go ; il en consomme désormais environ 1,5 Go. Le tableau de résultats n'affiche plus que les lignes réellement visibles à l'écran (le défilement reste complet) et les fichiers ne sont plus conservés deux fois en mémoire.
- **Export beaucoup plus léger** : le même résultat de 280 000 lignes passe de 109 Mo à 20 Mo. *Conséquence visible* : l'export ne contient plus une feuille par fichier — tout est dans « Toutes les différences », où la colonne **Source** permet de filtrer.
- **Barre de progression au chargement** de chaque fichier (lecture, analyse du classeur, conversion des lignes).

### Comparatif avancé

- **Nouveau bouton « Exporter le fichier A annoté »** : le fichier A tel quel, avec à droite *Statut*, *Présente dans*, *Colonnes en écart*, la valeur des autres fichiers pour les colonnes comparées et la ligne d'origine. Les lignes venues de B ou C et absentes de A sont ajoutées à la suite.

## Version 2.4 — 18 août 2026

### Comparatif avancé

- **Vérifier le contenu d'une colonne, et plus seulement la présence des lignes** : les *colonnes de rapprochement* servent à retrouver la même ligne dans chaque fichier, les *colonnes à comparer* (facultatives) sont vérifiées ensuite. Les lignes retrouvées dont le contenu diffère apparaissent dans l'onglet **« Retrouvées mais différentes »**, valeur de chaque fichier côte à côte.
- **Comparer trois fichiers** : la zone **Fichier C**, facultative, avec un onglet d'absences par fichier et la colonne **« Présente dans »**.
- **Comparaison plus tolérante sur les colonnes vérifiées** : majuscules, espaces en trop et espaces insécables ignorés, dates comparées au format jour/mois/année. Les colonnes de rapprochement restent comparées à l'identique.

## Version 2.3 — 13 juillet 2026

- **Nouvelle case « Ignorer les lignes en double au sein d'un même fichier »** dans le comparatif avancé (décochée par défaut) : cochée, une ligne présente dans les deux fichiers n'est plus signalée même si elle s'y répète un nombre de fois différent ; seules les lignes absentes d'un fichier remontent. Basculer la case relance l'analyse.
- Site publié sur GitHub Pages : <https://ryosaeba89.github.io/xldiff/>

## Version 2.1 — 9 juillet 2026

### Application de bureau

- **XLDiff existe maintenant en application Windows** (`xldiff.exe`, environ 3,5 Mo) : la même application que le site, dans une fenêtre native. Un seul fichier, aucun droit administrateur, aucune installation — double-clic et ça marche.
- **Aucune connexion réseau** : tout est embarqué dans l'exécutable, vos fichiers ne quittent jamais votre poste.
- **Export amélioré** : le bouton « Exporter .xlsx » ouvre une fenêtre Windows « Enregistrer sous » pour choisir où enregistrer le résultat.
- L'exécutable est signé numériquement (éditeur : Jacques Rennie, Eurométropole de Strasbourg).

## Version 2 — 9 juillet 2026

### Nouveautés

- **Recherche de doublons** : en plus des différences, XLDiff peut maintenant trouver les lignes présentes **à la fois dans deux fichiers**. Comme pour les différences, deux modes sont proposés :
  - *Doublons simple* : vos deux fichiers ont les mêmes colonnes, tout est automatique ;
  - *Doublons avancé* : vos fichiers sont différents, vous choisissez les colonnes à faire correspondre.
- **Accueil guidé** : la page d'accueil vous pose directement la question « **Que recherchez-vous ?** » — les différences ou les doublons — puis « **Vos deux fichiers ont-ils les mêmes colonnes ?** ». Plus besoin de deviner quel mode choisir.
- **Bouton « Recommencer »** : en bas des résultats, un clic remet la page à zéro pour lancer une nouvelle analyse.

### Améliorations

- **Résultats en langage clair** : fini les tableaux de chiffres à interpréter. Les résultats s'affichent désormais en phrases simples, par exemple :
  - « Il y a 1 500 lignes identiques entre A et B » ;
  - « Il y a 12 lignes uniquement dans A (absentes de B) » ;
  - « Il y a une différence de 4 lignes : le fichier B en contient 4 de moins que le fichier A ».

  Le détail ligne par ligne reste disponible juste en dessous, avec ses onglets et l'export Excel.
- Quand les deux fichiers sont identiques (ou sans aucun doublon), un message vert le dit explicitement.
- Crédits affichés en bas de chaque page.

## Version 1 — 7 juillet 2026

Première version : comparaison de deux fichiers Excel (`.xlsx`, `.xls`, `.csv`, `.htm`) pour trouver les lignes présentes dans un fichier et absentes de l'autre, en mode simple (mêmes colonnes, automatique) ou avancé (choix des feuilles et association des colonnes). Résultats par onglets, export Excel, traitement 100 % local dans le navigateur — aucune donnée n'est envoyée sur le réseau.
