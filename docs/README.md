# job_seeker_ro_spider

**job_seeker_ro_spider** — scraper pentru job-urile ASCOM Mobile Solutions Romania din România.

Extrage anunțurile de pe [ASCOM Careers](https://career.ascom.com/jobs.json) și le publică în [peviitor.ro](https://peviitor.ro).

## Ce face

1. **Validează compania** — interoghează API-ul ANAF după brand-ul ASCOM
2. **Cross-validează cu Peviitor** — verifică existența în API-ul Peviitor
3. **Fetch JSON API** — extrage lista de job-uri
4. **Parsează și filtrează** — păstrează doar job-urile din România
5. **Stochează în SOLR**

## Structură proiect

```
├── index.js           # Orchestrator principal
├── company.js         # Validare companie
├── src/anaf.js        # Modul ANAF API
├── solr.js            # Operații SOLR
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── .github/workflows/
    ├── scrape.yml     # Rulează zilnic la 6 AM
    └── test.yml       # Teste la fiecare push/PR
```

## Testare

```bash
npm test
npm run test:unit
npm run test:integration
npm run test:e2e
```
