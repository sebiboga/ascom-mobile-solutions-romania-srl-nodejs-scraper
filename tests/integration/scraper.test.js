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

const ASCOM_BRAND = 'ASCOM MOBILE SOLUTIONS';
const ASCOM_COMPANY = 'ASCOM MOBILE SOLUTIONS ROMANIA S.R.L.';
const ASCOM_CIF = '38652516';

beforeAll(() => {
  try { fs.unlinkSync('tmp/company.json'); } catch {}
  if (HAS_SOLR) {
    process.env.SOLR_AUTH = process.env.SOLR_AUTH;
  }
});

describe('Integration: Scraper', () => {

  describe('Company Validation', () => {
    let company;

    beforeAll(async () => {
      company = await import('../../company.js');
    });

    it('should validate company data from ANAF', async () => {
      const companyData = await company.getCompanyData();
      expect(companyData).toHaveProperty('company', ASCOM_COMPANY);
      expect(companyData).toHaveProperty('cif', ASCOM_CIF);
      expect(companyData).toHaveProperty('active', true);
    }, 30000);

    it('should load company from cache if tmp/company.json exists', async () => {
      const testData = { summary: { company: ASCOM_COMPANY, cif: ASCOM_CIF, active: true }, anaf: { name: ASCOM_COMPANY, cui: parseInt(ASCOM_CIF) } };
      fs.mkdirSync('tmp', { recursive: true });
      fs.writeFileSync('tmp/company.json', JSON.stringify(testData));
      const companyData = await company.getCompanyData();
      expect(companyData.company).toBe(ASCOM_COMPANY);
      expect(companyData.cif).toBe(ASCOM_CIF);
    }, 15000);

    it('should detect inactive company', async () => {
      const anaf = await import('../../src/anaf.js');
      const inactiveRecord = {
        cui: 99999999, name: 'INACTIVE COMPANY S.R.L.', address: 'Test address',
        caenCode: '6201', inactive: true, vatRegistered: false, eFacturaRegistered: false
      };
      const anafData = await anaf.getCompanyFromANAFWithFallback('99999999', inactiveRecord);
      expect(anafData.inactive).toBe(true);
    }, 15000);
  });

  describe('Index Module Exports', () => {
    let index;

    beforeAll(async () => {
      index = await import('../../index.js');
    });

    it('should export parseApiJobs', () => {
      expect(typeof index.parseApiJobs).toBe('function');
    });

    it('should export mapToJobModel', () => {
      expect(typeof index.mapToJobModel).toBe('function');
    });

    it('should export transformJobsForSOLR', () => {
      expect(typeof index.transformJobsForSOLR).toBe('function');
    });
  });

  describe('SOLR Indexing', () => {
    let solr;

    beforeAll(async () => {
      solr = await import('../../solr.js');
    });

    itIfSolr('should add jobs to Solr and return success status', async () => {
      const jobs = [{
        url: 'https://career.ascom.com/job/test-job',
        title: 'Test Job - Integration Test',
        company: ASCOM_COMPANY, city: 'Cluj-Napoca', county: 'Cluj',
        country: 'Romania', remote: [], published: new Date().toISOString().split('T')[0]
      }];
      const result = await solr.upsertJobs(jobs);
      expect(result).toBeDefined();
      expect(result.status).toBe(0);
    }, 15000);

    itIfSolr('should be able to remove test jobs after adding', async () => {
      const url = 'https://career.ascom.com/job/test-job';
      const result = await solr.deleteJobByUrl(url);
      expect(result).toBeDefined();
      expect(result.status).toBe(0);
    }, 15000);
  });

  describe('Full Verification', () => {
    itIfSolr('should verify company exists in SOLR after scrape', async () => {
      const solr = await import('../../solr.js');
      const solrResult = await solr.queryCompanySOLR(`id:${ASCOM_CIF}`);
      expect(solrResult.numFound).toBe(1);
      expect(solrResult.docs[0].company).toBe(ASCOM_COMPANY);
      expect(solrResult.docs[0].status).toBe('activ');
    }, 15000);

    itIfSolr('should have correct company model in company core', async () => {
      const solr = await import('../../solr.js');
      const solrResult = await solr.queryCompanySOLR(`id:${ASCOM_CIF}`);
      const ascom = solrResult.docs[0];
      expect(ascom).toHaveProperty('id', ASCOM_CIF);
      expect(ascom).toHaveProperty('company', ASCOM_COMPANY);
      expect(ascom).toHaveProperty('brand', ASCOM_BRAND);
      expect(ascom).toHaveProperty('location');
      expect(Array.isArray(ascom.location)).toBe(true);
      expect(ascom.location.length).toBeGreaterThan(0);
      expect(ascom).toHaveProperty('website');
      expect(Array.isArray(ascom.website)).toBe(true);
      expect(ascom.website[0]).toMatch(/^https?:\/\//);
      expect(ascom).toHaveProperty('career');
      expect(Array.isArray(ascom.career)).toBe(true);
      expect(ascom.career[0]).toMatch(/^https?:\/\//);
      expect(ascom).toHaveProperty('lastScraped');
      expect(ascom.lastScraped).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(ascom).toHaveProperty('scraperFile');
      expect(ascom.scraperFile).toMatch(/nodejs-scraper\/scraper\.py$/);
    }, 15000);
  });
});
