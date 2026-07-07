// ============================================================
//  XLDiff — file-loader.js
//  Lecture des fichiers (.xlsx, .xls, .csv, .htm) avec stratégies
//  de repli pour les exports HTML, et gestion des zones de dépôt.
//
//  API : XLDiffFiles.createSlot({ side, dropEl, inputEl, infoEl,
//        sheetsEl, onChange }) → slot { loaded, data, headers,
//        fileName, sheetName, workbook }
// ============================================================

const XLDiffFiles = (() => {

  // ---------- Utilitaires partagés ----------

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Trouve la première feuille contenant de vraies données
  // (ignore les feuilles vides ou de navigation des exports frameset)
  function findBestSheet(wb) {
    if (!wb || !wb.SheetNames.length) return null;
    let best = null;
    let bestRows = 0;
    for (const name of wb.SheetNames) {
      const sheet = wb.Sheets[name];
      if (!sheet['!ref']) continue;
      const json = XLSX.utils.sheet_to_json(sheet, { defval: '', header: 1 });
      if (json.length >= 2) {
        const cols = Math.max(...json.slice(0, 5).map(r => (Array.isArray(r) ? r : Object.values(r)).filter(v => v !== '').length));
        if (cols >= 2 && json.length > bestRows) {
          bestRows = json.length;
          best = name;
        }
      }
    }
    return best;
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

      // Heuristique : un vrai tableau de données a plusieurs colonnes
      // et du contenu texte significatif (élimine la navigation)
      const avgCellText = totalCells > 0 ? totalTextLen / totalCells : 0;
      if (maxCols >= 2 && rows.length >= 2 && avgCellText > 0.5) {
        candidates.push({ table, rows: rows.length, cols: maxCols, score: rows.length * maxCols });
      }
    }

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
      if (nonEmptyHeaders.length < 2) return;

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
        let val = (cell.textContent || '').replace(/\u00a0/g, ' ').trim();

        // Détection des nombres (y compris format français avec virgule)
        if (val !== '') {
          const numStr = val.replace(/\s/g, '').replace(',', '.');
          if (/^-?\d+(\.\d+)?$/.test(numStr)) {
            val = parseFloat(numStr);
          }
        }

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
      workbook: null,
      sheetName: null,
      data: [],
      headers: [],
      fileName: '',
      loaded: false,
      // Change la feuille active et relit les données (déclenche onChange)
      setSheet(name) {
        if (!slot.workbook || !slot.workbook.SheetNames.includes(name)) return;
        slot.sheetName = name;
        updateFileInfo();
        parseSheetData();
      },
    };

    dropEl.addEventListener('click', e => {
      // Ne pas ouvrir le sélecteur si le clic vise un élément interactif enfant
      if (e.target.closest('.sheet-btn') || e.target.closest('.htm-picker')) return;
      inputEl.click();
    });

    inputEl.addEventListener('change', e => {
      if (e.target.files.length) loadFile(e.target.files[0]);
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

    function loadFile(file) {
      const reader = new FileReader();
      reader.onload = e => {
        const data = new Uint8Array(e.target.result);
        const log = [];
        let wb = null;
        let bestSheet = null;

        // ── Stratégie 1 : SheetJS avec codepage windows-1252 ──
        try {
          const wb1 = XLSX.read(data, { type: 'array', cellDates: true, codepage: 1252 });
          const best = findBestSheet(wb1);
          if (best) {
            log.push('✓ SheetJS (cp1252): feuille "' + best + '"');
            wb = wb1; bestSheet = best;
          } else {
            log.push('✗ SheetJS (cp1252): aucune feuille exploitable');
          }
        } catch (ex) {
          log.push('✗ SheetJS: ' + ex.message);
        }

        // ── Stratégie 2 : replis pour les fichiers HTML ──
        if (!wb) {
          const html = decodeHtml(data);
          if (html && html.includes('<')) {
            log.push('  Fichier HTML (' + html.length + ' caractères)');

            // SheetJS sur la chaîne HTML
            try {
              const wb2 = XLSX.read(html, { type: 'string', cellDates: true, codepage: 1252 });
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
                  const wb5 = XLSX.read(tableHtml, { type: 'string', cellDates: true, codepage: 1252 });
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
              infoEl.innerHTML = `<strong class="warn">⚠ Frameset sans données intégrées</strong><br>
                <span style="font-size:11px">Chargez <b>${esc(sheetPath)}</b> ou ré-enregistrez en <b>.xlsx</b>.</span>`;
              promptForHtmFile();
              console.log('[XLDiff] ' + file.name + ':\n' + log.join('\n'));
              return;
            }
          }
        }

        console.log('[XLDiff] ' + file.name + ':\n' + log.join('\n'));

        if (!wb) {
          infoEl.innerHTML = `<strong class="error">⚠ Impossible de lire ce fichier</strong><br>
            <span style="font-size:11px">Console F12 pour le diagnostic. Ré-enregistrez en <b>.xlsx</b>.</span>`;
          return;
        }

        applyWorkbook(file, wb, bestSheet);
      };
      reader.readAsArrayBuffer(file);
    }

    function applyWorkbook(file, wb, preferredSheet) {
      slot.workbook = wb;
      slot.sheetName = preferredSheet || wb.SheetNames[0];
      slot.fileName = file.name;
      slot.loaded = true;
      dropEl.classList.remove('loaded-a', 'loaded-b');
      dropEl.classList.add(side === 'A' ? 'loaded-a' : 'loaded-b');
      updateFileInfo();
      renderSheetSelector();
      parseSheetData();
    }

    function updateFileInfo() {
      const sheet = slot.workbook.Sheets[slot.sheetName];
      const ref = sheet ? (sheet['!ref'] || 'A1') : 'A1';
      const range = XLSX.utils.decode_range(ref);
      const rows = range.e.r;
      const cols = range.e.c + 1;
      infoEl.innerHTML = `<strong>${esc(slot.fileName)}</strong> — ${rows.toLocaleString()} lignes, ${cols} col., feuille : ${esc(slot.sheetName)}`;
    }

    function renderSheetSelector() {
      if (!showSheetSelector || !sheetsEl) return;
      const wb = slot.workbook;
      if (wb.SheetNames.length <= 1) {
        sheetsEl.classList.remove('visible');
        sheetsEl.innerHTML = '';
        return;
      }
      sheetsEl.innerHTML = '';
      sheetsEl.classList.add('visible');
      wb.SheetNames.forEach(name => {
        const btn = document.createElement('button');
        btn.className = 'sheet-btn' + (name === slot.sheetName ? ' active' : '');
        btn.textContent = name;
        btn.addEventListener('click', e => {
          e.stopPropagation();
          sheetsEl.querySelectorAll('.sheet-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          slot.sheetName = name;
          updateFileInfo();
          parseSheetData();
        });
        sheetsEl.appendChild(btn);
      });
    }

    function parseSheetData() {
      const json = XLSX.utils.sheet_to_json(slot.workbook.Sheets[slot.sheetName], { defval: '' });
      slot.data = json;
      slot.headers = json.length ? Object.keys(json[0]) : [];
      if (onChange) onChange(slot);
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
