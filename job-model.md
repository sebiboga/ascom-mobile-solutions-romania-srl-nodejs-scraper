# Job Model Schema

## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| url | string | Unique URL of the job posting (primary key) |
| title | string | Job title |
| company | string | Legal company name (uppercase, with diacritics) |
| cif | string | Company CIF/CUI (8 digits) |

## Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| location | string[] | Romanian cities. DIACRITICS ACCEPTED |
| tags | string[] | Keywords/tags for search. lowercase, no diacritics |
| remote | string | "remote", "on-site", or "hybrid" |
| description | string | Job description text |
| workmode | string | Working mode (remote, on-site, hybrid) |
| date | string | ISO 8601 date when job was scraped |
| status | string | scraped → tested/verified → published |
| vdate | string | Verification date (ISO 8601) |
| expirationdate | string | Expiration date (ISO 8601) |
| salary | string | Salary information |

## Status Flow

```
scraped → tested/verified → published
```
