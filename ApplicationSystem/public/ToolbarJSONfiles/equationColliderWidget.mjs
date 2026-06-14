// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/equationColliderWidget.mjs
// This widget renders Insert > Equation Object controls for MetaWorld editing. The button creates expression layers through the shared MetaWorld layer bridge.

import { setStatus } from "/StatusBar.mjs";
import { addMetaWorldExpressionLayer, getActiveMetaWorldLayerBridge, META_WORLD_LAYER_EVENTS } from "/MetaWorld/MetaWorldLayerState.mjs";

const BLANK_EXPRESSION_LAYER = {
  expression: "z = 0",
  type: "functionSurface",
  name: "Blank Expression",
  domain: { autoSize: true },
  collider: { enabled: true, type: "heightfield" },
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
      },
    },
    environment: {
      skyColor: "#ffffff",
      floorColor: "#d8dee4",
      backgroundMode: "color",
      backgroundImage: "",
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

  const bridge = getActiveMetaWorldLayerBridge();
  if (!bridge?.addExpressionLayer) {
    hostElement.appendChild(document.createTextNode("Open a MetaWorld editor to insert expression layers."));
    setStatus("Open a MetaWorld editor before inserting expression layers.");
    return;
  }

  const addSurface = makePresetButton("Add Expression Layer", "z = sin(x) * cos(y)", "functionSurface", "Expression Surface");
  const addCurve = makePresetButton("Add Curve", "y = x^2", "functionCurve", "Expression Curve");
  const addParametric = makePresetButton("Add Parametric Curve", "x = cos(t), y = sin(t), z = t / 10", "parametricCurve", "Parametric Curve");

  [addSurface, addCurve, addParametric].forEach((element) => hostElement.appendChild(element));
}

export function initToolbarWidget(hostElement, item = {}) {
  if (!hostElement) return;

  if (item?.heading === "Equation Object") {
    void insertBlankExpressionLayer();
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
