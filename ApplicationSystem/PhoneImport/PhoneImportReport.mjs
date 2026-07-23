// Nodevision/ApplicationSystem/PhoneImport/PhoneImportReport.mjs
// Builds human-readable and machine-readable import reports for Phone Import.

import { escapeHtml, formatHumanDate, jsonForHtmlScript } from "./PhoneImportUtils.mjs";

export function createDeviceInformation(validation = {}) {
  return {
    platform: "ios",
    deviceName: validation.backup?.deviceName || "iPhone Backup",
    productType: validation.backup?.productType || null,
    productVersion: validation.backup?.productVersion || null,
    buildVersion: validation.backup?.buildVersion || null,
    backupDate: validation.backup?.backupDate || null,
    encrypted: validation.encrypted === true,
  };
}

export function createImportManifest({ validation, importedAt, destinationRelativePath, selectedConversationIds, generatedFiles, checksums, warnings, sourceChecksums, nodevisionVersion = null } = {}) {
  return {
    format: "nodevision-phone-import-manifest",
    version: 1,
    sourcePlatform: "ios",
    parserVersion: 1,
    nodevisionVersion,
    source: {
      backupPath: validation?.backupPath || null,
      metadata: createDeviceInformation(validation || {}),
      checksums: sourceChecksums || {},
    },
    import: {
      importedAt,
      destinationRelativePath,
      selectedConversationIds: selectedConversationIds || [],
      generatedFiles: generatedFiles || [],
      checksums: checksums || {},
      warnings: warnings || [],
    },
  };
}

function warningRows(warnings = []) {
  if (!warnings.length) return "<p>No parser or attachment warnings were recorded.</p>";
  return "<ul>" + warnings.map((warning) => "<li><strong>" + escapeHtml(warning.code || warning.reason || "warning") + ":</strong> " + escapeHtml(warning.message || warning.reason || "Warning") + "</li>").join("") + "</ul>";
}

export function renderImportReportHtml({ validation, importedAt, destinationRelativePath, discoveredCount, importedConversations, messagesImported, attachmentsCopied, missingAttachments, warnings, sourceChecksums, result = "completed" } = {}) {
  const device = createDeviceInformation(validation || {});
  const title = "Phone Import Report";
  const data = {
    format: "nodevision-phone-import-report",
    version: 1,
    result,
    source: {
      backupPath: validation?.backupPath || null,
      device,
      checksums: sourceChecksums || {},
    },
    import: {
      importedAt,
      destinationRelativePath,
      discoveredCount,
      importedConversations,
      messagesImported,
      attachmentsCopied,
      missingAttachments,
      warnings,
    },
  };
  return '<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>' + title + '</title>' +
    '<style>body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:24px;max-width:960px;line-height:1.45;}dl{display:grid;grid-template-columns:max-content 1fr;gap:8px 14px;}dt{font-weight:700;}dd{margin:0;}section{border-top:1px solid #ddd;margin-top:18px;padding-top:14px;}code{background:#f5f5f5;padding:1px 4px;border-radius:4px;}</style>' +
    '</head><body><h1>' + title + '</h1>' +
    '<dl>' +
    '<dt>Result</dt><dd>' + escapeHtml(result) + '</dd>' +
    '<dt>Import date</dt><dd>' + escapeHtml(formatHumanDate(importedAt)) + '</dd>' +
    '<dt>Destination</dt><dd><code>' + escapeHtml(destinationRelativePath || "") + '</code></dd>' +
    '<dt>Device</dt><dd>' + escapeHtml(device.deviceName || "iPhone Backup") + '</dd>' +
    '<dt>Model</dt><dd>' + escapeHtml(device.productType || "Unknown") + '</dd>' +
    '<dt>iOS version</dt><dd>' + escapeHtml(device.productVersion || "Unknown") + '</dd>' +
    '<dt>Backup date</dt><dd>' + escapeHtml(formatHumanDate(device.backupDate)) + '</dd>' +
    '<dt>Conversations discovered</dt><dd>' + escapeHtml(String(discoveredCount || 0)) + '</dd>' +
    '<dt>Conversations imported</dt><dd>' + escapeHtml(String(importedConversations || 0)) + '</dd>' +
    '<dt>Messages imported</dt><dd>' + escapeHtml(String(messagesImported || 0)) + '</dd>' +
    '<dt>Attachments copied</dt><dd>' + escapeHtml(String(attachmentsCopied || 0)) + '</dd>' +
    '<dt>Missing attachments</dt><dd>' + escapeHtml(String(missingAttachments || 0)) + '</dd>' +
    '</dl><section><h2>Warnings</h2>' + warningRows(warnings || []) + '</section>' +
    '<script id="nodevision-phone-import-report" type="application/json">\n' + jsonForHtmlScript(data) + '\n</script>' +
    '</body></html>\n';
}

export default { createDeviceInformation, createImportManifest, renderImportReportHtml };
