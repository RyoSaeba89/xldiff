// ============================================================
//  XLDiff — advanced.js
//  Flux « fichiers différents » : l'utilisateur associe les
//  colonnes à analyser (mapping colonne A ↔ colonne B) ; seules
//  ces associations servent de clé. Les colonnes de même nom
//  sont pré-associées automatiquement.
//
//  Deux pages utilisent ce contrôleur, selon window.XLDIFF_MODE
//  (défini par la page avant ce script) :
//    'diff'  (défaut) — advanced.html        : différences A / B
//    'dupes'          — doublons-avance.html : lignes communes
// ============================================================

(() => {
  const $ = id => document.getElementById(id);
  const MODE = window.XLDIFF_MODE === 'dupes' ? 'dupes' : 'diff';

  let mappings = []; // [{ colA, colB }]

  XLDiffResults.init();

  // Le choix de feuille se fait dans le panneau « 1. Choix des feuilles »,
  // pas dans les zones de dépôt
  const slotA = XLDiffFiles.createSlot({
    side: 'A',
    dropEl: $('dropA'), inputEl: $('fileA'), infoEl: $('infoA'),
    sheetsEl: null, showSheetSelector: false,
    onChange: onSlotChange,
  });
  const slotB = XLDiffFiles.createSlot({
    side: 'B',
    dropEl: $('dropB'), inputEl: $('fileB'), infoEl: $('infoB'),
    sheetsEl: null, showSheetSelector: false,
    onChange: onSlotChange,
  });

  const sheetPanel = $('sheetPanel');
  const sheetChoiceList = $('sheetChoiceList');
  const mappingPanel = $('mappingPanel');
  const mappingTitle = $('mappingTitle');
  const mapList = $('mapList');
  const btnAddMapping = $('btnAddMapping');
  const btnCompare = $('btnCompare');
  const btnExport = $('btnExport');
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
    const multi = [slotA, slotB].filter(s => s.loaded && s.workbook.SheetNames.length > 1);
    if (multi.length === 0) {
      sheetPanel.classList.remove('visible');
      sheetChoiceList.innerHTML = '';
      mappingTitle.textContent = 'Association des colonnes à comparer';
      return;
    }

    sheetPanel.classList.add('visible');
    mappingTitle.textContent = '2. Association des colonnes à comparer';
    sheetChoiceList.innerHTML = '';

    multi.forEach(slot => {
      const row = document.createElement('div');
      row.className = 'sheet-choice-row';

      const label = document.createElement('span');
      label.className = 'sheet-choice-label ' + (slot.side === 'A' ? 'label-a' : 'label-b');
      label.textContent = `Fichier ${slot.side} — ${slot.fileName}`;

      const sel = document.createElement('select');
      sel.className = 'map-select ' + (slot.side === 'A' ? 'side-a' : 'side-b');
      slot.workbook.SheetNames.forEach(name => {
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

  // ---------- Mapping de colonnes ----------

  function rebuildMappings() {
    if (!slotA.loaded || !slotB.loaded) return;
    // Pré-association automatique des colonnes de même nom
    const setB = new Set(slotB.headers);
    mappings = slotA.headers.filter(h => setB.has(h)).map(h => ({ colA: h, colB: h }));
    mappingPanel.classList.add('visible');
    renderMappings();
    updateReady();
  }

  function renderMappings() {
    mapList.innerHTML = '';

    if (mappings.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'map-empty';
      empty.textContent = 'Aucune association — cliquez sur « Ajouter une association » pour en créer une.';
      mapList.appendChild(empty);
      return;
    }

    mappings.forEach((m, idx) => {
      const row = document.createElement('div');
      row.className = 'map-row';

      const selA = buildSelect(slotA.headers, m.colA, 'side-a');
      selA.addEventListener('change', () => { m.colA = selA.value; });

      const arrow = document.createElement('span');
      arrow.className = 'map-arrow';
      arrow.textContent = '↔';

      const selB = buildSelect(slotB.headers, m.colB, 'side-b');
      selB.addEventListener('change', () => { m.colB = selB.value; });

      const remove = document.createElement('button');
      remove.className = 'map-remove';
      remove.title = 'Supprimer cette association';
      remove.textContent = '×';
      remove.addEventListener('click', () => {
        mappings.splice(idx, 1);
        renderMappings();
        updateReady();
      });

      row.appendChild(selA);
      row.appendChild(arrow);
      row.appendChild(selB);
      row.appendChild(remove);
      mapList.appendChild(row);
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

  btnAddMapping.addEventListener('click', () => {
    if (!slotA.headers.length || !slotB.headers.length) return;
    mappings.push({ colA: slotA.headers[0], colB: slotB.headers[0] });
    renderMappings();
    updateReady();
  });

  function updateReady() {
    btnCompare.disabled = mappings.length === 0;
    statusText.className = 'status-text';
    const action = MODE === 'dupes' ? 'la recherche de doublons' : 'la comparaison';
    statusText.textContent = mappings.length === 0
      ? 'Ajoutez au moins une association de colonnes pour lancer l\'analyse.'
      : `${mappings.length} association(s) de colonnes — ${action} portera uniquement sur ces colonnes.`;
  }

  // ---------- Colonnes affichées dans les résultats ----------

  function buildColumns(showAll) {
    // Les paires associées d'abord
    const columns = mappings.map(m => ({
      label: m.colA === m.colB ? m.colA : `${m.colA} ↔ ${m.colB}`,
      colA: m.colA,
      colB: m.colB,
    }));

    if (showAll) {
      const mappedA = new Set(mappings.map(m => m.colA));
      const mappedB = new Set(mappings.map(m => m.colB));
      const seen = new Set();
      for (const h of [...slotA.headers, ...slotB.headers]) {
        if (seen.has(h)) continue;
        seen.add(h);
        const inA = slotA.headers.includes(h) && !mappedA.has(h);
        const inB = slotB.headers.includes(h) && !mappedB.has(h);
        if (!inA && !inB) continue;
        columns.push({ label: h, colA: inA ? h : null, colB: inB ? h : null });
      }
    }

    return columns;
  }

  showAllCols.addEventListener('change', () => {
    XLDiffResults.setColumns(buildColumns(showAllCols.checked));
  });

  // ---------- Comparaison ----------

  function compare() {
    if (mappings.length === 0) return;

    progressBar.classList.add('visible');
    progressFill.style.width = '30%';
    statusText.className = 'status-text';
    statusText.textContent = MODE === 'dupes' ? 'Recherche en cours…' : 'Comparaison en cours…';
    btnCompare.disabled = true;

    requestAnimationFrame(() => setTimeout(runCompare, 30));
  }

  function runCompare() {
    const colsA = mappings.map(m => m.colA);
    const colsB = mappings.map(m => m.colB);
    const result = MODE === 'dupes'
      ? XLDiffEngine.common(slotA.data, slotB.data, colsA, colsB)
      : XLDiffEngine.diff(slotA.data, slotB.data, colsA, colsB, {
          ignoreDuplicates: !!(ignoreDupes && ignoreDupes.checked),
        });
    hasCompared = true;

    progressFill.style.width = '100%';
    setTimeout(() => { progressBar.classList.remove('visible'); progressFill.style.width = '0%'; }, 400);

    XLDiffResults.show({
      diff: result,
      columns: buildColumns(showAllCols.checked),
      totalA: slotA.data.length,
      totalB: slotB.data.length,
      mode: MODE,
    });

    btnCompare.disabled = false;
    btnExport.disabled = false;
    statusText.textContent = MODE === 'dupes'
      ? `Terminé — ${result.onlyA.length.toLocaleString()} doublon(s) trouvé(s)`
      : `Terminé — ${result.all.length.toLocaleString()} différence(s) trouvée(s)`;
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
})();
