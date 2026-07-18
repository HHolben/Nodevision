// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/equationColliderWidget.mjs
// This widget renders Insert > Equation / Inequality Object controls for MetaWorld editing. The primary action opens the equation object panel; secondary controls still add expression layers.

import { setStatus } from "/StatusBar.mjs";
import { addMetaWorldExpressionLayer, getActiveMetaWorldLayerBridge, META_WORLD_LAYER_EVENTS } from "/MetaWorld/MetaWorldLayerState.mjs";
import { DEFAULT_WORLD_OBJECT_MATERIAL_FILE, DEFAULT_WORLD_OBJECT_MATERIAL_ID, materialFileForWorldObjectMaterial } from "/MetaWorld/Materials/WorldObjectMaterialDefaults.mjs";

const BLANK_EXPRESSION_LAYER = {
  expression: "z = 0",
  type: "functionSurface",
  name: "Blank Expression",
  domain: { autoSize: true },
  collider: { enabled: true, type: "heightfield" },
};

const DEFAULT_EQUATION_OBJECT = {
  a: 0,
  b: 0,
  c: 1,
  d: 0,
  xmin: -15,
  xmax: 15,
  ymin: -15,
  ymax: 15,
  zmin: -15,
  zmax: 15,
  thickness: 0.2,
  boundX: false,
  boundY: false,
  boundZ: false,
  collider: true,
  color: "#61d6d6",
  inequality: false,
  operator: "",
  inequalitySide: "negative",
  expression: "z = 0",
  equationExpression: "z = 0",
  physicsMaterialId: DEFAULT_WORLD_OBJECT_MATERIAL_ID,
  physicsMaterialFile: DEFAULT_WORLD_OBJECT_MATERIAL_FILE,
};

const OCEAN_WATER_OBJECT = {
  ...DEFAULT_EQUATION_OBJECT,
  d: -100,
  zmin: 70,
  zmax: 100,
  collider: false,
  inequality: true,
  operator: "<",
  expression: "z < 100",
  equationExpression: "z < 100",
  physicsMaterialId: "water",
  physicsMaterialFile: materialFileForWorldObjectMaterial("water"),
  MatterState: "liquid",
  matterState: "liquid",
  liquid: true,
  isLiquid: true,
  liquidSide: "negative",
  liquidInfinite: true,
  equationLiquidSide: "negative",
  equationLiquidInfinite: true,
  color: "#2f83b7",
};

function makeButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick?.();
  });
  return button;
}

function makePresetButton(label, expression, type, name) {
  return makeButton(label, () => {
    const layer = addMetaWorldExpressionLayer({ expression, type, name, domain: { autoSize: true } });
    setStatus(layer ? name + " added to MetaWorld layers." : "Open a MetaWorld editor before adding expression layers.");
  });
}

function getEquationObjectsPanel() {
  return window.VRWorldContext?.equationObjectsPanel || null;
}

export function openEquationInequalityObjectPanel(config = DEFAULT_EQUATION_OBJECT) {
  const panel = getEquationObjectsPanel();
  if (!panel?.open) {
    setStatus("Open a MetaWorld editor before inserting equation / inequality objects.");
    return false;
  }
  panel.open(config);
  setStatus("Set the equation or inequality, choose material, then click Insert Object.");
  return true;
}

function makeDefaultWorldDefinition() {
  const fileName = String(window.VRWorldContext?.currentWorldPath || window.selectedFilePath || "Meta World").split("/").pop() || "Meta World";
  return {
    version: 1,
    worldType: "NodevisionMetaWorld",
    name: fileName,
    type: "meta-world",
    metadata: {
      environment: {
        skyColor: "#ffffff",
        floorColor: "#d8dee4",
        backgroundMode: "color",
        backgroundImage: "",
        dayNightCycle: {
          enabled: false,
          durationSeconds: 120,
          periods: [
            { time: 0, brightness: 1 }
          ]
        }
      },
    },
    environment: {
      skyColor: "#ffffff",
      floorColor: "#d8dee4",
      backgroundMode: "color",
      backgroundImage: "",
      dayNightCycle: {
        enabled: false,
        durationSeconds: 120,
        periods: [
          { time: 0, brightness: 1 }
        ]
      }
    },
    objects: [],
  };
}

function readLayerObjectId(def, index) {
  const candidates = [def?.id, def?.tag, def?.name, def?.label, def?.title];
  const explicit = candidates.find((value) => typeof value === "string" && value.trim());
  return explicit ? explicit.trim() : "metaworld-object-" + index;
}

function createLayerEntries(worldData, ctx) {
  const defs = Array.isArray(worldData?.objects) ? worldData.objects : [];
  const sceneObjects = Array.isArray(ctx?.objects) ? ctx.objects : [];
  return defs.map((def, index) => {
    const id = readLayerObjectId(def, index);
    const object3d = sceneObjects.find((obj) => {
      const data = obj?.userData || {};
      return data.metaWorldLayerId === id || data.expressionLayerId === id;
    }) || null;
    return { id, def, object3d };
  });
}

async function ensureEditableMetaWorldBridge() {
  const existing = getActiveMetaWorldLayerBridge();
  if (existing?.addExpressionLayer) return existing;

  const ctx = window.VRWorldContext;
  if (!ctx?.THREE || !ctx?.scene || !Array.isArray(ctx.objects)) return null;

  const worldData = ctx.currentWorldDefinition && typeof ctx.currentWorldDefinition === "object"
    ? ctx.currentWorldDefinition
    : makeDefaultWorldDefinition();
  if (!Array.isArray(worldData.objects)) worldData.objects = [];
  ctx.currentWorldDefinition = worldData;
  if (ctx.state) ctx.state.currentWorldDefinition = JSON.parse(JSON.stringify(worldData));
  ctx.consolePanels?.applyEnvironmentDefinition?.(worldData.environment || worldData.metadata?.environment || null);

  const loader = await import("/PanelInstances/ViewPanels/GameViewDependencies/worldLoading.mjs");
  if (typeof loader.registerMetaWorldLayerBridge !== "function") return null;

  loader.registerMetaWorldLayerBridge({
    state: ctx.state || null,
    filePath: ctx.currentWorldPath || window.selectedFilePath || "",
    worldData,
    layerEntries: createLayerEntries(worldData, ctx),
    THREE: ctx.THREE,
    scene: ctx.scene,
    objects: ctx.objects,
    colliders: Array.isArray(ctx.colliders) ? ctx.colliders : [],
    portals: Array.isArray(ctx.portals) ? ctx.portals : [],
    spawnPoints: Array.isArray(ctx.spawnPoints) ? ctx.spawnPoints : [],
    waterVolumes: Array.isArray(ctx.waterVolumes) ? ctx.waterVolumes : [],
    camera: ctx.camera,
  });

  return getActiveMetaWorldLayerBridge();
}

export async function insertBlankExpressionLayer() {
  const bridge = await ensureEditableMetaWorldBridge();
  if (!bridge?.addExpressionLayer) {
    setStatus("Open a MetaWorld editor before adding expression layers.");
    return null;
  }
  const layer = addMetaWorldExpressionLayer(BLANK_EXPRESSION_LAYER);
  setStatus(layer ? "Blank expression added to MetaWorld layers." : "Open a MetaWorld editor before adding expression layers.");
  return layer;
}

function renderEquationColliderWidget(hostElement) {
  hostElement.innerHTML = "";
  hostElement.classList.add("nv-equation-collider-toolbar");

  const openEditor = makeButton("Equation / Inequality Object", () => {
    openEquationInequalityObjectPanel(DEFAULT_EQUATION_OBJECT);
  });
  const openOcean = makeButton("Ocean Bound: z < 100", () => {
    openEquationInequalityObjectPanel(OCEAN_WATER_OBJECT);
  });

  hostElement.appendChild(openEditor);
  hostElement.appendChild(openOcean);

  const bridge = getActiveMetaWorldLayerBridge();
  if (!bridge?.addExpressionLayer) {
    const note = document.createElement("span");
    note.textContent = "Open a MetaWorld editor to add expression layers.";
    note.style.opacity = "0.75";
    hostElement.appendChild(note);
    return;
  }

  const addSurface = makePresetButton("Add Expression Layer", "z = sin(x) * cos(y)", "functionSurface", "Expression Surface");
  const addCurve = makePresetButton("Add Curve", "y = x^2", "functionCurve", "Expression Curve");
  const addParametric = makePresetButton("Add Parametric Curve", "x = cos(t), y = sin(t), z = t / 10", "parametricCurve", "Parametric Curve");

  [addSurface, addCurve, addParametric].forEach((element) => hostElement.appendChild(element));
}

export function initToolbarWidget(hostElement, item = {}) {
  if (!hostElement) return;

  const heading = String(item?.heading || "");
  if (heading === "Equation Object" || heading === "Equation / Inequality Object") {
    openEquationInequalityObjectPanel(DEFAULT_EQUATION_OBJECT);
    return;
  }

  if (typeof hostElement.__nvEquationColliderCleanup === "function") {
    hostElement.__nvEquationColliderCleanup();
  }

  function cleanup() {
    window.removeEventListener(META_WORLD_LAYER_EVENTS.bridgeChanged, render);
    if (hostElement.__nvEquationColliderCleanup === cleanup) {
      delete hostElement.__nvEquationColliderCleanup;
    }
  }

  function render() {
    if (!hostElement.isConnected) {
      cleanup();
      return;
    }
    renderEquationColliderWidget(hostElement);
  }

  hostElement.__nvEquationColliderCleanup = cleanup;
  window.addEventListener(META_WORLD_LAYER_EVENTS.bridgeChanged, render);
  renderEquationColliderWidget(hostElement);
}
