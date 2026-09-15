(function () {
  const D = window.DATA;
  const $ = sel => document.querySelector(sel);

  // ---------- Rollen (gesimuleerde Microsoft 365-rollen) ----------
  const ROLES = {
    directie: { naam: 'Daniël Roos', init: 'DR', label: 'Directie', pages: ['overzicht', 'sales', 'product', 'regio', 'pipeline', 'opzet'], marge: true, datasets: ['omzet-funnel', 'adviseur-conversie', 'regio-capaciteit', 'product-groei', 'pipeline-mutaties'] },
    sales: { naam: 'Merel Koning', init: 'MK', label: 'Salesmanager', pages: ['overzicht', 'sales', 'product', 'regio', 'pipeline', 'opzet'], marge: false, datasets: ['omzet-funnel', 'adviseur-conversie', 'regio-capaciteit', 'product-groei', 'pipeline-mutaties'] },
    adviseur: { naam: 'Lotte Bakker', init: 'LB', label: 'Adviseur', pages: ['overzicht', 'sales', 'pipeline', 'opzet'], marge: false, adviseurId: 'a3', datasets: ['omzet-funnel', 'adviseur-conversie', 'pipeline-mutaties'], eigen: true },
  };
  const KEYS = D.MAANDEN.map(m => m.key);
  const DIMS = { adviseur: 'Adviseur', product: 'Product', regio: 'Regio', leadsoort: 'Leadsoort', maand: 'Maand' };
  const state = { role: 'directie', page: 'overzicht', f: { van: KEYS.at(-3), tot: D.HUIDIG, leadsoort: '', adviseur: '', product: '', regio: '' }, dim: {} };
  let charts = [];

  // ---------- Helpers ----------
  const eur = n => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
  const eurK = n => Math.abs(n) >= 1e6 ? `€ ${(n / 1e6).toLocaleString('nl-NL', { maximumFractionDigits: 2 })} mln` : `€ ${Math.round(n / 1000)}k`;
  const num = n => new Intl.NumberFormat('nl-NL').format(n);
  const pct = (n, d = 0) => `${(n * 100).toLocaleString('nl-NL', { maximumFractionDigits: d })}%`;
  const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);
  const groupBy = (arr, f) => arr.reduce((m, x) => { const k = f(x); (m[k] = m[k] || []).push(x); return m; }, {});
  const advNaam = id => (D.ADVISEURS.find(a => a.id === id) || {}).naam || id;
  const mLabel = key => (D.MAANDEN.find(m => m.key === key) || {}).label || key;
  const dimLabel = (k, v) => k === 'adviseur' ? advNaam(v) : k === 'maand' ? mLabel(v) : v;
  const dtxt = (cur, prev, opts = {}) => {
    if (!prev) return `<span class="dim">–</span>`;
    const d = (cur - prev) / prev; const up = d >= 0; const good = opts.invert ? !up : up;
    return `<span class="${Math.abs(d) < 0.005 ? 'dim' : good ? 'pos' : 'neg'}">${up ? '+' : '−'}${pct(Math.abs(d), 1)}</span>`;
  };
  const INK = '#e0712c', ACC = '#3b8ed6', GREY = '#e3e1dc', SOFT = '#a3c9ec', BAD = '#b8392e', COMP = '#3b8ed6';
  const PAL = ['#e0712c', '#3b8ed6', '#f2a778', '#8fbde6', '#f8caa9', '#c2dbf2', '#fce4d4', '#e3eef9'];
  const role = () => ROLES[state.role];

  Chart.defaults.font.family = "'Mulish', system-ui, sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.font.size = 11.5;
  Chart.defaults.color = '#8f8d88';
  Chart.defaults.plugins.legend.position = 'bottom';
  Chart.defaults.plugins.legend.labels.boxWidth = 8;
  Chart.defaults.plugins.legend.labels.boxHeight = 8;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.padding = 16;
  Chart.defaults.plugins.tooltip.backgroundColor = '#2b2a28';
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 6;
  const yAxis = (fmt, extra = {}) => ({ grid: { color: '#f1efeb' }, border: { display: false }, ticks: { callback: fmt || (v => v), maxTicksLimit: 6 }, ...extra });
  const xAxis = () => ({ grid: { display: false }, border: { display: false } });
  const pointer = (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; };
  function mk(id, cfg) { const el = document.getElementById(id); if (!el) return; const c = new Chart(el, cfg); charts.push(c); return c; }
  function clearCharts() { charts.forEach(c => c.destroy()); charts = []; }

  // ---------- Data ----------
  const scoped = () => role().eigen ? D.LEADS.filter(l => l.adviseur === role().adviseurId) : D.LEADS;
  const periodMonths = () => { let a = KEYS.indexOf(state.f.van), b = KEYS.indexOf(state.f.tot); if (a < 0) a = KEYS.length - 1; if (b < 0) b = KEYS.length - 1; if (a > b) [a, b] = [b, a]; return KEYS.slice(a, b + 1); };
  const prevMonths = months => { const i = KEYS.indexOf(months[0]); return i - months.length < 0 ? [] : KEYS.slice(i - months.length, i); };
  const inMonths = (leads, months) => leads.filter(l => months.includes(l.maand));
  const dimFilters = () => Object.fromEntries(['leadsoort', 'adviseur', 'product', 'regio'].filter(k => state.f[k]).map(k => [k, state.f[k]]));
  const applyFilters = leads => leads.filter(l => (!state.f.leadsoort || l.leadsoort === state.f.leadsoort) && (!state.f.adviseur || l.adviseur === state.f.adviseur) && (!state.f.product || l.items.includes(state.f.product)) && (!state.f.regio || l.regio === state.f.regio));
  const filtered = () => applyFilters(scoped());
  const stats = leads => {
    const orders = leads.filter(l => l.stage >= 4);
    return { leads: leads.length, afspraken: leads.filter(l => l.stage >= 1).length, opnames: leads.filter(l => l.stage >= 2).length, offertes: leads.filter(l => l.stage >= 3).length, orders: orders.length, omzet: sum(orders, l => l.waarde), marge: sum(orders, l => l.waarde * l.marge), conv: leads.length ? orders.length / leads.length : 0 };
  };
  const funnelCounts = leads => D.STAGES.slice(0, 5).map((s, i) => ({ stage: s, n: leads.filter(l => l.stage >= i).length }));
  const regioCap = r => sum(D.ADVISEURS.filter(a => a.regio === r), a => a.cap) * 4.33;
  const periodLabel = months => months.length === 1 ? mLabel(months[0]) : `${mLabel(months[0])} – ${mLabel(months.at(-1))}`;

  // ---------- Filters ----------
  function setFilter(k, v) {
    if (k === 'maand') { state.f.van = v; state.f.tot = v; }
    else if (k in state.f) state.f[k] = v;
    render();
  }
  // ---------- Filters (custom popovers, geen native selects) ----------
  let pop = { key: null, pending: null, q: '' };
  const FILTER_DEFS = () => [
    { key: 'leadsoort', label: 'Leadsoort', all: 'Alle leadsoorten', opts: D.LEADSOORTEN.map(x => ({ v: x, l: x })) },
    ...(role().eigen ? [] : [{ key: 'adviseur', label: 'Adviseur', all: 'Alle adviseurs', opts: D.ADVISEURS.map(a => ({ v: a.id, l: a.naam, sub: a.regio })), search: true }]),
    { key: 'product', label: 'Product', all: 'Alle producten', opts: D.PRODUCTEN.map(x => ({ v: x.naam, l: x.naam })) },
    ...(role().pages.includes('regio') ? [{ key: 'regio', label: 'Regio', all: "Alle regio's", opts: D.REGIOS.map(x => ({ v: x.naam, l: x.naam })), search: true }] : []),
  ];
  function renderFilters() {
    const months = periodMonths(), pm = prevMonths(months); const r = role();
    const active = Object.keys(dimFilters()).length;
    const trig = (key, label, on, extra = '') => `<button class="dd ${on ? 'on' : ''}" data-dd="${key}" ${extra}><span>${label}</span><svg viewBox="0 0 10 6"><path d="M1 1l4 4 4-4"/></svg></button>`;
    $('#filters').innerHTML = `
      ${trig('periode', `<b>${periodLabel(months)}</b>${pm.length ? `<i>vs. ${periodLabel(pm)}</i>` : ''}`, false, 'data-cal')}
      ${FILTER_DEFS().map(f => { const v = state.f[f.key]; const o = v && f.opts.find(o => o.v === v); return trig(f.key, o ? `${f.label}: <b>${o.l}</b>` : f.label, !!o); }).join('')}
      ${active ? '<button class="clear" data-clear="all">Wis filters</button>' : ''}
      <span class="scope">${r.eigen ? `Alleen eigen gegevens · ${r.naam}` : `${num(inMonths(filtered(), months).length)} leads in selectie`}</span>`;
  }
  function popEl() { let el = $('#pop'); if (!el) { el = document.createElement('div'); el.id = 'pop'; el.className = 'pop'; el.hidden = true; document.body.appendChild(el); } return el; }
  function openPop(key, trigger) {
    pop = { key, pending: null, q: '' }; renderPop();
    const el = popEl(), b = trigger.getBoundingClientRect();
    const below = window.innerHeight - b.bottom - 16; const top = el.offsetHeight > below ? Math.max(8, b.top - el.offsetHeight - 8) : b.bottom + 8;
    el.style.top = `${top}px`; el.style.left = `${Math.min(b.left, window.innerWidth - el.offsetWidth - 16)}px`; el.style.minWidth = key === 'role' ? `${b.width}px` : '';
    document.querySelectorAll('.dd').forEach(d => d.classList.toggle('open', d.dataset.dd === key));
    const inp = el.querySelector('input'); if (inp) inp.focus();
  }
  function closePop() { pop.key = null; const el = $('#pop'); if (el) el.hidden = true; document.querySelectorAll('.dd.open').forEach(d => d.classList.remove('open')); }
  function renderPop() {
    const el = popEl(); el.hidden = false;
    if (pop.key === 'periode') {
      const months = periodMonths(), pm = prevMonths(months);
      const a = pop.pending ? KEYS.indexOf(pop.pending) : KEYS.indexOf(months[0]), b = pop.pending ? -1 : KEYS.indexOf(months.at(-1));
      const years = [...new Set(D.MAANDEN.map(m => m.key.slice(0, 4)))];
      const presets = [['Deze maand', [D.HUIDIG, D.HUIDIG]], ['Vorige maand', [D.VORIG, D.VORIG]], ['Laatste 3 maanden', [KEYS.at(-3), D.HUIDIG]], ['Laatste 6 maanden', [KEYS.at(-6), D.HUIDIG]], ['Laatste 12 maanden', [KEYS.at(-12), D.HUIDIG]], ['Alles', [KEYS[0], KEYS.at(-1)]]];
      el.innerHTML = `<div class="cal">
        <div class="presets">${presets.map(([l, [v, t]]) => `<button class="${state.f.van === v && state.f.tot === t ? 'on' : ''}" data-range="${v}|${t}">${l}</button>`).join('')}</div>
        <div class="months">
          <div class="calhint">${pop.pending ? `Kies een eindmaand (start: ${mLabel(pop.pending)})` : 'Klik op een startmaand, daarna op een eindmaand'}</div>
          ${years.map(y => `<div class="yrow"><span class="yr">${y}</span><div class="mgrid">${D.MAANDEN.filter(m => m.key.startsWith(y)).map(m => { const i = KEYS.indexOf(m.key); const inR = b >= 0 && i >= a && i <= b; return `<button class="m ${inR ? 'in' : ''} ${i === a ? 'start' : ''} ${i === b ? 'end' : ''} ${m.key === D.HUIDIG ? 'now' : ''}" data-m="${m.key}">${m.label.split(' ')[0]}</button>`; }).join('')}</div></div>`).join('')}
          <div class="calfoot">Vergelijking: <b>${pm.length ? periodLabel(pm) : 'niet beschikbaar'}</b> · zelfde lengte, direct ervoor</div>
        </div></div>`;
      return;
    }
    if (pop.key === 'role') { el.innerHTML = `<div class="list">${Object.entries(ROLES).map(([k, r]) => `<button class="opt ${state.role === k ? 'on' : ''}" data-opt="${k}"><span>${r.label}</span><small>${r.naam}</small></button>`).join('')}</div>`; return; }
    const f = FILTER_DEFS().find(x => x.key === pop.key); if (!f) return closePop();
    const q = pop.q.toLowerCase(); const opts = f.opts.filter(o => !q || o.l.toLowerCase().includes(q) || (o.sub || '').toLowerCase().includes(q));
    el.innerHTML = `<div class="list">
      ${f.search ? `<div class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input placeholder="Zoek ${f.label.toLowerCase()}…" value="${pop.q}"></div>` : ''}
      <button class="opt ${!state.f[f.key] ? 'on' : ''}" data-opt="">${f.all}</button>
      ${opts.map(o => `<button class="opt ${state.f[f.key] === o.v ? 'on' : ''}" data-opt="${o.v}"><span>${o.l}</span>${o.sub ? `<small>${o.sub}</small>` : ''}</button>`).join('')}
      ${opts.length ? '' : '<div class="none">Geen resultaten</div>'}</div>`;
  }
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-dd]');
    if (t) { if (pop.key === t.dataset.dd) closePop(); else openPop(t.dataset.dd, t); return; }
    const el = $('#pop'); if (!el || el.hidden) return;
    if (!el.contains(e.target)) { closePop(); return; }
    const o = e.target.closest('[data-opt]'); if (o) { if (pop.key === 'role') setRole(o.dataset.opt); else { state.f[pop.key] = o.dataset.opt; closePop(); render(); } return; }
    const rg = e.target.closest('[data-range]'); if (rg) { const [v, t2] = rg.dataset.range.split('|'); state.f.van = v; state.f.tot = t2; closePop(); render(); return; }
    const m = e.target.closest('[data-m]'); if (m) {
      if (!pop.pending) { pop.pending = m.dataset.m; renderPop(); }
      else { let v = pop.pending, t2 = m.dataset.m; if (KEYS.indexOf(v) > KEYS.indexOf(t2)) [v, t2] = [t2, v]; state.f.van = v; state.f.tot = t2; closePop(); render(); }
    }
  });
  document.addEventListener('input', e => { if (e.target.closest('#pop .search')) { pop.q = e.target.value; const el = $('#pop'); renderPop(); const inp = el.querySelector('input'); inp.focus(); inp.setSelectionRange(pop.q.length, pop.q.length); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePop(); if (e.key === 'Enter' && e.target.closest('#pop .search')) { const first = $('#pop .opt:not([data-opt=""])'); if (first) first.click(); } });

  // ---------- Render ----------
  function render() {
    closePop();
    clearCharts();
    const r = role();
    if (!r.pages.includes(state.page)) state.page = r.pages[0];
    document.querySelectorAll('.nav').forEach(b => { b.disabled = !r.pages.includes(b.dataset.page); b.classList.toggle('active', b.dataset.page === state.page); });
    $('#cpScope').textContent = `${r.label} · ${r.naam} · ${r.datasets.length} datasets`;
    const pages = { overzicht: pageOverzicht, sales: pageSales, product: pageProduct, regio: pageRegio, pipeline: pagePipeline, opzet: pageOpzet };
    $('#main').innerHTML = pages[state.page]();
    if ($('#filters')) renderFilters();
    (afterRender[state.page] || (() => { }))();
    $('#main').scrollTop = 0;
  }
  const afterRender = {};

  // ---------- Componenten ----------
  const head = (title, sub, pill = '', showFilters = true) => `<div class="page-head"><div><h1>${title}</h1><p>${sub}</p></div><div class="right">${pill ? `<span class="pill">${pill}</span>` : ''}<button class="btn" data-copilot>✦ CoPilot</button></div></div>${showFilters ? '<div class="filters" id="filters"></div>' : ''}`;
  const stitle = (h, desc) => `<div class="stitle"><h2>${h}</h2><span>${desc}</span></div>`;
  const section = (h, desc, body) => `<section class="section">${stitle(h, desc)}${body}</section>`;
  const cardhead = (h, sub, right = '') => `<div class="cardhead"><div><h3>${h}</h3><div class="sub">${sub}</div></div>${right}</div>`;
  const kpi = (lbl, fmt, cur, prev, opts = {}) => {
    const val = typeof fmt === 'function' ? fmt(cur) : fmt;
    const vs = opts.vs ?? 'vs. vorige periode'; let d = `<div class="d dim">${vs ? `– ${vs}` : '&nbsp;'}</div>`;
    if (prev) { const x = (cur - prev) / prev; const up = x >= 0; const good = opts.invert ? !up : up; d = `<div class="d ${Math.abs(x) < 0.005 ? 'dim' : good ? 'pos' : 'neg'}">${up ? '▲' : '▼'} ${pct(Math.abs(x), 0)} ${vs}</div>`; }
    const cmp = opts.cmp || (typeof fmt === 'function' && prev ? `${opts.cmpLabel || 'vorige periode'} ${fmt(prev)}` : '');
    return `<div class="kpi"><div class="lbl">${lbl}</div><div class="val">${val}</div>${d}${cmp ? `<div class="cmp">${cmp}</div>` : ''}</div>`;
  };
  const kpis = items => `<div class="kpis">${items.join('')}</div>`;

  function funnelHtml(cur, prev) {
    const fc = funnelCounts(cur), fp = funnelCounts(prev); const max = fc[0].n || 1;
    return `<div class="funnel">${fc.map((s, i) => {
      const cv = i ? s.n / (fc[i - 1].n || 1) : 1, pv = i ? fp[i].n / (fp[i - 1].n || 1) : 1; const d = cv - pv;
      return `<div class="frow"><span>${s.stage}</span><div class="fb" style="width:${(s.n / max) * 100}%"></div><span class="n">${num(s.n)}</span><span class="cv">${i ? `${pct(cv)} <span class="${d < -0.03 ? 'neg' : d > 0.03 ? 'pos' : 'dim'}">${d >= 0 ? '+' : '−'}${Math.abs(d * 100).toFixed(0)}pt</span>` : ''}</span></div>`;
    }).join('')}</div>`;
  }

  // Uitsplitsing: tabel per dimensie, rijen klikbaar → filter
  function breakdown(key, cur, prev, months) {
    const avail = Object.keys(DIMS).filter(k => !(k in dimFilters()) && !(k === 'adviseur' && role().eigen) && !(k === 'regio' && !role().pages.includes('regio')) && !(k === 'maand' && months.length === 1));
    const dim = avail.includes(state.dim[key]) ? state.dim[key] : avail[0];
    const val = l => dim === 'product' ? l.items[0] : l[dim];
    const rows = Object.entries(groupBy(cur, val)).map(([k, g]) => ({ k, s: stats(g), p: stats(prev.filter(l => val(l) === k)) })).sort((a, b) => dim === 'maand' ? a.k.localeCompare(b.k) : b.s.omzet - a.s.omzet);
    const max = Math.max(1, ...rows.map(x => x.s.omzet)); const m = role().marge;
    return `<div class="card c12">${cardhead('Uitsplitsing', 'Klik op een rij om de hele pagina te filteren', `<div class="dims" data-dimkey="${key}">${avail.map(k => `<button class="${k === dim ? 'on' : ''}" data-dim="${k}">${DIMS[k]}</button>`).join('')}</div>`)}
      <table><thead><tr><th>${DIMS[dim]}</th><th class="num">Leads</th><th class="num">Afspraken</th><th class="num">Offertes</th><th class="num">Orders</th><th class="num">Conversie</th><th class="num">Afspraak → offerte</th><th class="num">Omzet</th>${m ? '<th class="num">Marge</th>' : ''}<th class="num">Δ omzet</th></tr></thead><tbody>
      ${rows.map(r => `<tr class="drillrow" data-set="${dim}" data-val="${r.k}"><td>${dimLabel(dim, r.k)}</td><td class="num">${r.s.leads}</td><td class="num">${r.s.afspraken}</td><td class="num">${r.s.offertes}</td><td class="num">${r.s.orders}</td><td class="num">${pct(r.s.conv, 1)}</td><td class="num">${r.s.afspraken ? pct(r.s.offertes / r.s.afspraken) : '–'}</td><td class="num">${eur(r.s.omzet)}<span class="bar" style="width:${r.s.omzet / max * 56}px"></span></td>${m ? `<td class="num">${eur(r.s.marge)}</td>` : ''}<td class="num">${r.p.omzet < 3000 ? '<span class="dim">–</span>' : dtxt(r.s.omzet, r.p.omzet)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function records(cur) {
    const recs = cur.slice().sort((a, b) => b.stage - a.stage || b.waarde - a.waarde).slice(0, 50);
    const stageTag = st => `<span class="tag ${st >= 4 ? 'good' : st === 3 ? 'warn' : ''}">${D.STAGES[st]}</span>`;
    return `<details class="records"><summary>Onderliggende records uit het bronsysteem (${num(cur.length)}${recs.length < cur.length ? `, eerste ${recs.length} getoond` : ''})</summary>
      <div class="card" style="overflow-x:auto"><table class="recs"><thead><tr><th>#</th><th>Maand</th><th>Adviseur</th><th>Regio</th><th>Leadsoort</th><th>Producten</th><th>Stap</th><th class="num">Waarde</th></tr></thead><tbody>
      ${recs.map(l => `<tr><td class="mono">L-${String(l.id).padStart(5, '0')}</td><td>${mLabel(l.maand)}</td><td>${advNaam(l.adviseur)}</td><td>${l.regio}${l.extern ? ' <span class="tag">op afstand</span>' : ''}</td><td>${l.leadsoort}</td><td>${l.items.join(' + ')}</td><td>${stageTag(l.stage)}</td><td class="num">${l.waarde ? eur(l.waarde) : '–'}</td></tr>`).join('')}</tbody></table></div></details>`;
  }

  // Gedeelde hero: maandreeks met geselecteerde maanden benadrukt; klik = maand selecteren
  function monthlyHero(id, base, months, opts) {
    const byM = KEYS.map(m => stats(base.filter(l => l.maand === m)));
    const on = m => months.includes(m);
    const ds = opts.stack ? opts.stack.map((g, i) => ({ type: 'bar', label: g.label, data: KEYS.map(m => sum(base.filter(l => l.maand === m && l.stage >= 4 && g.f(l)), l => l.waarde / (g.split ? l.items.length : 1))), backgroundColor: KEYS.map(m => on(m) ? PAL[i] : PAL[i] + '66'), borderRadius: 2, stack: 's' }))
      : [{ type: 'bar', label: 'Omzet', data: byM.map(x => x.omzet), backgroundColor: KEYS.map(m => on(m) ? INK : GREY), borderRadius: 4, yAxisID: 'y' }, { type: 'line', label: 'Leads', data: byM.map(x => x.leads), borderColor: ACC, backgroundColor: ACC, tension: .35, pointRadius: KEYS.map(m => on(m) ? 3 : 0), borderWidth: 1.25, borderDash: [0], yAxisID: 'y1' }];
    mk(id, { data: { labels: KEYS.map(mLabel), datasets: ds }, options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, onClick: (e, els) => { if (els.length) setFilter('maand', KEYS[els[0].index]); }, onHover: pointer, scales: { x: { ...xAxis(), stacked: !!opts.stack }, y: { ...yAxis(v => eurK(v)), stacked: !!opts.stack }, ...(opts.stack ? {} : { y1: { position: 'right', grid: { display: false }, border: { display: false }, ticks: { maxTicksLimit: 6 } } }) }, plugins: { legend: { display: true }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.dataset.label === 'Leads' ? c.raw : eur(c.raw)}` } } } } });
  }

  // ----- Overzicht -----
  function pageOverzicht() {
    const months = periodMonths(), pm = prevMonths(months); const base = filtered();
    const cur = inMonths(base, months), prev = inMonths(base, pm); const s = stats(cur), p = stats(prev);
    const snap = D.SNAPSHOTS.at(-1), snapPrev = D.SNAPSHOTS.at(-2); const list = ams();
    const open = sum(list, am => snap.per[am].open), openPrev = sum(list, am => snapPrev.per[am].open);
    const capAdv = role().eigen ? D.ADVISEURS.filter(a => a.id === role().adviseurId) : state.f.adviseur ? D.ADVISEURS.filter(a => a.id === state.f.adviseur) : state.f.regio ? D.ADVISEURS.filter(a => a.regio === state.f.regio) : D.ADVISEURS;
    const cap = sum(capAdv, a => a.cap) * 4.33 * months.length;
    return head('Overzicht', 'Verdienen we geld, en waar komt het vandaan?', `${periodLabel(months)} · ${eurK(s.omzet)} · ${num(s.orders)} orders`) + `
      ${section('Kerncijfers', `${periodLabel(months)}${pm.length ? ` · vergeleken met ${periodLabel(pm)}` : ''}`, kpis([
        kpi('Omzet', eurK, s.omzet, p.omzet),
        kpi('Leads', num, s.leads, p.leads),
        kpi('Afspraken', num, s.afspraken, p.afspraken),
        kpi('Offertes', num, s.offertes, p.offertes),
        kpi('Orders', num, s.orders, p.orders),
        kpi('Conversie', v => pct(v, 1), s.conv, p.conv),
        ...(role().marge ? [kpi('Marge', eurK, s.marge, p.marge)] : []),
        kpi('Open offertes', eurK, open, openPrev, { vs: 'vs. vorige week' }),
        kpi('Bezetting', v => cap ? pct(v) : '–', s.afspraken / (cap || 1), p.afspraken / (cap || 1)),
      ]))}
      ${section('Omzet over tijd', 'alle maanden · geselecteerde periode benadrukt · klik op een maand', `<div class="card">${cardhead('Omzet en leads per maand', 'Gesloten orders uit het bronsysteem, historisch vastgelegd', '')}<div class="chart hero"><canvas id="hero"></canvas></div></div>`)}
            ${section('Funnel', 'waar in het proces haken leads af?', `<div class="row"><div class="card c5">${cardhead('Funnel', 'Conversie per stap, verschil t.o.v. vorige periode')}${funnelHtml(cur, prev)}</div><div class="card c7">${cardhead('Uitval per stap, per leadsoort', 'Aandeel dat de volgende stap niet haalt · klik op een leadsoort')}<div class="chart"><canvas id="chUitval"></canvas></div></div></div>`)}
      ${section('Uitsplitsing', 'klik op een rij om de hele pagina te filteren', breakdown('overzicht', cur, prev, months) + records(cur))}`;
  }
  afterRender.overzicht = () => {
    const months = periodMonths(); monthlyHero('hero', filtered(), months, {});
    uitvalChart('chUitval', inMonths(filtered(), months));
  };
  function uitvalChart(id, cur) {
    const steps = ['Lead → afspraak', 'Afspraak → opname', 'Opname → offerte', 'Offerte → order'];
    mk(id, { type: 'bar', data: { labels: steps, datasets: D.LEADSOORTEN.map((ls, i) => ({ label: ls, data: steps.map((_, si) => { const g = cur.filter(l => l.leadsoort === ls); const a = g.filter(l => l.stage >= si).length, b = g.filter(l => l.stage >= si + 1).length; return a ? +((1 - b / a) * 100).toFixed(1) : 0; }), backgroundColor: PAL[i], borderRadius: 2 })) }, options: { maintainAspectRatio: false, onClick: (e, els) => { if (els.length) setFilter('leadsoort', D.LEADSOORTEN[els[0].datasetIndex]); }, onHover: pointer, scales: { x: xAxis(), y: yAxis(v => v + '%') }, plugins: { tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.raw}% uitval` } } } } });
  }

  // ----- Sales -----
  function pageSales() {
    const months = periodMonths(), pm = prevMonths(months); const base = filtered();
    const cur = inMonths(base, months), prev = inMonths(base, pm); const s = stats(cur), p = stats(prev);
    const c2o = s.afspraken ? s.offertes / s.afspraken : 0, c2oP = p.afspraken ? p.offertes / p.afspraken : 0;
    const o2o = s.offertes ? s.orders / s.offertes : 0, o2oP = p.offertes ? p.orders / p.offertes : 0;
    const gem = s.orders ? s.omzet / s.orders : 0, gemP = p.orders ? p.omzet / p.orders : 0;
    return head('Sales', 'Hoe stroomt de funnel, en waar lekt hij?', `${num(s.leads)} leads · ${num(s.orders)} orders · ${pct(s.conv, 1)}`) + `
      ${section('Kerncijfers', `${periodLabel(months)}${pm.length ? ` · vergeleken met ${periodLabel(pm)}` : ''}`, kpis([
        kpi('Leads', num, s.leads, p.leads),
        kpi('Afspraken', num, s.afspraken, p.afspraken),
        kpi('Offertes', num, s.offertes, p.offertes),
        kpi('Orders', num, s.orders, p.orders),
        kpi('Afspraak → offerte', v => pct(v), c2o, c2oP),
        kpi('Offerte → order', v => pct(v), o2o, o2oP),
        kpi('Gem. orderwaarde', eurK, gem, gemP),
        kpi('Omzet', eurK, s.omzet, p.omzet),
      ]))}
      ${section('Omzet over tijd', 'per leadsoort · geselecteerde periode benadrukt · klik op een maand', `<div class="card">${cardhead('Omzet per maand, per leadsoort', 'Gesloten orders, gestapeld naar herkomst van de lead', '')}<div class="chart hero"><canvas id="hero"></canvas></div></div>`)}
            ${section('Funnel', 'waar in het proces haken leads af?', `<div class="row"><div class="card c5">${cardhead('Funnel', 'Conversie per stap, verschil t.o.v. vorige periode')}${funnelHtml(cur, prev)}</div><div class="card c7">${cardhead('Uitval per stap, per leadsoort', 'Aandeel dat de volgende stap niet haalt · klik op een leadsoort')}<div class="chart"><canvas id="chUitval"></canvas></div></div></div>`)}
      ${section('Uitsplitsing', 'klik op een rij om de hele pagina te filteren', breakdown('sales', cur, prev, months) + records(cur))}`;
  }
  afterRender.sales = () => {
    const months = periodMonths();
    monthlyHero('hero', filtered(), months, { stack: D.LEADSOORTEN.map(ls => ({ label: ls, f: l => l.leadsoort === ls })) });
    uitvalChart('chUitval', inMonths(filtered(), months));
  };

  // ----- Producten -----
  function productGrowth() {
    const last3 = KEYS.slice(-3), prev3 = KEYS.slice(-6, -3);
    return D.PRODUCTEN.map(p => { const f = l => l.stage >= 4 && l.items.includes(p.naam); const a = sum(inMonths(D.LEADS, last3).filter(f), l => l.waarde / l.items.length), b = sum(inMonths(D.LEADS, prev3).filter(f), l => l.waarde / l.items.length); return { p, cur: a, prev: b, g: b ? (a - b) / b : 0 }; }).sort((x, y) => y.g - x.g);
  }
  function pageProduct() {
    const months = periodMonths(), pm = prevMonths(months); const base = filtered();
    const cur = inMonths(base, months).filter(l => l.stage >= 4), prev = inMonths(base, pm).filter(l => l.stage >= 4);
    const per = D.PRODUCTEN.map(p => { const f = l => l.items.includes(p.naam); const c = cur.filter(f), pv = prev.filter(f); const om = sum(c, l => l.waarde / l.items.length); return { p, n: c.length, omzet: om, prevOmzet: sum(pv, l => l.waarde / l.items.length), marge: om * p.marge }; }).filter(x => x.n || !state.f.product).sort((a, b) => b.omzet - a.omzet);
    const combos = {}; cur.filter(l => l.items.length > 1).forEach(l => { const k = l.items.slice().sort().join(' + '); combos[k] = (combos[k] || 0) + 1; });
    const topCombos = Object.entries(combos).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const tot = sum(per, x => x.omzet), totP = sum(per, x => x.prevOmzet); const m = role().marge; const max = Math.max(1, ...per.map(x => x.omzet));
    const multi = cur.length ? cur.filter(l => l.items.length > 1).length / cur.length : 0, multiP = prev.length ? prev.filter(l => l.items.length > 1).length / prev.length : 0;
    return head('Producten', 'Wat verkoopt goed, en wat blijft achter?', `${per[0] ? per[0].p.naam : '–'} · ${tot ? pct(per[0].omzet / tot) : ''} van de omzet`) + `
      ${section('Kerncijfers', `${periodLabel(months)}${pm.length ? ` · vergeleken met ${periodLabel(pm)}` : ''}`, kpis([
        kpi('Omzet', eurK, tot, totP),
        kpi('Orders', num, cur.length, prev.length),
        kpi('Gem. orderwaarde', eurK, cur.length ? sum(cur, l => l.waarde) / cur.length : 0, prev.length ? sum(prev, l => l.waarde) / prev.length : 0),
        kpi('Orders met 2 producten', v => pct(v), multi, multiP),
        ...(m ? [kpi('Marge', eurK, sum(per, x => x.marge), sum(per, x => x.prevOmzet * x.p.marge)), kpi('Marge %', v => pct(v, 1), tot ? sum(per, x => x.marge) / tot : 0, totP ? sum(per, x => x.prevOmzet * x.p.marge) / totP : 0)] : []),
      ]))}
      ${section('Omzet over tijd', 'per product · geselecteerde periode benadrukt · klik op een maand', `<div class="card">${cardhead('Omzet per maand, per product', 'Orderwaarde verdeeld over de producten in de order', '')}<div class="chart hero"><canvas id="hero"></canvas></div></div>`)}
            ${section('Producten en combinaties', 'klik op een product om te filteren', `<div class="row">
        <div class="card c7">${cardhead('Per product', m ? 'Klik op een product om te filteren · marge alleen zichtbaar voor Directie' : 'Klik op een product om te filteren')}
          <table><thead><tr><th>Product</th><th class="num">Orders</th><th class="num">Omzet</th><th class="num">Aandeel</th>${m ? '<th class="num">Marge</th><th class="num">Marge %</th>' : ''}<th class="num">Δ omzet</th></tr></thead><tbody>
          ${per.map(x => { return `<tr class="drillrow" data-set="product" data-val="${x.p.naam}"><td>${x.p.naam}</td><td class="num">${x.n}</td><td class="num">${eur(x.omzet)}<span class="bar" style="width:${x.omzet / max * 56}px"></span></td><td class="num">${tot ? pct(x.omzet / tot) : '–'}</td>${m ? `<td class="num">${eur(x.marge)}</td><td class="num">${pct(x.p.marge)}</td>` : ''}<td class="num">${dtxt(x.omzet, x.prevOmzet)}</td></tr>`; }).join('')}</tbody></table></div>
        <div class="card c5">${cardhead('Productcombinaties', 'Meest verkochte combinaties in één order')}<table><thead><tr><th>Combinatie</th><th class="num">Orders</th></tr></thead><tbody>${topCombos.length ? topCombos.map(([k, n]) => `<tr><td>${k}</td><td class="num">${n}<span class="bar" style="width:${n / topCombos[0][1] * 56}px"></span></td></tr>`).join('') : '<tr><td colspan="2" class="dim">Geen combinaties in deze selectie</td></tr>'}</tbody></table></div>
      </div>`)}
      ${section('Uitsplitsing', 'klik op een rij om de hele pagina te filteren', breakdown('product', inMonths(base, months), inMonths(base, pm), months))}`;
  }
  afterRender.product = () => {
    const months = periodMonths(); const top = D.PRODUCTEN.slice().sort((a, b) => b.w - a.w);
    monthlyHero('hero', filtered(), months, { stack: top.map(p => ({ label: p.naam, f: l => l.items.includes(p.naam), split: true })) });
  };

  // ----- Regio -----
  function regioRows(months) {
    const cur = inMonths(filtered(), months);
    return D.REGIOS.map(r => { const g = cur.filter(l => l.regio === r.naam); const s = stats(g); const cap = regioCap(r.naam) * months.length; const advs = D.ADVISEURS.filter(a => a.regio === r.naam).length; return { r, s, cap, advs, ratio: cap ? s.leads / cap : Infinity }; });
  }
  const ratioColor = x => x === Infinity ? '#7d7a74' : x > 1.3 ? '#b8392e' : x > 0.9 ? '#e0712c' : x > 0.6 ? '#3b8ed6' : '#a3c9ec';
  function pageRegio() {
    const months = periodMonths(), pm = prevMonths(months); const rows = regioRows(months).sort((a, b) => b.ratio - a.ratio);
    const cur = inMonths(filtered(), months), prev = inMonths(filtered(), pm); const s = stats(cur), p = stats(prev);
    const none = rows.filter(x => x.cap === 0); const ext = cur.filter(l => l.extern);
    return head('Regio', 'Waar zit de vraag, en waar zit de capaciteit?', `${rows.filter(x => x.cap > 0 && x.ratio > 1.3).length + none.length} regio\'s onder druk`) + `
      ${section('Kerncijfers', `${periodLabel(months)}`, kpis([
        kpi('Leads', num, s.leads, p.leads),
        kpi('Afspraken', num, s.afspraken, p.afspraken),
        kpi('Orders', num, s.orders, p.orders),
        kpi('Conversie', v => pct(v, 1), s.conv, p.conv),
        kpi('Regio\'s zonder adviseur', String(none.length), 0, 0, { vs: '', cmp: none.map(x => x.r.naam).join(', ') }),
        kpi('Leads op afstand bediend', v => pct(v), ext.length / (cur.length || 1), prev.filter(l => l.extern).length / (prev.length || 1)),
      ]))}
      ${section('Vraag en capaciteit', 'leads, afspraakslots en orders per provincie · klik op een regio', `<div class="card">${cardhead('Leads, capaciteit en orders per regio', 'Capaciteit = beschikbare afspraakslots van adviseurs in de regio', '')}<div class="chart hero"><canvas id="hero"></canvas></div></div>`)}
            ${section('Per provincie', 'druk = leads per beschikbaar afspraakslot', `<div class="row">
        <div class="card c4">${cardhead('Kaart', 'Leads per beschikbaar afspraakslot · klik op een provincie')}
          <div class="tiles">${D.REGIOS.map(r => { const x = rows.find(q => q.r.naam === r.naam); return `<div class="tile" data-set="regio" data-val="${r.naam}" style="grid-column:${r.col + 1};grid-row:${r.row + 1};background:${ratioColor(x.ratio)}"><b>${r.naam}</b><small>${x.s.leads} · ${x.advs ? x.ratio.toFixed(2) : 'geen adviseur'}</small></div>`; }).join('')}</div>
          <div class="legend"><span><i style="background:#a3c9ec"></i>ruimte</span><span><i style="background:#3b8ed6"></i>in balans</span><span><i style="background:#e0712c"></i>krap</span><span><i style="background:#b8392e"></i>tekort</span><span><i style="background:#7d7a74"></i>geen eigen adviseur</span></div></div>
        <div class="card c8">${cardhead('Per regio', 'Gesorteerd op druk (leads per afspraakslot) · klik op een regio')}
          <table><thead><tr><th>Regio</th><th class="num">Leads</th><th class="num">Orders</th><th class="num">Conversie</th><th class="num">Omzet</th><th class="num">Adviseurs</th><th class="num">Druk</th><th></th></tr></thead><tbody>
          ${rows.map(x => `<tr class="drillrow" data-set="regio" data-val="${x.r.naam}"><td>${x.r.naam}</td><td class="num">${x.s.leads}</td><td class="num">${x.s.orders}</td><td class="num">${pct(x.s.conv, 1)}</td><td class="num">${eur(x.s.omzet)}</td><td class="num">${x.advs}</td><td class="num">${x.cap ? x.ratio.toFixed(2) : '∞'}</td><td>${x.cap === 0 ? '<span class="tag">geen eigen adviseur</span>' : x.ratio > 1.3 ? '<span class="tag bad">tekort</span>' : x.ratio > 0.9 ? '<span class="tag warn">krap</span>' : '<span class="tag good">in balans</span>'}</td></tr>`).join('')}</tbody></table></div>
      </div>`)}
      ${section('Uitsplitsing', 'klik op een rij om de hele pagina te filteren', breakdown('regio', cur, prev, months))}`;
  }
  afterRender.regio = () => {
    const rows = regioRows(periodMonths()).sort((a, b) => b.s.leads - a.s.leads);
    mk('hero', { type: 'bar', data: { labels: rows.map(x => x.r.naam), datasets: [{ label: 'Leads', data: rows.map(x => x.s.leads), backgroundColor: INK, borderRadius: 3 }, { label: 'Capaciteit (slots)', data: rows.map(x => Math.round(x.cap)), backgroundColor: GREY, borderRadius: 3 }, { label: 'Orders', data: rows.map(x => x.s.orders), backgroundColor: SOFT, borderRadius: 3 }] }, options: { maintainAspectRatio: false, onClick: (e, els) => { if (els.length) setFilter('regio', rows[els[0].index].r.naam); }, onHover: pointer, scales: { x: xAxis(), y: yAxis() } } });
  };

  // ----- Pipeline -----
  const ams = () => { if (role().eigen) return [role().naam]; if (state.f.adviseur && D.ACCOUNTMANAGERS.includes(advNaam(state.f.adviseur))) return [advNaam(state.f.adviseur)]; return D.ACCOUNTMANAGERS; };
  function pagePipeline() {
    const list = ams(); const S = D.SNAPSHOTS; const last = S.at(-1), prev = S.at(-2), first = S[0];
    const tot = s => sum(list, am => s.per[am].open); const mut = (s, k) => sum(list, am => s.per[am][k]);
    const avgV = sum(S.slice(-9, -1), s => mut(s, 'verloren')) / 8;
    return head('Pipeline', 'Hoe beweegt de portefeuille, en bij wie?', `${eurK(tot(last))} open · ${last.label}`, false) + `
      ${section('Kerncijfers', `week van ${last.label} · mutaties t.o.v. ${prev.label}`, kpis([
        kpi('Open offertes', eurK, tot(last), tot(prev), { vs: 'vs. vorige week' }),
        kpi('Nieuw', eurK, mut(last, 'nieuw'), mut(prev, 'nieuw'), { vs: 'vs. vorige week' }),
        kpi('Gewonnen', eurK, mut(last, 'gewonnen'), mut(prev, 'gewonnen'), { vs: 'vs. vorige week' }),
        kpi('Verloren', eurK, mut(last, 'verloren'), avgV, { vs: 'vs. gem. 8 weken', invert: true }),
        kpi('Gemuteerd', eurK, mut(last, 'gemuteerd'), 0, { vs: '', cmp: 'waardewijzigingen op openstaande offertes' }),
        kpi('Groei 26 weken', v => (v >= 0 ? '+' : '') + pct(v, 1), (tot(last) - tot(first)) / tot(first), 0, { vs: '', cmp: `${first.label} ${eurK(tot(first))} → ${last.label} ${eurK(tot(last))}` }),
      ]))}
      ${section('Portefeuille over tijd', '26 wekelijkse snapshots · gestapeld per accountmanager', `<div class="card">${cardhead('Openstaande offertes per accountmanager', 'Het bronsysteem toont alleen de huidige stand; de reporting-database bewaart de historie')}<div class="chart hero"><canvas id="hero"></canvas></div></div>`)}
            ${section('Mutaties', `${prev.label} → ${last.label}`, `<div class="row">
        <div class="card c4">${cardhead('Mutaties deze week', `${prev.label} → ${last.label}`)}<div class="chart"><canvas id="chWater"></canvas></div></div>
        <div class="card c8">${cardhead('Per accountmanager', 'Mutaties in de laatste week · klik om te filteren')}
          <table><thead><tr><th>Accountmanager</th><th class="num">Open vorige week</th><th class="num">Nieuw</th><th class="num">Gewonnen</th><th class="num">Verloren</th><th class="num">Gemuteerd</th><th class="num">Open nu</th><th class="num">Δ week</th></tr></thead><tbody>
          ${list.map(am => { const l = last.per[am], p = prev.per[am]; const d = l.open - p.open; const adv = D.ADVISEURS.find(a => a.naam === am); return `<tr class="${adv && !role().eigen ? 'drillrow' : ''}" data-set="adviseur" data-val="${adv ? adv.id : ''}"><td>${am}</td><td class="num">${eur(p.open)}</td><td class="num">${eur(l.nieuw)}</td><td class="num">${eur(l.gewonnen)}</td><td class="num ${l.verloren > 150000 ? 'neg' : ''}">${eur(l.verloren)}</td><td class="num">${eur(l.gemuteerd)}</td><td class="num">${eur(l.open)}</td><td class="num ${d < -100000 ? 'neg' : d > 50000 ? 'pos' : 'dim'}">${d >= 0 ? '+' : '−'}${eurK(Math.abs(d))}</td></tr>`; }).join('')}</tbody></table></div>
      </div>`)}`;
  }
  afterRender.pipeline = () => {
    const list = ams(); const S = D.SNAPSHOTS;
    mk('hero', { type: 'line', data: { labels: S.map(s => s.label), datasets: list.map((am, i) => ({ label: am, data: S.map(s => s.per[am].open), borderColor: PAL[i], backgroundColor: PAL[i] + '1f', fill: true, tension: .3, pointRadius: 0, borderWidth: 1.5 })) }, options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { x: xAxis(), y: { ...yAxis(v => eurK(v)), stacked: true } }, plugins: { tooltip: { callbacks: { label: c => `${c.dataset.label}: ${eur(c.raw)}` } } } } });
    const last = S.at(-1), prev = S.at(-2); const t = k => sum(list, am => last.per[am][k]); const start = sum(list, am => prev.per[am].open);
    let run = start; const steps = [['Start', [0, start], GREY]]; [['Nieuw', t('nieuw'), INK], ['Gewonnen', -t('gewonnen'), COMP], ['Verloren', -t('verloren'), BAD], ['Gemuteerd', t('gemuteerd'), '#c9c6bf']].forEach(([l, v, c]) => { steps.push([l, [run, run + v], c]); run += v; }); steps.push(['Eind', [0, run], '#8f8d88']);
    mk('chWater', { type: 'bar', data: { labels: steps.map(s => s[0]), datasets: [{ data: steps.map(s => s[1]), backgroundColor: steps.map(s => s[2]), borderRadius: 3 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => eur(c.raw[1] - c.raw[0]) } } }, scales: { x: xAxis(), y: yAxis(v => eurK(v), { min: Math.floor(start * 0.8 / 1e5) * 1e5 }) } } });
  };

  // ----- Opzet -----
  function pageOpzet() {
    return head('Technische opzet', 'Een beperkte extra laag bovenop wat er al staat.', '', false) + `
      <div class="card" style="margin-bottom:14px">${cardhead('Dataflow', 'Bronsysteem → reporting-datalaag → dashboard / CoPilot')}
        <div class="arch">
          <div class="node"><b>CRM / bronsysteem</b>Bestaande API's als primaire databron. Leads, afspraken, offertes, orders, adviseurs.</div>
          <div class="node"><b>Reporting-database</b>Azure · wekelijkse snapshots, afgeleide KPI's, aanvullende analyse-data.</div>
          <div class="node"><b>Webapplicatie</b>Dashboards, filters, drilldowns. Rechten op pagina- en datasetniveau.</div>
          <div class="node"><b>Microsoft 365 / Okta</b>Login, rollen en autorisatie. Eén set rechten voor dashboard én CoPilot.</div>
          <div class="node"><b>CoPilot-interface</b>Vragen op vooraf gedefinieerde datasets. Geen vrije databasetoegang.</div>
        </div></div>
      <div class="row">
        <div class="card c6">${cardhead('Rollen en zichtbaarheid', 'Wissel de rol rechtsboven om dit te zien')}
          <table><thead><tr><th>Onderdeel</th><th>Directie</th><th>Salesmanager</th><th>Adviseur</th></tr></thead><tbody>
          ${[['Overzicht', 1, 1, 'eigen'], ['Sales', 1, 1, 'eigen'], ['Producten (incl. marge)', 1, 'zonder marge', 0], ['Regio', 1, 1, 0], ['Pipeline', 1, 1, 'eigen'], ['CoPilot-datasets', 5, 5, 3]].map(r => `<tr><td>${r[0]}</td>${r.slice(1).map(v => `<td>${v === 1 ? '<span class="tag good">✓</span>' : v === 0 ? '<span class="tag">–</span>' : `<span class="tag warn">${v}</span>`}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
        <div class="card c6">${cardhead('Vooraf gedefinieerde datasets voor CoPilot', 'Een vraag wordt vertaald naar één dataset en beantwoord met dezelfde definities als het dashboard')}
          <table><thead><tr><th>Dataset</th><th>Beantwoordt</th></tr></thead><tbody>
            <tr><td><code>omzet-funnel</code></td><td>Waar in de funnel verandert omzet of conversie?</td></tr>
            <tr><td><code>adviseur-conversie</code></td><td>Welke adviseurs stijgen of dalen per funnelstap?</td></tr>
            <tr><td><code>regio-capaciteit</code></td><td>Waar past de vraag niet bij de capaciteit?</td></tr>
            <tr><td><code>product-groei</code></td><td>Welke producten en combinaties groeien of krimpen?</td></tr>
            <tr><td><code>pipeline-mutaties</code></td><td>Waarom beweegt de portefeuille, en bij wie?</td></tr>
          </tbody></table></div>
        <div class="card c12">${cardhead('Waarom dit sneller kan', 'AI-assisted maatwerk verandert de business case')}
          <div class="row" style="margin-top:0"><div class="c4"><b>Weken in plaats van maanden</b><p class="hint">Mens ontwerpt het systeem, prompt, controleert en deployt. Het model bouwt. IT doet een audit.</p></div><div class="c4"><b>In eigen beheer</b><p class="hint">Geen externe bouwpartij. Historie en definities staan in de eigen Azure-omgeving.</p></div><div class="c4"><b>Eén omgeving, één rechtenset</b><p class="hint">Geen rapport-niveau rechten zoals bij losse BI-tools, maar pagina- en datasetniveau, voor mens én CoPilot.</p></div></div></div>
      </div>`;
  }

  // ---------- CoPilot ----------
  const QUESTIONS = [
    'De omzet is deze maand gedaald. Waar in de funnel gebeurt dit?',
    'Welke adviseurs hebben de grootste daling in afspraak naar offerte conversie ten opzichte van vorige maand?',
    'In welke regio hebben we veel leads maar te weinig adviseurs beschikbaar?',
    'Welke producten groeien het hardst?',
    'Waarom is de pipeline ineens gezakt met 400.000?',
  ];
  function answer(q) {
    const t = q.toLowerCase(); const r = role(); const src = (ds, def) => `<div class="src">dataset: <b>${ds}</b> · rol: ${r.label} · ${def}</div>`;
    const deny = ds => `<p class="deny">Geen toegang.</p><p>Dataset <code>${ds}</code> is niet beschikbaar voor de rol ${r.label}. Dezelfde rechten als in het dashboard gelden voor vragen via CoPilot.</p>${src(ds, 'geweigerd door M365-rol')}`;

    if (/(omzet|revenue).*(gedaald|daalt|daling|lager)|funnel/.test(t) && !/adviseur/.test(t)) {
      const base = scoped(); const cur = inMonths(base, [D.HUIDIG]), prev = inMonths(base, [D.VORIG]);
      const fc = funnelCounts(cur), fp = funnelCounts(prev); const s = stats(cur), p = stats(prev);
      const steps = fc.slice(1).map((x, i) => ({ stap: `${fc[i].stage} → ${x.stage}`, cur: x.n / (fc[i].n || 1), prev: fp[i + 1].n / (fp[i].n || 1) })).map(x => ({ ...x, d: x.cur - x.prev }));
      const worst = steps.slice().sort((a, b) => a.d - b.d)[0]; const wi = steps.indexOf(worst) + 1;
      const web = cur.filter(l => l.leadsoort === 'Website').length, webP = prev.filter(l => l.leadsoort === 'Website').length;
      let who = '';
      if (!r.eigen) { const advs = D.ADVISEURS.map(a => { const c = cur.filter(l => l.adviseur === a.id), pv = prev.filter(l => l.adviseur === a.id); const f = g => g.filter(l => l.stage >= wi).length / (g.filter(l => l.stage >= wi - 1).length || 1); return { a, d: f(c) - f(pv) }; }).sort((x, y) => x.d - y.d).slice(0, 2); who = `<p>De daling in die stap zit vooral bij <b>${advs.map(x => `${x.a.naam} (${(x.d * 100).toFixed(0)}pt)`).join('</b> en <b>')}</b>. De overige adviseurs bewegen binnen de normale bandbreedte.</p>`; }
      const id = 'mini' + Date.now();
      setTimeout(() => mk(id, { type: 'bar', data: { labels: steps.map(x => x.stap), datasets: [{ label: mLabel(D.VORIG), data: steps.map(x => +(x.prev * 100).toFixed(1)), backgroundColor: GREY, borderRadius: 2 }, { label: mLabel(D.HUIDIG), data: steps.map(x => +(x.cur * 100).toFixed(1)), backgroundColor: steps.map(x => x.d < -0.05 ? BAD : INK), borderRadius: 2 }] }, options: { maintainAspectRatio: false, scales: { x: { ...xAxis(), ticks: { font: { size: 9.5 } } }, y: yAxis(v => v + '%') }, plugins: { legend: { labels: { font: { size: 10 }, padding: 8 } } } } }), 30);
      return `<p>De omzet${r.eigen ? ' van jouw leads' : ''} is in ${mLabel(D.HUIDIG)} <b>${pct((s.omzet - p.omzet) / p.omzet, 0)}</b> (${eurK(s.omzet)} vs. ${eurK(p.omzet)}). Twee oorzaken:</p>
        <ul><li><b>Instroom:</b> ${pct((s.leads - p.leads) / p.leads, 0)} leads, vooral <b>Website</b> (${pct((web - webP) / webP, 0)}). Deels seizoen, deels lagere online instroom.</li>
        <li><b>Conversie:</b> de grootste daling zit bij <b>${worst.stap}</b>: van ${pct(worst.prev)} naar ${pct(worst.cur)} (${(worst.d * 100).toFixed(0)}pt). De andere stappen bewegen binnen de normale bandbreedte.</li></ul>
        <div class="mini"><canvas id="${id}"></canvas></div>${who}${src('omzet-funnel', 'omzet = gesloten orders in maand; conversie = aantal in stap / aantal in vorige stap')}`;
    }
    if (/adviseur/.test(t) && /(conversie|offerte|daling)/.test(t)) {
      if (r.eigen) { const c = inMonths(scoped(), [D.HUIDIG]), p = inMonths(scoped(), [D.VORIG]); const f = g => g.filter(l => l.stage >= 3).length / (g.filter(l => l.stage >= 1).length || 1); return `<p>Je rol geeft alleen toegang tot je eigen cijfers, dus ik kan geen vergelijking met andere adviseurs maken.</p><p>Jouw conversie afspraak → offerte: <b>${pct(f(c))}</b> in ${mLabel(D.HUIDIG)} tegenover ${pct(f(p))} in ${mLabel(D.VORIG)} (${((f(c) - f(p)) * 100).toFixed(0)}pt). De grootste uitval zit tussen opname en offerte: ${c.filter(l => l.stage === 2).length} opnames zonder offerte.</p>${src('adviseur-conversie', 'beperkt tot eigen adviseur-ID')}`; }
      const rows = D.ADVISEURS.map(a => { const f = g => { const x = g.filter(l => l.adviseur === a.id); return x.filter(l => l.stage >= 3).length / (x.filter(l => l.stage >= 1).length || 1); }; const c = f(inMonths(D.LEADS, [D.HUIDIG])), p = f(inMonths(D.LEADS, [D.VORIG])); return { a, c, p, d: c - p }; }).sort((x, y) => x.d - y.d);
      return `<p>Grootste daling in conversie afspraak → offerte, ${mLabel(D.HUIDIG)} t.o.v. ${mLabel(D.VORIG)}:</p><ul>${rows.slice(0, 3).map(x => `<li><b>${x.a.naam}</b> (${x.a.regio}): ${pct(x.p)} → ${pct(x.c)} (<b>${(x.d * 100).toFixed(0)}pt</b>)</li>`).join('')}</ul><p>Bij ${rows[0].a.naam} en ${rows[1].a.naam} zit de uitval na de opname: er worden opnames gedaan maar geen offerte uitgebracht. Dat is een ander patroon dan bij ${rows[2].a.naam}, waar de afspraak zelf vaker niet doorgaat.</p><p>Gemiddelde over alle adviseurs: ${(rows.reduce((a, x) => a + x.d, 0) / rows.length * 100).toFixed(0)}pt.</p>${src('adviseur-conversie', 'conversie = offertes / afspraken per adviseur per maand')}`;
    }
    if (/regio|provincie|capaciteit/.test(t)) {
      if (!r.datasets.includes('regio-capaciteit')) return deny('regio-capaciteit');
      const saved = { ...state.f }; state.f.leadsoort = state.f.adviseur = state.f.product = state.f.regio = '';
      const rows = regioRows([D.HUIDIG]).sort((a, b) => b.ratio - a.ratio); state.f = saved;
      const none = rows.filter(x => x.cap === 0), tekort = rows.filter(x => x.cap > 0 && x.ratio > 1.3), ruimte = rows.filter(x => x.cap > 0 && x.ratio < 0.7);
      return `<p>In ${mLabel(D.HUIDIG)} is de onbalans het grootst in:</p><ul>${tekort.map(x => `<li><b>${x.r.naam}</b>: ${x.s.leads} leads voor ${Math.round(x.cap)} afspraakslots (${x.ratio.toFixed(2)} leads per slot, ${x.advs} adviseur). Conversie ${pct(x.s.conv, 1)}.</li>`).join('')}<li><b>Zonder eigen adviseur</b>: ${none.map(x => `${x.r.naam} (${x.s.leads})`).join(', ')}. Samen ${sum(none, x => x.s.leads)} leads die op afstand worden bediend, met een conversie van ${pct(sum(none, x => x.s.orders) / sum(none, x => x.s.leads), 1)} tegenover ${pct(sum(rows.filter(x => x.cap > 0), x => x.s.orders) / sum(rows.filter(x => x.cap > 0), x => x.s.leads), 1)} in regio's met eigen adviseur.</li></ul><p>Ruimte is er in ${ruimte.map(x => `${x.r.naam} (${x.ratio.toFixed(2)})`).join(' en ')}. Een herverdeling van ${ruimte[0]?.r.naam} naar Zuid-Holland zou de druk daar het snelst verlagen.</p>${src('regio-capaciteit', 'capaciteit = som afspraakslots adviseurs in regio × 4,33 weken')}`;
    }
    if (/product|groei|verkoopt|verkopen/.test(t)) {
      if (!r.datasets.includes('product-groei')) return deny('product-groei');
      const g = productGrowth();
      return `<p>Groei in omzet, laatste 3 maanden t.o.v. de 3 maanden ervoor:</p><ul>${g.slice(0, 3).map(x => `<li><b>${x.p.naam}</b>: ${x.g >= 0 ? '+' : ''}${pct(x.g, 0)} (${eurK(x.prev)} → ${eurK(x.cur)})</li>`).join('')}</ul><p>Achterblijvers: ${g.slice(-2).map(x => `<b>${x.p.naam}</b> (${pct(x.g, 0)})`).join(' en ')}. ${g.at(-1).p.naam} verliest al meerdere maanden op rij aandeel${r.marge ? `, terwijl ${g[0].p.naam} met ${pct(g[0].p.marge)} ook een hogere marge heeft dan ${g.at(-1).p.naam} (${pct(g.at(-1).p.marge)})` : ''}.</p><p>${g[0].p.naam} wordt in ${pct(D.LEADS.filter(l => l.stage >= 4 && l.items.includes(g[0].p.naam) && l.items.length > 1).length / (D.LEADS.filter(l => l.stage >= 4 && l.items.includes(g[0].p.naam)).length || 1), 0)} van de orders gecombineerd met een ander product, meestal ${(() => { const c = {}; D.LEADS.filter(l => l.stage >= 4 && l.items.includes(g[0].p.naam) && l.items.length > 1).forEach(l => l.items.filter(i => i !== g[0].p.naam).forEach(i => c[i] = (c[i] || 0) + 1)); return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] || '–'; })()}.</p>${src('product-groei', 'omzet per product = orderwaarde gedeeld over producten in de order')}`;
    }
    if (/pipeline|portefeuille|gezakt|400/.test(t)) {
      const list = role().eigen ? [role().naam] : D.ACCOUNTMANAGERS; const last = D.SNAPSHOTS.at(-1), prev = D.SNAPSHOTS.at(-2);
      const d = sum(list, am => last.per[am].open - prev.per[am].open); const per = list.map(am => ({ am, ...last.per[am], d: last.per[am].open - prev.per[am].open })).sort((a, b) => a.d - b.d);
      const big = per[0]; const avgVerloren = sum(D.SNAPSHOTS.slice(-9, -1), s => sum(list, am => s.per[am].verloren)) / 8;
      return `<p>De ${r.eigen ? 'eigen ' : ''}portefeuille daalde van ${eurK(sum(list, am => prev.per[am].open))} naar ${eurK(sum(list, am => last.per[am].open))} tussen ${prev.label} en ${last.label}: <b>${eurK(d)}</b>.</p><ul><li><b>Verloren:</b> ${eurK(sum(list, am => last.per[am].verloren))}, tegenover gemiddeld ${eurK(avgVerloren)} per week in de 8 weken ervoor.</li><li><b>Gemuteerd:</b> ${eurK(sum(list, am => last.per[am].gemuteerd))} (offertes verlaagd in waarde).</li><li><b>Nieuw:</b> ${eurK(sum(list, am => last.per[am].nieuw))}, ${sum(list, am => last.per[am].nieuw) < sum(list, am => prev.per[am].nieuw) ? 'lager dan' : 'vergelijkbaar met'} vorige week.</li></ul>${r.eigen ? '' : `<p>Vrijwel de hele daling zit bij <b>${big.am}</b>: ${eurK(big.d)} in één week, waarvan ${eurK(big.verloren)} verloren. Dat past bij één of enkele grote offertes die zijn verlopen of afgewezen, niet bij een brede trend. Bij de andere accountmanagers bewegen de cijfers binnen de normale weekbandbreedte.</p>`}${src('pipeline-mutaties', 'wekelijkse snapshot; mutaties = verschil tussen twee snapshots per offerte')}`;
    }
    if (/leadsoort|website|leads.*dalen/.test(t)) {
      const cur = inMonths(scoped(), [D.HUIDIG]), prev = inMonths(scoped(), [D.VORIG]);
      const rows = D.LEADSOORTEN.map(ls => ({ ls, c: cur.filter(l => l.leadsoort === ls).length, p: prev.filter(l => l.leadsoort === ls).length })).map(x => ({ ...x, d: (x.c - x.p) / (x.p || 1) })).sort((a, b) => a.d - b.d);
      return `<p>Leads per soort, ${mLabel(D.HUIDIG)} t.o.v. ${mLabel(D.VORIG)}:</p><ul>${rows.map(x => `<li><b>${x.ls}</b>: ${x.p} → ${x.c} (${x.d >= 0 ? '+' : ''}${pct(x.d, 0)})</li>`).join('')}</ul><p>Het seizoenspatroon verklaart ongeveer −10%. ${rows[0].ls} daalt duidelijk harder dan dat; de overige soorten volgen het seizoen.</p>${src('omzet-funnel', 'leads per leadsoort per maand')}`;
    }
    return `<p>Deze vraag valt buiten de vooraf gedefinieerde datasets voor jouw rol. CoPilot krijgt geen vrije toegang tot de onderliggende database.</p><p>Beschikbaar voor <b>${r.label}</b>: ${r.datasets.map(d => `<code>${d}</code>`).join(', ')}. Probeer één van de voorbeeldvragen hieronder.</p>${src('–', 'geen dataset gematcht')}`;
  }
  function openCopilot(q) { $('#copilot').hidden = false; $('#app').classList.add('copilot-open'); charts.forEach(c => c.resize()); if (q) ask(q); }
  function closeCopilot() { $('#copilot').hidden = true; $('#app').classList.remove('copilot-open'); charts.forEach(c => c.resize()); }
  function ask(q) {
    const msgs = $('#msgs');
    msgs.insertAdjacentHTML('beforeend', `<div class="msg user">${q}</div>`);
    const tid = 't' + Date.now();
    msgs.insertAdjacentHTML('beforeend', `<div class="msg bot" id="${tid}"><span class="typing"><i></i><i></i><i></i></span></div>`);
    msgs.scrollTop = msgs.scrollHeight;
    setTimeout(() => { const el = document.getElementById(tid); el.innerHTML = answer(q); msgs.scrollTop = msgs.scrollHeight; setTimeout(() => msgs.scrollTop = msgs.scrollHeight, 120); }, 700 + Math.random() * 500);
  }
  function resetCopilot() {
    $('#msgs').innerHTML = `<div class="msg bot"><p>Hoi ${role().naam.split(' ')[0]}. Ik beantwoord businessvragen op dezelfde datasets en definities als het dashboard, binnen de rechten van je rol <b>${role().label}</b>.</p></div>`;
    $('#chips').innerHTML = QUESTIONS.map(q => `<button class="qchip" data-ask="${q}">${q}</button>`).join('');
  }

  // ---------- Events ----------
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-ask]'); if (a) { openCopilot(a.dataset.ask); return; }
    const cl = e.target.closest('[data-clear]'); if (cl) { if (cl.dataset.clear === 'all') { state.f.leadsoort = state.f.adviseur = state.f.product = state.f.regio = ''; } else state.f[cl.dataset.clear] = ''; render(); return; }
    const dm = e.target.closest('[data-dim]'); if (dm) { state.dim[dm.closest('[data-dimkey]').dataset.dimkey] = dm.dataset.dim; render(); return; }
    const d = e.target.closest('[data-set]'); if (d && d.dataset.val) { setFilter(d.dataset.set, d.dataset.val); return; }
    if (e.target.closest('[data-copilot]')) { $('#copilot').hidden ? openCopilot() : closeCopilot(); return; }
    const n = e.target.closest('.nav'); if (n && !n.disabled) { state.page = n.dataset.page; render(); }
  });
  function setRole(k) { state.role = k; state.f.adviseur = ''; if (!role().pages.includes('regio')) state.f.regio = ''; $('#roleTrig span').textContent = `${role().label} · ${role().naam}`; closePop(); resetCopilot(); render(); }
  $('#closeCopilot').onclick = closeCopilot;
  $('#askForm').onsubmit = e => { e.preventDefault(); const v = $('#askInput').value.trim(); if (!v) return; $('#askInput').value = ''; ask(v); };

  // Deep links: #page=sales&role=adviseur&ask=<vraag>&regio=Zuid-Holland&product=Warmtepomp&van=2026-07&tot=2026-09
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('role') && ROLES[h.get('role')]) { state.role = h.get('role'); $('#roleTrig span').textContent = `${role().label} · ${role().naam}`; }
  if (h.get('page')) state.page = h.get('page');
  ['van', 'tot', 'leadsoort', 'adviseur', 'product', 'regio'].forEach(k => { if (h.get(k)) state.f[k] = h.get(k); });
  resetCopilot();
  render();
  if (h.get('open')) { const t = document.querySelector(`[data-dd="${h.get('open')}"]`); if (t) openPop(h.get('open'), t); }
  if (h.get('ask')) openCopilot(h.get('ask'));
  else if (h.get('copilot')) openCopilot();
})();
