import { jest } from '@jest/globals';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

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
  if (HAS_SOLR) {
    process.env.SOLR_AUTH = process.env.SOLR_AUTH;
  }
});

const TEST_CIF = '38652516';
const TEST_BRAND = 'ASCOM';
const ASCOM_JOBS_API = 'https://career.ascom.com/jobs.json';

describe('E2E: Full Scraping Pipeline', () => {

  describe('ASCOM Jobs API — Real Data Fetch', () => {
    let jsonData;

    beforeAll(async () => {
      const res = await fetch(ASCOM_JOBS_API, {
        headers: {
          'User-Agent': 'job_seeker_ro_spider',
          'Accept': 'application/json'
        }
      });
      jsonData = await res.json();
    }, 15000);

    it('should respond with valid JSON from ASCOM API', () => {
      expect(jsonData).toBeDefined();
      expect(jsonData).toHaveProperty('items');
    });

    it('should contain job listings', () => {
      expect(jsonData.items.length).toBeGreaterThan(0);
    });

    it('should have items with title and url', () => {
      for (const item of jsonData.items) {
        expect(item).toHaveProperty('title');
        expect(item).toHaveProperty('url');
      }
    });
  });

  describe('Parse + Transform Pipeline', () => {
    let index;
    let apiData;

    beforeAll(async () => {
      index = await import('../../index.js');
      const res = await fetch(ASCOM_JOBS_API, {
        headers: {
          'User-Agent': 'job_seeker_ro_spider',
          'Accept': 'application/json'
        }
      });
      apiData = await res.json();
    }, 15000);

    it('should parse real API data into standardized format', () => {
      const result = index.parseApiJobs(apiData);

      expect(result).toHaveProperty('jobs');
      expect(Array.isArray(result.jobs)).toBe(true);

      const parsed = result.jobs[0];
      expect(parsed).toHaveProperty('url');
      expect(parsed).toHaveProperty('title');
      expect(parsed).toHaveProperty('location');
      expect(Array.isArray(parsed.location)).toBe(true);
      expect(parsed).toHaveProperty('workmode');
    });

    it('should map parsed jobs to job model', () => {
      const result = index.parseApiJobs(apiData);
      const model = index.mapToJobModel(result.jobs[0], TEST_CIF);

      expect(model).toHaveProperty('url');
      expect(model).toHaveProperty('title');
      expect(model).toHaveProperty('company');
      expect(model).toHaveProperty('cif', TEST_CIF);
      expect(model).toHaveProperty('status', 'scraped');
      expect(model).toHaveProperty('date');
    });

    it('should transform jobs and produce valid output', () => {
      const result = index.parseApiJobs(apiData);
      const jobs = result.jobs.map(j => index.mapToJobModel(j, TEST_CIF));

      const payload = {
        source: 'career.ascom.com',
        company: 'ASCOM MOBILE SOLUTIONS ROMANIA S.R.L.',
        cif: TEST_CIF,
        jobs
      };

      const transformed = index.transformJobsForSOLR(payload);

      expect(transformed.jobs.length).toBe(jobs.length);

      for (const job of transformed.jobs) {
        expect(job).toHaveProperty('location');
        expect(Array.isArray(job.location)).toBe(true);
        expect(job.location.length).toBeGreaterThan(0);
        expect(job.workmode).toMatch(/^(remote|on-site|hybrid)$/);
      }
    });

    it('should produce valid job URLs that are accessible', async () => {
      const result = index.parseApiJobs(apiData);

      for (const job of result.jobs.slice(0, 2)) {
        const res = await fetch(job.url, {
          method: 'HEAD',
          headers: { 'User-Agent': 'job_seeker_ro_spider' }
        });
        expect(res.ok).toBe(true);
      }
    }, 30000);
  });

  describe('Company Validation Path', () => {
    let anaf;
    let company;

    beforeAll(async () => {
      anaf = await import('../../src/anaf.js');
      company = await import('../../company.js');
    });

    it('should find ASCOM in ANAF and validate active status', async () => {
      const results = await anaf.searchCompany(TEST_BRAND);

      const ascom = results.find(c =>
        c.name.toUpperCase().includes('ASCOM') &&
        c.statusLabel === 'Funcțiune'
      );
      expect(ascom).toBeDefined();
      expect(ascom.cui.toString()).toBe(TEST_CIF);

      const anafData = await anaf.getCompanyFromANAF(TEST_CIF);
      expect(anafData).toBeDefined();
      expect(anafData.inactive).toBe(false);
    }, 30000);

    itIfSolr('should run full validation and report active status', async () => {
      const result = await company.validateAndGetCompany();

      expect(result.status).toBe('active');
      expect(result.company).toBe('ASCOM MOBILE SOLUTIONS ROMANIA S.R.L.');
      expect(result.cif).toBe(TEST_CIF);
    }, 30000);
  });

  describe('SOLR Data Verification', () => {
    let solr;

    beforeAll(async () => {
      solr = await import('../../solr.js');
    });

    itIfSolr('should have ASCOM jobs in SOLR with correct company name', async () => {
      const result = await solr.querySOLR(TEST_CIF);

      for (const job of result.docs) {
        expect(job.company).toBe('ASCOM MOBILE SOLUTIONS ROMANIA S.R.L.');
        expect(job.cif).toBe(TEST_CIF);
      }
    }, 15000);

    itIfSolr('should have ASCOM company core entry', async () => {
      const result = await solr.queryCompanySOLR(`id:${TEST_CIF}`);

      expect(result.numFound).toBe(1);
      const company = result.docs[0];
      expect(company.company).toBe('ASCOM MOBILE SOLUTIONS ROMANIA S.R.L.');
      expect(company.status).toBe('activ');
    }, 15000);
  });
});
