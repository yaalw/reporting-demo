(function () {
  const D = window.DATA;
  const $ = sel => document.querySelector(sel);

  // ---------- Rollen (gesimuleerde Microsoft 365-rollen) ----------
  const ROLES = {
    directie: { naam: 'Daniël Roos', init: 'DR', label: 'Directie', pages: ['management', 'sales', 'product', 'regio', 'pipeline', 'opzet'], marge: true, datasets: ['omzet-funnel', 'adviseur-conversie', 'regio-capaciteit', 'product-groei', 'pipeline-mutaties'] },
    sales: { naam: 'Merel Koning', init: 'MK', label: 'Salesmanager', pages: ['sales', 'product', 'regio', 'pipeline', 'opzet'], marge: false, datasets: ['omzet-funnel', 'adviseur-conversie', 'regio-capaciteit', 'product-groei', 'pipeline-mutaties'] },
    adviseur: { naam: 'Lotte Bakker', init: 'LB', label: 'Adviseur', pages: ['sales', 'pipeline', 'opzet'], marge: false, adviseurId: 'a3', datasets: ['omzet-funnel', 'adviseur-conversie', 'pipeline-mutaties'], eigen: true },
  };
  const state = { role: 'directie', page: 'management', f: { van: D.HUIDIG, tot: D.HUIDIG, leadsoort: '', adviseur: '', product: '' } };
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
  const delta = (cur, prev, opts = {}) => {
    if (!prev) return `<span class="delta flat">–</span>`;
    const d = (cur - prev) / prev; const up = d >= 0; const good = opts.invert ? !up : up;
    return `<span class="delta ${Math.abs(d) < 0.005 ? 'flat' : good ? 'up' : 'down'}">${up ? '▲' : '▼'} ${pct(Math.abs(d), 1)}</span>`;
  };
  const COLORS = ['#1f5eff', '#7b3fe4', '#12855a', '#c77a00', '#d23c3c', '#0ea5b7', '#8a8f9c', '#e0559b'];
  const role = () => ROLES[state.role];

  Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
  Chart.defaults.font.size = 11.5;
  Chart.defaults.color = '#6b7280';
  Chart.defaults.plugins.legend.labels.boxWidth = 10;
  Chart.defaults.plugins.legend.labels.boxHeight = 10;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  const axis = (fmt) => ({ x: { grid: { display: false } }, y: { grid: { color: '#f0f1f3' }, border: { display: false }, ticks: { callback: fmt || (v => v) } } });
  function mk(id, cfg) { const el = document.getElementById(id); if (!el) return; const c = new Chart(el, cfg); charts.push(c); return c; }
  function clearCharts() { charts.forEach(c => c.destroy()); charts = []; }

  // ---------- Data-scoping ----------
  const scoped = () => role().eigen ? D.LEADS.filter(l => l.adviseur === role().adviseurId) : D.LEADS;
  const KEYS = D.MAANDEN.map(m => m.key);
  const periodMonths = () => {
    let a = KEYS.indexOf(state.f.van), b = KEYS.indexOf(state.f.tot);
    if (a < 0) a = KEYS.length - 1; if (b < 0) b = KEYS.length - 1; if (a > b) [a, b] = [b, a];
    return KEYS.slice(a, b + 1);
  };
  const prevMonths = (months) => {
    const keys = D.MAANDEN.map(m => m.key); const i = keys.indexOf(months[0]);
    if (i - months.length < 0) return [];
    return keys.slice(i - months.length, i);
  };
  const inMonths = (leads, months) => leads.filter(l => months.includes(l.maand));
  const applyFilters = (leads) => leads.filter(l => (!state.f.leadsoort || l.leadsoort === state.f.leadsoort) && (!state.f.adviseur || l.adviseur === state.f.adviseur) && (!state.f.product || l.items.includes(state.f.product)));

  const stats = (leads) => {
    const orders = leads.filter(l => l.stage >= 4);
    return {
      leads: leads.length, afspraken: leads.filter(l => l.stage >= 1).length, opnames: leads.filter(l => l.stage >= 2).length, offertes: leads.filter(l => l.stage >= 3).length, orders: orders.length,
      omzet: sum(orders, l => l.waarde), marge: sum(orders, l => l.waarde * l.marge), offerteWaarde: sum(leads.filter(l => l.stage === 3), l => l.waarde),
      conv: leads.length ? orders.length / leads.length : 0,
    };
  };
  const funnelCounts = leads => D.STAGES.slice(0, 5).map((s, i) => ({ stage: s, n: leads.filter(l => l.stage >= i).length }));
  const regioCap = r => sum(D.ADVISEURS.filter(a => a.regio === r), a => a.cap) * 4.33;

  // ---------- Renderen ----------
  function render() {
    clearCharts();
    const r = role();
    $('#avatar').textContent = r.init;
    document.querySelectorAll('.nav').forEach(b => {
      const ok = r.pages.includes(b.dataset.page);
      b.disabled = !ok; b.classList.toggle('active', b.dataset.page === state.page);
      b.querySelector('.lock')?.remove(); if (!ok) b.insertAdjacentHTML('beforeend', '<span class="lock">🔒</span>');
    });
    if (!r.pages.includes(state.page)) state.page = r.pages[0];
    document.querySelectorAll('.nav').forEach(b => b.classList.toggle('active', b.dataset.page === state.page));
    $('#cpScope').textContent = `${r.label} · ${r.naam} · ${r.datasets.length} datasets beschikbaar`;
    const pages = { management: pageManagement, sales: pageSales, product: pageProduct, regio: pageRegio, pipeline: pagePipeline, opzet: pageOpzet };
    $('#main').innerHTML = pages[state.page]();
    (afterRender[state.page] || (() => { }))();
    bindFilters();
  }
  const afterRender = {};

  const head = (title, sub, filters = '') => `<div class="page-head"><div><h1>${title}</h1><p>${sub}</p></div><div class="filters">${filters}${role().eigen ? `<span class="scope" style="align-self:center">Alleen eigen gegevens · ${role().naam}</span>` : ''}</div></div>`;
  const periodeSelect = () => {
    const months = periodMonths(); const n = months.length;
    const preset = (l, k) => `<button type="button" class="preset ${(k === 'm' && n === 1 && months[0] === D.HUIDIG) || (k === '3' && n === 3 && months[2] === D.HUIDIG) || (k === '12' && n === 12 && months[11] === D.HUIDIG) ? 'on' : ''}" data-preset="${k}">${l}</button>`;
    return `<div class="range"><input type="month" data-f="van" min="${KEYS[0]}" max="${KEYS.at(-1)}" value="${state.f.van}"><span>t/m</span><input type="month" data-f="tot" min="${KEYS[0]}" max="${KEYS.at(-1)}" value="${state.f.tot}"><span class="sep"></span>${preset('Deze maand', 'm')}${preset('3 mnd', '3')}${preset('12 mnd', '12')}</div>`;
  };
  const sel = (key, label, opts) => `<select data-f="${key}"><option value="">${label}: alle</option>${opts.map(o => `<option value="${o.v}" ${state.f[key] === o.v ? 'selected' : ''}>${o.l}</option>`).join('')}</select>`;
  function bindFilters() {
    document.querySelectorAll('[data-f]').forEach(el => el.onchange = () => { const v = el.value; if ((el.dataset.f === 'van' || el.dataset.f === 'tot') && !KEYS.includes(v)) { el.value = state.f[el.dataset.f]; return; } state.f[el.dataset.f] = v; render(); });
    document.querySelectorAll('[data-preset]').forEach(el => el.onclick = () => { const k = el.dataset.preset; state.f.tot = D.HUIDIG; state.f.van = k === 'm' ? D.HUIDIG : KEYS.at(-(k === '3' ? 3 : 12)); render(); });
  }
  const kpi = (lbl, val, cur, prev, opts = {}) => `<div class="card c3 kpi ${opts.drill ? 'clickable' : ''}" ${opts.drill ? drillAttr(opts.drill) : ''}><div class="lbl">${lbl}${opts.drill ? ' <span class="drillhint">drilldown ›</span>' : ''}</div><div class="val">${val}</div>${delta(cur, prev, opts)}<span class="vs">vs. ${opts.vs || 'vorige periode'}</span></div>`;

  // ----- Management -----
  function pageManagement() {
    const cur = stats(inMonths(D.LEADS, [D.HUIDIG])), prev = stats(inMonths(D.LEADS, [D.VORIG]));
    const snap = D.SNAPSHOTS[D.SNAPSHOTS.length - 1], snapPrev = D.SNAPSHOTS[D.SNAPSHOTS.length - 2];
    const open = sum(D.ACCOUNTMANAGERS, am => snap.per[am].open), openPrev = sum(D.ACCOUNTMANAGERS, am => snapPrev.per[am].open);
    const capTot = sum(D.ADVISEURS, a => a.cap) * 4.33;
    const alerts = buildAlerts();
    return head('Management dashboard', `Kerncijfers ${mLabel(D.HUIDIG)} ten opzichte van ${mLabel(D.VORIG)}. Alle regio's, alle adviseurs.`) + `
      <div class="grid">
        ${kpi('Omzet (orders)', eurK(cur.omzet), cur.omzet, prev.omzet, { vs: mLabel(D.VORIG), drill: { maand: D.HUIDIG } })}
        ${kpi('Leads', num(cur.leads), cur.leads, prev.leads, { vs: mLabel(D.VORIG), drill: { maand: D.HUIDIG, _dim: 'leadsoort' } })}
        ${kpi('Conversie lead → order', pct(cur.conv, 1), cur.conv, prev.conv, { vs: mLabel(D.VORIG), drill: { maand: D.HUIDIG, _dim: 'adviseur' } })}
        ${kpi('Orderportefeuille (open offertes)', eurK(open), open, openPrev, { vs: 'vorige week' })}
        <div class="card c8 stretch"><h3>Omzet en orders per maand</h3><div class="sub">Gesloten orders uit het bronsysteem, historisch vastgelegd in de reporting-database</div><div class="chart"><canvas id="chOmzet"></canvas></div></div>
        <div class="card c4"><h3>Belangrijkste afwijkingen</h3><div class="sub">Automatisch gesignaleerd t.o.v. vorige periode</div><div class="alerts">${alerts.map(a => `<div class="alert ${a.type}"><div><b>${a.title}</b><span>${a.body}</span></div><button data-ask="${a.q}">✦ Vraag CoPilot</button></div>`).join('')}</div></div>
        <div class="card c6"><h3>Funnel ${mLabel(D.HUIDIG)}</h3><div class="sub">Conversie per stap, vergeleken met ${mLabel(D.VORIG)}</div>${funnelHtml(inMonths(D.LEADS, [D.HUIDIG]), inMonths(D.LEADS, [D.VORIG]))}</div>
        <div class="card c6"><h3>Capaciteit adviseurs</h3><div class="sub">Afspraken deze maand t.o.v. beschikbare afspraakslots · totaal ${pct(cur.afspraken / capTot)} bezet</div><div class="chart"><canvas id="chCap"></canvas></div></div>
      </div>`;
  }
  function funnelHtml(cur, prev) {
    const fc = funnelCounts(cur), fp = funnelCounts(prev); const max = fc[0].n || 1;
    return `<div class="funnel">${fc.map((s, i) => {
      const cv = i ? s.n / (fc[i - 1].n || 1) : 1, pv = i ? fp[i].n / (fp[i - 1].n || 1) : 1; const d = cv - pv;
      return `<div class="frow"><span>${s.stage}</span><div class="fb" style="width:${(s.n / max) * 100}%"></div><span class="n">${num(s.n)}</span><span class="cv">${i ? `${pct(cv)} <span class="tag ${d < -0.03 ? 'bad' : d > 0.03 ? 'good' : ''}">${d >= 0 ? '+' : ''}${(d * 100).toFixed(0)}pt</span>` : ''}</span></div>`;
    }).join('')}</div>`;
  }
  function buildAlerts() {
    const cur = stats(inMonths(D.LEADS, [D.HUIDIG])), prev = stats(inMonths(D.LEADS, [D.VORIG]));
    const out = [];
    out.push({ type: 'bad', title: `Omzet ${pct((cur.omzet - prev.omzet) / prev.omzet, 0)} t.o.v. ${mLabel(D.VORIG)}`, body: 'Daling groter dan het seizoenspatroon verklaart.', q: 'De omzet is deze maand gedaald. Waar in de funnel gebeurt dit?' });
    const snap = D.SNAPSHOTS.at(-1), sp = D.SNAPSHOTS.at(-2); const dOpen = sum(D.ACCOUNTMANAGERS, am => snap.per[am].open - sp.per[am].open);
    out.push({ type: 'bad', title: `Pipeline ${eurK(dOpen)} in één week`, body: 'Grootste weekmutatie in de afgelopen 26 weken.', q: 'Waarom is de pipeline ineens gezakt met 400.000?' });
    const web = inMonths(D.LEADS, [D.HUIDIG]).filter(l => l.leadsoort === 'Website').length, webP = inMonths(D.LEADS, [D.VORIG]).filter(l => l.leadsoort === 'Website').length;
    out.push({ type: 'warn', title: `Website-leads ${pct((web - webP) / webP, 0)}`, body: 'Overige leadsoorten volgen het seizoen.', q: 'Welke leadsoorten dalen het hardst?' });
    out.push({ type: 'warn', title: 'Onbalans leads vs. capaciteit', body: 'Zuid-Holland en 5 regio\'s zonder eigen adviseur.', q: 'In welke regio hebben we veel leads maar te weinig adviseurs beschikbaar?' });
    return out;
  }
  afterRender.management = () => {
    const byM = D.MAANDEN.map(m => stats(inMonths(D.LEADS, [m.key])));
    mk('chOmzet', { data: { labels: D.MAANDEN.map(m => m.label), datasets: [{ type: 'bar', label: 'Omzet', data: byM.map(s => s.omzet), backgroundColor: COLORS[0], borderRadius: 4, yAxisID: 'y' }, { type: 'line', label: 'Orders', data: byM.map(s => s.orders), borderColor: COLORS[1], backgroundColor: COLORS[1], tension: .3, pointRadius: 3, yAxisID: 'y1' }] }, options: { maintainAspectRatio: false, onClick: (e, els) => { if (els.length) openDrill({ maand: D.MAANDEN[els[0].index].key }); }, onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; }, scales: { x: { grid: { display: false } }, y: { grid: { color: '#f0f1f3' }, border: { display: false }, ticks: { callback: v => eurK(v) } }, y1: { position: 'right', grid: { display: false }, border: { display: false } } }, plugins: { tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.dataset.label === 'Omzet' ? eur(c.raw) : c.raw}` } } } } });
    const regs = D.REGIOS.filter(r => regioCap(r.naam) > 0).map(r => r.naam);
    const cur = inMonths(D.LEADS, [D.HUIDIG]);
    mk('chCap', { type: 'bar', data: { labels: regs, datasets: [{ label: 'Afspraken', data: regs.map(r => cur.filter(l => l.regio === r && l.stage >= 1).length), backgroundColor: COLORS[0], borderRadius: 4 }, { label: 'Capaciteit (slots)', data: regs.map(r => Math.round(regioCap(r))), backgroundColor: '#d9dde6', borderRadius: 4 }] }, options: { maintainAspectRatio: false, onClick: (e, els) => { if (els.length) openDrill({ regio: regs[els[0].index], maand: D.HUIDIG }); }, onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; }, scales: axis() } });
  };

  // ----- Sales -----
  function pageSales() {
    const months = periodMonths(), pm = prevMonths(months);
    const base = scoped();
    const cur = applyFilters(inMonths(base, months)), prev = applyFilters(inMonths(base, pm));
    const s = stats(cur), p = stats(prev);
    const advOpts = D.ADVISEURS.map(a => ({ v: a.id, l: a.naam }));
    const filters = periodeSelect() + sel('leadsoort', 'Leadsoort', D.LEADSOORTEN.map(x => ({ v: x, l: x }))) + (role().eigen ? '' : sel('adviseur', 'Adviseur', advOpts)) + sel('product', 'Product', D.PRODUCTEN.map(x => ({ v: x.naam, l: x.naam })));
    const advs = role().eigen ? D.ADVISEURS.filter(a => a.id === role().adviseurId) : D.ADVISEURS;
    const rows = advs.map(a => { const c = stats(cur.filter(l => l.adviseur === a.id)), pv = stats(prev.filter(l => l.adviseur === a.id)); const conv = c.afspraken ? c.offertes / c.afspraken : 0, convP = pv.afspraken ? pv.offertes / pv.afspraken : 0; return { a, c, pv, conv, convP, d: conv - convP }; }).sort((x, y) => y.c.omzet - x.c.omzet);
    return head('Sales & commercie', 'Omzet, conversie en uitval. Filterbaar op periode, leadsoort, adviseur en product.', filters) + `
      <div class="grid">
        ${kpi('Leads', num(s.leads), s.leads, p.leads, { drill: { _dim: 'leadsoort' } })}${kpi('Offertes', num(s.offertes), s.offertes, p.offertes, { drill: { _dim: 'adviseur' } })}${kpi('Orders', num(s.orders), s.orders, p.orders, { drill: { _dim: 'product' } })}${kpi('Omzet', eurK(s.omzet), s.omzet, p.omzet, { drill: { _dim: 'product' } })}
        <div class="card c5" style="grid-column: span 5"><h3>Funnel</h3><div class="sub">Conversie per stap t.o.v. vorige periode</div>${funnelHtml(cur, prev)}</div>
        <div class="card c7" style="grid-column: span 7"><h3>Uitval per stap, per leadsoort</h3><div class="sub">Waar in de funnel haken leads af?</div><div class="chart"><canvas id="chUitval"></canvas></div></div>
        <div class="card c12"><h3>Per adviseur</h3><div class="sub">Conversie afspraak → offerte is de stap die deze periode het meest beweegt</div>
          <table><thead><tr><th>Adviseur</th><th>Regio</th><th class="num">Leads</th><th class="num">Afspraken</th><th class="num">Offertes</th><th class="num">Orders</th><th class="num">Omzet</th><th class="num">Afspraak → offerte</th><th class="num">Δ vs. vorige</th></tr></thead><tbody>
          ${rows.map(r => `<tr class="drillrow" ${drillAttr({ adviseur: r.a.id })}><td><b>${r.a.naam}</b></td><td>${r.a.regio}</td><td class="num">${r.c.leads}</td><td class="num">${r.c.afspraken}</td><td class="num">${r.c.offertes}</td><td class="num">${r.c.orders}</td><td class="num">${eur(r.c.omzet)}</td><td class="num">${pct(r.conv)}</td><td class="num"><span class="tag ${r.d < -0.05 ? 'bad' : r.d > 0.05 ? 'good' : ''}">${pm.length ? `${r.d >= 0 ? '+' : ''}${(r.d * 100).toFixed(0)}pt` : '–'}</span></td></tr>`).join('')}
          </tbody></table></div>
        <div class="card c12"><h3>Omzet per leadsoort over tijd</h3><div class="sub">Laatste 13 maanden · ${role().eigen ? 'eigen leads' : 'alle adviseurs'}</div><div class="chart"><canvas id="chLeadsoort"></canvas></div></div>
      </div>`;
  }
  afterRender.sales = () => {
    const months = periodMonths(); const cur = applyFilters(inMonths(scoped(), months));
    const steps = ['Lead → afspraak', 'Afspraak → opname', 'Opname → offerte', 'Offerte → order'];
    mk('chUitval', { type: 'bar', data: { labels: steps, datasets: D.LEADSOORTEN.map((ls, i) => ({ label: ls, data: steps.map((_, si) => { const g = cur.filter(l => l.leadsoort === ls); const a = g.filter(l => l.stage >= si).length, b = g.filter(l => l.stage >= si + 1).length; return a ? +((1 - b / a) * 100).toFixed(1) : 0; }), backgroundColor: COLORS[i], borderRadius: 3 })) }, options: { maintainAspectRatio: false, scales: axis(v => v + '%'), plugins: { tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.raw}% uitval` } } } } });
    const base = applyFilters(scoped());
    mk('chLeadsoort', { type: 'line', data: { labels: D.MAANDEN.map(m => m.label), datasets: D.LEADSOORTEN.map((ls, i) => ({ label: ls, data: D.MAANDEN.map(m => stats(base.filter(l => l.maand === m.key && l.leadsoort === ls)).omzet), borderColor: COLORS[i], backgroundColor: COLORS[i], tension: .3, pointRadius: 2 })) }, options: { maintainAspectRatio: false, scales: axis(v => eurK(v)), plugins: { tooltip: { callbacks: { label: c => `${c.dataset.label}: ${eur(c.raw)}` } } } } });
  };

  // ----- Product -----
  function productGrowth() {
    const keys = D.MAANDEN.map(m => m.key); const last3 = keys.slice(-3), prev3 = keys.slice(-6, -3);
    return D.PRODUCTEN.map(p => { const f = l => l.stage >= 4 && l.items.includes(p.naam); const a = sum(inMonths(D.LEADS, last3).filter(f), l => l.waarde / l.items.length), b = sum(inMonths(D.LEADS, prev3).filter(f), l => l.waarde / l.items.length); return { p, cur: a, prev: b, g: b ? (a - b) / b : 0 }; }).sort((x, y) => y.g - x.g);
  }
  function pageProduct() {
    const months = periodMonths(), pm = prevMonths(months);
    const cur = inMonths(D.LEADS, months).filter(l => l.stage >= 4), prev = inMonths(D.LEADS, pm).filter(l => l.stage >= 4);
    const per = D.PRODUCTEN.map(p => { const f = l => l.items.includes(p.naam); const c = cur.filter(f), pv = prev.filter(f); const om = sum(c, l => l.waarde / l.items.length); return { p, n: c.length, omzet: om, prevOmzet: sum(pv, l => l.waarde / l.items.length), marge: om * p.marge }; }).sort((a, b) => b.omzet - a.omzet);
    const combos = {}; cur.filter(l => l.items.length > 1).forEach(l => { const k = l.items.slice().sort().join(' + '); combos[k] = (combos[k] || 0) + 1; });
    const topCombos = Object.entries(combos).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const growth = productGrowth();
    const m = role().marge;
    return head('Productanalyse', 'Welke producten en combinaties verkopen goed, waar zitten de marges en hoe ontwikkelt dit zich?', periodeSelect()) + `
      <div class="grid">
        <div class="card c7" style="grid-column: span 7"><h3>Omzet per product</h3><div class="sub">Geselecteerde periode · aandeel in omzet</div><div class="chart"><canvas id="chProd"></canvas></div></div>
        <div class="card c5" style="grid-column: span 5"><h3>Groei laatste 3 maanden</h3><div class="sub">T.o.v. de 3 maanden ervoor</div><table><thead><tr><th>Product</th><th class="num">Omzet</th><th class="num">Groei</th></tr></thead><tbody>${growth.map(g => `<tr class="drillrow" ${drillAttr({ product: g.p.naam })}><td>${g.p.naam}</td><td class="num">${eurK(g.cur)}</td><td class="num"><span class="tag ${g.g > 0.08 ? 'good' : g.g < -0.08 ? 'bad' : ''}">${g.g >= 0 ? '+' : ''}${pct(g.g, 0)}</span></td></tr>`).join('')}</tbody></table></div>
        <div class="card c7" style="grid-column: span 7"><h3>Producttabel</h3><div class="sub">${m ? 'Inclusief marge (alleen zichtbaar voor Directie)' : 'Marges zijn niet zichtbaar voor jouw rol'}</div>
          <table><thead><tr><th>Product</th><th class="num">Orders</th><th class="num">Omzet</th><th class="num">Δ</th>${m ? '<th class="num">Marge €</th><th class="num">Marge %</th>' : ''}</tr></thead><tbody>
          ${per.map(x => `<tr class="drillrow" ${drillAttr({ product: x.p.naam })}><td><b>${x.p.naam}</b></td><td class="num">${x.n}</td><td class="num">${eur(x.omzet)}</td><td class="num">${delta(x.omzet, x.prevOmzet)}</td>${m ? `<td class="num">${eur(x.marge)}</td><td class="num">${pct(x.p.marge)}</td>` : ''}</tr>`).join('')}</tbody></table></div>
        <div class="card c5" style="grid-column: span 5"><h3>Productcombinaties</h3><div class="sub">Meest verkochte combinaties in één order</div><table><thead><tr><th>Combinatie</th><th class="num">Orders</th></tr></thead><tbody>${topCombos.map(([k, n]) => `<tr><td>${k}</td><td class="num">${n} <span class="bar" style="width:${n / topCombos[0][1] * 60}px"></span></td></tr>`).join('')}</tbody></table></div>
        <div class="card c12"><h3>Ontwikkeling per product</h3><div class="sub">Omzet per maand, laatste 13 maanden</div><div class="chart tall"><canvas id="chProdTrend"></canvas></div></div>
      </div>`;
  }
  afterRender.product = () => {
    const months = periodMonths(); const cur = inMonths(D.LEADS, months).filter(l => l.stage >= 4);
    const per = D.PRODUCTEN.map(p => ({ p, omzet: sum(cur.filter(l => l.items.includes(p.naam)), l => l.waarde / l.items.length) })).sort((a, b) => b.omzet - a.omzet);
    mk('chProd', { type: 'bar', data: { labels: per.map(x => x.p.naam), datasets: [{ data: per.map(x => x.omzet), backgroundColor: per.map((_, i) => i === 0 ? COLORS[0] : '#9db4ff'), borderRadius: 4 }] }, options: { indexAxis: 'y', maintainAspectRatio: false, onClick: (e, els) => { if (els.length) openDrill({ product: per[els[0].index].p.naam }); }, onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => eur(c.raw) } } }, scales: { x: { grid: { color: '#f0f1f3' }, border: { display: false }, ticks: { callback: v => eurK(v) } }, y: { grid: { display: false } } } } });
    const top = D.PRODUCTEN.slice().sort((a, b) => b.w - a.w).slice(0, 6);
    mk('chProdTrend', { type: 'line', data: { labels: D.MAANDEN.map(m => m.label), datasets: top.map((p, i) => ({ label: p.naam, data: D.MAANDEN.map(m => sum(D.LEADS.filter(l => l.maand === m.key && l.stage >= 4 && l.items.includes(p.naam)), l => l.waarde / l.items.length)), borderColor: COLORS[i], backgroundColor: COLORS[i], tension: .3, pointRadius: 2 })) }, options: { maintainAspectRatio: false, scales: axis(v => eurK(v)), plugins: { tooltip: { callbacks: { label: c => `${c.dataset.label}: ${eur(c.raw)}` } } } } });
  };

  // ----- Regio -----
  function regioRows(months) {
    const cur = inMonths(D.LEADS, months);
    return D.REGIOS.map(r => { const g = cur.filter(l => l.regio === r.naam); const s = stats(g); const cap = regioCap(r.naam) * months.length; const advs = D.ADVISEURS.filter(a => a.regio === r.naam).length; return { r, s, cap, advs, ratio: cap ? s.leads / cap : Infinity, bez: cap ? s.afspraken / cap : Infinity }; });
  }
  const ratioColor = x => x === Infinity ? '#7a1f1f' : x > 1.3 ? '#d23c3c' : x > 0.9 ? '#e8892b' : x > 0.6 ? '#1f5eff' : '#7c9cf5';
  function pageRegio() {
    const months = periodMonths(); const rows = regioRows(months).sort((a, b) => b.ratio - a.ratio);
    return head('Regionale analyse', 'Leads, verkopen en conversie geografisch afgezet tegen de capaciteit van adviseurs.', periodeSelect()) + `
      <div class="grid">
        <div class="card c5" style="grid-column: span 5"><h3>Vraag versus capaciteit</h3><div class="sub">Leads per beschikbaar afspraakslot, per provincie</div>
          <div class="tiles">${D.REGIOS.map(r => { const x = rows.find(q => q.r.naam === r.naam); return `<div class="tile" ${drillAttr({ regio: r.naam })} style="grid-column:${r.col + 1};grid-row:${r.row + 1};background:${ratioColor(x.ratio)}" title="${r.naam}: ${x.s.leads} leads, capaciteit ${Math.round(x.cap)} slots"><b>${r.naam}</b><small>${x.s.leads} leads · ${x.advs ? x.ratio.toFixed(2) : 'geen adviseur'}</small></div>`; }).join('')}</div>
          <div class="legend"><span><i style="background:#7c9cf5"></i>ruimte</span><span><i style="background:#1f5eff"></i>in balans</span><span><i style="background:#e8892b"></i>krap</span><span><i style="background:#d23c3c"></i>tekort</span><span><i style="background:#7a1f1f"></i>geen eigen adviseur</span></div></div>
        <div class="card c7" style="grid-column: span 7"><h3>Leads en capaciteit per regio</h3><div class="sub">Regio's zonder eigen adviseur worden op afstand bediend: lagere conversie, langere doorlooptijd</div><div class="chart tall"><canvas id="chRegio"></canvas></div></div>
        <div class="card c12"><h3>Regiotabel</h3><div class="sub">Gesorteerd op druk (leads per slot)</div>
          <table><thead><tr><th>Regio</th><th class="num">Leads</th><th class="num">Afspraken</th><th class="num">Orders</th><th class="num">Conversie</th><th class="num">Omzet</th><th class="num">Adviseurs</th><th class="num">Capaciteit</th><th class="num">Leads / slot</th><th>Status</th></tr></thead><tbody>
          ${rows.map(x => `<tr class="drillrow" ${drillAttr({ regio: x.r.naam })}><td><b>${x.r.naam}</b></td><td class="num">${x.s.leads}</td><td class="num">${x.s.afspraken}</td><td class="num">${x.s.orders}</td><td class="num">${pct(x.s.conv, 1)}</td><td class="num">${eur(x.s.omzet)}</td><td class="num">${x.advs}</td><td class="num">${x.cap ? Math.round(x.cap) : '–'}</td><td class="num">${x.cap ? x.ratio.toFixed(2) : '∞'}</td><td>${x.cap === 0 ? '<span class="tag bad">geen eigen adviseur</span>' : x.ratio > 1.3 ? '<span class="tag bad">tekort</span>' : x.ratio > 0.9 ? '<span class="tag warn">krap</span>' : '<span class="tag good">in balans</span>'}</td></tr>`).join('')}</tbody></table></div>
      </div>`;
  }
  afterRender.regio = () => {
    const rows = regioRows(periodMonths()).sort((a, b) => b.s.leads - a.s.leads);
    mk('chRegio', { type: 'bar', data: { labels: rows.map(x => x.r.naam), datasets: [{ label: 'Leads', data: rows.map(x => x.s.leads), backgroundColor: COLORS[0], borderRadius: 3 }, { label: 'Capaciteit (slots)', data: rows.map(x => Math.round(x.cap)), backgroundColor: '#d9dde6', borderRadius: 3 }, { label: 'Orders', data: rows.map(x => x.s.orders), backgroundColor: COLORS[2], borderRadius: 3 }] }, options: { maintainAspectRatio: false, onClick: (e, els) => { if (els.length) openDrill({ regio: rows[els[0].index].r.naam }); }, onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; }, scales: axis() } });
  };

  // ----- Pipeline -----
  const ams = () => role().eigen ? [role().naam] : D.ACCOUNTMANAGERS;
  function pagePipeline() {
    const list = ams(); const S = D.SNAPSHOTS; const last = S.at(-1), prev = S.at(-2);
    const tot = s => sum(list, am => s.per[am].open);
    const mut = k => sum(list, am => last.per[am][k]);
    const first = S[0];
    return head('Pipeline-ontwikkeling', 'Niet alleen de huidige stand, maar de ontwikkeling door de tijd: wekelijkse snapshots van de offerteportefeuille.') + `
      <div class="grid">
        ${kpi('Openstaande offertes', eurK(tot(last)), tot(last), tot(prev), { vs: 'vorige week' })}
        ${kpi('Nieuw deze week', eurK(mut('nieuw')), mut('nieuw'), sum(list, am => prev.per[am].nieuw), { vs: 'vorige week' })}
        ${kpi('Gewonnen deze week', eurK(mut('gewonnen')), mut('gewonnen'), sum(list, am => prev.per[am].gewonnen), { vs: 'vorige week' })}
        ${kpi('Verloren deze week', eurK(mut('verloren')), mut('verloren'), sum(list, am => prev.per[am].verloren), { vs: 'vorige week', invert: true })}
        <div class="card c8"><h3>Portefeuille over 26 weken</h3><div class="sub">Snapshots opgeslagen in de reporting-database · het bronsysteem toont alleen de huidige stand</div><div class="chart tall"><canvas id="chPipe"></canvas></div></div>
        <div class="card c4"><h3>Mutaties deze week</h3><div class="sub">Van ${prev.label} naar ${last.label}</div><div class="chart tall"><canvas id="chWater"></canvas></div></div>
        <div class="card c12"><h3>Per accountmanager</h3><div class="sub">Mutaties in de laatste week · start ${eurK(tot(first))} op ${first.label}</div>
          <table><thead><tr><th>Accountmanager</th><th class="num">Open (vorige week)</th><th class="num">+ Nieuw</th><th class="num">− Gewonnen</th><th class="num">− Verloren</th><th class="num">± Gemuteerd</th><th class="num">Open (nu)</th><th class="num">Δ week</th></tr></thead><tbody>
          ${list.map(am => { const l = last.per[am], p = prev.per[am]; const d = l.open - p.open; return `<tr><td><b>${am}</b></td><td class="num">${eur(p.open)}</td><td class="num">${eur(l.nieuw)}</td><td class="num">${eur(l.gewonnen)}</td><td class="num" style="${l.verloren > 150000 ? 'color:var(--bad);font-weight:600' : ''}">${eur(l.verloren)}</td><td class="num">${eur(l.gemuteerd)}</td><td class="num">${eur(l.open)}</td><td class="num"><span class="tag ${d < -100000 ? 'bad' : d > 50000 ? 'good' : ''}">${d >= 0 ? '+' : '−'}${eurK(Math.abs(d))}</span></td></tr>`; }).join('')}</tbody></table></div>
      </div>`;
  }
  afterRender.pipeline = () => {
    const list = ams(); const S = D.SNAPSHOTS;
    mk('chPipe', { type: 'line', data: { labels: S.map(s => s.label), datasets: list.map((am, i) => ({ label: am, data: S.map(s => s.per[am].open), borderColor: COLORS[i], backgroundColor: COLORS[i] + '22', fill: true, tension: .3, pointRadius: 0, stack: 'a' })) }, options: { maintainAspectRatio: false, interaction: { mode: 'index' }, scales: { x: { grid: { display: false } }, y: { stacked: true, grid: { color: '#f0f1f3' }, border: { display: false }, ticks: { callback: v => eurK(v) } } }, plugins: { tooltip: { callbacks: { label: c => `${c.dataset.label}: ${eur(c.raw)}` } } } } });
    const last = S.at(-1), prev = S.at(-2); const t = k => sum(list, am => last.per[am][k]); const start = sum(list, am => prev.per[am].open);
    let run = start; const steps = [['Start', [0, start], '#8a8f9c']]; [['Nieuw', t('nieuw'), COLORS[2]], ['Gewonnen', -t('gewonnen'), COLORS[0]], ['Verloren', -t('verloren'), COLORS[4]], ['Gemuteerd', t('gemuteerd'), COLORS[3]]].forEach(([l, v, c]) => { steps.push([l, [run, run + v], c]); run += v; }); steps.push(['Eind', [0, run], '#14171f']);
    mk('chWater', { type: 'bar', data: { labels: steps.map(s => s[0]), datasets: [{ data: steps.map(s => s[1]), backgroundColor: steps.map(s => s[2]), borderRadius: 3 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => eur(c.raw[1] - c.raw[0]) } } }, scales: { x: { grid: { display: false } }, y: { min: Math.floor(start * 0.8 / 1e5) * 1e5, grid: { color: '#f0f1f3' }, border: { display: false }, ticks: { callback: v => eurK(v) } } } } });
  };

  // ----- Opzet -----
  function pageOpzet() {
    return head('Technische opzet', 'Een beperkte extra laag bovenop de bestaande infrastructuur. Bestaande systemen blijven bestaan.') + `
      <div class="grid">
        <div class="card c12"><h3>Dataflow</h3><div class="sub">Bronsysteem → reporting-datalaag → dashboard / CoPilot</div>
          <div class="arch">
            <div class="node"><b>CRM / bronsysteem</b>Bestaande API's als primaire databron. Leads, afspraken, offertes, orders, adviseurs.</div>
            <div class="node"><b>Reporting-database</b>Azure · historische snapshots (wekelijks), afgeleide KPI's, aanvullende analyse-data.</div>
            <div class="node"><b>Webapplicatie</b>Dashboards, filters, drilldowns. Pagina-niveau rechten op basis van rol.</div>
            <div class="node"><b>Microsoft 365 / Okta</b>Login, rollen en autorisatie. Eén set rechten voor dashboard én CoPilot.</div>
            <div class="node"><b>CoPilot-interface</b>Gestandaardiseerde vragen op vooraf gedefinieerde datasets. Geen vrije databasetoegang.</div>
          </div></div>
        <div class="card c6"><h3>Rollen en zichtbaarheid</h3><div class="sub">Bestaande M365-groepen bepalen welke dashboards, datasets en analyses iemand mag benaderen. Wissel de rol rechtsboven om dit te zien.</div>
          <table><thead><tr><th>Onderdeel</th><th>Directie</th><th>Salesmanager</th><th>Adviseur</th></tr></thead><tbody>
          ${[['Management dashboard', 1, 0, 0], ['Sales & commercie', 1, 1, 'eigen'], ['Productanalyse (incl. marge)', 1, 'zonder marge', 0], ['Regionale analyse', 1, 1, 0], ['Pipeline-ontwikkeling', 1, 1, 'eigen'], ['CoPilot-datasets', 5, 5, 3]].map(r => `<tr><td>${r[0]}</td>${r.slice(1).map(v => `<td>${v === 1 ? '<span class="tag good">✓</span>' : v === 0 ? '<span class="tag bad">–</span>' : `<span class="tag warn">${v}</span>`}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
        <div class="card c6"><h3>Vooraf gedefinieerde datasets voor CoPilot</h3><div class="sub">CoPilot vertaalt een vraag naar één van deze datasets, voert de analyse uit en antwoordt met dezelfde definities als het dashboard.</div>
          <table><thead><tr><th>Dataset</th><th>Beantwoordt</th></tr></thead><tbody>
            <tr><td><code>omzet-funnel</code></td><td>Waar in de funnel verandert omzet of conversie?</td></tr>
            <tr><td><code>adviseur-conversie</code></td><td>Welke adviseurs stijgen of dalen per funnelstap?</td></tr>
            <tr><td><code>regio-capaciteit</code></td><td>Waar past de vraag niet bij de capaciteit?</td></tr>
            <tr><td><code>product-groei</code></td><td>Welke producten en combinaties groeien of krimpen?</td></tr>
            <tr><td><code>pipeline-mutaties</code></td><td>Waarom beweegt de portefeuille, en bij wie?</td></tr>
          </tbody></table>
          <p class="hint" style="margin:12px 0 0">Definities, rechten en bedrijfslogica blijven centraal beheerd. Een vraag buiten deze datasets wordt netjes geweigerd, niet vrij geïnterpreteerd.</p></div>
        <div class="card c12"><h3>Waarom dit sneller kan</h3><div class="sub">AI-assisted maatwerk verandert de business case</div>
          <div class="grid" style="grid-template-columns:repeat(3,1fr)">
            <div><b>Weken in plaats van maanden</b><p class="hint">Mens ontwerpt het systeem, prompt, controleert en deployt. Het model bouwt. IT doet een audit.</p></div>
            <div><b>In eigen beheer</b><p class="hint">Geen externe bouwpartij. Historie en definities staan in de eigen Azure-omgeving.</p></div>
            <div><b>Eén omgeving, één rechtenset</b><p class="hint">Geen rapport-niveau rechten zoals bij losse BI-tools, maar pagina- en datasetniveau, voor mens én CoPilot.</p></div>
          </div></div>
      </div>`;
  }


  // ---------- Drilldown ----------
  const DIMS = { adviseur: 'Adviseur', product: 'Product', regio: 'Regio', leadsoort: 'Leadsoort', maand: 'Maand' };
  const dimLabel = (k, v) => k === 'adviseur' ? advNaam(v) : k === 'maand' ? mLabel(v) : v;
  let drillStack = [];
  const ctxFilter = (leads, ctx) => leads.filter(l => Object.entries(ctx).every(([k, v]) => k === 'product' ? l.items.includes(v) : l[k] === v));
  const drillAttr = ctx => `data-drill='${JSON.stringify(ctx).replace(/'/g, '&#39;')}'`;
  function openDrill(ctx, push = true) {
    if (role().eigen && ctx.adviseur && ctx.adviseur !== role().adviseurId) return;
    if (push) drillStack.push(ctx); else drillStack[drillStack.length - 1] = ctx;
    renderDrill();
  }
  function closeDrill() { drillStack = []; $('#drill').hidden = true; $('#drillBack').hidden = true; charts.filter(c => c.canvas.closest('#drill')).forEach(c => c.destroy()); charts = charts.filter(c => !c.canvas.closest('#drill')); }
  function renderDrill() {
    charts.filter(c => c.canvas.closest('#drill')).forEach(c => c.destroy()); charts = charts.filter(c => !c.canvas.closest('#drill'));
    const ctx = drillStack.at(-1); const dim = ctx._dim || Object.keys(DIMS).find(k => !(k in ctx));
    const months = ctx.maand ? [ctx.maand] : periodMonths(); const pm = prevMonths(months);
    const base = ctxFilter(applyFilters(scoped()), Object.fromEntries(Object.entries(ctx).filter(([k]) => k !== 'maand' && k !== '_dim')));
    const cur = inMonths(base, months), prev = inMonths(base, pm); const s = stats(cur), p = stats(prev);
    const crumbs = drillStack.map((c, i) => `<button class="crumb ${i === drillStack.length - 1 ? 'on' : ''}" data-crumb="${i}">${Object.entries(c).filter(([k]) => k !== '_dim').map(([k, v]) => dimLabel(k, v)).join(' · ') || 'Alles'}</button>`).join('<span class="crumb-sep">›</span>');
    const title = Object.entries(ctx).filter(([k]) => k !== '_dim').map(([k, v]) => dimLabel(k, v)).join(' · ') || 'Totaal';
    const rows = Object.entries(groupBy(cur, l => dim === 'product' ? l.items[0] : l[dim])).map(([k, g]) => ({ k, s: stats(g), p: stats(prev.filter(l => (dim === 'product' ? l.items[0] : l[dim]) === k)) })).sort((a, b) => dim === 'maand' ? a.k.localeCompare(b.k) : b.s.omzet - a.s.omzet);
    const recs = cur.slice().sort((a, b) => b.stage - a.stage || b.waarde - a.waarde).slice(0, 40);
    const stageTag = st => `<span class="tag ${st >= 4 ? 'good' : st === 3 ? 'warn' : ''}">${D.STAGES[st]}</span>`;
    $('#drillBody').innerHTML = `
      <div class="crumbs">${crumbs}</div>
      <h2>${title}</h2><p class="hint">${months.length === 1 ? mLabel(months[0]) : `${mLabel(months[0])} t/m ${mLabel(months.at(-1))}`} · ${num(cur.length)} leads${pm.length ? ` · vergeleken met ${months.length === 1 ? mLabel(pm[0]) : `${mLabel(pm[0])} t/m ${mLabel(pm.at(-1))}`}` : ''}</p>
      <div class="dkpis">
        <div><span>Leads</span><b>${num(s.leads)}</b>${delta(s.leads, p.leads)}</div>
        <div><span>Offertes</span><b>${num(s.offertes)}</b>${delta(s.offertes, p.offertes)}</div>
        <div><span>Orders</span><b>${num(s.orders)}</b>${delta(s.orders, p.orders)}</div>
        <div><span>Omzet</span><b>${eurK(s.omzet)}</b>${delta(s.omzet, p.omzet)}</div>
        <div><span>Conversie</span><b>${pct(s.conv, 1)}</b>${delta(s.conv, p.conv)}</div>
        ${role().marge ? `<div><span>Marge</span><b>${eurK(s.marge)}</b>${delta(s.marge, p.marge)}</div>` : ''}
      </div>
      <div class="dgrid">
        <div class="card"><h3>Funnel</h3><div class="sub">Conversie per stap t.o.v. vorige periode</div>${funnelHtml(cur, prev)}</div>
        <div class="card"><h3>Ontwikkeling</h3><div class="sub">Omzet en leads per maand voor deze selectie</div><div class="chart short"><canvas id="chDrill"></canvas></div></div>
      </div>
      <div class="card"><div class="dhead"><div><h3>Uitsplitsen naar</h3><div class="sub">Klik een rij om verder in te zoomen</div></div><div class="dimchips">${Object.entries(DIMS).filter(([k]) => !(k in ctx) || k === '_dim').map(([k, l]) => `<button class="chip ${k === dim ? 'on' : ''}" data-dim="${k}">${l}</button>`).join('')}</div></div>
        <table><thead><tr><th>${DIMS[dim]}</th><th class="num">Leads</th><th class="num">Afspraken</th><th class="num">Offertes</th><th class="num">Orders</th><th class="num">Conversie</th><th class="num">Omzet</th><th class="num">Δ omzet</th><th></th></tr></thead><tbody>
        ${rows.map(r => `<tr class="drillrow" ${drillAttr({ ...Object.fromEntries(Object.entries(ctx).filter(([k]) => k !== '_dim')), [dim]: r.k })}><td><b>${dimLabel(dim, r.k)}</b></td><td class="num">${r.s.leads}</td><td class="num">${r.s.afspraken}</td><td class="num">${r.s.offertes}</td><td class="num">${r.s.orders}</td><td class="num">${pct(r.s.conv, 1)}</td><td class="num">${eur(r.s.omzet)} <span class="bar" style="width:${rows[0].s.omzet ? r.s.omzet / Math.max(...rows.map(x => x.s.omzet)) * 50 : 0}px"></span></td><td class="num">${r.p.omzet < 3000 ? '<span class="delta flat">–</span>' : delta(r.s.omzet, r.p.omzet)}</td><td class="num" style="color:var(--muted)">›</td></tr>`).join('')}</tbody></table></div>
      <div class="card"><h3>Onderliggende records</h3><div class="sub">${recs.length < cur.length ? `Top ${recs.length} van ${num(cur.length)}, gesorteerd op funnelstap en waarde` : `${cur.length} leads uit het bronsysteem`}</div>
        <div style="overflow-x:auto"><table class="recs"><thead><tr><th>#</th><th>Maand</th><th>Adviseur</th><th>Regio</th><th>Leadsoort</th><th>Producten</th><th>Stap</th><th class="num">Waarde</th></tr></thead><tbody>
        ${recs.map(l => `<tr><td class="mono">L-${String(l.id).padStart(5, '0')}</td><td>${mLabel(l.maand)}</td><td>${advNaam(l.adviseur)}</td><td>${l.regio}${l.extern ? ' <span class="tag">op afstand</span>' : ''}</td><td>${l.leadsoort}</td><td>${l.items.join(' + ')}</td><td>${stageTag(l.stage)}</td><td class="num">${l.waarde ? eur(l.waarde) : '–'}</td></tr>`).join('')}</tbody></table></div></div>`;
    $('#drill').hidden = false; $('#drillBack').hidden = false; $('#drill').scrollTop = 0;
    const trendMonths = ctx.maand ? KEYS : KEYS;
    const byM = trendMonths.map(m => stats(base.filter(l => l.maand === m)));
    mk('chDrill', { data: { labels: trendMonths.map(mLabel), datasets: [{ type: 'bar', label: 'Omzet', data: byM.map(x => x.omzet), backgroundColor: trendMonths.map(m => months.includes(m) ? COLORS[0] : '#c9d3f5'), borderRadius: 3, yAxisID: 'y' }, { type: 'line', label: 'Leads', data: byM.map(x => x.leads), borderColor: COLORS[1], backgroundColor: COLORS[1], tension: .3, pointRadius: 2, yAxisID: 'y1' }] }, options: { maintainAspectRatio: false, onClick: (e, els) => { if (els.length) openDrill({ ...Object.fromEntries(Object.entries(ctx).filter(([k]) => k !== '_dim' && k !== 'maand')), maand: trendMonths[els[0].index] }); }, scales: { x: { grid: { display: false }, ticks: { font: { size: 10 } } }, y: { grid: { color: '#f0f1f3' }, border: { display: false }, ticks: { callback: v => eurK(v), font: { size: 10 } } }, y1: { position: 'right', grid: { display: false }, border: { display: false }, ticks: { font: { size: 10 } } } }, plugins: { legend: { labels: { font: { size: 10 } } }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.dataset.label === 'Omzet' ? eur(c.raw) : c.raw}` } } } } });
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
      const worst = steps.slice().sort((a, b) => a.d - b.d)[0];
      const web = cur.filter(l => l.leadsoort === 'Website').length, webP = prev.filter(l => l.leadsoort === 'Website').length;
      let who = '';
      const wi = steps.indexOf(worst) + 1;
      if (!r.eigen) { const advs = D.ADVISEURS.map(a => { const c = cur.filter(l => l.adviseur === a.id), pv = prev.filter(l => l.adviseur === a.id); const f = g => g.filter(l => l.stage >= wi).length / (g.filter(l => l.stage >= wi - 1).length || 1); return { a, d: f(c) - f(pv) }; }).sort((x, y) => x.d - y.d).slice(0, 2); who = `<p>De daling in die stap zit vooral bij <b>${advs.map(x => `${x.a.naam} (${(x.d * 100).toFixed(0)}pt)`).join('</b> en <b>')}</b>. De overige adviseurs bewegen binnen de normale bandbreedte.</p>`; }
      const id = 'mini' + Date.now();
      setTimeout(() => mk(id, { type: 'bar', data: { labels: steps.map(x => x.stap), datasets: [{ label: mLabel(D.VORIG), data: steps.map(x => +(x.prev * 100).toFixed(1)), backgroundColor: '#d9dde6', borderRadius: 3 }, { label: mLabel(D.HUIDIG), data: steps.map(x => +(x.cur * 100).toFixed(1)), backgroundColor: steps.map(x => x.d < -0.05 ? COLORS[4] : COLORS[0]), borderRadius: 3 }] }, options: { maintainAspectRatio: false, scales: { x: { grid: { display: false }, ticks: { font: { size: 9.5 } } }, y: { grid: { color: '#f0f1f3' }, border: { display: false }, ticks: { callback: v => v + '%' } } }, plugins: { legend: { labels: { font: { size: 10 } } } } } }), 30);
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
      const rows = regioRows([D.HUIDIG]).sort((a, b) => b.ratio - a.ratio);
      const none = rows.filter(x => x.cap === 0), tekort = rows.filter(x => x.cap > 0 && x.ratio > 1.3), ruimte = rows.filter(x => x.cap > 0 && x.ratio < 0.7);
      return `<p>In ${mLabel(D.HUIDIG)} is de onbalans het grootst in:</p><ul>${tekort.map(x => `<li><b>${x.r.naam}</b>: ${x.s.leads} leads voor ${Math.round(x.cap)} afspraakslots (${x.ratio.toFixed(2)} leads per slot, ${x.advs} adviseur). Conversie ${pct(x.s.conv, 1)}.</li>`).join('')}<li><b>Zonder eigen adviseur</b>: ${none.map(x => `${x.r.naam} (${x.s.leads})`).join(', ')}. Samen ${sum(none, x => x.s.leads)} leads die op afstand worden bediend, met een conversie van ${pct(sum(none, x => x.s.orders) / sum(none, x => x.s.leads), 1)} tegenover ${pct(sum(rows.filter(x => x.cap > 0), x => x.s.orders) / sum(rows.filter(x => x.cap > 0), x => x.s.leads), 1)} in regio's met eigen adviseur.</li></ul><p>Ruimte is er in ${ruimte.map(x => `${x.r.naam} (${x.ratio.toFixed(2)})`).join(' en ')}. Een herverdeling van ${ruimte[0]?.r.naam} naar Zuid-Holland zou de druk daar het snelst verlagen.</p>${src('regio-capaciteit', 'capaciteit = som afspraakslots adviseurs in regio × 4,33 weken')}`;
    }
    if (/product|groei|verkoopt|verkopen/.test(t)) {
      if (!r.datasets.includes('product-groei')) return deny('product-groei');
      const g = productGrowth();
      return `<p>Groei in omzet, laatste 3 maanden t.o.v. de 3 maanden ervoor:</p><ul>${g.slice(0, 3).map(x => `<li><b>${x.p.naam}</b>: +${pct(x.g, 0)} (${eurK(x.prev)} → ${eurK(x.cur)})</li>`).join('')}</ul><p>Achterblijvers: ${g.slice(-2).map(x => `<b>${x.p.naam}</b> (${pct(x.g, 0)})`).join(' en ')}. ${g.at(-1).p.naam} verliest al meerdere maanden op rij aandeel${r.marge ? `, terwijl ${g[0].p.naam} met ${pct(g[0].p.marge)} ook een hogere marge heeft dan ${g.at(-1).p.naam} (${pct(g.at(-1).p.marge)})` : ''}.</p><p>${g[0].p.naam} wordt in ${pct(D.LEADS.filter(l => l.stage >= 4 && l.items.includes(g[0].p.naam) && l.items.length > 1).length / (D.LEADS.filter(l => l.stage >= 4 && l.items.includes(g[0].p.naam)).length || 1), 0)} van de orders gecombineerd met een ander product, meestal ${(() => { const c = {}; D.LEADS.filter(l => l.stage >= 4 && l.items.includes(g[0].p.naam) && l.items.length > 1).forEach(l => l.items.filter(i => i !== g[0].p.naam).forEach(i => c[i] = (c[i] || 0) + 1)); return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] || '–'; })()}.</p>${src('product-groei', 'omzet per product = orderwaarde gedeeld over producten in de order')}`;
    }
    if (/pipeline|portefeuille|gezakt|400/.test(t)) {
      const list = ams(); const last = D.SNAPSHOTS.at(-1), prev = D.SNAPSHOTS.at(-2);
      const d = sum(list, am => last.per[am].open - prev.per[am].open); const per = list.map(am => ({ am, ...last.per[am], d: last.per[am].open - prev.per[am].open })).sort((a, b) => a.d - b.d);
      const big = per[0];
      const avgVerloren = sum(D.SNAPSHOTS.slice(-9, -1), s => sum(list, am => s.per[am].verloren)) / 8;
      return `<p>De ${r.eigen ? 'eigen ' : ''}portefeuille daalde van ${eurK(sum(list, am => prev.per[am].open))} naar ${eurK(sum(list, am => last.per[am].open))} tussen ${prev.label} en ${last.label}: <b>${eurK(d)}</b>.</p><ul><li><b>Verloren:</b> ${eurK(sum(list, am => last.per[am].verloren))}, tegenover gemiddeld ${eurK(avgVerloren)} per week in de 8 weken ervoor.</li><li><b>Gemuteerd:</b> ${eurK(sum(list, am => last.per[am].gemuteerd))} (offertes verlaagd in waarde).</li><li><b>Nieuw:</b> ${eurK(sum(list, am => last.per[am].nieuw))}, ${sum(list, am => last.per[am].nieuw) < sum(list, am => prev.per[am].nieuw) ? 'lager dan' : 'vergelijkbaar met'} vorige week.</li></ul>${r.eigen ? '' : `<p>Vrijwel de hele daling zit bij <b>${big.am}</b>: ${eurK(big.d)} in één week, waarvan ${eurK(big.verloren)} verloren. Dat past bij één of enkele grote offertes die zijn verlopen of afgewezen, niet bij een brede trend. Bij de andere accountmanagers bewegen de cijfers binnen de normale weekbandbreedte.</p>`}${src('pipeline-mutaties', 'wekelijkse snapshot; mutaties = verschil tussen twee snapshots per offerte')}`;
    }
    if (/leadsoort|website|leads.*dalen/.test(t)) {
      const cur = inMonths(scoped(), [D.HUIDIG]), prev = inMonths(scoped(), [D.VORIG]);
      const rows = D.LEADSOORTEN.map(ls => ({ ls, c: cur.filter(l => l.leadsoort === ls).length, p: prev.filter(l => l.leadsoort === ls).length })).map(x => ({ ...x, d: (x.c - x.p) / (x.p || 1) })).sort((a, b) => a.d - b.d);
      return `<p>Leads per soort, ${mLabel(D.HUIDIG)} t.o.v. ${mLabel(D.VORIG)}:</p><ul>${rows.map(x => `<li><b>${x.ls}</b>: ${x.p} → ${x.c} (${x.d >= 0 ? '+' : ''}${pct(x.d, 0)})</li>`).join('')}</ul><p>Het seizoenspatroon verklaart ongeveer −10%. ${rows[0].ls} daalt duidelijk harder dan dat; de overige soorten volgen het seizoen.</p>${src('omzet-funnel', 'leads per leadsoort per maand')}`;
    }
    return `<p>Deze vraag valt buiten de vooraf gedefinieerde datasets voor jouw rol. CoPilot krijgt geen vrije toegang tot de onderliggende database.</p><p>Beschikbaar voor <b>${r.label}</b>: ${r.datasets.map(d => `<code>${d}</code>`).join(', ')}. Probeer één van de voorbeeldvragen hieronder.</p>${src('–', 'geen dataset gematcht')}`;
  }

  function openCopilot(q) {
    $('#copilot').hidden = false; $('#app').classList.add('copilot-open');
    charts.forEach(c => c.resize());
    if (q) ask(q);
  }
  function ask(q) {
    const msgs = $('#msgs');
    msgs.insertAdjacentHTML('beforeend', `<div class="msg user">${q}</div>`);
    const tid = 't' + Date.now();
    msgs.insertAdjacentHTML('beforeend', `<div class="msg bot" id="${tid}"><span class="typing"><i></i><i></i><i></i></span></div>`);
    msgs.scrollTop = msgs.scrollHeight;
    setTimeout(() => { const el = document.getElementById(tid); el.innerHTML = answer(q); msgs.scrollTop = msgs.scrollHeight; setTimeout(() => msgs.scrollTop = msgs.scrollHeight, 120); }, 700 + Math.random() * 500);
  }
  function resetCopilot() {
    $('#msgs').innerHTML = `<div class="msg bot"><p>Hoi ${role().naam.split(' ')[0]}. Ik beantwoord businessvragen op dezelfde datasets en definities als het dashboard, binnen de rechten van je rol <b>${role().label}</b>.</p><p>Waar wil je inzicht in?</p></div>`;
    $('#chips').innerHTML = QUESTIONS.map(q => `<button class="chip" data-ask="${q}">${q}</button>`).join('');
  }

  // ---------- Events ----------
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-ask]'); if (a) { openCopilot(a.dataset.ask); return; }
    const d = e.target.closest('[data-drill]'); if (d) { openDrill(JSON.parse(d.dataset.drill)); return; }
    const cr = e.target.closest('[data-crumb]'); if (cr) { drillStack = drillStack.slice(0, +cr.dataset.crumb + 1); renderDrill(); return; }
    const dm = e.target.closest('[data-dim]'); if (dm) { drillStack.at(-1)._dim = dm.dataset.dim; renderDrill(); return; }
    if (e.target.closest('#drillBack') || e.target.closest('#closeDrill')) { closeDrill(); return; }
    const n = e.target.closest('.nav'); if (n && !n.disabled) { state.page = n.dataset.page; closeDrill(); render(); }
  });
  $('#role').onchange = e => { state.role = e.target.value; state.f.adviseur = ''; closeDrill(); resetCopilot(); render(); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#drill').hidden) closeDrill(); });
  $('#toggleCopilot').onclick = () => $('#copilot').hidden ? openCopilot() : closeCopilot();
  $('#closeCopilot').onclick = () => closeCopilot();
  function closeCopilot() { $('#copilot').hidden = true; $('#app').classList.remove('copilot-open'); charts.forEach(c => c.resize()); }
  $('#askForm').onsubmit = e => { e.preventDefault(); const v = $('#askInput').value.trim(); if (!v) return; $('#askInput').value = ''; ask(v); };

  // Deep links: #page=sales&role=adviseur&ask=<vraag>
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('role') && ROLES[h.get('role')]) { state.role = h.get('role'); $('#role').value = state.role; }
  if (h.get('page')) state.page = h.get('page');
  resetCopilot();
  render();
  if (h.get('ask')) openCopilot(h.get('ask'));
  if (h.get('drill')) { try { openDrill(JSON.parse(h.get('drill'))); } catch (e) { } }
  else if (h.get('copilot')) openCopilot();
})();
