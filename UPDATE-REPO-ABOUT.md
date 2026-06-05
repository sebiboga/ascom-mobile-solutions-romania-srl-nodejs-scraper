# Actualizare About repo pe GitHub

## CLI (gh)

```bash
# Descriere
gh repo edit sebiboga/ascom-mobile-solutions-romania-srl-nodejs-scraper \
  --description "web scraper pentru a aduce locurile de munca de la ASCOM Mobile Solutions in platforma peviitor.ro"

# Website
gh repo edit sebiboga/ascom-mobile-solutions-romania-srl-nodejs-scraper \
  --homepage "https://sebiboga.github.io/ascom-mobile-solutions-romania-srl-nodejs-scraper/"

# Topics (EXACT aceste două)
gh repo edit sebiboga/ascom-mobile-solutions-romania-srl-nodejs-scraper \
  --add-topic job-seeker-ro-spider --add-topic peviitor-ro
```

## Verificare

```bash
gh repo view sebiboga/ascom-mobile-solutions-romania-srl-nodejs-scraper --json description,homepageUrl,repositoryTopics
```
