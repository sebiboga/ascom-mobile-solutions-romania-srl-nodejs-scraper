import fetch from "node-fetch";
import fs from "fs";

const SOLR_URL = "https://solr.peviitor.ro/solr/job";
const SOLR_COMPANY_URL = "https://solr.peviitor.ro/solr/company";
const TIMEOUT = 10000;

export function getSolrAuth() {
  return process.env.SOLR_AUTH;
}

export async function querySOLR(cif) {
  const AUTH = process.env.SOLR_AUTH;
  if (!AUTH) throw new Error("SOLR_AUTH not set in environment");

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
    const text = await res.text();
    throw new Error(`SOLR query error: ${res.status} - ${text}`);
  }

  const data = await res.json();
  return data.response;
}

export async function queryCompanySOLR(companyQuery) {
  const AUTH = process.env.SOLR_AUTH;
  if (!AUTH) throw new Error("SOLR_AUTH not set in environment");

  const params = new URLSearchParams({
    q: companyQuery,
    rows: 10,
    wt: "json"
  });

  const res = await fetch(`${SOLR_COMPANY_URL}/select?${params}`, {
    headers: {
      "Authorization": "Basic " + Buffer.from(AUTH).toString("base64"),
      "User-Agent": "job_seeker_ro_spider"
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SOLR company query error: ${res.status} - ${text}`);
  }

  const data = await res.json();
  return data.response;
}

export async function deleteJobsByCIF(cif) {
  const AUTH = process.env.SOLR_AUTH;
  if (!AUTH) throw new Error("SOLR_AUTH not set in environment");

  const params = new URLSearchParams({ commit: "true" });

  const deleteQuery = JSON.stringify({
    delete: { query: `cif:${cif}` }
  });

  const res = await fetch(`${SOLR_URL}/update?${params}`, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + Buffer.from(AUTH).toString("base64"),
      "Content-Type": "application/json",
      "User-Agent": "job_seeker_ro_spider"
    },
    body: deleteQuery
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SOLR delete error: ${res.status} - ${text}`);
  }

  console.log("✅ Jobs deleted from SOLR.");
}

export async function deleteJobByUrl(url) {
  const AUTH = process.env.SOLR_AUTH;
  if (!AUTH) throw new Error("SOLR_AUTH not set in environment");

  const params = new URLSearchParams({ commit: "true" });

  const deleteQuery = JSON.stringify({
    delete: { query: `url:"${url}"` }
  });

  const res = await fetch(`${SOLR_URL}/update?${params}`, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + Buffer.from(AUTH).toString("base64"),
      "Content-Type": "application/json",
      "User-Agent": "job_seeker_ro_spider"
    },
    body: deleteQuery
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SOLR delete error: ${res.status} - ${text}`);
  }
}

export async function upsertJobs(jobs) {
  const AUTH = process.env.SOLR_AUTH;
  if (!AUTH) throw new Error("SOLR_AUTH not set in environment");

  const params = new URLSearchParams({ commit: "true" });

  const body = JSON.stringify(jobs);

  const res = await fetch(`${SOLR_URL}/update?${params}`, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + Buffer.from(AUTH).toString("base64"),
      "Content-Type": "application/json",
      "User-Agent": "job_seeker_ro_spider"
    },
    body
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SOLR upsert error: ${res.status} - ${text}`);
  }

  console.log(`✅ Upserted ${jobs.length} jobs to SOLR.`);
}

export async function upsertCompany(companyDoc) {
  const AUTH = process.env.SOLR_AUTH;
  if (!AUTH) throw new Error("SOLR_AUTH not set in environment");

  const params = new URLSearchParams({ commit: "true" });

  const res = await fetch(`${SOLR_COMPANY_URL}/update?${params}`, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + Buffer.from(AUTH).toString("base64"),
      "Content-Type": "application/json",
      "User-Agent": "job_seeker_ro_spider"
    },
    body: JSON.stringify([companyDoc])
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SOLR company upsert error: ${res.status} - ${text}`);
  }

  console.log(`✅ Company "${companyDoc.company}" upserted to SOLR company core.`);
}
