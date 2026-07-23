// Synthetic tests for Phone Import. No real phone data is used.

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";

import IOSBackupValidator from "./IOSBackupValidator.mjs";
import IOSBackupManifest from "./IOSBackupManifest.mjs";
import IOSMessagesReader from "./IOSMessagesReader.mjs";
import { normalizeIosAttachmentPath } from "./IOSAttachmentResolver.mjs";
import { renderConversationHtml } from "./MessageArchiveRenderer.mjs";
import { createPhoneImportService } from "./PhoneImportService.mjs";
import { saveSyncProtection } from "../Sync/SyncProtection.mjs";
import { APPLE_EPOCH_MS, normalizeAppleTimestamp, pathExists, safeAttachmentExtension } from "./PhoneImportUtils.mjs";

function sqlString(value) {
  return "'" + String(value ?? "").replace(/'/g, "''") + "'";
}

async function sqliteAvailable() {
  return await new Promise((resolve) => {
    const child = spawn("sqlite3", ["-version"], { stdio: ["ignore", "ignore", "ignore"] });
    child.once("error", () => resolve(false));
    child.once("exit", (code) => resolve(code === 0));
  });
}

async function execSqlite(databasePath, sql) {
  await new Promise((resolve, reject) => {
    const child = spawn("sqlite3", [databasePath, sql], { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolve() : reject(new Error(stderr || "sqlite3 failed")));
  });
}

function fileIdFor(domain, relativePath, salt = "") {
  return createHash("sha1").update(domain + "-" + relativePath + salt).digest("hex");
}

function appleNs(iso) {
  return Math.trunc((Date.parse(iso) - APPLE_EPOCH_MS) * 1000000);
}

async function writePlist(filePath, values) {
  const body = Object.entries(values).map(([key, value]) => {
    if (typeof value === "boolean") return `  <key>${key}</key><${value ? "true" : "false"}/>`;
    return `  <key>${key}</key><string>${String(value)}</string>`;
  }).join("\n");
  await fs.writeFile(filePath, `<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0"><dict>\n${body}\n</dict></plist>\n`);
}

async function createManifestDb(backupDir) {
  const db = path.join(backupDir, "Manifest.db");
  await execSqlite(db, "CREATE TABLE Files(fileID TEXT, domain TEXT, relativePath TEXT, flags INTEGER, file BLOB);");
  return db;
}

async function addManifestRecord(backupDir, domain, relativePath, sourcePath, salt = "") {
  const fileID = fileIdFor(domain, relativePath, salt);
  const targetDir = path.join(backupDir, fileID.slice(0, 2));
  const target = path.join(targetDir, fileID);
  await fs.mkdir(targetDir, { recursive: true });
  if (sourcePath) await fs.copyFile(sourcePath, target);
  await execSqlite(path.join(backupDir, "Manifest.db"), `INSERT INTO Files(fileID,domain,relativePath,flags,file) VALUES(${sqlString(fileID)},${sqlString(domain)},${sqlString(relativePath)},0,X'');`);
  return { fileID, target };
}

async function createSmsDb(dbPath, options = {}) {
  const minimal = options.minimal === true;
  if (minimal) {
    await execSqlite(dbPath, `CREATE TABLE message(ROWID INTEGER PRIMARY KEY, date INTEGER, handle_id INTEGER); INSERT INTO message(ROWID,date,handle_id) VALUES(1,${appleNs("2026-07-18T23:42:00.000Z")},1);`);
    return;
  }
  await execSqlite(dbPath, `
    CREATE TABLE handle(ROWID INTEGER PRIMARY KEY, id TEXT, service TEXT);
    CREATE TABLE chat(ROWID INTEGER PRIMARY KEY, chat_identifier TEXT, display_name TEXT, service_name TEXT);
    CREATE TABLE chat_message_join(chat_id INTEGER, message_id INTEGER);
    CREATE TABLE chat_handle_join(chat_id INTEGER, handle_id INTEGER);
    CREATE TABLE message(ROWID INTEGER PRIMARY KEY, guid TEXT, text TEXT, date INTEGER, is_from_me INTEGER, service TEXT, handle_id INTEGER, subject TEXT, associated_message_guid TEXT, associated_message_type INTEGER);
    CREATE TABLE attachment(ROWID INTEGER PRIMARY KEY, guid TEXT, filename TEXT, mime_type TEXT, transfer_name TEXT, total_bytes INTEGER);
    CREATE TABLE message_attachment_join(message_id INTEGER, attachment_id INTEGER);
    INSERT INTO handle(ROWID,id,service) VALUES(1,'+15551231234','SMS'),(2,'alice@example.test','iMessage'),(3,'+15559876543','iMessage');
    INSERT INTO chat(ROWID,chat_identifier,display_name,service_name) VALUES(1,'+15551231234',NULL,'SMS'),(2,'chat100','Test Group','iMessage');
    INSERT INTO chat_handle_join(chat_id,handle_id) VALUES(1,1),(2,2),(2,3);
    INSERT INTO message(ROWID,guid,text,date,is_from_me,service,handle_id,subject,associated_message_guid,associated_message_type) VALUES
      (1,'msg-1','Hello <script>alert(1)</script>',${appleNs("2026-07-18T23:42:00.000Z")},0,'SMS',1,NULL,NULL,NULL),
      (2,'msg-2','Yes, around ten.',${appleNs("2026-07-18T23:43:12.000Z")},1,'iMessage',1,NULL,NULL,NULL),
      (3,'msg-3',NULL,${appleNs("2026-07-19T01:00:00.000Z")},0,'MMS',1,NULL,NULL,NULL),
      (4,'msg-4','Group hello',${appleNs("2026-07-20T01:00:00.000Z")},0,'CarrierX',2,NULL,'msg-1',2000),
      (5,'msg-5','Bad date',999999999999999999,0,'SMS',3,NULL,NULL,NULL);
    INSERT INTO chat_message_join(chat_id,message_id) VALUES(1,1),(1,2),(1,3),(2,4),(2,5);
    INSERT INTO attachment(ROWID,guid,filename,mime_type,transfer_name,total_bytes) VALUES
      (1,'att-1','~/Library/SMS/Attachments/aa/photo.jpg','image/jpeg','../../unsafe.jpg',5),
      (2,'att-2','/var/mobile/Library/SMS/Attachments/bb/missing.mov','video/quicktime','missing.mov',10);
    INSERT INTO message_attachment_join(message_id,attachment_id) VALUES(3,1),(3,2);
  `);
}

async function createBackupFixture(root, options = {}) {
  const backupDir = path.join(root, options.name || "device-backup");
  await fs.mkdir(backupDir, { recursive: true });
  await createManifestDb(backupDir);
  await writePlist(path.join(backupDir, "Manifest.plist"), { IsEncrypted: options.encrypted === true });
  await writePlist(path.join(backupDir, "Info.plist"), { "Device Name": options.deviceName || "Test Phone", "Product Type": "iPhone10,6", "Product Version": "16.7", "Last Backup Date": "2026-07-21T12:00:00.000Z" });
  await writePlist(path.join(backupDir, "Status.plist"), { Date: "2026-07-21T12:05:00.000Z" });
  if (options.withSms !== false) {
    const sms = path.join(root, (options.name || "device-backup") + "-sms.db");
    await createSmsDb(sms, options);
    await addManifestRecord(backupDir, "HomeDomain", "Library/SMS/sms.db", sms);
    const wal = path.join(root, "sms.db-wal");
    await fs.writeFile(wal, "");
    await addManifestRecord(backupDir, "HomeDomain", "Library/SMS/sms.db-wal", wal);
    const attachment = path.join(root, "photo.jpg");
    await fs.writeFile(attachment, "photo");
    await addManifestRecord(backupDir, "HomeDomain", "Library/SMS/Attachments/aa/photo.jpg", attachment);
  }
  return backupDir;
}

async function waitJob(service, jobId) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const job = service.getJobStatus(jobId);
    if (["completed", "failed", "cancelled"].includes(job?.status)) return job;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Timed out waiting for job " + jobId);
}

async function testBackupValidation(tmp) {
  const backup = await createBackupFixture(tmp);
  const validator = new IOSBackupValidator();
  const direct = await validator.validateBackupPath(backup);
  assert.equal(direct.valid, true);
  assert.equal(direct.encrypted, false);
  const parent = await validator.validateBackupPath(tmp);
  assert.equal(parent.inputKind, "backup-parent");
  await createBackupFixture(tmp, { name: "second-device", withSms: false });
  await assert.rejects(() => validator.validateBackupPath(tmp), /multiple backups/i);
  const missing = path.join(tmp, "missing-manifest");
  await fs.mkdir(missing);
  await assert.rejects(() => validator.validateBackupPath(missing), /Manifest\.db/);
  const encrypted = await createBackupFixture(tmp, { name: "encrypted", encrypted: true });
  await assert.rejects(() => validator.validateBackupPath(encrypted), /encrypted/i);
  await assert.rejects(() => validator.validateBackupPath("../escape"), /traversal/i);
}

async function testManifestResolution(tmp) {
  const backup = await createBackupFixture(tmp, { name: "manifest-device" });
  const manifest = new IOSBackupManifest(backup);
  const sms = await manifest.resolveMessagesDatabase();
  assert.equal(sms.domain, "HomeDomain");
  assert(await pathExists(sms.sourcePath));
  const attachment = await manifest.resolveLogicalPath("HomeDomain", "Library/SMS/Attachments/aa/photo.jpg", { required: true });
  assert(await pathExists(attachment.sourcePath));
  const noMessages = await createBackupFixture(tmp, { name: "no-messages", withSms: false });
  assert.equal(await new IOSBackupManifest(noMessages).resolveLogicalPath("HomeDomain", "Library/SMS/sms.db", { required: false }), null);
  await execSqlite(path.join(noMessages, "Manifest.db"), "INSERT INTO Files(fileID,domain,relativePath,flags,file) VALUES('bad','HomeDomain','Library/SMS/bad.db',0,X'');");
  await assert.rejects(() => new IOSBackupManifest(noMessages).lookupFile("HomeDomain", "Library/SMS/bad.db", { required: true }), /fileID/);
  await execSqlite(path.join(noMessages, "Manifest.db"), `INSERT INTO Files(fileID,domain,relativePath,flags,file) VALUES(${sqlString(fileIdFor("HomeDomain", "Library/SMS/missing.db"))},'HomeDomain','Library/SMS/missing.db',0,X'');`);
  assert.equal(await new IOSBackupManifest(noMessages).resolveLogicalPath("HomeDomain", "Library/SMS/missing.db", { required: false }), null);
  try {
    const outside = path.join(tmp, "outside.bin");
    await fs.writeFile(outside, "outside");
    const rec = await addManifestRecord(backup, "HomeDomain", "Library/SMS/Attachments/link/photo.jpg", null, "link");
    await fs.symlink(outside, rec.target);
    await assert.rejects(() => manifest.resolveLogicalPath("HomeDomain", "Library/SMS/Attachments/link/photo.jpg", { required: true }), /escaped/);
  } catch (err) {
    if (err?.code !== "EPERM" && err?.code !== "EACCES") throw err;
  }
}

async function testMessagesParsing(tmp) {
  const backup = await createBackupFixture(tmp, { name: "parse-device" });
  const manifest = new IOSBackupManifest(backup);
  const reader = new IOSMessagesReader();
  const copy = await reader.copySmsDatabase({ manifest, workspaceDir: path.join(tmp, "workspace") });
  assert(await pathExists(path.join(tmp, "workspace", "sms.db-wal")), "WAL sidecar should be copied through Manifest.db");
  const preview = await reader.readPreview(copy.localDbPath);
  assert.equal(preview.databaseFound, true);
  assert.equal(preview.conversationCount, 2);
  assert.equal(preview.messageCount, 5);
  assert(preview.conversations.some((conversation) => conversation.displayName === "Phone ending in 1234"));
  assert(preview.conversations.some((conversation) => conversation.displayName === "Test Group"));
  const selected = preview.conversations.filter((conversation) => conversation.id === "chat:1");
  const imported = await reader.readConversations(copy.localDbPath, selected);
  const conversation = imported.conversations[0];
  assert.equal(conversation.messages.length, 3);
  assert(conversation.messages.some((message) => message.direction === "incoming"));
  assert(conversation.messages.some((message) => message.direction === "outgoing"));
  assert(conversation.messages.some((message) => message.service === "MMS"));
  assert(conversation.messages.some((message) => message.attachments.length === 2));
  const minimalDb = path.join(tmp, "minimal-sms.db");
  await createSmsDb(minimalDb, { minimal: true });
  const minimalPreview = await new IOSMessagesReader().readPreview(minimalDb);
  assert.equal(minimalPreview.messageCount, 1);
  const emptyDb = path.join(tmp, "empty-sms.db");
  await execSqlite(emptyDb, "CREATE TABLE message(ROWID INTEGER PRIMARY KEY, date INTEGER, handle_id INTEGER);");
  const emptyPreview = await new IOSMessagesReader().readPreview(emptyDb);
  assert.equal(emptyPreview.messageCount, 0);
  assert.equal(normalizeAppleTimestamp(appleNs("2026-07-18T23:42:00.000Z")).iso, "2026-07-18T23:42:00.000Z");
  assert.equal(normalizeAppleTimestamp("not-a-date").valid, false);
}

async function testRenderingAndImport(tmp) {
  const backup = await createBackupFixture(tmp, { name: "import-device" });
  const notebookDir = path.join(tmp, "Notebook");
  const cacheDir = path.join(tmp, "Cache");
  await fs.mkdir(notebookDir, { recursive: true });
  const service = createPhoneImportService({ notebookDir, cacheDir, runtimeRoot: tmp }, { exposePrivateState: true });
  const scanStart = service.startScan({ backupPath: backup });
  const scanJob = await waitJob(service, scanStart.jobId);
  assert.equal(scanJob.status, "completed");
  assert.equal(scanJob.result.messages.databaseFound, true);
  assert(scanJob.result.conversations.length >= 2);

  const selectedIds = scanJob.result.conversations.map((conversation) => conversation.id);
  const importStart = service.startImport({ scanId: scanJob.result.scanId, conversationIds: selectedIds, destination: "/Notebook/Imports/Phones", copyAttachments: true, privacyAcknowledged: true });
  const importJob = await waitJob(service, importStart.jobId);
  assert.equal(importJob.status, "completed");
  assert(await pathExists(path.join(notebookDir, importJob.result.indexPath)));
  assert(await pathExists(path.join(notebookDir, importJob.result.reportPath)));
  const conversationHtml = await fs.readFile(path.join(notebookDir, importJob.result.destinationRelativePath, "Messages", "Conversation-001.html"), "utf8");
  assert(conversationHtml.includes("&lt;script&gt;alert(1)&lt;/script&gt;"), "message text should be HTML escaped");
  assert(conversationHtml.includes("[Attachment unavailable]"), "missing attachment should render a placeholder");
  const jsonText = conversationHtml.match(/<script id="nodevision-message-archive" type="application\/json">([\s\S]*?)<\/script>/)[1];
  assert.equal(JSON.parse(jsonText).format, "nodevision-message-archive");
  const manifestPath = path.join(notebookDir, importJob.result.destinationRelativePath, "Source Metadata", "ImportManifest.json");
  const importManifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  assert.equal(importManifest.sourcePlatform, "ios");
  assert(importManifest.nodevisionVersion === null || typeof importManifest.nodevisionVersion === "string");
  assert(importManifest.import.checksums["Conversations.html"]);
  assert(importJob.result.generatedFiles.every((file) => !file.includes("+1555")), "generated filenames should not expose full phone numbers");

  const secondStart = service.startImport({ scanId: scanJob.result.scanId, conversationIds: [selectedIds[0]], destination: "/Notebook/Imports/Phones", privacyAcknowledged: true });
  const secondJob = await waitJob(service, secondStart.jobId);
  assert.equal(secondJob.status, "completed");
  assert.notEqual(secondJob.result.destinationRelativePath, importJob.result.destinationRelativePath, "imports should use collision-safe directories");

  const emptyStart = service.startImport({ scanId: scanJob.result.scanId, conversationIds: [], destination: "/Notebook/Imports/Phones", privacyAcknowledged: true });
  const emptyJob = await waitJob(service, emptyStart.jobId);
  assert.equal(emptyJob.status, "failed");

  await saveSyncProtection({ protectedFromPeerWrites: true }, { runtimeRoot: tmp });
  const protectedStart = service.startImport({ scanId: scanJob.result.scanId, conversationIds: [selectedIds[0]], destination: "/Notebook/ProtectedPhoneImport", privacyAcknowledged: true });
  const protectedJob = await waitJob(service, protectedStart.jobId);
  assert.equal(protectedJob.status, "failed");
  assert.match(protectedJob.message, /protected|writable/i);
  assert.equal(await pathExists(path.join(notebookDir, "ProtectedPhoneImport")), false, "protected import should not expose staged output");
  await saveSyncProtection({ protectedFromPeerWrites: false }, { runtimeRoot: tmp });

  const cancelStart = service.startImport({ scanId: scanJob.result.scanId, conversationIds: [selectedIds[0]], destination: "/Notebook/CancelledPhoneImport", privacyAcknowledged: true });
  service.cancelJob(cancelStart.jobId);
  const cancelJob = await waitJob(service, cancelStart.jobId);
  assert.equal(cancelJob.status, "cancelled");
  assert.equal(await pathExists(path.join(notebookDir, "CancelledPhoneImport")), false, "cancelled import should not expose staged output");

  assert.equal(normalizeIosAttachmentPath("~/Library/SMS/Attachments/aa/photo.jpg"), "Library/SMS/Attachments/aa/photo.jpg");
  assert.equal(normalizeIosAttachmentPath("/etc/passwd"), null);
  assert.equal(safeAttachmentExtension({ filename: "evil.html", mimeType: "text/html" }), ".bin");
  assert.equal(normalizeIosAttachmentPath("~/Library/SMS/Attachments/../secret"), null);
  const rendered = renderConversationHtml({ id: "x", displayName: "Unsafe <b>", participants: [], messages: [{ id: "m", direction: "incoming", senderDisplay: "A", timestamp: "2026-07-18T23:42:00.000Z", text: "<img src=x onerror=alert(1)>", attachments: [] }] });
  assert(rendered.includes("&lt;img src=x onerror=alert(1)&gt;"));
}

async function main() {
  if (!(await sqliteAvailable())) {
    console.log("sqlite3 unavailable; phone import tests skipped");
    return;
  }
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "nodevision-phone-import-test-"));
  await testBackupValidation(path.join(tmp, "validation"));
  await testManifestResolution(path.join(tmp, "manifest"));
  await testMessagesParsing(path.join(tmp, "parsing"));
  await testRenderingAndImport(path.join(tmp, "import"));
  console.log("phone import core tests passed");
}

await main();
