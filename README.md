# Solvara Insights · demo

Klikbare demo van een rapportagelaag bovenop een bestaand CRM/bronsysteem, met:

- Rolgebaseerde dashboards (gesimuleerde Microsoft 365-rollen: Directie, Salesmanager, Adviseur)
- Overzicht, Sales B2C, Sales B2B (klanten met type en status), Producten, Regio, Pipeline
- Kerncijfers met eigen periode (vandaag, gisteren, deze week, deze maand, dit jaar, of een datumbereik via de kalender)
- Omzet over tijd per maand of week, gestapeld naar een dimensie; elke staaf of segment splitst het onderste deel uit
- Detailpagina's voor klant, adviseur, product en regio, bereikbaar via elke naam in een tabel
- Een CoPilot-paneel dat businessvragen beantwoordt op vooraf gedefinieerde datasets, binnen dezelfde rechten

Alle data is synthetisch en fictief. Geen build-stap: statische HTML + Chart.js. Font: Mulish (DM Mono voor IDs).

- Globale filters (leadsoort, adviseur, product, regio, en op B2B klanttype en klantstatus) met eigen popovers

Deep links: `#page=b2b&role=adviseur&ask=<vraag>`, `#kp=maand`, `#detail=klant:k1`, `#drill=ov:maand:2026-08`, filters via `#regio=Zuid-Holland&product=Warmtepomp`.
