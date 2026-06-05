import { jest } from '@jest/globals';

const VALID_CIF = '38652516';
const COMPANY_BRAND = 'ASCOM';

describe('Integration: ANAF API', () => {
  let anaf;

  beforeAll(async () => {
    anaf = await import('../../src/anaf.js');
  });

  it('should search for ASCOM brand and find the company', async () => {
    const results = await anaf.searchCompany(COMPANY_BRAND);

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);

    const ascom = results.find(c =>
      c.name.toUpperCase().includes('ASCOM') && c.statusLabel === 'Funcțiune'
    );
    expect(ascom).toBeDefined();
    expect(ascom.cui.toString()).toBe(VALID_CIF);
  }, 15000);

  it('should return empty array for non-existent brand', async () => {
    const results = await anaf.searchCompany('ThisBrandDoesNotExistXYZ123');

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);
  }, 15000);

  it('should fetch company details by valid CIF', async () => {
    const data = await anaf.getCompanyFromANAF(VALID_CIF);

    expect(data).toBeDefined();
    expect(data.cui).toBe(38652516);
    expect(data.name).toBe('ASCOM MOBILE SOLUTIONS ROMANIA S.R.L.');
    expect(data).toHaveProperty('address');
    expect(data).toHaveProperty('registrationNumber');
    expect(data).toHaveProperty('caenCode');
    expect(data).toHaveProperty('onrcStatusLabel', 'Funcțiune');
  }, 15000);

  it('should throw for invalid CIF', async () => {
    await expect(anaf.getCompanyFromANAF('00000000')).rejects.toThrow();
  }, 60000);

  it('should use cached data when API fails (getCompanyFromANAFWithFallback)', async () => {
    const cached = { cui: 38652516, name: 'ASCOM MOBILE SOLUTIONS ROMANIA S.R.L.' };

    const data = await anaf.getCompanyFromANAFWithFallback(VALID_CIF, cached);

    expect(data).toBeDefined();
    expect(data.cui).toBe(38652516);
  }, 15000);
});
