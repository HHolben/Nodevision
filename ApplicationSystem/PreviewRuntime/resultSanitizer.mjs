// Nodevision/ApplicationSystem/PreviewRuntime/resultSanitizer.js
// This file defines the result Sanitizer module for the Nodevision ApplicationSystem. It provides helper logic and exports functionality for other modules.
function stripControlChars(text) {
  return String(text || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

function truncateUtf8(text, maxBytes) {
  const buf = Buffer.from(String(text || ''), 'utf8');
  if (buf.length <= maxBytes) return { text: String(text || ''), truncated: false };
  const sliced = buf.subarray(0, maxBytes);
  return { text: sliced.toString('utf8'), truncated: true };
}

export function sanitizeTextForUi(text, { maxBytes }) {
  const stripped = stripControlChars(text);
  const { text: truncated, truncated: didTruncate } = truncateUtf8(stripped, maxBytes);
  return { text: truncated, truncated: didTruncate };
}

export function sanitizeResult(raw, config) {
  const stdout = sanitizeTextForUi(raw?.stdout ?? '', { maxBytes: config.stdoutLimit });
  const stderr = sanitizeTextForUi(raw?.stderr ?? '', { maxBytes: config.stderrLimit });

  return {
    ok: Boolean(raw?.ok),
    language: raw?.language ?? null,
    stdout: stdout.text,
    stderr: stderr.text,
    exitCode: Number.isFinite(raw?.exitCode) ? raw.exitCode : null,
    timedOut: Boolean(raw?.timedOut),
    runner: raw?.runner ?? 'local-dev',
  };
}
