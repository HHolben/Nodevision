// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/consolePanels.mjs
// Provides console-specific floating panels for placement, inspection, and use (environment controls).

import { createFloatingInventoryPanel } from "/PanelInstances/InfoPanels/PlayerInventory.mjs";
import {
  DEFAULT_WORLD_GAS_MATERIAL_FILE,
  DEFAULT_WORLD_GAS_MATERIAL_ID,
  loadWorldObjectMaterialCatalog,
  readWorldObjectMatterState
} from "/MetaWorld/Materials/WorldObjectMaterialDefaults.mjs";

const DEFAULT_ENVIRONMENT = {
  skyColor: "#ffffff",
  floorColor: "#d8dee4",
  backgroundMode: "color",
  backgroundImage: "",
  floorImage: "",
  gasMaterialId: DEFAULT_WORLD_GAS_MATERIAL_ID,
  gasMaterialFile: DEFAULT_WORLD_GAS_MATERIAL_FILE,
  dayNightCycle: {
    enabled: false,
    durationSeconds: 120,
    periods: [
      { time: 0, brightness: 1 }
    ]
  }
};

const DEFAULT_GAS_MATERIAL_OPTION = {
  displayName: "White Oxygenated Air",
  materialName: "White Oxygenated Air",
  materialId: DEFAULT_WORLD_GAS_MATERIAL_ID,
  materialFile: DEFAULT_WORLD_GAS_MATERIAL_FILE,
  materialJSONfile: "Materials/Gasses/WhiteOxygenatedAir.json",
  matterState: "gas",
  MatterState: "gas"
};

function cloneDefaultDayNightCycle() {
  return {
    enabled: false,
    durationSeconds: 120,
    periods: [
      { time: 0, brightness: 1 }
    ]
  };
}

function clampFiniteNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function normalizeDayNightPeriod(period, fallbackTime = 0) {
  const source = period && typeof period === "object" ? period : {};
  return {
    time: clampFiniteNumber(source.time ?? source.timeSeconds ?? source.at ?? source.offset, 0, Number.MAX_SAFE_INTEGER, fallbackTime),
    brightness: clampFiniteNumber(source.brightness ?? source.level ?? source.intensity, 0, 1, 1)
  };
}

function normalizeDayNightCycle(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  const durationSeconds = clampFiniteNumber(source.durationSeconds ?? source.duration ?? source.cycleSeconds, 1, 86400, DEFAULT_ENVIRONMENT.dayNightCycle.durationSeconds);
  const sourcePeriods = Array.isArray(source.periods)
    ? source.periods
    : Array.isArray(source.keyframes)
      ? source.keyframes
      : [];
  const periods = sourcePeriods
    .map((period, index) => normalizeDayNightPeriod(period, index === 0 ? 0 : durationSeconds * index / Math.max(sourcePeriods.length, 1)))
    .map((period) => ({
      time: clampFiniteNumber(period.time, 0, durationSeconds, 0),
      brightness: clampFiniteNumber(period.brightness, 0, 1, 1)
    }))
    .sort((a, b) => a.time - b.time);
  return {
    enabled: source.enabled === true,
    durationSeconds,
    periods: periods.length ? periods : cloneDefaultDayNightCycle().periods
  };
}

function normalizeEnvironmentState(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  const environment = {
    ...DEFAULT_ENVIRONMENT,
    ...source
  };
  environment.dayNightCycle = normalizeDayNightCycle(source.dayNightCycle ?? source.dayNight ?? source.lightCycle ?? DEFAULT_ENVIRONMENT.dayNightCycle);
  return environment;
}

function moduloPositive(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function smoothStep(value) {
  return value * value * (3 - 2 * value);
}

function sampleDayNightBrightness(cycle, elapsedSeconds = 0) {
  const normalized = normalizeDayNightCycle(cycle);
  if (!normalized.enabled) return 1;
  const periods = normalized.periods;
  if (periods.length <= 1) return periods[0]?.brightness ?? 1;
  const duration = normalized.durationSeconds;
  const t = moduloPositive(Number(elapsedSeconds) || 0, duration);
  let previous = periods[periods.length - 1];
  let next = periods[0];
  for (const period of periods) {
    if (period.time <= t) previous = period;
    if (period.time > t) {
      next = period;
      break;
    }
  }
  const previousTime = previous === periods[periods.length - 1] && t < periods[0].time
    ? previous.time - duration
    : previous.time;
  const nextTime = next.time <= previousTime ? next.time + duration : next.time;
  const span = Math.max(0.001, nextTime - previousTime);
  const amount = smoothStep(clampFiniteNumber((t - previousTime) / span, 0, 1, 0));
  return previous.brightness + (next.brightness - previous.brightness) * amount;
}

function gasMaterialId(entry = {}) {
  return String(entry.materialId || entry.id || entry.physicsMaterialId || entry.materialName || entry.displayName || DEFAULT_WORLD_GAS_MATERIAL_ID).trim();
}

function gasMaterialFile(entry = {}) {
  return String(entry.materialFile || entry.MaterialJSONfile || entry.materialJSONfile || DEFAULT_WORLD_GAS_MATERIAL_FILE).trim();
}

function gasMaterialLabel(entry = {}) {
  return String(entry.displayName || entry.materialName || gasMaterialId(entry)).trim();
}

function normalizeGasCatalogEntries(catalog = []) {
  const entries = [DEFAULT_GAS_MATERIAL_OPTION, ...(Array.isArray(catalog) ? catalog : [])];
  const seen = new Set();
  return entries.filter((entry) => {
    if (readWorldObjectMatterState(entry, entry.matterState || entry.MatterState) !== "gas") return false;
    const id = gasMaterialId(entry);
    const file = gasMaterialFile(entry);
    const key = String(id || file || "").toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function createField(labelText, inputEl, container) {
  const wrapper = document.createElement("label");
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.gap = "4px";
  wrapper.style.fontSize = "12px";
  wrapper.style.fontFamily = "monospace";
  wrapper.textContent = labelText;
  wrapper.appendChild(inputEl);
  container.appendChild(wrapper);
  return inputEl;
}

function formatPoint(point) {
  if (!point) return "unknown";
  return `${point.x.toFixed(2)}, ${point.y.toFixed(2)}, ${point.z.toFixed(2)}`;
}

function createPlacementPanelUI() {
  const floatingPanel = createFloatingInventoryPanel({
    title: "Console Placement",
    closeBehavior: "hide",
    onRequestClose: () => {}
  });
  floatingPanel.setVisible(false);
  floatingPanel.undock();

  const root = document.createElement("div");
  root.style.display = "flex";
  root.style.flexDirection = "column";
  root.style.gap = "8px";
  root.style.font = "12px/1.3 monospace";
  floatingPanel.content.appendChild(root);

  const fields = document.createElement("div");
  fields.style.display = "grid";
  fields.style.gridTemplateColumns = "repeat(2, minmax(0, 1fr))";
  fields.style.gap = "8px";
  root.appendChild(fields);

  const colorInput = createField("Console Color", (() => {
    const inp = document.createElement("input");
    inp.type = "color";
    return inp;
  })(), fields);

  const colliderInput = createField("Enable Collider", (() => {
    const inp = document.createElement("input");
    inp.type = "checkbox";
    inp.style.width = "auto";
    return inp;
  })(), fields);

  const objectInput = createField("Object File (optional)", (() => {
    const inp = document.createElement("input");
    inp.type = "text";
    inp.placeholder = "Notebook/path/model.glb";
    inp.style.fontSize = "12px";
    return inp;
  })(), root);

  const linkInput = createField("Linked Object Tag/Name", (() => {
    const inp = document.createElement("input");
    inp.type = "text";
    inp.placeholder = "target-a";
    inp.style.fontSize = "12px";
    return inp;
  })(), root);

  const sizeContainer = document.createElement("div");
  sizeContainer.style.display = "grid";
  sizeContainer.style.gridTemplateColumns = "repeat(3, minmax(0, 1fr))";
  sizeContainer.style.gap = "8px";
  root.appendChild(sizeContainer);

  const widthInput = createField("Width (m)", (() => {
    const inp = document.createElement("input");
    inp.type = "number";
    inp.step = "0.05";
    inp.value = "0.9";
    inp.min = "0.1";
    return inp;
  })(), sizeContainer);

  const heightInput = createField("Height (m)", (() => {
    const inp = document.createElement("input");
    inp.type = "number";
    inp.step = "0.05";
    inp.value = "1.15";
    inp.min = "0.1";
    return inp;
  })(), sizeContainer);

  const depthInput = createField("Depth (m)", (() => {
    const inp = document.createElement("input");
    inp.type = "number";
    inp.step = "0.05";
    inp.value = "0.7";
    inp.min = "0.1";
    return inp;
  })(), sizeContainer);

  const helpLine = document.createElement("div");
  helpLine.style.opacity = "0.8";
  helpLine.textContent = "Aim at the surface, configure the console, then click Place.";
  root.appendChild(helpLine);

  const statusLine = document.createElement("div");
  statusLine.style.opacity = "0.9";
  root.appendChild(statusLine);

  const buttonRow = document.createElement("div");
  buttonRow.style.display = "flex";
  buttonRow.style.gap = "8px";
  root.appendChild(buttonRow);

  const placeBtn = document.createElement("button");
  placeBtn.type = "button";
  placeBtn.textContent = "Place Console";
  buttonRow.appendChild(placeBtn);

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.textContent = "Cancel";
  buttonRow.appendChild(cancelBtn);

  function gatherConfig() {
    const width = Math.max(0.1, Number.parseFloat(widthInput.value) || 0.9);
    const height = Math.max(0.1, Number.parseFloat(heightInput.value) || 1.15);
    const depth = Math.max(0.1, Number.parseFloat(depthInput.value) || 0.7);
    return {
      collider: Boolean(colliderInput.checked),
      color: colorInput.value || "#33ccaa",
      objectFile: String(objectInput.value || "").trim(),
      linkedObject: String(linkInput.value || "").trim(),
      inputs: {},
      outputs: {},
      size: [width, height, depth]
    };
  }

  return {
    floatingPanel,
    colorInput,
    colliderInput,
    objectInput,
    linkInput,
    widthInput,
    heightInput,
    depthInput,
    statusLine,
    placeBtn,
    cancelBtn,
    gatherConfig,
    setStatus: (value) => { statusLine.textContent = value; },
    setDefaults: (defaults = {}) => {
      colorInput.value = defaults.color || "#33ccaa";
      colliderInput.checked = defaults.collider !== false;
      objectInput.value = defaults.objectFile || "";
      linkInput.value = defaults.linkedObject || "";
      widthInput.value = String(defaults.size?.[0] ?? 0.9);
      heightInput.value = String(defaults.size?.[1] ?? 1.15);
      depthInput.value = String(defaults.size?.[2] ?? 0.7);
    }
  };
}

function createInspectPanelUI() {
  const floatingPanel = createFloatingInventoryPanel({
    title: "Inspect Console",
    closeBehavior: "hide",
    onRequestClose: () => {}
  });
  floatingPanel.setVisible(false);
  floatingPanel.undock();

  const root = document.createElement("div");
  root.style.display = "flex";
  root.style.flexDirection = "column";
  root.style.gap = "8px";
  root.style.font = "12px/1.3 monospace";
  floatingPanel.content.appendChild(root);

  const infoLine = document.createElement("div");
  infoLine.style.opacity = "0.85";
  root.appendChild(infoLine);

  const fields = document.createElement("div");
  fields.style.display = "flex";
  fields.style.flexDirection = "column";
  fields.style.gap = "8px";
  root.appendChild(fields);

  const colorInput = createField("Console Color", (() => {
    const inp = document.createElement("input");
    inp.type = "color";
    return inp;
  })(), fields);

  const colliderInput = createField("Enable Collider", (() => {
    const inp = document.createElement("input");
    inp.type = "checkbox";
    inp.style.width = "auto";
    return inp;
  })(), fields);

  const objectInput = createField("Object File Tag", (() => {
    const inp = document.createElement("input");
    inp.type = "text";
    inp.placeholder = "Not set";
    inp.style.fontSize = "12px";
    return inp;
  })(), fields);

  const linkInput = createField("Linked Object", (() => {
    const inp = document.createElement("input");
    inp.type = "text";
    inp.placeholder = "target-a";
    inp.style.fontSize = "12px";
    return inp;
  })(), fields);

  const buttonRow = document.createElement("div");
  buttonRow.style.display = "flex";
  buttonRow.style.gap = "8px";
  root.appendChild(buttonRow);

  const applyBtn = document.createElement("button");
  applyBtn.type = "button";
  applyBtn.textContent = "Apply";
  buttonRow.appendChild(applyBtn);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "Close";
  buttonRow.appendChild(closeBtn);

  return {
    floatingPanel,
    infoLine,
    colorInput,
    colliderInput,
    objectInput,
    linkInput,
    applyBtn,
    closeBtn,
    setInfo: (value) => { infoLine.textContent = value; },
    setValues: (config = {}) => {
      colorInput.value = config.color || "#33ccaa";
      colliderInput.checked = config.collider !== false;
      objectInput.value = config.objectFile || "";
      linkInput.value = config.linkedObject || "";
    },
    gatherConfig: () => ({
      color: colorInput.value || "#33ccaa",
      collider: Boolean(colliderInput.checked),
      objectFile: String(objectInput.value || "").trim(),
      linkedObject: String(linkInput.value || "").trim()
    })
  };
}

function createUsePanelUI() {
  const floatingPanel = createFloatingInventoryPanel({
    title: "Console Environment",
    closeBehavior: "hide",
    onRequestClose: () => {}
  });
  floatingPanel.setVisible(false);
  floatingPanel.undock();

  const root = document.createElement("div");
  root.style.display = "flex";
  root.style.flexDirection = "column";
  root.style.gap = "10px";
  root.style.font = "12px/1.3 monospace";
  floatingPanel.content.appendChild(root);

  const fields = document.createElement("div");
  fields.style.display = "grid";
  fields.style.gridTemplateColumns = "repeat(2, minmax(0, 1fr))";
  fields.style.gap = "8px";
  root.appendChild(fields);

  const skyInput = createField("Sky Color", (() => {
    const inp = document.createElement("input");
    inp.type = "color";
    return inp;
  })(), fields);

  const floorInput = createField("Floor Color", (() => {
    const inp = document.createElement("input");
    inp.type = "color";
    return inp;
  })(), fields);

  const gasSelect = createField("World Gas", (() => {
    const inp = document.createElement("select");
    inp.style.fontSize = "12px";
    return inp;
  })(), root);

  const urlField = createField("Background Image URL", (() => {
    const inp = document.createElement("input");
    inp.type = "text";
    inp.placeholder = "https://example.com/panorama.png";
    inp.style.fontSize = "12px";
    return inp;
  })(), root);

  const buttonRow = document.createElement("div");
  buttonRow.style.display = "flex";
  buttonRow.style.gap = "8px";
  root.appendChild(buttonRow);

  const loadUrlBtn = document.createElement("button");
  loadUrlBtn.type = "button";
  loadUrlBtn.textContent = "Load From URL";
  buttonRow.appendChild(loadUrlBtn);

  const uploadBtn = document.createElement("button");
  uploadBtn.type = "button";
  uploadBtn.textContent = "Upload Image";
  buttonRow.appendChild(uploadBtn);

  const colorBtn = document.createElement("button");
  colorBtn.type = "button";
  colorBtn.textContent = "Use Colors";
  buttonRow.appendChild(colorBtn);

  const statusLine = document.createElement("div");
  statusLine.style.opacity = "0.85";
  root.appendChild(statusLine);

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/png,image/svg+xml,image/jpeg";
  fileInput.style.display = "none";
  root.appendChild(fileInput);

  function setSelectedGas(env = {}) {
    const selectedId = String(env.gasMaterialId || DEFAULT_ENVIRONMENT.gasMaterialId || "").toLowerCase();
    const selectedFile = String(env.gasMaterialFile || DEFAULT_ENVIRONMENT.gasMaterialFile || "").toLowerCase();
    const options = Array.from(gasSelect.options || []);
    const selected = options.find((option) => {
      return String(option.dataset.materialId || option.value || "").toLowerCase() === selectedId
        || String(option.dataset.materialFile || "").toLowerCase() === selectedFile;
    }) || options[0];
    if (selected) gasSelect.value = selected.value;
  }

  function setGasOptions(entries = [], env = {}) {
    const fragment = document.createDocumentFragment();
    normalizeGasCatalogEntries(entries).forEach((entry) => {
      const option = document.createElement("option");
      const id = gasMaterialId(entry);
      const file = gasMaterialFile(entry);
      option.value = id || file;
      option.dataset.materialId = id;
      option.dataset.materialFile = file;
      option.textContent = gasMaterialLabel(entry);
      fragment.appendChild(option);
    });
    gasSelect.replaceChildren(fragment);
    setSelectedGas(env);
  }

  return {
    floatingPanel,
    skyInput,
    floorInput,
    gasSelect,
    urlField,
    loadUrlBtn,
    uploadBtn,
    colorBtn,
    statusLine,
    fileInput,
    setGasOptions,
    setStatus: (msg) => { statusLine.textContent = msg || ""; },
    setFields: (env) => {
      skyInput.value = env.skyColor || "#ffffff";
      floorInput.value = env.floorColor || "#d8dee4";
      setSelectedGas(env);
    }
  };
}

export function createConsolePanels({ THREE, scene, ground, movementState }) {
  const placeUI = createPlacementPanelUI();
  const inspectUI = createInspectPanelUI();
  const useUI = createUsePanelUI();
  const loader = new THREE.TextureLoader();
  const floorLoader = new THREE.TextureLoader();
  let currentTexture = null;
  let textureRequestId = 0;
  let currentFloorTexture = null;
  let floorTextureRequestId = 0;

  let environment = normalizeEnvironmentState({
    ...DEFAULT_ENVIRONMENT,
    ...(movementState?.environment || {})
  });
  if (movementState) movementState.environment = environment;
  if (window.VRWorldContext) {
    window.VRWorldContext.environment = environment;
  }

  let gasCatalog = normalizeGasCatalogEntries([DEFAULT_GAS_MATERIAL_OPTION]);
  useUI.setGasOptions(gasCatalog, environment);
  void loadWorldObjectMaterialCatalog()
    .then((catalog) => {
      gasCatalog = normalizeGasCatalogEntries(catalog);
      useUI.setGasOptions(gasCatalog, environment);
    })
    .catch((err) => {
      console.warn("World gas material catalog failed to load:", err);
      useUI.setGasOptions(gasCatalog, environment);
    });

  let pendingPlacement = null;
  let pendingInspect = null;

  function disposeTexture() {
    if (currentTexture) {
      currentTexture.dispose();
      currentTexture = null;
    }
  }

  function disposeFloorTexture() {
    if (currentFloorTexture) {
      currentFloorTexture.dispose();
      currentFloorTexture = null;
    }
    if (ground?.material) {
      ground.material.map = null;
      ground.material.needsUpdate = true;
    }
  }

  function refreshUseFields() {
    if (!useUI) return;
    useUI.setFields(environment);
  }

  function syncEnvironmentState() {
    const definition = getEnvironmentDefinition();
    environment = definition;
    if (movementState) movementState.environment = definition;
    if (window.VRWorldContext) {
      window.VRWorldContext.environment = definition;
      const worldDef = window.VRWorldContext.currentWorldDefinition;
      if (worldDef && typeof worldDef === "object") {
        worldDef.environment = {
          ...(worldDef.environment || {}),
          ...definition
        };
        worldDef.metadata = worldDef.metadata && typeof worldDef.metadata === "object" ? worldDef.metadata : {};
        worldDef.metadata.environment = {
          ...(worldDef.metadata.environment || {}),
          ...definition
        };
      }
    }
  }

  function readEnvironmentElapsedSeconds() {
    return window.VRWorldContext?.temporalController?.getTimeSeconds?.() ?? 0;
  }

  function updateEnvironmentLighting(elapsedSeconds = readEnvironmentElapsedSeconds()) {
    const brightness = clampFiniteNumber(sampleDayNightBrightness(environment.dayNightCycle, elapsedSeconds), 0, 1, 1);
    if (scene?.traverse) {
      scene.traverse((object) => {
        if (!object?.isLight) return;
        object.userData = object.userData || {};
        if (!Number.isFinite(object.userData.nvDayNightBaseIntensity)) {
          const baseIntensity = Number(object.intensity);
          object.userData.nvDayNightBaseIntensity = Number.isFinite(baseIntensity) ? baseIntensity : 1;
        }
        object.intensity = object.userData.nvDayNightBaseIntensity * brightness;
      });
    }
    if (scene && !(environment.backgroundMode === "image" && environment.backgroundImage)) {
      const skyColor = new THREE.Color(environment.skyColor || DEFAULT_ENVIRONMENT.skyColor);
      skyColor.multiplyScalar(brightness);
      scene.background = skyColor;
    }
    if (movementState) movementState.environmentBrightness = brightness;
    if (window.VRWorldContext) window.VRWorldContext.environmentBrightness = brightness;
    return brightness;
  }

  function applyEnvironmentState(overrides = {}) {
    const sourceOverrides = overrides && typeof overrides === "object" ? overrides : {};
    environment = normalizeEnvironmentState({
      ...environment,
      ...sourceOverrides
    });
    syncEnvironmentState();
    const backgroundChanged = Object.prototype.hasOwnProperty.call(sourceOverrides, "backgroundMode")
      || Object.prototype.hasOwnProperty.call(sourceOverrides, "backgroundImage")
      || Object.prototype.hasOwnProperty.call(sourceOverrides, "skyColor");
    const floorChanged = Object.prototype.hasOwnProperty.call(sourceOverrides, "floorImage")
      || Object.prototype.hasOwnProperty.call(sourceOverrides, "floorColor");

    if (backgroundChanged && environment.backgroundMode === "image" && environment.backgroundImage) {
      const requestId = ++textureRequestId;
      loader.load(
        environment.backgroundImage,
        (texture) => {
          if (requestId !== textureRequestId) {
            texture.dispose();
            return;
          }
          disposeTexture();
          currentTexture = texture;
          scene.background = currentTexture;
          updateEnvironmentLighting();
          useUI.setStatus("Background image applied.");
        },
        undefined,
        (err) => {
          console.warn("Console background load failed:", err);
          if (requestId === textureRequestId) {
            environment.backgroundMode = "color";
            environment.backgroundImage = "";
            applyEnvironmentState({ backgroundMode: "color", backgroundImage: "" });
          }
          useUI.setStatus("Failed to load background image.");
        }
      );
    } else if (backgroundChanged) {
      textureRequestId += 1;
      disposeTexture();
      if (scene) scene.background = new THREE.Color(environment.skyColor || DEFAULT_ENVIRONMENT.skyColor);
      useUI.setStatus("Background colors applied.");
    }

    const floorColor = environment.floorColor || DEFAULT_ENVIRONMENT.floorColor;
    if (floorChanged && environment.floorImage) {
      const requestId = ++floorTextureRequestId;
      floorLoader.load(
        environment.floorImage,
        (texture) => {
          if (requestId !== floorTextureRequestId) {
            texture.dispose();
            return;
          }
          disposeFloorTexture();
          currentFloorTexture = texture;
          if (ground?.material) {
            ground.material.map = currentFloorTexture;
            if (ground.material.color) {
              ground.material.color.set(floorColor);
            }
            ground.material.needsUpdate = true;
          }
          useUI.setStatus("Floor image applied.");
        },
        undefined,
        (err) => {
          console.warn("Console floor texture load failed:", err);
          if (requestId === floorTextureRequestId) {
            environment.floorImage = "";
            applyEnvironmentState({ floorImage: "" });
          }
          useUI.setStatus("Failed to load floor image.");
        }
      );
    } else if (floorChanged && ground?.material) {
      floorTextureRequestId += 1;
      disposeFloorTexture();
      if (ground.material.map) {
        ground.material.map = null;
      }
      if (ground.material.color) {
        ground.material.color.set(floorColor);
      }
      ground.material.needsUpdate = true;
    }
    updateEnvironmentLighting();
    refreshUseFields();
  }

  function applyEnvironmentDefinition(def = {}) {
    if (!def) return;
    const merged = {
      skyColor: def.skyColor || DEFAULT_ENVIRONMENT.skyColor,
      floorColor: def.floorColor || DEFAULT_ENVIRONMENT.floorColor,
      backgroundMode: def.backgroundMode || (def.backgroundImage ? "image" : "color"),
      backgroundImage: def.backgroundImage || "",
      floorImage: def.floorImage || "",
      gasMaterialId: def.gasMaterialId || DEFAULT_ENVIRONMENT.gasMaterialId,
      gasMaterialFile: def.gasMaterialFile || DEFAULT_ENVIRONMENT.gasMaterialFile,
      dayNightCycle: normalizeDayNightCycle(def.dayNightCycle ?? def.dayNight ?? def.lightCycle ?? DEFAULT_ENVIRONMENT.dayNightCycle)
    };
    applyEnvironmentState(merged);
  }

  function getEnvironmentDefinition() {
    return {
      skyColor: environment.skyColor,
      floorColor: environment.floorColor,
      backgroundMode: environment.backgroundMode,
      backgroundImage: environment.backgroundImage,
      floorImage: environment.floorImage,
      gasMaterialId: environment.gasMaterialId || DEFAULT_ENVIRONMENT.gasMaterialId,
      gasMaterialFile: environment.gasMaterialFile || DEFAULT_ENVIRONMENT.gasMaterialFile,
      dayNightCycle: normalizeDayNightCycle(environment.dayNightCycle)
    };
  }

  function closePlacementPanel(triggerCancel = true) {
    if (pendingPlacement && triggerCancel) {
      pendingPlacement.onCancel?.();
    }
    pendingPlacement = null;
    placeUI.floatingPanel.setVisible(false);
  }

  placeUI.floatingPanel.__nvOnClose = () => closePlacementPanel(true);
  placeUI.placeBtn.addEventListener("click", () => {
    if (!pendingPlacement) return;
    const config = placeUI.gatherConfig();
    pendingPlacement.onConfirm?.(config, pendingPlacement.hit, pendingPlacement.snapToGrid);
    closePlacementPanel(false);
  });
  placeUI.cancelBtn.addEventListener("click", () => {
    closePlacementPanel(true);
  });

  function openPlacementPanel(hit, defaults = {}, snapToGrid = false, handlers = {}) {
    if (pendingPlacement) return false;
    const combined = {
      color: defaults.color || "#33ccaa",
      collider: defaults.collider !== false,
      objectFile: defaults.objectFile || "",
      linkedObject: defaults.linkedObject || "",
      size: Array.isArray(defaults.size) ? defaults.size : [0.9, 1.15, 0.7]
    };
    placeUI.setDefaults(combined);
    placeUI.setStatus(`Placement target: ${formatPoint(hit?.point)}`);
    pendingPlacement = {
      hit,
      onConfirm: handlers.onConfirm,
      onCancel: handlers.onCancel,
      snapToGrid: Boolean(snapToGrid)
    };
    placeUI.floatingPanel.setVisible(true);
    return true;
  }

  function hasPendingPlacement() {
    return Boolean(pendingPlacement);
  }

  function updatePlacementTarget(hit) {
    if (!pendingPlacement) return;
    pendingPlacement.hit = hit;
    placeUI.setStatus(`Placement target: ${formatPoint(hit?.point)}`);
  }

  function openInspectPanel(target, distance, handlers = {}) {
    if (!target) return false;
    const props = target.userData?.consoleProperties || {};
    inspectUI.setValues(props);
    inspectUI.setInfo(`Console | distance ${distance?.toFixed(2) ?? "?"} m`);
    pendingInspect = {
      target,
      onApply: handlers.onApply
    };
    inspectUI.floatingPanel.setVisible(true);
    return true;
  }

  inspectUI.applyBtn.addEventListener("click", () => {
    if (!pendingInspect) return;
    const config = inspectUI.gatherConfig();
    pendingInspect.onApply?.(pendingInspect.target, config);
  });
  inspectUI.closeBtn.addEventListener("click", () => {
    pendingInspect = null;
    inspectUI.floatingPanel.setVisible(false);
  });
  inspectUI.floatingPanel.__nvOnClose = () => {
    pendingInspect = null;
  };

  function openUsePanel(target = null) {
    refreshUseFields();
    const label = target?.userData?.tag || target?.name || "Console";
    useUI.setStatus(target ? `Editing environment via ${label}.` : "");
    useUI.floatingPanel.setVisible(true);
  }

  function commitBackgroundSource(source) {
    if (!source) return;
    environment.backgroundMode = "image";
    environment.backgroundImage = source;
    applyEnvironmentState({
      backgroundMode: "image",
      backgroundImage: source
    });
  }

  useUI.loadUrlBtn.addEventListener("click", () => {
    const url = String(useUI.urlField.value || "").trim();
    if (!url) {
      useUI.setStatus("Enter an image URL first.");
      return;
    }
    useUI.setStatus("Loading image...");
    commitBackgroundSource(url);
  });

  useUI.colorBtn.addEventListener("click", () => {
    const sky = useUI.skyInput.value || DEFAULT_ENVIRONMENT.skyColor;
    const floor = useUI.floorInput.value || DEFAULT_ENVIRONMENT.floorColor;
    applyEnvironmentState({
      backgroundMode: "color",
      backgroundImage: "",
      skyColor: sky,
      floorColor: floor
    });
  });

  useUI.gasSelect.addEventListener("change", () => {
    const selected = useUI.gasSelect.selectedOptions?.[0] || null;
    if (!selected) return;
    const gasMaterialId = selected.dataset.materialId || selected.value || DEFAULT_ENVIRONMENT.gasMaterialId;
    const gasMaterialFile = selected.dataset.materialFile || DEFAULT_ENVIRONMENT.gasMaterialFile;
    applyEnvironmentState({ gasMaterialId, gasMaterialFile });
    useUI.setStatus("World gas set to " + (selected.textContent || gasMaterialId) + ".");
  });

  useUI.uploadBtn.addEventListener("click", () => {
    useUI.fileInput.value = "";
    useUI.fileInput.click();
  });

  useUI.fileInput.addEventListener("change", () => {
    const file = useUI.fileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const dataUrl = String(reader.result || "");
      if (!dataUrl) {
        useUI.setStatus("Failed to read file.");
        return;
      }
      useUI.setStatus(`Loaded ${file.name}`);
      commitBackgroundSource(dataUrl);
    });
    reader.readAsDataURL(file);
  });


  const activeDemoAnimations = new Map();

  function findObjectByTag(tag) {
    if (!tag || !scene?.traverse) return null;
    let found = null;
    scene.traverse((node) => {
      if (found || !node) return;
      if (node.userData?.tag === tag || node.name === tag) found = node;
    });
    return found;
  }

  function stopDemoAnimation(key) {
    const prior = activeDemoAnimations.get(key);
    if (prior) cancelAnimationFrame(prior);
    activeDemoAnimations.delete(key);
  }

  function rememberConsoleOutput(consoleMesh, key, value) {
    if (!consoleMesh?.userData?.consoleProperties) return;
    const props = consoleMesh.userData.consoleProperties;
    props.outputs = { ...(props.outputs || {}), [key]: value, lastRunAt: new Date().toISOString() };
  }

  function runGravityDropDemo(consoleMesh, demo, inputs) {
    const tags = Array.isArray(demo.sphereTags) ? demo.sphereTags : [];
    const spheres = tags.map(findObjectByTag).filter(Boolean);
    if (spheres.length === 0) return false;
    const height = Number.isFinite(inputs.dropHeight) ? inputs.dropHeight : Number.isFinite(demo.dropHeight) ? demo.dropHeight : 3.2;
    const floorY = Number.isFinite(demo.floorY) ? demo.floorY : 0.25;
    const gravity = Math.abs(Number(inputs.gravity ?? demo.inputs?.gravity ?? 9.81)) || 9.81;
    const starts = spheres.map((mesh) => ({ mesh, x: mesh.position.x, z: mesh.position.z, radius: mesh.geometry?.parameters?.radius || 0.22 }));
    const key = consoleMesh.userData?.tag || demo.id || "gravity-drop";
    stopDemoAnimation(key);
    const startMs = performance.now();
    const durationMs = Math.max(1200, Math.sqrt((2 * height) / gravity) * 1000 + 700);
    const tick = (now) => {
      const t = Math.min((now - startMs) / 1000, durationMs / 1000);
      for (const entry of starts) {
        const y = Math.max(floorY + entry.radius, height - 0.5 * gravity * t * t);
        entry.mesh.position.set(entry.x, y, entry.z);
      }
      if (now - startMs < durationMs) {
        activeDemoAnimations.set(key, requestAnimationFrame(tick));
      } else {
        stopDemoAnimation(key);
        rememberConsoleOutput(consoleMesh, "elapsedSeconds", t.toFixed(2));
      }
    };
    for (const entry of starts) entry.mesh.position.set(entry.x, height, entry.z);
    activeDemoAnimations.set(key, requestAnimationFrame(tick));
    return true;
  }

  function runProjectileDemo(consoleMesh, demo, inputs) {
    const projectile = findObjectByTag(demo.projectileTag);
    if (!projectile) return false;
    const start = Array.isArray(demo.startPosition) ? demo.startPosition : [projectile.position.x, projectile.position.y, projectile.position.z];
    const speed = Number.isFinite(inputs.speed) ? inputs.speed : Number.isFinite(demo.speed) ? demo.speed : 6.5;
    const angle = ((Number.isFinite(inputs.angleDegrees) ? inputs.angleDegrees : Number.isFinite(demo.angleDegrees) ? demo.angleDegrees : 38) * Math.PI) / 180;
    const gravity = Math.abs(Number(inputs.gravity ?? demo.inputs?.gravity ?? 9.81)) || 9.81;
    const floorY = Number.isFinite(demo.floorY) ? demo.floorY : 0.25;
    const radius = projectile.geometry?.parameters?.radius || 0.2;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const key = consoleMesh.userData?.tag || demo.id || "projectile-range";
    stopDemoAnimation(key);
    const startMs = performance.now();
    const tick = (now) => {
      const t = (now - startMs) / 1000;
      const x = start[0] + vx * t;
      const y = Math.max(floorY + radius, start[1] + vy * t - 0.5 * gravity * t * t);
      projectile.position.set(x, y, start[2]);
      if (y > floorY + radius || t < 0.2) {
        activeDemoAnimations.set(key, requestAnimationFrame(tick));
      } else {
        stopDemoAnimation(key);
        rememberConsoleOutput(consoleMesh, "rangeMeters", (x - start[0]).toFixed(2));
      }
    };
    projectile.position.set(start[0], start[1], start[2]);
    activeDemoAnimations.set(key, requestAnimationFrame(tick));
    return true;
  }

  function runPendulumDemo(consoleMesh, demo, inputs) {
    const bob = findObjectByTag(demo.bobTag);
    const rod = findObjectByTag(demo.rodTag);
    if (!bob) return false;
    const pivot = Array.isArray(demo.pivot) ? demo.pivot : [bob.position.x, bob.position.y + 2, bob.position.z];
    const length = Number.isFinite(inputs.length) ? inputs.length : Number.isFinite(demo.length) ? demo.length : 2.2;
    const initial = ((Number.isFinite(inputs.initialAngleDegrees) ? inputs.initialAngleDegrees : Number.isFinite(demo.initialAngleDegrees) ? demo.initialAngleDegrees : 24) * Math.PI) / 180;
    const gravity = Math.abs(Number(inputs.gravity ?? demo.inputs?.gravity ?? 9.81)) || 9.81;
    const period = 2 * Math.PI * Math.sqrt(length / gravity);
    const key = consoleMesh.userData?.tag || demo.id || "pendulum";
    stopDemoAnimation(key);
    const startMs = performance.now();
    const tick = (now) => {
      const t = (now - startMs) / 1000;
      const angle = initial * Math.cos((2 * Math.PI * t) / period) * Math.exp(-0.025 * t);
      const bx = pivot[0] + Math.sin(angle) * length;
      const by = pivot[1] - Math.cos(angle) * length;
      bob.position.set(bx, by, pivot[2]);
      if (rod) {
        rod.position.set((pivot[0] + bx) / 2, (pivot[1] + by) / 2, pivot[2]);
        rod.rotation.z = -angle;
      }
      if (t < Math.max(6, period * 3)) {
        activeDemoAnimations.set(key, requestAnimationFrame(tick));
      } else {
        stopDemoAnimation(key);
        rememberConsoleOutput(consoleMesh, "periodSeconds", period.toFixed(2));
      }
    };
    activeDemoAnimations.set(key, requestAnimationFrame(tick));
    return true;
  }

  function runConsoleAction(action = {}) {
    const targetTag = action.target || action.consoleTag || action.tag;
    const consoleMesh = findObjectByTag(targetTag);
    if (!consoleMesh || String(consoleMesh.userData?.nvType || "").toLowerCase() !== "console") return false;
    const props = consoleMesh.userData.consoleProperties || {};
    const demo = props.metaWorldDemo;
    const inputs = { ...(props.inputs || {}), ...(demo?.inputs || {}), ...(action.inputs || {}) };
    if (!demo?.type) {
      openUsePanel(consoleMesh);
      return true;
    }
    if (demo.type === "gravity-drop") return runGravityDropDemo(consoleMesh, demo, inputs);
    if (demo.type === "projectile-range") return runProjectileDemo(consoleMesh, demo, inputs);
    if (demo.type === "pendulum") return runPendulumDemo(consoleMesh, demo, inputs);
    openUsePanel(consoleMesh);
    return true;
  }

  placeUI.floatingPanel.__nvOnClose = () => closePlacementPanel(true);

  applyEnvironmentState(environment);

  return {
    openPlacementPanel,
    hasPendingPlacement,
    updatePlacementTarget,
    openInspectPanel,
    openUsePanel,
    applyEnvironmentDefinition,
    getEnvironmentDefinition,
    applyEnvironmentState,
    updateEnvironmentLighting,
    runConsoleAction
  };
}
