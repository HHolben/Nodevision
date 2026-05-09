// Nodevision/ApplicationSystem/Sync/plan-sync-test.mjs
// This script requests a trusted peer's signed SyncTest manifest, builds the local SyncTest manifest, compares both, and prints a JSON-only sync plan without reading outside Notebook/SyncTest.

import {
  buildSyncTestManifest,
  compareManifests,
  createSignedManifestRequest,
} from "./SyncManifest.mjs";

const USAGE = "Usage: node ApplicationSystem/Sync/plan-sync-test.mjs http://localhost:3001";

function normalizePeerUrl(rawUrl) {
  const text = String(rawUrl ?? "").trim();
  if (!text) throw new Error(USAGE);

  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    throw new Error(`Invalid peer base URL: ${text}`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Peer base URL must use http or https: ${text}`);
  }

  const pathname = parsed.pathname.replace(/\/+$/, "");
  return `${parsed.protocol}//${parsed.host}${pathname === "/" ? "" : pathname}`;
}

async function fetchRemoteManifest(peerUrl, signedRequest) {
  const endpoint = new URL("/api/peer/manifest", `${peerUrl}/`).toString();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(signedRequest),
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    // body intentionally left null for non-JSON responses
  }

  if (!response.ok) {
    const detail = body?.error ? String(body.error) : `HTTP ${response.status}`;
    throw new Error(`Peer manifest request failed (${response.status}): ${detail}`);
  }
  if (!body || body.ok !== true || !body.manifest) {
    throw new Error("Peer manifest response missing manifest payload");
  }

  return body.manifest;
}

async function main() {
  const peerArg = process.argv[2];
  if (!peerArg) {
    process.stderr.write(`${USAGE}\n`);
    process.exitCode = 1;
    return;
  }

  let peerUrl;
  try {
    peerUrl = normalizePeerUrl(peerArg);
  } catch (err) {
    process.stderr.write(`${err?.message || String(err)}\n`);
    process.exitCode = 1;
    return;
  }

  try {
    const signedRequest = await createSignedManifestRequest();
    const remoteManifest = await fetchRemoteManifest(peerUrl, signedRequest);
    const localManifest = await buildSyncTestManifest();
    const plan = await compareManifests(localManifest, remoteManifest);

    const output = {
      ok: true,
      peerUrl,
      scope: "SyncTest",
      local: { fileCount: Array.isArray(localManifest.files) ? localManifest.files.length : 0 },
      remote: { fileCount: Array.isArray(remoteManifest.files) ? remoteManifest.files.length : 0 },
      plan,
    };
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  } catch (err) {
    process.stderr.write(`${err?.message || String(err)}\n`);
    process.exitCode = 1;
  }
}

main();
