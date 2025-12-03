export function parseMoves(movesText) {
  if (!movesText) return [];

  let s = movesText
    .replace(/\{[^}]*\}/g, " ")
    .replace(/;[^\n\r]*/g, " ");

  while (/\([^()]*\)/.test(s)) s = s.replace(/\([^()]*\)/g, " ");

  s = s.replace(/\$\d+/g, " ");
  s = s.replace(/\b(1-0|0-1|1\/2-1\/2|\*)\b/g, " ");
  s = s.replace(/\s+/g, " ").trim();

  const tokens = s.split(" ");
  return tokens.filter(t => t && !/^\d+\.+$/.test(t));
}
