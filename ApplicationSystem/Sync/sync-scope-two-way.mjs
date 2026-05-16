// Nodevision/ApplicationSystem/Sync/sync-scope-two-way.mjs
// This script performs safe two-way synchronization for a validated configured Notebook scope by planning pulls/pushes/conflicts, applying without blind overwrite, and returning JSON reports.

import fs from "node:fs/promises";
import path from "node:path";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { buildScopeManifest, compareScopeManifests, isPathInsideScope, loadSyncScopes, validateSyncScope } from "./SyncScopes.mjs";
import { normalizePeerUrl, resolveRuntimeRoot } from "./sync-sync-test-two-way.mjs";
import { MAX_FILE_PUSH_BYTES } from "./PeerFileTransfer.mjs";
import { createSignedScopeFilePush, createSignedScopeFileRequest, createSignedScopeManifestRequest } from "./ScopePeerSync.mjs";
import { createCancelledError, pullScopeFileStream } from "./pull-scope-file-stream.mjs";
import { pushScopeFileStream } from "./push-scope-file-stream.mjs";

const hash = (b) => createHash("sha256").update(b).digest("hex");
const postJson = async (peerUrl, endpointPath, body) => {
  let r;
  try {
    r = await fetch(new URL(endpointPath, `${peerUrl}/`).toString(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch (err) {
    const networkError = new Error(`Unable to reach peer at ${peerUrl}: ${err?.message || "network request failed"}`);
    networkError.name = "PeerSyncNetworkError";
    networkError.peerUrl = peerUrl;
    networkError.endpointPath = endpointPath;
    networkError.cause = err;
    throw networkError;
  }
  const p = await r.json().catch(() => ({}));
  if (!r.ok) {
    const peerHttpError = new Error(`${endpointPath} failed (${r.status}): ${p?.error || "request failed"}`);
    peerHttpError.name = "PeerSyncHttpError";
    peerHttpError.status = r.status;
    peerHttpError.peerUrl = peerUrl;
    peerHttpError.endpointPath = endpointPath;
    peerHttpError.responsePayload = p;
    throw peerHttpError;
  }
  return p;
};

function buildScopedConflictRelativePath(originalRelativePath, peerDeviceId, timestamp) {
  const parsed = path.posix.parse(originalRelativePath);
  const safeTs = new Date(Date.parse(timestamp)).toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const safePeer = String(peerDeviceId || "peer").replace(/[^A-Za-z0-9_-]+/g, "-");
  const name = parsed.ext ? `${parsed.name}.from-${safePeer}.${safeTs}${parsed.ext}` : `${parsed.base}.from-${safePeer}.${safeTs}`;
  return `${parsed.dir.split("/")[0]}/.conflicts/${parsed.dir.split("/").slice(1).filter(Boolean).join("/")}${parsed.dir.includes("/") ? "/" : ""}${name}`.replace(/\/\.conflicts\/$/, "/.conflicts");
}

function toManifestEntryMap(manifest) {
  const files = Array.isArray(manifest?.files) ? manifest.files : [];
  return new Map(files.map((entry) => [String(entry?.relativePath || ""), entry]));
}

function toNonNegativeSize(value) {
  const size = Number(value);
  if (!Number.isFinite(size) || size < 0) return 0;
  return Math.trunc(size);
}

function normalizeSyncErrorMessage(err) {
  const text = String(err?.message || err || "Sync operation failed").trim();
  return text || "Sync operation failed";
}

function shouldUseStreamTransfer(manifestEntry) {
  if (manifestEntry?.transferMode === "stream" || manifestEntry?.tooLargeForJson === true) return true;
  const size = Number(manifestEntry?.size);
  return Number.isFinite(size) && size > MAX_FILE_PUSH_BYTES;
}

function isJsonPullTooLargeError(err) {
  const message = normalizeSyncErrorMessage(err).toLowerCase();
  return message === "file too large"
    || message.includes("file too large")
    || message.includes("content exceeds");
}

function isJsonPushTooLargeError(err) {
  const message = normalizeSyncErrorMessage(err).toLowerCase();
  return message === "file too large for json push"
    || message.includes("too large for json push")
    || message.includes("content exceeds")
    || message.includes("size limit");
}

function resolveLocalPathFromRelativePath({ notebookDir, scope, relativePath }) {
  const scopeRoot = path.resolve(notebookDir, scope);
  return path.resolve(scopeRoot, relativePath.slice(`${scope}/`.length));
}

async function shouldUseStreamPushForLocalFile({ manifestEntry, notebookDir, scope, relativePath }) {
  if (shouldUseStreamTransfer(manifestEntry)) return true;
  try {
    const localPath = resolveLocalPathFromRelativePath({ notebookDir, scope, relativePath });
    const stat = await fs.stat(localPath);
    return stat.isFile() && stat.size > MAX_FILE_PUSH_BYTES;
  } catch {
    return false;
  }
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

async function pullOneStream({ peerUrl, scope, relativePath, notebookDir, runtimeRoot, shouldCancel, onByteDelta }) {
  const report = await pullScopeFileStream({
    peerUrl,
    scope,
    relativePath,
    notebookDir,
    runtimeRoot,
    shouldCancel,
    onByteDelta,
    peerLabel: "peer",
  });
  if (!report?.ok) throw new Error("stream pull did not complete");
  return {
    relativePath,
    bytes: toNonNegativeSize(report.bytesDownloaded),
    sha256: String(report.sha256 || ""),
    mode: String(report.mode || "created"),
    savedRelativePath: String(report.savedRelativePath || relativePath),
    conflictRelativePath: report.conflictRelativePath ? String(report.conflictRelativePath) : null,
    transferMode: "stream",
  };
}

async function pushOne({ peerUrl, scope, relativePath, notebookDir, runtimeRoot }) {
  const localPath = resolveLocalPathFromRelativePath({ notebookDir, scope, relativePath });
  const stat = await fs.stat(localPath);
  if (!stat.isFile()) throw new Error("local path is not a file");
  if (stat.size > MAX_FILE_PUSH_BYTES) throw new Error("file too large for json push");
  const buf = await fs.readFile(localPath);
  const signed = await createSignedScopeFilePush({ scope, relativePath, contentBase64: buf.toString("base64"), contentType: "application/octet-stream" }, { runtimeRoot });
  await postJson(peerUrl, "/api/peer/scope/file-push", signed);
  return { relativePath, bytes: buf.length, sha256: hash(buf) };
}

async function pushOneStream({ peerUrl, scope, relativePath, notebookDir, runtimeRoot, shouldCancel, onByteDelta }) {
  const report = await pushScopeFileStream({
    peerUrl,
    scope,
    relativePath,
    notebookDir,
    runtimeRoot,
    shouldCancel,
    onByteDelta,
  });
  if (!report?.ok) throw new Error("stream push did not complete");
  return {
    relativePath,
    bytes: toNonNegativeSize(report.bytesUploaded),
    sha256: String(report.sha256 || ""),
    mode: String(report.mode || "created"),
    savedRelativePath: String(report.savedRelativePath || relativePath),
    conflictRelativePath: report.conflictRelativePath ? String(report.conflictRelativePath) : null,
    transferMode: "stream",
  };
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

async function pullConflictStream({
  peerUrl,
  scope,
  relativePath,
  notebookDir,
  runtimeRoot,
  shouldCancel,
  onByteDelta,
}) {
  const report = await pullScopeFileStream({
    peerUrl,
    scope,
    relativePath,
    notebookDir,
    runtimeRoot,
    shouldCancel,
    peerLabel: "peer",
    onByteDelta,
  });
  if (!report?.ok) throw new Error("stream conflict pull did not complete");
  return {
    originalRelativePath: relativePath,
    conflictRelativePath: report.conflictRelativePath || null,
    savedRelativePath: report.savedRelativePath || relativePath,
    mode: report.mode || "created",
    bytes: toNonNegativeSize(report.bytesDownloaded),
    sha256: String(report.sha256 || ""),
    transferMode: "stream",
  };
}

export async function runScopeSyncTwoWay({
  peerUrl,
  scope,
  runtimeRoot,
  dryRun = true,
  shouldCancel,
  onProgress,
} = {}) {
  const normalizedPeerUrl = normalizePeerUrl(peerUrl);
  const normalizedScope = validateSyncScope(scope);
  const resolvedRuntimeRoot = resolveRuntimeRoot({ runtimeRoot });
  const loaded = await loadSyncScopes({ runtimeRoot: resolvedRuntimeRoot });
  if (!loaded.syncScopes.includes(normalizedScope)) throw new Error(`Scope is not enabled: ${normalizedScope}`);
  const notebookDir = path.resolve(resolvedRuntimeRoot, "Notebook");

  const remoteBefore = await fetchManifest(normalizedPeerUrl, normalizedScope, resolvedRuntimeRoot);
  const localBefore = await buildScopeManifest({ notebookDir, scope: normalizedScope });
  const plan = await compareScopeManifests(localBefore, remoteBefore);
  const localEntries = toManifestEntryMap(localBefore);
  const remoteEntries = toManifestEntryMap(remoteBefore);
  const progressState = {
    filesTotal: plan.onlyRemote.length + plan.onlyLocal.length + plan.changed.length,
    filesDone: 0,
    bytesTotal: 0,
    bytesDone: 0,
    currentFile: null,
  };
  const emitProgress = (event, details = {}) => {
    if (typeof onProgress !== "function") return;
    onProgress({
      event,
      ...progressState,
      ...details,
    });
  };
  const ensureNotCancelled = () => {
    if (typeof shouldCancel === "function" && shouldCancel()) throw createCancelledError();
  };
  for (const rp of plan.onlyRemote) {
    progressState.bytesTotal += toNonNegativeSize(remoteEntries.get(rp)?.size);
  }
  for (const rp of plan.onlyLocal) {
    progressState.bytesTotal += toNonNegativeSize(localEntries.get(rp)?.size);
  }
  for (const rp of plan.changed) {
    progressState.bytesTotal += toNonNegativeSize(remoteEntries.get(rp)?.size);
  }
  emitProgress("plan");

  if (dryRun) {
    return { ok: true, dryRun: true, scope: normalizedScope, peerUrl: normalizedPeerUrl, before: { localFileCount: localBefore.files.length, remoteFileCount: remoteBefore.files.length, plan }, operations: { wouldPull: plan.onlyRemote, wouldPush: plan.onlyLocal, wouldConflict: plan.changed } };
  }

  const pulled = []; const pushed = []; const conflicts = [];
  for (const rp of plan.onlyRemote) {
    ensureNotCancelled();
    progressState.currentFile = rp;
    emitProgress("file-start", { operation: "pull", relativePath: rp });
    try {
      const remoteEntry = remoteEntries.get(rp);
      let useStream = shouldUseStreamTransfer(remoteEntry);
      let pulledReport;
      try {
        pulledReport = useStream
          ? await pullOneStream({
            peerUrl: normalizedPeerUrl,
            scope: normalizedScope,
            relativePath: rp,
            notebookDir,
            runtimeRoot: resolvedRuntimeRoot,
            shouldCancel,
            onByteDelta(delta) {
              progressState.bytesDone += toNonNegativeSize(delta);
              emitProgress("file-progress", { operation: "pull", relativePath: rp });
            },
          })
          : await pullOne({
            peerUrl: normalizedPeerUrl,
            scope: normalizedScope,
            relativePath: rp,
            notebookDir,
            runtimeRoot: resolvedRuntimeRoot,
          });
      } catch (err) {
        if (!useStream && isJsonPullTooLargeError(err)) {
          useStream = true;
          pulledReport = await pullOneStream({
            peerUrl: normalizedPeerUrl,
            scope: normalizedScope,
            relativePath: rp,
            notebookDir,
            runtimeRoot: resolvedRuntimeRoot,
            shouldCancel,
            onByteDelta(delta) {
              progressState.bytesDone += toNonNegativeSize(delta);
              emitProgress("file-progress", { operation: "pull", relativePath: rp });
            },
          });
        } else {
          throw err;
        }
      }
      if (!useStream) {
        progressState.bytesDone += toNonNegativeSize(pulledReport?.bytes);
      }
      progressState.filesDone += 1;
      pulled.push(pulledReport);
      emitProgress("file-complete", { operation: "pull", relativePath: rp });
    } catch (err) {
      emitProgress("file-error", { operation: "pull", relativePath: rp, error: normalizeSyncErrorMessage(err) });
      throw err;
    }
  }
  for (const rp of plan.onlyLocal) {
    ensureNotCancelled();
    progressState.currentFile = rp;
    emitProgress("file-start", { operation: "push", relativePath: rp });
    try {
      const localEntry = localEntries.get(rp);
      let useStream = await shouldUseStreamPushForLocalFile({
        manifestEntry: localEntry,
        notebookDir,
        scope: normalizedScope,
        relativePath: rp,
      });
      let pushedReport;
      try {
        pushedReport = useStream
          ? await pushOneStream({
            peerUrl: normalizedPeerUrl,
            scope: normalizedScope,
            relativePath: rp,
            notebookDir,
            runtimeRoot: resolvedRuntimeRoot,
            shouldCancel,
            onByteDelta(delta) {
              progressState.bytesDone += toNonNegativeSize(delta);
              emitProgress("file-progress", { operation: "push", relativePath: rp });
            },
          })
          : await pushOne({
            peerUrl: normalizedPeerUrl,
            scope: normalizedScope,
            relativePath: rp,
            notebookDir,
            runtimeRoot: resolvedRuntimeRoot,
          });
      } catch (err) {
        if (!useStream && isJsonPushTooLargeError(err)) {
          useStream = true;
          pushedReport = await pushOneStream({
            peerUrl: normalizedPeerUrl,
            scope: normalizedScope,
            relativePath: rp,
            notebookDir,
            runtimeRoot: resolvedRuntimeRoot,
            shouldCancel,
            onByteDelta(delta) {
              progressState.bytesDone += toNonNegativeSize(delta);
              emitProgress("file-progress", { operation: "push", relativePath: rp });
            },
          });
        } else {
          throw err;
        }
      }
      if (!useStream) {
        progressState.bytesDone += toNonNegativeSize(pushedReport?.bytes);
      }
      progressState.filesDone += 1;
      pushed.push(pushedReport);
      emitProgress("file-complete", { operation: "push", relativePath: rp });
    } catch (err) {
      emitProgress("file-error", { operation: "push", relativePath: rp, error: normalizeSyncErrorMessage(err) });
      throw err;
    }
  }
  for (const rp of plan.changed) {
    ensureNotCancelled();
    progressState.currentFile = rp;
    emitProgress("file-start", { operation: "conflict", relativePath: rp });
    try {
      const remoteEntry = remoteEntries.get(rp);
      const useStream = shouldUseStreamTransfer(remoteEntry);
      const conflictReport = useStream
        ? await pullConflictStream({
          peerUrl: normalizedPeerUrl,
          scope: normalizedScope,
          relativePath: rp,
          notebookDir,
          runtimeRoot: resolvedRuntimeRoot,
          shouldCancel,
          onByteDelta(delta) {
            progressState.bytesDone += toNonNegativeSize(delta);
            emitProgress("file-progress", { operation: "conflict", relativePath: rp });
          },
        })
        : await pullConflict({
          peerUrl: normalizedPeerUrl,
          scope: normalizedScope,
          relativePath: rp,
          notebookDir,
          runtimeRoot: resolvedRuntimeRoot,
          peerDeviceId: "peer",
        });
      if (!useStream) {
        progressState.bytesDone += toNonNegativeSize(conflictReport?.bytes);
      }
      progressState.filesDone += 1;
      conflicts.push(conflictReport);
      emitProgress("file-complete", { operation: "conflict", relativePath: rp });
    } catch (err) {
      emitProgress("file-error", { operation: "conflict", relativePath: rp, error: normalizeSyncErrorMessage(err) });
      throw err;
    }
  }
  progressState.currentFile = null;
  emitProgress("sync-complete");

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
