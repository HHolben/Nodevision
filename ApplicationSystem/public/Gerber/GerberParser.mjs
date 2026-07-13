// Nodevision/ApplicationSystem/public/Gerber/GerberParser.mjs
// Shared Gerber RS-274X and Excellon drill parsing helpers for viewer/editor panels.

const GERBER_DEFAULT_FORMAT = {
  zeroSuppression: "L",
  coordinateMode: "A",
  xInteger: 2,
  xDecimal: 4,
  yInteger: 2,
  yDecimal: 4,
};

const EXCELLON_DEFAULT_FORMAT = {
  zeroSuppression: "L",
  xInteger: 2,
  xDecimal: 4,
  yInteger: 2,
  yDecimal: 4,
};

const DEFAULT_APERTURE_MM = 0.25;
const DEFAULT_APERTURE_IN = 0.01;
const DEFAULT_DRILL_MM = 0.8;
const DEFAULT_DRILL_IN = 0.031;

function cleanNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cloneFormat(format) {
  return { ...format };
}

function normalizeExtension(filePath = "") {
  const clean = String(filePath || "").toLowerCase().replace(/[?#].*$/, "");
  const last = clean.split("/").pop() || clean;
  return last.includes(".") ? last.split(".").pop() : "";
}

export function isBoardSourceEmpty(source = "") {
  return String(source || "").trim().length === 0;
}

export function detectBoardFileKind(filePath = "", source = "") {
  const ext = normalizeExtension(filePath);
  if (ext === "drl" || ext === "xln" || ext === "excellon") return "excellon";
  if (ext === "gtl" || ext === "gbr" || ext === "ger" || ext === "pho") return "gerber";

  const head = String(source || "").slice(0, 800).toUpperCase();
  if (/\bM48\b/.test(head) || /\bMETRIC\b/.test(head) || /\bINCH\b/.test(head)) {
    return "excellon";
  }
  return "gerber";
}

function addDiagnostic(model, severity, message, line = null) {
  model.diagnostics.push({ severity, message, line });
}

function tokenizeGerber(source) {
  const tokens = [];
  const text = String(source || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  let buffer = "";
  let line = 1;
  let tokenLine = 1;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (!buffer) tokenLine = line;

    if (char === "*") {
      const value = buffer.trim().replace(/%/g, "").trim();
      if (value) tokens.push({ value, line: tokenLine });
      buffer = "";
    } else {
      buffer += char;
    }

    if (char === "\n") line += 1;
  }

  const trailing = buffer.trim().replace(/%/g, "").trim();
  if (trailing) tokens.push({ value: trailing, line: tokenLine });
  return tokens;
}

function parseFormattedCoordinate(rawValue, axis, format) {
  if (rawValue === undefined || rawValue === null || rawValue === "") return null;
  const raw = String(rawValue).trim();
  if (!raw) return null;
  if (raw.includes(".")) return cleanNumber(raw, 0);

  const negative = raw.startsWith("-");
  const positive = raw.startsWith("+");
  let digits = negative || positive ? raw.slice(1) : raw;
  digits = digits.replace(/[^0-9]/g, "");
  if (!digits) return 0;

  const integerDigits = axis === "x" ? format.xInteger : format.yInteger;
  const decimalDigits = axis === "x" ? format.xDecimal : format.yDecimal;
  const total = integerDigits + decimalDigits;

  if (digits.length < total) {
    digits = format.zeroSuppression === "T"
      ? digits.padEnd(total, "0")
      : digits.padStart(total, "0");
  }

  const intPart = decimalDigits > 0 ? digits.slice(0, -decimalDigits) || "0" : digits;
  const fracPart = decimalDigits > 0 ? digits.slice(-decimalDigits) : "";
  const value = cleanNumber(`${intPart}.${fracPart}`, 0);
  return negative ? -value : value;
}

function coordinatePairs(token, format) {
  const coords = {};
  const regex = /([XYIJ])([+-]?(?:\d+(?:\.\d*)?|\.\d+))/gi;
  let match;
  while ((match = regex.exec(token)) !== null) {
    const axis = match[1].toUpperCase();
    const formatAxis = axis === "Y" || axis === "J" ? "y" : "x";
    coords[axis] = parseFormattedCoordinate(match[2], formatAxis, format);
  }
  return coords;
}

function makeAperture(code, shape, params, units) {
  const upperShape = String(shape || "C").toUpperCase();
  const values = String(params || "")
    .split(/[Xx]/)
    .map((value) => cleanNumber(value, 0))
    .filter((value) => Number.isFinite(value) && value > 0);
  const fallback = units === "in" ? DEFAULT_APERTURE_IN : DEFAULT_APERTURE_MM;

  if (upperShape === "R") {
    return {
      code,
      shape: "R",
      width: values[0] || fallback,
      height: values[1] || values[0] || fallback,
    };
  }

  if (upperShape === "O") {
    return {
      code,
      shape: "O",
      width: values[0] || fallback,
      height: values[1] || values[0] || fallback,
    };
  }

  return {
    code,
    shape: upperShape === "C" ? "C" : upperShape,
    diameter: values[0] || fallback,
    width: values[0] || fallback,
    height: values[0] || fallback,
  };
}

function apertureStrokeWidth(aperture, units) {
  const fallback = units === "in" ? DEFAULT_APERTURE_IN : DEFAULT_APERTURE_MM;
  if (!aperture) return fallback;
  if (Number.isFinite(aperture.diameter) && aperture.diameter > 0) return aperture.diameter;
  return Math.max(aperture.width || 0, aperture.height || 0, fallback);
}

function activeAperture(state) {
  if (state.currentAperture && state.apertures[state.currentAperture]) {
    return state.apertures[state.currentAperture];
  }
  return makeAperture("D00", "C", state.units === "in" ? DEFAULT_APERTURE_IN : DEFAULT_APERTURE_MM, state.units);
}

function pointBounds(bounds, x, y, pad = 0) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  bounds.minX = Math.min(bounds.minX, x - pad);
  bounds.maxX = Math.max(bounds.maxX, x + pad);
  bounds.minY = Math.min(bounds.minY, y - pad);
  bounds.maxY = Math.max(bounds.maxY, y + pad);
}

function computeBounds(shapes) {
  const bounds = {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };

  for (const shape of shapes) {
    const pad = (shape.width || shape.diameter || Math.max(shape.aperture?.width || 0, shape.aperture?.height || 0, 0)) / 2;
    if (shape.type === "segment" || shape.type === "slot") {
      pointBounds(bounds, shape.x1, shape.y1, pad);
      pointBounds(bounds, shape.x2, shape.y2, pad);
    } else if (shape.type === "arc") {
      for (const point of shape.points || []) pointBounds(bounds, point.x, point.y, pad);
    } else if (shape.type === "flash" || shape.type === "drill") {
      pointBounds(bounds, shape.x, shape.y, pad);
    } else if (shape.type === "region") {
      for (const point of shape.points || []) pointBounds(bounds, point.x, point.y, 0);
    }
  }

  if (!Number.isFinite(bounds.minX)) {
    return { minX: 0, minY: 0, maxX: 1, maxY: 1, width: 1, height: 1, empty: true };
  }

  bounds.width = Math.max(bounds.maxX - bounds.minX, 0);
  bounds.height = Math.max(bounds.maxY - bounds.minY, 0);
  bounds.empty = false;
  return bounds;
}

function shapeSummary(shapes) {
  const summary = {
    segments: 0,
    arcs: 0,
    flashes: 0,
    regions: 0,
    drills: 0,
    slots: 0,
  };

  for (const shape of shapes) {
    if (shape.type === "segment") summary.segments += 1;
    if (shape.type === "arc") summary.arcs += 1;
    if (shape.type === "flash") summary.flashes += 1;
    if (shape.type === "region") summary.regions += 1;
    if (shape.type === "drill") summary.drills += 1;
    if (shape.type === "slot") summary.slots += 1;
  }

  return summary;
}

function buildArcPoints(start, end, offset, clockwise) {
  const center = { x: start.x + offset.i, y: start.y + offset.j };
  const radius = Math.hypot(start.x - center.x, start.y - center.y);
  if (!Number.isFinite(radius) || radius <= 0) return [start, end];

  const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
  const endAngle = Math.atan2(end.y - center.y, end.x - center.x);
  let delta = endAngle - startAngle;

  if (clockwise) {
    while (delta >= 0) delta -= Math.PI * 2;
  } else {
    while (delta <= 0) delta += Math.PI * 2;
  }

  const steps = Math.max(8, Math.min(96, Math.ceil(Math.abs(delta) * Math.max(radius, 1) * 6)));
  const points = [];
  for (let step = 0; step <= steps; step += 1) {
    const angle = startAngle + (delta * step) / steps;
    points.push({
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    });
  }
  return points;
}

function parseGerberFormat(token, model) {
  const match = token.match(/^FS([LT])([AI])X(\d)(\d)Y(\d)(\d)/i);
  if (!match) return null;
  return {
    zeroSuppression: match[1].toUpperCase(),
    coordinateMode: match[2].toUpperCase(),
    xInteger: Number.parseInt(match[3], 10),
    xDecimal: Number.parseInt(match[4], 10),
    yInteger: Number.parseInt(match[5], 10),
    yDecimal: Number.parseInt(match[6], 10),
  };
}

export function parseGerber(source, filePath = "") {
  const sourceEmpty = isBoardSourceEmpty(source);
  const model = {
    kind: "gerber",
    filePath,
    sourceEmpty,
    units: "mm",
    format: cloneFormat(GERBER_DEFAULT_FORMAT),
    apertures: {},
    shapes: [],
    diagnostics: [],
    bounds: null,
    stats: null,
  };

  const state = {
    x: 0,
    y: 0,
    units: "mm",
    currentAperture: null,
    interpolation: "linear",
    polarity: "dark",
    inRegion: false,
    regionPoints: [],
    apertures: model.apertures,
  };

  const tokens = tokenizeGerber(source);
  for (const { value, line } of tokens) {
    const token = value.replace(/\s+/g, "");
    const upper = token.toUpperCase();
    if (!upper || upper === "%") continue;
    if (upper.startsWith("G04")) continue;

    if (upper.startsWith("FS")) {
      const format = parseGerberFormat(upper, model);
      if (format) model.format = format;
      else addDiagnostic(model, "warning", `Unsupported format statement: ${value}`, line);
      continue;
    }

    if (upper.startsWith("MO")) {
      if (upper.includes("IN")) {
        model.units = "in";
        state.units = "in";
      } else if (upper.includes("MM")) {
        model.units = "mm";
        state.units = "mm";
      }
      continue;
    }

    if (upper.startsWith("LP")) {
      state.polarity = upper.includes("C") ? "clear" : "dark";
      continue;
    }

    if (upper.startsWith("AD")) {
      const match = upper.match(/^ADD(\d+)([A-Z][A-Z0-9]*)(?:,(.+))?$/);
      if (!match) {
        addDiagnostic(model, "warning", `Unsupported aperture definition: ${value}`, line);
        continue;
      }
      const code = `D${Number.parseInt(match[1], 10)}`;
      model.apertures[code] = makeAperture(code, match[2], match[3] || "", model.units);
      continue;
    }

    if (upper.startsWith("AM") || upper.startsWith("SR")) {
      addDiagnostic(model, "info", `Macro or step-repeat statement was not expanded: ${value}`, line);
      continue;
    }

    if (/G0?1/.test(upper)) state.interpolation = "linear";
    if (/G0?2/.test(upper)) state.interpolation = "clockwise";
    if (/G0?3/.test(upper)) state.interpolation = "counterclockwise";

    if (/G36/.test(upper)) {
      state.inRegion = true;
      state.regionPoints = [];
      continue;
    }

    if (/G37/.test(upper)) {
      if (state.regionPoints.length >= 2) {
        model.shapes.push({
          type: "region",
          points: [...state.regionPoints],
          polarity: state.polarity,
          line,
        });
      }
      state.inRegion = false;
      state.regionPoints = [];
      continue;
    }

    const selectMatch = upper.match(/(?:^|G54)D(\d+)$/);
    if (selectMatch && Number.parseInt(selectMatch[1], 10) > 3) {
      state.currentAperture = `D${Number.parseInt(selectMatch[1], 10)}`;
      if (!model.apertures[state.currentAperture]) {
        model.apertures[state.currentAperture] = makeAperture(state.currentAperture, "C", "", model.units);
      }
      continue;
    }

    const coords = coordinatePairs(upper, model.format);
    const hasPosition = coords.X !== undefined || coords.Y !== undefined;
    const hasOffset = coords.I !== undefined || coords.J !== undefined;
    const opMatch = upper.match(/D0?([123])(?=$|[^0-9])/);
    const op = opMatch ? Number.parseInt(opMatch[1], 10) : (hasPosition ? 1 : null);

    if (!hasPosition && !hasOffset && op === null) {
      const apertureMatches = [...upper.matchAll(/D(\d+)/g)]
        .map((match) => Number.parseInt(match[1], 10))
        .filter((code) => code > 3);
      if (apertureMatches.length) {
        state.currentAperture = `D${apertureMatches[apertureMatches.length - 1]}`;
      }
      continue;
    }

    const next = { x: state.x, y: state.y };
    if (coords.X !== undefined) next.x = model.format.coordinateMode === "I" ? state.x + coords.X : coords.X;
    if (coords.Y !== undefined) next.y = model.format.coordinateMode === "I" ? state.y + coords.Y : coords.Y;

    if (op === 2) {
      state.x = next.x;
      state.y = next.y;
      if (state.inRegion) state.regionPoints.push({ x: next.x, y: next.y });
      continue;
    }

    const aperture = activeAperture(state);
    const width = apertureStrokeWidth(aperture, model.units);

    if (op === 3) {
      model.shapes.push({
        type: "flash",
        x: next.x,
        y: next.y,
        aperture,
        width,
        polarity: state.polarity,
        line,
      });
      state.x = next.x;
      state.y = next.y;
      continue;
    }

    if (op === 1) {
      const start = { x: state.x, y: state.y };
      const end = { x: next.x, y: next.y };

      if (state.inRegion) {
        if (!state.regionPoints.length) state.regionPoints.push(start);
        state.regionPoints.push(end);
      } else if (state.interpolation === "clockwise" || state.interpolation === "counterclockwise") {
        const points = buildArcPoints(start, end, {
          i: coords.I || 0,
          j: coords.J || 0,
        }, state.interpolation === "clockwise");
        model.shapes.push({
          type: "arc",
          points,
          x1: start.x,
          y1: start.y,
          x2: end.x,
          y2: end.y,
          width,
          aperture,
          clockwise: state.interpolation === "clockwise",
          polarity: state.polarity,
          line,
        });
      } else {
        model.shapes.push({
          type: "segment",
          x1: start.x,
          y1: start.y,
          x2: end.x,
          y2: end.y,
          width,
          aperture,
          polarity: state.polarity,
          line,
        });
      }

      state.x = next.x;
      state.y = next.y;
    }
  }

  model.bounds = computeBounds(model.shapes);
  model.stats = {
    ...shapeSummary(model.shapes),
    apertures: Object.keys(model.apertures).length,
    commands: tokens.length,
  };
  return model;
}

function parseExcellonCoordinate(rawValue, axis, format) {
  return parseFormattedCoordinate(rawValue, axis, format);
}

function parseExcellonCoords(line, format) {
  const coords = {};
  const regex = /([XY])([+-]?(?:\d+(?:\.\d*)?|\.\d+))/gi;
  let match;
  while ((match = regex.exec(line)) !== null) {
    const axis = match[1].toUpperCase();
    coords[axis] = parseExcellonCoordinate(match[2], axis.toLowerCase(), format);
  }
  return coords;
}

function normalizeToolCode(value) {
  const number = Number.parseInt(String(value || "").replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(number) ? `T${number}` : `T${value}`;
}

function drillDiameter(tool, units) {
  if (tool && Number.isFinite(tool.diameter) && tool.diameter > 0) return tool.diameter;
  return units === "in" ? DEFAULT_DRILL_IN : DEFAULT_DRILL_MM;
}

export function parseExcellon(source, filePath = "") {
  const sourceEmpty = isBoardSourceEmpty(source);
  const model = {
    kind: "excellon",
    filePath,
    sourceEmpty,
    units: "in",
    format: cloneFormat(EXCELLON_DEFAULT_FORMAT),
    tools: {},
    apertures: {},
    shapes: [],
    diagnostics: [],
    bounds: null,
    stats: null,
  };

  const state = {
    x: 0,
    y: 0,
    currentTool: null,
  };

  const lines = sourceEmpty
    ? []
    : String(source || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.replace(/;.*/, "").trim();
    if (!line) return;
    const upper = line.toUpperCase().replace(/\s+/g, "");

    if (upper === "M48" || upper === "%" || upper === "M95" || upper === "M30") return;

    if (upper.startsWith("METRIC")) {
      model.units = "mm";
      model.format.xInteger = 3;
      model.format.xDecimal = 3;
      model.format.yInteger = 3;
      model.format.yDecimal = 3;
      if (upper.includes("TZ")) model.format.zeroSuppression = "T";
      if (upper.includes("LZ")) model.format.zeroSuppression = "L";
      return;
    }

    if (upper.startsWith("INCH")) {
      model.units = "in";
      model.format.xInteger = 2;
      model.format.xDecimal = 4;
      model.format.yInteger = 2;
      model.format.yDecimal = 4;
      if (upper.includes("TZ")) model.format.zeroSuppression = "T";
      if (upper.includes("LZ")) model.format.zeroSuppression = "L";
      return;
    }

    if (upper.startsWith("FMAT")) return;

    const toolDefinition = upper.match(/^T(\d+)(?:C([0-9.]+))?/);
    if (toolDefinition && toolDefinition[2]) {
      const toolCode = normalizeToolCode(toolDefinition[1]);
      model.tools[toolCode] = {
        code: toolCode,
        diameter: cleanNumber(toolDefinition[2], drillDiameter(null, model.units)),
      };
      return;
    }

    const toolSelect = upper.match(/^T(\d+)$/);
    if (toolSelect) {
      const toolCode = normalizeToolCode(toolSelect[1]);
      state.currentTool = toolCode;
      if (!model.tools[toolCode]) {
        model.tools[toolCode] = {
          code: toolCode,
          diameter: drillDiameter(null, model.units),
        };
      }
      return;
    }

    const coords = parseExcellonCoords(upper, model.format);
    const hasPosition = coords.X !== undefined || coords.Y !== undefined;
    if (!hasPosition) return;

    const next = {
      x: coords.X !== undefined ? coords.X : state.x,
      y: coords.Y !== undefined ? coords.Y : state.y,
    };
    const tool = model.tools[state.currentTool] || null;
    const diameter = drillDiameter(tool, model.units);

    if (/G0?0/.test(upper)) {
      state.x = next.x;
      state.y = next.y;
      return;
    }

    if (/G85/.test(upper)) {
      model.shapes.push({
        type: "slot",
        x1: state.x,
        y1: state.y,
        x2: next.x,
        y2: next.y,
        diameter,
        width: diameter,
        tool: state.currentTool,
        line: lineNumber,
      });
    } else {
      model.shapes.push({
        type: "drill",
        x: next.x,
        y: next.y,
        diameter,
        tool: state.currentTool,
        line: lineNumber,
      });
    }

    state.x = next.x;
    state.y = next.y;
  });

  if (!Object.keys(model.tools).length && model.shapes.length) {
    addDiagnostic(model, "info", "No drill tool table was found; default diameters are displayed.", null);
  }

  model.bounds = computeBounds(model.shapes);
  model.stats = {
    ...shapeSummary(model.shapes),
    tools: Object.keys(model.tools).length,
    commands: lines.length,
  };
  return model;
}

export function parseBoardFile(source, filePath = "") {
  const kind = detectBoardFileKind(filePath, source);
  return kind === "excellon"
    ? parseExcellon(source, filePath)
    : parseGerber(source, filePath);
}

export function formatBoardSummary(model) {
  const stats = model?.stats || {};
  const parts = [model?.sourceEmpty ? "empty " + (model?.kind || "board") : model?.kind || "board"];
  if (model?.units) parts.push(model.units);
  if (stats.segments) parts.push(`${stats.segments} traces`);
  if (stats.arcs) parts.push(`${stats.arcs} arcs`);
  if (stats.flashes) parts.push(`${stats.flashes} flashes`);
  if (stats.regions) parts.push(`${stats.regions} regions`);
  if (stats.drills) parts.push(`${stats.drills} drills`);
  if (stats.slots) parts.push(`${stats.slots} slots`);
  if (stats.apertures) parts.push(`${stats.apertures} apertures`);
  if (stats.tools) parts.push(`${stats.tools} tools`);
  return parts.join(" | ");
}

export function createStarterBoardSource(filePath = "") {
  const kind = detectBoardFileKind(filePath, "");
  if (kind === "excellon") {
    return [
      "M48",
      "METRIC,LZ",
      "T01C0.800",
      "%",
      "T01",
      "M30",
      "",
    ].join("\n");
  }

  return [
    "%FSLAX24Y24*%",
    "%MOMM*%",
    "%LPD*%",
    "%ADD10C,0.2500*%",
    "D10*",
    "M02*",
    "",
  ].join("\n");
}
