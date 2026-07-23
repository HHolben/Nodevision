// Nodevision/ApplicationSystem/PhoneImport/PhoneImportService.mjs
// Job-backed service for scanning existing iPhone backups and importing Messages into the Notebook.

import fs from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";

import IOSBackupValidator from "./IOSBackupValidator.mjs";
import IOSBackupManifest, { IOS_MESSAGES_LOGICAL_PATH } from "./IOSBackupManifest.mjs";
import IOSMessagesReader from "./IOSMessagesReader.mjs";
import IOSAttachmentResolver from "./IOSAttachmentResolver.mjs";
import { loadSyncProtection } from "../Sync/SyncProtection.mjs";
import { renderConversationHtml, renderConversationsIndexHtml } from "./MessageArchiveRenderer.mjs";
import { createDeviceInformation, createImportManifest, renderImportReportHtml } from "./PhoneImportReport.mjs";
import {
  PhoneImportError,
  PHONE_IMPORT_ERROR_CODES,
  isPhoneImportError,
  phoneImportPublicMessage,
  redactDiagnostics,
  serializePhoneImportError,
  throwIfCancelled,
} from "./PhoneImportErrors.mjs";
import {
  assertInside,
  createJobId,
  importTimestampSegment,
  mkdirPrivate,
  normalizeNotebookRelativeDestination,
  phoneImportWorkspaceRoot,
  sanitizePathComponent,
  sha256File,
  sqliteCommandAvailable,
  uniquePath,
  writeFilePrivate,
} from "./PhoneImportUtils.mjs";

const FINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);
const MAX_JOBS = 80;
const MAX_SCAN_AGE_MS = 2 * 60 * 60 * 1000;
const WORKSPACE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function nowIso() {
  return new Date().toISOString();
}

function posixJoin(...parts) {
  return parts.filter(Boolean).join("/").replace(/\/+/g, "/");
}

function cloneJob(job) {
  return {
    jobId: job.jobId,
    type: job.type,
    status: job.status,
    state: job.state,
    message: job.message,
    progress: job.progress,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    warnings: [...job.warnings],
    error: job.error,
    technicalDetails: job.technicalDetails,
    result: job.result,
  };
}

function createJob(type) {
  return {
    jobId: createJobId("phone-import"),
    type,
    status: "queued",
    state: type === "scan" ? "no_backup_selected" : "importing",
    message: type === "scan" ? "No backup selected" : "Import queued",
    progress: 0,
    startedAt: nowIso(),
    finishedAt: null,
    warnings: [],
    error: null,
    technicalDetails: null,
    result: null,
    cancelRequested: false,
  };
}

function setJobProgress(job, update = {}) {
  if (update.state) job.state = update.state;
  if (update.message) job.message = update.message;
  if (Number.isFinite(Number(update.progress))) job.progress = Math.max(0, Math.min(1, Number(update.progress)));
  if (Array.isArray(update.warnings)) job.warnings.push(...update.warnings);
  if (update.technicalDetails) job.technicalDetails = redactDiagnostics(update.technicalDetails);
}

function publicConversation(conversation = {}) {
  return {
    id: conversation.id,
    displayName: conversation.displayName || "Conversation",
    participants: Array.isArray(conversation.participants) ? conversation.participants : [],
    messageCount: Number(conversation.messageCount || 0),
    attachmentCount: Number(conversation.attachmentCount || 0),
    firstMessageDate: conversation.firstMessageDate || null,
    lastMessageDate: conversation.lastMessageDate || null,
  };
}

function publicScanResult(privateScan) {
  const preview = privateScan.preview || {};
  return {
    ok: true,
    scanId: privateScan.scanId,
    valid: true,
    encrypted: false,
    backup: privateScan.validation.backup,
    messages: {
      databaseFound: preview.databaseFound === true,
      conversationCount: Number(preview.conversationCount || 0),
      messageCount: Number(preview.messageCount || 0),
      attachmentCount: Number(preview.attachmentCount || 0),
      dateRange: preview.dateRange || { first: null, last: null },
    },
    conversations: (preview.conversations || []).map(publicConversation),
    warnings: privateScan.warnings || [],
    technicalDetails: redactDiagnostics(privateScan.technicalDetails || {}),
  };
}

function normalizeServiceError(err) {
  if (isPhoneImportError(err)) return err;
  if (err?.code === PHONE_IMPORT_ERROR_CODES.MESSAGE_SCHEMA_UNSUPPORTED || err?.code === "message_schema_unsupported") {
    return new PhoneImportError(PHONE_IMPORT_ERROR_CODES.MESSAGE_SCHEMA_UNSUPPORTED, err.message, { statusCode: 400, cause: err });
  }
  return new PhoneImportError(PHONE_IMPORT_ERROR_CODES.IMPORT_FAILED, err?.message || "Phone import failed.", {
    statusCode: Number(err?.statusCode || err?.status) || 500,
    cause: err,
  });
}

async function writeJson(filePath, value) {
  await writeFilePrivate(filePath, JSON.stringify(value, null, 2) + "\n");
}

async function writeText(filePath, value) {
  await writeFilePrivate(filePath, String(value));
}

async function readNodevisionVersion(ctx = {}) {
  for (const value of [ctx.nodevisionVersion, ctx.appVersion, ctx.version]) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  const candidates = [
    ctx.applicationSystemRoot && path.join(ctx.applicationSystemRoot, "package.json"),
    ctx.runtimeRoot && path.join(ctx.runtimeRoot, "ApplicationSystem", "package.json"),
    ctx.runtimeRoot && path.join(ctx.runtimeRoot, "package.json"),
    path.join(process.cwd(), "ApplicationSystem", "package.json"),
    path.join(process.cwd(), "package.json"),
  ].filter(Boolean);
  const seen = new Set();
  for (const candidate of candidates) {
    const normalized = path.resolve(candidate);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    try {
      const parsed = JSON.parse(await fs.readFile(normalized, "utf8"));
      if (typeof parsed?.version === "string" && parsed.version.trim()) return parsed.version.trim();
    } catch {
      // Version metadata is optional provenance.
    }
  }
  return null;
}

async function collectChecksums(rootDir, relativeDir = "") {
  const files = {};
  const entries = await fs.readdir(path.join(rootDir, relativeDir), { withFileTypes: true });
  for (const entry of entries) {
    const rel = posixJoin(relativeDir, entry.name);
    const full = path.join(rootDir, rel);
    if (entry.isDirectory()) Object.assign(files, await collectChecksums(rootDir, rel));
    else if (entry.isFile()) files[rel] = await sha256File(full);
  }
  return files;
}

async function nearestExistingParent(targetPath) {
  let current = path.dirname(targetPath);
  while (current && current !== path.dirname(current)) {
    try {
      const stat = await fs.stat(current);
      if (stat.isDirectory()) return current;
    } catch (err) {
      if (err?.code !== "ENOENT") throw err;
    }
    current = path.dirname(current);
  }
  return current;
}

async function assertSafeNotebookTarget(notebookDir, targetPath) {
  const realNotebook = await fs.realpath(notebookDir);
  const parent = await nearestExistingParent(targetPath);
  const realParent = await fs.realpath(parent);
  assertInside(realNotebook, realParent, "Notebook import destination escaped the Notebook directory.");
  assertInside(realNotebook, targetPath, "Notebook import destination escaped the Notebook directory.");
}

async function assertNotebookAllowsPhoneImport(ctx = {}) {
  if (!ctx?.notebookDir) {
    throw new PhoneImportError(PHONE_IMPORT_ERROR_CODES.IMPORT_DESTINATION_INVALID, "Notebook directory is not configured.", { statusCode: 500 });
  }
  const protection = await loadSyncProtection({ runtimeRoot: ctx?.runtimeRoot }).catch(() => ({ protectedFromPeerWrites: false }));
  if (protection?.protectedFromPeerWrites === true) {
    throw new PhoneImportError(PHONE_IMPORT_ERROR_CODES.NOTEBOOK_WRITE_BLOCKED, "Protected mode prevents phone import writes.", {
      statusCode: 409,
      details: { protectedMode: true },
    });
  }
  try {
    await fs.access(ctx.notebookDir, fsConstants.W_OK);
  } catch (err) {
    throw new PhoneImportError(PHONE_IMPORT_ERROR_CODES.NOTEBOOK_WRITE_BLOCKED, "Notebook directory is not writable.", {
      statusCode: 403,
      cause: err,
      details: { notebookDir: ctx.notebookDir },
    });
  }
}

async function publishStage(stageDir, finalDir) {
  await fs.mkdir(path.dirname(finalDir), { recursive: true, mode: 0o700 });
  try {
    await fs.rename(stageDir, finalDir);
  } catch (err) {
    if (err?.code !== "EXDEV") throw err;
    await fs.rm(finalDir, { recursive: true, force: true }).catch(() => {});
    try {
      await fs.cp(stageDir, finalDir, { recursive: true, errorOnExist: true, force: false });
      await fs.rm(stageDir, { recursive: true, force: true });
    } catch (copyErr) {
      await fs.rm(finalDir, { recursive: true, force: true }).catch(() => {});
      throw copyErr;
    }
  }
}

async function cleanupOldWorkspaces(workspaceRoot) {
  try {
    const entries = await fs.readdir(workspaceRoot, { withFileTypes: true });
    const cutoff = Date.now() - WORKSPACE_MAX_AGE_MS;
    await Promise.all(entries.map(async (entry) => {
      if (!entry.isDirectory() || !entry.name.startsWith("phone-import-")) return;
      const full = path.join(workspaceRoot, entry.name);
      const stat = await fs.stat(full).catch(() => null);
      if (stat && stat.mtimeMs < cutoff) await fs.rm(full, { recursive: true, force: true }).catch(() => {});
    }));
  } catch {
    // Cleanup is best-effort.
  }
}


async function scanExistingBackup({ backupPath, workspaceRoot, jobId, isCancelled, onProgress }) {
  if (!(await sqliteCommandAvailable())) {
    throw new PhoneImportError(PHONE_IMPORT_ERROR_CODES.SQLITE_UNAVAILABLE, phoneImportPublicMessage(PHONE_IMPORT_ERROR_CODES.SQLITE_UNAVAILABLE), { statusCode: 500 });
  }
  throwIfCancelled(isCancelled);
  onProgress({ state: "scanning_backup", message: "Scanning backup", progress: 0.08 });
  const validator = new IOSBackupValidator();
  const validation = await validator.validateBackupPath(backupPath);
  throwIfCancelled(isCancelled);

  onProgress({ state: "scanning_backup", message: "Reading backup manifest", progress: 0.24, technicalDetails: validation.diagnostics });
  const manifest = new IOSBackupManifest(validation.backupPath);
  const smsRecord = await manifest.resolveLogicalPath(IOS_MESSAGES_LOGICAL_PATH.domain, IOS_MESSAGES_LOGICAL_PATH.relativePath, { required: false });
  if (!smsRecord) {
    const warnings = [...validation.warnings, ...manifest.getWarnings()];
    return {
      scanId: jobId,
      validation,
      preview: {
        databaseFound: false,
        conversationCount: 0,
        messageCount: 0,
        attachmentCount: 0,
        dateRange: { first: null, last: null },
        conversations: [],
      },
      warnings,
      technicalDetails: {
        ...validation.diagnostics,
        messagesLogicalPath: IOS_MESSAGES_LOGICAL_PATH,
        manifestWarnings: manifest.getWarnings(),
      },
    };
  }

  throwIfCancelled(isCancelled);
  onProgress({ state: "messages_database_found", message: "Messages database found", progress: 0.34 });
  onProgress({ state: "reading_conversations", message: "Reading conversations", progress: 0.45 });
  const workspaceDir = path.join(workspaceRoot, jobId, "scan");
  const reader = new IOSMessagesReader();
  let dbCopy = null;
  try {
    dbCopy = await reader.copySmsDatabase({ manifest, workspaceDir });
    const preview = await reader.readPreview(dbCopy.localDbPath);
    const warnings = [...validation.warnings, ...manifest.getWarnings(), ...preview.warnings];
    return {
      scanId: jobId,
      validation,
      preview,
      dbCopy: {
        sourceSmsDbSha256: dbCopy.sourceSmsDbSha256,
        copiedSidecars: dbCopy.copiedSidecars.map((sidecar) => ({ logicalPath: sidecar.logicalPath, size: sidecar.size })),
      },
      warnings,
      technicalDetails: {
        ...validation.diagnostics,
        messagesLogicalPath: IOS_MESSAGES_LOGICAL_PATH,
        sourceSmsDbSha256: dbCopy.sourceSmsDbSha256,
        copiedSidecars: dbCopy.copiedSidecars.map((sidecar) => ({ logicalPath: sidecar.logicalPath, size: sidecar.size })),
        parserWarnings: preview.warnings,
      },
    };
  } finally {
    await fs.rm(workspaceDir, { recursive: true, force: true }).catch(() => {});
  }
}

function selectedConversationsForImport(scan, selectedConversationIds = []) {
  const selected = new Set((Array.isArray(selectedConversationIds) ? selectedConversationIds : []).map((id) => String(id || "").trim()).filter(Boolean));
  if (!selected.size) {
    throw new PhoneImportError(PHONE_IMPORT_ERROR_CODES.IMPORT_SELECTION_EMPTY, "No conversations selected.", { statusCode: 400 });
  }
  const conversations = (scan.preview?.conversations || []).filter((conversation) => selected.has(conversation.id));
  if (!conversations.length) {
    throw new PhoneImportError(PHONE_IMPORT_ERROR_CODES.IMPORT_SELECTION_EMPTY, "Selected conversations were not found in the scan result.", { statusCode: 400 });
  }
  return conversations;
}

async function prepareImportDestination(ctx, validation, requestedDestination) {
  const destinationBaseRel = normalizeNotebookRelativeDestination(requestedDestination || "Imports/Phones");
  const deviceSegment = sanitizePathComponent(validation.backup?.deviceName || "iPhone Backup", "iPhone Backup");
  const stamp = importTimestampSegment();
  const candidateRel = posixJoin(destinationBaseRel, deviceSegment, stamp);
  const candidatePath = path.join(ctx.notebookDir, ...candidateRel.split("/"));
  await assertSafeNotebookTarget(ctx.notebookDir, candidatePath);
  const finalPath = await uniquePath(candidatePath);
  await assertSafeNotebookTarget(ctx.notebookDir, finalPath);
  const finalRel = path.relative(ctx.notebookDir, finalPath).split(path.sep).join("/");
  return { finalPath, finalRel };
}

async function copyConversationAttachments({ conversation, resolver, copyAttachments, conversationIndex, isCancelled }) {
  let attachmentIndex = 0;
  let missingCount = 0;
  for (const message of conversation.messages || []) {
    const copied = [];
    for (const attachment of message.attachments || []) {
      throwIfCancelled(isCancelled);
      attachmentIndex += 1;
      if (copyAttachments === false) {
        copied.push(resolver.recordUnavailable(attachment, "attachment_copy_disabled", "Attachment copying was disabled for this import."));
        missingCount += 1;
        continue;
      }
      const resolved = await resolver.copyAttachment(attachment, { conversationIndex, attachmentIndex });
      if (!resolved.ok) missingCount += 1;
      copied.push({ ...attachment, ...resolved });
    }
    message.attachments = copied;
  }
  return missingCount;
}

async function importSelectedConversations({ ctx, scan, payload, workspaceRoot, jobId, isCancelled, onProgress }) {
  if (payload?.privacyAcknowledged !== true) {
    throw new PhoneImportError(PHONE_IMPORT_ERROR_CODES.IMPORT_FAILED, "Privacy warning acknowledgement is required before importing.", {
      statusCode: 400,
      publicMessage: "Acknowledge the phone backup privacy warning before importing.",
    });
  }
  if (!(await sqliteCommandAvailable())) {
    throw new PhoneImportError(PHONE_IMPORT_ERROR_CODES.SQLITE_UNAVAILABLE, phoneImportPublicMessage(PHONE_IMPORT_ERROR_CODES.SQLITE_UNAVAILABLE), { statusCode: 500 });
  }
  await assertNotebookAllowsPhoneImport(ctx);

  throwIfCancelled(isCancelled);
  onProgress({ state: "importing", message: "Revalidating backup", progress: 0.06 });
  const selected = selectedConversationsForImport(scan, payload?.conversationIds || payload?.selectedConversationIds || []);
  const validator = new IOSBackupValidator();
  const validation = await validator.validateBackupPath(scan.validation.backupPath);
  const manifest = new IOSBackupManifest(validation.backupPath);
  const workspaceDir = path.join(workspaceRoot, jobId, "import");
  const stageDir = path.join(workspaceDir, "stage");
  const messagesDir = path.join(stageDir, "Messages");
  const attachmentsDir = path.join(messagesDir, "Attachments");
  await mkdirPrivate(workspaceDir);
  await mkdirPrivate(stageDir);

  let published = false;
  try {
    throwIfCancelled(isCancelled);
    onProgress({ state: "reading_conversations", message: "Reading selected conversations", progress: 0.18 });
    const reader = new IOSMessagesReader();
    const dbCopy = await reader.copySmsDatabase({ manifest, workspaceDir: path.join(workspaceDir, "db") });
    const readResult = await reader.readConversations(dbCopy.localDbPath, selected, {
      isCancelled,
      onProgress(update) {
        const total = Math.max(1, Number(update.conversationsTotal || selected.length));
        const done = Number(update.conversationsDone || 0);
        onProgress({ state: "reading_conversations", message: "Reading " + (update.currentConversation || "conversation"), progress: 0.2 + Math.min(0.34, done / total * 0.34) });
      },
    });

    throwIfCancelled(isCancelled);
    const destination = await prepareImportDestination(ctx, validation, payload?.destination || payload?.destinationRelativePath);
    await mkdirPrivate(messagesDir);
    await mkdirPrivate(attachmentsDir);
    await mkdirPrivate(path.join(stageDir, "Source Metadata"));
    onProgress({ state: "importing", message: "Rendering Notebook files", progress: 0.58 });

    const resolver = new IOSAttachmentResolver({ manifest, attachmentsDir, attachmentsRelativeFromMessages: "Attachments" });
    const importedAt = nowIso();
    const generatedFiles = [];
    const indexEntries = [];
    let conversationIndex = 0;
    let messagesImported = 0;
    let missingAttachments = 0;

    for (const conversation of readResult.conversations) {
      throwIfCancelled(isCancelled);
      conversationIndex += 1;
      missingAttachments += await copyConversationAttachments({
        conversation,
        resolver,
        copyAttachments: payload?.copyAttachments !== false,
        conversationIndex,
        isCancelled,
      });
      const filename = "Conversation-" + String(conversationIndex).padStart(3, "0") + ".html";
      const relPath = posixJoin("Messages", filename);
      await writeText(path.join(stageDir, relPath), renderConversationHtml(conversation, { importedAt }));
      generatedFiles.push(relPath);
      indexEntries.push({
        title: conversation.displayName || "Conversation " + conversationIndex,
        relativeHref: relPath,
        messageCount: conversation.messageCount,
        attachmentCount: conversation.attachmentCount,
        lastMessageDate: conversation.lastMessageDate,
      });
      messagesImported += conversation.messages.length;
      onProgress({ state: "importing", message: "Rendered " + conversationIndex + " conversation(s)", progress: 0.58 + Math.min(0.2, conversationIndex / selected.length * 0.2) });
    }

    const copiedAttachments = resolver.getCopiedAttachments();
    const warnings = [...scan.warnings, ...validation.warnings, ...manifest.getWarnings(), ...readResult.warnings, ...resolver.getWarnings()];
    const resultStatus = warnings.length ? "completed_with_warnings" : "completed";
    const deviceInfo = createDeviceInformation(validation);
    await writeJson(path.join(stageDir, "Device Information.json"), deviceInfo);
    await writeText(path.join(stageDir, "Conversations.html"), renderConversationsIndexHtml(indexEntries, { importedAt }));
    await writeText(path.join(stageDir, "Import Report.html"), renderImportReportHtml({
      validation,
      importedAt,
      destinationRelativePath: destination.finalRel,
      discoveredCount: scan.preview?.conversationCount || 0,
      importedConversations: readResult.conversations.length,
      messagesImported,
      attachmentsCopied: copiedAttachments.length,
      missingAttachments,
      warnings,
      sourceChecksums: { smsDb: dbCopy.sourceSmsDbSha256 },
      result: resultStatus,
    }));
    generatedFiles.push("Device Information.json", "Conversations.html", "Import Report.html");
    generatedFiles.push(...copiedAttachments.map((attachment) => posixJoin("Messages", attachment.relativePath)));

    onProgress({ state: "importing", message: "Writing import manifest", progress: 0.84 });
    const checksums = await collectChecksums(stageDir);
    const nodevisionVersion = await readNodevisionVersion(ctx);
    const importManifest = createImportManifest({
      validation,
      importedAt,
      destinationRelativePath: destination.finalRel,
      selectedConversationIds: selected.map((conversation) => conversation.id),
      generatedFiles,
      checksums,
      warnings,
      sourceChecksums: { smsDb: dbCopy.sourceSmsDbSha256 },
      nodevisionVersion,
    });
    await writeJson(path.join(stageDir, "Source Metadata", "ImportManifest.json"), importManifest);
    generatedFiles.push("Source Metadata/ImportManifest.json");

    throwIfCancelled(isCancelled);
    onProgress({ state: "importing", message: "Publishing into Notebook", progress: 0.92 });
    await publishStage(stageDir, destination.finalPath);
    published = true;

    const finalChecksums = await collectChecksums(destination.finalPath);
    const result = {
      ok: true,
      status: resultStatus,
      state: warnings.length ? "import_completed_with_warnings" : "import_completed",
      destinationRelativePath: destination.finalRel,
      indexPath: posixJoin(destination.finalRel, "Conversations.html"),
      reportPath: posixJoin(destination.finalRel, "Import Report.html"),
      conversationsImported: readResult.conversations.length,
      messagesImported,
      attachmentsCopied: copiedAttachments.length,
      missingAttachments,
      generatedFiles,
      checksums: finalChecksums,
      warnings,
    };
    return result;
  } catch (err) {
    if (!published) await fs.rm(stageDir, { recursive: true, force: true }).catch(() => {});
    throw err;
  } finally {
    await fs.rm(workspaceDir, { recursive: true, force: true }).catch(() => {});
  }
}


export function createPhoneImportService(ctx, options = {}) {
  const workspaceRoot = phoneImportWorkspaceRoot(ctx || {});
  const jobs = new Map();
  const scans = new Map();
  cleanupOldWorkspaces(workspaceRoot);

  function pruneJobs() {
    const cutoff = Date.now() - MAX_SCAN_AGE_MS;
    for (const [scanId, scan] of scans.entries()) {
      if (Date.parse(scan.createdAt || scan.scanStartedAt || 0) < cutoff) scans.delete(scanId);
    }
    if (jobs.size <= MAX_JOBS) return;
    const done = [...jobs.values()]
      .filter((job) => FINAL_STATUSES.has(job.status))
      .sort((a, b) => Date.parse(a.finishedAt || a.startedAt) - Date.parse(b.finishedAt || b.startedAt));
    while (jobs.size > MAX_JOBS && done.length) jobs.delete(done.shift().jobId);
  }

  function startJob(type, run) {
    const job = createJob(type);
    jobs.set(job.jobId, job);
    pruneJobs();
    queueMicrotask(async () => {
      if (job.cancelRequested) {
        job.status = "cancelled";
        job.state = type === "scan" ? "no_backup_selected" : "import_failed";
        job.message = "Cancelled";
        job.finishedAt = nowIso();
        return;
      }
      job.status = "running";
      try {
        const result = await run({
          job,
          isCancelled: () => job.cancelRequested === true,
          onProgress: (update) => setJobProgress(job, update),
        });
        if (job.cancelRequested && result?.ok !== true) {
          job.status = "cancelled";
          job.state = type === "scan" ? "no_backup_selected" : "import_failed";
          job.message = "Cancelled";
        } else {
          job.status = "completed";
          job.result = result;
          job.state = result?.state || (type === "scan" ? "ready_to_import" : "import_completed");
          job.message = result?.state === "messages_database_not_found" ? "Messages database not found" : (result?.status === "completed_with_warnings" ? "Completed with warnings" : (type === "scan" ? "Ready to import" : "Import completed"));
          job.progress = 1;
          if (Array.isArray(result?.warnings)) job.warnings = result.warnings;
          if (result?.technicalDetails) job.technicalDetails = redactDiagnostics(result.technicalDetails);
        }
      } catch (err) {
        const normalized = normalizeServiceError(err);
        const payload = serializePhoneImportError(normalized);
        job.status = normalized.code === PHONE_IMPORT_ERROR_CODES.IMPORT_CANCELLED ? "cancelled" : "failed";
        job.state = stateForError(normalized.code, type);
        job.message = payload.error;
        job.error = { code: payload.code, message: payload.error };
        job.technicalDetails = payload.technicalDetails;
      } finally {
        job.finishedAt = nowIso();
      }
    });
    return cloneJob(job);
  }

  function stateForError(code, type) {
    if (code === PHONE_IMPORT_ERROR_CODES.ENCRYPTED_BACKUP) return "encrypted_backup_not_supported";
    if (code === PHONE_IMPORT_ERROR_CODES.MESSAGES_DB_NOT_FOUND) return "messages_database_not_found";
    if (code === PHONE_IMPORT_ERROR_CODES.INVALID_PATH || code === PHONE_IMPORT_ERROR_CODES.INVALID_BACKUP_DIRECTORY || code === PHONE_IMPORT_ERROR_CODES.MANIFEST_DB_MISSING || code === PHONE_IMPORT_ERROR_CODES.MULTIPLE_BACKUPS_FOUND) return "invalid_backup_directory";
    if (code === PHONE_IMPORT_ERROR_CODES.IMPORT_CANCELLED) return type === "scan" ? "no_backup_selected" : "import_failed";
    return type === "scan" ? "invalid_backup_directory" : "import_failed";
  }

  function startScan(input = {}) {
    const backupPath = String(input.backupPath || "").trim();
    const job = startJob("scan", async ({ job: scanJob, isCancelled, onProgress }) => {
      const privateScan = await scanExistingBackup({ backupPath, workspaceRoot, jobId: scanJob.jobId, isCancelled, onProgress });
      privateScan.createdAt = nowIso();
      scans.set(scanJob.jobId, privateScan);
      const result = publicScanResult(privateScan);
      if (result.messages.databaseFound) {
        result.state = "ready_to_import";
      } else {
        result.state = "messages_database_not_found";
        result.status = "messages_database_not_found";
      }
      return result;
    });
    return job;
  }

  function startImport(payload = {}) {
    const scanId = String(payload.scanId || payload.jobId || "").trim();
    const scan = scans.get(scanId);
    if (!scan) {
      throw new PhoneImportError(PHONE_IMPORT_ERROR_CODES.IMPORT_SCAN_NOT_FOUND, "Scan result not found.", { statusCode: 404 });
    }
    if (scan.preview?.databaseFound !== true) {
      throw new PhoneImportError(PHONE_IMPORT_ERROR_CODES.MESSAGES_DB_NOT_FOUND, "Messages database not found in this scan.", { statusCode: 404 });
    }
    return startJob("import", async ({ job, isCancelled, onProgress }) => await importSelectedConversations({
      ctx,
      scan,
      payload,
      workspaceRoot,
      jobId: job.jobId,
      isCancelled,
      onProgress,
    }));
  }

  function getJobStatus(jobId) {
    const job = jobs.get(String(jobId || ""));
    return job ? cloneJob(job) : null;
  }

  function cancelJob(jobId) {
    const job = jobs.get(String(jobId || ""));
    if (!job) return null;
    if (FINAL_STATUSES.has(job.status)) return cloneJob(job);
    job.cancelRequested = true;
    if (job.status === "queued") {
      job.status = "cancelled";
      job.finishedAt = nowIso();
      job.message = "Cancelled";
    }
    return cloneJob(job);
  }

  return {
    startScan,
    startImport,
    getJobStatus,
    cancelJob,
    _private: options.exposePrivateState ? { jobs, scans } : undefined,
  };
}

export default createPhoneImportService;
