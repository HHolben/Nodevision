// Nodevision/ApplicationSystem/public/Gerber/test-gerber-parser.mjs
// Focused parser smoke tests for Gerber and Excellon board files.

import assert from "node:assert/strict";
import { createStarterBoardSource, formatBoardSummary, parseBoardFile, parseExcellon, parseGerber } from "./GerberParser.mjs";

const gerberSource = `%FSLAX24Y24*%
%MOMM*%
%ADD10C,0.2000*%
%ADD11R,0.5000X0.3000*%
D10*
X000000Y000000D02*
X010000Y000000D01*
X010000Y010000D01*
D11*
X005000Y005000D03*
M02*`;

const gerber = parseGerber(gerberSource, "top.gtl");
assert.equal(gerber.kind, "gerber");
assert.equal(gerber.units, "mm");
assert.equal(gerber.stats.segments, 2);
assert.equal(gerber.stats.flashes, 1);
assert.equal(gerber.stats.apertures, 2);
assert.equal(gerber.shapes[0].x2, 1);
assert.equal(gerber.shapes[1].y2, 1);
assert.equal(gerber.shapes[2].aperture.shape, "R");

const drillSource = `M48
METRIC,LZ
T01C0.800
%
T01
X001000Y002000
X002500Y003000
M30`;

const drill = parseExcellon(drillSource, "holes.drl");
assert.equal(drill.kind, "excellon");
assert.equal(drill.units, "mm");
assert.equal(drill.stats.drills, 2);
assert.equal(drill.stats.tools, 1);
assert.equal(drill.shapes[0].diameter, 0.8);
assert.equal(drill.shapes[0].x, 1);
assert.equal(drill.shapes[0].y, 2);

assert.equal(parseBoardFile(drillSource, "holes.drl").kind, "excellon");
assert.equal(parseBoardFile(gerberSource, "top.gbr").kind, "gerber");

const emptyGerber = parseBoardFile("", "blank.gtl");
assert.equal(emptyGerber.kind, "gerber");
assert.equal(emptyGerber.sourceEmpty, true);
assert.equal(emptyGerber.bounds.empty, true);
assert.equal(emptyGerber.stats.commands, 0);
assert.equal(formatBoardSummary(emptyGerber), "empty gerber | mm");
assert.equal(createStarterBoardSource("blank.gtl").startsWith("%FSLAX24Y24*%"), true);

const emptyDrill = parseBoardFile("", "blank.drl");
assert.equal(emptyDrill.kind, "excellon");
assert.equal(emptyDrill.sourceEmpty, true);
assert.equal(emptyDrill.bounds.empty, true);
assert.equal(emptyDrill.stats.commands, 0);
assert.equal(createStarterBoardSource("blank.drl").startsWith("M48"), true);

console.log("Gerber parser tests passed");
