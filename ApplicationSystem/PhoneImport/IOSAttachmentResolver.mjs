// Nodevision/ApplicationSystem/PhoneImport/IOSAttachmentResolver.mjs
// Resolves and copies message attachments from backup manifest records into staged Notebook output.

import fs from "node:fs/promises";
import path from "node:path";

import { assertInside, detectAttachmentExtension, sanitizePathComponent, sha256File, uniqueName } from "./PhoneImportUtils.mjs";

function normalizeIosAttachmentPath(value = "") {
  let text = String(value || "").replace(/\\/g, "/").replace(/\0/g, "").trim();
  if (!text) return null;
  text = text.replace(/^file:\/\//i, "");
  text = text.replace(/^~\//, "");
  text = text.replace(/^\/private\/var\/mobile\//i, "");
  text = text.replace(/^\/var\/mobile\//i, "");
  text = text.replace(/^HomeDomain\//i, "");
  text = text.replace(/^\/+/, "");
  const parts = text.split("/").filter(Boolean);
  if (parts.includes("..")) return null;
  const normalized = parts.join("/");
  if (!/^Library\/SMS\/Attachments\//i.test(normalized)) return null;
  return normalized;
}

function attachmentSourceName(attachment = {}) {
  return attachment.filename || attachment.transferName || attachment.sourceGuid || attachment.id || "Attachment";
}

export class IOSAttachmentResolver {
  constructor({ manifest, attachmentsDir, attachmentsRelativeFromMessages = "Attachments" } = {}) {
    this.manifest = manifest;
    this.attachmentsDir = attachmentsDir;
    this.attachmentsRelativeFromMessages = attachmentsRelativeFromMessages;
    this.usedNames = new Set();
    this.warnings = [];
    this.copied = [];
  }

  async copyAttachment(attachment = {}, context = {}) {
    const logicalPath = normalizeIosAttachmentPath(attachment.filename || attachment.transferName || "");
    if (!logicalPath) {
      return this.recordUnavailable(attachment, "unsafe_or_missing_attachment_path", "Attachment path is missing or outside the SMS attachments folder.");
    }

    const resolved = await this.manifest.resolveLogicalPath("HomeDomain", logicalPath, { required: false });
    if (!resolved?.sourcePath) {
      return this.recordUnavailable(attachment, "manifest_record_missing", "Attachment could not be resolved through Manifest.db.", logicalPath);
    }

    await fs.mkdir(this.attachmentsDir, { recursive: true, mode: 0o700 });
    const ext = await detectAttachmentExtension(resolved.sourcePath, { filename: attachmentSourceName(attachment), mimeType: attachment.mimeType });
    const base = sanitizePathComponent(
      "Attachment-" + String(context.conversationIndex || 1).padStart(3, "0") + "-" + String(context.attachmentIndex || 1).padStart(4, "0"),
      "Attachment",
      64,
    );
    const filename = uniqueName(base + ext, this.usedNames);
    const targetPath = path.join(this.attachmentsDir, filename);
    assertInside(this.attachmentsDir, targetPath, "Attachment target escaped the import destination.");
    await fs.copyFile(resolved.sourcePath, targetPath);
    await fs.chmod(targetPath, 0o600).catch(() => {});
    const checksum = await sha256File(targetPath);
    const copied = {
      ok: true,
      id: attachment.id || null,
      sourceGuid: attachment.sourceGuid || null,
      logicalPath,
      filename,
      relativePath: this.attachmentsRelativeFromMessages + "/" + filename,
      checksum,
      bytes: resolved.size ?? null,
      mimeType: attachment.mimeType || null,
      sourceMetadata: {
        ...attachment.sourceMetadata,
        backupDomain: "HomeDomain",
        backupRelativePath: logicalPath,
        sourceFileID: resolved.fileID || null,
      },
    };
    this.copied.push(copied);
    return copied;
  }

  recordUnavailable(attachment, reason, message, logicalPath = null) {
    const warning = {
      code: "attachment_unavailable",
      reason,
      message,
      logicalPath,
      attachmentId: attachment?.id || null,
      sourceGuid: attachment?.sourceGuid || null,
    };
    this.warnings.push(warning);
    return {
      ok: false,
      unavailable: true,
      reason,
      message,
      logicalPath,
      id: attachment?.id || null,
      sourceGuid: attachment?.sourceGuid || null,
      mimeType: attachment?.mimeType || null,
      sourceMetadata: attachment?.sourceMetadata || {},
    };
  }

  getWarnings() {
    return [...this.warnings];
  }

  getCopiedAttachments() {
    return [...this.copied];
  }
}

export { normalizeIosAttachmentPath };
export default IOSAttachmentResolver;
