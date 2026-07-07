# XLDiff — Comparateur de fichiers Excel

Outil web 100 % local pour comparer deux fichiers Excel et identifier les lignes présentes dans l'un mais absentes de l'autre. Aucune donnée n'est envoyée sur le réseau : tout le traitement s'effectue dans le navigateur.

## Modes de comparaison

### Comparatif simple
Pour deux fichiers issus du **même export Excel** (mêmes colonnes). Les colonnes communes sont détectées automatiquement et la comparaison porte sur toutes les colonnes — aucun réglage nécessaire.

### Comparatif avancé
Pour deux fichiers **différents**, en deux étapes :

1. **Choix des feuilles** — si un fichier contient plusieurs feuilles (onglets Excel), un panneau permet de choisir la feuille à comparer pour chaque fichier (la feuille contenant le plus de données est pré-sélectionnée).
2. **Association des colonnes** — l'utilisateur associe les colonnes à comparer (mapping colonne A ↔ colonne B, avec pré-association automatique des colonnes de même nom). Seules les colonnes associées servent de clé de comparaison.

Dans les résultats, une case « Afficher toutes les colonnes » permet de basculer entre l'affichage des seules colonnes comparées et l'affichage complet.

## Formats supportés

`.xlsx`, `.xls`, `.csv`, `.htm` / `.html` (exports Excel au format HTML, y compris les exports d'anciens outils — plusieurs stratégies de lecture de repli sont implémentées).

## Utilisation

Aucune installation : ouvrir `index.html` dans un navigateur, ou héberger le dossier tel quel (GitLab Pages, serveur web statique…).

1. Choisir un mode sur la page d'accueil.
2. Glisser-déposer les deux fichiers (sélection de feuille possible si le classeur en contient plusieurs).
3. Cliquer sur **Comparer**.
4. Consulter les différences (onglets « Toutes », « Uniquement A », « Uniquement B ») et éventuellement **Exporter** le résultat en `.xlsx`.

## Architecture

```
XLDiff/
├── index.html              Page d'accueil (choix du mode)
├── pages/
│   ├── simple.html         Mode comparatif simple
│   └── advanced.html       Mode comparatif avancé
├── assets/
│   ├── css/
│   │   ├── theme.css       Variables, base, en-tête, boutons (commun)
│   │   ├── home.css        Styles de la page d'accueil
│   │   └── compare.css     Styles des pages de comparaison
│   ├── js/
│   │   ├── file-loader.js  Lecture des fichiers + zones de dépôt (XLDiffFiles)
│   │   ├── diff-engine.js  Moteur de comparaison (XLDiffEngine)
│   │   ├── results-view.js Rendu des résultats + export (XLDiffResults)
│   │   ├── simple.js       Contrôleur du mode simple
│   │   └── advanced.js     Contrôleur du mode avancé
│   └── vendor/
│       └── xlsx.full.min.js  SheetJS 0.18.5 (embarqué, aucune dépendance réseau)
├── .gitlab-ci.yml          Déploiement GitLab Pages (optionnel, supprimable)
└── README.md
```

Le code n'utilise aucun framework ni gestionnaire de paquets : JavaScript natif, la seule librairie (SheetJS) est embarquée dans `assets/vendor/`.

## Déploiement GitLab Pages

Le fichier `.gitlab-ci.yml` publie automatiquement le site sur GitLab Pages à chaque push sur la branche par défaut. L'URL est visible dans *Deploy → Pages* du projet GitLab. Si vous ne souhaitez pas utiliser Pages, supprimez simplement ce fichier.

## Notes techniques

- La comparaison est une différence de multi-ensembles : les doublons sont pris en compte (si une clé apparaît 3 fois dans A et 1 fois dans B, 2 lignes sont signalées « uniquement A »).
- Le numéro de ligne affiché correspond à la ligne du fichier Excel d'origine (l'en-tête étant la ligne 1).
- Le tableau de résultats est rendu par blocs de 500 lignes pour rester fluide sur de gros volumes.
