// Synthetische demo-data. Deterministisch (seeded) zodat de demo altijd hetzelfde verhaal vertelt.
(function () {
  let s = 20260915;
  const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  const pick = (arr, weights) => {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rnd() * total;
    for (let i = 0; i < arr.length; i++) { r -= weights[i]; if (r <= 0) return arr[i]; }
    return arr[arr.length - 1];
  };

  const REGIOS = [
    { naam: 'Groningen', pop: 0.6, col: 4, row: 0 },
    { naam: 'Friesland', pop: 0.65, col: 3, row: 0 },
    { naam: 'Drenthe', pop: 0.5, col: 4, row: 1 },
    { naam: 'Noord-Holland', pop: 2.9, col: 2, row: 1 },
    { naam: 'Flevoland', pop: 0.45, col: 3, row: 1 },
    { naam: 'Overijssel', pop: 1.2, col: 4, row: 2 },
    { naam: 'Zuid-Holland', pop: 3.8, col: 2, row: 2 },
    { naam: 'Utrecht', pop: 1.4, col: 3, row: 2 },
    { naam: 'Gelderland', pop: 2.1, col: 4, row: 3 },
    { naam: 'Zeeland', pop: 0.4, col: 1, row: 3 },
    { naam: 'Noord-Brabant', pop: 2.6, col: 2, row: 3 },
    { naam: 'Limburg', pop: 1.1, col: 3, row: 4 },
  ];

  const ADVISEURS = [
    { id: 'a1', naam: 'Sanne de Vries', regio: 'Noord-Holland', cap: 14 },
    { id: 'a2', naam: 'Bram Jansen', regio: 'Zuid-Holland', cap: 14 },
    { id: 'a3', naam: 'Lotte Bakker', regio: 'Utrecht', cap: 12 },
    { id: 'a4', naam: 'Daan Visser', regio: 'Noord-Brabant', cap: 14 },
    { id: 'a5', naam: 'Fleur Smit', regio: 'Gelderland', cap: 12 },
    { id: 'a6', naam: 'Tim Mulder', regio: 'Noord-Holland', cap: 10 },
    { id: 'a7', naam: 'Noor van Dijk', regio: 'Overijssel', cap: 12 },
    { id: 'a8', naam: 'Jesse Bos', regio: 'Limburg', cap: 10 },
    { id: 'a9', naam: 'Iris Peters', regio: 'Noord-Brabant', cap: 12 },
    { id: 'a10', naam: 'Ruben Hendriks', regio: 'Friesland', cap: 10 },
  ];

  const PRODUCTEN = [
    { naam: 'Warmtepomp', prijs: 9800, marge: 0.22, w: 1.6, trend: 0.01 },
    { naam: 'Zonnepanelen', prijs: 6400, marge: 0.19, w: 2.2, trend: -0.035 },
    { naam: 'Thuisbatterij', prijs: 5200, marge: 0.27, w: 0.7, trend: 0.07 },
    { naam: 'HR++ glas', prijs: 4700, marge: 0.31, w: 1.4, trend: 0.005 },
    { naam: 'Dakrenovatie', prijs: 7300, marge: 0.25, w: 1.1, trend: 0.0 },
    { naam: 'Vloerverwarming', prijs: 3900, marge: 0.29, w: 1.0, trend: 0.02 },
    { naam: 'Laadpaal', prijs: 1900, marge: 0.34, w: 1.2, trend: 0.03 },
    { naam: 'Ventilatiesysteem', prijs: 2800, marge: 0.28, w: 0.8, trend: -0.01 },
  ];

  const LEADSOORTEN = ['Website', 'Telefoon', 'Partner', 'Event'];
  const ACCOUNTMANAGERS = ['Bram Jansen', 'Lotte Bakker', 'Daan Visser', 'Fleur Smit', 'Noor van Dijk'];
  const KLANTTYPES = ['Aannemer', 'Woningcorporatie', 'VvE', 'Installateur', 'Projectontwikkelaar'];
  const KLANTNAMEN = ['Bouwbedrijf Van Rijn', 'Woonstichting De Linde', 'VvE Parkzicht', 'Installatiegroep Noord', 'Terra Ontwikkeling', 'Aannemersbedrijf Kuiper', 'Wooncorporatie Havenstad', 'VvE De Meander', 'Van Oort Installatietechniek', 'Meridiaan Vastgoed', 'Bouwgroep Elzinga', 'Stichting Wonen Zuid', 'VvE Zonnehof', 'Techniek & Klimaat Boer', 'Nova Projecten', 'Hendriks Bouw', 'Woningstichting Eemland', 'VvE Rivierkade', 'Installatiebedrijf Smeets', 'Delta Gebiedsontwikkeling', 'Aannemerij De Groot', 'Corporatie Groenland', 'VvE Het Baken', 'Warmtetechniek Verhoeven', 'Urban Living Projecten', 'Bouwcombinatie Westland', 'Stichting Thuis', 'VvE Lindenhof', 'Klimaatinstallaties Peeters', 'Vesta Ontwikkeling', 'Bouwbedrijf Molenaar', 'Woonbedrijf Maasoever', 'VvE Stationsplein', 'Installatieteam Zuid', 'Horizon Projectontwikkeling', 'Aannemer Ten Brink'];
  const KLANTEN = KLANTNAMEN.map((naam, i) => ({ id: 'k' + (i + 1), naam, type: KLANTTYPES[i % 5], regio: REGIOS[(i * 7) % REGIOS.length].naam, accountmanager: ACCOUNTMANAGERS[i % 5], top: [0, 3, 5, 9, 14, 19, 24, 29].includes(i), actief: ![6, 13, 22, 31, 34].includes(i), ontevreden: [4, 11, 17, 27, 33].includes(i), sinds: 2019 + (i % 7) }));
  const STAGES = ['Lead', 'Afspraak', 'Opname', 'Offerte', 'Order', 'Uitgevoerd'];

  // 13 maanden: sep 2025 t/m sep 2026 (laatste = huidige maand)
  const MAANDEN = [];
  for (let i = 12; i >= 0; i--) {
    const d = new Date(2026, 8 - i, 1);
    MAANDEN.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString('nl-NL', { month: 'short', year: '2-digit' }), maand: d.getMonth() });
  }
  const HUIDIG = MAANDEN[MAANDEN.length - 1].key;
  const VORIG = MAANDEN[MAANDEN.length - 2].key;

  const seizoen = m => 1 + 0.25 * Math.cos(((m - 3) / 12) * 2 * Math.PI); // piek in maart/april

  const LEADS = [];
  let id = 1;
  const VANDAAG = '2026-09-15';
  const dagen = (y, m) => new Date(y, m + 1, 0).getDate();
  const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  MAANDEN.forEach((mnd, mi) => {
    const isHuidig = mnd.key === HUIDIG;
    REGIOS.forEach(reg => {
      const jaar = +mnd.key.slice(0, 4); const nd = dagen(jaar, mnd.maand); const maxDag = isHuidig ? 15 : nd;
      const basis = 44 * reg.pop * seizoen(mnd.maand) * (1 + mi * 0.012) * (maxDag / nd);
      const n = Math.round(basis * (0.9 + rnd() * 0.2));
      const eigen = ADVISEURS.filter(a => a.regio === reg.naam);
      for (let k = 0; k < n; k++) {
        const soortW = [3.2 * (isHuidig ? 0.8 : 1), 1.4, 1.6, 0.8];
        const leadsoort = pick(LEADSOORTEN, soortW);
        const dag = 1 + Math.floor(rnd() * maxDag);
        const datum = `${mnd.key}-${String(dag).padStart(2, '0')}`;
        const b2b = rnd() < 0.18;
        const klant = b2b ? KLANTEN[Math.floor(rnd() * KLANTEN.length)] : null;
        const product = pick(PRODUCTEN, PRODUCTEN.map(p => p.w * Math.pow(1 + p.trend, mi)));
        const adv = klant ? ADVISEURS.find(a => a.naam === klant.accountmanager) : eigen.length ? eigen[Math.floor(rnd() * eigen.length)] : ADVISEURS[Math.floor(rnd() * ADVISEURS.length)];
        const extern = eigen.length === 0;

        // funnel-conversies
        let pAfspraak = { Website: 0.5, Telefoon: 0.62, Partner: 0.68, Event: 0.45 }[leadsoort];
        if (extern) pAfspraak *= 0.72; // geen adviseur in de regio: langere doorlooptijd, meer uitval
        if (klant) { pAfspraak = klant.top ? 0.85 : 0.7; if (klant.ontevreden) pAfspraak *= 0.75; if (!klant.actief) pAfspraak *= 0.5; }
        let pOpname = 0.86;
        let pOfferte = 0.8;
        let pOrder = { Website: 0.38, Telefoon: 0.42, Partner: 0.5, Event: 0.36 }[leadsoort];
        if (klant) pOrder = klant.top ? 0.6 : klant.ontevreden ? 0.25 : 0.45;
        // verhaal: in de huidige maand zakt opname -> offerte bij twee adviseurs fors
        if (isHuidig && (adv.id === 'a3' || adv.id === 'a7')) pOfferte = 0.36;
        if (isHuidig && adv.id === 'a2') pOfferte = 0.6;

        let stage = 0;
        if (rnd() < pAfspraak) stage = 1;
        if (stage === 1 && rnd() < pOpname) stage = 2;
        if (stage === 2 && rnd() < pOfferte) stage = 3;
        if (stage === 3 && rnd() < pOrder) stage = 4;
        let orderDatum = null;
        if (stage >= 4) { orderDatum = addDays(datum, 4 + Math.floor(rnd() * 32)); if (orderDatum > VANDAAG) { stage = 3; orderDatum = null; } }
        if (stage === 4 && orderDatum && orderDatum < addDays(VANDAAG, -30) && rnd() < 0.85) stage = 5;

        const items = [product.naam];
        if (stage >= 3 && rnd() < 0.28) {
          const p2 = pick(PRODUCTEN, PRODUCTEN.map(p => p.naam === product.naam ? 0 : p.w));
          items.push(p2.naam);
        }
        const mult = klant ? (klant.type === 'Woningcorporatie' || klant.type === 'Projectontwikkelaar' ? 2.5 + rnd() * 4 : 1.3 + rnd() * 1.6) : 1;
        const waarde = stage >= 3 ? Math.round(items.reduce((sum, nm) => sum + PRODUCTEN.find(p => p.naam === nm).prijs * (0.8 + rnd() * 0.45), 0) * mult / 10) * 10 : 0;
        const marge = stage >= 3 ? items.reduce((sum, nm) => { const p = PRODUCTEN.find(x => x.naam === nm); return sum + p.marge; }, 0) / items.length : 0;

        LEADS.push({ id: id++, maand: mnd.key, datum, regio: klant ? klant.regio : reg.naam, adviseur: adv.id, leadsoort, product: product.naam, items, stage, waarde, orderDatum, marge: +marge.toFixed(3), extern: extern && !klant, segment: klant ? 'B2B' : 'B2C', klant: klant ? klant.id : null });
      }
    });
  });

  // Pipeline-snapshots (B2B): 26 weken, wekelijkse opname van de openstaande offerteportefeuille per accountmanager en klanttype
  const SNAPSHOTS = [];
  const share = {}; ACCOUNTMANAGERS.forEach(am => { const w = KLANTTYPES.map(t => 0.6 + KLANTEN.filter(k => k.accountmanager === am && k.type === t).length * (0.8 + rnd() * 0.6)); const tot = w.reduce((a, b) => a + b, 0); share[am] = w.map(x => x / tot); });
  const bigType = am => KLANTTYPES[share[am].indexOf(Math.max(...share[am]))];
  const open = {}; ACCOUNTMANAGERS.forEach((am, i) => { const base = [1180000, 940000, 1010000, 760000, 690000][i]; open[am] = KLANTTYPES.map((t, j) => Math.round(base * share[am][j] / 1000) * 1000); });
  for (let w = 25; w >= 0; w--) {
    const d = new Date(2026, 8, 14); d.setDate(d.getDate() - w * 7);
    const per = {};
    ACCOUNTMANAGERS.forEach(am => {
      const types = {};
      KLANTTYPES.forEach((t, j) => {
        const sh = share[am][j];
        let nieuw = Math.round((90000 + rnd() * 80000) * sh / 1000) * 1000;
        const gewonnen = Math.round((50000 + rnd() * 60000) * sh / 1000) * 1000;
        let verloren = Math.round((20000 + rnd() * 40000) * sh / 1000) * 1000;
        let gemuteerd = Math.round((rnd() - 0.5) * 40000 * sh / 1000) * 1000;
        if (w === 0 && am === 'Bram Jansen' && t === bigType(am)) { verloren += 310000; gemuteerd -= 95000; }
        if (w === 0 && am === 'Noor van Dijk' && t === bigType(am)) { nieuw = Math.max(0, nieuw - 40000); }
        open[am][j] = open[am][j] + nieuw - gewonnen - verloren + gemuteerd;
        types[t] = { open: open[am][j], nieuw, gewonnen, verloren, gemuteerd };
      });
      const agg = k => KLANTTYPES.reduce((a, t) => a + types[t][k], 0);
      per[am] = { open: agg('open'), nieuw: agg('nieuw'), gewonnen: agg('gewonnen'), verloren: agg('verloren'), gemuteerd: agg('gemuteerd'), types };
    });
    SNAPSHOTS.push({ datum: d.toISOString().slice(0, 10), label: d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }), per });
  }

  LEADS.sort((a, b) => a.datum.localeCompare(b.datum));
  window.DATA = { REGIOS, ADVISEURS, PRODUCTEN, LEADSOORTEN, STAGES, MAANDEN, HUIDIG, VORIG, LEADS, ACCOUNTMANAGERS, SNAPSHOTS, KLANTEN, KLANTTYPES, VANDAAG };
})();
