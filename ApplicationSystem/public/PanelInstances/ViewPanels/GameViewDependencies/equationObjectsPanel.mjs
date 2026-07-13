// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/equationObjectsPanel.mjs
// Dedicated equation-object panel for graph-calculator-style Meta World object editing.

import { createFloatingInventoryPanel } from "/PanelInstances/InfoPanels/PlayerInventory.mjs";
import { getActiveMetaWorldLayerBridge } from "/MetaWorld/MetaWorldLayerState.mjs";
import {
  DEFAULT_WORLD_OBJECT_MATERIAL_FILE,
  DEFAULT_WORLD_OBJECT_MATERIAL_ID,
  isLiquidWorldObjectMaterial,
  loadWorldObjectMaterialCatalog,
  materialFileForWorldObjectMaterial,
  readWorldObjectMatterState,
  readWorldObjectPhysicsMaterialId,
} from "/MetaWorld/Materials/WorldObjectMaterialDefaults.mjs";
import {
  makePlaneColliderRef,
  isEquationInequalityConfig,
  normalizePlaneEquationConfig,
  parseAxisInequalityText,
  expressionUsesTimeVariable,
  resizeEquationColliderPlaneMesh,
  syncPlaneColliderRef,
  syncPlaneWaterVolumeRef
} from "./equationColliderTool.mjs";

const DEFAULT_PLANE = {
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
  expression: "z = 0",
  equationExpression: "z = 0"
};

const DEFAULT_MATERIAL_OPTION = {
  materialName: "Physics Solid",
  displayName: "Physics Solid",
  materialId: DEFAULT_WORLD_OBJECT_MATERIAL_ID,
  materialFile: DEFAULT_WORLD_OBJECT_MATERIAL_FILE,
  materialJSONfile: "Materials/Solids/PhysicsSolid.json",
  matterState: "",
};

function materialOptionValue(entry) {
  return entry?.materialFile || (entry?.materialId ? materialFileForWorldObjectMaterial(entry.materialId) : "");
}

function materialFileName(value) {
  return String(value || "").split("/").pop().toLowerCase();
}

function materialEntryMatchesHint(entry, hint = {}) {
  if (!entry) return false;
  const entryFile = materialOptionValue(entry);
  const hintFile = hint.materialFile || hint.physicsMaterialFile || "";
  const hintId = hint.materialId || hint.physicsMaterialId || "";
  if (hintFile && (entryFile === hintFile || materialFileName(entryFile) === materialFileName(hintFile))) return true;
  if (hintId && String(entry.materialId || "").toLowerCase() === String(hintId).toLowerCase()) return true;
  return false;
}

function isLiquidMaterialEntry(entry) {
  return isLiquidWorldObjectMaterial(entry || {});
}

function parseNumber(value, fallback) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

function firstColorHex(target) {
  const material = Array.isArray(target?.material) ? target.material[0] : target?.material;
  return material?.color?.isColor ? `#${material.color.getHexString()}` : DEFAULT_PLANE.color;
}

function applyColor(target, colorHex, THREE, options = {}) {
  const liquid = options.liquid === true || options.water === true;
  const materials = Array.isArray(target?.material) ? target.material : [target?.material];
  materials.forEach((mat) => {
    if (!mat) return;
    if (mat.color) mat.color.set(colorHex);
    mat.transparent = true;
    mat.opacity = liquid ? 0.48 : (!Number.isFinite(mat.opacity) || mat.opacity > 0.5 ? 0.34 : mat.opacity);
    mat.depthWrite = false;
    mat.side = THREE.DoubleSide;
    if (mat.emissive?.set) mat.emissive.set(colorHex);
    if (Number.isFinite(mat.emissiveIntensity) || liquid) mat.emissiveIntensity = liquid ? 0.22 : Math.min(mat.emissiveIntensity || 0.18, 0.22);
  });
}

function parseAxisInequality(text) {
  return parseAxisInequalityText(text);
}

function round3(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}

function vec3FromObject(object) {
  return [round3(object?.x), round3(object?.y), round3(object?.z)];
}

function makeEquationLayerDefinition(mesh, config = mesh?.userData?.equationCollider || {}) {
  const props = normalizePlaneEquationConfig(config);
  const inequality = mesh?.userData?.nvType === "equation-inequality" || props.inequality === true;
  const expression = mesh?.userData?.equationExpression || props.expression || "";
  const temporal = mesh?.userData?.equationTemporal === true || props.equationTemporal === true || expressionUsesTimeVariable(expression);
  const operator = mesh?.userData?.equationInequalityOperator || props.operator || "";
  const inequalitySide = mesh?.userData?.equationInequalitySide || props.inequalitySide || "negative";
  const materialId = readWorldObjectPhysicsMaterialId(mesh?.userData || config, DEFAULT_WORLD_OBJECT_MATERIAL_ID);
  const materialFile = mesh?.userData?.physicsMaterialFile || config.physicsMaterialFile || materialFileForWorldObjectMaterial(materialId);
  const matterState = readWorldObjectMatterState(mesh?.userData || {}, readWorldObjectMatterState(config));
  const liquid = matterState === "liquid";
  const def = {
    id: mesh?.userData?.metaWorldLayerId || undefined,
    type: inequality ? "equation-inequality" : "equation-collider-plane",
    position: vec3FromObject(mesh?.position),
    color: firstColorHex(mesh),
    physicsMaterialId: materialId || undefined,
    physicsMaterialFile: materialFile || undefined,
    MatterState: matterState || undefined,
    isLiquid: liquid || undefined,
    isSolid: liquid || inequality ? false : mesh?.userData?.isSolid !== false,
    collider: liquid || inequality ? false : Boolean(mesh?.userData?.colliderRef),
    equationCollider: {
      kind: inequality ? "plane-inequality" : "plane",
      a: round3(props.a),
      b: round3(props.b),
      c: round3(props.c),
      d: round3(props.d),
      xmin: round3(props.xmin),
      xmax: round3(props.xmax),
      ymin: round3(props.ymin),
      ymax: round3(props.ymax),
      zmin: round3(props.zmin),
      zmax: round3(props.zmax),
      thickness: round3(props.thickness),
      boundX: props.boundX === true,
      boundY: props.boundY === true,
      boundZ: props.boundZ === true,
      inequality,
      operator,
      inequalitySide,
      expression,
      equationTemporal: temporal || undefined,
      equationBaseExpression: temporal ? expression : undefined
    }
  };
  if (inequality) {
    def.inequality = true;
    def.operator = operator;
    def.inequalitySide = inequalitySide;
    def.equationExpression = expression;
  }
  if (temporal) {
    def.equationTemporal = true;
    def.equationBaseExpression = expression;
  }
  if (liquid) {
    def.isLiquid = true;
    def.MatterState = matterState;
    def.equationLiquidSide = mesh.userData.equationLiquidSide || mesh.userData.equationWaterSide || inequalitySide;
    def.equationLiquidInfinite = mesh.userData.equationLiquidInfinite !== false && mesh.userData.equationWaterInfinite !== false;
  }
  if (mesh?.visible === false) def.hidden = true;
  return def;
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

async function ensureEquationLayerBridge() {
  const existing = getActiveMetaWorldLayerBridge?.();
  if (typeof existing?.upsertObjectLayerFromMesh === "function") return existing;

  const ctx = window.VRWorldContext;
  if (!ctx?.THREE || !ctx?.scene || !Array.isArray(ctx.objects)) return null;
  const worldData = ctx.currentWorldDefinition && typeof ctx.currentWorldDefinition === "object"
    ? ctx.currentWorldDefinition
    : {
        version: 1,
        worldType: "NodevisionMetaWorld",
        name: String(ctx.currentWorldPath || window.selectedFilePath || "Meta World").split("/").pop() || "Meta World",
        type: "meta-world",
        objects: []
      };
  if (!Array.isArray(worldData.objects)) worldData.objects = [];
  ctx.currentWorldDefinition = worldData;
  if (ctx.state) ctx.state.currentWorldDefinition = JSON.parse(JSON.stringify(worldData));

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
    camera: ctx.camera
  });
  return getActiveMetaWorldLayerBridge?.() || null;
}

async function syncEquationLayer(mesh, reason = "equationObjectChanged") {
  if (!mesh?.isMesh) return null;
  const bridge = await ensureEquationLayerBridge();
  if (typeof bridge?.upsertObjectLayerFromMesh !== "function") return null;
  const def = makeEquationLayerDefinition(mesh);
  return bridge.upsertObjectLayerFromMesh({ mesh, def, reason });
}

export function createEquationObjectsPanel({ THREE, controller, colliders, waterVolumes, hostPanel = null, canvas = null }) {
  let visible = false;
  let activeTarget = null;

  const floatingPanel = createFloatingInventoryPanel({
    title: "Equation / Inequality Objects",
    closeBehavior: "hide",
    onRequestClose: () => {
      visible = false;
      activeTarget = null;
      floatingPanel.setVisible(false);
    }
  });
  floatingPanel.setVisible(false);

  function getAnchorRect() {
    const rect = canvas?.getBoundingClientRect?.() || hostPanel?.getBoundingClientRect?.() || null;
    if (rect && rect.width > 0 && rect.height > 0) return rect;
    return { left: 0, top: 96, right: window.innerWidth, bottom: window.innerHeight, width: window.innerWidth, height: Math.max(320, window.innerHeight - 96) };
  }

  function attachAsRightPane() {
    const rect = getAnchorRect();
    const width = Math.min(420, Math.max(340, rect.width * 0.34));
    Object.assign(floatingPanel.panel.style, {
      position: "fixed",
      left: Math.max(0, rect.right - width) + "px",
      top: Math.max(0, rect.top) + "px",
      width: width + "px",
      minWidth: "320px",
      maxWidth: Math.max(340, rect.width) + "px",
      height: Math.max(320, rect.height) + "px",
      maxHeight: Math.max(320, rect.height) + "px",
      borderLeft: "1px solid rgba(97, 214, 214, 0.55)",
      boxShadow: "-12px 0 26px rgba(0, 0, 0, 0.32)",
      zIndex: "22030"
    });
  }

  function showAttachedPane() {
    visible = true;
    floatingPanel.setVisible(true);
    floatingPanel.undock();
    attachAsRightPane();
  }

  const handleWindowResize = () => {
    if (visible) attachAsRightPane();
  };
  window.addEventListener("resize", handleWindowResize);

  const root = document.createElement("div");
  root.style.display = "flex";
  root.style.flexDirection = "column";
  root.style.gap = "10px";
  root.style.font = "12px/1.35 monospace";
  root.style.minWidth = "360px";
  floatingPanel.content.appendChild(root);

  const equationLine = document.createElement("div");
  equationLine.style.fontSize = "14px";
  equationLine.style.fontWeight = "600";
  root.appendChild(equationLine);

  const quickLabel = document.createElement("label");
  quickLabel.style.display = "grid";
  quickLabel.style.gap = "4px";
  quickLabel.textContent = "Equation / Inequality";
  const quickInequalityInput = document.createElement("input");
  quickInequalityInput.type = "text";
  quickInequalityInput.placeholder = "z = 0 or z < 100";
  quickLabel.appendChild(quickInequalityInput);
  root.appendChild(quickLabel);

  const grid = document.createElement("div");
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "repeat(4, minmax(0, 1fr))";
  grid.style.gap = "8px";
  root.appendChild(grid);

  function addNumber(labelText, value, step = "0.1") {
    const label = document.createElement("label");
    label.style.display = "flex";
    label.style.flexDirection = "column";
    label.style.gap = "4px";
    label.textContent = labelText;
    const input = document.createElement("input");
    input.type = "number";
    input.step = step;
    input.value = String(value);
    label.appendChild(input);
    grid.appendChild(label);
    return input;
  }

  const aInput = addNumber("A", DEFAULT_PLANE.a);
  const bInput = addNumber("B", DEFAULT_PLANE.b);
  const cInput = addNumber("C", DEFAULT_PLANE.c);
  const dInput = addNumber("D", DEFAULT_PLANE.d);
  const xminInput = addNumber("X Min", DEFAULT_PLANE.xmin, "1");
  const xmaxInput = addNumber("X Max", DEFAULT_PLANE.xmax, "1");
  const yminInput = addNumber("Y Min", DEFAULT_PLANE.ymin, "1");
  const ymaxInput = addNumber("Y Max", DEFAULT_PLANE.ymax, "1");
  const zminInput = addNumber("Z Min", DEFAULT_PLANE.zmin, "1");
  const zmaxInput = addNumber("Z Max", DEFAULT_PLANE.zmax, "1");
  const depthInput = addNumber("Depth", DEFAULT_PLANE.thickness, "0.05");
  depthInput.min = "0.02";

  const colorInput = document.createElement("input");
  colorInput.type = "color";
  colorInput.value = DEFAULT_PLANE.color;
  const colorLabel = document.createElement("label");
  colorLabel.style.display = "flex";
  colorLabel.style.flexDirection = "column";
  colorLabel.style.gap = "4px";
  colorLabel.textContent = "Color";
  colorLabel.appendChild(colorInput);
  grid.appendChild(colorLabel);

  const boundsRow = document.createElement("div");
  boundsRow.style.display = "flex";
  boundsRow.style.alignItems = "center";
  boundsRow.style.gap = "12px";
  boundsRow.style.flexWrap = "wrap";
  root.appendChild(boundsRow);

  function addBoundToggle(labelText) {
    const label = document.createElement("label");
    label.style.display = "inline-flex";
    label.style.alignItems = "center";
    label.style.gap = "6px";
    const input = document.createElement("input");
    input.type = "checkbox";
    label.appendChild(input);
    label.appendChild(document.createTextNode(labelText));
    boundsRow.appendChild(label);
    return input;
  }

  const boundXInput = addBoundToggle("Bound X");
  const boundYInput = addBoundToggle("Bound Y");
  const boundZInput = addBoundToggle("Bound Z");

  const toggleRow = document.createElement("div");
  toggleRow.style.display = "flex";
  toggleRow.style.alignItems = "center";
  toggleRow.style.gap = "12px";
  toggleRow.style.flexWrap = "wrap";
  root.appendChild(toggleRow);

  const colliderLabel = document.createElement("label");
  colliderLabel.style.display = "inline-flex";
  colliderLabel.style.alignItems = "center";
  colliderLabel.style.gap = "6px";
  const colliderInput = document.createElement("input");
  colliderInput.type = "checkbox";
  colliderInput.checked = true;
  colliderLabel.appendChild(colliderInput);
  colliderLabel.appendChild(document.createTextNode("Collider"));
  toggleRow.appendChild(colliderLabel);

  let materialCatalog = [DEFAULT_MATERIAL_OPTION];
  let materialSelectionHint = null;
  let selectedLiquidInfinite = true;

  const materialLabel = document.createElement("label");
  materialLabel.style.display = "inline-flex";
  materialLabel.style.alignItems = "center";
  materialLabel.style.gap = "6px";
  materialLabel.appendChild(document.createTextNode("Material"));
  const materialSelect = document.createElement("select");
  materialLabel.appendChild(materialSelect);
  toggleRow.appendChild(materialLabel);

  const waterSideSelect = document.createElement("select");
  [["negative", "Liquid: equation < 0"], ["positive", "Liquid: equation > 0"]].forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    waterSideSelect.appendChild(option);
  });
  toggleRow.appendChild(waterSideSelect);

  const modeLine = document.createElement("div");
  modeLine.style.opacity = "0.82";
  toggleRow.appendChild(modeLine);

  const statusLine = document.createElement("div");
  statusLine.style.opacity = "0.85";
  root.appendChild(statusLine);

  const buttonRow = document.createElement("div");
  buttonRow.style.display = "flex";
  buttonRow.style.gap = "8px";
  root.appendChild(buttonRow);

  const insertBtn = document.createElement("button");
  insertBtn.type = "button";
  insertBtn.textContent = "Insert Object";
  buttonRow.appendChild(insertBtn);

  const applyBtn = document.createElement("button");
  applyBtn.type = "button";
  applyBtn.textContent = "Apply To Selected";
  buttonRow.appendChild(applyBtn);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "Close";
  buttonRow.appendChild(closeBtn);

  function updateEquationLine() {
    const expression = String(quickInequalityInput.value || "").trim();
    if (expression) {
      equationLine.textContent = expression;
      return;
    }
    equationLine.textContent = (aInput.value || 0) + "x + " + (bInput.value || 0) + "y + " + (cInput.value || 0) + "z + " + (dInput.value || 0) + " = 0";
  }

  function normalizePanelWaterSide(value) {
    return String(value || "negative").toLowerCase() === "positive" ? "positive" : "negative";
  }


  function findMaterialEntry(hint = {}) {
    const entries = materialCatalog.length > 0 ? materialCatalog : [DEFAULT_MATERIAL_OPTION];
    if (typeof hint === "string") {
      const selected = entries.find((entry) => materialOptionValue(entry) === hint || entry.materialId === hint);
      if (selected) return selected;
    } else {
      const exact = entries.find((entry) => materialEntryMatchesHint(entry, hint));
      if (exact) return exact;
      if (readWorldObjectMatterState(hint) === "liquid") {
        const liquid = entries.find(isLiquidMaterialEntry);
        if (liquid) return liquid;
      }
    }
    return entries.find((entry) => entry.materialId === DEFAULT_WORLD_OBJECT_MATERIAL_ID) || entries[0] || DEFAULT_MATERIAL_OPTION;
  }

  function populateMaterialSelect(hint = materialSelectionHint || materialSelect.value) {
    const selectedEntry = findMaterialEntry(hint || {});
    materialSelect.innerHTML = "";
    (materialCatalog.length > 0 ? materialCatalog : [DEFAULT_MATERIAL_OPTION]).forEach((entry) => {
      const option = document.createElement("option");
      option.value = materialOptionValue(entry);
      option.textContent = entry.materialName || entry.displayName || entry.materialId || option.value;
      materialSelect.appendChild(option);
    });
    materialSelect.value = materialOptionValue(selectedEntry);
  }

  function getSelectedMaterialEntry() {
    return findMaterialEntry(materialSelect.value);
  }

  function setMaterialSelection(hint = {}) {
    materialSelectionHint = hint;
    populateMaterialSelect(hint);
  }

  populateMaterialSelect();
  void loadWorldObjectMaterialCatalog()
    .then((catalog) => {
      if (Array.isArray(catalog) && catalog.length > 0) materialCatalog = catalog;
      populateMaterialSelect(materialSelectionHint || materialSelect.value);
      refreshWaterControls();
    })
    .catch((err) => console.warn("Equation object material catalog failed to load:", err));

  function refreshBoundControls() {
    xminInput.disabled = boundXInput.checked !== true;
    xmaxInput.disabled = boundXInput.checked !== true;
    yminInput.disabled = boundYInput.checked !== true;
    ymaxInput.disabled = boundYInput.checked !== true;
    zminInput.disabled = boundZInput.checked !== true;
    zmaxInput.disabled = boundZInput.checked !== true;
  }

  function refreshWaterControls() {
    const liquidEnabled = isLiquidMaterialEntry(getSelectedMaterialEntry());
    const inequalityEnabled = parseAxisInequality(quickInequalityInput.value)?.inequality === true
      || String(activeTarget?.userData?.nvType || "").toLowerCase() === "equation-inequality";
    colliderInput.disabled = liquidEnabled || inequalityEnabled;
    waterSideSelect.disabled = !liquidEnabled && !inequalityEnabled;
    if (liquidEnabled || inequalityEnabled) colliderInput.checked = false;
    refreshBoundControls();
  }

  function applyQuickInequality(options = {}) {
    const text = String(quickInequalityInput.value || "").trim();
    if (!text) return true;
    const parsed = parseAxisInequality(text);
    if (!parsed) return false;
    aInput.value = String(parsed.a);
    bInput.value = String(parsed.b);
    cInput.value = String(parsed.c);
    dInput.value = String(parsed.d);
    waterSideSelect.value = parsed.liquidSide || parsed.waterSide;
    const boundInputs = {
      x: [xminInput, xmaxInput],
      y: [yminInput, ymaxInput],
      z: [zminInput, zmaxInput]
    }[parsed.axis];
    if (boundInputs) {
      const currentMin = parseNumber(boundInputs[0].value, parsed.limit - 30);
      const currentMax = parseNumber(boundInputs[1].value, parsed.limit + 30);
      const span = Math.max(1, Math.abs(currentMax - currentMin) || 30);
      if (parsed.operator.startsWith("<")) {
        boundInputs[0].value = String(parsed.limit - span);
        boundInputs[1].value = String(parsed.limit);
      } else {
        boundInputs[0].value = String(parsed.limit);
        boundInputs[1].value = String(parsed.limit + span);
      }
    }
    if (options.markLiquid === true) {
      const liquidEntry = materialCatalog.find(isLiquidMaterialEntry);
      if (liquidEntry) setMaterialSelection(liquidEntry);
      selectedLiquidInfinite = true;
    }
    updateEquationLine();
    refreshWaterControls();
    return true;
  }

  function prepareQuickInequality() {
    if (applyQuickInequality()) return true;
    statusLine.textContent = "Use an axis equation or inequality like z = sin(t) or z < 100 + t.";
    return false;
  }

  function readConfig() {
    const expression = String(quickInequalityInput.value || "").trim();
    const parsed = parseAxisInequality(expression);
    const temporal = parsed?.equationTemporal === true || expressionUsesTimeVariable(expression);
    const timeSeconds = window.VRWorldContext?.temporalController?.getTimeSeconds?.() ?? 0;
    const selectedMaterial = getSelectedMaterialEntry();
    const matterState = readWorldObjectMatterState(selectedMaterial);
    const liquid = matterState === "liquid";
    const materialId = selectedMaterial?.materialId || readWorldObjectPhysicsMaterialId(selectedMaterial, DEFAULT_WORLD_OBJECT_MATERIAL_ID);
    const materialFile = materialOptionValue(selectedMaterial) || materialFileForWorldObjectMaterial(materialId);
    const inequality = parsed?.inequality === true || liquid;
    const operator = parsed?.inequality === true ? parsed.operator : (inequality ? (normalizePanelWaterSide(waterSideSelect.value) === "positive" ? ">=" : "<=") : "");
    const inequalitySide = parsed?.inequalitySide || normalizePanelWaterSide(waterSideSelect.value);
    const current = normalizePlaneEquationConfig({
      a: parseNumber(aInput.value, DEFAULT_PLANE.a),
      b: parseNumber(bInput.value, DEFAULT_PLANE.b),
      c: parseNumber(cInput.value, DEFAULT_PLANE.c),
      d: parseNumber(dInput.value, DEFAULT_PLANE.d),
      xmin: parseNumber(xminInput.value, DEFAULT_PLANE.xmin),
      xmax: parseNumber(xmaxInput.value, DEFAULT_PLANE.xmax),
      ymin: parseNumber(yminInput.value, DEFAULT_PLANE.ymin),
      ymax: parseNumber(ymaxInput.value, DEFAULT_PLANE.ymax),
      zmin: parseNumber(zminInput.value, DEFAULT_PLANE.zmin),
      zmax: parseNumber(zmaxInput.value, DEFAULT_PLANE.zmax),
      thickness: parseNumber(depthInput.value, DEFAULT_PLANE.thickness),
      boundX: boundXInput.checked === true,
      boundY: boundYInput.checked === true,
      boundZ: boundZInput.checked === true,
      inequality,
      operator,
      inequalitySide,
      expression,
      equationTemporal: temporal,
      equationBaseExpression: temporal ? expression : "",
      timeSeconds
    });
    return {
      ...current,
      collider: liquid || inequality ? false : colliderInput.checked === true,
      color: colorInput.value || DEFAULT_PLANE.color,
      inequality,
      operator,
      inequalitySide,
      expression,
      equationExpression: expression,
      equationTemporal: temporal,
      equationBaseExpression: temporal ? expression : "",
      timeSeconds,
      physicsMaterialId: materialId,
      physicsMaterialFile: materialFile,
      materialName: selectedMaterial?.materialName || selectedMaterial?.displayName || materialId,
      MatterState: matterState || undefined,
      matterState,
      isLiquid: liquid,
      ...(liquid ? {
        liquid: true,
        liquidSide: inequalitySide,
        liquidInfinite: selectedLiquidInfinite !== false,
        equationLiquidSide: inequalitySide,
        equationLiquidInfinite: selectedLiquidInfinite !== false,
      } : {})
    };
  }

  function setConfig(config = {}, target = null) {
    const normalized = normalizePlaneEquationConfig(config);
    const targetData = target?.userData || {};
    const targetType = String(targetData.nvType || "").toLowerCase();
    const inequalityEnabled = target
      ? targetType === "equation-inequality" || normalized.inequality === true
      : (normalized.inequality === true || isEquationInequalityConfig(config));
    const expressionText = target
      ? (targetData.equationExpression || normalized.expression || config.expression || config.equationExpression || "")
      : (config.expression || config.equationExpression || "");
    const legacyLiquid = targetData.isWater === true || config.isWater === true || config.water === true;
    const matterState = readWorldObjectMatterState(targetData, readWorldObjectMatterState(config, legacyLiquid ? "liquid" : ""));
    const liquidEnabled = matterState === "liquid" || targetData.isLiquid === true || config.isLiquid === true || config.liquid === true;
    const materialId = readWorldObjectPhysicsMaterialId(targetData, readWorldObjectPhysicsMaterialId(config, legacyLiquid ? "water" : DEFAULT_WORLD_OBJECT_MATERIAL_ID));
    const materialFile = targetData.physicsMaterialFile || config.physicsMaterialFile || materialFileForWorldObjectMaterial(materialId);
    setMaterialSelection({ materialFile, materialId, matterState });
    selectedLiquidInfinite = liquidEnabled
      ? (target
        ? (targetData.equationLiquidInfinite !== false && targetData.equationWaterInfinite !== false)
        : (config.liquidInfinite !== false && config.equationLiquidInfinite !== false && config.waterInfinite !== false && config.equationWaterInfinite !== false))
      : true;
    aInput.value = String(normalized.a);
    bInput.value = String(normalized.b);
    cInput.value = String(normalized.c);
    dInput.value = String(normalized.d);
    xminInput.value = String(normalized.xmin);
    xmaxInput.value = String(normalized.xmax);
    yminInput.value = String(normalized.ymin);
    ymaxInput.value = String(normalized.ymax);
    zminInput.value = String(normalized.zmin);
    zmaxInput.value = String(normalized.zmax);
    boundXInput.checked = normalized.boundX === true;
    boundYInput.checked = normalized.boundY === true;
    boundZInput.checked = normalized.boundZ === true;
    depthInput.value = String(normalized.thickness);
    quickInequalityInput.value = String(expressionText || "");
    waterSideSelect.value = normalizePanelWaterSide(targetData.equationLiquidSide || targetData.equationWaterSide || targetData.equationInequalitySide || config.liquidSide || config.equationLiquidSide || config.waterSide || config.equationWaterSide || normalized.inequalitySide);
    colliderInput.checked = liquidEnabled || inequalityEnabled ? false : (target ? Boolean(targetData.colliderRef) : config.collider !== false);
    colorInput.value = target ? firstColorHex(target) : (config.color || DEFAULT_PLANE.color);
    modeLine.textContent = target ? (inequalityEnabled ? "Editing selected inequality" : "Editing selected plane") : "New equation object";
    refreshWaterControls();
    updateEquationLine();
  }

  function syncTargetCollider(target, colliderEnabled) {
    const existing = target?.userData?.colliderRef;
    if (!colliderEnabled && existing) {
      const idx = colliders.indexOf(existing);
      if (idx !== -1) colliders.splice(idx, 1);
      delete target.userData.colliderRef;
      return;
    }
    if (colliderEnabled && !existing) {
      const ref = makePlaneColliderRef(THREE, target);
      colliders.push(ref);
      target.userData.colliderRef = ref;
      return;
    }
    if (colliderEnabled && existing) syncPlaneColliderRef(THREE, target);
  }

  function applyToTarget(target) {
    if (!target) return false;
    if (!prepareQuickInequality()) return false;
    const config = readConfig();
    const liquidEnabled = config.isLiquid === true || config.matterState === "liquid";
    resizeEquationColliderPlaneMesh(THREE, target, config);
    target.userData.nvType = config.inequality === true ? "equation-inequality" : "equation-collider-plane";
    target.userData.physicsMaterialId = config.physicsMaterialId;
    target.userData.physicsMaterialFile = config.physicsMaterialFile;
    target.userData.materialName = config.materialName;
    target.userData.MatterState = config.MatterState || "";
    target.userData.matterState = config.matterState || "";
    target.userData.isLiquid = liquidEnabled;
    target.userData.isWater = false;
    delete target.userData.materialType;
    if (liquidEnabled) {
      target.userData.equationLiquidSide = config.liquidSide;
      target.userData.equationLiquidInfinite = config.liquidInfinite !== false;
    } else {
      delete target.userData.equationLiquidSide;
      delete target.userData.equationLiquidInfinite;
    }
    delete target.userData.equationWaterSide;
    delete target.userData.equationWaterInfinite;
    target.userData.equationExpression = config.expression || "";
    target.userData.equationTemporal = config.equationTemporal === true;
    target.userData.equationBaseExpression = config.equationBaseExpression || (config.equationTemporal ? config.expression : "");
    target.userData.equationTimeSeconds = config.timeSeconds || 0;
    target.userData.equationInequalityOperator = config.operator || "";
    target.userData.equationInequalitySide = config.inequalitySide || config.liquidSide;
    target.userData.isSolid = liquidEnabled ? false : config.collider;
    target.userData.physicsEnabled = liquidEnabled ? false : config.collider;
    syncTargetCollider(target, !liquidEnabled && config.collider);
    syncPlaneWaterVolumeRef(THREE, waterVolumes, target, config, {
      liquid: liquidEnabled,
      side: config.liquidSide,
      infinite: config.liquidInfinite,
      buoyancyScale: Number.isFinite(config.buoyancyScale) ? config.buoyancyScale : 1
    });
    applyColor(target, config.color, THREE, { liquid: liquidEnabled });
    void syncEquationLayer(target, "equationObjectUpdated");
    refreshWaterControls();
    statusLine.textContent = liquidEnabled ? "Liquid inequality volume updated." : (config.inequality ? "Equation inequality volume updated." : "Equation object updated.");
    return true;
  }

  [aInput, bInput, cInput, dInput].forEach((input) => input.addEventListener("input", () => {
    quickInequalityInput.value = "";
    updateEquationLine();
    refreshWaterControls();
  }));
  quickInequalityInput.addEventListener("change", () => {
    if (prepareQuickInequality()) {
      const parsed = parseAxisInequality(quickInequalityInput.value);
      statusLine.textContent = isLiquidMaterialEntry(getSelectedMaterialEntry())
        ? "Liquid inequality volume prepared."
        : (parsed?.inequality === true ? "Inequality volume prepared." : "Equation plane prepared.");
    }
  });
  materialSelect.addEventListener("change", () => {
    materialSelectionHint = materialSelect.value;
    if (isLiquidMaterialEntry(getSelectedMaterialEntry())) {
      colliderInput.checked = false;
      selectedLiquidInfinite = true;
      statusLine.textContent = "Liquid material uses this equation as a volume bound.";
    }
    refreshWaterControls();
  });
  waterSideSelect.addEventListener("change", refreshWaterControls);
  [boundXInput, boundYInput, boundZInput].forEach((input) => input.addEventListener("change", refreshBoundControls));

  insertBtn.addEventListener("click", () => {
    if (!prepareQuickInequality()) return;
    const config = readConfig();
    const mesh = controller?.addPlane?.(config);
    if (mesh) {
      activeTarget = mesh;
      statusLine.textContent = config.isLiquid ? "Liquid inequality volume inserted." : (config.inequality ? "Equation inequality volume inserted." : "Equation object plane inserted.");
      void syncEquationLayer(mesh, config.isLiquid ? "liquidEquationLayerAdded" : "equationObjectLayerAdded");
      setConfig(mesh.userData.equationCollider, mesh);
    } else {
      statusLine.textContent = "Open a Meta World editor before inserting.";
    }
  });

  applyBtn.addEventListener("click", () => {
    if (!activeTarget) {
      statusLine.textContent = "No equation object selected.";
      return;
    }
    applyToTarget(activeTarget);
  });

  closeBtn.addEventListener("click", () => {
    visible = false;
    activeTarget = null;
    floatingPanel.setVisible(false);
  });

  setConfig(DEFAULT_PLANE);

  return {
    open(config = DEFAULT_PLANE) {
      activeTarget = null;
      setConfig(config);
      statusLine.textContent = "Configure an equation or inequality object, then insert it into the world.";
      showAttachedPane();
    },
    openForTarget(target) {
      if (!target) return false;
      void syncEquationLayer(target, "equationObjectLayerRecovered");
      activeTarget = target;
      setConfig(target.userData?.equationCollider || DEFAULT_PLANE, target);
      statusLine.textContent = "Edit the selected equation object.";
      showAttachedPane();
      return true;
    },
    isVisible() {
      return visible;
    },
    syncTargetLayer(target, reason = "equationObjectUpdated") {
      void syncEquationLayer(target, reason);
      return true;
    },
    dispose() {
      window.removeEventListener("resize", handleWindowResize);
      floatingPanel.dispose();
    }
  };
}
