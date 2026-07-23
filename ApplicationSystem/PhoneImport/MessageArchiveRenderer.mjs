// Nodevision/ApplicationSystem/PhoneImport/MessageArchiveRenderer.mjs
// Renders normalized phone conversations as readable Nodevision HTML documents.

import { escapeHtml, formatHumanDate, jsonForHtmlScript } from "./PhoneImportUtils.mjs";

function participantSummary(participants = []) {
  const labels = participants.map((participant) => participant.displayValue || participant).filter(Boolean);
  return labels.length ? labels.join(", ") : "Unknown participant";
}

function normalizeJsonConversation(conversation) {
  return {
    id: conversation.id,
    displayName: conversation.displayName,
    participants: conversation.participants || [],
    messages: (conversation.messages || []).map((message) => ({
      id: message.id,
      sourceGuid: message.sourceGuid,
      timestamp: message.timestamp,
      originalTimestamp: message.originalTimestamp,
      timestampMetadata: message.timestampMetadata,
      direction: message.direction,
      service: message.service,
      senderId: message.senderId,
      senderDisplay: message.senderDisplay,
      text: message.text,
      subject: message.subject,
      isFromMe: message.isFromMe,
      associatedMessageGuid: message.associatedMessageGuid,
      associatedMessageType: message.associatedMessageType,
      attachments: (message.attachments || []).map((attachment) => ({
        id: attachment.id,
        sourceGuid: attachment.sourceGuid,
        filename: attachment.filename || null,
        mimeType: attachment.mimeType || null,
        totalBytes: attachment.totalBytes ?? attachment.bytes ?? null,
        relativePath: attachment.relativePath || null,
        checksum: attachment.checksum || null,
        unavailable: attachment.unavailable === true,
        reason: attachment.reason || null,
        sourceMetadata: attachment.sourceMetadata || {},
      })),
      sourceMetadata: message.sourceMetadata || {},
    })),
    sourceMetadata: conversation.sourceMetadata || {},
  };
}

function renderAttachmentList(attachments = []) {
  if (!attachments.length) return "";
  const items = attachments.map((attachment) => {
    if (attachment.unavailable || !attachment.relativePath) {
      return '<li class="nodevision-message-attachment missing">[Attachment unavailable]</li>';
    }
    const label = attachment.mimeType || attachment.filename || "Attachment";
    return '<li class="nodevision-message-attachment"><a rel="noopener" href="' + escapeHtml(attachment.relativePath) + '">' + escapeHtml(label) + '</a></li>';
  }).join("\n");
  return '<ul class="nodevision-message-attachments">' + items + '</ul>';
}

function renderMessage(message) {
  const directionClass = message.direction === "outgoing" ? "outgoing" : "incoming";
  const text = message.text || ((message.attachments || []).length ? "" : "[Unsupported iMessage content]");
  const time = message.timestamp || "";
  const body = text ? '<p class="message-text">' + escapeHtml(text) + '</p>' : "";
  const subject = message.subject ? '<p class="message-subject">' + escapeHtml(message.subject) + '</p>' : "";
  return [
    '<section class="nodevision-message ' + directionClass + '" data-message-id="' + escapeHtml(message.id || "") + '">',
    "  <header>",
    '    <span class="sender">' + escapeHtml(message.senderDisplay || (message.isFromMe ? "Me" : "Unknown participant")) + '</span>',
    '    <time datetime="' + escapeHtml(time) + '">' + escapeHtml(formatHumanDate(time)) + '</time>',
    "  </header>",
    subject,
    body,
    renderAttachmentList(message.attachments || []),
    "</section>",
  ].filter(Boolean).join("\n");
}

export function renderConversationHtml(conversation, options = {}) {
  const title = "Conversation with " + (conversation.displayName || "Unknown participant");
  const metadata = {
    format: "nodevision-message-archive",
    version: 1,
    source: {
      platform: "ios",
      importedAt: options.importedAt || new Date().toISOString(),
    },
    conversation: normalizeJsonConversation(conversation),
  };
  const messages = (conversation.messages || []).map(renderMessage).join("\n\n");
  return '<!DOCTYPE html>\n' +
    '<html>\n<head>\n  <meta charset="utf-8">\n' +
    '  <title>' + escapeHtml(title) + '</title>\n' +
    '  <style>\n' +
    '    body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.45;margin:24px;max-width:920px;}\n' +
    '    .nodevision-message-archive>header{border-bottom:1px solid #ddd;margin-bottom:16px;padding-bottom:12px;}\n' +
    '    .nodevision-message{border:1px solid #ddd;border-radius:8px;margin:10px 0;padding:10px 12px;background:#fff;}\n' +
    '    .nodevision-message.outgoing{background:#eef7ff;border-color:#bedcf5;margin-left:10%;}\n' +
    '    .nodevision-message.incoming{background:#f8f8f8;margin-right:10%;}\n' +
    '    .nodevision-message header{display:flex;gap:10px;justify-content:space-between;color:#555;font-size:.88rem;}\n' +
    '    .sender{font-weight:650;color:#222;}\n' +
    '    .message-text{white-space:pre-wrap;margin:.55rem 0 0;}\n' +
    '    .nodevision-message-attachments{margin:.55rem 0 0;padding-left:1.2rem;}\n' +
    '    .missing{color:#8a4a00;}\n' +
    '  </style>\n' +
    '</head>\n<body>\n' +
    '<article class="nodevision-message-archive">\n' +
    '  <header>\n' +
    '    <h1>' + escapeHtml(title) + '</h1>\n' +
    '    <p>Participants: ' + escapeHtml(participantSummary(conversation.participants || [])) + '</p>\n' +
    '  </header>\n\n' +
    messages + '\n' +
    '</article>\n\n' +
    '<script id="nodevision-message-archive" type="application/json">\n' + jsonForHtmlScript(metadata) + '\n</script>\n' +
    '</body>\n</html>\n';
}

export function renderConversationsIndexHtml(entries = [], options = {}) {
  const rows = entries.map((entry) => '<tr><td><a href="' + escapeHtml(entry.relativeHref) + '">' + escapeHtml(entry.title) + '</a></td><td>' + escapeHtml(String(entry.messageCount || 0)) + '</td><td>' + escapeHtml(String(entry.attachmentCount || 0)) + '</td><td>' + escapeHtml(formatHumanDate(entry.lastMessageDate)) + '</td></tr>').join("\n");
  const title = "Imported Phone Conversations";
  return '<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>' + title + '</title>' +
    '<style>body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:24px;max-width:960px;}table{border-collapse:collapse;width:100%;}th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left;}th{background:#f4f4f4;}</style>' +
    '</head><body><h1>' + title + '</h1><p>Imported at ' + escapeHtml(formatHumanDate(options.importedAt)) + '</p>' +
    '<table><thead><tr><th>Conversation</th><th>Messages</th><th>Attachments</th><th>Last message</th></tr></thead><tbody>' + rows + '</tbody></table></body></html>\n';
}

export default { renderConversationHtml, renderConversationsIndexHtml };
