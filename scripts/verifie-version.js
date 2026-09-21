// ==========================================================================
//  Vérifie que TOUS les endroits qui portent le numéro de version
//  s'accordent avec le tag publié. Ils sont dix : en oublier un livre un
//  exe dont la fenêtre annonce l'ancienne version, ou un pied de page qui
//  ment sur le site. Les deux pipelines appellent ce script avant de
//  créer la Release, pour que l'oubli arrête la livraison au lieu de la
//  traverser.
//
//    node scripts/verifie-version.js v3.5
//    node scripts/verifie-version.js        (déduit la version de package.json)
//
//  Le tag porte la forme courte (v3.5), package.json et Cargo la forme
//  longue (3.5.0) : les deux sont vérifiées côte à côte.
// ==========================================================================
const fs = require('fs');
const path = require('path');

const racine = path.join(__dirname, '..');
const lire = f => fs.readFileSync(path.join(racine, f), 'utf8');

const arg = process.argv[2];
let longue;
if (arg) {
  const v = arg.startsWith('v') ? arg.slice(1) : arg;
  longue = v.split('.').length === 2 ? v + '.0' : v;
} else {
  longue = JSON.parse(lire('package.json')).version;
}
// 3.5.0 -> 3.5 ; 3.3.1 reste 3.3.1 (les correctifs gardent leur 3e chiffre)
const courte = longue.endsWith('.0') ? longue.slice(0, -2) : longue;

const pages = ['index.html', 'pages/advanced.html', 'pages/simple.html',
               'pages/changelog.html'];

const controles = [
  ['package.json', '"version": "' + longue + '"'],
  ['src-tauri/Cargo.toml', 'version = "' + longue + '"'],
  ['src-tauri/tauri.conf.json', '"version": "' + longue + '"'],
  ['CHANGELOG.md', '## Version ' + courte + ' '],
  ['pages/changelog.html', '<span class="release-tag">Version ' + courte + '</span>'],
  ...pages.map(p => [p, 'XLDiff v' + courte + ' ']),
];

const manques = [];
for (const [fichier, attendu] of controles) {
  let contenu;
  try { contenu = lire(fichier); } catch (e) { manques.push(fichier + ' : illisible (' + e.message + ')'); continue; }
  if (!contenu.includes(attendu)) manques.push(fichier + ' : « ' + attendu.trim() + ' » introuvable');
}

// Cargo.lock : seule la strophe du paquet xldiff compte, les dépendances
// portent leurs propres versions
const lock = lire('src-tauri/Cargo.lock').split('\r').join('');
const strophe = lock.split('name = "xldiff"')[1];
if (strophe === undefined) manques.push('src-tauri/Cargo.lock : paquet xldiff absent');
else if (!strophe.split('[[package]]')[0].includes('version = "' + longue + '"')) {
  manques.push('src-tauri/Cargo.lock : le paquet xldiff n\'est pas en ' + longue);
}

if (manques.length) {
  console.error('Version ' + longue + ' (tag v' + courte + ') : ' + manques.length + ' endroit(s) en retard.');
  for (const m of manques) console.error('  - ' + m);
  console.error('\nCorrigez-les avant de poser le tag : le site et l\'exe annonceraient une version fausse.');
  process.exit(1);
}
console.log('Version ' + longue + ' (tag v' + courte + ') : les ' + (controles.length + 1) + ' endroits concordent.');
