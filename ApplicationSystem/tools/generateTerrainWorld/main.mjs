// Nodevision/ApplicationSystem/tools/generateTerrainWorld/main.mjs
// This file defines the entry logic for terrain world generation. It parses CLI parameters, generates a deterministic world, and writes the output HTML file.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs } from "./cli.mjs";
import { createSeededRandom } from "./random.mjs";
import { buildTerrainWorld } from "./worldBuilder.mjs";
import { buildHtmlDocument } from "./htmlTemplate.mjs";

export function main(argv = process.argv.slice(2)) {
  const params = parseArgs(argv);
  createSeededRandom(params.seed)();
  const world = buildTerrainWorld(params);
  const html = buildHtmlDocument(params.worldName, world);
  const outputPath = resolve(params.output);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, html, "utf8");
  console.log(`Generated terrain world: ${outputPath}`);
  console.log(`Tiles: ${params.tiles} x ${params.tiles} (${params.tiles * params.tiles} total)`);
}

