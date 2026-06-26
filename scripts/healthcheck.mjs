#!/usr/bin/env node
/*
 * Health-check CLI used for BOTH the staging smoke test and the post-deploy
 * production check. Fetches a URL, validates the health contract (NO PHI —
 * liveness/version only), and exits non-zero on failure so the pipeline goes RED
 * and triggers auto-rollback. Mirrors src/health.ts#isHealthy / #isWorkOSWired.
 *
 * Usage: node scripts/healthcheck.mjs <url> [--retries N] [--delay-ms M] [--require-workos]
 *        --require-workos  also assert the WorkOS-wired marker (auth:"workos") — the
 *                          deployed bundle is the auth-live build, not a stale/inert
 *                          one. Without it, a liveness-only build could ship green.
 *        FORCE_HEALTHCHECK_FAIL=1 forces failure (used to demonstrate rollback).
 */
function isHealthy(payload) {
  if (typeof payload !== "object" || payload === null) return false;
  return payload.status === "ok" && payload.service === "zeva-care" && typeof payload.version === "string";
}
function isWorkOSWired(payload) {
  return isHealthy(payload) && payload.auth === "workos";
}

const url = process.argv[2];
if (!url) {
  console.error("usage: healthcheck.mjs <url> [--retries N] [--delay-ms M] [--require-workos]");
  process.exit(2);
}
const arg = (flag, def) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? Number(process.argv[i + 1]) : def;
};
const retries = arg("--retries", 5);
const delayMs = arg("--delay-ms", 4000);
const requireWorkos = process.argv.includes("--require-workos");

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
        if (requireWorkos && !isWorkOSWired(body)) {
          console.error(
            `  attempt ${attempt}: live but NOT WorkOS-wired (auth=${body.auth ?? "<none>"}) — stale/auth-inert bundle`,
          );
        } else {
          const marker = requireWorkos ? ", auth workos" : "";
          console.log(`✓ Healthy: ${url} (version ${body.version}${marker})`);
          process.exit(0);
        }
      } else {
        console.error(`  attempt ${attempt}: reachable but unhealthy payload`);
      }
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
