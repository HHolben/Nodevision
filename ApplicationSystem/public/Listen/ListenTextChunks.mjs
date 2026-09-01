// Nodevision/ApplicationSystem/public/Listen/ListenTextChunks.mjs
// This module selects speech-sized text slices from rendered page text so Nodevision can read long HTML and PDF pages without overloading a single utterance.

export const LISTEN_UTTERANCE_MAX_LENGTH = 80000;

// Chunk selection.
function boundedOffset(text, offset) {
  return Math.max(0, Math.min(text.length, Number(offset) || 0));
}

function skipLeadingWhitespace(text, offset) {
  let cursor = offset;
  while (cursor < text.length && /\s/u.test(text.charAt(cursor))) cursor += 1;
  return cursor;
}

function boundaryEndWithin(slice, minimum) {
  let best = -1;
  const boundaryPattern = /(?:\n\s*\n|\r?\n|[.!?;:]\s+|,\s+|\s+)/gu;
  for (const match of slice.matchAll(boundaryPattern)) {
    const end = match.index + match[0].length;
    if (end >= minimum) best = end;
  }
  return best;
}

function trimTrailingWhitespace(text, start, end) {
  let cursor = end;
  while (cursor > start && /\s/u.test(text.charAt(cursor - 1))) cursor -= 1;
  return cursor > start ? cursor : end;
}

export function nextListenSpeechChunk(value = "", offset = 0, maxLength = LISTEN_UTTERANCE_MAX_LENGTH) {
  const text = String(value || "");
  const limit = Math.max(1, Math.min(LISTEN_UTTERANCE_MAX_LENGTH, Number(maxLength) || LISTEN_UTTERANCE_MAX_LENGTH));
  const start = skipLeadingWhitespace(text, boundedOffset(text, offset));
  if (start >= text.length) return { start, end: start, text: "" };

  const hardEnd = Math.min(text.length, start + limit);
  if (hardEnd >= text.length) return { start, end: text.length, text: text.slice(start) };

  const slice = text.slice(start, hardEnd);
  const preferredEnd = boundaryEndWithin(slice, Math.floor(limit * 0.6));
  const end = trimTrailingWhitespace(text, start, start + (preferredEnd > 0 ? preferredEnd : slice.length));
  return { start, end, text: text.slice(start, end) };
}
