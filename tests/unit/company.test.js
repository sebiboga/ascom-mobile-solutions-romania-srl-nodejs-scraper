import { jest } from '@jest/globals';
import fs from 'fs';

const mockFetch = jest.fn();

jest.unstable_mockModule('node-fetch', () => ({
  default: mockFetch
}));

const COMPANY_JSON_PATH = 'tmp/company.json';

function backupCompanyJson() {
  if (fs.existsSync(COMPANY_JSON_PATH)) {
    const content = fs.readFileSync(COMPANY_JSON_PATH, 'utf-8');
    fs.renameSync(COMPANY_JSON_PATH, `${COMPANY_JSON_PATH}.bak`);
    return content;
  }
  return null;
}

function restoreCompanyJson() {
  if (fs.existsSync(`${COMPANY_JSON_PATH}.bak`)) {
    fs.renameSync(`${COMPANY_JSON_PATH}.bak`, COMPANY_JSON_PATH);
  }
  return null;
}

function anafSearchResponse(results) {
  return {
    ok: true,
    json: async () => ({ data: results, success: true })
  };
}

function anafCompanyResponse(data) {
  return {
    ok: true,
    json: async () => ({ data, success: true })
  };
}

function peviitorResponse(companies) {
  return {
    ok: true,
    json: async () => ({ companies })
  };
}

function solrResponse(numFound, docs) {
  return {
    ok: true,
    json: async () => ({ response: { numFound, docs } })
  };
}

function errorResponse(status) {
  return {
    ok: false,
    status,
    text: async () => 'Error'
  };
}

const ASCOM_ANAF_RECORD = {
  cui: 38652516,
  name: 'ASCOM MOBILE SOLUTIONS ROMANIA S.R.L.',
  address: 'STR. MIHAIL KOGALNICEANU, NR. 7, Cluj-Napoca, Cluj',
  caenCode: '6201',
  inactive: false,
  registrationNumber: 'J12/1234/2020',
  vatRegistered: true,
  eFacturaRegistered: false,
  onrcStatusLabel: 'Funcțiune',
  legalForm: 'SRL',
  headquartersAddress: { locality: 'Cluj-Napoca' },
  administrators: [{ name: 'ADMIN NAME', role: 'administrator' }],
  authorizedCaenCodes: ['6201', '6202', '6209']
};

describe('company.js', () => {
  let company;
  let savedCompanyJson;

  beforeAll(async () => {
    process.env.SOLR_AUTH = 'test:test';
    savedCompanyJson = backupCompanyJson();
    company = await import('../../company.js');
  });

  afterAll(() => {
    delete process.env.SOLR_AUTH;
    restoreCompanyJson();
  });

  beforeEach(() => {
    mockFetch.mockReset();
    if (fs.existsSync(COMPANY_JSON_PATH)) {
      fs.unlinkSync(COMPANY_JSON_PATH);
    }
  });

  describe('getCompanyBrand', () => {
    it('should return the company brand', () => {
      const brand = company.getCompanyBrand();
      expect(typeof brand).toBe('string');
      expect(brand).toBe('ASCOM MOBILE SOLUTIONS');
    });
  });

  describe('getCompanyData (no cache)', () => {
    it('should find Ascom via ANAF search and return company data', async () => {
      mockFetch
        .mockResolvedValueOnce(anafSearchResponse([
          { cui: 38652516, name: 'ASCOM MOBILE SOLUTIONS ROMANIA S.R.L.', statusLabel: 'Funcțiune' }
        ]))
        .mockResolvedValueOnce(anafCompanyResponse(ASCOM_ANAF_RECORD));

      const result = await company.getCompanyData();

      expect(result).toHaveProperty('company', 'ASCOM MOBILE SOLUTIONS ROMANIA S.R.L.');
      expect(result).toHaveProperty('cif', '38652516');
      expect(result).toHaveProperty('active', true);
      expect(result).toHaveProperty('anafData');
      expect(result.anafData.name).toBe('ASCOM MOBILE SOLUTIONS ROMANIA S.R.L.');
    });

    it('should pick first active company when no exact match', async () => {
      mockFetch
        .mockResolvedValueOnce(anafSearchResponse([
          { cui: 11111111, name: 'SOME OTHER COMPANY SRL', statusLabel: 'Radiată' },
          { cui: 38652516, name: 'ASCOM MOBILE SOLUTIONS ROMANIA S.R.L.', statusLabel: 'Funcțiune' }
        ]))
        .mockResolvedValueOnce(anafCompanyResponse(ASCOM_ANAF_RECORD));

      const result = await company.getCompanyData();

      expect(result.cif).toBe('38652516');
      expect(result.active).toBe(true);
    });

    it('should throw when no companies found', async () => {
      mockFetch.mockResolvedValueOnce(anafSearchResponse([]));

      await expect(company.getCompanyData()).rejects.toThrow('No companies found');
    });

    it('should throw when no active company found', async () => {
      mockFetch.mockResolvedValueOnce(anafSearchResponse([
        { cui: 11111111, name: 'ASCOM SOMETHING SRL', statusLabel: 'Radiată' }
      ]));

      await expect(company.getCompanyData()).rejects.toThrow('No active company found');
    });

    it('should throw when ANAF returns no data', async () => {
      mockFetch
        .mockResolvedValueOnce(anafSearchResponse([
          { cui: 38652516, name: 'ASCOM MOBILE SOLUTIONS ROMANIA S.R.L.', statusLabel: 'Funcțiune' }
        ]))
        .mockResolvedValueOnce(anafCompanyResponse(null));

      await expect(company.getCompanyData()).rejects.toThrow('No data from ANAF and no cache - cannot proceed with scraping');
    });

    it('should throw when ANAF returns no company name', async () => {
      mockFetch
        .mockResolvedValueOnce(anafSearchResponse([
          { cui: 38652516, name: 'ASCOM MOBILE SOLUTIONS ROMANIA S.R.L.', statusLabel: 'Funcțiune' }
        ]))
        .mockResolvedValueOnce(anafCompanyResponse({ cui: 38652516, name: null }));

      await expect(company.getCompanyData()).rejects.toThrow('ANAF returned no company name');
    });
  });

  describe('getCompanyData (with cache)', () => {
    const cachedData = {
      anaf: ASCOM_ANAF_RECORD,
      summary: {
        company: 'ASCOM MOBILE SOLUTIONS ROMANIA S.R.L.',
        cif: '38652516',
        active: true
      }
    };

    beforeEach(() => {
      fs.mkdirSync('tmp', { recursive: true });
      fs.writeFileSync(COMPANY_JSON_PATH, JSON.stringify(cachedData), 'utf-8');
    });

    it('should use cached company data when available', async () => {
      const result = await company.getCompanyData();

      expect(result.company).toBe('ASCOM MOBILE SOLUTIONS ROMANIA S.R.L.');
      expect(result.cif).toBe('38652516');
      expect(result.active).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('validateAndGetCompany', () => {
    it('should return company data with status active', async () => {
      mockFetch
        .mockResolvedValueOnce(anafSearchResponse([
          { cui: 38652516, name: 'ASCOM MOBILE SOLUTIONS ROMANIA S.R.L.', statusLabel: 'Funcțiune' }
        ]))
        .mockResolvedValueOnce(anafCompanyResponse(ASCOM_ANAF_RECORD))
        .mockResolvedValueOnce(solrResponse(6, [
          { url: 'https://career.ascom.com/job/1', title: 'Job 1' },
          { url: 'https://career.ascom.com/job/2', title: 'Job 2' }
        ]))
        .mockResolvedValueOnce(peviitorResponse([{ company: 'ASCOM MOBILE SOLUTIONS ROMANIA S.R.L.' }]));

      const result = await company.validateAndGetCompany();

      expect(result).toHaveProperty('status', 'active');
      expect(result).toHaveProperty('company', 'ASCOM MOBILE SOLUTIONS ROMANIA S.R.L.');
      expect(result).toHaveProperty('cif', '38652516');
      expect(result).toHaveProperty('existingJobsCount');
      expect(typeof result.existingJobsCount).toBe('number');
    });

    it('should return inactive status when company is inactive', async () => {
      const inactiveRecord = { ...ASCOM_ANAF_RECORD, inactive: true };

      mockFetch
        .mockResolvedValueOnce(anafSearchResponse([
          { cui: 38652516, name: 'ASCOM MOBILE SOLUTIONS ROMANIA S.R.L.', statusLabel: 'Funcțiune' }
        ]))
        .mockResolvedValueOnce(anafCompanyResponse(inactiveRecord))
        .mockResolvedValueOnce(solrResponse(0, []));

      const result = await company.validateAndGetCompany();

      expect(result).toHaveProperty('status', 'inactive');
    });
  });
});
