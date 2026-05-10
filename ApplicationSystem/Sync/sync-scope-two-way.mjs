// Nodevision/ApplicationSystem/Sync/sync-scope-two-way.mjs
// This script performs safe two-way synchronization for a validated configured Notebook scope by planning pulls/pushes/conflicts, applying without blind overwrite, and returning JSON reports.

import fs from "node:fs/promises";
import path from "node:path";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { buildScopeManifest, compareScopeManifests, isPathInsideScope, loadSyncScopes, validateSyncScope } from "./SyncScopes.mjs";
import { normalizePeerUrl, resolveRuntimeRoot } from "./sync-sync-test-two-way.mjs";
import { MAX_FILE_PUSH_BYTES } from "./PeerFileTransfer.mjs";
import { createSignedScopeFilePush, createSignedScopeFileRequest, createSignedScopeManifestRequest, validateScopedRelativePath } from "./ScopePeerSync.mjs";

const hash = (b) => createHash("sha256").update(b).digest("hex");
const postJson = async (peerUrl, endpointPath, body) => {
  const r = await fetch(new URL(endpointPath, `${peerUrl}/`).toString(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const p = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${endpointPath} failed (${r.status}): ${p?.error || "request failed"}`);
  return p;
};

function buildScopedConflictRelativePath(originalRelativePath, peerDeviceId, timestamp) {
  const parsed = path.posix.parse(originalRelativePath);
  const safeTs = new Date(Date.parse(timestamp)).toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const safePeer = String(peerDeviceId || "peer").replace(/[^A-Za-z0-9_-]+/g, "-");
  const name = parsed.ext ? `${parsed.name}.from-${safePeer}.${safeTs}${parsed.ext}` : `${parsed.base}.from-${safePeer}.${safeTs}`;
  return `${parsed.dir.split("/")[0]}/.conflicts/${parsed.dir.split("/").slice(1).filter(Boolean).join("/")}${parsed.dir.includes("/") ? "/" : ""}${name}`.replace(/\/\.conflicts\/$/, "/.conflicts");
}

async function saveScopedConflictCopy({ notebookDir, scope, originalRelativePath, contentBuffer, peerDeviceId, timestamp }) {
  const conflictRelativePath = buildScopedConflictRelativePath(originalRelativePath, peerDeviceId, timestamp);
  const scopeRoot = path.resolve(notebookDir, scope);
  const conflictRoot = path.resolve(scopeRoot, ".conflicts");
  const target = path.resolve(scopeRoot, conflictRelativePath.slice(`${scope}/`.length));
  const rel = path.relative(conflictRoot, target);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) throw new Error("conflict path escaped scope");
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, contentBuffer);
  return { relativePath: conflictRelativePath, bytes: contentBuffer.length };
}

async function fetchManifest(peerUrl, scope, runtimeRoot) {
  const signed = await createSignedScopeManifestRequest({ scope }, { runtimeRoot });
  const body = await postJson(peerUrl, "/api/peer/scope/manifest", signed);
  if (!body?.ok || !body?.manifest) throw new Error("missing manifest");
  return body.manifest;
}

async function fetchRemoteFile(peerUrl, scope, relativePath, runtimeRoot) {
  const signed = await createSignedScopeFileRequest({ scope, relativePath }, { runtimeRoot });
  const body = await postJson(peerUrl, "/api/peer/scope/file-get", signed);
  if (!body?.ok || !body?.file) throw new Error("missing file payload");
  return body.file;
}

async function pullOne({ peerUrl, scope, relativePath, notebookDir, runtimeRoot }) {
  const remote = await fetchRemoteFile(peerUrl, scope, relativePath, runtimeRoot);
  if (remote.relativePath !== relativePath) throw new Error("mismatched relativePath");
  const buf = Buffer.from(String(remote.contentBase64 || ""), "base64");
  if (buf.toString("base64") !== remote.contentBase64) throw new Error("invalid base64");
  if (buf.length > MAX_FILE_PUSH_BYTES) throw new Error("file too large");
  if (hash(buf) !== String(remote.sha256 || "")) throw new Error("sha mismatch");
  const scopeRoot = path.resolve(notebookDir, scope);
  const target = path.resolve(scopeRoot, relativePath.slice(`${scope}/`.length));
  if (!isPathInsideScope({ relativePath, scope })) throw new Error("scope escape");
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buf);
  return { relativePath, bytes: buf.length, sha256: hash(buf) };
}

async function pushOne({ peerUrl, scope, relativePath, notebookDir, runtimeRoot }) {
  const scopeRoot = path.resolve(notebookDir, scope);
  const localPath = path.resolve(scopeRoot, relativePath.slice(`${scope}/`.length));
  const buf = await fs.readFile(localPath);
  if (buf.length > MAX_FILE_PUSH_BYTES) throw new Error("file too large");
  const signed = await createSignedScopeFilePush({ scope, relativePath, contentBase64: buf.toString("base64"), contentType: "application/octet-stream" }, { runtimeRoot });
  await postJson(peerUrl, "/api/peer/scope/file-push", signed);
  return { relativePath, bytes: buf.length, sha256: hash(buf) };
}

async function pullConflict({ peerUrl, scope, relativePath, notebookDir, runtimeRoot, peerDeviceId }) {
  const remote = await fetchRemoteFile(peerUrl, scope, relativePath, runtimeRoot);
  const buf = Buffer.from(String(remote.contentBase64 || ""), "base64");
  const expected = String(remote.sha256 || "");
  const actual = hash(buf);
  if (actual !== expected) throw new Error("sha mismatch");
  const saved = await saveScopedConflictCopy({
    notebookDir,
    scope,
    originalRelativePath: relativePath,
    contentBuffer: buf,
    peerDeviceId,
    timestamp: new Date().toISOString(),
  });
  return { originalRelativePath: relativePath, conflictRelativePath: saved.relativePath, bytes: buf.length, sha256: actual };
}

export async function runScopeSyncTwoWay({ peerUrl, scope, runtimeRoot, dryRun = true } = {}) {
  const normalizedPeerUrl = normalizePeerUrl(peerUrl);
  const normalizedScope = validateSyncScope(scope);
  const resolvedRuntimeRoot = resolveRuntimeRoot({ runtimeRoot });
  const loaded = await loadSyncScopes({ runtimeRoot: resolvedRuntimeRoot });
  if (!loaded.syncScopes.includes(normalizedScope)) throw new Error(`Scope is not enabled: ${normalizedScope}`);
  const notebookDir = path.resolve(resolvedRuntimeRoot, "Notebook");

  const remoteBefore = await fetchManifest(normalizedPeerUrl, normalizedScope, resolvedRuntimeRoot);
  const localBefore = await buildScopeManifest({ notebookDir, scope: normalizedScope });
  const plan = await compareScopeManifests(localBefore, remoteBefore);

  if (dryRun) {
    return { ok: true, dryRun: true, scope: normalizedScope, peerUrl: normalizedPeerUrl, before: { localFileCount: localBefore.files.length, remoteFileCount: remoteBefore.files.length, plan }, operations: { wouldPull: plan.onlyRemote, wouldPush: plan.onlyLocal, wouldConflict: plan.changed } };
  }

  const pulled = []; const pushed = []; const conflicts = [];
  for (const rp of plan.onlyRemote) pulled.push(await pullOne({ peerUrl: normalizedPeerUrl, scope: normalizedScope, relativePath: rp, notebookDir, runtimeRoot: resolvedRuntimeRoot }));
  for (const rp of plan.onlyLocal) pushed.push(await pushOne({ peerUrl: normalizedPeerUrl, scope: normalizedScope, relativePath: rp, notebookDir, runtimeRoot: resolvedRuntimeRoot }));
  for (const rp of plan.changed) conflicts.push(await pullConflict({ peerUrl: normalizedPeerUrl, scope: normalizedScope, relativePath: rp, notebookDir, runtimeRoot: resolvedRuntimeRoot, peerDeviceId: "peer" }));

  const localAfter = await buildScopeManifest({ notebookDir, scope: normalizedScope });
  const remoteAfter = await fetchManifest(normalizedPeerUrl, normalizedScope, resolvedRuntimeRoot);
  const afterPlan = await compareScopeManifests(localAfter, remoteAfter);
  return { ok: true, dryRun: false, scope: normalizedScope, peerUrl: normalizedPeerUrl, before: { localFileCount: localBefore.files.length, remoteFileCount: remoteBefore.files.length, plan }, operations: { pulled, pushed, conflicts, skipped: { same: plan.same } }, after: { localFileCount: localAfter.files.length, remoteFileCount: remoteAfter.files.length, plan: afterPlan } };
}

async function main() {
  const peerUrl = process.argv[2]; const scope = process.argv[3];
  if (!peerUrl || !scope) { process.stderr.write("Usage: node ApplicationSystem/Sync/sync-scope-two-way.mjs <peerUrl> <scope> [--dry-run|--apply]\n"); process.exitCode = 1; return; }
  const dryRun = !process.argv.includes("--apply");
  try { const out = await runScopeSyncTwoWay({ peerUrl, scope, dryRun }); process.stdout.write(`${JSON.stringify(out, null, 2)}\n`); }
  catch (err) { process.stderr.write(`${err?.message || String(err)}\n`); process.exitCode = 1; }
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) main();
