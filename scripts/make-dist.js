// Prépare dist/ : copie de l'application web (mêmes fichiers que le job
// GitLab Pages) pour qu'elle soit embarquée dans le binaire Tauri.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist);

fs.copyFileSync(path.join(root, 'index.html'), path.join(dist, 'index.html'));
for (const dir of ['pages', 'assets']) {
  fs.cpSync(path.join(root, dir), path.join(dist, dir), { recursive: true });
}

console.log('dist/ prêt (index.html + pages/ + assets/)');
