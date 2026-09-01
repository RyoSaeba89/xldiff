// ==========================================================================
//  Extrait de CHANGELOG.md la section d'une version, pour servir de corps
//  de Release. Les deux pipelines (GitHub et GitLab) l'utilisent : les
//  notes publiées sont donc exactement celles du dépôt, jamais une
//  recopie à la main qui finit par diverger.
//
//    node scripts/notes-de-version.js v3.5   > notes.md
//    node scripts/notes-de-version.js 3.5    (le « v » du tag est toléré)
//
//  Utilisable aussi comme module : require('./notes-de-version.js')
//  expose notesDeVersion(tag). C'est ce dont se sert payload-gitlab.js.
//
//  Sort en erreur si la section n'existe pas : mieux vaut interrompre le
//  pipeline que publier une Release aux notes vides.
// ==========================================================================
const fs = require('fs');
const path = require('path');

function notesDeVersion(brut) {
  const version = brut.startsWith('v') ? brut.slice(1) : brut;
  // Les tags portent la forme courte (v3.5), package.json la forme longue
  // (3.5.0) : on accepte les deux.
  const court = version.endsWith('.0') ? version.slice(0, -2) : version;

  const changelog = fs.readFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), 'utf8');
  const lignes = changelog.split('\r').join('').split('\n');

  // Le titre de section a la forme « ## Version 3.5 — 1er septembre 2026 »
  const cible = ['## Version ' + court + ' ', '## Version ' + version + ' '];
  const debut = lignes.findIndex(l => cible.some(c => l.startsWith(c)));
  if (debut === -1) {
    throw new Error('Aucune section « ## Version ' + court + ' » dans CHANGELOG.md.'
      + '\nAjoutez les notes de cette version avant de poser le tag.');
  }

  let fin = lignes.length;
  for (let i = debut + 1; i < lignes.length; i++) {
    if (lignes[i].startsWith('## ')) { fin = i; break; }
  }

  // Le titre lui-même est retiré : GitHub et GitLab affichent déjà le nom
  // de la version au-dessus du corps de la Release.
  const corps = lignes.slice(debut + 1, fin).join('\n').trim();
  if (!corps) throw new Error('La section « ## Version ' + court + ' » est vide.');
  return corps;
}

module.exports = { notesDeVersion };

if (require.main === module) {
  const brut = process.argv[2];
  if (!brut) {
    console.error('usage : node scripts/notes-de-version.js <version|tag>');
    process.exit(2);
  }
  try {
    process.stdout.write(notesDeVersion(brut) + '\n');
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
