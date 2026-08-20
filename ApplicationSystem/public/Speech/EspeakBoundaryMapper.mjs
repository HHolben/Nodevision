// Nodevision/ApplicationSystem/public/Speech/EspeakBoundaryMapper.mjs
// This module maps raw eSpeak native word positions onto Nodevision's JavaScript UTF-16 speech-token offsets without trusting one ambiguous native unit.

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function utf8ByteToUtf16Index(text, byteOffset) {
  const target = Number(byteOffset);
  if (!Number.isFinite(target) || target < 0) return null;
  let bytes = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (bytes >= target) return index;
    const codePoint = text.codePointAt(index);
    const char = String.fromCodePoint(codePoint);
    bytes += new TextEncoder().encode(char).length;
    if (codePoint > 0xffff) index += 1;
  }
  return bytes === target ? text.length : null;
}

function codePointToUtf16Index(text, codePointOffset) {
  const target = Number(codePointOffset);
  if (!Number.isFinite(target) || target < 0) return null;
  let points = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (points >= target) return index;
    if (text.codePointAt(index) > 0xffff) index += 1;
    points += 1;
  }
  return points === target ? text.length : null;
}

function candidateOffsets(text, nativePosition) {
  const pos = finite(nativePosition);
  if (pos === null) return [];
  return [
    { charIndex: pos - 1, source: "espeak-character-1-based" },
    { charIndex: pos, source: "espeak-character-0-based" },
    { charIndex: utf8ByteToUtf16Index(text, pos - 1), source: "espeak-utf8-byte-1-based" },
    { charIndex: utf8ByteToUtf16Index(text, pos), source: "espeak-utf8-byte-0-based" },
    { charIndex: codePointToUtf16Index(text, pos - 1), source: "espeak-code-point-1-based" },
    { charIndex: codePointToUtf16Index(text, pos), source: "espeak-code-point-0-based" },
  ].filter((entry, index, all) => (
    Number.isInteger(entry.charIndex) &&
    entry.charIndex >= 0 &&
    entry.charIndex <= text.length &&
    all.findIndex((candidate) => candidate.charIndex === entry.charIndex) === index
  ));
}

function matchingToken(segments, charIndex) {
  return (segments?.tokens || []).find((token) => token.charIndex <= charIndex && charIndex < token.endIndex) || null;
}

export function mapEspeakBoundaryEvent(nativeEvent = {}, segments) {
  const text = segments?.text || "";
  for (const candidate of candidateOffsets(text, nativeEvent.nativeTextPosition)) {
    const token = matchingToken(segments, candidate.charIndex);
    if (!token) continue;
    return {
      ...nativeEvent,
      boundaryKind: nativeEvent.boundaryType || "word",
      charIndex: token.charIndex,
      charLength: token.charLength,
      word: token.word,
      positionSource: candidate.source,
    };
  }
  return {
    ...nativeEvent,
    boundaryKind: nativeEvent.boundaryType || "word",
    charIndex: null,
    charLength: null,
    word: null,
    positionSource: "espeak-unmapped",
  };
}
