# AGENTS.md — Rules for AI agents

## Project
ASCOM Mobile Solutions scraper for peviitor.ro (Node.js, ESM, Jest)

## Critical Rules

### 1. Temporary Files
All temporary/scratch files MUST go in `tmp/` inside the project root.
NEVER use paths outside the project.

### 2. Issues & GitHub
- Orice modificare de cod trebuie să aibă un issue în GitHub Issues
- Excepții: typo-uri, whitespace, documentație minoră
- Create a GitHub issue before implementing any change
- Commit messages must reference the issue they close
- Never commit credentials (`.env.local`, `*.pem`, etc.)

### 3. Environment Variables
- `SOLR_AUTH=your-solr-credentials` must be set for SOLR tests
- `.env.local` is in `.gitignore` — never commit it

### 4. Testing
```bash
npm test
node --experimental-vm-modules node_modules/jest/bin/jest.js --testPathPattern=integration --testTimeout=60000
node --experimental-vm-modules node_modules/jest/bin/jest.js --testPathPattern=e2e --testTimeout=60000
```

### 5. ESM + Jest
- Use `jest.unstable_mockModule` (NOT `jest.mock`) for mocking ESM modules
- Run with `--experimental-vm-modules` flag

### 6. Module Structure
- `src/anaf.js` — core ANAF library
- `company.js` — company validation (ANAF + Peviitor + SOLR)
- `solr.js` — SOLR operations
- `index.js` — main scraper orchestrator
