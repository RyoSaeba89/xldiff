// ============================================================
//  XLDiff — results-view.js
//  Rendu des résultats : résumé en phrases simples, onglets,
//  tableau virtualisé et exports .xlsx.
//
//  Deux modes d'affichage :
//    'diff'  (défaut) — comparaison : différences entre fichiers
//    'dupes'          — recherche de doublons : lignes communes à
//                       deux fichiers, ou à au moins deux des trois
//
//  Deux natures de résultat en mode 'diff' :
//    • écarts de présence — une ligne d'un fichier sans
//      contrepartie dans un autre (un onglet par fichier) ;
//    • lignes retrouvées mais différentes — une ligne retrouvée
//      dans tous les fichiers, mais dont une colonne comparée
//      diverge (un onglet, une ligne de tableau par rapprochement).
//
//  AFFICHAGE VIRTUALISÉ : seules les lignes visibles existent dans
//  le DOM, encadrées par deux cales qui reproduisent la hauteur du
//  reste. Sans ça, 200 000 lignes de résultat coûtent ~5 Go de
//  mémoire au navigateur ; avec, le coût ne dépend plus du volume.
//
//  Les colonnes affichées sont décrites par des objets
//  { label, cols: { A, B, C }, role } : pour une ligne issue de A
//  on lit row[cols.A] (null = colonne absente de ce fichier →
//  cellule vide). role vaut 'key', 'cmp' ou 'other'.
//
//  API : XLDiffResults.init()
//        XLDiffResults.show({ diff, columns, totals, mode, sources })
//        XLDiffResults.setColumns(columns)
//        XLDiffResults.exportResults()
//        XLDiffResults.exportAnnotated()   (mode 'diff' seulement)
// ============================================================

const XLDiffResults = (() => {
  const $ = id => document.getElementById(id);
  const MARGE = 12;        // lignes rendues au-delà de la zone visible
  const HAUTEUR_DEFAUT = 30;
  let dom = null;
  let state = null; // { diff, columns, totals, sides, mode, activeTab, vue, sources }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escAttr(s) {
    return String(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function fmt(n) { return `<strong>${n.toLocaleString('fr-FR')}</strong>`; }
  function num(n) { return n.toLocaleString('fr-FR'); }
  function plur(n) { return n > 1 ? 's' : ''; }
  function val(v) { return XLDiffEngine.displayValue(v); }

  // Énumération à la française : « A et B », « A, B et C »
  function joinFr(list) {
    if (list.length <= 1) return list.join('');
    return list.slice(0, -1).join(', ') + ' et ' + list[list.length - 1];
  }

  function cellValue(row, col) {
    const c = col.cols[row.__source];
    if (c == null) return '';
    return val(row[c]);
  }

  function init() {
    dom = {
      results: $('results'),
      summaryBox: $('summaryBox'),
      tabsBar: $('tabsBar'),
      thead: $('thead'),
      tbody: $('tbody'),
      wrapper: $('tableWrapper'),
    };
    const btnRestart = $('btnRestart');
    if (btnRestart) btnRestart.addEventListener('click', () => location.reload());
    // Un seul écouteur pour toute la vie de la page : le défilement
    // redessine la fenêtre de lignes visibles.
    if (dom.wrapper) {
      let enAttente = false;
      dom.wrapper.addEventListener('scroll', () => {
        if (enAttente) return;
        enAttente = true;
        requestAnimationFrame(() => { enAttente = false; dessiner(false); });
      });
    }
    window.addEventListener('resize', () => dessiner(true));
  }

  function show({ diff, columns, totals, mode, sources }) {
    state = {
      diff,
      columns,
      totals: totals || {},
      sides: diff.sides || ['A', 'B'],
      mode: mode || 'diff',
      sources: sources || null,
      activeTab: 'all',
      vue: null,
    };
    render();
  }

  function setColumns(columns) {
    if (!state) return;
    state.columns = columns;
    render();
  }

  // ---------- Résumé en phrases simples ----------

  function renderSummary() {
    const { diff, totals, sides, mode } = state;
    const three = sides.length > 2;
    let headline = '';
    let headlineOk = false;
    const lines = [];

    if (mode === 'dupes') {
      // À deux fichiers, une correspondance = une ligne de A et une ligne
      // de B : on annonce le nombre de correspondances. À trois fichiers,
      // une ligne peut être en double avec l'un, l'autre ou les deux :
      // on annonce le nombre de lignes listées, tous fichiers confondus.
      const nTotal = diff.all.length;
      if (nTotal === 0) {
        headline = three
          ? 'Aucun doublon : aucune ligne n\'est présente dans plus d\'un fichier.'
          : 'Aucun doublon : aucune ligne n\'est présente à la fois dans les deux fichiers.';
        headlineOk = true;
      } else if (three) {
        headline = `Il y a ${fmt(nTotal)} ligne${plur(nTotal)} en double, présente${plur(nTotal)} dans au moins deux des trois fichiers.`;
      } else {
        const n = diff.onlyA.length; // nombre de correspondances A ↔ B
        headline = `Il y a ${fmt(n)} ligne${plur(n)} en double, présente${plur(n)} à la fois dans A et dans B.`;
      }
      sides.forEach(sd => {
        const n = diff.bySide[sd].length;
        const t = totals[sd] || 0;
        lines.push({
          cls: 'sum-' + sd.toLowerCase(),
          html: three
            ? `Le fichier ${sd} contient ${fmt(t)} ligne${plur(t)}, dont ${fmt(n)} en double avec un autre fichier et ${fmt(t - n)} sans équivalent ailleurs.`
            : `Le fichier ${sd} contient ${fmt(t)} ligne${plur(t)}, dont ${fmt(t - n)} sans équivalent dans ${sides.filter(o => o !== sd)[0]}.`,
        });
      });
    } else {
      const nAbs = diff.all.length;
      const nMod = diff.modified.length;

      if (nAbs === 0 && nMod === 0) {
        headline = three
          ? 'Aucune différence : les trois fichiers contiennent exactement les mêmes lignes.'
          : 'Aucune différence : les deux fichiers contiennent exactement les mêmes lignes.';
        headlineOk = true;
      } else if (nAbs === 0) {
        headline = `Il y a ${fmt(nMod)} ligne${plur(nMod)} retrouvée${plur(nMod)} dans tous les fichiers mais dont le contenu diffère.`;
      } else {
        headline = `Il y a ${fmt(nAbs)} différence${plur(nAbs)} entre les fichiers.`;
      }

      // Lignes retrouvées dans tous les fichiers
      if (diff.compared) {
        lines.push({
          cls: 'sum-eq',
          html: `Il y a ${fmt(diff.matched)} ligne${plur(diff.matched)} retrouvée${plur(diff.matched)} dans ${three ? 'les trois' : 'les deux'} fichiers : ` +
            `${fmt(diff.identical)} à l'identique, ${fmt(nMod)} dont le contenu diffère sur les colonnes comparées.`,
        });
      } else {
        lines.push({
          cls: 'sum-eq',
          html: `Il y a ${fmt(diff.matched)} ligne${plur(diff.matched)} identique${plur(diff.matched)} entre ${joinFr(sides)}.`,
        });
      }

      // Écarts de présence, un point par fichier
      sides.forEach(sd => {
        const n = diff.bySide[sd].length;
        if (!n) return;
        const others = sides.filter(o => o !== sd);
        lines.push({
          cls: 'sum-' + sd.toLowerCase(),
          html: three
            ? `Il y a ${fmt(n)} ligne${plur(n)} du fichier ${sd} absente${plur(n)} d'au moins un autre fichier (${joinFr(others)}).`
            : `Il y a ${fmt(n)} ligne${plur(n)} uniquement dans ${sd} (absente${plur(n)} de ${others[0]}).`,
        });
      });

      // Volumétrie
      if (three) {
        lines.push({
          cls: 'sum-n',
          html: 'Nombre de lignes : ' + sides.map(sd => `fichier ${sd} ${fmt(totals[sd])}`).join(', ') + '.',
        });
      } else {
        const delta = totals.B - totals.A;
        if (delta === 0) {
          lines.push({ cls: 'sum-n', html: `Les deux fichiers ont le même nombre de lignes (${fmt(totals.A)}).` });
        } else {
          const sens = delta > 0 ? 'de plus' : 'de moins';
          const abs = Math.abs(delta);
          lines.push({ cls: 'sum-n', html: `Il y a une différence de ${fmt(abs)} ligne${plur(abs)} : le fichier B en contient ${num(abs)} ${sens} que le fichier A (A : ${num(totals.A)}, B : ${num(totals.B)}).` });
        }
      }
    }

    dom.summaryBox.innerHTML =
      `<div class="summary-headline${headlineOk ? ' ok' : ''}">${headlineOk ? '✓ ' : ''}${headline}</div>` +
      `<ul class="summary-lines">${lines.map(l => `<li class="${l.cls}">${l.html}</li>`).join('')}</ul>`;
  }

  // ---------- Onglets ----------

  function buildTabs() {
    const { diff, sides, mode } = state;
    const three = sides.length > 2;

    if (mode === 'dupes') {
      const tabs = [{ id: 'all', label: 'Tous les doublons', count: diff.all.length }];
      sides.forEach(sd => {
        tabs.push({ id: 'only' + sd, label: `Doublons côté ${sd}`, count: diff.bySide[sd].length });
      });
      return tabs;
    }

    const tabs = [{ id: 'all', label: 'Toutes les différences', count: diff.all.length }];
    if (diff.compared) {
      tabs.push({ id: 'modified', label: 'Retrouvées mais différentes', count: diff.modified.length });
    }
    sides.forEach(sd => {
      tabs.push({
        id: 'only' + sd,
        label: three ? `${sd}, absentes ailleurs` : `Uniquement ${sd}`,
        count: diff.bySide[sd].length,
      });
    });
    return tabs;
  }

  // ---------- Rendu principal ----------

  function render() {
    const { activeTab } = state;
    dom.results.classList.add('visible');

    renderSummary();

    const tabs = buildTabs();
    if (!tabs.some(t => t.id === activeTab)) state.activeTab = 'all';
    dom.tabsBar.innerHTML = '';
    tabs.forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'tab-btn' + (t.id === state.activeTab ? ' active' : '');
      btn.innerHTML = `${t.label} <span class="tab-count">${num(t.count)}</span>`;
      btn.addEventListener('click', () => { state.activeTab = t.id; render(); });
      dom.tabsBar.appendChild(btn);
    });

    if (dom.wrapper) dom.wrapper.scrollTop = 0;
    if (state.activeTab === 'modified') prepareModified();
    else prepareRows();
  }

  // ---------- Virtualisation ----------

  // total    : nombre de lignes du tableau
  // htmlLigne: (i) → chaîne '<tr>…</tr>' de la i-ème ligne
  function monter(total, htmlLigne, colspan, messageVide) {
    if (total === 0) {
      state.vue = null;
      dom.tbody.innerHTML = `<tr><td colspan="${colspan}" class="empty-state">${messageVide}</td></tr>`;
      return;
    }
    state.vue = { total, htmlLigne, colspan, hauteur: 0, debut: -1, fin: -1 };
    dessiner(true);
  }

  function dessiner(force) {
    const v = state && state.vue;
    if (!v) return;

    if (!v.hauteur) {
      // Mesure sur une vraie ligne : la hauteur dépend du thème et du zoom
      dom.tbody.innerHTML = v.htmlLigne(0);
      const tr = dom.tbody.firstElementChild;
      v.hauteur = (tr && tr.offsetHeight) || HAUTEUR_DEFAUT;
    }

    const wrap = dom.wrapper;
    const visible = Math.ceil((wrap ? wrap.clientHeight : 600) / v.hauteur);
    const debut = Math.max(0, Math.floor((wrap ? wrap.scrollTop : 0) / v.hauteur) - MARGE);
    const fin = Math.min(v.total, debut + visible + 2 * MARGE);
    if (!force && debut === v.debut && fin === v.fin) return;
    v.debut = debut;
    v.fin = fin;

    const cale = h => `<tr class="v-cale"><td colspan="${v.colspan}" style="height:${h}px"></td></tr>`;
    let html = debut > 0 ? cale(debut * v.hauteur) : '';
    for (let i = debut; i < fin; i++) html += v.htmlLigne(i);
    if (fin < v.total) html += cale((v.total - fin) * v.hauteur);
    dom.tbody.innerHTML = html;
  }

  // ---------- Écarts de présence : une ligne source par ligne de tableau ----------

  function prepareRows() {
    const { diff, columns, sides, mode, activeTab } = state;
    const three = sides.length > 2;
    const rows = activeTab === 'all' ? diff.all : diff.bySide[activeTab.slice(4)];

    dom.thead.innerHTML = '<tr><th>Ligne</th><th>Source</th>' +
      (three ? '<th>Présente dans</th>' : '') +
      columns.map(c => `<th>${esc(c.label)}</th>`).join('') + '</tr>';

    const colspan = columns.length + (three ? 3 : 2);
    monter(rows.length, i => {
      const row = rows[i];
      const sd = row.__source;
      const bas = sd.toLowerCase();
      let html = `<tr class="row-${bas}"><td class="row-num">${row.__rowNum || ''}</td>` +
        `<td><span class="source-tag src-${bas}">${sd}</span></td>`;
      if (three) html += `<td class="presence">${esc(row.__presence || sd)}</td>`;
      for (const col of columns) {
        const v = cellValue(row, col);
        html += `<td title="${escAttr(v)}">${esc(v)}</td>`;
      }
      return html + '</tr>';
    }, colspan, mode === 'dupes' ? 'Aucun doublon dans cette catégorie' : 'Aucune différence dans cette catégorie');
  }

  // ---------- Lignes retrouvées mais différentes ----------

  function prepareModified() {
    const { diff, columns, sides } = state;

    dom.thead.innerHTML = '<tr><th>Lignes</th>' +
      columns.map(c => `<th>${esc(c.label)}</th>`).join('') + '</tr>';

    monter(diff.modified.length, i => {
      const pair = diff.modified[i];
      const byLabel = new Map(pair.diffs.map(d => [d.label, d]));
      const ref = sides.map(sd => `${sd}${pair.rows[sd].__rowNum || ''}`).join(' / ');
      let html = `<tr class="row-diff"><td class="row-num">${esc(ref)}</td>`;

      for (const col of columns) {
        const d = byLabel.get(col.label);
        if (d) {
          const parts = sides.map(sd => `<span class="v-${sd.toLowerCase()}">${esc(val(d.values[sd]))}</span>`);
          const plain = sides.map(sd => val(d.values[sd])).join(' → ');
          html += `<td class="cell-diff" title="${escAttr(plain)}">${parts.join('<span class="v-arrow"> → </span>')}</td>`;
        } else {
          let v = '';
          for (const sd of sides) {
            const c = col.cols[sd];
            if (c != null) { v = val(pair.rows[sd][c]); break; }
          }
          html += `<td title="${escAttr(v)}">${esc(v)}</td>`;
        }
      }
      return html + '</tr>';
    }, columns.length + 1,
      'Aucun écart de contenu : toutes les lignes retrouvées sont identiques sur les colonnes comparées.');
  }

  // ---------- Export .xlsx ----------

  function horodatage() {
    const ts = new Date();
    return `${ts.getFullYear()}${pad2(ts.getMonth() + 1)}${pad2(ts.getDate())}_${pad2(ts.getHours())}${pad2(ts.getMinutes())}`;
  }

  // Les feuilles sont construites en tableaux de tableaux : à volume
  // égal, c'est nettement plus léger que des objets, et l'écriture est
  // compressée (fichier ~3 fois plus petit).
  function ecrire(wb, nomFichier) {
    XLSX.writeFile(wb, nomFichier, { compression: true });
  }

  function exportResults() {
    if (!state) return;
    const { diff, columns, sides, mode } = state;
    const three = sides.length > 2;
    const wb = XLSX.utils.book_new();

    // Une seule feuille pour les écarts de présence : la colonne Source
    // permet de filtrer dans Excel, alors qu'une feuille par fichier
    // réécrivait les mêmes lignes une seconde fois.
    const entete = ['Ligne', 'Source'];
    if (three) entete.push('Présente dans');
    for (const col of columns) entete.push(col.label);

    const aoa = [entete];
    for (const r of diff.all) {
      const ligne = [r.__rowNum || '', r.__source || ''];
      if (three) ligne.push(r.__presence || r.__source || '');
      for (const col of columns) ligne.push(cellValue(r, col));
      aoa.push(ligne);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa),
      mode === 'dupes' ? 'Tous les doublons' : 'Toutes différences');

    // Lignes retrouvées mais différentes : une colonne par fichier pour
    // les colonnes comparées, afin que le résultat reste retraitable
    if (diff.compared && diff.modified.length) {
      const enteteMod = sides.map(sd => `Ligne ${sd}`);
      for (const col of columns) {
        if (col.role === 'cmp') for (const sd of sides) enteteMod.push(`${col.label} (${sd})`);
        else enteteMod.push(col.label);
      }
      enteteMod.push('Colonnes en écart');

      const aoaMod = [enteteMod];
      for (const p of diff.modified) {
        const ligne = sides.map(sd => p.rows[sd].__rowNum || '');
        for (const col of columns) {
          if (col.role === 'cmp') {
            for (const sd of sides) {
              const c = col.cols[sd];
              ligne.push(c == null ? '' : val(p.rows[sd][c]));
            }
          } else {
            let v = '';
            for (const sd of sides) {
              const c = col.cols[sd];
              if (c != null) { v = val(p.rows[sd][c]); break; }
            }
            ligne.push(v);
          }
        }
        ligne.push(p.diffs.map(d => d.label).join(', '));
        aoaMod.push(ligne);
      }
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoaMod), 'Retrouvées mais différentes');
    }

    ecrire(wb, `${mode === 'dupes' ? 'xldiff_doublons' : 'xldiff'}_${horodatage()}.xlsx`);
  }

  // ---------- Export du fichier A annoté ----------

  // Reprend le fichier A tel quel — toutes ses lignes, toutes ses
  // colonnes, dans l'ordre d'origine — et ajoute à droite le verdict de
  // l'analyse. Les lignes venues de B ou C et absentes de A sont
  // ajoutées à la suite.
  function statutLigne(sides, masque, tuple, aDesEcarts, sd) {
    if (tuple >= 0) {
      if (aDesEcarts) return 'Écart de contenu';
      return sides.length > 2 ? 'Identique partout' : 'Identique';
    }
    const manquants = sides.filter((o, j) => !((masque >> j) & 1));
    if (manquants.length) return 'Absente de ' + joinFr(manquants);
    return `Occurrence en trop dans ${sd}`;
  }

  function exportAnnotated() {
    if (!state || !state.sources || state.mode !== 'diff') return;
    const { diff, columns, sides, sources } = state;
    const sideA = sides[0];
    const autres = sides.slice(1);
    const srcA = sources[sideA];
    const cmpCols = columns.filter(c => c.role === 'cmp');

    // Nom des colonnes ajoutées : on prend le nom porté par le fichier A
    const nomCmp = col => col.cols[sideA] || col.label;

    const entete = srcA.headers.slice();
    entete.push('Statut', 'Présente dans');
    if (cmpCols.length) entete.push('Colonnes en écart');
    for (const col of cmpCols) for (const sd of autres) entete.push(`${nomCmp(col)} (${sd})`);
    entete.push('Ligne d\'origine');

    const aoa = [entete];
    const presenceTexte = masque => sides.filter((sd, j) => (masque >> j) & 1).join(' + ');

    // 1) toutes les lignes du fichier A, dans leur ordre d'origine
    const trA = diff.trace[sideA];
    for (let i = 0; i < srcA.data.length; i++) {
      const row = srcA.data[i];
      const t = trA.tuple[i];
      const ecarts = t >= 0 ? diff.tupleDiffs.get(t) : null;
      const ligne = srcA.headers.map(h => val(row[h]));
      ligne.push(statutLigne(sides, trA.presence[i], t, !!ecarts, sideA));
      ligne.push(presenceTexte(trA.presence[i]) || sideA);
      if (cmpCols.length) {
        ligne.push(ecarts ? ecarts.map(d => {
          const col = cmpCols.find(c => c.label === d.label);
          return col ? nomCmp(col) : d.label;
        }).join(', ') : '');
      }
      for (const col of cmpCols) {
        for (const sd of autres) {
          if (t < 0) { ligne.push(''); continue; }
          const c = col.cols[sd];
          const autreRow = sources[sd].data[diff.tuples[sd][t]];
          ligne.push(c == null ? '' : val(autreRow[c]));
        }
      }
      ligne.push(sideA + (row.__rowNum || i + 2));
      aoa.push(ligne);
    }

    // 2) à la suite, les lignes de B et C qui n'ont pas été rapprochées
    const posA = new Map(srcA.headers.map((h, i) => [h, i]));
    for (const sd of autres) {
      for (const row of diff.bySide[sd]) {
        const ligne = new Array(srcA.headers.length).fill('');
        // Seules les colonnes de rapprochement sont reportees : elles
        // identifient la ligne. Recopier une valeur comparee de B dans la
        // colonne de A la ferait passer pour une valeur du fichier A ;
        // elle figure de toute facon dans sa propre colonne « (B) ».
        for (const col of columns) {
          if (col.role !== 'key') continue;
          const nomA = col.cols[sideA];
          const nomAutre = col.cols[sd];
          if (nomA == null || nomAutre == null) continue;
          const p = posA.get(nomA);
          if (p !== undefined) ligne[p] = val(row[nomAutre]);
        }
        const masque = diff.trace[sd].presence[(row.__rowNum || 2) - 2];
        ligne.push(statutLigne(sides, masque, -1, false, sd));
        ligne.push(row.__presence || sd);
        if (cmpCols.length) ligne.push('');
        for (const col of cmpCols) {
          for (const autre of autres) {
            const c = col.cols[autre];
            ligne.push(autre === sd && c != null ? val(row[c]) : '');
          }
        }
        ligne.push(sd + (row.__rowNum || ''));
        aoa.push(ligne);
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Fichier A annoté');
    ecrire(wb, `xldiff_fichierA_annote_${horodatage()}.xlsx`);
  }

  return { init, show, setColumns, exportResults, exportAnnotated };
})();
