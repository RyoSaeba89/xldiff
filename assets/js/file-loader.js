// ============================================================
//  XLDiff — file-loader.js
//  Lecture des fichiers (.xlsx, .xls, .csv, .htm) avec stratégies
//  de repli pour les exports HTML, et gestion des zones de dépôt.
//
//  Le classeur SheetJS n'est pas conservé après la lecture (il pèse
//  ~280 Mo pour 200 000 lignes) : le slot garde l'objet File et relit
//  le fichier si l'utilisateur change de feuille. Une barre de
//  progression est affichée dans la zone de dépôt pendant la lecture.
//
//  LECTURE FIDÈLE — SheetJS ne devine rien. Les .csv et .htm sont lus
//  en texte brut (option raw) : « 00123 » garde ses zéros, « 03/09/2020 »
//  n'est pas pris pour le 9 mars, « 0,5 » ne devient pas 5, un numéro
//  de 19 chiffres n'est pas arrondi. Les classeurs sont lus en UTC
//  (lecture ET conversion en lignes) : une date Excel arrive le bon
//  jour, à la bonne heure, quel que soit le fuseau du poste. C'est le
//  moteur qui interprète ensuite chaque colonne (dates, nombres), sur
//  la colonne entière — cf. profilColonne dans diff-engine.js.
//
//  API : XLDiffFiles.createSlot({ side, dropEl, inputEl, infoEl,
//        sheetsEl, onChange }) → slot { loaded, data, headers,
//        fileName, sheetName, sheetNames, file }
// ============================================================

const XLDiffFiles = (() => {

  // ---------- Utilitaires partagés ----------

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Trouve la feuille qui porte les données : un en-tête et au moins une
  // ligne. Une feuille d'une seule colonne est un fichier valable (une
  // liste de matricules, de codes…) ; elle n'est retenue que s'il n'y a
  // aucune feuille à plusieurs colonnes, pour ne pas préférer une liste
  // de valeurs ou une feuille de navigation (exports frameset) au vrai
  // tableau du classeur.
  function findBestSheet(wb) {
    if (!wb || !wb.SheetNames.length) return null;
    let best = null, bestRows = 0;
    let seule = null, seuleRows = 0; // meilleure feuille d'une seule colonne
    for (const name of wb.SheetNames) {
      const sheet = wb.Sheets[name];
      // sheet peut être absent : la lecture ciblée ne matérialise qu'une feuille
      if (!sheet || !sheet['!ref']) continue;
      const json = XLSX.utils.sheet_to_json(sheet, { defval: '', header: 1 });
      if (json.length < 2) continue;
      const cols = Math.max(...json.slice(0, 5).map(r => (Array.isArray(r) ? r : Object.values(r)).filter(v => v !== '').length));
      if (cols >= 2) {
        if (json.length > bestRows) { bestRows = json.length; best = name; }
      } else if (cols === 1 && json.length > seuleRows) {
        seuleRows = json.length; seule = name;
      }
    }
    return best || seule;
  }

  // Séparateur d'un fichier texte délimité (.csv, .txt), lu sur la ligne
  // d'en-tête. SheetJS le devine en comptant les « ; , tabulation | » des
  // 1 024 premiers caractères, valeurs comprises : un fichier d'une seule
  // colonne dont une valeur contient une virgule (« Dupont, Jean »,
  // « 12, rue de la Paix ») était coupé en deux, et des nombres à virgule
  // pouvaient l'emporter sur les points-virgules d'un export français.
  // Or la ligne d'en-tête est celle qui nomme les colonnes :
  //   • aucun séparateur dans l'en-tête → une seule colonne, rien n'est
  //     découpé ;
  //   • un seul → c'est lui ;
  //   • plusieurs → celui qui revient autant de fois sur les lignes
  //     suivantes, à égalité le plus fréquent dans l'en-tête, puis le
  //     point-virgule (le séparateur d'Excel en français).
  // Les guillemets protègent leur contenu, sauts de ligne compris.
  // null : laisser SheetJS décider (page HTML, ligne « sep= » d'Excel).
  const SEPARATEURS = [';', '\t', ',', '|'];
  const AUCUN_SEPARATEUR = '\u0000'; // caractère absent de tout texte
  function separateurTexte(texte) {
    const debut = texte.slice(0, 65536);
    if (/^\s*</.test(debut) || /^sep=/i.test(debut)) return null;
    const lignes = []; // compte de chaque séparateur, ligne par ligne
    let compte = [0, 0, 0, 0], plein = false, guillemets = false;
    for (let i = 0; i < debut.length && lignes.length < 200; i++) {
      const c = debut[i];
      if (c === '"') { guillemets = !guillemets; plein = true; continue; }
      if (guillemets) continue;
      if (c === '\n' || c === '\r') {
        if (plein) lignes.push(compte);
        compte = [0, 0, 0, 0]; plein = false;
        continue;
      }
      const k = SEPARATEURS.indexOf(c);
      if (k >= 0) compte[k]++;
      if (c !== ' ') plein = true;
    }
    // la dernière ligne n'est complète que si l'extrait couvre le fichier
    if (plein && debut.length === texte.length) lignes.push(compte);
    if (!lignes.length) return null;
    const entete = lignes[0];
    const suite = lignes.slice(1);
    let choix = -1, meilleur = null;
    for (let k = 0; k < SEPARATEURS.length; k++) {
      if (!entete[k]) continue;
      const score = [suite.filter(l => l[k] === entete[k]).length, entete[k]];
      if (!meilleur || score[0] > meilleur[0] || (score[0] === meilleur[0] && score[1] > meilleur[1])) {
        meilleur = score; choix = k;
      }
    }
    return choix < 0 ? AUCUN_SEPARATEUR : SEPARATEURS[choix];
  }

  // Fichier texte (.csv, .htm, .txt…) décodé par XLDiff lui-même, ou
  // null pour un classeur binaire (.xlsx, .xls). SheetJS ignore l'option
  // codepage sur un .csv lu en octets : les caractères propres à
  // windows-1252 (œ, ’, €) y devenaient des caractères de contrôle
  // invisibles, un .csv UTF-8 sans BOM sortait en « Ã©lise », un UTF-16
  // était illisible. Ordre de décision :
  //   1. un BOM dit l'encodage (UTF-8, UTF-16 LE ou BE) ;
  //   2. une page HTML qui déclare son charset est crue sur parole ;
  //   3. sinon UTF-8 s'il est valide, windows-1252 à défaut — la
  //      norme des exports d'Excel en français.
  function lireTexte(u) {
    const binaire =
      (u[0] === 0x50 && u[1] === 0x4b) ||                             // zip : xlsx, xlsb, ods
      (u[0] === 0xd0 && u[1] === 0xcf && u[2] === 0x11 && u[3] === 0xe0) || // OLE : xls
      (u[0] === 0x09 && (u[1] === 0x00 || u[1] === 0x02 || u[1] === 0x04 || u[1] === 0x08)); // BIFF 2 à 4
    if (binaire) return null;
    const dec = (enc, octets, fatal) => new TextDecoder(enc, fatal ? { fatal: true } : undefined).decode(octets);
    if (u[0] === 0xef && u[1] === 0xbb && u[2] === 0xbf) return dec('utf-8', u.subarray(3));
    if (u[0] === 0xff && u[1] === 0xfe) return dec('utf-16le', u.subarray(2));
    if (u[0] === 0xfe && u[1] === 0xff) return dec('utf-16be', u.subarray(2));
    const debut = dec('windows-1252', u.subarray(0, 4096));
    const m = /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(debut);
    if (m) {
      try { return dec(m[1], u); } catch (e) { /* charset inconnu : on devine */ }
    }
    try { return dec('utf-8', u, true); } catch (e) { return dec('windows-1252', u); }
  }

  // Décode les octets en chaîne HTML avec détection du charset
  function decodeHtml(uint8) {
    const encodings = ['utf-8', 'windows-1252', 'iso-8859-1', 'iso-8859-15'];
    let html = '';
    for (const enc of encodings) {
      try {
        html = new TextDecoder(enc).decode(uint8);
        if (html.includes('<')) break;
      } catch (e) { continue; }
    }
    if (!html) return '';
    // Re-décodage avec le charset déclaré dans le document s'il diffère
    const m = html.match(/charset[=\s]*["']?([^\s"'>]+)/i);
    if (m) {
      try {
        const h2 = new TextDecoder(m[1]).decode(uint8);
        if (h2.includes('<')) html = h2;
      } catch (e) {}
    }
    return html;
  }

  // Extrait les tableaux de données d'un document HTML parsé
  function extractTablesFromDoc(doc) {
    const allTables = doc.querySelectorAll('table');
    const candidates = [];

    for (const table of allTables) {
      const rows = table.querySelectorAll(':scope > tbody > tr, :scope > thead > tr, :scope > tr');
      if (rows.length < 1) continue;

      let totalCells = 0;
      let totalTextLen = 0;
      let maxCols = 0;
      const sampleSize = Math.min(rows.length, 20);

      for (let i = 0; i < sampleSize; i++) {
        const cells = rows[i].querySelectorAll(':scope > td, :scope > th');
        if (cells.length > maxCols) maxCols = cells.length;
        totalCells += cells.length;
        for (const cell of cells) {
          totalTextLen += (cell.textContent || '').replace(/\s+/g, '').length;
        }
      }

      // Heuristique : un vrai tableau de données a un en-tête, au moins
      // une ligne et du contenu texte significatif (élimine la navigation)
      const avgCellText = totalCells > 0 ? totalTextLen / totalCells : 0;
      if (maxCols >= 1 && rows.length >= 2 && avgCellText > 0.5) {
        candidates.push({ table, rows: rows.length, cols: maxCols, score: rows.length * maxCols });
      }
    }

    // Un tableau d'une seule colonne n'est retenu qu'à défaut de tableau
    // à plusieurs colonnes : une liste de liens de navigation en a une
    // aussi (même règle que findBestSheet)
    const larges = candidates.filter(c => c.cols >= 2);
    if (larges.length) candidates.splice(0, candidates.length, ...larges);
    if (candidates.length === 0) return null;

    candidates.sort((a, b) => b.score - a.score);

    const wb = XLSX.utils.book_new();
    const mainScore = candidates[0].score;

    candidates.forEach((dt, idx) => {
      // Ignore les tableaux bien plus petits que le principal (chrome/navigation)
      if (idx > 0 && dt.score < mainScore * 0.1) return;

      const aoa = tableToAoa(dt.table);
      if (aoa.length < 2) return;

      const headerRow = aoa[0];
      const nonEmptyHeaders = headerRow.filter(h => String(h).trim() !== '');
      if (nonEmptyHeaders.length < Math.min(2, dt.cols)) return;

      const name = candidates.length === 1 ? 'Feuille1' : `Feuille${idx + 1}`;
      try {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);
      } catch (e) {}
    });

    return wb.SheetNames.length > 0 ? wb : null;
  }

  // Convertit un élément <table> en tableau de tableaux,
  // en gérant colspan et rowspan
  function tableToAoa(table) {
    const rows = table.querySelectorAll(':scope > tbody > tr, :scope > thead > tr, :scope > tr');
    if (rows.length === 0) return [];

    const grid = [];
    const spans = {}; // reports de rowspan : spans[r][c] = valeur

    for (let r = 0; r < rows.length; r++) {
      if (!grid[r]) grid[r] = [];
      const cells = rows[r].querySelectorAll(':scope > td, :scope > th');
      let gi = 0; // position colonne dans la grille

      for (let ci = 0; ci < cells.length; ci++) {
        while (spans[r] && spans[r][gi] !== undefined) {
          grid[r][gi] = spans[r][gi];
          delete spans[r][gi];
          gi++;
        }

        const cell = cells[ci];
        // Le texte tel qu'il est écrit : pas de conversion en nombre,
        // qui ferait perdre les zéros en tête et arrondirait les longs
        // numéros (cf. LECTURE FIDÈLE en tête de fichier).
        const val = (cell.textContent || '').replace(/\u00a0/g, ' ').trim();

        const colspan = parseInt(cell.getAttribute('colspan')) || 1;
        const rowspan = parseInt(cell.getAttribute('rowspan')) || 1;

        for (let dc = 0; dc < colspan; dc++) {
          grid[r][gi + dc] = dc === 0 ? val : '';
          if (rowspan > 1) {
            for (let dr = 1; dr < rowspan; dr++) {
              const futureR = r + dr;
              if (!spans[futureR]) spans[futureR] = {};
              spans[futureR][gi + dc] = dc === 0 ? val : '';
            }
          }
        }
        gi += colspan;
      }

      while (spans[r] && spans[r][gi] !== undefined) {
        grid[r][gi] = spans[r][gi];
        delete spans[r][gi];
        gi++;
      }
    }

    return grid.filter(row => row && row.some(v => v !== '' && v !== undefined && v !== null));
  }

  // ---------- Slot de fichier (une zone de dépôt) ----------

  function createSlot(opts) {
    const { side, dropEl, inputEl, infoEl, sheetsEl, onChange } = opts;
    // showSheetSelector: false = pas de boutons de feuille dans la zone de
    // dépôt (la page gère elle-même le choix de feuille, cf. mode avancé)
    const showSheetSelector = opts.showSheetSelector !== false;

    const slot = {
      side,
      // Le classeur SheetJS n'est PAS conservé : sur un fichier de
      // 200 000 lignes il pèse ~280 Mo, alors que seules les lignes
      // converties servent ensuite. On garde l'objet File (simple
      // poignée vers le disque, coût mémoire nul) et on relit à la
      // demande si l'utilisateur change de feuille.
      file: null,
      sheetNames: [],
      sheetName: null,
      rowCount: 0,
      colCount: 0,
      data: [],
      headers: [],
      fileName: '',
      loaded: false,
      // Change la feuille active : relit le fichier en ne matérialisant
      // que cette feuille (déclenche onChange en fin de lecture)
      setSheet(name) {
        if (!slot.file || !slot.sheetNames.includes(name) || name === slot.sheetName) return;
        loadFile(slot.file, name);
      },
    };

    // ---------- Barre de progression de la zone de dépôt ----------

    let barre = null;
    function progression(phase, pct) {
      if (!barre) {
        barre = document.createElement('div');
        barre.className = 'drop-progress';
        barre.innerHTML = '<div class="drop-progress-label"></div>' +
          '<div class="drop-progress-track"><div class="drop-progress-fill"></div></div>';
        dropEl.appendChild(barre);
      }
      barre.querySelector('.drop-progress-label').textContent = phase;
      const fill = barre.querySelector('.drop-progress-fill');
      if (pct == null) {
        // phase de durée inconnue (analyse du classeur) : bande animée
        fill.classList.add('indetermine');
        fill.style.width = '100%';
      } else {
        fill.classList.remove('indetermine');
        fill.style.width = Math.max(2, Math.min(100, pct)) + '%';
      }
    }
    function progressionFin() {
      if (barre) { barre.remove(); barre = null; }
    }
    // Laisse le navigateur repeindre avant un traitement bloquant,
    // sinon la barre ne s'affiche jamais
    function respirer() {
      return new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
    }

    dropEl.addEventListener('click', e => {
      // Ne pas ouvrir le sélecteur si le clic vise un élément interactif enfant
      if (e.target.closest('.sheet-btn') || e.target.closest('.htm-picker')) return;
      inputEl.click();
    });

    inputEl.addEventListener('change', e => {
      if (e.target.files.length) loadFile(e.target.files[0]);
      // Sans remise à zéro, choisir de nouveau le même fichier (corrigé
      // entre-temps dans Excel) ne déclenche aucun `change` : rien ne se
      // passerait.
      inputEl.value = '';
    });

    dropEl.addEventListener('dragover', e => {
      e.preventDefault();
      dropEl.classList.add('drag-over');
    });
    dropEl.addEventListener('dragleave', () => dropEl.classList.remove('drag-over'));
    dropEl.addEventListener('drop', e => {
      e.preventDefault();
      dropEl.classList.remove('drag-over');
      if (e.dataTransfer.files.length) loadFile(e.dataTransfer.files[0]);
    });

    // Fichier refusé : la zone de dépôt redevient vide. Sans ça, elle
    // affichait l'erreur mais le slot gardait le fichier PRÉCÉDENT, et
    // « Comparer » analysait en silence un fichier qui n'était plus celui
    // que l'usager venait de déposer.
    function echec(html) {
      progressionFin();
      infoEl.innerHTML = html;
      const avait = slot.loaded;
      Object.assign(slot, {
        file: null, sheetNames: [], sheetName: null, rowCount: 0, colCount: 0,
        data: [], headers: [], fileName: '', loaded: false,
      });
      dropEl.classList.remove('loaded-a', 'loaded-b', 'loaded-c');
      if (sheetsEl) { sheetsEl.classList.remove('visible'); sheetsEl.innerHTML = ''; }
      if (avait && onChange) onChange(slot);
    }

    // Message d'un fichier refusé, selon ce qui a empêché de le retenir
    function messageEchec(cause) {
      const titre = t => `<strong class="error">⚠ ${t}</strong><br>`;
      const detail = t => `<span style="font-size:11px">${t}</span>`;
      if (cause === 'vide') {
        return titre('Aucune ligne à comparer dans ce fichier') +
          detail('Il faut une ligne de titres de colonnes, puis au moins une ligne en dessous.');
      }
      if (cause === 'protege') {
        return titre('Ce fichier est protégé par un mot de passe') +
          detail('Ouvrez-le dans Excel, retirez le mot de passe, enregistrez-le, puis déposez-le de nouveau.');
      }
      return titre('Impossible de lire ce fichier') +
        detail('Il est peut-être abîmé, ou d\'un format que XLDiff ne connaît pas. Ouvrez-le dans Excel et enregistrez-le en <b>.xlsx</b>.');
    }

    // Deux dépôts rapprochés dans la même zone : seule la dernière lecture
    // compte, même si la première (un fichier plus gros) finit après.
    let lectureEnCours = 0;

    function loadFile(file, preferredSheet) {
      const jeton = ++lectureEnCours;
      const perimee = () => jeton !== lectureEnCours;
      const reader = new FileReader();
      progression('Lecture du fichier…', 0);
      reader.onprogress = ev => {
        if (perimee()) return;
        if (ev.lengthComputable) progression('Lecture du fichier…', (ev.loaded / ev.total) * 100);
      };
      reader.onerror = () => {
        if (perimee()) return;
        echec('<strong class="error">⚠ Lecture impossible</strong><br>' +
          '<span style="font-size:11px">Le fichier a peut-être été déplacé, ou il est ouvert dans une autre application.</span>');
      };
      reader.onload = async e => {
        if (perimee()) return;
        const data = new Uint8Array(e.target.result);
        progression('Analyse du classeur…', null);
        await respirer();
        if (perimee()) return;
        const log = [];
        let wb = null;
        let bestSheet = null;
        // Ce qui a empêché de retenir le fichier, pour le dire à l'usager :
        // 'illisible' (rien n'a pu le lire), 'vide' (lu, mais aucune feuille
        // n'a de ligne sous ses titres), 'protege' (mot de passe)
        let cause = 'illisible';
        let texte = null; // null : classeur binaire
        try { texte = lireTexte(data); } catch (ex) { log.push('✗ Décodage du texte : ' + ex.message); }

        // ── Stratégie 1 : SheetJS avec codepage windows-1252 ──
        try {
          const lecture = { type: texte == null ? 'array' : 'string', cellDates: true, UTC: true, raw: true, codepage: 1252 };
          if (preferredSheet) lecture.sheets = [preferredSheet];
          const sep = texte == null ? null : separateurTexte(texte);
          if (sep) lecture.FS = sep;
          const wb1 = XLSX.read(texte == null ? data : texte, lecture);
          cause = 'vide';
          const best = preferredSheet || findBestSheet(wb1);
          if (best) {
            log.push('✓ SheetJS (cp1252): feuille "' + best + '"');
            wb = wb1; bestSheet = best;
          } else {
            log.push('✗ SheetJS (cp1252): aucune feuille exploitable');
          }
        } catch (ex) {
          log.push('✗ SheetJS: ' + ex.message);
          if (/password|encrypt/i.test(ex.message)) cause = 'protege';
        }

        // ── Stratégie 2 : replis pour les fichiers HTML ──
        // Jamais sur un classeur binaire (.xlsx, .xls) : ses octets lus
        // comme du texte contiennent forcément des « < », et un classeur
        // sans ligne de données se chargeait alors en lignes de caractères
        // illisibles au lieu d'être refusé.
        if (!wb && texte != null) {
          const html = decodeHtml(data);
          if (html && html.includes('<')) {
            log.push('  Fichier HTML (' + html.length + ' caractères)');

            // SheetJS sur la chaîne HTML
            try {
              const wb2 = XLSX.read(html, { type: 'string', cellDates: true, UTC: true, raw: true, codepage: 1252 });
              cause = 'vide';
              const best2 = findBestSheet(wb2);
              if (best2) {
                log.push('✓ SheetJS string+cp1252: feuille "' + best2 + '"');
                wb = wb2; bestSheet = best2;
              }
            } catch (ex) {
              log.push('✗ SheetJS string: ' + ex.message);
            }

            // Extraction via DOMParser
            if (!wb) {
              const doc = new DOMParser().parseFromString(html, 'text/html');
              const wb3 = extractTablesFromDoc(doc);
              if (wb3) {
                bestSheet = findBestSheet(wb3) || wb3.SheetNames[0];
                log.push('✓ DOMParser: feuille "' + bestSheet + '"');
                wb = wb3;
              } else {
                log.push('✗ DOMParser: aucun tableau');
              }
            }

            // Suppression des commentaires conditionnels puis nouvel essai
            if (!wb) {
              const cleaned = html
                .replace(/<!\[if[^\]]*\]>/gi, '')
                .replace(/<!\[endif\]-->/gi, '')
                .replace(/<!--\[if[^\]]*\]>/gi, '')
                .replace(/<!\[endif\]>/gi, '')
                .replace(/<!--.*?-->/gs, '');
              const doc2 = new DOMParser().parseFromString(cleaned, 'text/html');
              const wb4 = extractTablesFromDoc(doc2);
              if (wb4) {
                bestSheet = findBestSheet(wb4) || wb4.SheetNames[0];
                log.push('✓ HTML nettoyé: feuille "' + bestSheet + '"');
                wb = wb4;
              }
            }

            // Sous-chaîne <table> brute
            if (!wb) {
              const ts = html.search(/<table[\s>]/i);
              const te = html.lastIndexOf('</table>');
              if (ts >= 0 && te > ts) {
                const tableHtml = '<html><body>' + html.substring(ts, te + 8) + '</body></html>';
                try {
                  const wb5 = XLSX.read(tableHtml, { type: 'string', cellDates: true, UTC: true, raw: true, codepage: 1252 });
                  const best5 = findBestSheet(wb5);
                  if (best5) { wb = wb5; bestSheet = best5; log.push('✓ Sous-chaîne table'); }
                } catch (ex) {}
                if (!wb) {
                  const doc3 = new DOMParser().parseFromString(tableHtml, 'text/html');
                  const wb6 = extractTablesFromDoc(doc3);
                  if (wb6) { wb = wb6; bestSheet = wb6.SheetNames[0]; log.push('✓ DOMParser sous-chaîne table'); }
                }
              }
            }

            // Frameset sans données intégrées : demander le fichier feuille
            if (!wb && (html.includes('<frameset') || html.includes('WorksheetSource'))) {
              const hrefMatch = html.match(/href=["']?([^"'\s>]*sheet\d+\.htm[^"'\s>]*)/i);
              const sheetPath = hrefMatch ? decodeURIComponent(hrefMatch[1]) : 'sheet001.htm';
              echec(`<strong class="warn">⚠ Frameset sans données intégrées</strong><br>
                <span style="font-size:11px">Chargez <b>${esc(sheetPath)}</b> ou ré-enregistrez en <b>.xlsx</b>.</span>`);
              promptForHtmFile();
              console.log('[XLDiff] ' + file.name + ':\n' + log.join('\n'));
              return;
            }
          }
        }

        console.log('[XLDiff] ' + file.name + ':\n' + log.join('\n'));

        if (!wb) {
          echec(messageEchec(cause));
          return;
        }

        progression('Conversion des lignes…', null);
        await respirer();
        if (perimee()) return;
        slot.file = file;
        applyWorkbook(file, wb, bestSheet);
        progressionFin();
      };
      reader.readAsArrayBuffer(file);
    }

    function applyWorkbook(file, wb, preferredSheet) {
      slot.sheetNames = wb.SheetNames.slice();
      slot.sheetName = preferredSheet || wb.SheetNames[0];
      slot.fileName = file.name;
      slot.loaded = true;
      dropEl.classList.remove('loaded-a', 'loaded-b', 'loaded-c');
      dropEl.classList.add('loaded-' + side.toLowerCase());

      const sheet = wb.Sheets[slot.sheetName];
      const range = XLSX.utils.decode_range(sheet ? (sheet['!ref'] || 'A1') : 'A1');

      // Les lignes d'abord : le nombre annoncé dans la zone de dépôt est
      // celui des lignes réellement retenues, donc le même que celui du
      // résumé des résultats. La plage du classeur, elle, déborde souvent
      // sur des lignes vides. Même chose pour les colonnes : celles que
      // proposent les menus.
      parseSheetData(sheet, range);
      slot.rowCount = slot.data.length;
      slot.colCount = slot.headers.length;
      updateFileInfo();
      renderSheetSelector();
      if (onChange) onChange(slot);
      // Le classeur a livré tout ce dont on a besoin : rien ne le retient,
      // il part au ramasse-miettes (cf. commentaire sur slot.file)
    }

    function updateFileInfo() {
      infoEl.innerHTML = `<strong>${esc(slot.fileName)}</strong> — ${slot.rowCount.toLocaleString()} lignes, ${slot.colCount} col., feuille : ${esc(slot.sheetName)}`;
    }

    function renderSheetSelector() {
      if (!showSheetSelector || !sheetsEl) return;
      if (slot.sheetNames.length <= 1) {
        sheetsEl.classList.remove('visible');
        sheetsEl.innerHTML = '';
        return;
      }
      sheetsEl.innerHTML = '';
      sheetsEl.classList.add('visible');
      slot.sheetNames.forEach(name => {
        const btn = document.createElement('button');
        btn.className = 'sheet-btn' + (name === slot.sheetName ? ' active' : '');
        btn.textContent = name;
        btn.addEventListener('click', e => {
          e.stopPropagation();
          sheetsEl.querySelectorAll('.sheet-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          slot.setSheet(name);
        });
        sheetsEl.appendChild(btn);
      });
    }

    // Les lignes vides sont écartées, mais chaque ligne retenue garde son
    // VRAI numéro de ligne Excel. C'est tout l'objet de `blankrows: true` :
    // la conversion rend alors une entrée par ligne de la plage, vide ou
    // non, donc l'indice i correspond exactement à la ligne range.s.r+2+i.
    // Sans ça, une seule ligne vide au milieu du fichier décale toutes les
    // suivantes dans la colonne « Ligne » et dans les exports.
    //
    // Un nombre qu'Excel affiche avec des zéros en tête (format 00000) est
    // repris tel qu'Excel l'affiche : l'usager retrouve « 00123 » à
    // l'écran et dans les exports, et non 123. Le texte affiché ne sert
    // que s'il désigne bien le même nombre.
    function parseSheetData(sheet, range) {
      if (!sheet) { slot.data = []; slot.headers = []; return; }
      for (const ref in sheet) {
        if (ref.charCodeAt(0) === 33) continue; // '!ref', '!merges'…
        const cell = sheet[ref];
        if (cell && cell.t === 'n' && typeof cell.w === 'string' && /^0+\d/.test(cell.w) && Number(cell.w) === cell.v) {
          cell.t = 's';
          cell.v = cell.w;
        }
      }
      // Les titres sont sur la première ligne NON VIDE : une ligne blanche
      // en tête de fichier (fréquente dans les exports) faisait prendre les
      // vrais titres pour une ligne de données, et toutes les colonnes
      // devenaient « sans titre ».
      let ligneTitres = range.s.r;
      while (ligneTitres < range.e.r && ligneVide(sheet, ligneTitres, range)) ligneTitres++;
      const titres = titresColonnes(sheet, ligneTitres, range);
      // Les titres étant fournis, la conversion commence à la ligne qui
      // suit celle des titres
      const brut = range.e.r > ligneTitres
        ? XLSX.utils.sheet_to_json(sheet, {
          header: titres.noms, defval: '', blankrows: true, UTC: true,
          range: { s: { r: ligneTitres + 1, c: range.s.c }, e: range.e },
        })
        : [];
      const premiere = ligneTitres + 2; // ligne Excel de la 1re ligne de données
      const data = [];
      for (let i = 0; i < brut.length; i++) {
        const row = brut[i];
        let vide = true;
        for (const k in row) {
          if (row[k] !== '' && row[k] != null) { vide = false; break; }
        }
        if (vide) continue;
        row.__rowNum = premiere + i;
        data.push(row);
      }
      // Une colonne sans titre ni la moindre valeur n'est qu'un reste de
      // mise en forme : elle n'encombre pas les menus de colonnes
      const headers = !data.length ? [] : titres.noms.filter((nom, c) =>
        !titres.sansTitre[c] || data.some(r => r[nom] !== '' && r[nom] != null));
      slot.data = data;
      slot.headers = headers;
    }

    function texteCellule(sheet, r, c) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      return cell == null ? '' : String(XLSX.utils.format_cell(cell));
    }

    function ligneVide(sheet, r, range) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        if (texteCellule(sheet, r, c).trim() !== '') return false;
      }
      return true;
    }

    // Titres des colonnes, lus sur la ligne r, comme le fait SheetJS
    // (doublons suffixés « _1 », « _2 »…), à une différence près : une
    // colonne sans titre s'appelle « Colonne C (sans titre) », avec sa
    // lettre Excel, et non « __EMPTY » — c'est ce nom que l'usager voit
    // dans les menus, le tableau et les exports.
    function titresColonnes(sheet, r, range) {
      const noms = [], sansTitre = [], deja = {};
      for (let c = range.s.c; c <= range.e.c; c++) {
        let base = texteCellule(sheet, r, c);
        const vide = base.trim() === '';
        if (vide) base = `Colonne ${XLSX.utils.encode_col(c)} (sans titre)`;
        let nom = base;
        let n = deja[base] || 0;
        if (n) {
          do { nom = base + '_' + n++; } while (deja[nom]);
          deja[nom] = 1;
        }
        deja[base] = n || 1;
        noms.push(nom);
        sansTitre.push(vide);
      }
      return { noms, sansTitre };
    }

    // Sélecteur supplémentaire pour charger le .htm d'une feuille de frameset
    function promptForHtmFile() {
      const existing = dropEl.querySelector('.htm-picker');
      if (existing) existing.remove();

      const wrapper = document.createElement('div');
      wrapper.className = 'htm-picker';

      const btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.style.cssText = 'font-size:12px;padding:7px 16px;';
      btn.textContent = '📂 Charger le fichier .htm';

      const htmInput = document.createElement('input');
      htmInput.type = 'file';
      htmInput.accept = '.htm,.html,.xls,.xlsx,.csv';
      htmInput.style.display = 'none';

      btn.addEventListener('click', e => {
        e.stopPropagation();
        htmInput.click();
      });
      htmInput.addEventListener('change', e => {
        if (e.target.files.length) {
          wrapper.remove();
          loadFile(e.target.files[0]);
        }
      });

      wrapper.appendChild(btn);
      wrapper.appendChild(htmInput);
      dropEl.appendChild(wrapper);
    }

    return slot;
  }

  return { createSlot };
})();
