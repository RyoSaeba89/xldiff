// ============================================================
//  XLDiff — diff-engine.js
//  Moteur de comparaison : différence de multi-ensembles entre
//  deux jeux de lignes, sur des listes de colonnes-clés qui
//  peuvent différer entre A et B (mapping de colonnes).
//
//  API : XLDiffEngine.diff(dataA, dataB, colsA, colsB)
//        → { onlyA, onlyB, all }
//        XLDiffEngine.common(dataA, dataB, colsA, colsB)
//        → même forme { onlyA, onlyB, all }, mais onlyA/onlyB
//        contiennent les lignes EN COMMUN vues côté A / côté B
//        (recherche de doublons entre les deux fichiers).
//        Chaque ligne retournée porte __rowNum (n° de ligne Excel,
//        l'en-tête étant la ligne 1) et __source ('A' ou 'B').
// ============================================================

const XLDiffEngine = (() => {
  const SEP = '\x00';

  function makeKey(row, cols) {
    let k = '';
    for (let i = 0; i < cols.length; i++) {
      if (i) k += SEP;
      k += String(row[cols[i]] ?? '');
    }
    return k;
  }

  function indexRows(data, cols) {
    const count = new Map();
    const rowsByKey = new Map();
    for (let ri = 0; ri < data.length; ri++) {
      const row = data[ri];
      row.__rowNum = ri + 2; // ligne Excel (1-based, l'en-tête est la ligne 1)
      const k = makeKey(row, cols);
      count.set(k, (count.get(k) || 0) + 1);
      if (!rowsByKey.has(k)) rowsByKey.set(k, []);
      rowsByKey.get(k).push(row);
    }
    return { count, rowsByKey };
  }

  function diff(dataA, dataB, colsA, colsB) {
    const a = indexRows(dataA, colsA);
    const b = indexRows(dataB, colsB);

    const onlyA = [];
    const onlyB = [];

    // Clés de A : si A en contient plus que B, l'excédent est « uniquement A »
    for (const [k, cA] of a.count) {
      const cB = b.count.get(k) || 0;
      if (cA > cB) {
        const rows = a.rowsByKey.get(k);
        for (let i = 0; i < cA - cB; i++) onlyA.push(rows[i]);
      }
    }

    // Clés de B : si B en contient plus que A, l'excédent est « uniquement B »
    for (const [k, cB] of b.count) {
      const cA = a.count.get(k) || 0;
      if (cB > cA) {
        const rows = b.rowsByKey.get(k);
        for (let i = 0; i < cB - cA; i++) onlyB.push(rows[i]);
      }
    }

    for (const r of onlyA) r.__source = 'A';
    for (const r of onlyB) r.__source = 'B';

    return { onlyA, onlyB, all: onlyA.concat(onlyB) };
  }

  // Lignes communes aux deux fichiers (doublons A ↔ B), en sémantique
  // multi-ensemble : une clé présente 3 fois dans A et 1 fois dans B
  // ne compte que pour 1 correspondance. Le résultat reprend la forme
  // de diff() pour être affiché par XLDiffResults sans adaptation :
  // onlyA = correspondances vues côté A, onlyB = vues côté B
  // (onlyA.length === onlyB.length === nombre de correspondances).
  function common(dataA, dataB, colsA, colsB) {
    const a = indexRows(dataA, colsA);
    const b = indexRows(dataB, colsB);

    const inA = [];
    const inB = [];

    for (const [k, cA] of a.count) {
      const cB = b.count.get(k) || 0;
      const n = Math.min(cA, cB);
      if (n === 0) continue;
      const rowsA = a.rowsByKey.get(k);
      const rowsB = b.rowsByKey.get(k);
      for (let i = 0; i < n; i++) inA.push(rowsA[i]);
      for (let i = 0; i < n; i++) inB.push(rowsB[i]);
    }

    for (const r of inA) r.__source = 'A';
    for (const r of inB) r.__source = 'B';

    return { onlyA: inA, onlyB: inB, all: inA.concat(inB) };
  }

  return { diff, common };
})();
