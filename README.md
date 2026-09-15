# Solvara Insights · demo

Klikbare demo van een rapportagelaag bovenop een bestaand CRM/bronsysteem, met:

- Rolgebaseerde dashboards (gesimuleerde Microsoft 365-rollen: Directie, Salesmanager, Adviseur)
- Management, Sales & commercie, Productanalyse, Regionale analyse, Pipeline-ontwikkeling
- Een CoPilot-paneel dat businessvragen beantwoordt op vooraf gedefinieerde datasets, binnen dezelfde rechten

Alle data is synthetisch en fictief. Geen build-stap: statische HTML + Chart.js.

- Periode: maand-bereik (van/tot) met snelkeuzes
- Drilldowns: klik op een KPI, tabelrij, regiotegel of staaf in een grafiek; zoom verder via 'Uitsplitsen naar'

Deep links: `#page=sales&role=adviseur&ask=<vraag>` of `#copilot=1`, drilldown via `#drill={"adviseur":"a3"}`.
