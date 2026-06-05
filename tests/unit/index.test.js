import { jest } from '@jest/globals';

describe('index.js Component Tests', () => {
  let index;

  beforeAll(async () => {
    index = await import('../../index.js');
  });

  describe('parseApiJobs', () => {
    it('should parse ASCOM JSON Feed and return Romania jobs', () => {
      const apiData = {
        items: [
          {
            title: 'Software Engineer',
            url: 'https://career.ascom.com/job/1',
            content_html: '<p>Hybrid work</p>',
            _jobposting: {
              jobLocation: [
                { address: { addressCountry: 'RO', addressLocality: 'Cluj-Napoca' } }
              ],
              description: 'Hybrid role'
            }
          },
          {
            title: 'DevOps Engineer',
            url: 'https://career.ascom.com/job/2',
            content_html: '<p>Remote</p>',
            _jobposting: {
              jobLocation: [
                { address: { addressCountry: 'RO', addressLocality: 'Bucharest' } }
              ],
              description: 'Remote role'
            }
          }
        ]
      };

      const result = index.parseApiJobs(apiData);

      expect(result.jobs.length).toBe(2);
      expect(result.total).toBe(2);
      expect(result.jobs[0].title).toBe('Software Engineer');
      expect(result.jobs[0].location).toEqual(['Cluj-Napoca']);
      expect(result.jobs[0].workmode).toBe('hybrid');
      expect(result.jobs[1].title).toBe('DevOps Engineer');
      expect(result.jobs[1].workmode).toBe('remote');
    });

    it('should filter out non-Romania jobs', () => {
      const apiData = {
        items: [
          {
            title: 'Swiss Job',
            url: 'https://career.ascom.com/job/ch',
            _jobposting: {
              jobLocation: [
                { address: { addressCountry: 'CH', addressLocality: 'Zurich' } }
              ]
            }
          },
          {
            title: 'Romania Job',
            url: 'https://career.ascom.com/job/ro',
            _jobposting: {
              jobLocation: [
                { address: { addressCountry: 'RO', addressLocality: 'Cluj-Napoca' } }
              ]
            }
          }
        ]
      };

      const result = index.parseApiJobs(apiData);

      expect(result.jobs.length).toBe(1);
      expect(result.jobs[0].title).toBe('Romania Job');
    });

    it('should handle empty items array', () => {
      const result = index.parseApiJobs({ items: [] });
      expect(result.jobs).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should handle items with missing _jobposting', () => {
      const apiData = {
        items: [
          { title: 'No JobPosting', url: 'https://career.ascom.com/job/x' }
        ]
      };
      const result = index.parseApiJobs(apiData);
      expect(result.jobs).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should detect workmode from content_html', () => {
      const apiData = {
        items: [
          {
            title: 'Remote Job',
            url: 'https://career.ascom.com/job/remote',
            content_html: '<p>Remote position</p>',
            _jobposting: {
              jobLocation: [
                { address: { addressCountry: 'RO', addressLocality: 'Cluj-Napoca' } }
              ],
              description: ''
            }
          },
          {
            title: 'Hybrid Job',
            url: 'https://career.ascom.com/job/hybrid',
            content_html: '<p>Hybrid working</p>',
            _jobposting: {
              jobLocation: [
                { address: { addressCountry: 'RO', addressLocality: 'Bucharest' } }
              ],
              description: ''
            }
          },
          {
            title: 'On-site Job',
            url: 'https://career.ascom.com/job/onsite',
            content_html: '<p>On site work</p>',
            _jobposting: {
              jobLocation: [
                { address: { addressCountry: 'RO', addressLocality: 'Iasi' } }
              ],
              description: ''
            }
          }
        ]
      };

      const result = index.parseApiJobs(apiData);

      expect(result.jobs[0].workmode).toBe('remote');
      expect(result.jobs[1].workmode).toBe('hybrid');
      expect(result.jobs[2].workmode).toBe('on-site');
    });

    it('should deduplicate cities', () => {
      const apiData = {
        items: [
          {
            title: 'Multi Location',
            url: 'https://career.ascom.com/job/multi',
            content_html: '',
            _jobposting: {
              jobLocation: [
                { address: { addressCountry: 'RO', addressLocality: 'Cluj-Napoca' } },
                { address: { addressCountry: 'RO', addressLocality: 'Cluj-Napoca' } },
                { address: { addressCountry: 'RO', addressLocality: 'Bucharest' } }
              ],
              description: ''
            }
          }
        ]
      };

      const result = index.parseApiJobs(apiData);

      expect(result.jobs[0].location).toEqual(['Cluj-Napoca', 'Bucharest']);
    });

    it('should default location to Cluj-Napoca when no locations found', () => {
      const apiData = {
        items: [
          {
            title: 'No Location',
            url: 'https://career.ascom.com/job/noloc',
            content_html: '',
            _jobposting: {
              jobLocation: [
                { address: { addressCountry: 'RO' } }
              ],
              description: ''
            }
          }
        ]
      };

      const result = index.parseApiJobs(apiData);

      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].location).toEqual(['Cluj-Napoca']);
    });
  });

  describe('mapToJobModel', () => {
    it('should map raw job to job model format', () => {
      const rawJob = {
        url: 'https://career.ascom.com/job/123',
        title: 'Software Engineer',
        location: ['Cluj-Napoca'],
        workmode: 'hybrid'
      };

      const COMPANY_NAME = 'ASCOM MOBILE SOLUTIONS ROMANIA S.R.L.';
      const COMPANY_CIF = '38652516';

      const result = index.mapToJobModel(rawJob, COMPANY_CIF, COMPANY_NAME);

      expect(result.url).toBe(rawJob.url);
      expect(result.title).toBe(rawJob.title);
      expect(result.company).toBe(COMPANY_NAME);
      expect(result.cif).toBe(COMPANY_CIF);
      expect(result.location).toEqual(rawJob.location);
      expect(result.workmode).toBe(rawJob.workmode);
      expect(result.status).toBe('scraped');
      expect(result.date).toBeDefined();
    });

    it('should handle missing fields with defaults', () => {
      const rawJob = {
        url: 'https://career.ascom.com/job/1',
        title: 'Job 1'
      };

      const result = index.mapToJobModel(rawJob, '38652516');

      expect(result.location).toEqual([]);
      expect(result.workmode).toBe('on-site');
    });

    it('should handle missing title', () => {
      const rawJob = { url: 'https://career.ascom.com/job/1' };

      const result = index.mapToJobModel(rawJob, '38652516');

      expect(result.title).toBeUndefined();
      expect(result.url).toBe('https://career.ascom.com/job/1');
    });

    it('should use defaults when companyName is null', () => {
      const rawJob = {
        url: 'https://career.ascom.com/job/1',
        title: 'Test'
      };

      const result = index.mapToJobModel(rawJob, '38652516', null);

      expect(result.company).toBe('ASCOM MOBILE SOLUTIONS ROMANIA S.R.L.');
    });
  });

  describe('transformJobsForSOLR', () => {
    it('should preserve locations as-is and default empty to România', () => {
      const payload = {
        jobs: [
          { url: 'https://career.ascom.com/1', title: 'Job 1', location: ['Cluj-Napoca'] },
          { url: 'https://career.ascom.com/2', title: 'Job 2', location: [] },
          { url: 'https://career.ascom.com/3', title: 'Job 3', location: ['Bucharest'] }
        ]
      };

      const result = index.transformJobsForSOLR(payload);

      expect(result.jobs[0].location).toEqual(['Cluj-Napoca']);
      expect(result.jobs[1].location).toEqual(['România']);
      expect(result.jobs[2].location).toEqual(['Bucharest']);
    });

    it('should keep company uppercase', () => {
      const payload = {
        source: 'career.ascom.com',
        company: 'ascom mobile solutions romania s.r.l.',
        cif: '38652516',
        jobs: [
          { url: 'https://career.ascom.com/1', title: 'Job 1', company: 'ascom mobile solutions', cif: '38652516' }
        ]
      };

      const result = index.transformJobsForSOLR(payload);

      expect(result.company).toBe('ASCOM MOBILE SOLUTIONS ROMANIA S.R.L.');
    });

    it('should normalize workmode values', () => {
      const payload = {
        jobs: [
          { url: 'https://career.ascom.com/1', title: 'Job 1', workmode: 'Remote' },
          { url: 'https://career.ascom.com/2', title: 'Job 2', workmode: 'ON-SITE' },
          { url: 'https://career.ascom.com/3', title: 'Job 3', workmode: 'Hybrid' },
          { url: 'https://career.ascom.com/4', title: 'Job 4', workmode: 'hybrid' }
        ]
      };

      const result = index.transformJobsForSOLR(payload);

      expect(result.jobs[0].workmode).toBe('remote');
      expect(result.jobs[1].workmode).toBe('on-site');
      expect(result.jobs[2].workmode).toBe('hybrid');
      expect(result.jobs[3].workmode).toBe('hybrid');
    });

    it('should handle empty jobs array', () => {
      const result = index.transformJobsForSOLR({ jobs: [] });
      expect(result.jobs).toEqual([]);
    });
  });
});
