# XLDiff — Notes de version

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
