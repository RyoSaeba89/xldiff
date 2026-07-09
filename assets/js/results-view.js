// ============================================================
//  XLDiff — results-view.js
//  Rendu des résultats : résumé en phrases simples, onglets,
//  tableau (rendu par blocs) et export .xlsx.
//
//  Deux modes d'affichage :
//    'diff'  (défaut) — comparaison : différences entre A et B
//    'dupes'          — recherche de doublons : lignes communes
//
//  Les colonnes affichées sont décrites par des objets
//  { label, colA, colB } : pour une ligne issue de A on lit
//  row[colA], pour une ligne issue de B on lit row[colB]
//  (null = colonne absente de ce fichier → cellule vide).
//
//  API : XLDiffResults.init()
//        XLDiffResults.show({ diff, columns, totalA, totalB, mode })
//        XLDiffResults.setColumns(columns)
//        XLDiffResults.exportResults()
// ============================================================

const XLDiffResults = (() => {
  const $ = id => document.getElementById(id);
  let dom = null;
  let state = null; // { diff, columns, totalA, totalB, mode, activeTab }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escAttr(s) {
    return String(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function fmt(n) { return `<strong>${n.toLocaleString('fr-FR')}</strong>`; }
  function plur(n) { return n > 1 ? 's' : ''; }

  function cellValue(row, col) {
    const c = row.__source === 'A' ? col.colA : col.colB;
    if (c == null) return '';
    return String(row[c] ?? '');
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

  function show({ diff, columns, totalA, totalB, mode }) {
    state = { diff, columns, totalA, totalB, mode: mode || 'diff', activeTab: 'all' };
    render();
  }

  function setColumns(columns) {
    if (!state) return;
    state.columns = columns;
    render();
  }

  // ---------- Résumé en phrases simples ----------

  function renderSummary() {
    const { diff, totalA, totalB, mode } = state;
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
      lines.push({ cls: 'sum-a', html: `Le fichier A contient ${fmt(totalA)} ligne${plur(totalA)}, dont ${fmt(totalA - n)} sans équivalent dans B.` });
      lines.push({ cls: 'sum-b', html: `Le fichier B contient ${fmt(totalB)} ligne${plur(totalB)}, dont ${fmt(totalB - n)} sans équivalent dans A.` });
    } else {
      const nDiff = diff.all.length;
      const identical = totalA - diff.onlyA.length; // lignes appariées entre A et B
      const delta = totalB - totalA;

      if (nDiff === 0) {
        headline = 'Aucune différence : les deux fichiers contiennent exactement les mêmes lignes.';
        headlineOk = true;
      } else {
        headline = `Il y a ${fmt(nDiff)} différence${plur(nDiff)} entre les deux fichiers.`;
      }

      lines.push({ cls: 'sum-eq', html: `Il y a ${fmt(identical)} ligne${plur(identical)} identique${plur(identical)} entre A et B.` });
      if (diff.onlyA.length)
        lines.push({ cls: 'sum-a', html: `Il y a ${fmt(diff.onlyA.length)} ligne${plur(diff.onlyA.length)} uniquement dans A (absente${plur(diff.onlyA.length)} de B).` });
      if (diff.onlyB.length)
        lines.push({ cls: 'sum-b', html: `Il y a ${fmt(diff.onlyB.length)} ligne${plur(diff.onlyB.length)} uniquement dans B (absente${plur(diff.onlyB.length)} de A).` });
      if (delta === 0) {
        lines.push({ cls: 'sum-n', html: `Les deux fichiers ont le même nombre de lignes (${fmt(totalA)}).` });
      } else {
        const sens = delta > 0 ? 'de plus' : 'de moins';
        const abs = Math.abs(delta);
        lines.push({ cls: 'sum-n', html: `Il y a une différence de ${fmt(abs)} ligne${plur(abs)} : le fichier B en contient ${abs.toLocaleString('fr-FR')} ${sens} que le fichier A (A : ${totalA.toLocaleString('fr-FR')}, B : ${totalB.toLocaleString('fr-FR')}).` });
      }
    }

    dom.summaryBox.innerHTML =
      `<div class="summary-headline${headlineOk ? ' ok' : ''}">${headlineOk ? '✓ ' : ''}${headline}</div>` +
      `<ul class="summary-lines">${lines.map(l => `<li class="${l.cls}">${l.html}</li>`).join('')}</ul>`;
  }

  // ---------- Rendu principal ----------

  function render() {
    const { diff, columns, mode, activeTab } = state;
    dom.results.classList.add('visible');

    renderSummary();

    const tabs = mode === 'dupes'
      ? [
          { id: 'all', label: 'Tous les doublons', count: diff.all.length },
          { id: 'onlyA', label: 'Doublons côté A', count: diff.onlyA.length },
          { id: 'onlyB', label: 'Doublons côté B', count: diff.onlyB.length },
        ]
      : [
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
      const emptyMsg = mode === 'dupes' ? 'Aucun doublon dans cette catégorie' : 'Aucune différence dans cette catégorie';
      dom.tbody.innerHTML = `<tr><td colspan="${columns.length + 2}" class="empty-state">${emptyMsg}</td></tr>`;
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
    const { diff, columns, mode } = state;
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

    const names = mode === 'dupes'
      ? { all: 'Tous les doublons', onlyA: 'Doublons côté A', onlyB: 'Doublons côté B', file: 'xldiff_doublons' }
      : { all: 'Toutes différences', onlyA: 'Uniquement A', onlyB: 'Uniquement B', file: 'xldiff' };

    XLSX.utils.book_append_sheet(wb, toSheet(diff.all, true), names.all);
    if (diff.onlyA.length)
      XLSX.utils.book_append_sheet(wb, toSheet(diff.onlyA, false), names.onlyA);
    if (diff.onlyB.length)
      XLSX.utils.book_append_sheet(wb, toSheet(diff.onlyB, false), names.onlyB);

    const ts = new Date();
    const stamp = `${ts.getFullYear()}${pad2(ts.getMonth() + 1)}${pad2(ts.getDate())}_${pad2(ts.getHours())}${pad2(ts.getMinutes())}`;
    XLSX.writeFile(wb, `${names.file}_${stamp}.xlsx`);
  }

  return { init, show, setColumns, exportResults };
})();
