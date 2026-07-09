# XLDiff — Comparateur de fichiers Excel

**Version 2**

Outil web 100 % local pour analyser deux fichiers Excel. Aucune donnée n'est envoyée sur le réseau : tout le traitement s'effectue dans le navigateur.

La page d'accueil pose la question « **Que recherchez-vous ?** » :

- **Les différences entre deux fichiers** — les lignes présentes dans l'un mais absentes de l'autre ;
- **Les doublons entre deux fichiers** — les lignes présentes à la fois dans les deux fichiers.

Chaque analyse propose ensuite la même question « **Vos deux fichiers ont-ils les mêmes colonnes ?** », qui mène au mode simple (colonnes identiques, tout est automatique) ou avancé (fichiers différents, association de colonnes).

## Recherche de différences : deux modes

### Comparatif simple
Pour deux fichiers issus du **même export Excel** (mêmes colonnes). Les colonnes communes sont détectées automatiquement et la comparaison porte sur toutes les colonnes — aucun réglage nécessaire.

### Comparatif avancé
Pour deux fichiers **différents**, en deux étapes :

1. **Choix des feuilles** — si un fichier contient plusieurs feuilles (onglets Excel), un panneau permet de choisir la feuille à comparer pour chaque fichier (la feuille contenant le plus de données est pré-sélectionnée).
2. **Association des colonnes** — l'utilisateur associe les colonnes à comparer (mapping colonne A ↔ colonne B, avec pré-association automatique des colonnes de même nom). Seules les colonnes associées servent de clé de comparaison.

Dans les résultats, une case « Afficher toutes les colonnes » permet de basculer entre l'affichage des seules colonnes comparées et l'affichage complet.

## Recherche de doublons : deux modes

L'outil liste les lignes **communes aux deux fichiers**, c'est-à-dire l'inverse de la recherche de différences.

- **Doublons simple** — deux fichiers issus du même export (mêmes colonnes) : les colonnes communes sont détectées automatiquement, deux lignes sont en double si toutes leurs colonnes sont identiques.
- **Doublons avancé** — deux fichiers différents : choix des feuilles puis association des colonnes A ↔ B, comme le comparatif avancé ; deux lignes sont en double si les colonnes associées sont identiques.

## Résultats

Les résultats commencent par un résumé en phrases simples (« Il y a N lignes identiques entre A et B », « Il y a X lignes uniquement dans A »…), suivi du détail ligne par ligne dans des onglets, d'un export `.xlsx` et d'un bouton **Recommencer** pour repartir d'une page vierge.

## Formats supportés

`.xlsx`, `.xls`, `.csv`, `.htm` / `.html` (exports Excel au format HTML, y compris les exports d'anciens outils — plusieurs stratégies de lecture de repli sont implémentées).

## Utilisation

Aucune installation : ouvrir `index.html` dans un navigateur, ou héberger le dossier tel quel (GitLab Pages, serveur web statique…).

1. Sur la page d'accueil, répondre à la question « Que recherchez-vous ? » (différences ou doublons), puis choisir le mode le cas échéant.
2. Glisser-déposer les deux fichiers (sélection de feuille possible si le classeur en contient plusieurs).
3. Cliquer sur **Comparer** (ou **Rechercher les doublons**).
4. Consulter le résumé puis le détail par onglets, et éventuellement **Exporter** le résultat en `.xlsx`.

## Architecture

```
XLDiff/
├── index.html              Page d'accueil (question « Que recherchez-vous ? » puis choix du mode)
├── pages/
│   ├── simple.html         Différences, mode simple
│   ├── advanced.html       Différences, mode avancé
│   ├── doublons.html       Doublons, mode simple
│   └── doublons-avance.html  Doublons, mode avancé
├── assets/
│   ├── css/
│   │   ├── theme.css       Variables, base, en-tête, boutons (commun)
│   │   ├── home.css        Styles de la page d'accueil
│   │   └── compare.css     Styles des pages de comparaison
│   ├── js/
│   │   ├── file-loader.js  Lecture des fichiers + zones de dépôt (XLDiffFiles)
│   │   ├── diff-engine.js  Moteur de comparaison (XLDiffEngine)
│   │   ├── results-view.js Rendu des résultats + export (XLDiffResults)
│   │   ├── simple.js       Contrôleur des modes simples (diff ou doublons via window.XLDIFF_MODE)
│   │   └── advanced.js     Contrôleur des modes avancés (diff ou doublons via window.XLDIFF_MODE)
│   └── vendor/
│       └── xlsx.full.min.js  SheetJS 0.18.5 (embarqué, aucune dépendance réseau)
├── .gitlab-ci.yml          Déploiement GitLab Pages (optionnel, supprimable)
└── README.md
```

Le code n'utilise aucun framework ni gestionnaire de paquets : JavaScript natif, la seule librairie (SheetJS) est embarquée dans `assets/vendor/`.

## Déploiement GitLab Pages

Le fichier `.gitlab-ci.yml` publie automatiquement le site sur GitLab Pages à chaque push sur la branche par défaut. L'URL est visible dans *Deploy → Pages* du projet GitLab. Si vous ne souhaitez pas utiliser Pages, supprimez simplement ce fichier.

## Notes techniques

- La comparaison est une différence de multi-ensembles : les répétitions sont prises en compte (si une clé apparaît 3 fois dans A et 1 fois dans B, 2 lignes sont signalées « uniquement A »). La recherche de doublons est l'opération inverse (intersection) : la même clé compte pour min(3, 1) = 1 correspondance.
- Le numéro de ligne affiché correspond à la ligne du fichier Excel d'origine (l'en-tête étant la ligne 1).
- Le tableau de résultats est rendu par blocs de 500 lignes pour rester fluide sur de gros volumes.
