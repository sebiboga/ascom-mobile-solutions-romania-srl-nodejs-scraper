# ASCOM — Verification Checklist

## Pașul 1: Teste Locale
- [ ] `npm test` — toate testele trec
- [ ] `node company.js` — validare ANAF + Peviitor funcționează
- [ ] `node index.js` — scrape-ul se execută fără erori
- [ ] `tmp/company.json` e generat corect

## Pașul 2: GitHub Actions
- [ ] `Automation-Tests` — toate testele trec în CI
- [ ] `validate-jobs` — Ascom apare în SOLR
- [ ] `Scheduled Scrape` — rulează zilnic

## Note
- CIF: 38652516
- Brand: ASCOM MOBILE SOLUTIONS
- Frecvență scrape: zilnic (06:00 UTC)
- Site: https://www.ascom.com
