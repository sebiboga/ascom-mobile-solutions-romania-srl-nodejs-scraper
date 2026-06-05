# Robots.txt Analysis — career.ascom.com

Sursa: https://career.ascom.com/robots.txt

## Reguli

```
User-agent: *
Allow: /
```

## Interpretare

| Cale | Accesibil? | Ce conține |
|---|---|---|
| `/` | ✅ Da | Pagina principală |
| `/jobs.json` | ✅ Da | API JSON cu job-urile |
| `/jobs/*` | ✅ Da | Pagini individuale de job |

## Recomandare

- Scraperul accesează doar API-ul JSON — permis de robots.txt
- Rate limiting: 1 request per fetch, delay rezonabil
- User-Agent standard
- Riscul de blocare este minim
