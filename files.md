# Project Files

## JavaScript Files

| File | Description |
|------|-------------|
| `index.js` | Main scraper - full workflow |
| `company.js` | Validates company via ANAF + Peviitor APIs |
| `solr.js` | SOLR operations module |
| `src/anaf.js` | ANAF API core module |

## Markdown Files

| File | Description |
|------|-------------|
| `instructions.md` | Project documentation |
| `job-model.md` | Job schema definition |
| `company-model.md` | Company schema definition |
| `files.md` | This file |

## Configuration Files

| File | Description |
|------|-------------|
| `package.json` | Node.js project config |
| `.gitignore` | Ignores node_modules/, .env, .env.local, tmp/, jobs.json |

## Dependencies (node_modules/)

- `node-fetch` - HTTP requests
- `cheerio` - HTML/XML parsing
