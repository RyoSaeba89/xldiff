// ============================================================
//  XLDiff — results-view.js
//  Rendu des résultats : résumé en phrases simples, onglets,
//  tableau (rendu par blocs) et export .xlsx.
//
//  Deux modes d'affichage :
//    'diff'  (défaut) — comparaison : différences entre fichiers
//    'dupes'          — recherche de doublons : lignes communes
//
//  Deux natures de résultat en mode 'diff' :
//    • écarts de présence — une ligne d'un fichier sans
//      contrepartie dans un autre (un onglet par fichier) ;
//    • lignes retrouvées mais différentes — une ligne retrouvée
//      dans tous les fichiers, mais dont une colonne comparée
//      diverge (un onglet, une ligne de tableau par rapprochement).
//
//  Les colonnes affichées sont décrites par des objets
//  { label, cols: { A, B, C }, role } : pour une ligne issue de A
//  on lit row[cols.A] (null = colonne absente de ce fichier →
//  cellule vide). role vaut 'key', 'cmp' ou 'other'.
//
//  API : XLDiffResults.init()
//        XLDiffResults.show({ diff, columns, totals, mode })
//        XLDiffResults.setColumns(columns)
//        XLDiffResults.exportResults()
// ============================================================

const XLDiffResults = (() => {
  const $ = id => document.getElementById(id);
  let dom = null;
  let state = null; // { diff, columns, totals, sides, mode, activeTab }

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
    };
    const btnRestart = $('btnRestart');
    if (btnRestart) btnRestart.addEventListener('click', () => location.reload());
  }

  function show({ diff, columns, totals, mode }) {
    state = {
      diff,
      columns,
      totals: totals || {},
      sides: diff.sides || ['A', 'B'],
      mode: mode || 'diff',
      activeTab: 'all',
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
      const n = diff.onlyA.length; // nombre de correspondances A ↔ B
      if (n === 0) {
        headline = 'Aucun doublon : aucune ligne n\'est présente à la fois dans les deux fichiers.';
        headlineOk = true;
      } else {
        headline = `Il y a ${fmt(n)} ligne${plur(n)} en double, présente${plur(n)} à la fois dans A et dans B.`;
      }
      lines.push({ cls: 'sum-a', html: `Le fichier A contient ${fmt(totals.A)} ligne${plur(totals.A)}, dont ${fmt(totals.A - n)} sans équivalent dans B.` });
      lines.push({ cls: 'sum-b', html: `Le fichier B contient ${fmt(totals.B)} ligne${plur(totals.B)}, dont ${fmt(totals.B - n)} sans équivalent dans A.` });
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
      return [
        { id: 'all', label: 'Tous les doublons', count: diff.all.length },
        { id: 'onlyA', label: 'Doublons côté A', count: diff.onlyA.length },
        { id: 'onlyB', label: 'Doublons côté B', count: diff.onlyB.length },
      ];
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

    dom.tbody.innerHTML = '';
    if (state.activeTab === 'modified') renderModified();
    else renderRows();
  }

  // Découpe le rendu en blocs pour rester fluide sur les gros volumes
  function renderChunked(total, buildRow) {
    const CHUNK = 500;
    const token = {};
    state.renderToken = token;
    let offset = 0;
    (function step() {
      if (state.renderToken !== token) return; // un nouveau rendu a pris le relais
      const frag = document.createDocumentFragment();
      const end = Math.min(offset + CHUNK, total);
      for (let i = offset; i < end; i++) frag.appendChild(buildRow(i));
      dom.tbody.appendChild(frag);
      offset = end;
      if (offset < total) requestAnimationFrame(step);
    })();
  }

  function emptyRow(colspan, msg) {
    dom.tbody.innerHTML = `<tr><td colspan="${colspan}" class="empty-state">${msg}</td></tr>`;
  }

  // ---------- Écarts de présence : une ligne source par ligne de tableau ----------

  function renderRows() {
    const { diff, columns, sides, mode, activeTab } = state;
    const three = sides.length > 2;
    const rows = activeTab === 'all' ? diff.all : diff.bySide[activeTab.slice(4)];

    dom.thead.innerHTML = '<tr><th>Ligne</th><th>Source</th>' +
      (three ? '<th>Présente dans</th>' : '') +
      columns.map(c => `<th>${esc(c.label)}</th>`).join('') + '</tr>';

    if (rows.length === 0) {
      emptyRow(columns.length + (three ? 3 : 2),
        mode === 'dupes' ? 'Aucun doublon dans cette catégorie' : 'Aucune différence dans cette catégorie');
      return;
    }

    renderChunked(rows.length, i => {
      const row = rows[i];
      const sd = row.__source;
      const tr = document.createElement('tr');
      tr.className = 'row-' + sd.toLowerCase();
      let html = `<td class="row-num">${row.__rowNum || ''}</td>` +
        `<td><span class="source-tag src-${sd.toLowerCase()}">${sd}</span></td>`;
      if (three) html += `<td class="presence">${esc(row.__presence || sd)}</td>`;
      for (const col of columns) {
        const v = cellValue(row, col);
        html += `<td title="${escAttr(v)}">${esc(v)}</td>`;
      }
      tr.innerHTML = html;
      return tr;
    });
  }

  // ---------- Lignes retrouvées mais différentes : un rapprochement par ligne ----------

  function renderModified() {
    const { diff, columns, sides } = state;

    dom.thead.innerHTML = '<tr><th>Lignes</th>' +
      columns.map(c => `<th>${esc(c.label)}</th>`).join('') + '</tr>';

    if (diff.modified.length === 0) {
      emptyRow(columns.length + 1,
        'Aucun écart de contenu : toutes les lignes retrouvées sont identiques sur les colonnes comparées.');
      return;
    }

    renderChunked(diff.modified.length, i => {
      const pair = diff.modified[i];
      const byLabel = new Map(pair.diffs.map(d => [d.label, d]));
      const tr = document.createElement('tr');
      tr.className = 'row-diff';

      const ref = sides.map(sd => `${sd}${pair.rows[sd].__rowNum || ''}`).join(' / ');
      let html = `<td class="row-num">${esc(ref)}</td>`;

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
      tr.innerHTML = html;
      return tr;
    });
  }

  // ---------- Export .xlsx ----------

  function exportResults() {
    if (!state) return;
    const { diff, columns, sides, mode } = state;
    const three = sides.length > 2;
    const wb = XLSX.utils.book_new();

    // Écarts de présence
    function toSheet(rows, withSource) {
      return XLSX.utils.json_to_sheet(rows.map(r => {
        const o = {};
        o['Ligne'] = r.__rowNum || '';
        if (withSource) o['Source'] = r.__source || '';
        if (three) o['Présente dans'] = r.__presence || r.__source || '';
        for (const col of columns) o[col.label] = cellValue(r, col);
        return o;
      }));
    }

    // Lignes retrouvées mais différentes : une colonne par fichier pour
    // les colonnes comparées, afin que le résultat reste retraitable
    function toModifiedSheet(pairs) {
      return XLSX.utils.json_to_sheet(pairs.map(p => {
        const o = {};
        for (const sd of sides) o[`Ligne ${sd}`] = p.rows[sd].__rowNum || '';
        const byLabel = new Map(p.diffs.map(d => [d.label, d]));
        for (const col of columns) {
          if (col.role === 'cmp') {
            for (const sd of sides) {
              const c = col.cols[sd];
              o[`${col.label} (${sd})`] = c == null ? '' : val(p.rows[sd][c]);
            }
          } else {
            let v = '';
            for (const sd of sides) {
              const c = col.cols[sd];
              if (c != null) { v = val(p.rows[sd][c]); break; }
            }
            o[col.label] = v;
          }
        }
        o['Colonnes en écart'] = p.diffs.map(d => d.label).join(', ');
        return o;
      }));
    }

    const names = mode === 'dupes'
      ? { all: 'Tous les doublons', side: sd => `Doublons côté ${sd}`, file: 'xldiff_doublons' }
      : {
          all: 'Toutes différences',
          side: sd => (three ? `${sd} absentes ailleurs` : `Uniquement ${sd}`),
          file: 'xldiff',
        };

    XLSX.utils.book_append_sheet(wb, toSheet(diff.all, true), names.all);
    if (diff.compared && diff.modified.length)
      XLSX.utils.book_append_sheet(wb, toModifiedSheet(diff.modified), 'Retrouvées mais différentes');
    sides.forEach(sd => {
      const rows = diff.bySide[sd];
      if (rows && rows.length) XLSX.utils.book_append_sheet(wb, toSheet(rows, false), names.side(sd));
    });

    const ts = new Date();
    const stamp = `${ts.getFullYear()}${pad2(ts.getMonth() + 1)}${pad2(ts.getDate())}_${pad2(ts.getHours())}${pad2(ts.getMinutes())}`;
    XLSX.writeFile(wb, `${names.file}_${stamp}.xlsx`);
  }

  return { init, show, setColumns, exportResults };
})();
