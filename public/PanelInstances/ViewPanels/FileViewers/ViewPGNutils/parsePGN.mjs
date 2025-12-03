//public/PanelInstances/ViewPanels/FileViewers/ViewPGN/parsePGN.mjs

export function parsePGN(text) {
  const lines = text.replace(/\r/g, "").split("\n");
  const headers = {};
  let i = 0;

  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "") { i++; break; }
    const m = line.match(/^\[([A-Za-z0-9_]+)\s+"(.*)"\]$/);
    if (m) {
      headers[m[1]] = m[2];
    } else if (/^\d+\./.test(line)) {
      break;
    }
  }

  const movesText = lines.slice(i).join(" ").trim();
  return { headers, movesText };
}
