// ============================================================
//  XLDiff — diff-engine.js
//  Moteur d'analyse : rapprochement de 2 ou 3 jeux de lignes sur
//  des colonnes-clés qui peuvent différer d'un fichier à l'autre
//  (mapping de colonnes), puis comparaison facultative du contenu
//  des lignes rapprochées.
//
//  ÉGALITÉ DES VALEURS — deux valeurs sont égales si leur forme de
//  comparaison l'est (cf. canon) : casse, accents, espaces et zéros en
//  tête ignorés, dates et nombres ramenés à une seule écriture. La
//  règle vaut pour les colonnes de rapprochement comme pour les
//  colonnes comparées ; l'affichage garde la valeur d'origine.
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
//          matched, identical, compared, trace, tuples, tupleDiffs,
//          identiques, partagees, avertissements }
//      avertissements : [{ side, col, type, n }] — colonnes de dates
//                en texte dont l'ordre jour/mois n'est pas prouvé
//                ('nonProuve', lues jour/mois) ou se contredit
//                ('contradictoire', laissées en texte), et colonnes
//                dont n valeurs sont des « ##### » ('dieses')
//
//    XLDiffEngine.diff(dataA, dataB, colsA, colsB, opts)
//      → raccourci deux fichiers sans comparaison de contenu
//        (forme historique : { onlyA, onlyB, all })
//
//  LIGNES COMMUNES — elles ne font plus l'objet d'une analyse à part
//  (l'ancienne « recherche de doublons ») : à deux fichiers, les
//  rapprochements SONT les lignes communes, occurrence par occurrence.
//    identiques : n° des rapprochements sans aucun écart sur les
//                 colonnes comparées (tous, s'il n'y en a pas),
//                 dans l'ordre des lignes du premier fichier ;
//    partagees  : à trois fichiers seulement (null sinon), les lignes
//                 dont la clé existe dans au moins un autre fichier,
//                 { bySide, all } — deux fichiers sur trois suffisent,
//                 ce qu'un rapprochement (présent PARTOUT) ne dit pas.
//
//  Chaque ligne retournée porte __rowNum (n° de ligne Excel,
//  l'en-tête étant la ligne 1), __source ('A', 'B' ou 'C') et
//  __presence (fichiers où la clé est présente, ex. « A + B »).
//  __rowNum vient du chargeur, qui connaît les lignes vides écartées
//  à la lecture ; le moteur ne le déduit PAS de la position dans le
//  tableau, qui ne dit rien de la ligne d'origine.
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
  const NBSP = /[\u00a0\u202f]/g;

  function isDate(v) {
    return Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime());
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  // ---------- Dates lues dans un classeur ----------
  // Le chargeur lit les classeurs en UTC (SheetJS 0.20, option UTC) :
  // une date Excel arrive en objet Date dont les champs UTC SONT le jour
  // et l'heure affichés par Excel, quel que soit le fuseau du poste. On
  // arrondit à la seconde, car Excel stocke 10:15 en 10:14:59,999.
  // Une heure seule (sans jour) arrive datée du 30/12/1899, le jour 0
  // d'Excel : on n'en garde que l'heure.
  function champsDate(v) {
    const d = new Date(Math.round(v.getTime() / 1000) * 1000);
    const jourZero = d.getUTCFullYear() === 1899 && d.getUTCMonth() === 11 && d.getUTCDate() >= 30;
    return {
      a: d.getUTCFullYear(), m: d.getUTCMonth() + 1, j: d.getUTCDate(),
      h: d.getUTCHours(), mi: d.getUTCMinutes(), heureSeule: jourZero,
    };
  }

  // Valeur telle qu'on l'affiche et qu'on l'exporte : celle du fichier.
  // Seules les vraies dates Excel sont mises en forme (JJ/MM/AAAA, plus
  // l'heure si elle n'est pas minuit), et les booléens écrits comme
  // Excel les affiche en français.
  function displayValue(v) {
    if (v == null) return '';
    if (isDate(v)) {
      const c = champsDate(v);
      const heure = `${pad2(c.h)}:${pad2(c.mi)}`;
      if (c.heureSeule) return heure;
      const d = `${pad2(c.j)}/${pad2(c.m)}/${c.a}`;
      return c.h || c.mi ? `${d} ${heure}` : d;
    }
    if (v === true) return 'VRAI';
    if (v === false) return 'FAUX';
    return String(v);
  }

  // ---------- Forme de comparaison ----------
  // L'écran et les exports montrent toujours la valeur d'origine ; la
  // forme de comparaison sert seulement à décider si deux valeurs sont
  // égales, dans les colonnes de rapprochement comme dans les colonnes
  // comparées. Elle unifie :
  //   • les dates : vraie date Excel, 03/09/2020, 3/9/20, 2020-09-03,
  //     avec ou sans heure → « 2020-09-03 », heure comparée à la minute ;
  //   • les nombres : 123, « 00123 », « 0,5 », « 1 234,50 », « 50 % » —
  //     les zéros en tête ne comptent pas ; au-delà de 15 chiffres, un
  //     identifiant reste du texte, pour n'être jamais arrondi ;
  //   • le texte : casse, accents, espaces (insécables compris),
  //     apostrophes typographiques.
  // L'ordre jour/mois des dates en texte et le séparateur décimal se
  // décident PAR COLONNE, sur la preuve portée par la colonne entière,
  // jamais valeur par valeur : cf. profilColonne().

  // 03/09/2020, 3/9/20, 03.09.2020, 03-09-2020, avec heure facultative.
  // Deux chiffres d'année seulement avec « / » : « 1.2.10 » n'est pas une date.
  const RE_JMA = /^(\d{1,2})([/.-])(\d{1,2})\2(\d{4}|\d{2})(?:[ T]+(\d{1,2})[:h](\d{2})(?::(\d{2})(?:[.,]\d+)?)?)?$/;
  const RE_ISO = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?Z?)?$/;
  function lireJMA(s) {
    const m = RE_JMA.exec(s);
    return m && (m[2] === '/' || m[4].length === 4) ? m : null;
  }
  const RE_HEURE = /^(\d{1,2})[:h](\d{2})(?::(\d{2})(?:[.,]\d+)?)?$/;
  const RE_CHIFFRES = /^\d+$/;
  // Milliers à l'espace : 1 234 ou 1 234 567,89
  const RE_MILLIERS_ESPACE = /^[+-]?\d{1,3}(?: \d{3})+(?:[.,]\d+)?$/;
  const RE_NOMBRE = /^[+-]?\d[\d.,]*(?:[eE][+-]?\d+)?$/;

  const JOURS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  function joursDuMois(a, m) {
    return m === 2 && ((a % 4 === 0 && a % 100 !== 0) || a % 400 === 0) ? 29 : JOURS[m - 1];
  }

  function formeDate(a, m, j, h, mi) {
    if (m < 1 || m > 12 || j < 1 || j > joursDuMois(a, m)) return null;
    if (h > 23 || mi > 59) return null;
    const jour = `${a}-${pad2(m)}-${pad2(j)}`;
    return h || mi ? `${jour} ${pad2(h)}:${pad2(mi)}` : jour;
  }

  // Deux chiffres d'année : la règle d'Excel (00-29 → 2000, 30-99 → 1900)
  function annee(s) {
    const n = +s;
    return s.length === 2 ? (n < 30 ? 2000 + n : 1900 + n) : n;
  }

  // Nombre → forme stable : 15 chiffres significatifs, comme Excel, ce
  // qui efface les restes de calcul flottant (0,1 + 0,2).
  function formeNombre(n) {
    if (!isFinite(n)) return String(n);
    const r = Number(n.toPrecision(15));
    return String(r === 0 ? 0 : r);
  }

  // Texte d'un nombre, selon le séparateur décimal de la colonne
  // (',' ou '.'), null si la colonne se contredit. Rend null si le
  // texte n'est pas un nombre.
  function lireNombre(s, decimale) {
    let t = s;
    let facteur = 1;
    if (t.endsWith('%')) { t = t.slice(0, -1).trimEnd(); facteur = 100; }
    if (t.includes(' ')) {
      if (!RE_MILLIERS_ESPACE.test(t)) return null;
      t = t.replace(/ /g, '');
    }
    if (!RE_NOMBRE.test(t)) return null;
    const aVirgule = t.includes(',');
    const aPoint = t.includes('.');
    if (aVirgule || aPoint) {
      if (!decimale) return null;
      const milliers = decimale === ',' ? '.' : ',';
      if (t.includes(milliers)) {
        const re = decimale === ','
          ? /^[+-]?\d{1,3}(?:\.\d{3})+(?:,\d+)?(?:[eE][+-]?\d+)?$/
          : /^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
        if (!re.test(t)) return null;
        t = t.split(milliers).join('');
      }
      const parts = t.split(decimale);
      if (parts.length > 2) return null;
      t = parts.join('.');
    }
    const n = Number(t);
    return isNaN(n) ? null : n / facteur;
  }

  // Le cas courant, du texte sans accent ni signe typographique, évite
  // la décomposition Unicode : c'est elle qui coûte sur 200 000 lignes.
  // toLowerCase() suffit : seuls le turc et le lituanien ont une casse
  // propre à la langue.
  const RE_ASCII = /^[\x20-\x5f\x61-\x7e]*$/;
  function formeTexte(s) {
    if (RE_ASCII.test(s)) return s.toLowerCase();
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
      .replace(/[\u2018\u2019\u02bc\u00b4`]/g, "'");
  }

  const PROFIL_DEFAUT = { ordre: 'JMA', decimale: ',' };

  // Forme de comparaison d'une valeur. `profil` porte les décisions
  // prises sur sa colonne : ordre des dates en texte ('JMA', 'MJA', ou
  // null si la colonne se contredit) et séparateur décimal.
  function canon(v, profil) {
    if (typeof v === 'string' && profil && profil.memo) {
      let f = profil.memo.get(v);
      if (f === undefined) {
        f = canonBrut(v, profil);
        if (profil.memo.size < MEMO_MAX) profil.memo.set(v, f);
      }
      return f;
    }
    return canonBrut(v, profil);
  }

  // Mémoire des formes déjà calculées, par colonne : dans un vrai fichier
  // les mêmes dates, noms ou communes reviennent sans cesse. Plafonnée,
  // pour ne pas garder 200 000 identifiants tous différents.
  const MEMO_MAX = 50000;

  function canonBrut(v, profil) {
    if (v == null) return '';
    if (typeof v === 'number') return formeNombre(v);
    if (v === true) return 'vrai';
    if (v === false) return 'faux';
    if (isDate(v)) {
      const c = champsDate(v);
      if (c.heureSeule) return `${pad2(c.h)}:${pad2(c.mi)}`;
      return formeDate(c.a, c.m, c.j, c.h, c.mi);
    }
    const s = String(v).replace(NBSP, ' ').replace(/\s+/g, ' ').trim();
    if (!s) return '';
    const p = profil || PROFIL_DEFAUT;
    const c0 = s.charCodeAt(0);
    if ((c0 >= 48 && c0 <= 57) || c0 === 43 || c0 === 45) {
      // Identifiant : les zéros en tête ne comptent pas. Au-delà de
      // 15 chiffres, pas de passage par un nombre, qui arrondirait.
      if (RE_CHIFFRES.test(s)) {
        if (s.length > 15) return s.replace(/^0+(?=\d)/, '');
        return String(Number(s));
      }
      let m = lireJMA(s);
      if (m && p.ordre) {
        const x = +m[1], y = +m[3];
        const [j, mo] = p.ordre === 'MJA' ? [y, x] : [x, y];
        const f = formeDate(annee(m[4]), mo, j, +(m[5] || 0), +(m[6] || 0));
        if (f) return f;
      }
      m = RE_ISO.exec(s);
      if (m) {
        const f = formeDate(+m[1], +m[2], +m[3], +(m[4] || 0), +(m[5] || 0));
        if (f) return f;
      }
      m = RE_HEURE.exec(s);
      if (m && +m[1] < 24 && +m[2] < 60) return `${pad2(+m[1])}:${m[2]}`;
      const n = lireNombre(s, p.decimale);
      if (n != null) return formeNombre(n);
    }
    const t = formeTexte(s);
    if (t === 'true') return 'vrai';
    if (t === 'false') return 'faux';
    return t;
  }

  // Compatibilité : forme de comparaison sans profil de colonne
  function normCell(v) { return canon(v, null); }

  // Profil d'une colonne d'un fichier, établi sur TOUTES ses valeurs :
  //   ordre  : une date en texte dont le 1er nombre dépasse 12 prouve
  //            l'ordre jour/mois, le 2e nombre l'ordre mois/jour. Des
  //            preuves contradictoires → null : les dates restent du
  //            texte. Aucune preuve → jour/mois, et `nonProuve` le dit ;
  //   decimale : « 0,5 » ou « 1.234,5 » prouvent la virgule, « 12.5 »
  //            ou « 1,234.5 » le point ; « 1,234 » seul ne prouve rien
  //            (3 chiffres après : milliers ou décimales ?). Aucune
  //            preuve → la virgule ; contradiction → null, et seuls les
  //            nombres sans séparateur sont reconnus ;
  //   dieses : valeurs écrites « ##### » — un export HTML d'Excel écrit
  //            ce qu'il affiche, et une colonne trop étroite n'affiche
  //            que des dièses. La vraie valeur est perdue.
  function profilColonne(data, col) {
    let jma = 0, mja = 0, ambigues = 0;
    let virgule = 0, point = 0;
    let dieses = 0;
    for (let i = 0; i < data.length; i++) {
      const v = data[i][col];
      if (typeof v !== 'string') continue;
      // Tri rapide sur le 1er caractère, avant tout nettoyage : un texte
      // qui commence par une lettre ne prouve rien
      const b = v.charCodeAt(0);
      if (!((b >= 48 && b <= 57) || b === 43 || b === 45 || b === 35 || b === 32 || b === 160 || b === 8239)) continue;
      const s = b === 32 || b === 160 || b === 8239 ? v.replace(NBSP, ' ').trim() : v;
      const c0 = s.charCodeAt(0);
      if (c0 === 35 && /^#{3,}$/.test(s)) { dieses++; continue; }
      if (!((c0 >= 48 && c0 <= 57) || c0 === 43 || c0 === 45)) continue;
      if (RE_CHIFFRES.test(s)) continue; // des chiffres seuls ne prouvent rien
      const m = lireJMA(s);
      if (m) {
        const x = +m[1], y = +m[3];
        if (x > 12 && y <= 12) jma++;
        else if (y > 12 && x <= 12) mja++;
        else if (x <= 12 && y <= 12) ambigues++;
        continue;
      }
      const t = s.replace(/%$/, '').trimEnd().replace(/ /g, '');
      if (!RE_NOMBRE.test(t)) continue;
      const pv = t.lastIndexOf(','), pp = t.lastIndexOf('.');
      if (pv >= 0 && pp >= 0) {
        if (pv > pp) virgule++; else point++;
      } else if (pv >= 0 || pp >= 0) {
        const sep = pv >= 0 ? ',' : '.';
        const morceaux = t.replace(/[eE][+-]?\d+$/, '').split(sep);
        if (morceaux.length > 2) { if (sep === ',') point++; else virgule++; }
        else if (morceaux[1].length !== 3) { if (sep === ',') virgule++; else point++; }
      }
    }
    return {
      ordre: jma && mja ? null : (mja ? 'MJA' : 'JMA'),
      nonProuve: !jma && !mja && ambigues > 0,
      contradictoire: !!(jma && mja),
      decimale: virgule && point ? null : (point ? '.' : ','),
      dieses,
      memo: new Map(),
    };
  }

  function makeKey(row, cols, profils) {
    let k = '';
    for (let i = 0; i < cols.length; i++) {
      if (i) k += SEP;
      k += canon(row[cols[i]], profils ? profils[i] : null);
    }
    return k;
  }

  // Index d'un fichier : une entrée par clé DISTINCTE ({ c, h, t }
  // = nombre d'occurrences, 1re ligne, dernière ligne) et un chaînage
  // des occurrences suivantes dans un seul Int32Array — bien plus
  // léger qu'un tableau de lignes par clé quand il y a 200 000 clés.
  function indexRows(data, cols, side, profils) {
    const n = data.length;
    const keys = new Map();
    const next = new Int32Array(n).fill(-1);
    for (let i = 0; i < n; i++) {
      const row = data[i];
      // Le chargeur a déjà posé le vrai numéro de ligne Excel, lignes
      // vides du fichier comprises. Le repli i + 2 ne sert qu'aux appels
      // directs du moteur, sur des lignes construites à la main.
      if (row.__rowNum == null) row.__rowNum = i + 2;
      row.__source = side;
      const k = makeKey(row, cols, profils);
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

    // Un profil par colonne utilisée de chaque fichier, établi une fois
    // sur toute la colonne (cf. profilColonne). Les colonnes de dates
    // dont l'ordre jour/mois n'est pas prouvé, ou se contredit, sont
    // signalées : la comparaison ne décide rien en silence.
    const avertissements = [];
    const profils = sources.map(s => {
      const parCol = new Map();
      const profil = col => {
        if (col == null) return null;
        if (!parCol.has(col)) {
          const p = profilColonne(s.data, col);
          parCol.set(col, p);
          if (p.nonProuve || p.contradictoire) {
            avertissements.push({ side: s.side, col, type: p.contradictoire ? 'contradictoire' : 'nonProuve' });
          }
          if (p.dieses) avertissements.push({ side: s.side, col, type: 'dieses', n: p.dieses });
        }
        return parCol.get(col);
      };
      return {
        cles: s.cols.map(profil),
        cmp: cmp.map(c => profil(c.cols[s.side])),
      };
    });
    const idx = sources.map((s, j) => indexRows(s.data, s.cols, s.side, profils[j].cles));

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

    // Lignes présentes dans au moins deux fichiers : n'a de sens propre
    // qu'à trois fichiers (à deux, ce sont exactement les rapprochements)
    const partagees = nb > 2 ? { bySide: {}, all: [] } : null;
    if (partagees) sides.forEach(sd => { partagees.bySide[sd] = []; });
    const compte = new Int32Array(nb);

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
        compte[j] = c;
        if (c < minC) minC = c;
        if (c > 0) masque |= (1 << j);
        curseur[j] = e ? e.h : -1;
      }
      const presence = sides.filter((sd, j) => (masque >> j) & 1).join(' + ');

      // Lignes partagées (trois fichiers) : dès que la clé existe dans
      // au moins deux fichiers. Les occurrences retenues d'un fichier
      // sont plafonnées au plus grand nombre d'occurrences trouvé
      // ailleurs — 3 fois dans A, 1 fois dans B, 2 fois dans C : 2
      // lignes côté A. À deux fichiers, la règle retombe sur min(cA, cB),
      // c'est-à-dire exactement les rapprochements.
      if (partagees && (masque & (masque - 1))) {
        for (let j = 0; j < nb; j++) {
          if (!compte[j]) continue;
          let maxAutres = 0;
          for (let i = 0; i < nb; i++) {
            if (i !== j && compte[i] > maxAutres) maxAutres = compte[i];
          }
          let li = curseur[j];
          for (let n = Math.min(compte[j], maxAutres); n > 0; n--) {
            const row = sources[j].data[li];
            row.__presence = presence;
            partagees.bySide[sides[j]].push(row);
            li = idx[j].next[li];
          }
        }
      }

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
        for (let ci = 0; ci < cmp.length; ci++) {
          const col = cmp[ci];
          const values = {};
          let ref = null;
          let differs = false;
          for (let j = 0; j < nb; j++) {
            const sd = sides[j];
            const c = col.cols[sd];
            const raw = c == null ? '' : rows[sd][c];
            values[sd] = raw;
            const n = canon(raw, profils[j].cmp[ci]);
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

    // Rapprochements sans écart, rangés dans l'ordre du premier fichier.
    // Un tableau d'entiers et pas d'objets : sans colonne comparée, ce
    // sont TOUS les rapprochements, soit 200 000 sur un gros fichier ;
    // l'affichage retrouve les lignes à la demande via `tuples`.
    const premier = tuplesTyped[sides[0]];
    const identiques = new Int32Array(matched - modified.length);
    for (let t = 0, n = 0; t < matched; t++) if (!tupleDiffs.has(t)) identiques[n++] = t;
    identiques.sort((x, y) => premier[x] - premier[y]);

    if (partagees) {
      for (const sd of sides) {
        partagees.bySide[sd].sort(byRowNum);
        for (const r of partagees.bySide[sd]) partagees.all.push(r);
      }
    }

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
      identiques,
      partagees,
      avertissements,
    };
  }

  // ---------- Raccourci historique : deux fichiers, contenu non comparé ----------

  function diff(dataA, dataB, colsA, colsB, opts) {
    return analyze([
      { side: 'A', data: dataA, cols: colsA },
      { side: 'B', data: dataB, cols: colsB },
    ], [], opts);
  }

  return { analyze, diff, displayValue, normCell, canon, profilColonne };
})();
