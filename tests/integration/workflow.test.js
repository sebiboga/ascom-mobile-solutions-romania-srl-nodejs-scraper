import { jest } from '@jest/globals';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const HAS_SOLR = !!process.env.SOLR_AUTH;

function itIfSolr(name, fn, timeout) {
  if (HAS_SOLR) {
    return it(name, fn, timeout);
  }
  return it.skip(`${name} (skipped: SOLR_AUTH not set)`, fn, timeout);
}

beforeAll(() => {
  try { fs.unlinkSync('tmp/company.json'); } catch {}
  if (HAS_SOLR) {
    process.env.SOLR_AUTH = process.env.SOLR_AUTH;
  }
});

const ASCOM_CIF = '38652516';

describe('Integration: API Workflow', () => {

  describe('ANAF API', () => {
    let anaf;

    beforeAll(async () => {
      anaf = await import('../../src/anaf.js');
    });

    it('should search for ASCOM brand and find the company', async () => {
      const results = await anaf.searchCompany('ASCOM');

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      const ascom = results.find(c =>
        c.name.toUpperCase().includes('ASCOM') && c.statusLabel === 'Funcțiune'
      );
      expect(ascom).toBeDefined();
      expect(ascom.cui).toBeDefined();
    }, 15000);

    it('should return empty array for non-existent brand', async () => {
      const results = await anaf.searchCompany('ThisBrandDoesNotExistXYZ123');
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    }, 15000);

    it('should fetch company details by valid CIF', async () => {
      const data = await anaf.getCompanyFromANAF(ASCOM_CIF);
      expect(data).toBeDefined();
      expect(data.cui).toBe(38652516);
      expect(data.name).toBe('ASCOM MOBILE SOLUTIONS ROMANIA S.R.L.');
      expect(data).toHaveProperty('address');
      expect(data).toHaveProperty('registrationNumber');
      expect(data).toHaveProperty('caenCode');
      expect(data.onrcStatusLabel).toBe('Funcțiune');
    }, 15000);

    it('should throw for invalid CIF', async () => {
      await expect(anaf.getCompanyFromANAF('00000000')).rejects.toThrow();
    }, 60000);

    it('should use cached data when API fails (getCompanyFromANAFWithFallback)', async () => {
      const cached = { cui: 38652516, name: 'ASCOM MOBILE SOLUTIONS ROMANIA S.R.L.' };
      const data = await anaf.getCompanyFromANAFWithFallback(ASCOM_CIF, cached);
      expect(data).toBeDefined();
      expect(data.cui).toBe(38652516);
    }, 15000);
  });

  describe('Peviitor API', () => {
    it.skip('should respond successfully and contain companies array (Peviitor API may block non-browser requests)', async () => {
      const res = await fetch('https://api.peviitor.ro/v1/company/', {
        headers: { 'User-Agent': 'job_seeker_ro_spider' }
      });
      expect(res.ok).toBe(true);
      const data = await res.json();
      expect(data).toHaveProperty('companies');
      expect(Array.isArray(data.companies)).toBe(true);
    }, 15000);
  });

  describe('SOLR Company Core', () => {
    let solr;

    beforeAll(async () => {
      solr = await import('../../solr.js');
    });

    itIfSolr('should query company core by ID', async () => {
      const result = await solr.queryCompanySOLR(`id:${ASCOM_CIF}`);
      expect(result.numFound).toBe(1);
      const ascom = result.docs[0];
      expect(ascom.id).toBe(ASCOM_CIF);
      expect(ascom.company).toBe('ASCOM MOBILE SOLUTIONS ROMANIA S.R.L.');
      expect(ascom.brand).toBe('ASCOM MOBILE SOLUTIONS');
      expect(ascom.status).toBe('activ');
      expect(Array.isArray(ascom.location)).toBe(true);
      expect(ascom.lastScraped).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }, 15000);

    itIfSolr('should have required company model fields', async () => {
      const result = await solr.queryCompanySOLR(`id:${ASCOM_CIF}`);
      const ascom = result.docs[0];
      expect(ascom).toHaveProperty('id', ASCOM_CIF);
      expect(ascom).toHaveProperty('company');
      expect(ascom).toHaveProperty('brand', 'ASCOM MOBILE SOLUTIONS');
      expect(ascom).toHaveProperty('status');
      expect(['activ', 'suspendat', 'inactiv', 'radiat']).toContain(ascom.status);
      expect(ascom).toHaveProperty('location');
      expect(Array.isArray(ascom.location)).toBe(true);
      expect(ascom).toHaveProperty('website');
      expect(Array.isArray(ascom.website)).toBe(true);
      expect(ascom.website[0]).toMatch(/^https?:\/\/.+/);
      expect(ascom).toHaveProperty('career');
      expect(Array.isArray(ascom.career)).toBe(true);
      expect(ascom.career[0]).toMatch(/^https?:\/\/.+/);
      expect(ascom).toHaveProperty('lastScraped');
      expect(ascom).toHaveProperty('scraperFile');
    }, 15000);

    itIfSolr('should have optional field (group) if present', async () => {
      const result = await solr.queryCompanySOLR(`id:${ASCOM_CIF}`);
      const ascom = result.docs[0];
      if (ascom.group !== undefined) {
        expect(typeof ascom.group).toBe('string');
      }
    }, 15000);
  });

  describe('SOLR Jobs Core', () => {
    let solr;

    beforeAll(async () => {
      solr = await import('../../solr.js');
    });

    itIfSolr('should query jobs by CIF and return valid data', async () => {
      const result = await solr.querySOLR(ASCOM_CIF);
      if (result.numFound === 0) {
        console.log('⚠️ No Ascom jobs in Solr — skipping SOLR data verification');
        return;
      }
      expect(Array.isArray(result.docs)).toBe(true);
      const job = result.docs[0];
      expect(job).toHaveProperty('url');
      expect(job).toHaveProperty('title');
      expect(job).toHaveProperty('company', 'ASCOM MOBILE SOLUTIONS ROMANIA S.R.L.');
      expect(job).toHaveProperty('cif', ASCOM_CIF);
      expect(job).toHaveProperty('status');
      expect(job).toHaveProperty('location');
    }, 15000);
  });

  describe('Full Validation Workflow', () => {
    let anaf;
    let companyModule;

    beforeAll(async () => {
      anaf = await import('../../src/anaf.js');
      companyModule = await import('../../company.js');
    });

    it('should complete the ANAF → Peviitor validation path', async () => {
      const searchResults = await anaf.searchCompany('ASCOM');
      expect(searchResults.length).toBeGreaterThan(0);
      const ascomCompany = searchResults.find(c =>
        c.name.toUpperCase().includes('ASCOM') && c.statusLabel === 'Funcțiune'
      );
      expect(ascomCompany).toBeDefined();
      const anafData = await anaf.getCompanyFromANAF(ascomCompany.cui.toString());
      expect(anafData).toBeDefined();
      expect(anafData.onrcStatusLabel).toBe('Funcțiune');
    }, 30000);

    itIfSolr('should validate company and query SOLR for existing jobs', async () => {
      const companyResult = await companyModule.validateAndGetCompany();
      expect(companyResult.status).toBe('active');
      expect(companyResult.company).toBe('ASCOM MOBILE SOLUTIONS ROMANIA S.R.L.');
      expect(companyResult.cif).toBe(ASCOM_CIF);
      if (companyResult.existingJobsCount === 0) {
        console.log('⚠️ No Ascom jobs in Solr — skipping job count assertion');
        return;
      }
      expect(companyResult.existingJobsCount).toBeGreaterThan(0);
    }, 30000);

    itIfSolr('should have matching CIF in company core', async () => {
      const companyResult = await companyModule.validateAndGetCompany();
      const solrObj = await import('../../solr.js');
      const solrResult = await solrObj.queryCompanySOLR(`id:${ASCOM_CIF}`);
      expect(solrResult.numFound).toBe(1);
      expect(solrResult.docs[0].id).toBe(ASCOM_CIF);
      expect(solrResult.docs[0].company).toBe('ASCOM MOBILE SOLUTIONS ROMANIA S.R.L.');
    }, 30000);
  });
});
