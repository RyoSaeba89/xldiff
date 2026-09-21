// ============================================================
//  XLDiff — results-view.js
//  Rendu des résultats : résumé en phrases simples, onglets,
//  tableau virtualisé et exports .xlsx.
//
//  Deux natures d'écart :
//    • écarts de présence — une ligne d'un fichier sans
//      contrepartie dans un autre (un onglet par fichier) ;
//    • lignes retrouvées mais différentes — une ligne retrouvée
//      dans tous les fichiers, mais dont une colonne comparée
//      diverge (un onglet, une ligne de tableau par rapprochement).
//  Et les lignes communes, qui remplacent l'ancienne recherche de
//  doublons :
//    • « Identiques entre A et B » — les rapprochements sans écart,
//      une ligne de tableau par rapprochement ;
//    • « Présentes dans 2 ou 3 fichiers » — à trois fichiers
//      seulement, une ligne source par ligne de tableau.
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
//        XLDiffResults.show({ diff, columns, totals, sources })
//        XLDiffResults.hide()               (résultats devenus périmés)
//        XLDiffResults.setColumns(columns)
//        XLDiffResults.exportResults(ancre, fait)
//                                           (ouvre le choix des onglets)
//        XLDiffResults.exportAnnotated()
// ============================================================

const XLDiffResults = (() => {
  const $ = id => document.getElementById(id);
  const MARGE = 12;        // lignes rendues au-delà de la zone visible
  const HAUTEUR_DEFAUT = 30;
  let dom = null;
  let state = null; // { diff, columns, totals, sides, activeTab, vue, sources, colsParOnglet }

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
    // La mention des colonnes masquées est posée ici, sous le tableau,
    // plutôt que recopiée dans les quatre pages : elle n'a rien qui
    // dépende de la page, et cette vue est seule à l'écrire.
    if (dom.wrapper && dom.wrapper.parentNode) {
      const mention = document.createElement('div');
      mention.className = 'cols-masquees';
      mention.id = 'colsMasquees';
      mention.hidden = true;
      dom.wrapper.parentNode.insertBefore(mention, dom.wrapper.nextSibling);
      dom.colsMasquees = mention;
    }

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

  function show({ diff, columns, totals, sources }) {
    state = {
      diff,
      columns,
      totals: totals || {},
      sides: diff.sides || ['A', 'B'],
      sources: sources || null,
      activeTab: 'all',
      vue: null,
      colsParOnglet: {}, // colonnes retenues par onglet, cf. colonnesVisibles()
    };
    fermerChoix(false);
    render();
  }

  // Retire les résultats affichés : ils décrivent une analyse qui n'a
  // plus cours. `state` repasse à null, donc les deux exports deviennent
  // inopérants tant qu'une nouvelle comparaison n'a pas eu lieu — c'est
  // la garantie qu'on n'exporte jamais un résultat périmé.
  function hide() {
    if (!dom) return;
    state = null;
    fermerChoix(false);
    dom.results.classList.remove('visible');
    dom.summaryBox.innerHTML = '';
    dom.tabsBar.innerHTML = '';
    dom.thead.innerHTML = '';
    dom.tbody.innerHTML = '';
    annoncerColonnesMasquees([]);
  }

  // La liste des colonnes change : le verdict gardé par onglet ne vaut
  // plus rien, on le jette avant de redessiner.
  function setColumns(columns) {
    if (!state) return;
    state.columns = columns;
    state.colsParOnglet = {};
    render();
  }

  // ---------- Résumé en phrases simples ----------

  function renderSummary() {
    const { diff, totals, sides } = state;
    const three = sides.length > 2;
    let headline = '';
    let headlineOk = false;
    const lines = [];

    const nAbs = diff.all.length;
    const nMod = diff.modified.length;

    if (nAbs === 0 && nMod === 0) {
      headline = three
        ? 'Aucune différence : les trois fichiers contiennent exactement les mêmes lignes.'
        : 'Aucune différence : les deux fichiers contiennent exactement les mêmes lignes.';
      headlineOk = true;
    } else if (nAbs === 0) {
      headline = `Il y a ${fmt(nMod)} ligne${plur(nMod)} retrouvée${plur(nMod)} ${three ? "dans les trois fichiers" : "des deux côtés"} mais dont le contenu diffère.`;
    } else {
      // Les deux natures d'écart sont annoncées côte à côte, sans total :
      // les additionner mêlerait des lignes absentes et des lignes
      // présentes mais divergentes. L'ancienne phrase ne citait que les
      // écarts de présence et taisait les écarts de contenu, ce qui
      // faisait passer un résultat de 263 lignes pour 124.
      const absentes = three
        ? `${fmt(nAbs)} ligne${plur(nAbs)} absente${plur(nAbs)} d'au moins un fichier`
        : `${fmt(nAbs)} ligne${plur(nAbs)} présente${plur(nAbs)} d'un seul côté`;
      if (nMod === 0) {
        headline = `Il y a ${absentes}.`;
      } else {
        const retrouvees = three
          ? `retrouvée${plur(nMod)} dans les trois fichiers`
          : `retrouvée${plur(nMod)} des deux côtés`;
        headline = `Il y a ${absentes}, et ${fmt(nMod)} ligne${plur(nMod)} ${retrouvees} dont le contenu diffère.`;
      }
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

    // Lignes communes à deux fichiers sur trois : ce que listait la
    // recherche de doublons, et qu'un rapprochement — présent PARTOUT —
    // ne dit pas
    if (diff.partagees) {
      const n = diff.partagees.all.length;
      lines.push({
        cls: 'sum-eq',
        html: `Il y a ${fmt(n)} ligne${plur(n)} présente${plur(n)} dans au moins deux des trois fichiers, tous fichiers confondus.`,
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

    dom.summaryBox.innerHTML =
      `<div class="summary-headline${headlineOk ? ' ok' : ''}">${headlineOk ? '✓ ' : ''}${headline}</div>` +
      `<ul class="summary-lines">${lines.map(l => `<li class="${l.cls}">${l.html}</li>`).join('')}</ul>`;
  }

  // ---------- Onglets ----------

  // Les libellés servent aussi de noms de feuille : 31 caractères au
  // plus, sans quoi Excel les tronque (cf. nomFeuille).
  function buildTabs() {
    const { diff, sides } = state;
    const three = sides.length > 2;

    // Cet onglet ne contient QUE les écarts de présence — jamais les
    // lignes retrouvées dont le contenu diffère, qui ont le leur. Il
    // s'appelait « Toutes les différences », ce qui le faisait lire
    // comme un total qu'il n'a jamais été.
    const tabs = [{
      id: 'all',
      label: three ? "Absentes d'au moins un fichier" : "Présentes d'un seul côté",
      count: diff.all.length,
    }];
    if (diff.compared) {
      tabs.push({ id: 'modified', label: 'Retrouvées mais différentes', count: diff.modified.length });
    }
    // Lignes retrouvées sans le moindre écart : l'ancienne recherche de
    // doublons à deux fichiers, rapprochement par rapprochement. Il faut
    // les données sources pour les afficher — le moteur ne rend que des
    // numéros de rapprochement.
    if (diff.identiques && state.sources) {
      tabs.push({ id: 'identiques', label: `Identiques entre ${joinFr(sides)}`, count: diff.identiques.length });
    }
    // À trois fichiers, les lignes communes à deux fichiers seulement ne
    // sont pas des rapprochements : elles ont leur propre onglet.
    if (diff.partagees) {
      tabs.push({ id: 'partagees', label: 'Présentes dans 2 ou 3 fichiers', count: diff.partagees.all.length });
    }
    sides.forEach(sd => {
      tabs.push({
        id: 'only' + sd,
        label: three ? `${sd}, absentes ailleurs` : `Uniquement dans ${sd}`,
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
    else if (state.activeTab === 'identiques') prepareIdentiques();
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

  // Lignes sources d'un onglet « une ligne par ligne de tableau »
  function lignesOnglet(id) {
    const { diff } = state;
    if (id === 'all') return diff.all;
    if (id === 'partagees') return diff.partagees.all;
    return diff.bySide[id.slice(4)];
  }

  function prepareRows() {
    const { sides, activeTab } = state;
    const three = sides.length > 2;
    const rows = lignesOnglet(activeTab);

    // Les valeurs pesées sont celles-là mêmes que la cellule affichera,
    // et que `aoaPresence()` écrira dans la feuille.
    const columns = colonnesVisibles(activeTab, rows.length,
      (l, c) => cellValue(rows[l], state.columns[c]));

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
    }, colspan, activeTab === 'partagees'
      ? "Aucune ligne ne se retrouve dans plus d'un fichier."
      : 'Aucune différence dans cette catégorie');
  }

  // ---------- Lignes communes : rapprochements sans écart ----------

  // Lignes du rapprochement t, une par fichier, retrouvées dans les
  // données sources : le moteur n'en garde que les indices.
  function lignesRapprochement(t) {
    const { diff, sides, sources } = state;
    const rows = {};
    for (const sd of sides) rows[sd] = sources[sd].data[diff.tuples[sd][t]];
    return rows;
  }

  // Valeur d'une colonne pour un rapprochement : celle du premier
  // fichier qui porte la colonne. Sur une ligne identique, les autres
  // fichiers disent la même chose — à la casse et aux espaces près
  // pour les colonnes comparées, cf. XLDiffEngine.normCell.
  function valeurRapprochement(rows, col) {
    for (const sd of state.sides) {
      const c = col.cols[sd];
      if (c != null) return val(rows[sd][c]);
    }
    return '';
  }

  function refLignes(rows) {
    return state.sides.map(sd => `${sd}${rows[sd].__rowNum || ''}`).join(' / ');
  }

  function prepareIdentiques() {
    const { diff } = state;
    const liste = diff.identiques;

    // Une seule résolution de ligne par rapprochement pendant le
    // balayage : il lit les cellules ligne après ligne.
    let derniere = -1;
    let rows = null;
    const columns = colonnesVisibles('identiques', liste.length, (l, c) => {
      if (l !== derniere) { derniere = l; rows = lignesRapprochement(liste[l]); }
      return valeurRapprochement(rows, state.columns[c]);
    });

    dom.thead.innerHTML = '<tr><th>Lignes</th>' +
      columns.map(c => `<th>${esc(c.label)}</th>`).join('') + '</tr>';

    monter(liste.length, i => {
      const r = lignesRapprochement(liste[i]);
      let html = `<tr><td class="row-num">${esc(refLignes(r))}</td>`;
      for (const col of columns) {
        const v = valeurRapprochement(r, col);
        html += `<td title="${escAttr(v)}">${esc(v)}</td>`;
      }
      return html + '</tr>';
    }, columns.length + 1, diff.compared
      ? 'Aucune ligne identique : toutes les lignes retrouvées diffèrent sur au moins une colonne comparée.'
      : 'Aucune ligne identique : aucune ligne ne se retrouve dans tous les fichiers.');
  }

  // ---------- Lignes retrouvées mais différentes ----------

  function prepareModified() {
    const { diff, sides } = state;

    // Même valeur que la cellule rendue plus bas : les deux versions
    // quand la ligne est en écart sur cette colonne, sinon la valeur du
    // premier fichier qui porte la colonne. La table des écarts est
    // rebâtie au changement de ligne seulement — le balayage les lit
    // dans l'ordre.
    let derniere = -1;
    let ecarts = null;
    const columns = colonnesVisibles('modified', diff.modified.length, (l, c) => {
      const pair = diff.modified[l];
      if (l !== derniere) {
        derniere = l;
        ecarts = new Map(pair.diffs.map(d => [d.label, d]));
      }
      const col = state.columns[c];
      const d = ecarts.get(col.label);
      if (d) return sides.map(sd => val(d.values[sd])).join(' ');
      return valeurRapprochement(pair.rows, col);
    });

    dom.thead.innerHTML = '<tr><th>Lignes</th>' +
      columns.map(c => `<th>${esc(c.label)}</th>`).join('') + '</tr>';

    monter(diff.modified.length, i => {
      const pair = diff.modified[i];
      const byLabel = new Map(pair.diffs.map(d => [d.label, d]));
      const ref = refLignes(pair.rows);
      let html = `<tr class="row-diff"><td class="row-num">${esc(ref)}</td>`;

      for (const col of columns) {
        const d = byLabel.get(col.label);
        if (d) {
          const parts = sides.map(sd => `<span class="v-${sd.toLowerCase()}">${esc(val(d.values[sd]))}</span>`);
          const plain = sides.map(sd => val(d.values[sd])).join(' → ');
          html += `<td class="cell-diff" title="${escAttr(plain)}">${parts.join('<span class="v-arrow"> → </span>')}</td>`;
        } else {
          const v = valeurRapprochement(pair.rows, col);
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

  // Nom de feuille Excel : 31 caractères au maximum, et les caractères
  // : \ / ? * [ ] y sont interdits. Les libellés d'onglet passent tous
  // aujourd'hui, mais ils suivront ceux de l'écran s'ils changent.
  function nomFeuille(label) {
    return String(label).replace(/[\\\/:?*\[\]]/g, ' ').slice(0, 31).trim() || 'Feuille';
  }

  // Une colonne dont aucune ligne ne porte de valeur n'apprend rien à
  // qui lit le résultat : elle n'est ni affichée à l'écran, ni écrite
  // dans le fichier exporté, en-tête compris. Une cellule réduite à des
  // espaces compte pour vide — en JavaScript, `\s` couvre déjà l'espace
  // insécable (U+00A0) et son cousin étroit (U+202F), ceux que sèment
  // les exports Excel — sans quoi une colonne d'apparence blanche
  // survivrait au filtre.
  function celluleVide(v) {
    return v == null || String(v).trim() === '';
  }

  // Seul juge de « colonne renseignée », pour l'écran comme pour le
  // fichier : `cellule(l, c)` rend la valeur de la ligne `l` dans la
  // colonne `c`, telle qu'elle sera montrée ou écrite. Les deux passent
  // par ici, donc le tableau affiche exactement les colonnes que la
  // feuille exportée portera. La règle vaut pour TOUTES les colonnes,
  // sans exception : celles des fichiers comme celles qu'ajoute XLDiff
  // (« Colonnes en écart » quand aucune ligne n'en porte, une colonne
  // « (B) » restée blanche), et la case « Afficher toutes les colonnes »
  // du mode avancé n'y échappe pas davantage.
  //
  // Le balayage s'arrête dès que chaque colonne a trouvé une valeur :
  // sur un résultat dense, il ne lit que les toutes premières lignes.
  function colonnesRenseignees(nbLignes, nbColonnes, cellule) {
    const remplie = new Array(nbColonnes).fill(false);
    let restantes = nbColonnes;
    for (let l = 0; l < nbLignes && restantes; l++) {
      for (let c = 0; c < nbColonnes; c++) {
        if (remplie[c] || celluleVide(cellule(l, c))) continue;
        remplie[c] = true;
        restantes--;
      }
    }
    // Aucune colonne renseignée — un onglet sans ligne, ou des lignes
    // toutes vides : on garde tout. Un tableau sans la moindre colonne,
    // comme une feuille réduite à rien, ne renseignerait sur rien.
    if (restantes === nbColonnes) remplie.fill(true);
    return remplie;
  }

  // La feuille exportée porte les mêmes colonnes que l'onglet qu'elle
  // reprend, par la même règle et sur les mêmes valeurs.
  function retirerColonnesVides(aoa) {
    if (aoa.length < 2) return aoa;
    const largeur = aoa[0].length;
    const remplie = colonnesRenseignees(aoa.length - 1, largeur, (l, c) => aoa[l + 1][c]);
    const gardees = [];
    for (let c = 0; c < largeur; c++) if (remplie[c]) gardees.push(c);
    if (gardees.length === largeur) return aoa; // rien à retirer, pas de recopie
    return aoa.map(ligne => gardees.map(c => ligne[c]));
  }

  // ---------- Colonnes affichées, onglet par onglet ----------

  // Chaque onglet ne montre que les colonnes que SES lignes renseignent :
  // c'est une prévisualisation fidèle de la feuille qu'il produira. Le
  // verdict est gardé en mémoire par onglet — passer d'un onglet à
  // l'autre ne rebalaye pas les lignes — et jeté dès que le résultat ou
  // la liste des colonnes change (`show()`, `setColumns()`).
  function colonnesVisibles(cle, nbLignes, cellule) {
    const toutes = state.columns;
    let cache = state.colsParOnglet[cle];
    if (!cache) {
      const remplie = colonnesRenseignees(nbLignes, toutes.length, cellule);
      cache = {
        visibles: toutes.filter((col, c) => remplie[c]),
        masquees: toutes.filter((col, c) => !remplie[c]).map(col => col.label),
      };
      state.colsParOnglet[cle] = cache;
    }
    annoncerColonnesMasquees(cache.masquees);
    return cache.visibles;
  }

  // Une colonne qui disparaît sans un mot se lit comme une perte de
  // données : la mention sous le tableau dit laquelle et pourquoi. Au-delà
  // de huit, la liste est abrégée — l'infobulle les donne toutes.
  const MAX_NOMS = 8;

  function annoncerColonnesMasquees(labels) {
    const el = dom.colsMasquees;
    if (!el) return;
    if (!labels.length) {
      el.hidden = true;
      el.textContent = '';
      el.removeAttribute('title');
      return;
    }
    const n = labels.length;
    let liste = joinFr(labels.slice(0, MAX_NOMS).map(l => `« ${l} »`));
    if (n > MAX_NOMS) liste += `, et ${num(n - MAX_NOMS)} autre${plur(n - MAX_NOMS)}`;
    el.textContent = n > 1
      ? `${num(n)} colonnes sans aucune valeur ne sont pas affichées : ${liste}. Elles ne seront pas non plus écrites dans le fichier exporté.`
      : `1 colonne sans aucune valeur n'est pas affichée : ${liste}. Elle ne sera pas non plus écrite dans le fichier exporté.`;
    el.title = labels.join(', ');
    el.hidden = false;
  }

  // Écarts de présence : une ligne source par ligne de tableau, avec
  // exactement les colonnes qu'affiche prepareRows().
  function aoaPresence(rows) {
    const { columns, sides } = state;
    const three = sides.length > 2;

    const entete = ['Ligne', 'Source'];
    if (three) entete.push('Présente dans');
    for (const col of columns) entete.push(col.label);

    const aoa = [entete];
    for (const r of rows) {
      const ligne = [r.__rowNum || '', r.__source || ''];
      if (three) ligne.push(r.__presence || r.__source || '');
      for (const col of columns) ligne.push(cellValue(r, col));
      aoa.push(ligne);
    }
    return aoa;
  }

  // Lignes retrouvées mais différentes : une colonne par fichier pour
  // les colonnes comparées, afin que le résultat reste retraitable
  function aoaModifiees() {
    const { diff, columns, sides } = state;

    const entete = sides.map(sd => `Ligne ${sd}`);
    for (const col of columns) {
      if (col.role === 'cmp') for (const sd of sides) entete.push(`${col.label} (${sd})`);
      else entete.push(col.label);
    }
    entete.push('Colonnes en écart');

    const aoa = [entete];
    for (const p of diff.modified) {
      const ligne = sides.map(sd => p.rows[sd].__rowNum || '');
      for (const col of columns) {
        if (col.role === 'cmp') {
          for (const sd of sides) {
            const c = col.cols[sd];
            ligne.push(c == null ? '' : val(p.rows[sd][c]));
          }
        } else {
          ligne.push(valeurRapprochement(p.rows, col));
        }
      }
      ligne.push(p.diffs.map(d => d.label).join(', '));
      aoa.push(ligne);
    }
    return aoa;
  }

  // Lignes identiques : une ligne par rapprochement, le numéro de ligne
  // de chaque fichier en tête, puis une seule valeur par colonne —
  // comme à l'écran.
  function aoaIdentiques() {
    const { diff, columns, sides } = state;
    const aoa = [sides.map(sd => `Ligne ${sd}`).concat(columns.map(c => c.label))];
    for (let i = 0; i < diff.identiques.length; i++) {
      const rows = lignesRapprochement(diff.identiques[i]);
      const ligne = sides.map(sd => rows[sd].__rowNum || '');
      for (const col of columns) ligne.push(valeurRapprochement(rows, col));
      aoa.push(ligne);
    }
    return aoa;
  }

  // Un onglet, une feuille : c'est buildTabs() qui décide du libellé, du
  // contenu et de l'ordre, pour l'écran comme pour le classeur.
  function aoaOnglet(onglet) {
    if (onglet.id === 'modified') return aoaModifiees();
    if (onglet.id === 'identiques') return aoaIdentiques();
    return aoaPresence(lignesOnglet(onglet.id));
  }

  // Le classeur exporté reprend un à un les onglets retenus : même
  // contenu et même ordre qu'à l'écran, sous le libellé de l'onglet — ou
  // sous le nom saisi par l'usager s'il a demandé à les renommer.
  // buildTabs() reste la seule source de vérité pour le contenu : l'écran
  // et le fichier ne peuvent pas diverger. Un onglet sans ligne donne une
  // feuille réduite à son en-tête, comme on la voit à l'écran.
  function ecrireSelection(ids, noms) {
    if (!state) return;
    const onglets = buildTabs().filter(t => ids.indexOf(t.id) !== -1);
    if (!onglets.length) return;

    const wb = XLSX.utils.book_new();
    for (const onglet of onglets) {
      const nom = (noms && noms[onglet.id]) || onglet.label;
      const aoa = retirerColonnesVides(aoaOnglet(onglet));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), nomFeuille(nom));
    }
    ecrire(wb, `xldiff_${horodatage()}.xlsx`);
  }

  // ---------- Choix des onglets à exporter ----------
  //
  // Le clic sur « Exporter .xlsx » n'écrit plus aussitôt : il ouvre sous
  // le bouton un panneau où chaque onglet de l'écran porte sa case, avec
  // son nombre de lignes. Le panneau repart toujours de « tout coché » et
  // du renommage éteint : le contenu du classeur ne dépend jamais d'un
  // réglage laissé de côté à l'export précédent. Annuler, Échap ou un clic
  // à côté referment sans rien écrire, et rien n'est exporté si plus
  // aucune case n'est cochée.
  //
  // RENOMMAGE — la case « Renommer les onglets avant l'export » (éteinte
  // par défaut) ouvre, sous chaque onglet coché, un champ pré-rempli avec
  // son libellé : le laisser tel quel donne exactement le fichier d'avant.
  // Un nom qu'Excel refuserait est signalé sous le champ et bloque
  // l'export, plutôt que d'être corrigé en douce en un nom que l'usager
  // n'a pas choisi.

  let choix = null; // { racine, liste, bascule, renommer, valider, ancre, fait }

  function choixOuvert() { return !!choix && !choix.racine.hidden; }
  function casesChoix() {
    return Array.prototype.slice.call(choix.liste.querySelectorAll('input[type="checkbox"]'));
  }

  // Excel refuse un nom vide, plus de 31 caractères, les caractères
  // : \ / ? * [ ], l'apostrophe en début ou en fin, et deux feuilles de
  // même nom dans un classeur (la casse ne les distingue pas).
  const CARS_INTERDITS = /[\\\/:?*\[\]]/;

  function erreurNom(valeur, dejaVus) {
    const nom = String(valeur).trim();
    if (!nom) return 'Donnez un nom à cet onglet.';
    if (nom.length > 31) return `31 caractères au maximum (il y en a ${nom.length}).`;
    if (CARS_INTERDITS.test(nom)) return 'Excel interdit les caractères : \\ / ? * [ ]';
    if (nom[0] === '\'' || nom[nom.length - 1] === '\'') return 'Le nom ne peut ni commencer ni finir par une apostrophe.';
    if (dejaVus.indexOf(nom.toLowerCase()) !== -1) return 'Ce nom est déjà pris par un autre onglet.';
    return '';
  }

  function majChoix() {
    const cases = casesChoix();
    const coches = cases.filter(c => c.checked).length;
    choix.bascule.textContent = coches === cases.length ? 'Tout décocher' : 'Tout cocher';

    // Les champs ne concernent que les onglets retenus : décocher un
    // onglet retire le sien. Sa saisie reste en mémoire tant que le
    // panneau est ouvert, pour qu'un décochage par mégarde ne l'efface pas.
    const renommer = choix.renommer.checked;
    const dejaVus = [];
    let faute = false;
    for (const c of cases) {
      const item = c.closest('.export-choice-item');
      const champ = item.querySelector('.ec-nom');
      const erreur = item.querySelector('.ec-erreur');
      const actif = renommer && c.checked;
      champ.hidden = !actif;
      if (!actif) {
        erreur.hidden = true;
        champ.classList.remove('en-faute');
        champ.removeAttribute('aria-invalid');
        continue;
      }
      const message = erreurNom(champ.value, dejaVus);
      if (message) {
        faute = true;
        champ.setAttribute('aria-invalid', 'true');
      } else {
        dejaVus.push(champ.value.trim().toLowerCase());
        champ.removeAttribute('aria-invalid');
      }
      champ.classList.toggle('en-faute', !!message);
      erreur.textContent = message;
      erreur.hidden = !message;
    }

    // Un classeur sans la moindre feuille n'existe pas, et un nom qu'Excel
    // refuserait non plus : dans les deux cas le bouton reste inerte
    // plutôt que d'écrire un fichier que l'usager croirait conforme.
    choix.valider.disabled = coches === 0 || faute;
  }

  // Le panneau est posé en coordonnées de document : il suit la page au
  // défilement sans écouteur, et se recale au redimensionnement.
  function placerChoix() {
    const { racine, ancre } = choix;
    if (!ancre || !ancre.getBoundingClientRect) return;
    const r = ancre.getBoundingClientRect();
    const marge = 8;
    const largeurVue = document.documentElement.clientWidth || 0;
    let gauche = r.left + window.scrollX;
    const maxi = window.scrollX + largeurVue - racine.offsetWidth - marge;
    if (largeurVue && gauche > maxi) gauche = maxi;
    if (gauche < window.scrollX + marge) gauche = window.scrollX + marge;
    racine.style.left = `${Math.round(gauche)}px`;
    racine.style.top = `${Math.round(r.bottom + window.scrollY + 6)}px`;
  }

  function creerChoix() {
    const racine = document.createElement('div');
    racine.className = 'export-choice';
    racine.id = 'exportChoice';
    racine.setAttribute('role', 'dialog');
    racine.setAttribute('aria-labelledby', 'exportChoiceTitre');
    racine.hidden = true;
    racine.innerHTML =
      '<div class="export-choice-title" id="exportChoiceTitre">Que voulez-vous exporter ?</div>' +
      '<div class="export-choice-list" id="exportChoiceList"></div>' +
      '<button type="button" class="export-choice-toggle" id="exportChoiceToggle">Tout décocher</button>' +
      '<label class="export-choice-rename">' +
      '<input type="checkbox" id="exportChoiceRename">' +
      '<span>Renommer les onglets avant l\'export</span>' +
      '</label>' +
      '<div class="export-choice-actions">' +
      '<button type="button" class="btn btn-secondary" id="exportChoiceCancel">Annuler</button>' +
      '<button type="button" class="btn btn-primary" id="exportChoiceOk">Exporter</button>' +
      '</div>';
    document.body.appendChild(racine);

    choix = {
      racine,
      liste: racine.querySelector('#exportChoiceList'),
      bascule: racine.querySelector('#exportChoiceToggle'),
      renommer: racine.querySelector('#exportChoiceRename'),
      valider: racine.querySelector('#exportChoiceOk'),
      ancre: null,
      fait: null,
    };

    choix.liste.addEventListener('change', majChoix);
    // `input` et non `change` : le verdict sur un nom se met à jour à la
    // frappe, pas seulement quand le champ perd le focus.
    choix.liste.addEventListener('input', majChoix);
    choix.liste.addEventListener('keydown', e => {
      if (e.key !== 'Enter' || !e.target.classList.contains('ec-nom')) return;
      e.preventDefault();
      if (!choix.valider.disabled) choix.valider.click();
    });
    choix.bascule.addEventListener('click', () => {
      const cases = casesChoix();
      const tout = cases.every(c => c.checked);
      cases.forEach(c => { c.checked = !tout; });
      majChoix();
    });
    choix.renommer.addEventListener('change', () => {
      majChoix();
      const premier = choix.liste.querySelector('.ec-nom:not([hidden])');
      if (choix.renommer.checked && premier) { premier.focus(); premier.select(); }
    });
    racine.querySelector('#exportChoiceCancel').addEventListener('click', () => fermerChoix(true));
    choix.valider.addEventListener('click', () => {
      const renommer = choix.renommer.checked;
      const ids = [];
      const noms = {};
      for (const c of casesChoix()) {
        if (!c.checked) continue;
        const id = c.getAttribute('data-onglet');
        ids.push(id);
        if (renommer) noms[id] = c.closest('.export-choice-item').querySelector('.ec-nom').value.trim();
      }
      const fait = choix.fait;
      fermerChoix(true);
      ecrireSelection(ids, renommer ? noms : null);
      if (fait) fait(ids);
    });

    // Échap est intercepté à la capture : sans ça, l'aide de la page le
    // recevrait aussi et fermerait son volet en même temps que le panneau.
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && choixOuvert()) { e.stopPropagation(); fermerChoix(true); }
    }, true);
    // Un clic à côté referme ; un clic sur le bouton d'export est laissé
    // passer, c'est lui qui referme — sans quoi il rouvrirait aussitôt.
    document.addEventListener('mousedown', e => {
      if (!choixOuvert()) return;
      if (racine.contains(e.target)) return;
      if (choix.ancre && choix.ancre.contains(e.target)) return;
      fermerChoix(false);
    }, true);
    window.addEventListener('resize', () => { if (choixOuvert()) placerChoix(); });

    return choix;
  }

  function ouvrirChoix(ancre, fait) {
    const c = choix || creerChoix();
    c.ancre = ancre;
    c.fait = fait || null;
    // Toutes les cases cochées et le renommage éteint à chaque ouverture :
    // voir le commentaire de section. Le champ de chaque onglet est
    // pré-rempli avec son libellé, celui-là même que porte la feuille
    // exportée sans renommage.
    c.liste.innerHTML = buildTabs().map(t =>
      '<div class="export-choice-item">' +
      '<label class="ec-case">' +
      `<input type="checkbox" checked data-onglet="${escAttr(t.id)}">` +
      `<span class="ec-label">${esc(t.label)}</span>` +
      `<span class="ec-count">${num(t.count)}</span>` +
      '</label>' +
      `<input type="text" class="ec-nom" hidden value="${escAttr(t.label)}" ` +
      `aria-label="Nom de la feuille pour l'onglet ${escAttr(t.label)}">` +
      '<div class="ec-erreur" hidden></div>' +
      '</div>').join('');
    c.renommer.checked = false;
    majChoix();
    c.racine.hidden = false;
    placerChoix();
    const premiere = c.liste.querySelector('input');
    if (premiere) premiere.focus();
  }

  function fermerChoix(rendreFocus) {
    if (!choixOuvert()) return;
    const ancre = choix.ancre;
    choix.racine.hidden = true;
    choix.ancre = null;
    choix.fait = null;
    if (rendreFocus && ancre && ancre.focus) ancre.focus();
  }

  // `ancre` est le bouton sous lequel s'ouvre le panneau, `fait` le
  // rappel joué une fois le fichier écrit — jamais si l'usager annule.
  function exportResults(ancre, fait) {
    if (!state) return;
    const bouton = ancre && ancre.getBoundingClientRect ? ancre : $('btnExport');
    // Appelé sans bouton à l'écran (pilotage direct) : tous les onglets
    // sont exportés, comme avant l'arrivée du panneau.
    if (!bouton) {
      ecrireSelection(buildTabs().map(t => t.id));
      if (fait) fait();
      return;
    }
    if (choixOuvert() && choix.ancre === bouton) { fermerChoix(true); return; }
    ouvrirChoix(bouton, fait);
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
    if (!state || !state.sources) return;
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
      // `trace` est indexée par la POSITION de la ligne dans le fichier,
      // que __rowNum ne donne pas : le numéro de ligne Excel tient compte
      // des lignes vides écartées à la lecture. D'où cette table, bâtie
      // une fois par fichier sur l'identité des objets.
      const posLigne = new Map(sources[sd].data.map((r, i) => [r, i]));
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
        const pos = posLigne.get(row);
        const masque = pos === undefined ? 0 : diff.trace[sd].presence[pos];
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
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(retirerColonnesVides(aoa)), 'Fichier A annoté');
    ecrire(wb, `xldiff_fichierA_annote_${horodatage()}.xlsx`);
  }

  return { init, show, hide, setColumns, exportResults, exportAnnotated };
})();
