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
//          matched, identical, compared, trace, tuples, tupleDiffs }
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
//
//  TRAÇAGE — `trace[side]` décrit le sort de CHAQUE ligne du
//  fichier, y compris celles qui ne sont pas des différences :
//    trace[side].tuple[i]    = n° du rapprochement, ou -1
//    trace[side].presence[i] = masque de bits des fichiers où la
//                              clé de la ligne existe (bit 0 = A…)
//  et `tuples[side][t]` donne l'indice de ligne de chaque fichier
//  pour le rapprochement t. C'est ce qui permet d'exporter le
//  fichier source annoté ligne à ligne, sans le réanalyser.
// ============================================================

const XLDiffEngine = (() => {
  const SEP = '\x00';
  // Espace insécable et espace insécable étroit : invisibles à l'écran,
  // mais deux valeurs identiques à l'œil ne se ressemblent pas sans ça.
  const NBSP = /[  ]/g;

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

  // Index d'un fichier : une entrée par clé DISTINCTE ({ c, h, t }
  // = nombre d'occurrences, 1re ligne, dernière ligne) et un chaînage
  // des occurrences suivantes dans un seul Int32Array — bien plus
  // léger qu'un tableau de lignes par clé quand il y a 200 000 clés.
  function indexRows(data, cols, side) {
    const n = data.length;
    const keys = new Map();
    const next = new Int32Array(n).fill(-1);
    for (let i = 0; i < n; i++) {
      const row = data[i];
      row.__rowNum = i + 2; // ligne Excel (1-based, l'en-tête est la ligne 1)
      row.__source = side;
      const k = makeKey(row, cols);
      const e = keys.get(k);
      if (e === undefined) keys.set(k, { c: 1, h: i, t: i });
      else { e.c++; next[e.t] = i; e.t = i; }
    }
    return { keys, next };
  }

  function byRowNum(a, b) { return (a.__rowNum || 0) - (b.__rowNum || 0); }

  // ---------- Analyse générale (2 ou 3 fichiers) ----------

  function analyze(sources, cmpCols, opts) {
    const ignoreDuplicates = !!(opts && opts.ignoreDuplicates);
    const cmp = cmpCols || [];
    const sides = sources.map(s => s.side);
    const nb = sides.length;
    const idx = sources.map(s => indexRows(s.data, s.cols, s.side));

    const bySide = {};
    const trace = {};
    sides.forEach((sd, j) => {
      bySide[sd] = [];
      const n = sources[j].data.length;
      trace[sd] = { tuple: new Int32Array(n).fill(-1), presence: new Uint8Array(n) };
    });

    // Rapprochements : indices de ligne de chaque fichier
    const tuples = {};
    sides.forEach(sd => { tuples[sd] = []; });
    const tupleDiffs = new Map();
    const modified = [];
    let matched = 0;

    // Union des clés : celles du 1er fichier d'abord, puis les clés
    // inédites du 2e, etc.
    const keys = new Set();
    for (const i of idx) for (const k of i.keys.keys()) keys.add(k);

    const curseur = new Int32Array(nb);
    for (const k of keys) {
      let minC = Infinity;
      let masque = 0;
      for (let j = 0; j < nb; j++) {
        const e = idx[j].keys.get(k);
        const c = e ? e.c : 0;
        if (c < minC) minC = c;
        if (c > 0) masque |= (1 << j);
        curseur[j] = e ? e.h : -1;
      }
      const presence = sides.filter((sd, j) => (masque >> j) & 1).join(' + ');

      // Rapprochement : la i-ème occurrence de la clé dans un fichier est
      // appariée avec la i-ème occurrence des autres (ordre du fichier).
      for (let i = 0; i < minC; i++) {
        const t = matched++;
        const lignes = {};
        for (let j = 0; j < nb; j++) {
          const sd = sides[j];
          const li = curseur[j];
          lignes[sd] = li;
          tuples[sd].push(li);
          trace[sd].tuple[li] = t;
          trace[sd].presence[li] = masque;
          curseur[j] = idx[j].next[li];
        }
        if (!cmp.length) continue;

        const rows = {};
        for (let j = 0; j < nb; j++) rows[sides[j]] = sources[j].data[lignes[sides[j]]];
        const diffs = [];
        for (const col of cmp) {
          const values = {};
          let ref = null;
          let differs = false;
          for (let j = 0; j < nb; j++) {
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
        if (diffs.length) {
          const entree = { t, rows, diffs };
          modified.push(entree);
          tupleDiffs.set(t, diffs);
        }
      }

      // Écarts de présence : les occurrences sans contrepartie dans au
      // moins un autre fichier. Avec ignoreDuplicates, seule l'absence
      // totale compte — la clé remonte alors toutes ses occurrences.
      for (let j = 0; j < nb; j++) {
        const e = idx[j].keys.get(k);
        if (!e) continue;
        const sd = sides[j];
        // curseur[j] pointe déjà sur la 1re occurrence non rapprochée
        let li = ignoreDuplicates ? (minC === 0 ? e.h : -1) : curseur[j];
        while (li >= 0) {
          const row = sources[j].data[li];
          row.__presence = presence;
          trace[sd].presence[li] = masque;
          bySide[sd].push(row);
          li = idx[j].next[li];
        }
        // les doublons ignorés gardent quand même leur présence tracée
        if (ignoreDuplicates && minC > 0) {
          let m = curseur[j];
          while (m >= 0) { trace[sd].presence[m] = masque; m = idx[j].next[m]; }
        }
      }
    }

    const all = [];
    for (const sd of sides) {
      bySide[sd].sort(byRowNum);
      for (const r of bySide[sd]) all.push(r);
    }
    if (cmp.length) modified.sort((x, y) => byRowNum(x.rows[sides[0]], y.rows[sides[0]]));

    const tuplesTyped = {};
    for (const sd of sides) tuplesTyped[sd] = Int32Array.from(tuples[sd]);

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
      trace,
      tuples: tuplesTyped,
      tupleDiffs,
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

    for (const [k, ea] of a.keys) {
      const eb = b.keys.get(k);
      if (!eb) continue;
      const n = Math.min(ea.c, eb.c);
      let ia = ea.h;
      let ib = eb.h;
      for (let i = 0; i < n; i++) {
        const ra = dataA[ia];
        const rb = dataB[ib];
        ra.__presence = 'A + B';
        rb.__presence = 'A + B';
        inA.push(ra);
        inB.push(rb);
        ia = a.next[ia];
        ib = b.next[ib];
      }
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
