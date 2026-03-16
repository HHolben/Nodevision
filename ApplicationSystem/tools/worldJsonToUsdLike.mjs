// Nodevision/ApplicationSystem/tools/worldJsonToUsdLike.mjs
// This file defines a CLI tool that converts Nodevision world JSON content into a USD-like object structure. It reads a world definition from disk and writes a normalized representation back to the source file.
import { readFileSync, writeFileSync } from "node:fs";
import { extname, basename } from "node:path";
import { extractJsonFromHtml, toUsdLike } from "./worldJsonToUsdLike/converter.mjs";

function updateFile(filePath) {
  const raw = readFileSync(filePath, "utf8");
  if (extname(filePath).toLowerCase() === ".html") {
    const extracted = extractJsonFromHtml(raw);
    if (!extracted) throw new Error(`No JSON script tag found in ${filePath}`);
    const jsonText = extracted.jsonText;
    const worldJson = JSON.parse(jsonText);
    const usdLike = toUsdLike(worldJson, basename(filePath));
    const updatedJson = JSON.stringify(usdLike, null, 2);
    const newScript = `<script type="application/json">\\n${updatedJson}\\n    </script>`;
    const before = raw.slice(0, extracted.start);
    const after = raw.slice(extracted.end);
    const updated = `${before}${newScript}${after}`;
    writeFileSync(filePath, updated, "utf8");
    return;
  }

  const worldJson = JSON.parse(raw);
  const usdLike = toUsdLike(worldJson, basename(filePath));
  writeFileSync(filePath, JSON.stringify(usdLike, null, 2), "utf8");
}

const [,, inputPath] = process.argv;
if (!inputPath) {
  console.error("Usage: node tools/worldJsonToUsdLike.mjs <world.html>");
  process.exit(1);
}

updateFile(inputPath);

