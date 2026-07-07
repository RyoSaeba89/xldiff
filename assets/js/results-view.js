// ============================================================
//  XLDiff — results-view.js
//  Rendu des résultats de comparaison : statistiques, onglets,
//  tableau (rendu par blocs) et export .xlsx.
//
//  Les colonnes affichées sont décrites par des objets
//  { label, colA, colB } : pour une ligne issue de A on lit
//  row[colA], pour une ligne issue de B on lit row[colB]
//  (null = colonne absente de ce fichier → cellule vide).
//
//  API : XLDiffResults.init()
//        XLDiffResults.show({ diff, columns, totalA, totalB })
//        XLDiffResults.setColumns(columns)
//        XLDiffResults.exportResults()
// ============================================================

const XLDiffResults = (() => {
  const $ = id => document.getElementById(id);
  let dom = null;
  let state = null; // { diff, columns, totalA, totalB, activeTab }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escAttr(s) {
    return String(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function pad2(n) { return String(n).padStart(2, '0'); }

  function cellValue(row, col) {
    const c = row.__source === 'A' ? col.colA : col.colB;
    if (c == null) return '';
    return String(row[c] ?? '');
  }

  function init() {
    dom = {
      results: $('results'),
      statsRow: $('statsRow'),
      tabsBar: $('tabsBar'),
      thead: $('thead'),
      tbody: $('tbody'),
    };
  }

  function show({ diff, columns, totalA, totalB }) {
    state = { diff, columns, totalA, totalB, activeTab: 'all' };
    render();
  }

  function setColumns(columns) {
    if (!state) return;
    state.columns = columns;
    render();
  }

  function render() {
    const { diff, columns, totalA, totalB, activeTab } = state;
    dom.results.classList.add('visible');

    dom.statsRow.innerHTML = `
      <div class="stat-card"><div class="stat-label">Lignes fichier A</div><div class="stat-value color-a">${totalA.toLocaleString()}</div></div>
      <div class="stat-card"><div class="stat-label">Lignes fichier B</div><div class="stat-value color-b">${totalB.toLocaleString()}</div></div>
      <div class="stat-card"><div class="stat-label">Uniquement dans A</div><div class="stat-value color-a">${diff.onlyA.length.toLocaleString()}</div></div>
      <div class="stat-card"><div class="stat-label">Uniquement dans B</div><div class="stat-value color-b">${diff.onlyB.length.toLocaleString()}</div></div>
    `;

    const tabs = [
      { id: 'all', label: 'Toutes les différences', count: diff.all.length },
      { id: 'onlyA', label: 'Uniquement A', count: diff.onlyA.length },
      { id: 'onlyB', label: 'Uniquement B', count: diff.onlyB.length },
    ];
    dom.tabsBar.innerHTML = '';
    tabs.forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'tab-btn' + (t.id === activeTab ? ' active' : '');
      btn.innerHTML = `${t.label} <span class="tab-count">${t.count.toLocaleString()}</span>`;
      btn.addEventListener('click', () => { state.activeTab = t.id; render(); });
      dom.tabsBar.appendChild(btn);
    });

    const rows = diff[activeTab === 'all' ? 'all' : activeTab];

    dom.thead.innerHTML = '<tr><th>Ligne</th><th>Source</th>' +
      columns.map(c => `<th>${esc(c.label)}</th>`).join('') + '</tr>';
    dom.tbody.innerHTML = '';

    if (rows.length === 0) {
      dom.tbody.innerHTML = `<tr><td colspan="${columns.length + 2}" class="empty-state">Aucune différence dans cette catégorie</td></tr>`;
      return;
    }

    // Rendu par blocs pour rester fluide sur les gros volumes
    const CHUNK = 500;
    const renderToken = {};
    state.renderToken = renderToken;
    let offset = 0;
    (function renderChunk() {
      if (state.renderToken !== renderToken) return; // un nouveau rendu a pris le relais
      const frag = document.createDocumentFragment();
      const end = Math.min(offset + CHUNK, rows.length);
      for (let i = offset; i < end; i++) {
        const row = rows[i];
        const tr = document.createElement('tr');
        tr.className = row.__source === 'A' ? 'row-a' : 'row-b';
        let html = `<td class="row-num">${row.__rowNum || ''}</td>` +
          `<td><span class="source-tag ${row.__source === 'A' ? 'src-a' : 'src-b'}">${row.__source}</span></td>`;
        for (const col of columns) {
          const v = cellValue(row, col);
          html += `<td title="${escAttr(v)}">${esc(v)}</td>`;
        }
        tr.innerHTML = html;
        frag.appendChild(tr);
      }
      dom.tbody.appendChild(frag);
      offset = end;
      if (offset < rows.length) requestAnimationFrame(renderChunk);
    })();
  }

  function exportResults() {
    if (!state) return;
    const { diff, columns } = state;
    const wb = XLSX.utils.book_new();

    function toSheet(rows, withSource) {
      const out = rows.map(r => {
        const o = {};
        o['Ligne'] = r.__rowNum || '';
        if (withSource) o['Source'] = r.__source || '';
        for (const col of columns) o[col.label] = cellValue(r, col);
        return o;
      });
      return XLSX.utils.json_to_sheet(out);
    }

    XLSX.utils.book_append_sheet(wb, toSheet(diff.all, true), 'Toutes différences');
    if (diff.onlyA.length)
      XLSX.utils.book_append_sheet(wb, toSheet(diff.onlyA, false), 'Uniquement A');
    if (diff.onlyB.length)
      XLSX.utils.book_append_sheet(wb, toSheet(diff.onlyB, false), 'Uniquement B');

    const ts = new Date();
    const stamp = `${ts.getFullYear()}${pad2(ts.getMonth() + 1)}${pad2(ts.getDate())}_${pad2(ts.getHours())}${pad2(ts.getMinutes())}`;
    XLSX.writeFile(wb, `xldiff_${stamp}.xlsx`);
  }

  return { init, show, setColumns, exportResults };
})();
