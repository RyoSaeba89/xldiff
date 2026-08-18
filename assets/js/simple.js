// ============================================================
//  XLDiff — simple.js
//  Flux « fichiers à colonnes identiques » : deux fichiers issus
//  du même export Excel, colonnes communes détectées
//  automatiquement, analyse sur toutes les colonnes.
//
//  Deux pages utilisent ce contrôleur, selon window.XLDIFF_MODE
//  (défini par la page avant ce script) :
//    'diff'  (défaut) — simple.html   : différences entre A et B
//    'dupes'          — doublons.html : lignes communes à A et B
// ============================================================

(() => {
  const $ = id => document.getElementById(id);
  const MODE = window.XLDIFF_MODE === 'dupes' ? 'dupes' : 'diff';

  let commonHeaders = [];

  XLDiffResults.init();

  const slotA = XLDiffFiles.createSlot({
    side: 'A',
    dropEl: $('dropA'), inputEl: $('fileA'), infoEl: $('infoA'), sheetsEl: $('sheetsA'),
    onChange: checkReady,
  });
  const slotB = XLDiffFiles.createSlot({
    side: 'B',
    dropEl: $('dropB'), inputEl: $('fileB'), infoEl: $('infoB'), sheetsEl: $('sheetsB'),
    onChange: checkReady,
  });

  const btnCompare = $('btnCompare');
  const btnExport = $('btnExport');
  const statusText = $('statusText');
  const progressBar = $('progressBar');
  const progressFill = $('progressFill');

  function checkReady() {
    if (!slotA.loaded || !slotB.loaded) return;
    const setA = new Set(slotA.headers);
    commonHeaders = slotB.headers.filter(h => setA.has(h));

    if (commonHeaders.length === 0) {
      btnCompare.disabled = true;
      statusText.className = 'status-text warn';
      statusText.textContent = '⚠ Aucune colonne commune — vérifiez que les deux fichiers proviennent du même export.';
      return;
    }

    btnCompare.disabled = false;
    statusText.className = 'status-text';
    statusText.textContent = MODE === 'dupes'
      ? `${commonHeaders.length} colonnes communes détectées — deux lignes sont des doublons si toutes leurs colonnes sont identiques.`
      : `${commonHeaders.length} colonnes communes détectées — la comparaison portera sur toutes les colonnes.`;
  }

  function compare() {
    progressBar.classList.add('visible');
    progressFill.style.width = '30%';
    statusText.className = 'status-text';
    statusText.textContent = MODE === 'dupes' ? 'Recherche en cours…' : 'Comparaison en cours…';
    btnCompare.disabled = true;

    requestAnimationFrame(() => setTimeout(runCompare, 30));
  }

  function runCompare() {
    const result = MODE === 'dupes'
      ? XLDiffEngine.common(slotA.data, slotB.data, commonHeaders, commonHeaders)
      : XLDiffEngine.diff(slotA.data, slotB.data, commonHeaders, commonHeaders);
    // Mode simple : toutes les colonnes communes servent de clé, aucune
    // colonne n'est comparée à part (cf. comparatif avancé)
    const columns = commonHeaders.map(h => ({ label: h, cols: { A: h, B: h }, role: 'key' }));

    progressFill.style.width = '100%';
    setTimeout(() => { progressBar.classList.remove('visible'); progressFill.style.width = '0%'; }, 400);

    XLDiffResults.show({
      diff: result,
      columns,
      totals: { A: slotA.data.length, B: slotB.data.length },
      mode: MODE,
      sources: {
        A: { data: slotA.data, headers: slotA.headers, fileName: slotA.fileName },
        B: { data: slotB.data, headers: slotB.headers, fileName: slotB.fileName },
      },
    });

    btnCompare.disabled = false;
    btnExport.disabled = false;
    statusText.textContent = MODE === 'dupes'
      ? `Terminé — ${result.onlyA.length.toLocaleString()} doublon(s) trouvé(s)`
      : `Terminé — ${result.all.length.toLocaleString()} différence(s) trouvée(s)`;
  }

  btnCompare.addEventListener('click', compare);
  btnExport.addEventListener('click', () => {
    XLDiffResults.exportResults();
    statusText.textContent = 'Export terminé ✓';
  });
})();
