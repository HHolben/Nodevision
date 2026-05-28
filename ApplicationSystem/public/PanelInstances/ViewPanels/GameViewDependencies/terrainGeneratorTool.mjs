// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/terrainGeneratorTool.mjs
// This file defines browser-side terrain Generator Tool logic for the Nodevision UI. It renders interface components and handles user interactions.

import { setStatus } from "/StatusBar.mjs";
import {
  MOISTURE_BANDS,
  TERRAIN_GEOMETRY_MODES,
  TEMPERATURE_BANDS,
  TERRAIN_BIOMES,
  TERRAIN_KINDS,
  TERRAIN_TEXTURES,
  resolveTerrainColor,
  terrainKindById
} from "./TerrainTool/terrainPresets.mjs";
import { createTerrainTilePainter } from "./TerrainTool/terrainTilePainter.mjs";
import { createTerrainMaterial } from "./TerrainTool/terrainMaterial.mjs";

export function createTerrainToolController({ THREE, scene, objects, colliders }) {
  const root = document.createElement("div");

  const generatedRefs = [];
  const terrainPainter = createTerrainTilePainter({ THREE, scene, objects, colliders });
  let paintModeActive = false;
  let lastPaintStatusAt = 0;

  function hash2D(x, z, seed) {
    const text = `${seed}:${x}:${z}`;
    let h = 1779033703 ^ text.length;
    for (let i = 0; i < text.length; i += 1) {
      h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967295;
  }

  function smoothStep(t) {
    return t * t * (3 - 2 * t);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function valueNoise2D(x, z, seed) {
    const x0 = Math.floor(x);
    const z0 = Math.floor(z);
    const x1 = x0 + 1;
    const z1 = z0 + 1;
    const tx = smoothStep(x - x0);
    const tz = smoothStep(z - z0);

    const n00 = hash2D(x0, z0, seed);
    const n10 = hash2D(x1, z0, seed);
    const n01 = hash2D(x0, z1, seed);
    const n11 = hash2D(x1, z1, seed);

    const nx0 = lerp(n00, n10, tx);
    const nx1 = lerp(n01, n11, tx);
    return lerp(nx0, nx1, tz);
  }

  function fractalNoise2D(x, z, { seed, noiseScale, octaves, persistence, lacunarity }) {
    let amplitude = 1;
    let frequency = 1;
    let total = 0;
    let totalAmplitude = 0;
    for (let i = 0; i < octaves; i += 1) {
      const n = valueNoise2D(x * noiseScale * frequency, z * noiseScale * frequency, `${seed}:${i}`);
      total += n * amplitude;
      totalAmplitude += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }
    return totalAmplitude > 0 ? total / totalAmplitude : 0;
  }

  function createLabeledInput({ label, type = "number", value = "", step = "any", min = null, placeholder = "" }) {
    const wrap = document.createElement("label");
    wrap.style.display = "grid";
    wrap.style.gap = "4px";
    wrap.style.fontSize = "12px";
    wrap.textContent = label;

    const input = document.createElement("input");
    input.type = type;
    input.value = String(value);
    input.step = step;
    if (min !== null) input.min = String(min);
    if (placeholder) input.placeholder = placeholder;
    input.style.border = "1px solid rgba(140, 180, 210, 0.65)";
    input.style.background = "rgba(8, 14, 20, 0.8)";
    input.style.color = "#eaf7ff";
    input.style.borderRadius = "6px";
    input.style.padding = "6px 8px";
    wrap.appendChild(input);
    return { wrap, input };
  }

  function createLabeledSelect({ label, options, value = "" }) {
    const wrap = document.createElement("label");
    wrap.style.display = "grid";
    wrap.style.gap = "4px";
    wrap.style.fontSize = "12px";
    wrap.textContent = label;

    const select = document.createElement("select");
    select.value = String(value || "");
    select.style.border = "1px solid rgba(140, 180, 210, 0.65)";
    select.style.background = "rgba(8, 14, 20, 0.8)";
    select.style.color = "#eaf7ff";
    select.style.borderRadius = "6px";
    select.style.padding = "6px 8px";
    options.forEach((option) => {
      const opt = document.createElement("option");
      opt.value = option.id;
      opt.textContent = option.label;
      select.appendChild(opt);
    });
    select.value = String(value || options[0]?.id || "");
    wrap.appendChild(select);
    return { wrap, input: select };
  }

  function parseNumber(input, fallback) {
    const num = Number(input.value);
    return Number.isFinite(num) ? num : fallback;
  }

  function clearGeneratedTerrain() {
    while (generatedRefs.length > 0) {
      const entry = generatedRefs.pop();
      if (!entry) continue;
      terrainPainter.removeTerrainTile(entry);
    }
  }

  root.innerHTML = "";
  root.style.display = "grid";
  root.style.gap = "10px";

  const intro = document.createElement("div");
  intro.style.fontSize = "12px";
  intro.style.opacity = "0.92";
  intro.textContent = "Terrain palette and brush settings.";
  root.appendChild(intro);

  const paletteGrid = document.createElement("div");
  paletteGrid.style.display = "grid";
  paletteGrid.style.gridTemplateColumns = "repeat(3, minmax(0, 1fr))";
  paletteGrid.style.gap = "8px";
  root.appendChild(paletteGrid);

  const kindField = createLabeledSelect({ label: "Terrain Kind", options: TERRAIN_KINDS, value: "grass" });
  const geometryField = createLabeledSelect({ label: "Shape", options: TERRAIN_GEOMETRY_MODES, value: "voxel" });
  const textureField = createLabeledSelect({ label: "Texture", options: TERRAIN_TEXTURES, value: "solid" });
  const biomeField = createLabeledSelect({ label: "Biome", options: TERRAIN_BIOMES, value: "plains" });
  const temperatureField = createLabeledSelect({ label: "Temperature", options: TEMPERATURE_BANDS, value: "temperate" });
  const moistureField = createLabeledSelect({ label: "Moisture", options: MOISTURE_BANDS, value: "balanced" });
  const paintElevationField = createLabeledInput({ label: "Elevation", value: "0.6", min: "0.05", step: "0.1" });
  const waterDepthField = createLabeledInput({ label: "Water Depth", value: "1.5", min: "0.05", step: "0.1" });
  const paintTileSizeField = createLabeledInput({ label: "Brush Size", value: "1", min: "0.1", step: "0.1" });
  const paintRadiusField = createLabeledInput({ label: "Radius", value: "0", min: "0", step: "0.1" });
  const brushShapeField = createLabeledSelect({
    label: "Brush Shape",
    options: [
      { id: "square", label: "Square" },
      { id: "round", label: "Round" }
    ],
    value: "square"
  });
  const paintBaseYField = createLabeledInput({ label: "Base Y", value: "0", step: "0.1" });
  const paintColorField = createLabeledInput({ label: "Paint Color", type: "color", value: "#3f8f46" });

  [
    kindField,
    geometryField,
    textureField,
    biomeField,
    temperatureField,
    moistureField,
    paintElevationField,
    waterDepthField,
    paintTileSizeField,
    paintRadiusField,
    brushShapeField,
    paintBaseYField,
    paintColorField
  ].forEach((entry) => paletteGrid.appendChild(entry.wrap));

  const grid = document.createElement("div");
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "repeat(3, minmax(0, 1fr))";
  grid.style.gap = "8px";
  root.appendChild(grid);

  const lengthField = createLabeledInput({ label: "Length", value: "30", min: "1" });
  const widthField = createLabeledInput({ label: "Width", value: "30", min: "1" });
  const tileSizeField = createLabeledInput({ label: "Tile Size", value: "1", min: "0.1", step: "0.1" });
  const centerXField = createLabeledInput({ label: "Center X", value: "0" });
  const centerYField = createLabeledInput({ label: "Base Y", value: "0" });
  const centerZField = createLabeledInput({ label: "Center Z", value: "0" });
  const baseHeightField = createLabeledInput({ label: "Base Height", value: "0.6", min: "0.1", step: "0.1" });
  const maxRaiseField = createLabeledInput({ label: "Max Raise", value: "4.5", min: "0", step: "0.1" });
  const intensityField = createLabeledInput({ label: "Intensity", value: "1.0", min: "0", step: "0.1" });
  const noiseScaleField = createLabeledInput({ label: "Noise Scale", value: "0.08", min: "0.001", step: "0.01" });
  const octavesField = createLabeledInput({ label: "Octaves", value: "4", min: "1", step: "1" });
  const seedField = createLabeledInput({ label: "Seed", type: "text", value: "terrain-01", placeholder: "seed text" });
  const persistenceField = createLabeledInput({ label: "Persistence", value: "0.5", min: "0.05", step: "0.05" });
  const lacunarityField = createLabeledInput({ label: "Lacunarity", value: "2.0", min: "1.05", step: "0.05" });
  const colorLowField = createLabeledInput({ label: "Low Color", type: "color", value: "#2f6f3f" });
  const colorHighField = createLabeledInput({ label: "High Color", type: "color", value: "#cdbc88" });

  [
    lengthField,
    widthField,
    tileSizeField,
    centerXField,
    centerYField,
    centerZField,
    baseHeightField,
    maxRaiseField,
    intensityField,
    noiseScaleField,
    octavesField,
    seedField,
    persistenceField,
    lacunarityField,
    colorLowField,
    colorHighField
  ].forEach((entry) => grid.appendChild(entry.wrap));

  const toggleRow = document.createElement("div");
  toggleRow.style.display = "flex";
  toggleRow.style.flexWrap = "wrap";
  toggleRow.style.gap = "14px";
  root.appendChild(toggleRow);

  const replaceWrap = document.createElement("label");
  replaceWrap.style.display = "inline-flex";
  replaceWrap.style.alignItems = "center";
  replaceWrap.style.gap = "6px";
  replaceWrap.style.fontSize = "12px";
  const replaceInput = document.createElement("input");
  replaceInput.type = "checkbox";
  replaceInput.checked = true;
  replaceWrap.appendChild(replaceInput);
  replaceWrap.appendChild(document.createTextNode("Replace previous terrain"));
  toggleRow.appendChild(replaceWrap);

  const solidWrap = document.createElement("label");
  solidWrap.style.display = "inline-flex";
  solidWrap.style.alignItems = "center";
  solidWrap.style.gap = "6px";
  solidWrap.style.fontSize = "12px";
  const solidInput = document.createElement("input");
  solidInput.type = "checkbox";
  solidInput.checked = true;
  solidWrap.appendChild(solidInput);
  solidWrap.appendChild(document.createTextNode("Solid terrain"));
  toggleRow.appendChild(solidWrap);

  const buttonRow = document.createElement("div");
  buttonRow.style.display = "flex";
  buttonRow.style.gap = "8px";
  root.appendChild(buttonRow);

  const paintBtn = document.createElement("button");
  paintBtn.type = "button";
  paintBtn.textContent = "Paint Mode Off";
  paintBtn.style.padding = "7px 10px";
  buttonRow.appendChild(paintBtn);

  const generateBtn = document.createElement("button");
  generateBtn.type = "button";
  generateBtn.textContent = "Generate Terrain";
  generateBtn.style.padding = "7px 10px";
  buttonRow.appendChild(generateBtn);

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.textContent = "Clear Generated";
  clearBtn.style.padding = "7px 10px";
  buttonRow.appendChild(clearBtn);

  const status = document.createElement("div");
  status.style.fontSize = "12px";
  status.style.opacity = "0.9";
  status.textContent = "Ready";
  root.appendChild(status);

  function readBrushSettings() {
    const kind = String(kindField.input.value || "grass");
    const geometryMode = String(geometryField.input.value || "voxel");
    const texture = String(textureField.input.value || "solid");
    const biome = String(biomeField.input.value || "plains");
    const temperature = String(temperatureField.input.value || "temperate");
    const moisture = String(moistureField.input.value || "balanced");
    const elevation = Math.max(0.05, parseNumber(paintElevationField.input, 0.6));
    const depth = Math.max(0.05, parseNumber(waterDepthField.input, 1.5));
    const tileSize = Math.max(0.1, parseNumber(paintTileSizeField.input, 1));
    const radius = Math.max(0, parseNumber(paintRadiusField.input, 0));
    const brushShape = String(brushShapeField.input.value || "square");
    const baseY = parseNumber(paintBaseYField.input, 0);
    const color = paintColorField.input.value || resolveTerrainColor({ kind, biome, temperature, moisture, elevation });
    return { kind, geometryMode, texture, biome, temperature, moisture, elevation, depth, tileSize, radius, brushShape, baseY, color };
  }

  function refreshPaintColor() {
    const settings = readBrushSettings();
    paintColorField.input.value = resolveTerrainColor(settings);
    const kind = terrainKindById(settings.kind);
    solidInput.checked = kind.solid !== false;
    waterDepthField.input.disabled = settings.kind !== "water";
    waterDepthField.input.style.opacity = settings.kind === "water" ? "1" : "0.55";
  }

  function setPaintModeActive(active) {
    paintModeActive = active === true;
    paintBtn.textContent = paintModeActive ? "Paint Mode On" : "Paint Mode Off";
    paintBtn.setAttribute("aria-pressed", paintModeActive ? "true" : "false");
    status.textContent = paintModeActive ? "Paint mode active." : "Paint mode inactive.";
    setStatus(status.textContent);
  }

  [kindField, geometryField, textureField, biomeField, temperatureField, moistureField, paintElevationField, waterDepthField].forEach((entry) => {
    entry.input.addEventListener("input", refreshPaintColor);
    entry.input.addEventListener("change", refreshPaintColor);
  });

  paintBtn.addEventListener("click", () => {
    setPaintModeActive(!paintModeActive);
  });

  clearBtn.addEventListener("click", () => {
    clearGeneratedTerrain();
    status.textContent = "Cleared generated terrain.";
    setStatus(status.textContent);
  });

  generateBtn.addEventListener("click", () => {
    const length = Math.max(1, parseNumber(lengthField.input, 30));
    const width = Math.max(1, parseNumber(widthField.input, 30));
    const tileSize = Math.max(0.1, parseNumber(tileSizeField.input, 1));
    const centerX = parseNumber(centerXField.input, 0);
    const centerY = parseNumber(centerYField.input, 0);
    const centerZ = parseNumber(centerZField.input, 0);
    const baseHeight = Math.max(0.1, parseNumber(baseHeightField.input, 0.6));
    const maxRaise = Math.max(0, parseNumber(maxRaiseField.input, 4.5));
    const intensity = Math.max(0, parseNumber(intensityField.input, 1));
    const noiseScale = Math.max(0.001, parseNumber(noiseScaleField.input, 0.08));
    const octaves = Math.max(1, Math.floor(parseNumber(octavesField.input, 4)));
    const seed = String(seedField.input.value || "terrain-01").trim() || "terrain-01";
    const persistence = Math.max(0.05, parseNumber(persistenceField.input, 0.5));
    const lacunarity = Math.max(1.05, parseNumber(lacunarityField.input, 2));
    const colorLow = colorLowField.input.value || "#2f6f3f";
    const colorHigh = colorHighField.input.value || "#cdbc88";
    const isSolid = solidInput.checked;
    const brushSettings = readBrushSettings();

    const tilesX = Math.max(1, Math.floor(length / tileSize));
    const tilesZ = Math.max(1, Math.floor(width / tileSize));
    const startX = centerX - (tilesX * tileSize) / 2 + tileSize * 0.5;
    const startZ = centerZ - (tilesZ * tileSize) / 2 + tileSize * 0.5;

    if (replaceInput.checked) {
      clearGeneratedTerrain();
    }

    for (let ix = 0; ix < tilesX; ix += 1) {
      for (let iz = 0; iz < tilesZ; iz += 1) {
        const noise = fractalNoise2D(ix, iz, {
          seed,
          noiseScale,
          octaves,
          persistence,
          lacunarity
        });
        const height = baseHeight + maxRaise * intensity * noise;
        const terrainHeight = brushSettings.kind === "water" ? Math.max(0.05, brushSettings.depth) : height;
        const isPolygonal = brushSettings.geometryMode === "polygonal";
        const visualHeight = isPolygonal ? Math.min(0.08, terrainHeight) : terrainHeight;
        const x = startX + ix * tileSize;
        const z = startZ + iz * tileSize;
        const y = centerY + (isPolygonal ? terrainHeight - visualHeight / 2 : terrainHeight / 2);
        const color = brushSettings.kind === "water"
          ? brushSettings.color
          : `#${blendColor(colorLow, colorHigh, noise).toString(16).padStart(6, "0")}`;

        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(tileSize, visualHeight, tileSize),
          createTerrainMaterial(THREE, { color, texture: brushSettings.texture, kind: brushSettings.kind })
        );
        mesh.position.set(x, y, z);
        mesh.userData.isWater = brushSettings.kind === "water";
        mesh.userData.isSolid = isSolid && mesh.userData.isWater !== true;
        mesh.userData.breakable = mesh.userData.isWater !== true;
        mesh.userData.generatedByTerrainTool = true;
        mesh.userData.nvType = isPolygonal ? "terrain-surface" : "box";
        mesh.userData.terrain = {
          mode: "generated",
          kind: brushSettings.kind,
          biome: brushSettings.biome,
          temperature: brushSettings.temperature,
          moisture: brushSettings.moisture,
          geometryMode: brushSettings.geometryMode,
          texture: brushSettings.texture,
          tileKey: [Math.round(x / tileSize), Math.round(z / tileSize), Math.round(tileSize * 1000) / 1000].join(":"),
          tileSize: Math.round(tileSize * 1000) / 1000,
          elevation: Math.round(height * 1000) / 1000,
          depth: brushSettings.kind === "water" ? Math.round(brushSettings.depth * 1000) / 1000 : null,
          baseY: Math.round(centerY * 1000) / 1000,
          generator: { seed, noise: Math.round(noise * 1000) / 1000 }
        };
        scene.add(mesh);
        objects.push(mesh);

        let colliderRef = null;
        if (mesh.userData.isSolid) {
          const half = new THREE.Vector3(tileSize / 2, visualHeight / 2, tileSize / 2);
          colliderRef = {
            type: "box",
            box: new THREE.Box3(
              new THREE.Vector3(x - half.x, y - half.y, z - half.z),
              new THREE.Vector3(x + half.x, y + half.y, z + half.z)
            )
          };
          colliders.push(colliderRef);
          mesh.userData.colliderRef = colliderRef;
        }

        generatedRefs.push({ mesh, colliderRef });
      }
    }

    status.textContent = "Generated " + (tilesX * tilesZ) + " terrain tiles.";
    setStatus(status.textContent);
  });

  function blendColor(hexLow, hexHigh, t) {
    const low = Number.parseInt(hexLow.slice(1), 16);
    const high = Number.parseInt(hexHigh.slice(1), 16);
    const lr = (low >> 16) & 255;
    const lg = (low >> 8) & 255;
    const lb = low & 255;
    const hr = (high >> 16) & 255;
    const hg = (high >> 8) & 255;
    const hb = high & 255;
    const r = Math.round(lr + (hr - lr) * t);
    const g = Math.round(lg + (hg - lg) * t);
    const b = Math.round(lb + (hb - lb) * t);
    return (r << 16) | (g << 8) | b;
  }

  function paintAtPoint(point) {
    const settings = readBrushSettings();
    const tileSize = Math.max(0.1, settings.tileSize);
    const radius = Math.max(0, settings.radius);
    const extent = Math.max(0, Math.ceil(radius / tileSize));
    const centerGridX = Math.round((Number(point?.x) || 0) / tileSize);
    const centerGridZ = Math.round((Number(point?.z) || 0) / tileSize);
    const paintedAt = new Date().toISOString();
    let paintedCount = 0;

    for (let dx = -extent; dx <= extent; dx += 1) {
      for (let dz = -extent; dz <= extent; dz += 1) {
        if (settings.brushShape === "round") {
          const distance = Math.hypot(dx * tileSize, dz * tileSize);
          if (distance > radius + tileSize * 0.5) continue;
        } else {
          const squareDistance = Math.max(Math.abs(dx * tileSize), Math.abs(dz * tileSize));
          if (squareDistance > radius + tileSize * 0.5) continue;
        }

        const paintPoint = new THREE.Vector3(
          (centerGridX + dx) * tileSize,
          Number(point?.y) || 0,
          (centerGridZ + dz) * tileSize
        );
        const result = terrainPainter.paintTerrainTile({
          point: paintPoint,
          tileSize,
          elevation: settings.kind === "water" ? settings.depth : settings.elevation,
          baseY: settings.baseY,
          color: settings.color,
          isSolid: solidInput.checked,
          geometryMode: settings.geometryMode,
          texture: settings.texture,
          replaceExisting: true,
          metadata: {
            mode: "painted",
            kind: settings.kind,
            biome: settings.biome,
            temperature: settings.temperature,
            moisture: settings.moisture,
            radius: Math.round(radius * 1000) / 1000,
            brushShape: settings.brushShape,
            depth: settings.kind === "water" ? Math.round(settings.depth * 1000) / 1000 : null,
            paintedAt
          }
        });
        if (result) paintedCount += 1;
      }
    }

    if (paintedCount < 1) return false;
    status.textContent = "Painted " + paintedCount + " " + settings.kind + " terrain tile" + (paintedCount === 1 ? "" : "s") + ".";
    setStatus(status.textContent);
    return true;
  }

  function notifyPaintMiss() {
    const now = Date.now();
    if (now - lastPaintStatusAt < 900) return;
    lastPaintStatusAt = now;
    status.textContent = "No paint target in range.";
    setStatus(status.textContent);
  }

  function updateBrushSettings(partial = {}) {
    if (partial.kind !== undefined) kindField.input.value = String(partial.kind);
    if (partial.geometryMode !== undefined) geometryField.input.value = String(partial.geometryMode);
    if (partial.texture !== undefined) textureField.input.value = String(partial.texture);
    if (partial.biome !== undefined) biomeField.input.value = String(partial.biome);
    if (partial.temperature !== undefined) temperatureField.input.value = String(partial.temperature);
    if (partial.moisture !== undefined) moistureField.input.value = String(partial.moisture);
    if (partial.elevation !== undefined) paintElevationField.input.value = String(partial.elevation);
    if (partial.depth !== undefined) waterDepthField.input.value = String(partial.depth);
    if (partial.tileSize !== undefined) paintTileSizeField.input.value = String(partial.tileSize);
    if (partial.radius !== undefined) paintRadiusField.input.value = String(partial.radius);
    if (partial.brushShape !== undefined) brushShapeField.input.value = String(partial.brushShape);
    if (partial.baseY !== undefined) paintBaseYField.input.value = String(partial.baseY);
    if (partial.color !== undefined) paintColorField.input.value = String(partial.color);
    refreshPaintColor();
    if (partial.color !== undefined) paintColorField.input.value = String(partial.color);
    return readBrushSettings();
  }

  refreshPaintColor();

  return {
    openPanel(options = {}) {
      if (options.activatePaint !== false) setPaintModeActive(true);
      status.textContent = "Use Insert > Terrain to adjust terrain insertion.";
      setStatus(status.textContent);
    },
    closePanel() {
      setPaintModeActive(false);
    },
    isPaintModeActive() {
      return paintModeActive === true;
    },
    setPaintModeActive,
    getBrushSettings: readBrushSettings,
    updateBrushSettings,
    generateTerrain: () => generateBtn.click(),
    clearGeneratedTerrain: () => {
      clearGeneratedTerrain();
      status.textContent = "Cleared generated terrain.";
      setStatus(status.textContent);
    },
    paintAtPoint,
    notifyPaintMiss,
    dispose() {
      clearGeneratedTerrain();
      root.replaceChildren();
    }
  };
}
