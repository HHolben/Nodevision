// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/equationObjectLayers.mjs
// This module serializes equation meshes into layer definitions and connects them to the active virtual-world layer bridge.

import { getActiveMetaWorldLayerBridge } from "/MetaWorld/MetaWorldLayerState.mjs";
import { DEFAULT_WORLD_OBJECT_MATERIAL_ID, materialFileForWorldObjectMaterial,
  readWorldObjectMatterState, readWorldObjectPhysicsMaterialId } from "/MetaWorld/Materials/WorldObjectMaterialDefaults.mjs";
import { normalizePlaneEquationConfig, expressionUsesTimeVariable } from "./equationColliderTool.mjs";
import { firstColorHex, firstMaterialOpacity } from "./equationObjectDefaults.mjs";

// Mesh properties use the same definition for insertion, updates, and recovery.
export function round3(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}

export function vec3FromObject(object) {
  return [round3(object?.x), round3(object?.y), round3(object?.z)];
}

export function makeEquationLayerDefinition(mesh, config = mesh?.userData?.equationCollider || {}) {
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
    rotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z],
    scale: props.infinite ? vec3FromObject(mesh.scale) : undefined,
    color: firstColorHex(mesh),
    opacity: firstMaterialOpacity(mesh),
    physicsMaterialId: materialId || undefined,
    physicsMaterialFile: materialFile || undefined,
    MatterState: matterState || undefined,
    isLiquid: liquid || undefined,
    isSolid: liquid || inequality ? false : mesh?.userData?.isSolid !== false,
    collider: liquid || inequality ? false : Boolean(mesh?.userData?.colliderRef),
    equationCollider: {
      infinite: props.infinite || undefined,
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

export function readLayerObjectId(def, index) {
  const candidates = [def?.id, def?.tag, def?.name, def?.label, def?.title];
  const explicit = candidates.find((value) => typeof value === "string" && value.trim());
  return explicit ? explicit.trim() : "metaworld-object-" + index;
}

export function createLayerEntries(worldData, ctx) {
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

export async function ensureEquationLayerBridge() {
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

export async function syncEquationLayer(mesh, reason = "equationObjectChanged") {
  if (!mesh?.isMesh) return null;
  const bridge = await ensureEquationLayerBridge();
  if (typeof bridge?.upsertObjectLayerFromMesh !== "function") return null;
  const def = makeEquationLayerDefinition(mesh);
  return bridge.upsertObjectLayerFromMesh({ mesh, def, reason });
}
