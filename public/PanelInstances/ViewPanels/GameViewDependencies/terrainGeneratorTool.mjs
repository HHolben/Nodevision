// Nodevision/public/PanelInstances/ViewPanels/GameViewDependencies/terrainGeneratorTool.mjs
// Terrain generator tool panel for in-world procedural terrain placement.

import { createFloatingInventoryPanel } from "/PanelInstances/InfoPanels/PlayerInventory.mjs";

export function createTerrainToolController({ THREE, scene, objects, colliders }) {
  const floatingPanel = createFloatingInventoryPanel({
    title: "Terrain Generator",
    onRequestClose: () => floatingPanel.setVisible(false)
  });
  const root = floatingPanel.content;
  floatingPanel.setVisible(false);

  const generatedRefs = [];

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

  function parseNumber(input, fallback) {
    const num = Number(input.value);
    return Number.isFinite(num) ? num : fallback;
  }

  function clearGeneratedTerrain() {
    while (generatedRefs.length > 0) {
      const entry = generatedRefs.pop();
      if (!entry) continue;
      if (entry.mesh?.parent) entry.mesh.parent.remove(entry.mesh);
      const objIdx = objects.indexOf(entry.mesh);
      if (objIdx !== -1) objects.splice(objIdx, 1);
      const colIdx = colliders.indexOf(entry.colliderRef);
      if (colIdx !== -1) colliders.splice(colIdx, 1);
    }
  }

  root.innerHTML = "";
  root.style.display = "grid";
  root.style.gap = "10px";

  const intro = document.createElement("div");
  intro.style.fontSize = "12px";
  intro.style.opacity = "0.92";
  intro.textContent = "Generate a square terrain patch at any world location.";
  root.appendChild(intro);

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

  clearBtn.addEventListener("click", () => {
    clearGeneratedTerrain();
    status.textContent = "Cleared generated terrain.";
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
        const x = startX + ix * tileSize;
        const z = startZ + iz * tileSize;
        const y = centerY + height / 2;
        const color = `#${blendColor(colorLow, colorHigh, noise).toString(16).padStart(6, "0")}`;

        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(tileSize, height, tileSize),
          new THREE.MeshStandardMaterial({ color })
        );
        mesh.position.set(x, y, z);
        mesh.userData.isSolid = isSolid;
        mesh.userData.breakable = true;
        mesh.userData.generatedByTerrainTool = true;
        mesh.userData.nvType = "box";
        scene.add(mesh);
        objects.push(mesh);

        let colliderRef = null;
        if (isSolid) {
          const half = new THREE.Vector3(tileSize / 2, height / 2, tileSize / 2);
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

    status.textContent = `Generated ${tilesX * tilesZ} tiles at (${centerX.toFixed(2)}, ${centerY.toFixed(2)}, ${centerZ.toFixed(2)}).`;
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

  return {
    openPanel() {
      floatingPanel.setVisible(true);
      floatingPanel.undock();
    },
    closePanel() {
      floatingPanel.setVisible(false);
    },
    dispose() {
      clearGeneratedTerrain();
      floatingPanel.dispose();
    }
  };
}
