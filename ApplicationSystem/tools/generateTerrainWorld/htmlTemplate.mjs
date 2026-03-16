// Nodevision/ApplicationSystem/tools/generateTerrainWorld/htmlTemplate.mjs
// This file defines the HTML document template used by the terrain generator output. It embeds the generated world JSON and escapes user-provided titles safely.

function escapeHtml(input) {
  return String(input)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildHtmlDocument(worldName, worldDefinition) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(worldName)}</title>
</head>
<body>
  <h1>${escapeHtml(worldName)}</h1>
  <p>Procedurally generated terrain world.</p>

  <script type="application/json">
${JSON.stringify(worldDefinition, null, 2)}
  </script>
</body>
</html>
`;
}

