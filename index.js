import fetch from "node-fetch";
import fs from "fs";
import { fileURLToPath } from "url";
import { validateAndGetCompany, addCompanyToCompanyCore } from "./company.js";
import { querySOLR, deleteJobByUrl, upsertJobs } from "./solr.js";

const COMPANY_CIF = "38652516";
const JOBS_API = "https://career.ascom.com/jobs.json";
const JOB_BASE = "https://career.ascom.com";
let COMPANY_NAME = null;

function parseApiJobs(apiData) {
  const items = apiData.items || [];
  const jobs = [];

  for (const item of items) {
    const jp = item._jobposting || {};
    const locations = jp.jobLocation || [];
    
    const roLocations = locations.filter(loc => {
      const country = loc?.address?.addressCountry || "";
      return country === "RO" || country === "Romania";
    });

    if (roLocations.length === 0) continue;

    const cities = roLocations.map(loc => loc.address.addressLocality).filter(Boolean);
    const uniqueCities = [...new Set(cities)];

    const title = item.title || "";
    const url = item.url || "";

    const html = (item.content_html || "") + " " + (jp.description || "");
    let workmode = "on-site";
    if (/remote/i.test(html) && !/on.?site/i.test(html)) {
      workmode = "remote";
    } else if (/hybrid/i.test(html)) {
      workmode = "hybrid";
    } else if (/on.?site/i.test(html)) {
    }

    jobs.push({
      url,
      title,
      company: COMPANY_NAME || "ASCOM MOBILE SOLUTIONS ROMANIA S.R.L.",
      location: uniqueCities.length > 0 ? uniqueCities : ["Cluj-Napoca"],
      country: "România",
      workmode,
      tags: []
    });
  }

  return { jobs, total: jobs.length };
}

function mapToJobModel(job, cif, companyName) {
  const name = companyName || COMPANY_NAME || "ASCOM MOBILE SOLUTIONS ROMANIA S.R.L.";
  return {
    url: job.url,
    job_title: job.title,
    title: job.title,
    company: name,
    cif: cif || COMPANY_CIF,
    location: job.location || [],
    country: job.country || "România",
    workmode: job.workmode || "on-site",
    tags: job.tags || [],
    status: "scraped",
    date: new Date().toISOString()
  };
}

function transformJobsForSOLR(payload) {
  const RO_COUNTRIES = ["românia", "romania", "ro"];

  return {
    ...payload,
    company: (payload.company || "").toUpperCase(),
    jobs: payload.jobs.map(job => ({
      ...job,
      company: (job.company || "").toUpperCase(),
      location: Array.isArray(job.location) && job.location.length > 0
        ? job.location
        : ["România"],
      country: RO_COUNTRIES.some(c =>
        (job.country || "").toLowerCase().includes(c)
      ) ? "România" : (job.country || "România"),
      workmode: (job.workmode || "").toLowerCase() === "on-site" ? "on-site"
        : (job.workmode || "").toLowerCase() === "remote" ? "remote"
        : "hybrid"
    }))
  };
}

async function scrapeAllListings() {
  console.log(`Fetching ${JOBS_API}...`);
  const res = await fetch(JOBS_API, {
    headers: {
      "User-Agent": "job_seeker_ro_spider",
      "Accept": "application/json"
    },
    signal: AbortSignal.timeout(30000)
  });

  if (!res.ok) {
    throw new Error(`API error ${res.status} from ${JOBS_API}`);
  }

  const data = await res.json();
  const result = parseApiJobs(data);
  console.log(`Found ${result.jobs.length} Romania jobs out of ${data.items?.length || 0} total`);
  return result.jobs;
}

async function main() {
  try {
    console.log("=== Step 1: Get existing jobs count ===");
    const existingResult = await querySOLR(COMPANY_CIF);
    const existingCount = existingResult.numFound;
    console.log(`Found ${existingCount} existing jobs in SOLR`);

    console.log("=== Step 2: Validate company via ANAF ===");
    const { company, cif, anafData } = await validateAndGetCompany();
    COMPANY_NAME = company;
    const localCif = cif;

    console.log("=== Step 3: Scrape jobs ===");
    const rawJobs = await scrapeAllListings();
    const scrapedCount = rawJobs.length;

    console.log("=== Step 4: Remove expired jobs from SOLR ===");
    const scrapedUrls = new Set(rawJobs.map(j => j.url));
    if (scrapedUrls.size > 0) {
      const existingJobs = existingResult.docs || [];
      const expiredUrls = existingJobs
        .filter(j => !scrapedUrls.has(j.url))
        .map(j => j.url);
      if (expiredUrls.length > 0) {
        console.log(`${expiredUrls.length} jobs no longer on careers page - deleting from SOLR...`);
        for (const url of expiredUrls) {
          await deleteJobByUrl(url);
        }
        console.log(`Deleted ${expiredUrls.length} expired jobs`);
      } else {
        console.log("No expired jobs to remove");
      }
    }

    if (scrapedCount === 0) {
      console.log("No Romania jobs found on careers page.");
      fs.mkdirSync("tmp", { recursive: true });
      fs.writeFileSync("tmp/jobs.json", JSON.stringify({ jobs: [], message: "No Romania jobs found" }, null, 2), "utf-8");
      console.log("Saved tmp/jobs.json");
      return;
    }

    const jobs = rawJobs.map(job => mapToJobModel(job, localCif, COMPANY_NAME));

    const payload = {
      source: "career.ascom.com",
      scrapedAt: new Date().toISOString(),
      company: COMPANY_NAME,
      cif: localCif,
      jobs
    };

    console.log("Transforming jobs for SOLR...");
    const transformedPayload = transformJobsForSOLR(payload);

    fs.mkdirSync("tmp", { recursive: true });
    fs.writeFileSync("tmp/jobs.json", JSON.stringify(transformedPayload, null, 2), "utf-8");
    console.log("Saved tmp/jobs.json");

    console.log("Step 5: Upsert jobs to SOLR...");
    await upsertJobs(transformedPayload.jobs);

    console.log("=== Step 6: Add/update company in Company Core ===");
    await addCompanyToCompanyCore(COMPANY_NAME, localCif, anafData, "https://career.ascom.com/jobs");

    const finalResult = await querySOLR(COMPANY_CIF);
    console.log(`SUMMARY`);
    console.log(`Jobs existing in SOLR before scrape: ${existingCount}`);
    console.log(`Jobs scraped from ASCOM website: ${scrapedCount}`);
    console.log(`Jobs in SOLR after scrape: ${finalResult.numFound}`);

    if (scrapedCount > 0) {
      console.log(`Successfully scraped and uploaded ${scrapedCount} jobs`);
    }
  } catch (error) {
    console.error("Fatal error:", error.message);
    process.exit(1);
  }
}

export { parseApiJobs, mapToJobModel, transformJobsForSOLR };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
