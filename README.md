# Solvara Insights · demo

Klikbare demo van een rapportagelaag bovenop een bestaand CRM/bronsysteem, met:

- Rolgebaseerde dashboards (gesimuleerde Microsoft 365-rollen: Directie, Salesmanager, Adviseur)
- Management, Sales & commercie, Productanalyse, Regionale analyse, Pipeline-ontwikkeling
- Een CoPilot-paneel dat businessvragen beantwoordt op vooraf gedefinieerde datasets, binnen dezelfde rechten

Alle data is synthetisch en fictief. Geen build-stap: statische HTML + Chart.js. Fonts: DM Sans, Fraunces, DM Mono.

- Eén globale filterbalk (periode, leadsoort, adviseur, product, regio) die elke pagina stuurt
- Drilldown = cross-filtering: klik op een rij, staaf, regiotegel of maand en de hele pagina filtert mee; filters verschijnen als chips

Deep links: `#page=sales&role=adviseur&ask=<vraag>`, `#copilot=1`, filters via `#regio=Zuid-Holland&product=Warmtepomp&van=2026-07&tot=2026-09`.
