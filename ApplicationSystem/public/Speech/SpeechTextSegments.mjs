// Nodevision/ApplicationSystem/public/Speech/SpeechTextSegments.mjs
// This module segments speech text into source-mapped tokens so speech providers can report boundaries without mixing token parsing into UI or Session code.

const WORD_PATTERN = /[\p{L}\p{N}\p{M}]+(?:['’][\p{L}\p{N}\p{M}]+)*/gu;

export const SPEECH_OFFSET_UNIT = "utf16-code-unit";

export function segmentSpeechText(text = "") {
  const source = String(text ?? "");
  const tokens = [];
  for (const match of source.matchAll(WORD_PATTERN)) {
    const word = match[0];
    tokens.push({
      index: tokens.length,
      word,
      charIndex: match.index,
      charLength: word.length,
      endIndex: match.index + word.length,
    });
  }
  return { text: source, textLength: source.length, offsetUnit: SPEECH_OFFSET_UNIT, tokens };
}

export function tokenAtCharIndex(segments, charIndex) {
  const index = Number(charIndex);
  if (!Number.isFinite(index)) return null;
  return (segments?.tokens || []).find((token) => token.charIndex <= index && index < token.endIndex) || null;
}

export function tokenByProviderIndex(segments, tokenIndex) {
  const index = Number(tokenIndex);
  if (!Number.isInteger(index) || index < 0) return null;
  return (segments?.tokens || [])[index] || null;
}
