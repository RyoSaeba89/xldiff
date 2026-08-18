// ============================================================
//  XLDiff — diff-engine.js
//  Moteur d'analyse : rapprochement de 2 ou 3 jeux de lignes sur
//  des colonnes-clés qui peuvent différer d'un fichier à l'autre
//  (mapping de colonnes), puis comparaison facultative du contenu
//  des lignes rapprochées.
//
//  Deux rôles distincts pour les colonnes :
//    • colonnes de rapprochement (clé) — servent à retrouver la
//      même ligne dans chaque fichier ;
//    • colonnes à comparer — comparées uniquement à l'intérieur
//      d'un rapprochement, pour signaler les lignes retrouvées
//      dont le contenu diffère.
//
//  API :
//    XLDiffEngine.analyze(sources, cmpCols, opts)
//      sources : [{ side:'A'|'B'|'C', data, cols }] (2 ou 3 entrées,
//                cols = colonnes-clés de CE fichier, même longueur
//                et même ordre pour tous les fichiers)
//      cmpCols : [{ label, cols:{ A, B, C } }] (peut être vide)
//      opts.ignoreDuplicates : une clé présente dans TOUS les
//                fichiers ne produit aucun écart de présence, quel
//                que soit son nombre d'occurrences dans chacun ;
//                une clé absente d'au moins un fichier remonte
//                toutes ses occurrences.
//      → { sides, bySide, onlyA, onlyB, onlyC, all, modified,
//          matched, identical, compared }
//
//    XLDiffEngine.diff(dataA, dataB, colsA, colsB, opts)
//      → raccourci deux fichiers sans comparaison de contenu
//        (forme historique : { onlyA, onlyB, all })
//
//    XLDiffEngine.common(dataA, dataB, colsA, colsB)
//      → lignes EN COMMUN vues côté A / côté B (recherche de
//        doublons entre deux fichiers), même forme de retour.
//
//  Chaque ligne retournée porte __rowNum (n° de ligne Excel,
//  l'en-tête étant la ligne 1), __source ('A', 'B' ou 'C') et
//  __presence (fichiers où la clé est présente, ex. « A + B »).
// ============================================================

const XLDiffEngine = (() => {
  const SEP = '\x00';
  // Espace insécable et espace insécable étroit : invisibles à l'écran,
  // mais deux valeurs identiques à l'œil ne se ressemblent pas sans ça.
  const NBSP = /[  ]/g;

  function isDate(v) {
    return Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime());
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  // Une date lue dans un .xlsx arrive en objet Date, la même date lue
  // dans un .csv ou un .htm arrive en texte : on ramène tout au format
  // français, pour l'affichage comme pour la comparaison.
  function displayValue(v) {
    if (v == null) return '';
    if (isDate(v)) {
      const d = `${pad2(v.getDate())}/${pad2(v.getMonth() + 1)}/${v.getFullYear()}`;
      const withTime = v.getHours() || v.getMinutes() || v.getSeconds();
      return withTime ? `${d} ${pad2(v.getHours())}:${pad2(v.getMinutes())}` : d;
    }
    return String(v);
  }

  // Normalisation appliquée AUX SEULES colonnes comparées : espaces
  // insécables ramenés à des espaces ordinaires, espaces multiples et
  // de bordure supprimés, casse ignorée. Les colonnes-clés gardent une
  // comparaison stricte (cf. makeKey).
  function normCell(v) {
    return displayValue(v).replace(NBSP, ' ').replace(/\s+/g, ' ').trim().toLocaleLowerCase('fr');
  }

  function makeKey(row, cols) {
    let k = '';
    for (let i = 0; i < cols.length; i++) {
      if (i) k += SEP;
      k += String(row[cols[i]] ?? '');
    }
    return k;
  }

  function indexRows(data, cols, side) {
    const count = new Map();
    const rowsByKey = new Map();
    for (let ri = 0; ri < data.length; ri++) {
      const row = data[ri];
      row.__rowNum = ri + 2; // ligne Excel (1-based, l'en-tête est la ligne 1)
      row.__source = side;
      const k = makeKey(row, cols);
      count.set(k, (count.get(k) || 0) + 1);
      if (!rowsByKey.has(k)) rowsByKey.set(k, []);
      rowsByKey.get(k).push(row);
    }
    return { count, rowsByKey };
  }

  function byRowNum(a, b) { return (a.__rowNum || 0) - (b.__rowNum || 0); }

  // ---------- Analyse générale (2 ou 3 fichiers) ----------

  function analyze(sources, cmpCols, opts) {
    const ignoreDuplicates = !!(opts && opts.ignoreDuplicates);
    const cmp = cmpCols || [];
    const sides = sources.map(s => s.side);
    const idx = sources.map(s => indexRows(s.data, s.cols, s.side));

    const bySide = {};
    for (const sd of sides) bySide[sd] = [];
    const modified = [];
    let matched = 0;

    // Union des clés : celles du 1er fichier d'abord, puis les clés
    // inédites du 2e, etc.
    const keys = new Set();
    for (const i of idx) for (const k of i.count.keys()) keys.add(k);

    for (const k of keys) {
      const counts = idx.map(i => i.count.get(k) || 0);
      let minC = counts[0];
      for (let j = 1; j < counts.length; j++) if (counts[j] < minC) minC = counts[j];
      const presence = sides.filter((sd, j) => counts[j] > 0).join(' + ');

      // Rapprochement : la i-ème occurrence de la clé dans un fichier est
      // appariée avec la i-ème occurrence des autres (ordre du fichier).
      for (let i = 0; i < minC; i++) {
        matched++;
        if (!cmp.length) continue;
        const rows = {};
        for (let j = 0; j < sides.length; j++) rows[sides[j]] = idx[j].rowsByKey.get(k)[i];

        const diffs = [];
        for (const col of cmp) {
          const values = {};
          let ref = null;
          let differs = false;
          for (let j = 0; j < sides.length; j++) {
            const sd = sides[j];
            const c = col.cols[sd];
            const raw = c == null ? '' : rows[sd][c];
            values[sd] = raw;
            const n = normCell(raw);
            if (j === 0) ref = n;
            else if (n !== ref) differs = true;
          }
          if (differs) diffs.push({ label: col.label, values });
        }
        if (diffs.length) modified.push({ rows, diffs });
      }

      // Écarts de présence : les occurrences sans contrepartie dans au
      // moins un autre fichier. Avec ignoreDuplicates, seule l'absence
      // totale compte — la clé remonte alors toutes ses occurrences.
      for (let j = 0; j < sides.length; j++) {
        const rows = idx[j].rowsByKey.get(k);
        if (!rows) continue;
        const from = ignoreDuplicates ? (minC === 0 ? 0 : rows.length) : minC;
        for (let i = from; i < rows.length; i++) {
          rows[i].__presence = presence;
          bySide[sides[j]].push(rows[i]);
        }
      }
    }

    const all = [];
    for (const sd of sides) {
      bySide[sd].sort(byRowNum);
      for (const r of bySide[sd]) all.push(r);
    }
    if (cmp.length) modified.sort((x, y) => byRowNum(x.rows[sides[0]], y.rows[sides[0]]));

    return {
      sides,
      bySide,
      onlyA: bySide.A || [],
      onlyB: bySide.B || [],
      onlyC: bySide.C || [],
      all,
      modified,
      matched,
      identical: matched - modified.length,
      compared: cmp.length > 0,
    };
  }

  // ---------- Raccourci historique : deux fichiers, contenu non comparé ----------

  function diff(dataA, dataB, colsA, colsB, opts) {
    return analyze([
      { side: 'A', data: dataA, cols: colsA },
      { side: 'B', data: dataB, cols: colsB },
    ], [], opts);
  }

  // Lignes communes aux deux fichiers (doublons A ↔ B), en sémantique
  // multi-ensemble : une clé présente 3 fois dans A et 1 fois dans B
  // ne compte que pour 1 correspondance. Le résultat reprend la forme
  // de analyze() pour être affiché par XLDiffResults sans adaptation :
  // onlyA = correspondances vues côté A, onlyB = vues côté B
  // (onlyA.length === onlyB.length === nombre de correspondances).
  function common(dataA, dataB, colsA, colsB) {
    const a = indexRows(dataA, colsA, 'A');
    const b = indexRows(dataB, colsB, 'B');

    const inA = [];
    const inB = [];

    for (const [k, cA] of a.count) {
      const cB = b.count.get(k) || 0;
      const n = Math.min(cA, cB);
      if (n === 0) continue;
      const rowsA = a.rowsByKey.get(k);
      const rowsB = b.rowsByKey.get(k);
      for (let i = 0; i < n; i++) { rowsA[i].__presence = 'A + B'; inA.push(rowsA[i]); }
      for (let i = 0; i < n; i++) { rowsB[i].__presence = 'A + B'; inB.push(rowsB[i]); }
    }

    inA.sort(byRowNum);
    inB.sort(byRowNum);

    return {
      sides: ['A', 'B'],
      bySide: { A: inA, B: inB },
      onlyA: inA,
      onlyB: inB,
      onlyC: [],
      all: inA.concat(inB),
      modified: [],
      matched: inA.length,
      identical: inA.length,
      compared: false,
    };
  }

  return { analyze, diff, common, displayValue, normCell };
})();
