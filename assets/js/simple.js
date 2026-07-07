// ============================================================
//  XLDiff — simple.js
//  Mode « comparatif simple » : deux fichiers issus du même
//  export Excel. Les colonnes communes sont détectées
//  automatiquement et la comparaison porte sur toutes.
// ============================================================

(() => {
  const $ = id => document.getElementById(id);

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
    statusText.textContent = `${commonHeaders.length} colonnes communes détectées — la comparaison portera sur toutes les colonnes.`;
  }

  function compare() {
    progressBar.classList.add('visible');
    progressFill.style.width = '30%';
    statusText.className = 'status-text';
    statusText.textContent = 'Comparaison en cours…';
    btnCompare.disabled = true;

    requestAnimationFrame(() => setTimeout(runCompare, 30));
  }

  function runCompare() {
    const diff = XLDiffEngine.diff(slotA.data, slotB.data, commonHeaders, commonHeaders);
    const columns = commonHeaders.map(h => ({ label: h, colA: h, colB: h }));

    progressFill.style.width = '100%';
    setTimeout(() => { progressBar.classList.remove('visible'); progressFill.style.width = '0%'; }, 400);

    XLDiffResults.show({ diff, columns, totalA: slotA.data.length, totalB: slotB.data.length });

    btnCompare.disabled = false;
    btnExport.disabled = false;
    statusText.textContent = `Terminé — ${diff.all.length.toLocaleString()} différence(s) trouvée(s)`;
  }

  btnCompare.addEventListener('click', compare);
  btnExport.addEventListener('click', () => {
    XLDiffResults.exportResults();
    statusText.textContent = 'Export terminé ✓';
  });
})();
