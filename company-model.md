# Company Model Schema

## Required Fields

| Field   | Type   | Description |
|---------|--------|-------------|
| id      | string | CIF/CUI of the company (8 digits, no RO prefix) |
| company | string | Legal name from Trade Register. DIACRITICS REQUIRED. Use uppercase |

## Optional Fields

| Field        | Type     | Description |
|--------------|----------|-------------|
| brand        | string   | Commercial brand name (e.g. "ASCOM MOBILE SOLUTIONS") |
| group        | string   | Parent company group |
| status       | string   | "activ", "suspendat", "inactiv", or "radiat" |
| location     | string[] | Romanian cities/addresses. DIACRITICS ACCEPTED |
| website      | string[] | Official company website |
| career       | string[] | Official career/jobs page |
| lastScraped  | string   | Date of last scrape in ISO8601 |
| scraperFile  | string   | URL to scraper workflow YML file |

## Notes

- **scraperFile**: Full URL to GitHub raw workflow YML
