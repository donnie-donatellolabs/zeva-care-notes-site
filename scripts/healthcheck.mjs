#!/usr/bin/env node
/*
 * Health-check CLI used for BOTH the staging smoke test and the post-deploy
 * production check. Fetches a URL, validates the health contract (NO PHI —
 * liveness/version only), and exits non-zero on failure so the pipeline goes RED
 * and triggers auto-rollback. Mirrors src/health.ts#isHealthy.
 *
 * Usage: node scripts/healthcheck.mjs <url> [--retries N] [--delay-ms M]
 *        FORCE_HEALTHCHECK_FAIL=1 forces failure (used to demonstrate rollback).
 */
function isHealthy(payload) {
  if (typeof payload !== "object" || payload === null) return false;
  return payload.status === "ok" && payload.service === "zeva-care" && typeof payload.version === "string";
}

const url = process.argv[2];
if (!url) {
  console.error("usage: healthcheck.mjs <url> [--retries N] [--delay-ms M]");
  process.exit(2);
}
const arg = (flag, def) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? Number(process.argv[i + 1]) : def;
};
const retries = arg("--retries", 5);
const delayMs = arg("--delay-ms", 4000);

if (process.env.FORCE_HEALTHCHECK_FAIL === "1") {
  console.error(`✖ Health check FORCED to fail (FORCE_HEALTHCHECK_FAIL=1) for ${url}`);
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (let attempt = 1; attempt <= retries; attempt++) {
  try {
    const res = await fetch(url, { headers: { "cache-control": "no-cache" } });
    if (res.ok) {
      const body = await res.json();
      if (isHealthy(body)) {
        console.log(`✓ Healthy: ${url} (version ${body.version})`);
        process.exit(0);
      }
      console.error(`  attempt ${attempt}: reachable but unhealthy payload`);
    } else {
      console.error(`  attempt ${attempt}: HTTP ${res.status}`);
    }
  } catch (err) {
    // Never log PHI; the health endpoint carries none, but stay terse regardless.
    console.error(`  attempt ${attempt}: ${err instanceof Error ? err.name : "fetch error"}`);
  }
  if (attempt < retries) await sleep(delayMs);
}

console.error(`✖ Health check FAILED after ${retries} attempts: ${url}`);
process.exit(1);
