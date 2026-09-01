// ==========================================================================
//  Fabrique le corps JSON de la Release GitLab, à poster sur l'API avec
//  CI_JOB_TOKEN (cf. .gitlab-ci.yml).
//
//    node scripts/payload-gitlab.js v3.5 > release.json
//
//  POURQUOI UN SCRIPT plutôt qu'un heredoc dans le YAML : les notes
//  viennent de CHANGELOG.md et contiennent des guillemets, des apostrophes,
//  des « — » et des retours à la ligne. Seul JSON.stringify les échappe
//  correctement ; un heredoc shell produit tôt ou tard un JSON invalide,
//  et l'API répond 400 au pire moment — pendant la publication.
//
//  Le lien vers l'exe n'est ajouté que si le binaire est bien versionné
//  dans le tag : mieux vaut une release sans lien qu'une release dont le
//  bouton de téléchargement renvoie une 404.
// ==========================================================================
const fs = require('fs');
const path = require('path');
const { notesDeVersion } = require('./notes-de-version.js');

const tag = process.argv[2];
if (!tag) {
  console.error('usage : node scripts/payload-gitlab.js <tag>');
  process.exit(2);
}

const EXE = 'release/xldiff.exe';
let corps;
try {
  corps = notesDeVersion(tag);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

const payload = { name: 'XLDiff ' + tag, tag_name: tag, description: corps };

const projet = process.env.CI_PROJECT_URL;
if (projet && fs.existsSync(path.join(__dirname, '..', EXE))) {
  payload.assets = {
    links: [{
      name: 'xldiff.exe (application de bureau Windows, autonome et signée)',
      url: projet + '/-/raw/' + tag + '/' + EXE,
      link_type: 'other',
    }],
  };
} else {
  console.error('Note : ' + EXE + ' absent du dépôt, la release sera publiée sans lien de téléchargement.');
}

process.stdout.write(JSON.stringify(payload));
