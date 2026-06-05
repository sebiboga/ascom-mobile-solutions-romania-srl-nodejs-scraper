#!/usr/bin/env node

import fetch from "node-fetch";

const COMPANY = "ASCOM MOBILE SOLUTIONS ROMANIA S.R.L.";
const VALID_CIF = "38652516";
const SOLR_URL = "https://solr.peviitor.ro/solr/job";

const AUTH = process.env.SOLR_AUTH;

if (!AUTH) {
  console.log("SOLR_AUTH not set — skipping validation");
  process.exit(0);
}

async function querySolr(cif) {
  const params = new URLSearchParams({
    q: `cif:${cif}`,
    rows: 100,
    wt: "json"
  });

  const res = await fetch(`${SOLR_URL}/select?${params}`, {
    headers: {
      "Authorization": "Basic " + Buffer.from(AUTH).toString("base64"),
      "User-Agent": "job_seeker_ro_spider"
    }
  });

  if (!res.ok) {
    throw new Error(`SOLR query error: ${res.status}`);
  }

  const data = await res.json();
  return data.response;
}

async function validate() {
  console.log(`Validating SOLR jobs for ${COMPANY} (CIF: ${VALID_CIF})...\n`);

  const result = await querySolr(VALID_CIF);

  if (result.numFound === 0) {
    console.log("No jobs to validate.");
    return;
  }

  console.log(`Found ${result.numFound} jobs in SOLR\n`);

  const errors = [];

  for (const job of result.docs) {
    if (job.cif !== VALID_CIF) {
      errors.push(`CIF mismatch for ${job.url}: expected ${VALID_CIF}, got ${job.cif}`);
    }
    if (!job.url) {
      errors.push(`Missing URL for job ${job.job_title || "unknown"}`);
    }
    if (!job.job_title) {
      errors.push(`Missing job_title for URL ${job.url}`);
    }
    if (job.company !== COMPANY) {
      errors.push(`Company mismatch for ${job.url}: expected ${COMPANY}, got ${job.company}`);
    }
    if (!job.location || job.location.length === 0) {
      errors.push(`Missing location for ${job.url}`);
    }
  }

  const urls = result.docs.map(j => j.url);
  const uniqueUrls = new Set(urls);
  if (uniqueUrls.size !== urls.length) {
    errors.push(`Duplicate URLs found: ${urls.length} jobs, ${uniqueUrls.size} unique URLs`);
  }

  console.log(`Checked ${result.docs.length} jobs`);
  console.log(`Errors found: ${errors.length}\n`);

  errors.forEach(e => console.log(`  ❌ ${e}`));

  if (errors.length === 0) {
    console.log("✅ All validations passed!");
  }

  process.exit(errors.length > 0 ? 1 : 0);
}

validate().catch(err => {
  console.error("Validation error:", err.message);
  process.exit(1);
});
