// ============================================================
//  XLDiff — advanced.js
//  Flux « fichiers différents » : l'utilisateur associe les
//  colonnes d'un fichier à l'autre (mapping colonne A ↔ B ↔ C).
//  Les colonnes de même nom sont pré-associées automatiquement.
//
//  Deux rôles de colonnes, dans deux panneaux distincts :
//    • colonnes de rapprochement (clé) — servent à retrouver la
//      même ligne dans chaque fichier ;
//    • colonnes à comparer (facultatif) — le contenu des lignes
//      retrouvées est vérifié sur ces colonnes, ce qui fait
//      remonter les lignes « retrouvées mais différentes ».
//
//  Un troisième fichier (C) est facultatif : la page le propose
//  uniquement si elle contient la zone de dépôt #dropC.
//
//  Deux pages utilisent ce contrôleur, selon window.XLDIFF_MODE
//  (défini par la page avant ce script) :
//    'diff'  (défaut) — advanced.html        : différences
//    'dupes'          — doublons-avance.html : lignes communes
//  Les deux acceptent le troisième fichier.
// ============================================================

(() => {
  const $ = id => document.getElementById(id);
  const MODE = window.XLDIFF_MODE === 'dupes' ? 'dupes' : 'diff';

  // Une association = un nom de colonne par fichier chargé : { A, B, C }
  let mappings = [];    // colonnes de rapprochement (clé)
  let compareCols = []; // colonnes dont le contenu est comparé

  XLDiffResults.init();

  // Le choix de feuille se fait dans le panneau « 1. Choix des feuilles »,
  // pas dans les zones de dépôt
  function makeSlot(side) {
    const dropEl = $('drop' + side);
    if (!dropEl) return null; // fichier non proposé par cette page (C facultatif)
    return XLDiffFiles.createSlot({
      side,
      dropEl, inputEl: $('file' + side), infoEl: $('info' + side),
      sheetsEl: null, showSheetSelector: false,
      onChange: onSlotChange,
    });
  }

  const slots = ['A', 'B', 'C'].map(makeSlot).filter(Boolean);
  const loaded = () => slots.filter(s => s.loaded);

  const sheetPanel = $('sheetPanel');
  const sheetChoiceList = $('sheetChoiceList');
  const mappingPanel = $('mappingPanel');
  const mappingTitle = $('mappingTitle');
  const mapList = $('mapList');
  const btnAddMapping = $('btnAddMapping');
  // Panneau « colonnes à comparer » : présent uniquement sur advanced.html
  const comparePanel = $('comparePanel');
  const compareTitle = $('compareTitle');
  const compareList = $('compareList');
  const btnAddCompare = $('btnAddCompare');
  const btnCompare = $('btnCompare');
  const btnExport = $('btnExport');
  // Export du fichier A annote : present uniquement sur advanced.html
  const btnExportAnnote = $('btnExportAnnote');
  const statusText = $('statusText');
  const progressBar = $('progressBar');
  const progressFill = $('progressFill');
  const showAllCols = $('showAllCols');
  // Coche « Ignorer les doublons » : présente uniquement sur advanced.html
  // (mode différences), absente des pages doublons
  const ignoreDupes = $('ignoreDupes');
  let hasCompared = false;

  function onSlotChange() {
    renderSheetPanel();
    rebuildMappings();
  }

  // ---------- Choix des feuilles (premier choix, avant les colonnes) ----------

  function renderSheetPanel() {
    const multi = loaded().filter(s => s.sheetNames.length > 1);
    if (multi.length === 0) {
      sheetPanel.classList.remove('visible');
      sheetChoiceList.innerHTML = '';
      setTitles(false);
      return;
    }

    sheetPanel.classList.add('visible');
    setTitles(true);
    sheetChoiceList.innerHTML = '';

    multi.forEach(slot => {
      const row = document.createElement('div');
      row.className = 'sheet-choice-row';

      const label = document.createElement('span');
      label.className = 'sheet-choice-label label-' + slot.side.toLowerCase();
      label.textContent = `Fichier ${slot.side} — ${slot.fileName}`;

      const sel = document.createElement('select');
      sel.className = 'map-select side-' + slot.side.toLowerCase();
      slot.sheetNames.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        if (name === slot.sheetName) opt.selected = true;
        sel.appendChild(opt);
      });
      // setSheet relit les données et redéclenche onSlotChange
      // (le mapping est reconstruit pour la nouvelle feuille)
      sel.addEventListener('change', () => slot.setSheet(sel.value));

      row.appendChild(label);
      row.appendChild(sel);
      sheetChoiceList.appendChild(row);
    });
  }

  // Numérotation des panneaux : le choix des feuilles n'apparaît que si
  // un classeur contient plusieurs feuilles
  function setTitles(withSheets) {
    const prefix = withSheets ? '2. ' : '';
    mappingTitle.textContent = prefix + (MODE === 'dupes'
      ? 'Association des colonnes'
      : 'Colonnes de rapprochement');
    if (compareTitle) {
      compareTitle.textContent = (withSheets ? '3. ' : '') + 'Colonnes à comparer (facultatif)';
    }
  }

  // ---------- Mapping de colonnes ----------

  // Conserve les associations encore valides, complète les fichiers
  // nouvellement chargés, et pré-associe les colonnes de même nom
  // quand il n'y a plus rien à conserver.
  function rebuildMappings() {
    const active = loaded();
    if (active.length < 2) {
      mappingPanel.classList.remove('visible');
      if (comparePanel) comparePanel.classList.remove('visible');
      updateReady();
      return;
    }

    const keep = list => list.filter(m => active.every(s => !m[s.side] || s.headers.includes(m[s.side])));
    mappings = keep(mappings);
    compareCols = keep(compareCols);

    if (mappings.length === 0) mappings = autoPair(active);
    [mappings, compareCols].forEach(list => list.forEach(m => complete(m, active)));

    mappingPanel.classList.add('visible');
    if (comparePanel) comparePanel.classList.add('visible');
    renderAll();
    updateReady();
  }

  // Colonnes portant le même nom dans tous les fichiers chargés
  function autoPair(active) {
    const others = active.slice(1);
    return active[0].headers
      .filter(h => others.every(s => s.headers.includes(h)))
      .map(h => {
        const m = {};
        active.forEach(s => { m[s.side] = h; });
        return m;
      });
  }

  // Complète une association pour un fichier qui vient d'être chargé :
  // colonne de même nom si elle existe, sinon première colonne
  function complete(m, active) {
    active.forEach(s => {
      if (m[s.side] && s.headers.includes(m[s.side])) return;
      const twin = active.map(o => m[o.side]).find(name => name && s.headers.includes(name));
      m[s.side] = twin || s.headers[0];
    });
  }

  function renderAll() {
    renderList(mappings, mapList, 'key');
    if (compareList) renderList(compareCols, compareList, 'cmp');
  }

  function renderList(list, container, kind) {
    const active = loaded();
    container.innerHTML = '';

    if (list.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'map-empty';
      empty.textContent = kind === 'key'
        ? 'Aucune association — cliquez sur « Ajouter une association » pour en créer une.'
        : 'Aucune colonne comparée — seule la présence des lignes est vérifiée.';
      container.appendChild(empty);
      return;
    }

    list.forEach((m, idx) => {
      const row = document.createElement('div');
      row.className = 'map-row';

      active.forEach((slot, i) => {
        if (i > 0) {
          const arrow = document.createElement('span');
          arrow.className = 'map-arrow';
          arrow.textContent = '↔';
          row.appendChild(arrow);
        }
        const sel = buildSelect(slot.headers, m[slot.side], 'side-' + slot.side.toLowerCase());
        sel.addEventListener('change', () => { m[slot.side] = sel.value; });
        row.appendChild(sel);
      });

      const remove = document.createElement('button');
      remove.className = 'map-remove';
      remove.title = 'Supprimer cette association';
      remove.textContent = '×';
      remove.addEventListener('click', () => {
        list.splice(idx, 1);
        renderAll();
        updateReady();
      });

      row.appendChild(remove);
      container.appendChild(row);
    });
  }

  function buildSelect(headers, selected, sideClass) {
    const sel = document.createElement('select');
    sel.className = 'map-select ' + sideClass;
    headers.forEach(h => {
      const opt = document.createElement('option');
      opt.value = h;
      opt.textContent = h;
      if (h === selected) opt.selected = true;
      sel.appendChild(opt);
    });
    return sel;
  }

  function addRow(list) {
    const active = loaded();
    if (active.length < 2) return;
    const m = {};
    active.forEach(s => { m[s.side] = s.headers[0]; });
    list.push(m);
    renderAll();
    updateReady();
  }

  btnAddMapping.addEventListener('click', () => addRow(mappings));
  if (btnAddCompare) btnAddCompare.addEventListener('click', () => addRow(compareCols));

  function updateReady() {
    const ready = loaded().length >= 2 && mappings.length > 0;
    btnCompare.disabled = !ready;
    statusText.className = 'status-text';

    if (loaded().length < 2) {
      statusText.textContent = slots.length > 2
        ? 'Chargez au moins deux fichiers — le fichier C est facultatif.'
        : 'Chargez les deux fichiers à analyser.';
      return;
    }
    const uneColonne = MODE === 'dupes' ? 'colonne associée' : 'colonne de rapprochement';
    const desColonnes = MODE === 'dupes' ? 'colonne(s) associée(s)' : 'colonne(s) de rapprochement';
    if (mappings.length === 0) {
      statusText.textContent = `Ajoutez au moins une ${uneColonne} pour lancer l'analyse.`;
      return;
    }
    const action = MODE === 'dupes' ? 'la recherche de doublons' : 'le rapprochement';
    let txt = `${mappings.length} ${desColonnes} — ${action} portera uniquement sur ces colonnes.`;
    if (compareCols.length) {
      txt += ` ${compareCols.length} colonne(s) comparée(s) : le contenu des lignes retrouvées sera vérifié.`;
    }
    statusText.textContent = txt;
  }

  // ---------- Colonnes affichées dans les résultats ----------

  function labelFor(m, active) {
    const names = active.map(s => m[s.side]);
    return names.every(n => n === names[0]) ? names[0] : names.join(' ↔ ');
  }

  function toColumn(m, active, role) {
    const cols = {};
    active.forEach(s => { cols[s.side] = m[s.side]; });
    return { label: labelFor(m, active), cols, role };
  }

  function buildColumns(showAll) {
    const active = loaded();
    // Colonnes de rapprochement d'abord, puis colonnes comparées
    const columns = mappings.map(m => toColumn(m, active, 'key'))
      .concat(compareCols.map(m => toColumn(m, active, 'cmp')));

    if (showAll) {
      const used = {};
      active.forEach(s => {
        used[s.side] = new Set([...mappings, ...compareCols].map(m => m[s.side]));
      });
      const seen = new Set();
      for (const slot of active) {
        for (const h of slot.headers) {
          if (seen.has(h)) continue;
          seen.add(h);
          const cols = {};
          let any = false;
          active.forEach(s => {
            const present = s.headers.includes(h) && !used[s.side].has(h);
            cols[s.side] = present ? h : null;
            if (present) any = true;
          });
          if (any) columns.push({ label: h, cols, role: 'other' });
        }
      }
    }

    return columns;
  }

  showAllCols.addEventListener('change', () => {
    XLDiffResults.setColumns(buildColumns(showAllCols.checked));
  });

  // ---------- Comparaison ----------

  function compare() {
    if (loaded().length < 2 || mappings.length === 0) return;

    progressBar.classList.add('visible');
    progressFill.style.width = '30%';
    statusText.className = 'status-text';
    statusText.textContent = MODE === 'dupes' ? 'Recherche en cours…' : 'Comparaison en cours…';
    btnCompare.disabled = true;

    requestAnimationFrame(() => setTimeout(runCompare, 30));
  }

  function runCompare() {
    const active = loaded();
    const sources = active.map(s => ({
      side: s.side,
      data: s.data,
      cols: mappings.map(m => m[s.side]),
    }));

    const result = MODE === 'dupes'
      ? XLDiffEngine.common(sources)
      : XLDiffEngine.analyze(sources, compareCols.map(m => toColumn(m, active, 'cmp')), {
          ignoreDuplicates: !!(ignoreDupes && ignoreDupes.checked),
        });
    hasCompared = true;

    progressFill.style.width = '100%';
    setTimeout(() => { progressBar.classList.remove('visible'); progressFill.style.width = '0%'; }, 400);

    const totals = {};
    const donnees = {};
    active.forEach(s => {
      totals[s.side] = s.data.length;
      donnees[s.side] = { data: s.data, headers: s.headers, fileName: s.fileName };
    });

    XLDiffResults.show({
      diff: result,
      columns: buildColumns(showAllCols.checked),
      totals,
      mode: MODE,
      sources: donnees,
    });

    btnCompare.disabled = false;
    btnExport.disabled = false;
    if (btnExportAnnote) btnExportAnnote.disabled = false;
    if (MODE === 'dupes') {
      // À trois fichiers, chaque fichier a ses propres lignes en double :
      // le total du tableau est la somme, pas le seul côté A
      const n = active.length > 2 ? result.all.length : result.onlyA.length;
      statusText.textContent = `Terminé — ${n.toLocaleString()} doublon(s) trouvé(s)`;
    } else {
      let txt = `Terminé — ${result.all.length.toLocaleString()} différence(s) trouvée(s)`;
      if (result.compared) {
        txt += ` et ${result.modified.length.toLocaleString()} ligne(s) retrouvée(s) mais différente(s)`;
      }
      statusText.textContent = txt;
    }
  }

  btnCompare.addEventListener('click', compare);
  if (ignoreDupes) {
    // Basculer la coche après une comparaison relance l'analyse pour que
    // les résultats affichés (et l'export) ne soient jamais périmés
    ignoreDupes.addEventListener('change', () => { if (hasCompared) compare(); });
  }
  btnExport.addEventListener('click', () => {
    XLDiffResults.exportResults();
    statusText.textContent = 'Export terminé ✓';
  });
  if (btnExportAnnote) {
    btnExportAnnote.addEventListener('click', () => {
      XLDiffResults.exportAnnotated();
      statusText.textContent = 'Export du fichier A annoté terminé ✓';
    });
  }

  updateReady();
})();
