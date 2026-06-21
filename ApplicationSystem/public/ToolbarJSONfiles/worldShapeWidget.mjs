// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/worldShapeWidget.mjs
// Renders the Insert > Shape sub-toolbar for adding primitive 3D solids to MetaWorld scenes.

import { getActiveMetaWorldLayerBridge, META_WORLD_LAYER_EVENTS } from "/MetaWorld/MetaWorldLayerState.mjs";
import { setStatus } from "/StatusBar.mjs";

const SHAPES = [
  { type: "box", label: "Cube", color: "#6ea8ff", size: [1, 1, 1] },
  { type: "sphere", label: "Sphere", color: "#7dd3fc", size: [0.5] },
  { type: "pyramid", label: "Pyramid", color: "#f4b860", size: [0.75, 1.1] },
  { type: "cylinder", label: "Cylinder", color: "#b8a66f", size: [0.5, 1] },
  { type: "cone", label: "Cone", color: "#fb8b6b", size: [0.5, 1.1] },
  { type: "torus", label: "Torus", color: "#b48cff", size: [0.65, 0.18] },
];

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
  if (existing?.addObjectLayer) return existing;

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

function readCameraPlacement() {
  const ctx = window.VRWorldContext;
  const camera = ctx?.camera;
  const controlsObject = ctx?.controls?.getObject?.();
  const base = controlsObject?.position || camera?.position;
  if (!ctx?.THREE || !base) return [0, 1, -2];

  const direction = new ctx.THREE.Vector3(0, 0, -1);
  camera?.getWorldDirection?.(direction);
  if (!Number.isFinite(direction.x) || direction.lengthSq() < 0.0001) direction.set(0, 0, -1);
  const position = base.clone().add(direction.normalize().multiplyScalar(2.4));
  position.y = Math.max(0.65, position.y - 0.45);
  return [
    Math.round(position.x * 100) / 100,
    Math.round(position.y * 100) / 100,
    Math.round(position.z * 100) / 100,
  ];
}

function makeShapeDefinition(shape) {
  const suffix = Date.now().toString(36) + "-" + Math.floor(Math.random() * 1000);
  const id = "shape-" + shape.type + "-" + suffix;
  return {
    id,
    tag: id,
    name: shape.label,
    type: shape.type,
    position: readCameraPlacement(),
    size: shape.size.slice(),
    color: shape.color,
    isSolid: true,
    breakable: true,
  };
}

function makeButton(shape) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = shape.label;
  button.title = "Add " + shape.label;
  button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const bridge = await ensureEditableMetaWorldBridge();
    if (!bridge?.addObjectLayer) {
      setStatus("Open a MetaWorld editor before inserting shapes.");
      return;
    }
    const added = bridge.addObjectLayer(makeShapeDefinition(shape));
    setStatus(added ? shape.label + " added to MetaWorld." : "Could not add " + shape.label + ".");
  });
  return button;
}

function render(hostElement) {
  hostElement.innerHTML = "";
  hostElement.classList.add("nv-world-shape-toolbar");

  const bridge = getActiveMetaWorldLayerBridge();
  if (!bridge?.addObjectLayer && !window.VRWorldContext?.scene) {
    hostElement.appendChild(document.createTextNode("Open a MetaWorld editor to insert 3D shapes."));
    setStatus("Open a MetaWorld editor before inserting shapes.");
    return;
  }

  SHAPES.forEach((shape) => hostElement.appendChild(makeButton(shape)));
}

export function initToolbarWidget(hostElement) {
  if (!hostElement) return;

  if (typeof hostElement.__nvWorldShapeCleanup === "function") {
    hostElement.__nvWorldShapeCleanup();
  }

  function cleanup() {
    window.removeEventListener(META_WORLD_LAYER_EVENTS.bridgeChanged, rerender);
    if (hostElement.__nvWorldShapeCleanup === cleanup) {
      delete hostElement.__nvWorldShapeCleanup;
    }
  }

  function rerender() {
    if (!hostElement.isConnected) {
      cleanup();
      return;
    }
    render(hostElement);
  }

  hostElement.__nvWorldShapeCleanup = cleanup;
  window.addEventListener(META_WORLD_LAYER_EVENTS.bridgeChanged, rerender);
  render(hostElement);
}
