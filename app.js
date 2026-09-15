(function () {
  const D = window.DATA;
  const $ = sel => document.querySelector(sel);
  const TODAY = D.VANDAAG, START = '2025-09-01';

  // ---------- Rollen (gesimuleerde Microsoft 365-rollen) ----------
  const ROLES = {
    directie: { naam: 'Daniël Roos', label: 'Directie', pages: ['overzicht', 'b2c', 'b2b', 'product', 'regio', 'pipeline', 'opzet'], marge: true, datasets: ['omzet-funnel', 'adviseur-conversie', 'regio-capaciteit', 'product-groei', 'pipeline-mutaties'] },
    sales: { naam: 'Merel Koning', label: 'Salesmanager', pages: ['overzicht', 'b2c', 'b2b', 'product', 'regio', 'pipeline', 'opzet'], marge: false, datasets: ['omzet-funnel', 'adviseur-conversie', 'regio-capaciteit', 'product-groei', 'pipeline-mutaties'] },
    adviseur: { naam: 'Lotte Bakker', label: 'Adviseur', pages: ['overzicht', 'b2c', 'b2b', 'pipeline', 'opzet'], marge: false, adviseurId: 'a3', datasets: ['omzet-funnel', 'adviseur-conversie', 'pipeline-mutaties'], eigen: true },
  };
  const PAGE_SEG = { b2c: 'B2C', b2b: 'B2B', pipeline: 'B2B' };
  const KLANT = Object.fromEntries(D.KLANTEN.map(k => [k.id, k]));
  const state = {
    role: 'directie', page: 'overzicht', detail: null,
    f: { leadsoort: '', adviseur: '', product: '', regio: '', klanttype: '', top: false, actief: false, ontevreden: false },
    kp: { preset: 'vandaag', van: TODAY, tot: TODAY },
    chart: {}, drill: {}, dim: {},
  };
  let charts = [];

  // ---------- Datums ----------
  const parse = iso => new Date(iso + 'T00:00:00Z');
  const toISO = d => d.toISOString().slice(0, 10);
  const addDays = (iso, n) => { const d = parse(iso); d.setUTCDate(d.getUTCDate() + n); return toISO(d); };
  const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
  const MND = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  const fmtD = iso => `${+iso.slice(8, 10)} ${MND[+iso.slice(5, 7) - 1]}`;
  const fmtDY = iso => `${fmtD(iso)} ${iso.slice(0, 4)}`;
  const mKey = iso => iso.slice(0, 7);
  const mLabel = key => `${MND[+key.slice(5, 7) - 1]} ${key.slice(2, 4)}`;
  const monthEnd = key => { const d = parse(key + '-01'); d.setUTCMonth(d.getUTCMonth() + 1); return addDays(toISO(d), -1); };
  const weekStart = iso => { const d = parse(iso); const wd = (d.getUTCDay() + 6) % 7; return addDays(iso, -wd); };
  const wKey = iso => weekStart(iso);
  const isoWeek = iso => { const d = parse(iso); d.setUTCDate(d.getUTCDate() + 4 - ((d.getUTCDay() + 6) % 7 + 1)); const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)); return Math.ceil(((d - y) / 86400000 + 1) / 7); };
  const wLabel = key => `wk ${isoWeek(key)}`;
  const KEYS = D.MAANDEN.map(m => m.key);
  const WEEKS = (() => { const out = []; let w = weekStart(addDays(TODAY, -7 * 25)); while (w <= TODAY) { out.push(w); w = addDays(w, 7); } return out; })();

  // Bucket (maand of week) → van/tot en vergelijking: zelfde span ervoor; lopende bucket = zelfde dagen
  function bucket(gran, key) {
    if (gran === 'week') { const van = key, tot = addDays(key, 6) > TODAY ? TODAY : addDays(key, 6); const n = daysBetween(van, tot); return { gran, key, van, tot, pvan: addDays(van, -7), ptot: addDays(van, -7 + n), label: wLabel(key) + (tot === TODAY && n < 6 ? ` (t/m ${fmtD(TODAY)})` : ''), plabel: `wk ${isoWeek(addDays(van, -7))}${n < 6 ? ', zelfde dagen' : ''}` }; }
    const van = key + '-01', end = monthEnd(key), tot = end > TODAY ? TODAY : end; const pk = mKey(addDays(van, -1)); const pEnd = monthEnd(pk); const n = daysBetween(van, tot);
    const ptot = tot === end ? pEnd : (addDays(pk + '-01', n) > pEnd ? pEnd : addDays(pk + '-01', n));
    return { gran, key, van, tot, pvan: pk + '-01', ptot, label: mLabel(key) + (tot !== end ? ` (t/m ${fmtD(tot)})` : ''), plabel: mLabel(pk) + (tot !== end ? ` (1 – ${+ptot.slice(8, 10)} ${MND[+pk.slice(5, 7) - 1]})` : '') };
  }
  function period() {
    const k = state.kp; const t = TODAY;
    if (k.preset === 'vandaag') return { van: t, tot: t, pvan: addDays(t, -1), ptot: addDays(t, -1), label: `vandaag, ${fmtD(t)}`, plabel: 'gisteren' };
    if (k.preset === 'gisteren') { const y = addDays(t, -1); return { van: y, tot: y, pvan: addDays(t, -2), ptot: addDays(t, -2), label: `gisteren, ${fmtD(y)}`, plabel: 'eergisteren' }; }
    if (k.preset === 'week') { const b = bucket('week', weekStart(t)); return { ...b, label: `deze week, ${fmtD(b.van)} – ${fmtD(b.tot)}`, plabel: 'vorige week, zelfde dagen' }; }
    if (k.preset === 'maand') { const b = bucket('maand', mKey(t)); return { ...b, label: `deze maand, 1 – ${fmtD(t)}`, plabel: `vorige maand, 1 – ${+b.ptot.slice(8, 10)} ${MND[+b.pvan.slice(5, 7) - 1]}` }; }
    if (k.preset === 'jaar') return { van: t.slice(0, 4) + '-01-01', tot: t, pvan: '1900-01-01', ptot: '1900-01-01', label: `dit jaar, 1 jan – ${fmtD(t)}`, plabel: 'vorig jaar (niet in de dataset)' };
    const n = daysBetween(k.van, k.tot); return { van: k.van, tot: k.tot, pvan: addDays(k.van, -n - 1), ptot: addDays(k.van, -1), label: k.van === k.tot ? fmtDY(k.van) : `${fmtD(k.van)} – ${fmtDY(k.tot)}`, plabel: `${fmtD(addDays(k.van, -n - 1))} – ${fmtD(addDays(k.van, -1))}` };
  }

  // ---------- Helpers ----------
  const eur = n => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
  const eurK = n => Math.abs(n) >= 1e6 ? `€ ${(n / 1e6).toLocaleString('nl-NL', { maximumFractionDigits: 2 })} mln` : Math.abs(n) >= 10000 ? `€ ${Math.round(n / 1000)}k` : eur(n);
  const num = n => new Intl.NumberFormat('nl-NL').format(n);
  const pct = (n, d = 0) => `${(n * 100).toLocaleString('nl-NL', { maximumFractionDigits: d })}%`;
  const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);
  const groupBy = (arr, f) => arr.reduce((m, x) => { const k = f(x); if (k == null) return m; (m[k] = m[k] || []).push(x); return m; }, {});
  const advNaam = id => (D.ADVISEURS.find(a => a.id === id) || {}).naam || id;
  const dtxt = (cur, prev) => { if (!prev) return '<span class="dim">–</span>'; const d = (cur - prev) / prev; return `<span class="${Math.abs(d) < 0.005 ? 'dim' : d > 0 ? 'pos' : 'neg'}">${d >= 0 ? '+' : '−'}${pct(Math.abs(d), 1)}</span>`; };
  const INK = '#e0712c', ACC = '#3b8ed6', GREY = '#e3e1dc', BAD = '#b8392e';
  const PAL = ['#e0712c', '#3b8ed6', '#f2a778', '#8fbde6', '#f8caa9', '#c2dbf2', '#fce4d4', '#e3eef9', '#c9c6bf', '#e8e6e1'];
  const role = () => ROLES[state.role];

  Chart.defaults.font.family = "'Mulish', system-ui, sans-serif";
  Chart.defaults.font.size = 12;
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
  const segOf = () => state.detail ? '' : (PAGE_SEG[state.page] || '');
  const scoped = () => role().eigen ? D.LEADS.filter(l => l.adviseur === role().adviseurId) : D.LEADS;
  const dimFilters = () => { const o = {}; ['leadsoort', 'adviseur', 'product', 'regio'].forEach(k => { if (state.f[k]) o[k] = state.f[k]; }); if (segOf() === 'B2B') { if (state.f.klanttype) o.klanttype = state.f.klanttype; ['top', 'actief', 'ontevreden'].forEach(k => { if (state.f[k]) o[k] = true; }); } return o; };
  const match = (l, f) => Object.entries(f).every(([k, v]) => {
    if (k === 'product') return l.items.includes(v);
    if (k === 'klanttype') return l.klant && KLANT[l.klant].type === v;
    if (k === 'top' || k === 'actief' || k === 'ontevreden') return l.klant && KLANT[l.klant][k];
    if (k === 'klant') return l.klant === v;
    return l[k] === v;
  });
  const filtered = () => { const f = dimFilters(); const seg = segOf(); const d = state.detail; return scoped().filter(l => (!seg || l.segment === seg) && match(l, f) && (!d || match(l, { [d.type]: d.id }))); };
  const byLead = (leads, van, tot) => leads.filter(l => l.datum >= van && l.datum <= tot);
  const byOrder = (leads, van, tot) => leads.filter(l => l.orderDatum && l.orderDatum >= van && l.orderDatum <= tot);
  const stats = (leads, van, tot) => {
    const c = byLead(leads, van, tot), o = byOrder(leads, van, tot);
    return { leads: c.length, afspraken: c.filter(l => l.stage >= 1).length, opnames: c.filter(l => l.stage >= 2).length, offertes: c.filter(l => l.stage >= 3).length, orders: o.length, omzet: sum(o, l => l.waarde), marge: sum(o, l => l.waarde * l.marge), conv: c.length ? c.filter(l => l.stage >= 4).length / c.length : 0, cohort: c, orderlist: o };
  };
  const funnelCounts = leads => D.STAGES.slice(0, 5).map((s, i) => ({ stage: s, n: leads.filter(l => l.stage >= i).length }));
  const regioCap = r => sum(D.ADVISEURS.filter(a => a.regio === r), a => a.cap) * 4.33;

  // ---------- Render ----------
  function render(opts = {}) {
    closePop(); clearCharts();
    const main = $('#main'); const scroll = main.scrollTop;
    const r = role();
    if (!state.detail && !r.pages.includes(state.page)) state.page = r.pages[0];
    document.querySelectorAll('.nav').forEach(b => { b.disabled = !r.pages.includes(b.dataset.page); b.classList.toggle('active', !state.detail && b.dataset.page === state.page); });
    $('#cpScope').textContent = `${r.label} · ${r.naam} · ${r.datasets.length} datasets`;
    const pages = { overzicht: pageOverzicht, b2c: pageB2C, b2b: pageB2B, product: pageProduct, regio: pageRegio, pipeline: pagePipeline, opzet: pageOpzet };
    main.innerHTML = state.detail ? pageDetail() : pages[state.page]();
    if ($('#filters')) renderFilters();
    (state.detail ? afterDetail : afterRender[state.page] || (() => { }))();
    main.scrollTop = opts.top ? 0 : scroll;
  }
  const afterRender = {};

  // ---------- Filters ----------
  let pop = { key: null, pending: null, q: '' };
  const FILTER_DEFS = () => {
    const d = state.detail ? state.detail.type : '';
    return [
      { key: 'leadsoort', label: 'Leadsoort', all: 'Alle leadsoorten', opts: D.LEADSOORTEN.map(x => ({ v: x, l: x })) },
      ...(role().eigen || d === 'adviseur' ? [] : [{ key: 'adviseur', label: 'Adviseur', all: 'Alle adviseurs', opts: D.ADVISEURS.map(a => ({ v: a.id, l: a.naam, sub: a.regio })), search: true }]),
      ...(d === 'product' ? [] : [{ key: 'product', label: 'Product', all: 'Alle producten', opts: D.PRODUCTEN.map(x => ({ v: x.naam, l: x.naam })) }]),
      ...(role().pages.includes('regio') && d !== 'regio' ? [{ key: 'regio', label: 'Regio', all: "Alle regio's", opts: D.REGIOS.map(x => ({ v: x.naam, l: x.naam })), search: true }] : []),
      ...(segOf() === 'B2B' ? [{ key: 'klanttype', label: 'Klanttype', all: 'Alle klanttypen', opts: D.KLANTTYPES.map(x => ({ v: x, l: x })) }] : []),
    ];
  };
  function renderFilters() {
    const r = role(); const active = Object.keys(dimFilters()).length; const defs = state.page === 'pipeline' && !state.detail ? FILTER_DEFS().filter(f => f.key === 'adviseur' || f.key === 'klanttype') : FILTER_DEFS();
    const trig = (key, label, on) => `<button class="dd ${on ? 'on' : ''}" data-dd="${key}"><span>${label}</span><svg viewBox="0 0 10 6"><path d="M1 1l4 4 4-4"/></svg></button>`;
    const flags = segOf() === 'B2B' && state.page !== 'pipeline' ? [['top', 'Topklant'], ['actief', 'Actieve klant'], ['ontevreden', 'Ontevreden klant']].map(([k, l]) => `<button class="flag ${state.f[k] ? 'on' : ''}" data-flag="${k}">${l}</button>`).join('') : '';
    $('#filters').innerHTML = `${defs.map(f => { const v = state.f[f.key]; const o = v && f.opts.find(o => o.v === v); return trig(f.key, o ? `${f.label}: <b>${o.l}</b>` : f.label, !!o); }).join('')}${flags}
      ${active ? '<button class="clear" data-clear="all">Wis filters</button>' : ''}
      <span class="scope">${r.eigen ? `Alleen eigen gegevens · ${r.naam}` : ''}</span>`;
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
    if (pop.key === 'role') { el.innerHTML = `<div class="list">${Object.entries(ROLES).map(([k, r]) => `<button class="opt ${state.role === k ? 'on' : ''}" data-opt="${k}"><span>${r.label}</span><small>${r.naam}</small></button>`).join('')}</div>`; return; }
    const f = FILTER_DEFS().find(x => x.key === pop.key); if (!f) return closePop();
    const q = pop.q.toLowerCase(); const opts = f.opts.filter(o => !q || o.l.toLowerCase().includes(q) || (o.sub || '').toLowerCase().includes(q));
    el.innerHTML = `<div class="list">
      ${f.search ? `<div class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input placeholder="Zoek ${f.label.toLowerCase()}…" value="${pop.q}"></div>` : ''}
      <button class="opt ${!state.f[f.key] ? 'on' : ''}" data-opt="">${f.all}</button>
      ${opts.map(o => `<button class="opt ${state.f[f.key] === o.v ? 'on' : ''}" data-opt="${o.v}"><span>${o.l}</span>${o.sub ? `<small>${o.sub}</small>` : ''}</button>`).join('')}
      ${opts.length ? '' : '<div class="none">Geen resultaten</div>'}</div>`;
  }

  // ---------- Periode-keuze (Kerncijfers) ----------
  let cal = { view: mKey(addDays(monthEnd(mKey(TODAY)), -40)), pin: false, pending: null };
  function periodControl() {
    const P = [['vandaag', 'Vandaag'], ['gisteren', 'Gisteren'], ['week', 'Deze week'], ['maand', 'Deze maand'], ['jaar', 'Dit jaar']];
    const k = state.kp; const p = period();
    return `<div class="pc">${P.map(([v, l]) => `<button class="${k.preset === v ? 'on' : ''}" data-kp="${v}">${l}</button>`).join('')}
      <div class="custom ${cal.pin ? 'pin' : ''}"><button class="${k.preset === 'custom' ? 'on' : ''}" data-kp="custom">${k.preset === 'custom' ? p.label : 'Kies datums'} <svg viewBox="0 0 10 6"><path d="M1 1l4 4 4-4"/></svg></button><div class="calpop">${calendar()}</div></div></div>`;
  }
  function calendar() {
    const k = state.kp; const a = cal.pending || (k.preset === 'custom' ? k.van : null), b = cal.pending ? null : (k.preset === 'custom' ? k.tot : null);
    const months = [cal.view, mKey(addDays(monthEnd(cal.view), 1))];
    const grid = m => {
      const first = m + '-01', start = weekStart(first), last = monthEnd(m); let d = start; const cells = [];
      while (d <= last || cells.length % 7) { const out = mKey(d) !== m, dis = d < START || d > TODAY; const inR = a && b && d >= a && d <= b; cells.push(`<button class="day ${out ? 'out' : ''} ${inR ? 'in' : ''} ${d === a ? 'start' : ''} ${d === b ? 'end' : ''} ${d === TODAY ? 'today' : ''}" data-day="${d}" ${dis ? 'disabled' : ''}>${+d.slice(8, 10)}</button>`); d = addDays(d, 1); }
      return `<div class="cm"><div class="cmh">${MND[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}</div><div class="cg"><span>ma</span><span>di</span><span>wo</span><span>do</span><span>vr</span><span>za</span><span>zo</span>${cells.join('')}</div></div>`;
    };
    return `<div class="calhead"><button data-calnav="-1" ${cal.view <= mKey(START) ? 'disabled' : ''}>‹</button><span>${cal.pending ? `Kies een einddatum (start ${fmtD(cal.pending)})` : 'Klik op een start- en een einddatum'}</span><button data-calnav="1" ${months[1] >= mKey(TODAY) ? 'disabled' : ''}>›</button></div><div class="cals">${grid(months[0])}${grid(months[1])}</div>`;
  }

  // ---------- Componenten ----------
  const head = (title, sub, pill = '') => `<div class="page-head"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div class="right">${pill ? `<span class="pill">${pill}</span>` : ''}<button class="btn" data-copilot>✦ CoPilot</button></div></div><div class="filters" id="filters"></div>`;
  const section = (h, desc, body, right = '') => `<section class="section"><div class="stitle"><h2>${h}</h2><span>${desc}</span>${right ? `<div class="sright">${right}</div>` : ''}</div>${body}</section>`;
  const cardhead = (h, sub, right = '') => `<div class="cardhead"><div><h3>${h}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}</div>${right}</div>`;
  const kpi = (lbl, fmt, cur, prev, opts = {}) => {
    const val = typeof fmt === 'function' ? fmt(cur) : fmt; const vs = opts.vs ?? 'vs. vorige periode';
    let d = `<div class="d dim">${vs ? `– ${vs}` : '&nbsp;'}</div>`;
    if (prev) { const x = (cur - prev) / prev; const up = x >= 0; const good = opts.invert ? !up : up; d = `<div class="d ${Math.abs(x) < 0.005 ? 'dim' : good ? 'pos' : 'neg'}">${up ? '▲' : '▼'} ${pct(Math.abs(x), 0)} ${vs}</div>`; }
    const cmp = opts.cmp ?? (typeof fmt === 'function' && prev ? `${opts.cmpLabel || 'vorige periode'} ${fmt(prev)}` : '');
    return `<div class="kpi"><div class="lbl">${lbl}</div><div class="val">${val}</div>${d}${cmp ? `<div class="cmp">${cmp}</div>` : ''}</div>`;
  };
  const kpis = items => `<div class="kpis">${items.join('')}</div>`;
  const kpiSection = items => { const p = period(); return section('Kerncijfers', `${p.label} · vergeleken met ${p.plabel}`, kpis(items), periodControl()); };
  const longPeriod = () => { const p = period(); return daysBetween(p.van, p.tot) >= 27; };
  const convOrOpen = (s, q, base) => longPeriod() ? kpi('Conversie lead → order', v => pct(v, 1), s.conv, q.conv, { cmp: 'op leads uit deze periode' }) : kpi('Openstaande offertes', eurK, sum(base.filter(l => l.stage === 3), l => l.waarde), 0, { vs: '', cmp: `${num(base.filter(l => l.stage === 3).length)} offertes, nu open` });

  function funnelHtml(cur, prev) {
    const fc = funnelCounts(cur), fp = funnelCounts(prev); const max = fc[0].n || 1;
    return `<div class="funnel">${fc.map((s, i) => {
      const cv = i ? s.n / (fc[i - 1].n || 1) : 1, pv = i ? fp[i].n / (fp[i - 1].n || 1) : 1; const d = cv - pv;
      return `<div class="frow"><span>${s.stage}</span><div class="fb" style="width:${(s.n / max) * 100}%"></div><span class="n">${num(s.n)}</span><span class="cv">${i ? `${pct(cv)} <span class="${d < -0.03 ? 'neg' : d > 0.03 ? 'pos' : 'dim'}">${d >= 0 ? '+' : '−'}${Math.abs(d * 100).toFixed(0)}pt</span>` : ''}</span></div>`;
    }).join('')}</div>`;
  }
  function uitvalChart(id, cur) {
    const steps = ['Lead → afspraak', 'Afspraak → opname', 'Opname → offerte', 'Offerte → order'];
    mk(id, { type: 'bar', data: { labels: steps, datasets: D.LEADSOORTEN.map((ls, i) => ({ label: ls, data: steps.map((_, si) => { const g = cur.filter(l => l.leadsoort === ls); const a = g.filter(l => l.stage >= si).length, b = g.filter(l => l.stage >= si + 1).length; return a ? +((1 - b / a) * 100).toFixed(1) : 0; }), backgroundColor: PAL[i], borderRadius: 2 })) }, options: { maintainAspectRatio: false, onClick: (e, els) => { if (els.length) setFilter('leadsoort', D.LEADSOORTEN[els[0].datasetIndex]); }, onHover: pointer, scales: { x: xAxis(), y: yAxis(v => v + '%') }, plugins: { tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.raw}% uitval` } } } } });
  }

  // Dimensies voor stapelen en uitsplitsen
  const DIMS = { segment: 'Segment', leadsoort: 'Leadsoort', adviseur: 'Adviseur', product: 'Product', regio: 'Regio', klanttype: 'Klanttype', klant: 'Klant' };
  const dimVal = (l, dim) => dim === 'product' ? l.items[0] : dim === 'klanttype' ? (l.klant ? KLANT[l.klant].type : null) : dim === 'klant' ? l.klant : l[dim];
  const dimLabel = (dim, v) => dim === 'adviseur' ? advNaam(v) : dim === 'klant' ? (KLANT[v] || {}).naam || v : v;
  const dimValues = (dim, leads) => dim === 'segment' ? ['B2C', 'B2B'] : dim === 'leadsoort' ? D.LEADSOORTEN : dim === 'adviseur' ? D.ADVISEURS.map(a => a.id) : dim === 'product' ? D.PRODUCTEN.map(p => p.naam) : dim === 'regio' ? D.REGIOS.map(r => r.naam) : dim === 'klanttype' ? D.KLANTTYPES : Object.entries(groupBy(leads, l => l.klant)).sort((a, b) => sum(b[1], l => l.waarde) - sum(a[1], l => l.waarde)).slice(0, 8).map(x => x[0]);
  const availDims = () => { const f = dimFilters(); const seg = segOf(); const d = state.detail ? state.detail.type : ''; const b2b = seg === 'B2B' || d === 'klant'; return Object.keys(DIMS).filter(k => !(k in f) && k !== d && !(k === 'segment' && (seg || d === 'klant')) && !(k === 'adviseur' && role().eigen) && !(k === 'regio' && !role().pages.includes('regio')) && !((k === 'klanttype' || k === 'klant') && !b2b) && !(k === 'klant' && d === 'klant')); };

  // Tijdreeks: maanden of weken, gestapeld naar dimensie, klik = uitsplitsen onderaan
  function timeChart(id, ctxKey, dimOpts) {
    const c = state.chart[ctxKey] || (state.chart[ctxKey] = { gran: 'maand', stack: dimOpts[0] });
    if (!dimOpts.includes(c.stack) && c.stack !== 'totaal') c.stack = dimOpts[0];
    const base = filtered(); const keys = c.gran === 'week' ? WEEKS : KEYS; const kf = c.gran === 'week' ? wKey : mKey; const lbl = c.gran === 'week' ? wLabel : mLabel;
    const dr = state.drill[ctxKey]; const sel = k => dr && dr.gran === c.gran && dr.key === k;
    const vals = c.stack === 'totaal' ? [null] : dimValues(c.stack, base);
    const orders = base.filter(l => l.orderDatum);
    const ds = vals.map((v, i) => ({ type: 'bar', label: v == null ? 'Omzet' : dimLabel(c.stack, v), data: keys.map(k => sum(orders.filter(l => kf(l.orderDatum) === k && (v == null || dimVal(l, c.stack) === v)), l => l.waarde)), backgroundColor: keys.map(k => (v == null ? INK : PAL[i % PAL.length]) + (dr && !sel(k) ? '66' : '')), borderRadius: 3, stack: 's', _v: v }));
    ds.push({ type: 'line', label: 'Leads', data: keys.map(k => base.filter(l => kf(l.datum) === k).length), borderColor: '#8f8d88', backgroundColor: '#8f8d88', tension: .35, pointRadius: 0, borderWidth: 1.25, yAxisID: 'y1' });
    mk(id, { data: { labels: keys.map(lbl), datasets: ds }, options: { maintainAspectRatio: false, interaction: { mode: 'nearest', intersect: true }, onClick: (e, els) => { const el = els.find(x => x.datasetIndex < ds.length - 1); if (!el) return; const v = ds[el.datasetIndex]._v; state.drill[ctxKey] = { gran: c.gran, key: keys[el.index], dim: v == null ? null : c.stack, val: v }; render(); }, onHover: pointer, scales: { x: { ...xAxis(), stacked: true }, y: { ...yAxis(v => eurK(v)), stacked: true }, y1: { position: 'right', grid: { display: false }, border: { display: false }, ticks: { maxTicksLimit: 6 } } }, plugins: { tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.dataset.label === 'Leads' ? ctx.raw : eur(ctx.raw)}` } } } } });
  }
  const chartToggles = (ctxKey, dimOpts, withTotal) => {
    const c = state.chart[ctxKey] || { gran: 'maand', stack: dimOpts[0] };
    const opts = withTotal ? ['totaal', ...dimOpts] : dimOpts;
    return `<div class="toggles"><div class="seg" data-ctx="${ctxKey}">${[['maand', 'Maand'], ['week', 'Week']].map(([v, l]) => `<button class="${c.gran === v ? 'on' : ''}" data-gran="${v}">${l}</button>`).join('')}</div><div class="seg" data-ctx="${ctxKey}"><span class="segl">Stapel op</span>${opts.map(v => `<button class="${c.stack === v ? 'on' : ''}" data-stack="${v}">${v === 'totaal' ? 'Totaal' : DIMS[v]}</button>`).join('')}</div></div>`;
  };
  const chartSection = (ctxKey, dimOpts, withTotal = false) => section('Omzet over tijd', 'staven: omzet op orderdatum · lijn: nieuwe leads · klik op een staaf om die periode hieronder uit te splitsen', `<div class="card">${chartToggles(ctxKey, dimOpts, withTotal)}<div class="chart hero"><canvas id="ch_${ctxKey}"></canvas></div></div>`);

  // Onderste deel: scope = aangeklikte staaf (standaard de lopende maand of week)
  function drillScope(ctxKey) {
    const c = state.chart[ctxKey] || { gran: 'maand' }; const dr = state.drill[ctxKey];
    const b = dr ? bucket(dr.gran, dr.key) : bucket(c.gran, c.gran === 'week' ? wKey(TODAY) : mKey(TODAY));
    const base = filtered().filter(l => !dr || !dr.dim || dimVal(l, dr.dim) === dr.val);
    return { ...b, dr, cur: byLead(base, b.van, b.tot), prev: byLead(base, b.pvan, b.ptot), curO: byOrder(base, b.van, b.tot), prevO: byOrder(base, b.pvan, b.ptot) };
  }
  const scopePill = (ctxKey, sc) => `<span class="scopepill">${sc.label}${sc.dr && sc.dr.dim ? ` · ${DIMS[sc.dr.dim]}: ${dimLabel(sc.dr.dim, sc.dr.val)}` : ''}${sc.dr ? `<button data-undrill="${ctxKey}" aria-label="Terug naar lopende periode">×</button>` : ''}</span>`;

  function breakdown(ctxKey, sc) {
    const avail = availDims(); const dim = avail.includes(state.dim[ctxKey]) ? state.dim[ctxKey] : avail[0];
    const rows = dimValues(dim, sc.cur).map(k => { const f = l => dimVal(l, dim) === k; const c = sc.cur.filter(f), o = sc.curO.filter(f), po = sc.prevO.filter(f); return { k, leads: c.length, afspraken: c.filter(l => l.stage >= 1).length, offertes: c.filter(l => l.stage >= 3).length, orders: o.length, omzet: sum(o, l => l.waarde), marge: sum(o, l => l.waarde * l.marge), pOmzet: sum(po, l => l.waarde), conv: c.length ? o.length / c.length : 0 }; }).filter(r => r.leads || r.orders).sort((a, b) => b.omzet - a.omzet || b.leads - a.leads);
    const max = Math.max(1, ...rows.map(x => x.omzet)); const m = role().marge; const isEntity = dim === 'klant';
    return `<div class="card c12">${cardhead('Uitsplitsing', isEntity ? 'klik op een klant voor het klantoverzicht' : 'klik op een rij om de hele pagina te filteren', `<div class="dims" data-dimkey="${ctxKey}">${avail.map(k => `<button class="${k === dim ? 'on' : ''}" data-dim="${k}">${DIMS[k]}</button>`).join('')}</div>`)}
      ${rows.length ? `<table><thead><tr><th>${DIMS[dim]}</th><th class="num">Leads</th><th class="num">Afspraken</th><th class="num">Offertes</th><th class="num">Orders per lead</th><th class="num">Orders</th><th class="num">Omzet</th>${m ? '<th class="num">Marge</th>' : ''}<th class="num">Δ omzet</th></tr></thead><tbody>
      ${rows.map(r => `<tr class="drillrow" ${isEntity ? `data-detail="klant" data-id="${r.k}"` : `data-set="${dim}" data-val="${r.k}"`}><td>${dimLabel(dim, r.k)}</td><td class="num">${r.leads}</td><td class="num">${r.afspraken}</td><td class="num">${r.offertes}</td><td class="num">${pct(r.conv, 1)}</td><td class="num">${r.orders}</td><td class="num">${eur(r.omzet)}<span class="bar" style="width:${r.omzet / max * 56}px"></span></td>${m ? `<td class="num">${eur(r.marge)}</td>` : ''}<td class="num">${r.pOmzet < 3000 ? '<span class="dim">–</span>' : dtxt(r.omzet, r.pOmzet)}</td></tr>`).join('')}</tbody></table>` : '<div class="none">Geen gegevens in deze selectie</div>'}</div>`;
  }
  function records(sc) {
    const all = [...sc.cur, ...sc.curO.filter(l => !sc.cur.includes(l))];
    const recs = all.slice().sort((a, b) => b.stage - a.stage || b.waarde - a.waarde).slice(0, 50);
    const stageTag = st => `<span class="tag ${st >= 4 ? 'good' : st === 3 ? 'warn' : ''}">${D.STAGES[st]}</span>`;
    return `<details class="records"><summary>Records (${num(all.length)}${recs.length < all.length ? `, eerste ${recs.length} getoond` : ''})</summary>
      <div class="card" style="overflow-x:auto"><table class="recs"><thead><tr><th>#</th><th>Lead</th><th>Order</th><th>Segment</th><th>Klant</th><th>Adviseur</th><th>Regio</th><th>Leadsoort</th><th>Producten</th><th>Stap</th><th class="num">Waarde</th></tr></thead><tbody>
      ${recs.map(l => `<tr><td class="mono">L-${String(l.id).padStart(5, '0')}</td><td>${fmtD(l.datum)}</td><td>${l.orderDatum ? fmtD(l.orderDatum) : '–'}</td><td>${l.segment}</td><td>${l.klant ? `<a class="lnk" data-detail="klant" data-id="${l.klant}">${KLANT[l.klant].naam}</a>` : '–'}</td><td><a class="lnk" data-detail="adviseur" data-id="${l.adviseur}">${advNaam(l.adviseur)}</a></td><td>${l.regio}</td><td>${l.leadsoort}</td><td>${l.items.join(' + ')}</td><td>${stageTag(l.stage)}</td><td class="num">${l.waarde ? eur(l.waarde) : '–'}</td></tr>`).join('')}</tbody></table></div></details>`;
  }
  function bottom(ctxKey, extra = '') {
    const sc = drillScope(ctxKey);
    return section('Uitsplitsing', `vergeleken met ${sc.plabel}`, `<div class="row"><div class="card c5">${cardhead('Funnel', 'leads uit deze periode')}${funnelHtml(sc.cur, sc.prev)}</div><div class="card c7">${cardhead('Uitval per stap, per leadsoort', 'klik op een leadsoort om te filteren')}<div class="chart"><canvas id="uv_${ctxKey}"></canvas></div></div>${extra}${breakdown(ctxKey, sc)}</div>${records(sc)}`, scopePill(ctxKey, sc));
  }
  const afterBottom = ctxKey => { const sc = drillScope(ctxKey); uitvalChart('uv_' + ctxKey, sc.cur); };

  // Entiteitstabellen (klik = detail)
  function klantenTable(sc, limit = 12) {
    const rows = D.KLANTEN.map(k => { const f = l => l.klant === k.id; const c = sc.cur.filter(f), o = sc.curO.filter(f), po = sc.prevO.filter(f); return { k, leads: c.length, offertes: c.filter(l => l.stage >= 3).length, orders: o.length, omzet: sum(o, l => l.waarde), pOmzet: sum(po, l => l.waarde), open: sum(filtered().filter(l => l.klant === k.id && l.stage === 3), l => l.waarde) }; }).filter(r => r.leads || r.orders).sort((a, b) => b.omzet - a.omzet || b.leads - a.leads).slice(0, limit);
    const flags = k => `${k.top ? '<span class="tag good">top</span> ' : ''}${k.ontevreden ? '<span class="tag bad">ontevreden</span> ' : ''}${!k.actief ? '<span class="tag">inactief</span>' : ''}`;
    return `<div class="card c12">${cardhead('Klanten', `${rows.length} klanten met activiteit in deze periode · klik voor het klantoverzicht`)}<table><thead><tr><th>Klant</th><th>Type</th><th>Accountmanager</th><th></th><th class="num">Leads</th><th class="num">Offertes</th><th class="num">Orders</th><th class="num">Omzet</th><th class="num">Δ omzet</th><th class="num">Open offertes</th></tr></thead><tbody>
      ${rows.map(r => `<tr class="drillrow" data-detail="klant" data-id="${r.k.id}"><td>${r.k.naam}</td><td>${r.k.type}</td><td>${r.k.accountmanager}</td><td>${flags(r.k)}</td><td class="num">${r.leads}</td><td class="num">${r.offertes}</td><td class="num">${r.orders}</td><td class="num">${eur(r.omzet)}</td><td class="num">${r.pOmzet < 3000 ? '<span class="dim">–</span>' : dtxt(r.omzet, r.pOmzet)}</td><td class="num">${eur(r.open)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function adviseursTable(sc) {
    const advs = role().eigen ? D.ADVISEURS.filter(a => a.id === role().adviseurId) : D.ADVISEURS;
    const rows = advs.map(a => { const f = l => l.adviseur === a.id; const c = sc.cur.filter(f), o = sc.curO.filter(f), p = sc.prev.filter(f); const conv = c.filter(l => l.stage >= 1).length ? c.filter(l => l.stage >= 3).length / c.filter(l => l.stage >= 1).length : 0, convP = p.filter(l => l.stage >= 1).length ? p.filter(l => l.stage >= 3).length / p.filter(l => l.stage >= 1).length : 0; return { a, leads: c.length, afspraken: c.filter(l => l.stage >= 1).length, offertes: c.filter(l => l.stage >= 3).length, orders: o.length, omzet: sum(o, l => l.waarde), conv, d: conv - convP, cap: a.cap * (daysBetween(sc.van, sc.tot) + 1) / 7 }; }).sort((x, y) => y.omzet - x.omzet);
    return `<div class="card c12">${cardhead('Adviseurs', 'klik voor het adviseuroverzicht')}<table><thead><tr><th>Adviseur</th><th>Regio</th><th class="num">Leads</th><th class="num">Afspraken</th><th class="num">Bezetting</th><th class="num">Offertes</th><th class="num">Afspraak → offerte</th><th class="num">Δ</th><th class="num">Orders</th><th class="num">Omzet</th></tr></thead><tbody>
      ${rows.map(r => `<tr class="drillrow" data-detail="adviseur" data-id="${r.a.id}"><td>${r.a.naam}</td><td>${r.a.regio}</td><td class="num">${r.leads}</td><td class="num">${r.afspraken}</td><td class="num">${pct(r.afspraken / (r.cap || 1))}</td><td class="num">${r.offertes}</td><td class="num">${pct(r.conv)}</td><td class="num"><span class="${r.d < -0.05 ? 'neg' : r.d > 0.05 ? 'pos' : 'dim'}">${r.d >= 0 ? '+' : '−'}${Math.abs(r.d * 100).toFixed(0)}pt</span></td><td class="num">${r.orders}</td><td class="num">${eur(r.omzet)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  // ----- Overzicht -----
  const OV_DIMS = ['segment', 'leadsoort', 'adviseur', 'product'];
  function pageOverzicht() {
    const p = period(); const base = filtered(); const s = stats(base, p.van, p.tot), q = stats(base, p.pvan, p.ptot);
    const seg = v => ({ c: sum(s.orderlist.filter(l => l.segment === v), l => l.waarde), p: sum(q.orderlist.filter(l => l.segment === v), l => l.waarde) });
    const b2c = seg('B2C'), b2b = seg('B2B');
    return head('Overzicht', '', `${eurK(s.omzet)} omzet · ${num(s.orders)} orders · ${p.label}`) + kpiSection([
      kpi('Omzet', eurK, s.omzet, q.omzet), kpi('Omzet B2C', eurK, b2c.c, b2c.p), kpi('Omzet B2B', eurK, b2b.c, b2b.p),
      kpi('Leads', num, s.leads, q.leads), kpi('Afspraken', num, s.afspraken, q.afspraken), kpi('Offertes', num, s.offertes, q.offertes), kpi('Orders', num, s.orders, q.orders),
      convOrOpen(s, q, base), ...(role().marge ? [kpi('Marge', eurK, s.marge, q.marge)] : []),
    ]) + chartSection('ov', OV_DIMS, true) + bottom('ov');
  }
  afterRender.overzicht = () => { timeChart('ch_ov', 'ov', OV_DIMS); afterBottom('ov'); };

  // ----- Sales B2C -----
  const B2C_DIMS = ['leadsoort', 'adviseur', 'product', 'regio'];
  function pageB2C() {
    const p = period(); const base = filtered(); const s = stats(base, p.van, p.tot), q = stats(base, p.pvan, p.ptot);
    const r = (a, b) => b ? a / b : 0;
    const items = [kpi('Leads', num, s.leads, q.leads), kpi('Afspraken', num, s.afspraken, q.afspraken), kpi('Offertes', num, s.offertes, q.offertes), kpi('Orders', num, s.orders, q.orders),
      kpi('Afspraak → offerte', v => pct(v), r(s.offertes, s.afspraken), r(q.offertes, q.afspraken)), kpi('Gem. orderwaarde', eurK, r(s.omzet, s.orders), r(q.omzet, q.orders)), kpi('Omzet', eurK, s.omzet, q.omzet)];
    return head('Sales B2C', 'Particuliere klanten', `${num(s.leads)} leads · ${num(s.orders)} orders · ${p.label}`) + kpiSection(items) + chartSection('b2c', B2C_DIMS) + bottom('b2c', adviseursTable(drillScope('b2c')));
  }
  afterRender.b2c = () => { timeChart('ch_b2c', 'b2c', B2C_DIMS); afterBottom('b2c'); };

  // ----- Sales B2B -----
  const B2B_DIMS = ['klanttype', 'adviseur', 'leadsoort', 'klant', 'product'];
  function pageB2B() {
    const p = period(); const base = filtered(); const s = stats(base, p.van, p.tot), q = stats(base, p.pvan, p.ptot);
    const r = (a, b) => b ? a / b : 0;
    const kl = leads => new Set(leads.map(l => l.klant)).size;
    const topOmzet = leads => sum(leads.filter(l => KLANT[l.klant].top), l => l.waarde);
    const items = [kpi('Leads', num, s.leads, q.leads), kpi('Offertes', num, s.offertes, q.offertes), kpi('Orders', num, s.orders, q.orders), kpi('Omzet', eurK, s.omzet, q.omzet),
      kpi('Gem. orderwaarde', eurK, r(s.omzet, s.orders), r(q.omzet, q.orders)), kpi('Klanten met activiteit', num, kl([...s.cohort, ...s.orderlist]), kl([...q.cohort, ...q.orderlist])),
      kpi('Omzet topklanten', eurK, topOmzet(s.orderlist), topOmzet(q.orderlist), { cmp: `${pct(r(topOmzet(s.orderlist), s.omzet))} van de B2B-omzet` }),
      kpi('Open offertes bij ontevreden klanten', eurK, sum(base.filter(l => l.stage === 3 && KLANT[l.klant].ontevreden), l => l.waarde), 0, { vs: '', cmp: 'nu openstaand' })];
    return head('Sales B2B', 'Zakelijke klanten', `${num(s.orders)} orders · ${eurK(s.omzet)} · ${p.label}`) + kpiSection(items) + chartSection('b2b', B2B_DIMS) + bottom('b2b', klantenTable(drillScope('b2b')));
  }
  afterRender.b2b = () => { timeChart('ch_b2b', 'b2b', B2B_DIMS); afterBottom('b2b'); };

  // ----- Producten -----
  const PR_DIMS = ['product', 'segment', 'leadsoort'];
  function productGrowth() {
    const last3 = KEYS.slice(-4, -1), prev3 = KEYS.slice(-7, -4);
    return D.PRODUCTEN.map(p => { const f = l => l.orderDatum && l.items.includes(p.naam); const a = sum(D.LEADS.filter(l => f(l) && last3.includes(mKey(l.orderDatum))), l => l.waarde / l.items.length), b = sum(D.LEADS.filter(l => f(l) && prev3.includes(mKey(l.orderDatum))), l => l.waarde / l.items.length); return { p, cur: a, prev: b, g: b ? (a - b) / b : 0 }; }).sort((x, y) => y.g - x.g);
  }
  function pageProduct() {
    const p = period(); const base = filtered(); const s = stats(base, p.van, p.tot), q = stats(base, p.pvan, p.ptot); const m = role().marge;
    const multi = o => o.length ? o.filter(l => l.items.length > 1).length / o.length : 0;
    const items = [kpi('Omzet', eurK, s.omzet, q.omzet), kpi('Orders', num, s.orders, q.orders), kpi('Gem. orderwaarde', eurK, s.orders ? s.omzet / s.orders : 0, q.orders ? q.omzet / q.orders : 0), kpi('Orders met 2 producten', v => pct(v), multi(s.orderlist), multi(q.orderlist)),
      ...(m ? [kpi('Marge', eurK, s.marge, q.marge), kpi('Marge %', v => pct(v, 1), s.omzet ? s.marge / s.omzet : 0, q.omzet ? q.marge / q.omzet : 0)] : [])];
    const sc = drillScope('pr'); const o = sc.curO;
    const per = D.PRODUCTEN.map(pr => { const f = l => l.items.includes(pr.naam); const c = o.filter(f), pv = sc.prevO.filter(f); const om = sum(c, l => l.waarde / l.items.length); return { pr, n: c.length, omzet: om, prevOmzet: sum(pv, l => l.waarde / l.items.length), marge: om * pr.marge }; }).filter(x => x.n).sort((a, b) => b.omzet - a.omzet);
    const tot = sum(per, x => x.omzet); const max = Math.max(1, ...per.map(x => x.omzet));
    const combos = {}; o.filter(l => l.items.length > 1).forEach(l => { const k = l.items.slice().sort().join(' + '); combos[k] = (combos[k] || 0) + 1; }); const topCombos = Object.entries(combos).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const extra = `<div class="card c7">${cardhead('Producten', 'klik voor het productoverzicht')}${per.length ? `<table><thead><tr><th>Product</th><th class="num">Orders</th><th class="num">Omzet</th><th class="num">Aandeel</th>${m ? '<th class="num">Marge</th><th class="num">Marge %</th>' : ''}<th class="num">Δ omzet</th></tr></thead><tbody>${per.map(x => `<tr class="drillrow" data-detail="product" data-id="${x.pr.naam}"><td>${x.pr.naam}</td><td class="num">${x.n}</td><td class="num">${eur(x.omzet)}<span class="bar" style="width:${x.omzet / max * 56}px"></span></td><td class="num">${tot ? pct(x.omzet / tot) : '–'}</td>${m ? `<td class="num">${eur(x.marge)}</td><td class="num">${pct(x.pr.marge)}</td>` : ''}<td class="num">${x.prevOmzet < 3000 ? '<span class="dim">–</span>' : dtxt(x.omzet, x.prevOmzet)}</td></tr>`).join('')}</tbody></table>` : '<div class="none">Geen orders in deze periode</div>'}</div>
      <div class="card c5">${cardhead('Combinaties', 'producten die samen in één order zitten')}<table><thead><tr><th>Combinatie</th><th class="num">Orders</th></tr></thead><tbody>${topCombos.length ? topCombos.map(([k, n]) => `<tr><td>${k}</td><td class="num">${n}<span class="bar" style="width:${n / topCombos[0][1] * 56}px"></span></td></tr>`).join('') : '<tr><td colspan="2" class="dim">Geen combinaties in deze periode</td></tr>'}</tbody></table></div>`;
    return head('Producten', '', per[0] ? `${per[0].pr.naam} · ${pct(per[0].omzet / (tot || 1))} van de omzet · ${sc.label}` : sc.label) + kpiSection(items) + chartSection('pr', PR_DIMS) + bottom('pr', extra);
  }
  afterRender.product = () => { timeChart('ch_pr', 'pr', PR_DIMS); afterBottom('pr'); };

  // ----- Regio -----
  const RG_DIMS = ['regio', 'adviseur', 'segment'];
  function regioRows(sc) {
    return D.REGIOS.map(r => { const f = l => l.regio === r.naam; const c = sc.cur.filter(f), o = sc.curO.filter(f); const cap = regioCap(r.naam) * (daysBetween(sc.van, sc.tot) + 1) / 30.4; const advs = D.ADVISEURS.filter(a => a.regio === r.naam).length; return { r, leads: c.length, afspraken: c.filter(l => l.stage >= 1).length, orders: o.length, omzet: sum(o, l => l.waarde), conv: c.length ? o.length / c.length : 0, cap, advs, ratio: cap ? c.length / cap : Infinity }; });
  }
  const ratioColor = x => x === Infinity ? '#7d7a74' : x > 1.3 ? '#b8392e' : x > 0.9 ? '#e0712c' : x > 0.6 ? '#3b8ed6' : '#a3c9ec';
  function pageRegio() {
    const p = period(); const base = filtered(); const s = stats(base, p.van, p.tot), q = stats(base, p.pvan, p.ptot);
    const none = D.REGIOS.filter(r => regioCap(r.naam) === 0); const ext = s.cohort.filter(l => l.extern).length, extP = q.cohort.filter(l => l.extern).length;
    const items = [kpi('Leads', num, s.leads, q.leads), kpi('Afspraken', num, s.afspraken, q.afspraken), kpi('Orders', num, s.orders, q.orders), kpi('Omzet', eurK, s.omzet, q.omzet),
      kpi("Regio's zonder eigen adviseur", String(none.length), 0, 0, { vs: '', cmp: none.map(x => x.naam).join(', ') }), kpi('Leads op afstand bediend', v => pct(v), s.leads ? ext / s.leads : 0, q.leads ? extP / q.leads : 0)];
    const sc = drillScope('rg'); const rows = regioRows(sc).sort((a, b) => b.ratio - a.ratio);
    const extra = `<div class="card c4">${cardhead('Kaart', 'leads per beschikbaar afspraakslot · klik voor het regio-overzicht')}<div class="tiles">${D.REGIOS.map(r => { const x = rows.find(q => q.r.naam === r.naam); return `<div class="tile" data-detail="regio" data-id="${r.naam}" style="grid-column:${r.col + 1};grid-row:${r.row + 1};background:${ratioColor(x.ratio)}"><b>${r.naam}</b><small>${x.leads} · ${x.advs ? x.ratio.toFixed(2) : 'geen adviseur'}</small></div>`; }).join('')}</div><div class="legend"><span><i style="background:#a3c9ec"></i>ruimte</span><span><i style="background:#3b8ed6"></i>in balans</span><span><i style="background:#e0712c"></i>krap</span><span><i style="background:#b8392e"></i>tekort</span><span><i style="background:#7d7a74"></i>geen eigen adviseur</span></div></div>
      <div class="card c8">${cardhead("Regio's", 'gesorteerd op druk · klik voor het regio-overzicht')}<table><thead><tr><th>Regio</th><th class="num">Leads</th><th class="num">Orders</th><th class="num">Orders per lead</th><th class="num">Omzet</th><th class="num">Adviseurs</th><th class="num">Druk</th><th></th></tr></thead><tbody>${rows.map(x => `<tr class="drillrow" data-detail="regio" data-id="${x.r.naam}"><td>${x.r.naam}</td><td class="num">${x.leads}</td><td class="num">${x.orders}</td><td class="num">${pct(x.conv, 1)}</td><td class="num">${eur(x.omzet)}</td><td class="num">${x.advs}</td><td class="num">${x.cap ? x.ratio.toFixed(2) : '∞'}</td><td>${x.cap === 0 ? '<span class="tag">geen eigen adviseur</span>' : x.ratio > 1.3 ? '<span class="tag bad">tekort</span>' : x.ratio > 0.9 ? '<span class="tag warn">krap</span>' : '<span class="tag good">in balans</span>'}</td></tr>`).join('')}</tbody></table></div>${adviseursTable(sc)}`;
    return head('Regio', '', `${rows.filter(x => x.cap > 0 && x.ratio > 1.3).length + none.length} regio's onder druk · ${sc.label}`) + kpiSection(items) + chartSection('rg', RG_DIMS) + bottom('rg', extra);
  }
  afterRender.regio = () => { timeChart('ch_rg', 'rg', RG_DIMS); afterBottom('rg'); };

  // ----- Pipeline (B2B) -----
  const ams = () => { if (role().eigen) return [role().naam]; if (state.f.adviseur && D.ACCOUNTMANAGERS.includes(advNaam(state.f.adviseur))) return [advNaam(state.f.adviseur)]; return D.ACCOUNTMANAGERS; };
  const ptypes = () => state.f.klanttype ? [state.f.klanttype] : D.KLANTTYPES;
  const pv = (s, am, t, k) => s.per[am].types[t][k];
  const ptot = (s, k, am, t) => sum(am ? [am] : ams(), a => sum(t ? [t] : ptypes(), ty => pv(s, a, ty, k)));
  function pagePipeline() {
    const S = D.SNAPSHOTS; const last = S.at(-1), prev = S.at(-2), first = S[0];
    const stack = (state.chart.pipe || (state.chart.pipe = { stack: 'accountmanager' })).stack;
    const avgV = sum(S.slice(-9, -1), s => ptot(s, 'verloren')) / 8;
    const byAM = stack === 'accountmanager';
    const rows = (byAM ? ams() : ptypes()).map(k => { const g = (s, m) => byAM ? ptot(s, m, k) : ptot(s, m, null, k); const d = g(last, 'open') - g(prev, 'open'); const adv = byAM ? D.ADVISEURS.find(a => a.naam === k) : null; return { k, adv, open: g(last, 'open'), openP: g(prev, 'open'), nieuw: g(last, 'nieuw'), gewonnen: g(last, 'gewonnen'), verloren: g(last, 'verloren'), gemuteerd: g(last, 'gemuteerd'), d }; }).sort((a, b) => b.open - a.open);
    return head('Pipeline B2B', 'Openstaande offertes bij zakelijke klanten, elke week vastgelegd', `${eurK(ptot(last, 'open'))} open · ${last.label}`) + `
      ${section('Kerncijfers', `week van ${last.label} · vergeleken met ${prev.label}`, kpis([
        kpi('Open offertes', eurK, ptot(last, 'open'), ptot(prev, 'open'), { vs: 'vs. vorige week' }),
        kpi('Nieuw', eurK, ptot(last, 'nieuw'), ptot(prev, 'nieuw'), { vs: 'vs. vorige week' }),
        kpi('Gewonnen', eurK, ptot(last, 'gewonnen'), ptot(prev, 'gewonnen'), { vs: 'vs. vorige week' }),
        kpi('Verloren', eurK, ptot(last, 'verloren'), avgV, { vs: 'vs. gem. 8 weken', invert: true }),
        kpi('Gemuteerd', eurK, ptot(last, 'gemuteerd'), 0, { vs: '', cmp: 'waardewijzigingen op open offertes' }),
        kpi('Groei 26 weken', v => (v >= 0 ? '+' : '') + pct(v, 1), (ptot(last, 'open') - ptot(first, 'open')) / ptot(first, 'open'), 0, { vs: '', cmp: `${first.label} ${eurK(ptot(first, 'open'))} → ${last.label} ${eurK(ptot(last, 'open'))}` }),
      ]))}
      ${section('Portefeuille over tijd', '26 wekelijkse snapshots · klik op een vlak om te filteren', `<div class="card"><div class="toggles"><div class="seg" data-ctx="pipe"><span class="segl">Stapel op</span>${[['accountmanager', 'Accountmanager'], ['klanttype', 'Klanttype']].map(([v, l]) => `<button class="${stack === v ? 'on' : ''}" data-stack="${v}">${l}</button>`).join('')}</div></div><div class="chart hero"><canvas id="hero"></canvas></div></div>`)}
      ${section('Mutaties', `${prev.label} → ${last.label}`, `<div class="row"><div class="card c4">${cardhead('Deze week', '')}<div class="chart"><canvas id="chWater"></canvas></div></div>
        <div class="card c8">${cardhead(byAM ? 'Per accountmanager' : 'Per klanttype', byAM ? 'klik voor het adviseuroverzicht' : 'klik om te filteren')}<table><thead><tr><th>${byAM ? 'Accountmanager' : 'Klanttype'}</th><th class="num">Open vorige week</th><th class="num">Nieuw</th><th class="num">Gewonnen</th><th class="num">Verloren</th><th class="num">Gemuteerd</th><th class="num">Open nu</th><th class="num">Δ week</th></tr></thead><tbody>
        ${rows.map(r => `<tr class="drillrow" ${byAM ? `data-detail="adviseur" data-id="${r.adv ? r.adv.id : ''}"` : `data-set="klanttype" data-val="${r.k}"`}><td>${r.k}</td><td class="num">${eur(r.openP)}</td><td class="num">${eur(r.nieuw)}</td><td class="num">${eur(r.gewonnen)}</td><td class="num ${r.verloren > 150000 ? 'neg' : ''}">${eur(r.verloren)}</td><td class="num">${eur(r.gemuteerd)}</td><td class="num">${eur(r.open)}</td><td class="num ${r.d < -100000 ? 'neg' : r.d > 50000 ? 'pos' : 'dim'}">${r.d >= 0 ? '+' : '−'}${eurK(Math.abs(r.d))}</td></tr>`).join('')}</tbody></table></div></div>`)}`;
  }
  afterRender.pipeline = () => {
    const S = D.SNAPSHOTS; const stack = state.chart.pipe.stack; const byAM = stack === 'accountmanager'; const keys = byAM ? ams() : ptypes();
    mk('hero', { type: 'line', data: { labels: S.map(s => s.label), datasets: keys.map((k, i) => ({ label: k, data: S.map(s => byAM ? ptot(s, 'open', k) : ptot(s, 'open', null, k)), borderColor: PAL[i], backgroundColor: PAL[i] + '2a', fill: true, tension: .3, pointRadius: 0, borderWidth: 1.5 })) }, options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, onClick: (e, els) => { if (!els.length) return; const k = keys[els[0].datasetIndex]; if (byAM) { if (role().eigen) return; const adv = D.ADVISEURS.find(a => a.naam === k); if (adv) setFilter('adviseur', adv.id); } else setFilter('klanttype', k); }, onHover: pointer, scales: { x: xAxis(), y: { ...yAxis(v => eurK(v)), stacked: true } }, plugins: { tooltip: { callbacks: { label: c => `${c.dataset.label}: ${eur(c.raw)}` } } } } });
    const last = S.at(-1), prev = S.at(-2); const t = k => ptot(last, k); const start = ptot(prev, 'open');
    let run = start; const steps = [['Start', [0, start], GREY]]; [['Nieuw', t('nieuw'), INK], ['Gewonnen', -t('gewonnen'), ACC], ['Verloren', -t('verloren'), BAD], ['Gemuteerd', t('gemuteerd'), '#c9c6bf']].forEach(([l, v, c]) => { steps.push([l, [run, run + v], c]); run += v; }); steps.push(['Eind', [0, run], '#8f8d88']);
    mk('chWater', { type: 'bar', data: { labels: steps.map(s => s[0]), datasets: [{ data: steps.map(s => s[1]), backgroundColor: steps.map(s => s[2]), borderRadius: 3 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => eur(c.raw[1] - c.raw[0]) } } }, scales: { x: xAxis(), y: yAxis(v => eurK(v), { min: Math.floor(start * 0.8 / 1e5) * 1e5 }) } } });
  };

  // ----- Detail (klant, adviseur, product, regio) -----
  const PAGE_NAMES = { overzicht: 'Overzicht', b2c: 'Sales B2C', b2b: 'Sales B2B', product: 'Producten', regio: 'Regio', pipeline: 'Pipeline' };
  const DT_DIMS = { klant: ['product', 'leadsoort', 'adviseur'], adviseur: ['segment', 'leadsoort', 'product', 'regio'], product: ['segment', 'leadsoort', 'adviseur', 'regio'], regio: ['segment', 'adviseur', 'leadsoort', 'product'] };
  function openDetail(type, id) { if (!id) return; if (role().eigen && type === 'adviseur' && id !== role().adviseurId) return; state.detail = { type, id, from: state.detail ? state.detail.from : state.page }; if (state.kp.preset === 'vandaag' || state.kp.preset === 'gisteren') state.kp.preset = 'maand'; delete state.drill.dt; render({ top: true }); }
  function pageDetail() {
    const d = state.detail; const p = period(); const base = filtered(); const s = stats(base, p.van, p.tot), q = stats(base, p.pvan, p.ptot);
    let title = d.id, sub = '', info = '';
    if (d.type === 'klant') { const k = KLANT[d.id]; title = k.naam; sub = `${k.type} · ${k.regio} · klant sinds ${k.sinds}`;
      const open = base.filter(l => l.stage === 3); const lastOrder = base.filter(l => l.orderDatum).sort((a, b) => b.orderDatum.localeCompare(a.orderDatum))[0]; const am = D.ADVISEURS.find(a => a.naam === k.accountmanager);
      info = `<div class="card c4">${cardhead('Account', '')}<dl class="kv"><dt>Accountmanager</dt><dd><a class="lnk" data-detail="adviseur" data-id="${am ? am.id : ''}">${k.accountmanager}</a></dd><dt>Type</dt><dd>${k.type}</dd><dt>Regio</dt><dd><a class="lnk" data-detail="regio" data-id="${k.regio}">${k.regio}</a></dd><dt>Status</dt><dd>${k.top ? '<span class="tag good">topklant</span> ' : ''}${k.actief ? '<span class="tag">actief</span> ' : '<span class="tag">inactief</span> '}${k.ontevreden ? '<span class="tag bad">ontevreden</span>' : ''}</dd><dt>Open offertes</dt><dd>${open.length} · ${eur(sum(open, l => l.waarde))}</dd><dt>Laatste order</dt><dd>${lastOrder ? `${fmtDY(lastOrder.orderDatum)} · ${eur(lastOrder.waarde)}` : '–'}</dd><dt>Omzet totaal</dt><dd>${eur(sum(base.filter(l => l.orderDatum), l => l.waarde))}</dd></dl></div>`; }
    if (d.type === 'adviseur') { const a = D.ADVISEURS.find(x => x.id === d.id); title = a.naam; sub = `Adviseur · ${a.regio} · ${a.cap} afspraakslots per week`;
      const kl = D.KLANTEN.filter(k => k.accountmanager === a.naam);
      info = `<div class="card c4">${cardhead('Profiel', '')}<dl class="kv"><dt>Regio</dt><dd><a class="lnk" data-detail="regio" data-id="${a.regio}">${a.regio}</a></dd><dt>Capaciteit</dt><dd>${a.cap} afspraken per week</dd><dt>Accounts (B2B)</dt><dd>${kl.length ? kl.map(k => `<a class="lnk" data-detail="klant" data-id="${k.id}">${k.naam}</a>`).join(', ') : 'geen'}</dd><dt>Open offertes</dt><dd>${base.filter(l => l.stage === 3).length} · ${eur(sum(base.filter(l => l.stage === 3), l => l.waarde))}</dd></dl></div>`; }
    if (d.type === 'product') { const pr = D.PRODUCTEN.find(x => x.naam === d.id); title = pr.naam; sub = `Product · richtprijs ${eur(pr.prijs)}${role().marge ? ` · marge ${pct(pr.marge)}` : ''}`;
      const c = {}; base.filter(l => l.orderDatum && l.items.length > 1).forEach(l => l.items.filter(i => i !== pr.naam).forEach(i => c[i] = (c[i] || 0) + 1)); const combos = Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 5);
      info = `<div class="card c4">${cardhead('Vaak samen verkocht met', '')}<table><tbody>${combos.length ? combos.map(([k, n]) => `<tr class="drillrow" data-detail="product" data-id="${k}"><td>${k}</td><td class="num">${n}</td></tr>`).join('') : '<tr><td class="dim">Geen combinaties</td></tr>'}</tbody></table></div>`; }
    if (d.type === 'regio') { const advs = D.ADVISEURS.filter(a => a.regio === d.id); sub = advs.length ? `Regio · ${advs.length} adviseur${advs.length > 1 ? 's' : ''} · ${Math.round(regioCap(d.id))} afspraakslots per maand` : 'Regio · geen eigen adviseur, leads worden op afstand bediend';
      info = `<div class="card c4">${cardhead('Adviseurs in deze regio', '')}<table><tbody>${advs.length ? advs.map(a => `<tr class="drillrow" data-detail="adviseur" data-id="${a.id}"><td>${a.naam}</td><td class="num">${a.cap} slots per week</td></tr>`).join('') : '<tr><td class="dim">Geen eigen adviseur</td></tr>'}</tbody></table></div>`; }
    const items = [kpi('Leads', num, s.leads, q.leads), kpi('Afspraken', num, s.afspraken, q.afspraken), kpi('Offertes', num, s.offertes, q.offertes), kpi('Orders', num, s.orders, q.orders), kpi('Omzet', eurK, s.omzet, q.omzet), convOrOpen(s, q, base)];
    const bc = `<div class="crumbs"><a class="lnk" data-back>‹ ${PAGE_NAMES[d.from] || 'Terug'}</a><span>/</span><span>${title}</span></div>`;
    return bc + head(title, sub, `${eurK(s.omzet)} · ${num(s.orders)} orders · ${p.label}`) + kpiSection(items) + chartSection('dt', DT_DIMS[d.type], true) + bottom('dt', info);
  }
  const afterDetail = () => { timeChart('ch_dt', 'dt', DT_DIMS[state.detail.type]); afterBottom('dt'); };

  // ----- Opzet -----
  function pageOpzet() {
    return head('Technische opzet', 'Een extra laag bovenop wat er al staat') + `
      <div class="card" style="margin-bottom:14px">${cardhead('Dataflow', 'bronsysteem → reporting-datalaag → dashboard en CoPilot')}
        <div class="arch">
          <div class="node"><b>CRM / bronsysteem</b>Bestaande API's als bron. Leads, afspraken, offertes, orders, adviseurs, klanten.</div>
          <div class="node"><b>Reporting-database</b>Azure. Wekelijkse snapshots, afgeleide KPI's, extra analysedata.</div>
          <div class="node"><b>Webapplicatie</b>Dashboards, filters, drilldowns. Rechten per pagina en per dataset.</div>
          <div class="node"><b>Microsoft 365 / Okta</b>Login, rollen en autorisatie. Eén set rechten voor dashboard en CoPilot.</div>
          <div class="node"><b>CoPilot-interface</b>Vragen op vooraf gedefinieerde datasets. Geen vrije databasetoegang.</div>
        </div></div>
      <div class="row">
        <div class="card c6">${cardhead('Rollen en zichtbaarheid', 'wissel de rol linksonder om dit te zien')}
          <table><thead><tr><th>Onderdeel</th><th>Directie</th><th>Salesmanager</th><th>Adviseur</th></tr></thead><tbody>
          ${[['Overzicht', 1, 1, 'eigen'], ['Sales B2C en B2B', 1, 1, 'eigen'], ['Producten (incl. marge)', 1, 'zonder marge', 0], ['Regio', 1, 1, 0], ['Pipeline B2B', 1, 1, 'eigen'], ['CoPilot-datasets', 5, 5, 3]].map(r => `<tr><td>${r[0]}</td>${r.slice(1).map(v => `<td>${v === 1 ? '<span class="tag good">✓</span>' : v === 0 ? '<span class="tag">–</span>' : `<span class="tag warn">${v}</span>`}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
        <div class="card c6">${cardhead('Datasets voor CoPilot', 'een vraag wordt vertaald naar één dataset en beantwoord met dezelfde definities als het dashboard')}
          <table><thead><tr><th>Dataset</th><th>Beantwoordt</th></tr></thead><tbody>
            <tr><td><code>omzet-funnel</code></td><td>Waar in de funnel verandert omzet of conversie?</td></tr>
            <tr><td><code>adviseur-conversie</code></td><td>Welke adviseurs stijgen of dalen per funnelstap?</td></tr>
            <tr><td><code>regio-capaciteit</code></td><td>Waar past de vraag niet bij de capaciteit?</td></tr>
            <tr><td><code>product-groei</code></td><td>Welke producten groeien of krimpen?</td></tr>
            <tr><td><code>pipeline-mutaties</code></td><td>Waarom beweegt de portefeuille, en bij wie?</td></tr>
          </tbody></table></div>
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
  const CUR = bucket('maand', mKey(TODAY));
  function answer(q) {
    const t = q.toLowerCase(); const r = role(); const src = (ds, def) => `<div class="src">dataset: <b>${ds}</b> · rol: ${r.label} · ${def}</div>`;
    const deny = ds => `<p class="deny">Geen toegang.</p><p>Dataset <code>${ds}</code> is niet beschikbaar voor de rol ${r.label}. Dezelfde rechten als in het dashboard gelden voor vragen via CoPilot.</p>${src(ds, 'geweigerd door M365-rol')}`;
    const base = scoped(); const cur = byLead(base, CUR.van, CUR.tot), prev = byLead(base, CUR.pvan, CUR.ptot); const curO = byOrder(base, CUR.van, CUR.tot), prevO = byOrder(base, CUR.pvan, CUR.ptot);
    if (/(omzet|revenue).*(gedaald|daalt|daling|lager)|funnel/.test(t) && !/adviseur/.test(t)) {
      const fc = funnelCounts(cur), fp = funnelCounts(prev); const om = sum(curO, l => l.waarde), omP = sum(prevO, l => l.waarde);
      const steps = fc.slice(1).map((x, i) => ({ stap: `${fc[i].stage} → ${x.stage}`, cur: x.n / (fc[i].n || 1), prev: fp[i + 1].n / (fp[i].n || 1) })).map(x => ({ ...x, d: x.cur - x.prev }));
      const worst = steps.slice().sort((a, b) => a.d - b.d)[0]; const wi = steps.indexOf(worst) + 1;
      const web = cur.filter(l => l.leadsoort === 'Website').length, webP = prev.filter(l => l.leadsoort === 'Website').length;
      let who = '';
      if (!r.eigen) { const advs = D.ADVISEURS.map(a => { const c = cur.filter(l => l.adviseur === a.id), pv = prev.filter(l => l.adviseur === a.id); const f = g => g.filter(l => l.stage >= wi).length / (g.filter(l => l.stage >= wi - 1).length || 1); return { a, d: f(c) - f(pv) }; }).sort((x, y) => x.d - y.d).slice(0, 2); who = `<p>De daling in die stap zit vooral bij <b>${advs.map(x => `<a class="lnk" data-detail="adviseur" data-id="${x.a.id}">${x.a.naam}</a> (${(x.d * 100).toFixed(0)}pt)`).join('</b> en <b>')}</b>. De andere adviseurs bewegen binnen de normale bandbreedte.</p>`; }
      const id = 'mini' + Date.now();
      setTimeout(() => mk(id, { type: 'bar', data: { labels: steps.map(x => x.stap), datasets: [{ label: CUR.plabel, data: steps.map(x => +(x.prev * 100).toFixed(1)), backgroundColor: GREY, borderRadius: 2 }, { label: CUR.label, data: steps.map(x => +(x.cur * 100).toFixed(1)), backgroundColor: steps.map(x => x.d < -0.05 ? BAD : INK), borderRadius: 2 }] }, options: { maintainAspectRatio: false, scales: { x: { ...xAxis(), ticks: { font: { size: 9.5 } } }, y: yAxis(v => v + '%') }, plugins: { legend: { labels: { font: { size: 10 }, padding: 8 } } } } }), 30);
      return `<p>De omzet${r.eigen ? ' van jouw leads' : ''} is in ${CUR.label} <b>${pct((om - omP) / omP, 0)}</b> vergeleken met ${CUR.plabel} (${eurK(om)} tegenover ${eurK(omP)}). Twee oorzaken:</p>
        <ul><li><b>Instroom:</b> ${pct((cur.length - prev.length) / prev.length, 0)} leads, vooral <b>Website</b> (${pct((web - webP) / webP, 0)}). Deels seizoen, deels minder online instroom.</li>
        <li><b>Conversie:</b> de grootste daling zit bij <b>${worst.stap}</b>: van ${pct(worst.prev)} naar ${pct(worst.cur)} (${(worst.d * 100).toFixed(0)}pt). De andere stappen bewegen binnen de normale bandbreedte.</li></ul>
        <div class="mini"><canvas id="${id}"></canvas></div>${who}${src('omzet-funnel', 'omzet op orderdatum; conversie = aantal in stap / aantal in vorige stap, op leads uit de periode')}`;
    }
    if (/adviseur/.test(t) && /(conversie|offerte|daling)/.test(t)) {
      const f = g => g.filter(l => l.stage >= 3).length / (g.filter(l => l.stage >= 1).length || 1);
      if (r.eigen) return `<p>Je rol geeft alleen toegang tot je eigen cijfers, dus een vergelijking met andere adviseurs kan ik niet maken.</p><p>Jouw conversie afspraak → offerte: <b>${pct(f(cur))}</b> in ${CUR.label} tegenover ${pct(f(prev))} in ${CUR.plabel} (${((f(cur) - f(prev)) * 100).toFixed(0)}pt). De grootste uitval zit tussen opname en offerte: ${cur.filter(l => l.stage === 2).length} opnames zonder offerte.</p>${src('adviseur-conversie', 'beperkt tot eigen adviseur-ID')}`;
      const rows = D.ADVISEURS.map(a => { const c = f(cur.filter(l => l.adviseur === a.id)), p = f(prev.filter(l => l.adviseur === a.id)); return { a, c, p, d: c - p }; }).sort((x, y) => x.d - y.d);
      return `<p>Grootste daling in conversie afspraak → offerte, ${CUR.label} tegenover ${CUR.plabel}:</p><ul>${rows.slice(0, 3).map(x => `<li><b><a class="lnk" data-detail="adviseur" data-id="${x.a.id}">${x.a.naam}</a></b> (${x.a.regio}): ${pct(x.p)} → ${pct(x.c)} (<b>${(x.d * 100).toFixed(0)}pt</b>)</li>`).join('')}</ul><p>Bij ${rows[0].a.naam} en ${rows[1].a.naam} zit de uitval na de opname: er worden opnames gedaan maar geen offerte uitgebracht. Gemiddeld over alle adviseurs: ${(rows.reduce((a, x) => a + x.d, 0) / rows.length * 100).toFixed(0)}pt.</p>${src('adviseur-conversie', 'conversie = offertes / afspraken per adviseur, op leads uit de periode')}`;
    }
    if (/regio|provincie|capaciteit/.test(t)) {
      if (!r.datasets.includes('regio-capaciteit')) return deny('regio-capaciteit');
      const sc = { ...CUR, cur: byLead(D.LEADS, CUR.van, CUR.tot), curO: byOrder(D.LEADS, CUR.van, CUR.tot) }; const rows = regioRows(sc).sort((a, b) => b.ratio - a.ratio);
      const none = rows.filter(x => x.cap === 0), tekort = rows.filter(x => x.cap > 0 && x.ratio > 1.3), ruimte = rows.filter(x => x.cap > 0 && x.ratio < 0.7);
      return `<p>In ${CUR.label} is de onbalans het grootst in:</p><ul>${tekort.map(x => `<li><b><a class="lnk" data-detail="regio" data-id="${x.r.naam}">${x.r.naam}</a></b>: ${x.leads} leads voor ${Math.round(x.cap)} afspraakslots (${x.ratio.toFixed(2)} leads per slot, ${x.advs} adviseur).</li>`).join('')}<li><b>Zonder eigen adviseur</b>: ${none.map(x => `${x.r.naam} (${x.leads})`).join(', ')}. Samen ${sum(none, x => x.leads)} leads die op afstand worden bediend, met een conversie van ${pct(sum(none, x => x.orders) / (sum(none, x => x.leads) || 1), 1)} tegenover ${pct(sum(rows.filter(x => x.cap > 0), x => x.orders) / sum(rows.filter(x => x.cap > 0), x => x.leads), 1)} in regio's met eigen adviseur.</li></ul><p>Ruimte is er in ${ruimte.map(x => `${x.r.naam} (${x.ratio.toFixed(2)})`).join(' en ') || 'geen enkele regio'}.</p>${src('regio-capaciteit', 'capaciteit = afspraakslots van adviseurs in de regio, naar rato van de periode')}`;
    }
    if (/product|groei|verkoopt|verkopen/.test(t)) {
      if (!r.datasets.includes('product-groei')) return deny('product-groei');
      const g = productGrowth();
      return `<p>Groei in omzet, ${mLabel(KEYS.at(-4))} t/m ${mLabel(KEYS.at(-2))} tegenover de drie maanden ervoor:</p><ul>${g.slice(0, 3).map(x => `<li><b><a class="lnk" data-detail="product" data-id="${x.p.naam}">${x.p.naam}</a></b>: ${x.g >= 0 ? '+' : ''}${pct(x.g, 0)} (${eurK(x.prev)} → ${eurK(x.cur)})</li>`).join('')}</ul><p>Achterblijvers: ${g.slice(-2).map(x => `<b>${x.p.naam}</b> (${pct(x.g, 0)})`).join(' en ')}.${r.marge ? ` ${g[0].p.naam} heeft met ${pct(g[0].p.marge)} ook een hogere marge dan ${g.at(-1).p.naam} (${pct(g.at(-1).p.marge)}).` : ''}</p>${src('product-groei', 'omzet per product = orderwaarde gedeeld over de producten in de order, volledige maanden')}`;
    }
    if (/pipeline|portefeuille|gezakt|400/.test(t)) {
      const list = r.eigen ? [r.naam] : D.ACCOUNTMANAGERS; const last = D.SNAPSHOTS.at(-1), prev2 = D.SNAPSHOTS.at(-2);
      const d = sum(list, am => last.per[am].open - prev2.per[am].open); const per = list.map(am => ({ am, ...last.per[am], d: last.per[am].open - prev2.per[am].open })).sort((a, b) => a.d - b.d);
      const big = per[0]; const avgVerloren = sum(D.SNAPSHOTS.slice(-9, -1), s => sum(list, am => s.per[am].verloren)) / 8; const adv = D.ADVISEURS.find(a => a.naam === big.am); const bigType = Object.entries(last.per[big.am].types).sort((a, b) => b[1].verloren - a[1].verloren)[0][0];
      return `<p>De ${r.eigen ? 'eigen ' : ''}portefeuille daalde van ${eurK(sum(list, am => prev2.per[am].open))} naar ${eurK(sum(list, am => last.per[am].open))} tussen ${prev2.label} en ${last.label}: <b>${eurK(d)}</b>.</p><ul><li><b>Verloren:</b> ${eurK(sum(list, am => last.per[am].verloren))}, tegenover gemiddeld ${eurK(avgVerloren)} per week in de 8 weken ervoor.</li><li><b>Gemuteerd:</b> ${eurK(sum(list, am => last.per[am].gemuteerd))} (offertes verlaagd in waarde).</li><li><b>Nieuw:</b> ${eurK(sum(list, am => last.per[am].nieuw))}.</li></ul>${r.eigen ? '' : `<p>Vrijwel de hele daling zit bij <b><a class="lnk" data-detail="adviseur" data-id="${adv ? adv.id : ''}">${big.am}</a></b>: ${eurK(big.d)} in één week, waarvan ${eurK(big.verloren)} verloren, bijna volledig in het klanttype <b>${bigType}</b>. Dat past bij één of enkele grote offertes die zijn verlopen of afgewezen, niet bij een brede trend.</p>`}${src('pipeline-mutaties', 'wekelijkse snapshot; mutaties = verschil tussen twee snapshots per offerte')}`;
    }
    if (/leadsoort|website|leads.*dalen/.test(t)) {
      const rows = D.LEADSOORTEN.map(ls => ({ ls, c: cur.filter(l => l.leadsoort === ls).length, p: prev.filter(l => l.leadsoort === ls).length })).map(x => ({ ...x, d: (x.c - x.p) / (x.p || 1) })).sort((a, b) => a.d - b.d);
      return `<p>Leads per soort, ${CUR.label} tegenover ${CUR.plabel}:</p><ul>${rows.map(x => `<li><b>${x.ls}</b>: ${x.p} → ${x.c} (${x.d >= 0 ? '+' : ''}${pct(x.d, 0)})</li>`).join('')}</ul><p>Het seizoen verklaart ongeveer −10%. ${rows[0].ls} daalt duidelijk harder dan dat.</p>${src('omzet-funnel', 'leads per leadsoort per periode')}`;
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
  function setFilter(k, v) { if (k in state.f) { state.f[k] = v; render(); } }
  function setRole(k) { state.role = k; state.f.adviseur = ''; if (!role().pages.includes('regio')) state.f.regio = ''; state.detail = null; $('#roleTrig span').textContent = `${role().label} · ${role().naam}`; closePop(); resetCopilot(); render({ top: true }); }
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-dd]');
    if (t) { if (pop.key === t.dataset.dd) closePop(); else openPop(t.dataset.dd, t); return; }
    const pe = $('#pop');
    if (pe && !pe.hidden) {
      if (!pe.contains(e.target)) closePop();
      else { const o = e.target.closest('[data-opt]'); if (o) { if (pop.key === 'role') setRole(o.dataset.opt); else { state.f[pop.key] = o.dataset.opt; closePop(); render(); } } return; }
    }
    if (e.target.closest('[data-copilot]')) { $('#copilot').hidden ? openCopilot() : closeCopilot(); return; }
    const a = e.target.closest('[data-ask]'); if (a) { openCopilot(a.dataset.ask); return; }
    const dt = e.target.closest('[data-detail]'); if (dt) { openDetail(dt.dataset.detail, dt.dataset.id); return; }
    if (e.target.closest('[data-back]')) { state.page = state.detail.from; state.detail = null; render({ top: true }); return; }
    const cl = e.target.closest('[data-clear]'); if (cl) { Object.assign(state.f, { leadsoort: '', adviseur: '', product: '', regio: '', klanttype: '', top: false, actief: false, ontevreden: false }); render(); return; }
    const fl = e.target.closest('[data-flag]'); if (fl) { state.f[fl.dataset.flag] = !state.f[fl.dataset.flag]; render(); return; }
    const kp = e.target.closest('[data-kp]'); if (kp) { if (kp.dataset.kp === 'custom') { cal.pin = !cal.pin; cal.pending = null; render(); } else { state.kp.preset = kp.dataset.kp; cal.pin = false; cal.pending = null; render(); } return; }
    const cn = e.target.closest('[data-calnav]'); if (cn) { const d = parse(cal.view + '-01'); d.setUTCMonth(d.getUTCMonth() + (+cn.dataset.calnav)); cal.view = mKey(toISO(d)); cal.pin = true; render(); return; }
    const dy = e.target.closest('[data-day]'); if (dy && !dy.disabled) { if (!cal.pending) { cal.pending = dy.dataset.day; cal.pin = true; render(); } else { let v = cal.pending, t2 = dy.dataset.day; if (v > t2) [v, t2] = [t2, v]; state.kp = { preset: 'custom', van: v, tot: t2 }; cal.pending = null; cal.pin = false; render(); } return; }
    if (e.target.closest('.calpop')) return;
    const g = e.target.closest('[data-gran]'); if (g) { const k = g.closest('[data-ctx]').dataset.ctx; (state.chart[k] = state.chart[k] || {}).gran = g.dataset.gran; delete state.drill[k]; render(); return; }
    const st = e.target.closest('[data-stack]'); if (st) { const k = st.closest('[data-ctx]').dataset.ctx; (state.chart[k] = state.chart[k] || {}).stack = st.dataset.stack; render(); return; }
    const ud = e.target.closest('[data-undrill]'); if (ud) { delete state.drill[ud.dataset.undrill]; render(); return; }
    const dm = e.target.closest('[data-dim]'); if (dm) { state.dim[dm.closest('[data-dimkey]').dataset.dimkey] = dm.dataset.dim; render(); return; }
    const d = e.target.closest('[data-set]'); if (d && d.dataset.val) { setFilter(d.dataset.set, d.dataset.val); return; }
    const n = e.target.closest('.nav'); if (n && !n.disabled) { state.page = n.dataset.page; state.detail = null; render({ top: true }); }
  });
  document.addEventListener('input', e => { if (e.target.closest('#pop .search')) { pop.q = e.target.value; renderPop(); const inp = $('#pop input'); inp.focus(); inp.setSelectionRange(pop.q.length, pop.q.length); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closePop(); if (cal.pin) { cal.pin = false; cal.pending = null; render(); } } if (e.key === 'Enter' && e.target.closest('#pop .search')) { const first = $('#pop .opt:not([data-opt=""])'); if (first) first.click(); } });
  $('#closeCopilot').onclick = closeCopilot;
  $('#askForm').onsubmit = e => { e.preventDefault(); const v = $('#askInput').value.trim(); if (!v) return; $('#askInput').value = ''; ask(v); };

  // Deep links: #page=b2b&role=adviseur&ask=<vraag>&regio=Zuid-Holland&kp=maand&detail=klant:k1&open=adviseur&cal=1
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('role') && ROLES[h.get('role')]) { state.role = h.get('role'); $('#roleTrig span').textContent = `${role().label} · ${role().naam}`; }
  if (h.get('page')) state.page = h.get('page');
  ['leadsoort', 'adviseur', 'product', 'regio', 'klanttype'].forEach(k => { if (h.get(k)) state.f[k] = h.get(k); });
  if (h.get('kp')) state.kp.preset = h.get('kp');
  if (h.get('detail')) { const [ty, id] = h.get('detail').split(':'); state.detail = { type: ty, id, from: state.page }; if (!h.get('kp')) state.kp.preset = 'maand'; }
  if (h.get('drill')) { const [ctx, gran, key, dim, val] = h.get('drill').split(':'); state.chart[ctx] = { gran, stack: dim || 'totaal' }; state.drill[ctx] = { gran, key, dim: dim || null, val: val || null }; }
  if (h.get('cal')) cal.pin = true;
  resetCopilot();
  render({ top: true });
  if (h.get('open')) { const t = document.querySelector(`[data-dd="${h.get('open')}"]`); if (t) openPop(h.get('open'), t); }
  if (h.get('ask')) openCopilot(h.get('ask'));
  else if (h.get('copilot')) openCopilot();
})();
