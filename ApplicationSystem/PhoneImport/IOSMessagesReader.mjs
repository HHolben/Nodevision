// Nodevision/ApplicationSystem/PhoneImport/IOSMessagesReader.mjs
// Schema-adaptive, read-only parser for a copied iOS Messages sms.db.

import fs from "node:fs/promises";
import path from "node:path";

import { PhoneImportError, PHONE_IMPORT_ERROR_CODES, throwIfCancelled } from "./PhoneImportErrors.mjs";
import {
  chunkArray,
  classifyParticipant,
  normalizeAppleTimestamp,
  quoteIdentifier,
  redactParticipantValue,
  runSqliteJson,
  sha256File,
  sqlIntegerInList,
  sqlIntegerLiteral,
} from "./PhoneImportUtils.mjs";

const KNOWN_TABLES = [
  "message",
  "handle",
  "chat",
  "chat_message_join",
  "chat_handle_join",
  "attachment",
  "message_attachment_join",
];

function createSchemaWarning(code, message, details = {}) {
  return { code, message, ...details };
}

function numericOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function integerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function stringOrNull(value) {
  if (value === null || value === undefined) return null;
  const text = String(value);
  return text.length ? text : null;
}

function normalizeService(value) {
  const text = String(value || "").trim();
  if (!text) return "Unknown";
  if (/^iMessage$/i.test(text)) return "iMessage";
  if (/^SMS$/i.test(text)) return "SMS";
  if (/^MMS$/i.test(text)) return "MMS";
  return text.slice(0, 40);
}

function makeParticipant(raw = {}, fallbackIndex = 0) {
  const value = String(raw.value || "").trim();
  const displayValue = redactParticipantValue(value);
  return {
    id: String(raw.handleId ?? raw.id ?? ("participant-" + fallbackIndex)),
    kind: classifyParticipant(value),
    displayValue,
    normalizedValue: value || null,
    isMe: false,
    service: normalizeService(raw.service),
  };
}

function publicParticipants(participants = []) {
  return participants.map((participant) => participant.displayValue || "Unknown participant");
}

function titleFromRawOrParticipants(rawTitle, participants = []) {
  const title = String(rawTitle || "").trim();
  if (title && !/^chat\d+$/i.test(title)) return redactParticipantValue(title);
  if (participants.length > 1) return "Group conversation";
  if (participants.length === 1) return participants[0].displayValue || "Unknown participant";
  return "Conversation";
}

function hasTable(schema, tableName) {
  return schema.tables.has(tableName);
}

function hasColumn(schema, tableName, columnName) {
  return schema.columns.get(tableName)?.has(columnName) === true;
}

function columnExpr(schema, tableName, columnName, alias, tableAlias = tableName[0], fallback = "NULL") {
  if (hasColumn(schema, tableName, columnName)) {
    return tableAlias + "." + quoteIdentifier(columnName) + " AS " + quoteIdentifier(alias);
  }
  return fallback + " AS " + quoteIdentifier(alias);
}

function firstAvailableColumn(schema, tableName, columns, tableAlias = tableName[0]) {
  for (const column of columns) {
    if (hasColumn(schema, tableName, column)) return tableAlias + "." + quoteIdentifier(column);
  }
  return null;
}

function recordMissingOptionalColumns(schema, tableName, columns, warnings) {
  if (!hasTable(schema, tableName)) return;
  const missing = columns.filter((column) => !hasColumn(schema, tableName, column));
  if (missing.length) {
    warnings.push(createSchemaWarning("missing_optional_columns", "Some optional iOS Messages columns are unavailable.", { table: tableName, columns: missing }));
  }
}

export class IOSMessagesReader {
  constructor(options = {}) {
    this.previewLimit = Number(options.previewLimit || 5000);
    this.warnings = [];
  }

  async inspectSchema(databasePath) {
    const tableRows = await runSqliteJson(databasePath, "SELECT name FROM sqlite_master WHERE type='table';");
    const tables = new Set(tableRows.map((row) => String(row.name || "")).filter(Boolean));
    const columns = new Map();
    for (const tableName of KNOWN_TABLES) {
      if (!tables.has(tableName)) continue;
      const pragmaRows = await runSqliteJson(databasePath, "PRAGMA table_info(" + quoteIdentifier(tableName) + ");");
      columns.set(tableName, new Set(pragmaRows.map((row) => String(row.name || "")).filter(Boolean)));
    }
    const schema = { tables, columns };
    if (!hasTable(schema, "message")) {
      throw new PhoneImportError(PHONE_IMPORT_ERROR_CODES.MESSAGE_SCHEMA_UNSUPPORTED, "Messages database has no message table.", { statusCode: 400 });
    }
    recordMissingOptionalColumns(schema, "message", ["guid", "text", "date", "is_from_me", "service", "handle_id", "subject", "associated_message_guid", "associated_message_type"], this.warnings);
    if (!hasTable(schema, "chat") || !hasTable(schema, "chat_message_join")) {
      this.warnings.push(createSchemaWarning("chat_tables_missing", "Chat tables are missing; importer will group messages by handle when possible."));
    }
    if (!hasTable(schema, "message_attachment_join") || !hasTable(schema, "attachment")) {
      this.warnings.push(createSchemaWarning("attachment_tables_missing", "Attachment tables are missing or incomplete; attachment counts may be zero."));
    }
    return schema;
  }

  async copySmsDatabase({ manifest, workspaceDir }) {
    await fs.mkdir(workspaceDir, { recursive: true, mode: 0o700 });
    const smsRecord = await manifest.resolveMessagesDatabase();
    const localDbPath = path.join(workspaceDir, "sms.db");
    await fs.copyFile(smsRecord.sourcePath, localDbPath);
    await fs.chmod(localDbPath, 0o600).catch(() => {});
    const copiedSidecars = [];
    for (const suffix of ["-wal", "-shm"]) {
      const logical = "Library/SMS/sms.db" + suffix;
      const sidecar = await manifest.resolveLogicalPath("HomeDomain", logical, { required: false });
      if (!sidecar) continue;
      const localSidecarPath = path.join(workspaceDir, "sms.db" + suffix);
      await fs.copyFile(sidecar.sourcePath, localSidecarPath);
      await fs.chmod(localSidecarPath, 0o600).catch(() => {});
      copiedSidecars.push({ logicalPath: logical, localPath: localSidecarPath, size: sidecar.size });
    }
    return {
      sourceRecord: smsRecord,
      localDbPath,
      copiedSidecars,
      sourceSmsDbSha256: await sha256File(localDbPath),
    };
  }

  async readPreview(databasePath, options = {}) {
    const limit = Math.min(Math.max(Number(options.limit || this.previewLimit || 5000), 1), 20000);
    const schema = await this.inspectSchema(databasePath);
    const totalRows = await runSqliteJson(databasePath, "SELECT COUNT(*) AS count FROM message;");
    const messageCount = Number(totalRows[0]?.count || 0);
    const attachmentCount = hasTable(schema, "attachment")
      ? Number((await runSqliteJson(databasePath, "SELECT COUNT(*) AS count FROM attachment;"))[0]?.count || 0)
      : 0;
    let dateRange = { first: null, last: null };
    if (hasColumn(schema, "message", "date")) {
      const rangeRows = await runSqliteJson(databasePath, 'SELECT MIN("date") AS firstRaw, MAX("date") AS lastRaw FROM message;');
      dateRange = {
        first: normalizeAppleTimestamp(rangeRows[0]?.firstRaw).iso,
        last: normalizeAppleTimestamp(rangeRows[0]?.lastRaw).iso,
      };
    }
    const conversations = hasTable(schema, "chat") && hasTable(schema, "chat_message_join")
      ? await this.readChatPreview(databasePath, schema, limit)
      : await this.readHandlePreview(databasePath, schema, limit);
    return {
      databaseFound: true,
      conversationCount: conversations.length,
      messageCount,
      attachmentCount,
      dateRange,
      conversations,
      warnings: [...this.warnings],
    };
  }


  async readChatPreview(databasePath, schema, limit) {
    const titleExpr = firstAvailableColumn(schema, "chat", ["display_name", "chat_identifier"], "c") || "NULL";
    const dateValueExpr = hasColumn(schema, "message", "date") ? 'm."date"' : "NULL";
    const attachmentJoin = hasTable(schema, "message_attachment_join")
      ? " LEFT JOIN message_attachment_join maj ON maj.message_id = m.ROWID"
      : "";
    const attachmentCountExpr = hasTable(schema, "message_attachment_join") ? "COUNT(maj.attachment_id)" : "0";
    const orderExpr = hasColumn(schema, "message", "date") ? "lastDateRaw DESC" : "messageCount DESC";
    const sql = "SELECT c.ROWID AS chatId, " + titleExpr + " AS rawTitle, " +
      "COUNT(DISTINCT m.ROWID) AS messageCount, " + attachmentCountExpr + " AS attachmentCount, " +
      "MIN(" + dateValueExpr + ") AS firstDateRaw, MAX(" + dateValueExpr + ") AS lastDateRaw " +
      "FROM chat c LEFT JOIN chat_message_join cmj ON cmj.chat_id = c.ROWID " +
      "LEFT JOIN message m ON m.ROWID = cmj.message_id" + attachmentJoin + " " +
      "GROUP BY c.ROWID ORDER BY " + orderExpr + " LIMIT " + sqlIntegerLiteral(limit) + ";";
    const rows = await runSqliteJson(databasePath, sql);
    const participantMap = await this.readParticipantsForChats(databasePath, schema, rows.map((row) => row.chatId));
    return rows.map((row, index) => {
      const participants = participantMap.get(Number(row.chatId)) || [];
      const first = normalizeAppleTimestamp(row.firstDateRaw);
      const last = normalizeAppleTimestamp(row.lastDateRaw);
      if (!first.valid && row.firstDateRaw !== null && row.firstDateRaw !== undefined) {
        this.warnings.push(createSchemaWarning("invalid_timestamp", "A conversation has an invalid first message date.", { conversationOrdinal: index + 1 }));
      }
      if (!last.valid && row.lastDateRaw !== null && row.lastDateRaw !== undefined) {
        this.warnings.push(createSchemaWarning("invalid_timestamp", "A conversation has an invalid last message date.", { conversationOrdinal: index + 1 }));
      }
      return {
        id: "chat:" + row.chatId,
        displayName: titleFromRawOrParticipants(row.rawTitle, participants),
        participants: publicParticipants(participants),
        participantDetails: participants,
        messageCount: Number(row.messageCount || 0),
        attachmentCount: Number(row.attachmentCount || 0),
        firstMessageDate: first.iso,
        lastMessageDate: last.iso,
        privateRef: { kind: "chat", chatId: Number(row.chatId) },
      };
    });
  }

  async readParticipantsForChats(databasePath, schema, chatIds) {
    const ids = [...new Set(chatIds.map(Number).filter(Number.isInteger))];
    const map = new Map(ids.map((id) => [id, []]));
    if (!ids.length || !hasTable(schema, "chat_handle_join") || !hasTable(schema, "handle")) return map;
    const handleValueExpr = hasColumn(schema, "handle", "id") ? 'h."id"' : "NULL";
    const serviceExpr = hasColumn(schema, "handle", "service") ? 'h."service"' : "NULL";
    for (const chunk of chunkArray(ids, 300)) {
      const sql = "SELECT chj.chat_id AS chatId, h.ROWID AS handleId, " + handleValueExpr + " AS value, " + serviceExpr + " AS service " +
        "FROM chat_handle_join chj LEFT JOIN handle h ON h.ROWID = chj.handle_id " +
        "WHERE chj.chat_id IN " + sqlIntegerInList(chunk) + " ORDER BY chj.chat_id, h.ROWID;";
      const rows = await runSqliteJson(databasePath, sql);
      for (const row of rows) {
        const chatId = Number(row.chatId);
        if (!map.has(chatId)) map.set(chatId, []);
        map.get(chatId).push(makeParticipant(row, map.get(chatId).length));
      }
    }
    return map;
  }

  async readHandlePreview(databasePath, schema, limit) {
    const handleIdExpr = hasColumn(schema, "message", "handle_id") ? 'm."handle_id"' : "NULL";
    const dateValueExpr = hasColumn(schema, "message", "date") ? 'm."date"' : "NULL";
    const sql = "SELECT " + handleIdExpr + " AS handleId, COUNT(m.ROWID) AS messageCount, " +
      "MIN(" + dateValueExpr + ") AS firstDateRaw, MAX(" + dateValueExpr + ") AS lastDateRaw " +
      "FROM message m GROUP BY " + handleIdExpr + " ORDER BY lastDateRaw DESC LIMIT " + sqlIntegerLiteral(limit) + ";";
    const rows = await runSqliteJson(databasePath, sql);
    const participantMap = await this.readParticipantsForHandles(databasePath, schema, rows.map((row) => row.handleId));
    return rows.map((row, index) => {
      const key = row.handleId === null || row.handleId === undefined ? "unknown" : String(row.handleId);
      const participants = participantMap.get(key) || [];
      const first = normalizeAppleTimestamp(row.firstDateRaw);
      const last = normalizeAppleTimestamp(row.lastDateRaw);
      return {
        id: "handle:" + key,
        displayName: titleFromRawOrParticipants(null, participants),
        participants: publicParticipants(participants),
        participantDetails: participants,
        messageCount: Number(row.messageCount || 0),
        attachmentCount: 0,
        firstMessageDate: first.iso,
        lastMessageDate: last.iso,
        privateRef: { kind: "handle", handleId: integerOrNull(row.handleId) },
        sourceOrdinal: index + 1,
      };
    });
  }

  async readParticipantsForHandles(databasePath, schema, handleIds) {
    const ids = [...new Set(handleIds.map((value) => integerOrNull(value)).filter((value) => value !== null))];
    const map = new Map();
    if (!ids.length || !hasTable(schema, "handle")) return map;
    const valueExpr = hasColumn(schema, "handle", "id") ? 'h."id"' : "NULL";
    const serviceExpr = hasColumn(schema, "handle", "service") ? 'h."service"' : "NULL";
    for (const chunk of chunkArray(ids, 300)) {
      const rows = await runSqliteJson(databasePath, "SELECT h.ROWID AS handleId, " + valueExpr + " AS value, " + serviceExpr + " AS service FROM handle h WHERE h.ROWID IN " + sqlIntegerInList(chunk) + ";");
      for (const row of rows) {
        map.set(String(row.handleId), [makeParticipant(row, 0)]);
      }
    }
    return map;
  }


  async readConversations(databasePath, scanConversations, options = {}) {
    const schema = await this.inspectSchema(databasePath);
    const conversations = [];
    const selected = Array.isArray(scanConversations) ? scanConversations : [];
    let completed = 0;
    for (const preview of selected) {
      throwIfCancelled(options.isCancelled);
      const privateRef = preview.privateRef || parseConversationId(preview.id);
      const messages = privateRef.kind === "chat"
        ? await this.readMessagesForChat(databasePath, schema, privateRef.chatId)
        : await this.readMessagesForHandle(databasePath, schema, privateRef.handleId);
      conversations.push({
        id: preview.id,
        displayName: preview.displayName || "Conversation",
        participants: preview.participantDetails || [],
        messageCount: messages.length,
        attachmentCount: messages.reduce((sum, message) => sum + message.attachments.length, 0),
        firstMessageDate: messages[0]?.timestamp || preview.firstMessageDate || null,
        lastMessageDate: messages[messages.length - 1]?.timestamp || preview.lastMessageDate || null,
        messages,
        sourceMetadata: {
          privateRef,
          scannedMessageCount: preview.messageCount || 0,
          scannedAttachmentCount: preview.attachmentCount || 0,
        },
      });
      completed += 1;
      options.onProgress?.({ conversationsDone: completed, conversationsTotal: selected.length, currentConversation: preview.displayName || preview.id });
    }
    return { conversations, warnings: [...this.warnings] };
  }

  async readMessagesForChat(databasePath, schema, chatId) {
    if (!hasTable(schema, "chat_message_join")) return [];
    const select = buildMessageSelect(schema);
    const joinHandle = hasTable(schema, "handle") && hasColumn(schema, "message", "handle_id")
      ? ' LEFT JOIN handle h ON h.ROWID = m."handle_id"'
      : "";
    const orderExpr = hasColumn(schema, "message", "date") ? 'm."date", m.ROWID' : "m.ROWID";
    const sql = "SELECT " + select.join(", ") + " FROM message m " +
      "JOIN chat_message_join cmj ON cmj.message_id = m.ROWID" + joinHandle + " " +
      "WHERE cmj.chat_id = " + sqlIntegerLiteral(chatId) + " ORDER BY " + orderExpr + ";";
    const rows = await runSqliteJson(databasePath, sql);
    return await this.normalizeMessageRows(databasePath, schema, rows);
  }

  async readMessagesForHandle(databasePath, schema, handleId) {
    const select = buildMessageSelect(schema);
    const hasHandleId = hasColumn(schema, "message", "handle_id");
    const joinHandle = hasTable(schema, "handle") && hasHandleId
      ? ' LEFT JOIN handle h ON h.ROWID = m."handle_id"'
      : "";
    const where = !hasHandleId
      ? "1=1"
      : (handleId === null || handleId === undefined
        ? 'm."handle_id" IS NULL'
        : 'm."handle_id" = ' + sqlIntegerLiteral(handleId));
    const orderExpr = hasColumn(schema, "message", "date") ? 'm."date", m.ROWID' : "m.ROWID";
    const sql = "SELECT " + select.join(", ") + " FROM message m" + joinHandle + " WHERE " + where + " ORDER BY " + orderExpr + ";";
    const rows = await runSqliteJson(databasePath, sql);
    return await this.normalizeMessageRows(databasePath, schema, rows);
  }

  async normalizeMessageRows(databasePath, schema, rows) {
    const attachmentsByMessage = await this.readAttachmentsForMessages(databasePath, schema, rows.map((row) => row.messageRowId));
    return rows.map((row, index) => {
      const ts = normalizeAppleTimestamp(row.dateValue);
      if (!ts.valid && row.dateValue !== null && row.dateValue !== undefined) {
        this.warnings.push(createSchemaWarning("invalid_timestamp", "A message timestamp could not be normalized.", { messageOrdinal: index + 1 }));
      }
      const isFromMe = Number(row.isFromMe || 0) === 1;
      const attachments = attachmentsByMessage.get(Number(row.messageRowId)) || [];
      const text = stringOrNull(row.textValue) || (attachments.length ? "" : "[Unsupported iMessage content]");
      return {
        id: "message:" + row.messageRowId,
        sourceGuid: stringOrNull(row.sourceGuid),
        timestamp: ts.iso,
        originalTimestamp: row.dateValue ?? null,
        timestampMetadata: { epoch: ts.epoch, unit: ts.unit, valid: ts.valid },
        direction: isFromMe ? "outgoing" : "incoming",
        service: normalizeService(row.serviceValue),
        senderId: isFromMe ? "me" : (row.senderHandleId !== null && row.senderHandleId !== undefined ? "handle:" + row.senderHandleId : null),
        senderDisplay: isFromMe ? "Me" : redactParticipantValue(row.senderValue),
        text,
        subject: stringOrNull(row.subjectValue),
        isFromMe,
        associatedMessageGuid: stringOrNull(row.associatedMessageGuid),
        associatedMessageType: row.associatedMessageType ?? null,
        attachments,
        sourceMetadata: {
          messageRowId: row.messageRowId,
          handleId: row.senderHandleId ?? null,
        },
      };
    });
  }

  async readAttachmentsForMessages(databasePath, schema, messageIds) {
    const map = new Map();
    const ids = [...new Set(messageIds.map(Number).filter(Number.isInteger))];
    if (!ids.length || !hasTable(schema, "message_attachment_join") || !hasTable(schema, "attachment")) return map;
    const select = [
      "maj.message_id AS messageRowId",
      "a.ROWID AS attachmentRowId",
      columnExpr(schema, "attachment", "guid", "sourceGuid", "a"),
      columnExpr(schema, "attachment", "filename", "filename", "a"),
      columnExpr(schema, "attachment", "mime_type", "mimeType", "a"),
      columnExpr(schema, "attachment", "transfer_name", "transferName", "a"),
      columnExpr(schema, "attachment", "total_bytes", "totalBytes", "a", "NULL"),
    ];
    for (const chunk of chunkArray(ids, 250)) {
      const sql = "SELECT " + select.join(", ") + " FROM message_attachment_join maj " +
        "LEFT JOIN attachment a ON a.ROWID = maj.attachment_id " +
        "WHERE maj.message_id IN " + sqlIntegerInList(chunk) + " ORDER BY maj.message_id, a.ROWID;";
      const rows = await runSqliteJson(databasePath, sql);
      for (const row of rows) {
        const messageRowId = Number(row.messageRowId);
        if (!map.has(messageRowId)) map.set(messageRowId, []);
        map.get(messageRowId).push({
          id: "attachment:" + row.attachmentRowId,
          sourceGuid: stringOrNull(row.sourceGuid),
          filename: stringOrNull(row.filename),
          mimeType: stringOrNull(row.mimeType),
          transferName: stringOrNull(row.transferName),
          totalBytes: numericOrNull(row.totalBytes),
          sourceMetadata: {
            attachmentRowId: row.attachmentRowId,
            messageRowId,
          },
        });
      }
    }
    return map;
  }
}

function buildMessageSelect(schema) {
  const senderValueExpr = hasTable(schema, "handle") && hasColumn(schema, "handle", "id") ? 'h."id"' : "NULL";
  const senderServiceExpr = hasTable(schema, "handle") && hasColumn(schema, "handle", "service") ? 'h."service"' : "NULL";
  return [
    "m.ROWID AS messageRowId",
    columnExpr(schema, "message", "guid", "sourceGuid", "m"),
    columnExpr(schema, "message", "text", "textValue", "m"),
    columnExpr(schema, "message", "date", "dateValue", "m"),
    columnExpr(schema, "message", "is_from_me", "isFromMe", "m", "0"),
    columnExpr(schema, "message", "service", "serviceValue", "m"),
    columnExpr(schema, "message", "handle_id", "senderHandleId", "m"),
    columnExpr(schema, "message", "subject", "subjectValue", "m"),
    columnExpr(schema, "message", "associated_message_guid", "associatedMessageGuid", "m"),
    columnExpr(schema, "message", "associated_message_type", "associatedMessageType", "m"),
    senderValueExpr + " AS senderValue",
    senderServiceExpr + " AS senderService",
  ];
}

export function parseConversationId(id = "") {
  const text = String(id || "");
  const [kind, raw] = text.split(":");
  if (kind === "chat" && /^\d+$/.test(raw)) return { kind: "chat", chatId: Number(raw) };
  if (kind === "handle") return { kind: "handle", handleId: /^\d+$/.test(raw) ? Number(raw) : null };
  return { kind: "unknown" };
}

export default IOSMessagesReader;
