// Nodevision/ApplicationSystem/Sync/SyncResult.mjs
// Shared helpers for sync preview/import result objects that match the live sync job vocabulary.

function nowIso() {
  return new Date().toISOString();
}

function toNonNegativeInteger(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
}

function clonePlain(value) {
  if (!value || typeof value !== "object") return value;
  return JSON.parse(JSON.stringify(value));
}

export function createSyncResult({
  kind = "sync",
  operation = "sync",
  scope = "",
  peerUrl = "",
  sourceDevice = null,
  targetScope = "",
  preview = false,
  dryRun = false,
  protectedMode = null,
  trustedPeerFound = false,
  signatureVerified = false,
  packageValid = true,
  status = "running",
  reason = "",
} = {}) {
  const startedAt = nowIso();
  return {
    ok: true,
    partial: false,
    kind,
    operation,
    preview: Boolean(preview),
    dryRun: Boolean(dryRun),
    status,
    reason: String(reason || ""),
    scope: String(scope || ""),
    targetScope: String(targetScope || scope || ""),
    peerUrl: String(peerUrl || ""),
    sourceDevice: sourceDevice && typeof sourceDevice === "object" ? clonePlain(sourceDevice) : null,
    filesTotal: 0,
    filesDone: 0,
    bytesTotal: 0,
    bytesDone: 0,
    currentFile: null,
    filesSkipped: 0,
    bytesSkipped: 0,
    errors: [],
    skipped: [],
    skippedOperations: [],
    conflicts: [],
    created: [],
    updated: [],
    deleted: [],
    blocked: [],
    invalidPaths: [],
    protectedMode,
    trustedPeerFound: Boolean(trustedPeerFound),
    signatureVerified: Boolean(signatureVerified),
    signatureValid: Boolean(signatureVerified),
    packageValid: Boolean(packageValid),
    trusted: Boolean(trustedPeerFound && signatureVerified),
    operations: {
      pulled: [],
      pushed: [],
      created: [],
      updated: [],
      deleted: [],
      conflicts: [],
      blocked: [],
      skipped: [],
      skippedOperations: [],
    },
    counts: {
      created: 0,
      updated: 0,
      deleted: 0,
      conflicts: 0,
      skipped: 0,
      blocked: 0,
      errors: 0,
    },
    startedAt,
    finishedAt: null,
  };
}

export function recordCreated(result, entry = {}) {
  const record = { ...entry, operation: entry.operation || "create" };
  result.created.push(record);
  result.operations.created.push(record);
  result.operations.pulled.push(record);
  result.counts.created = result.created.length;
  result.filesDone += result.preview ? 0 : 1;
  result.bytesDone += result.preview ? 0 : toNonNegativeInteger(record.bytes || record.size);
  return record;
}

export function recordUpdated(result, entry = {}) {
  const record = { ...entry, operation: entry.operation || "update" };
  result.updated.push(record);
  result.operations.updated.push(record);
  result.operations.pulled.push(record);
  result.counts.updated = result.updated.length;
  result.filesDone += result.preview ? 0 : 1;
  result.bytesDone += result.preview ? 0 : toNonNegativeInteger(record.bytes || record.size);
  return record;
}

export function recordDeleted(result, entry = {}) {
  const record = { ...entry, operation: entry.operation || "delete" };
  result.deleted.push(record);
  result.operations.deleted.push(record);
  result.counts.deleted = result.deleted.length;
  result.filesDone += result.preview ? 0 : 1;
  return record;
}

export function recordSkipped(result, entry = {}) {
  const record = { ...entry, operation: entry.operation || "skip" };
  result.skipped.push(record);
  result.operations.skipped.push(record);
  const skippedOperation = {
    type: record.operation,
    operation: record.operation,
    scope: record.scope || result.scope,
    peerUrl: record.peerUrl || result.peerUrl,
    relativePath: record.relativePath || "",
    error: record.error || record.reason || "Skipped",
    statusCode: record.statusCode || null,
    retryCount: toNonNegativeInteger(record.retryCount),
    safelyRetryable: record.safelyRetryable !== false,
    bytes: toNonNegativeInteger(record.bytes || record.size),
    timestamp: record.timestamp || nowIso(),
  };
  result.skippedOperations.push(skippedOperation);
  result.operations.skippedOperations.push(skippedOperation);
  result.counts.skipped = result.skipped.length;
  result.filesSkipped = result.skippedOperations.length;
  result.bytesSkipped = result.skippedOperations.reduce((sum, item) => sum + toNonNegativeInteger(item.bytes), 0);
  return record;
}

export function recordConflict(result, entry = {}) {
  const record = { ...entry, operation: entry.operation || "conflict" };
  result.conflicts.push(record);
  result.operations.conflicts.push(record);
  result.counts.conflicts = result.conflicts.length;
  result.filesDone += result.preview ? 0 : 1;
  result.bytesDone += result.preview ? 0 : toNonNegativeInteger(record.bytes || record.size);
  return record;
}

export function recordBlocked(result, entry = {}) {
  const record = { ...entry, operation: entry.operation || "blocked" };
  result.blocked.push(record);
  result.operations.blocked.push(record);
  result.counts.blocked = result.blocked.length;
  return record;
}

export function recordInvalidPath(result, entry = {}) {
  const record = recordBlocked(result, {
    ...entry,
    reason: entry.reason || "invalid_path",
  });
  result.invalidPaths.push(record);
  result.packageValid = false;
  return record;
}

export function recordError(result, error, details = {}) {
  const message = String(error?.message || error || "Sync operation failed");
  result.errors.push(message);
  result.counts.errors = result.errors.length;
  if (details.blocked === true) {
    recordBlocked(result, { ...details, error: message, reason: details.reason || "error" });
  }
  return message;
}

export function recordTrustFailure(result, details = {}) {
  result.trusted = false;
  result.trustedPeerFound = false;
  result.reason = details.reason || "untrusted_peer";
  return recordBlocked(result, {
    operation: "trust",
    reason: result.reason,
    error: details.error || "Package is not from a trusted peer",
    sourceDevice: details.sourceDevice || result.sourceDevice,
  });
}

export function recordProtectedModeFailure(result, details = {}) {
  result.reason = details.reason || "protected_mode";
  result.protectedMode = {
    ...(result.protectedMode && typeof result.protectedMode === "object" ? result.protectedMode : {}),
    enabled: true,
    blocked: true,
  };
  return recordBlocked(result, {
    operation: "protected-mode",
    reason: result.reason,
    error: details.error || "Protected mode prevents incoming sync writes",
  });
}

export function finalizeSyncResult(result, requestedStatus = "") {
  const status = String(requestedStatus || "").trim();
  const blocked = result.blocked.length > 0;
  const errors = result.errors.length > 0;
  const changed = result.created.length + result.updated.length + result.deleted.length + result.conflicts.length;
  const skipped = result.skipped.length > 0;
  result.filesTotal = result.created.length + result.updated.length + result.deleted.length + result.conflicts.length + result.skipped.length + result.blocked.length;
  result.bytesTotal = [
    ...result.created,
    ...result.updated,
    ...result.conflicts,
    ...result.skipped,
    ...result.blocked,
  ].reduce((sum, item) => sum + toNonNegativeInteger(item?.bytes || item?.size), 0);
  result.partial = Boolean((changed > 0 && (blocked || errors || skipped)) || (blocked && changed > 0));
  if (status) {
    result.status = status;
  } else if (blocked && changed === 0) {
    result.status = "blocked";
  } else if (errors && changed === 0) {
    result.status = "failed";
  } else if (blocked || errors || skipped) {
    result.status = result.partial ? "partial" : "blocked";
  } else {
    result.status = result.preview ? "preview" : "completed";
  }
  result.ok = !["failed", "blocked"].includes(result.status);
  result.finishedAt = nowIso();
  return result;
}
