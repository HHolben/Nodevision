// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/worldLoading.mjs
// This file loads a world definition from the server and builds its scene objects. The loader registers live MetaWorld layer data for side panels.

import { createEquationColliderPlaneMesh, makePlaneColliderRef } from "./equationColliderTool.mjs";
import { createTerrainSurfaceColliderRef, createTerrainSurfaceMesh } from "./TerrainTool/terrainSurfaceMesh.mjs";
import {
  clearActiveMetaWorldLayerBridge,
  notifyMetaWorldLayersChanged,
  setActiveMetaWorldLayerBridge,
} from "/MetaWorld/MetaWorldLayerState.mjs";
import {
  createDefaultExpressionLayer,
  createExpressionLayerColliderRef,
  createExpressionLayerObject,
  disposeExpressionObject,
  normalizeExpressionLayer,
} from "/MetaWorld/Expressions/ExpressionLayerObjects.mjs";

export function normalizeWorldPath(filePath) {
  if (!filePath) return "";
  const normalized = filePath.replace(/\\/g, "/");
  const notebookMarker = "/Notebook/";
  const idx = normalized.indexOf(notebookMarker);
  if (idx !== -1) return normalized.slice(idx + notebookMarker.length);
  const withoutLeading = normalized.replace(/^\/+/, "");
  if (withoutLeading.startsWith("./")) {
    return withoutLeading.slice(2);
  }
  if (withoutLeading.startsWith("Notebook/")) {
    return withoutLeading.slice("Notebook/".length);
  }
  return withoutLeading;
}

let objectFileGeometryApplier = null;
let objectFileGeometryLoaderPromise = null;
let imagePlaneTextureApplier = null;
let imagePlaneLoaderPromise = null;
let stlLoaderPromise = null;
let metaWorldRuntimePromise = null;

async function ensureMetaWorldRuntime() {
  if (!metaWorldRuntimePromise) {
    metaWorldRuntimePromise = import("/MetaWorld/MetaWorldRuntime.mjs");
  }
  return metaWorldRuntimePromise;
}

async function ensureObjectFileGeometryApplier() {
  if (objectFileGeometryApplier) return objectFileGeometryApplier;
  if (!objectFileGeometryLoaderPromise) {
    objectFileGeometryLoaderPromise = import("./objectFileLoader.mjs")
      .then((mod) => {
        objectFileGeometryApplier = mod.applyObjectFileGeometry;
        return objectFileGeometryApplier;
      })
      .catch((err) => {
        console.warn("Object file geometry loader failed to load:", err);
        objectFileGeometryLoaderPromise = null;
        objectFileGeometryApplier = null;
        return null;
      });
  }
  return objectFileGeometryLoaderPromise;
}

async function ensureStlLoader() {
  if (stlLoaderPromise) return stlLoaderPromise;
  stlLoaderPromise = import("/lib/three/STLLoader.js").then((mod) => new mod.STLLoader());
  return stlLoaderPromise;
}

async function ensureImagePlaneTextureApplier() {
  if (imagePlaneTextureApplier) return imagePlaneTextureApplier;
  if (!imagePlaneLoaderPromise) {
    imagePlaneLoaderPromise = import("./imagePlaneLoader.mjs")
      .then((mod) => {
        imagePlaneTextureApplier = mod.applyImagePlaneTexture;
        return imagePlaneTextureApplier;
      })
      .catch((err) => {
        console.warn("Image plane loader failed to load:", err);
        imagePlaneLoaderPromise = null;
        imagePlaneTextureApplier = null;
        return null;
      });
  }
  return imagePlaneLoaderPromise;
}

function disposeCurrentMetaWorld(ctx = window.VRWorldContext) {
  clearActiveMetaWorldLayerBridge();
  if (ctx?.metaWorldRuntime?.dispose) {
    ctx.metaWorldRuntime.dispose();
  }
  if (ctx) ctx.metaWorldRuntime = null;
}

function parseMetaWorldDocument(htmlText) {
  if (!String(htmlText || "").includes("nodevision-metaworld")) return null;
  const doc = new DOMParser().parseFromString(htmlText, "text/html");
  const script = doc.getElementById("nodevision-metaworld");
  if (!script || script.type !== "application/json") return null;
  return doc;
}


function readLayerObjectId(def, index) {
  const candidates = [def?.id, def?.tag, def?.name, def?.label, def?.title];
  const explicit = candidates.find((value) => typeof value === "string" && value.trim());
  return explicit ? explicit.trim() : "metaworld-object-" + index;
}

function readLayerObjectName(def, objectId, index) {
  const candidates = [def?.name, def?.title, def?.label, def?.tag, def?.id];
  const explicit = candidates.find((value) => typeof value === "string" && value.trim());
  return explicit ? explicit.trim() : objectId || "Object " + (index + 1);
}

function readLayerObjectType(def, object3d) {
  if (typeof def?.layerType === "string" && def.layerType.trim()) return def.layerType.trim();
  if (typeof def?.type === "string" && def.type.trim()) return def.type.trim();
  if (typeof object3d?.userData?.nvType === "string" && object3d.userData.nvType.trim()) return object3d.userData.nvType.trim();
  if (object3d?.isLight) return "light";
  return "mesh";
}

function isExpressionLayerType(type) {
  return type === "functionSurface" || type === "functionCurve" || type === "parametricCurve";
}

function readExpressionRenderDistance(camera) {
  const far = Number(camera?.far);
  return Number.isFinite(far) && far > 0 ? far : 1000;
}

function getExpressionLayerOptions(camera) {
  return { renderDistance: readExpressionRenderDistance(camera) };
}

function updateDefinitionVisibility(def, visible) {
  if (!def || typeof def !== "object") return;
  def.visible = visible;
  def.hidden = !visible;
}

function markMetaWorldLayersDirty(worldData) {
  if (!worldData || typeof worldData !== "object") return;
  if (!worldData.metadata || typeof worldData.metadata !== "object") worldData.metadata = {};
  worldData.metadata.visibilityDirty = true;
  worldData.metadata.layersDirty = true;
}

function updateStateWorldVisibility(state, objectId, visible) {
  const candidates = [state?.currentWorldDefinition, window.VRWorldContext?.currentWorldDefinition];
  candidates.forEach((world) => {
    const objects = Array.isArray(world?.objects) ? world.objects : [];
    const target = objects.find((entry, index) => readLayerObjectId(entry, index) === objectId);
    updateDefinitionVisibility(target, visible);
    markMetaWorldLayersDirty(world);
  });
}

function syncBridgeWorldState(state, worldData) {
  if (state) state.currentWorldDefinition = worldData ? JSON.parse(JSON.stringify(worldData)) : null;
  if (window.VRWorldContext) {
    window.VRWorldContext.currentWorldDefinition = worldData ? JSON.parse(JSON.stringify(worldData)) : null;
  }
}

function removeObjectFromArray(items, value) {
  if (!Array.isArray(items)) return;
  const idx = items.indexOf(value);
  if (idx !== -1) items.splice(idx, 1);
}

const PRIMITIVE_WORLD_OBJECT_TYPES = new Set(["box", "sphere", "cylinder", "torus", "cone", "pyramid"]);

function ensurePrimitiveSize(def) {
  const type = String(def?.type || "box").toLowerCase();
  if (Array.isArray(def.size) && def.size.length > 0) return def.size;
  if (type === "box") def.size = [1, 1, 1];
  else if (type === "sphere") def.size = [0.5];
  else if (type === "cylinder") def.size = [0.5, 1];
  else if (type === "torus") def.size = [1, 0.25];
  else if (type === "cone" || type === "pyramid") def.size = [0.5, 1];
  return def.size;
}

function createPrimitiveWorldMesh(THREE, def, materialOpts = null) {
  if (!THREE || !def || typeof def !== "object") return null;
  const type = String(def.type || "box").toLowerCase();
  if (!PRIMITIVE_WORLD_OBJECT_TYPES.has(type)) return null;
  const size = ensurePrimitiveSize(def);
  const material = new THREE.MeshStandardMaterial(materialOpts || { color: def.color || "#888" });

  if (type === "box") {
    return new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  }
  if (type === "sphere") {
    return new THREE.Mesh(new THREE.SphereGeometry(size[0], 32, 32), material);
  }
  if (type === "cylinder") {
    const radius = size[0];
    const height = size[1];
    return new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 24), material);
  }
  if (type === "cone") {
    const radius = size[0];
    const height = size[1];
    return new THREE.Mesh(new THREE.ConeGeometry(radius, height, 32), material);
  }
  if (type === "pyramid") {
    const radius = size[0];
    const height = size[1];
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 4), material);
    mesh.rotation.y = Math.PI / 4;
    return mesh;
  }
  if (type === "torus") {
    const radius = size[0];
    const tube = size[1];
    return new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 16, 64), material);
  }
  return null;
}

function makeObjectColliderRef(THREE, mesh, def, shape) {
  if (!THREE || !mesh || def?.isWater === true) return null;
  if (def?.isSolid !== true && def?.collidable !== true) return null;
  if (shape === "sphere") {
    const center = new THREE.Vector3(...def.position);
    const radius = Array.isArray(def.size) && Number.isFinite(def.size[0]) ? def.size[0] : 0.5;
    return { type: "sphere", center, radius };
  }
  mesh.updateWorldMatrix?.(true, false);
  return { type: "box", box: new THREE.Box3().setFromObject(mesh) };
}

function makeUniqueObjectId(layerEntries, preferredId, type) {
  const existing = new Set(layerEntries.map((entry) => entry.id));
  const base = String(preferredId || "shape-" + (type || "object") + "-" + Date.now().toString(36)).trim();
  let candidate = base;
  let index = 1;
  while (existing.has(candidate)) {
    candidate = base + "-" + index;
    index += 1;
  }
  return candidate;
}

export function registerMetaWorldLayerBridge({ state, filePath, worldData, layerEntries, THREE, scene, objects, colliders, camera }) {
  if (!worldData || !Array.isArray(layerEntries)) {
    clearActiveMetaWorldLayerBridge();
    return;
  }

  const sourceId = "legacy-metaworld:" + (filePath || "active");
  const history = { undoStack: [], redoStack: [], isRestoring: false, limit: 80 };
  const readBridgeExpressionOptions = () => getExpressionLayerOptions(camera || window.VRWorldContext?.camera);
  const snapshotWorldObjects = () => JSON.stringify(Array.isArray(worldData?.objects) ? worldData.objects : []);
  const recordHistorySnapshot = () => {
    if (history.isRestoring) return;
    history.undoStack.push(snapshotWorldObjects());
    if (history.undoStack.length > history.limit) history.undoStack.shift();
    history.redoStack.length = 0;
  };
  const attachLayerBreakHandler = (entry) => {
    if (!entry?.object3d) return;
    if (isExpressionLayerType(entry.def?.type)) {
      entry.object3d.userData.breakable = entry.def?.locked !== true;
      entry.object3d.userData.placedByPlayer = true;
      entry.object3d.userData.onBreakTarget = () => bridge.removeExpressionLayer(entry.id);
      return;
    }
    if (entry.def?.type === "equation-collider-plane") {
      entry.object3d.userData.breakable = true;
      entry.object3d.userData.placedByPlayer = true;
      entry.object3d.userData.onBreakTarget = () => bridge.removeObjectLayer(entry.id);
    }
  };
  const removeColliderRef = (object3d) => {
    const colliderRef = object3d?.userData?.colliderRef;
    if (!colliderRef) return;
    removeObjectFromArray(colliders, colliderRef);
    delete object3d.userData.colliderRef;
  };
  const syncExpressionLayerCollider = (entry) => {
    if (!entry?.object3d || !isExpressionLayerType(entry.def?.type)) return;
    removeColliderRef(entry.object3d);
    const enabled = entry.def?.collider?.enabled === true;
    entry.object3d.userData.isSolid = enabled;
    entry.object3d.userData.physicsEnabled = enabled;
    if (!enabled || !Array.isArray(colliders)) return;
    const colliderRef = createExpressionLayerColliderRef(THREE, entry.object3d, entry.def, readBridgeExpressionOptions()) || { type: "box", box: new THREE.Box3().setFromObject(entry.object3d) };
    colliders.push(colliderRef);
    entry.object3d.userData.colliderRef = colliderRef;
  };
  const restoreWorldObjectsSnapshot = (snapshot) => {
    let restoredDefs = [];
    try {
      restoredDefs = JSON.parse(snapshot || "[]");
    } catch (err) {
      console.warn("MetaWorld undo restore failed:", err);
      return false;
    }
    if (!Array.isArray(restoredDefs)) restoredDefs = [];

    const previousEntries = layerEntries.slice();
    const previousById = new Map(previousEntries.map((entry) => [entry.id, entry]));
    const restoredIds = new Set();
    const nextEntries = restoredDefs.map((def, index) => {
      const id = readLayerObjectId(def, index);
      const existing = previousById.get(id);
      const entry = existing || { id, def, object3d: null };
      entry.id = id;
      entry.def = def;
      restoredIds.add(id);
      return entry;
    });

    previousEntries.forEach((entry) => {
      if (restoredIds.has(entry.id)) return;
      if (entry.object3d && isExpressionLayerType(entry.def?.type)) {
        removeColliderRef(entry.object3d);
        scene?.remove?.(entry.object3d);
        removeObjectFromArray(objects, entry.object3d);
        disposeExpressionObject(entry.object3d);
      }
    });

    worldData.objects = restoredDefs;
    layerEntries.splice(0, layerEntries.length, ...nextEntries);
    layerEntries.forEach((entry) => {
      if (isExpressionLayerType(entry.def?.type)) {
        bridge.regenerateExpressionLayer(entry.id);
        return;
      }
      const visible = entry.def?.visible !== false && entry.def?.hidden !== true;
      if (entry.object3d) entry.object3d.visible = visible;
    });
    markMetaWorldLayersDirty(worldData);
    syncBridgeWorldState(state, worldData);
    notifyMetaWorldLayersChanged({ reason: "historyRestored" });
    return true;
  };

  const bridge = {
    sourceId,
    recordHistory: recordHistorySnapshot,
    undo() {
      if (!history.undoStack.length) return false;
      const previous = history.undoStack.pop();
      history.redoStack.push(snapshotWorldObjects());
      history.isRestoring = true;
      const restored = restoreWorldObjectsSnapshot(previous);
      history.isRestoring = false;
      return restored;
    },
    redo() {
      if (!history.redoStack.length) return false;
      const next = history.redoStack.pop();
      history.undoStack.push(snapshotWorldObjects());
      history.isRestoring = true;
      const restored = restoreWorldObjectsSnapshot(next);
      history.isRestoring = false;
      return restored;
    },
    sourcePath: filePath || "",
    worldData,
    listObjects() {
      return layerEntries.map((entry, index) => ({
        id: entry.id,
        name: readLayerObjectName(entry.def, entry.id, index),
        type: readLayerObjectType(entry.def, entry.object3d),
        visible: entry.object3d?.visible !== false,
        tag: entry.def?.tag || "",
        expression: entry.def?.expression || entry.def?.equation || "",
        domain: entry.def?.domain || null,
        material: entry.def?.material || null,
        collider: entry.def?.collider || null,
        locked: entry.def?.locked === true,
        error: entry.def?.error || "",
        equationCollider: entry.def?.equationCollider || null,
      }));
    },
    selectObject(objectId) {
      const entry = layerEntries.find((candidate) => candidate.id === objectId);
      if (!entry?.object3d) return false;
      if (window.VRWorldContext?.objectInspector?.inspectTarget && Array.isArray(window.VRWorldContext.objects) && window.VRWorldContext.objects.includes(entry.object3d)) {
        window.VRWorldContext.objectInspector.inspectTarget(entry.object3d);
      }
      return true;
    },
    setObjectVisibility(objectId, visible) {
      const entry = layerEntries.find((candidate) => candidate.id === objectId);
      if (!entry?.object3d) return false;
      const nextVisible = visible !== false;
      this.recordHistory();
      entry.object3d.visible = nextVisible;
      updateDefinitionVisibility(entry.def, nextVisible);
      markMetaWorldLayersDirty(worldData);
      updateStateWorldVisibility(state, objectId, nextVisible);
      // TODO: Persist visibility changes back to the selected MetaWorld HTML/JSON source definition.
      return true;
    },
    addExpressionLayer(overrides = {}) {
      if (!THREE || !scene || !Array.isArray(objects) || !worldData) return null;
      const existing = new Set(layerEntries.map((entry) => entry.id));
      this.recordHistory();
      let layer = createDefaultExpressionLayer(overrides, readBridgeExpressionOptions());
      while (existing.has(layer.id)) {
        layer = createDefaultExpressionLayer({ ...layer, id: "expr_surface_" + Date.now().toString(36) + "_" + Math.floor(Math.random() * 1000) }, readBridgeExpressionOptions());
      }
      worldData.objects = Array.isArray(worldData.objects) ? worldData.objects : [];
      worldData.objects.push(layer);
      const entry = { id: layer.id, def: layer, object3d: null };
      layerEntries.push(entry);
      this.regenerateExpressionLayer(layer.id);
      markMetaWorldLayersDirty(worldData);
      syncBridgeWorldState(state, worldData);
      notifyMetaWorldLayersChanged({ reason: "expressionLayerAdded", objectId: layer.id });
      return layer;
    },
    updateExpressionLayer(objectId, patch = {}) {
      const entry = layerEntries.find((candidate) => candidate.id === objectId);
      if (!entry?.def) return false;
      const { domain, material, collider, ...rest } = patch || {};
      this.recordHistory();
      Object.assign(entry.def, rest);
      if (domain) entry.def.domain = { ...(entry.def.domain || {}), ...domain };
      if (material) entry.def.material = { ...(entry.def.material || {}), ...material };
      if (collider) entry.def.collider = { ...(entry.def.collider || {}), ...collider };
      if (isExpressionLayerType(entry.def.type)) {
        this.regenerateExpressionLayer(objectId);
      }
      markMetaWorldLayersDirty(worldData);
      syncBridgeWorldState(state, worldData);
      // TODO: Persist expression layer edits back to the selected MetaWorld HTML/JSON source definition.
      notifyMetaWorldLayersChanged({ reason: "expressionLayerUpdated", objectId });
      return true;
    },
    regenerateExpressionLayer(objectId) {
      const entry = layerEntries.find((candidate) => candidate.id === objectId);
      if (!entry?.def || !THREE || !scene) return false;
      try {
        const normalized = normalizeExpressionLayer(entry.def, readBridgeExpressionOptions());
        Object.assign(entry.def, normalized);
        const result = createExpressionLayerObject(THREE, entry.def, readBridgeExpressionOptions());
        Object.assign(entry.def, result.layer);
        if (entry.object3d) {
          removeColliderRef(entry.object3d);
          scene.remove(entry.object3d);
          removeObjectFromArray(objects, entry.object3d);
          disposeExpressionObject(entry.object3d);
        }
        entry.object3d = result.object3d;
        entry.object3d.userData.metaWorldLayerId = entry.id;
        entry.object3d.userData.expressionLayerDefinition = entry.def;
        attachLayerBreakHandler(entry);
        scene.add(entry.object3d);
        objects.push(entry.object3d);
        syncExpressionLayerCollider(entry);
        entry.def.error = "";
        return true;
      } catch (err) {
        entry.def.error = err?.message || String(err);
        return false;
      }
    },
    removeExpressionLayer(objectId) {
      const index = layerEntries.findIndex((candidate) => candidate.id === objectId);
      if (index < 0) return false;
      this.recordHistory();
      const [entry] = layerEntries.splice(index, 1);
      if (entry.object3d) {
        removeColliderRef(entry.object3d);
        scene?.remove?.(entry.object3d);
        removeObjectFromArray(objects, entry.object3d);
        disposeExpressionObject(entry.object3d);
      }
      const defs = Array.isArray(worldData?.objects) ? worldData.objects : [];
      removeObjectFromArray(defs, entry.def);
      markMetaWorldLayersDirty(worldData);
      syncBridgeWorldState(state, worldData);
      notifyMetaWorldLayersChanged({ reason: "expressionLayerRemoved", objectId });
      return true;
    },
    addObjectLayer(objectDef = {}) {
      if (!THREE || !scene || !Array.isArray(objects) || !worldData) return null;
      const def = objectDef && typeof objectDef === "object" ? JSON.parse(JSON.stringify(objectDef)) : {};
      def.type = String(def.type || "box").toLowerCase();
      if (!Array.isArray(def.position) || def.position.length < 3) def.position = [0, 0.5, -2];
      ensurePrimitiveSize(def);
      const objectId = makeUniqueObjectId(layerEntries, def.id || def.tag || def.name, def.type);
      def.id = objectId;
      def.tag = typeof def.tag === "string" && def.tag.trim() ? def.tag.trim() : objectId;
      def.name = typeof def.name === "string" && def.name.trim() ? def.name.trim() : readLayerObjectName(def, objectId, layerEntries.length);
      if (!def.color) def.color = "#888888";
      if (def.isSolid !== false) def.isSolid = true;
      if (def.breakable !== false) def.breakable = true;

      const materialOpts = { color: def.color || "#888888" };
      const mesh = createPrimitiveWorldMesh(THREE, def, materialOpts);
      if (!mesh) return null;
      this.recordHistory();
      worldData.objects = Array.isArray(worldData.objects) ? worldData.objects : [];
      worldData.objects.push(def);
      mesh.position.set(...def.position);
      mesh.userData.nvType = def.type;
      mesh.userData.metaWorldLayerId = objectId;
      mesh.userData.tag = def.tag;
      mesh.userData.isSolid = def.isSolid === true || def.collidable === true;
      mesh.userData.breakable = def.breakable !== false;
      mesh.userData.placedByPlayer = true;
      if (def.hidden === true || def.visible === false) mesh.visible = false;
      scene.add(mesh);
      objects.push(mesh);
      const colliderRef = makeObjectColliderRef(THREE, mesh, def, def.type);
      if (colliderRef && Array.isArray(colliders)) {
        colliders.push(colliderRef);
        mesh.userData.colliderRef = colliderRef;
      }
      layerEntries.push({ id: objectId, def, object3d: mesh });
      markMetaWorldLayersDirty(worldData);
      syncBridgeWorldState(state, worldData);
      notifyMetaWorldLayersChanged({ reason: "objectLayerAdded", objectId });
      return def;
    },
    upsertObjectLayerFromMesh({ mesh, def, reason = "objectLayerUpserted" } = {}) {
      if (!mesh?.isMesh || !def || typeof def !== "object" || !worldData) return null;
      worldData.objects = Array.isArray(worldData.objects) ? worldData.objects : [];
      const existingId = mesh.userData?.metaWorldLayerId || def.id || null;
      let entry = existingId ? layerEntries.find((candidate) => candidate.id === existingId) : null;
      const objectId = entry?.id || makeUniqueObjectId(layerEntries, def.id || def.tag || def.name, def.type || mesh.userData?.nvType || "object");
      const nextDef = JSON.parse(JSON.stringify({ ...def, id: objectId }));
      nextDef.name = typeof nextDef.name === "string" && nextDef.name.trim()
        ? nextDef.name.trim()
        : readLayerObjectName(nextDef, objectId, layerEntries.length);
      if (nextDef.terrain && typeof nextDef.terrain === "object") {
        nextDef.terrain.id = objectId;
        nextDef.terrain.name = nextDef.name;
      }
      if (!entry) {
        entry = { id: objectId, def: nextDef, object3d: mesh };
        layerEntries.push(entry);
        if (!worldData.objects.includes(nextDef)) worldData.objects.push(nextDef);
      } else {
        const defs = Array.isArray(worldData.objects) ? worldData.objects : [];
        const defIndex = defs.indexOf(entry.def);
        entry.def = nextDef;
        entry.object3d = mesh;
        if (defIndex >= 0) defs[defIndex] = nextDef;
        else defs.push(nextDef);
      }
      mesh.userData.metaWorldLayerId = objectId;
      if (mesh.userData.terrain && typeof mesh.userData.terrain === "object") {
        mesh.userData.terrain.id = objectId;
        mesh.userData.terrain.name = nextDef.name;
      }
      markMetaWorldLayersDirty(worldData);
      syncBridgeWorldState(state, worldData);
      notifyMetaWorldLayersChanged({ reason, objectId });
      return nextDef;
    },
    removeObjectLayer(objectId) {
      const index = layerEntries.findIndex((candidate) => candidate.id === objectId);
      if (index < 0) return false;
      this.recordHistory();
      const [entry] = layerEntries.splice(index, 1);
      if (entry.object3d) {
        removeColliderRef(entry.object3d);
        scene?.remove?.(entry.object3d);
        removeObjectFromArray(objects, entry.object3d);
        disposeExpressionObject(entry.object3d);
      }
      const defs = Array.isArray(worldData?.objects) ? worldData.objects : [];
      removeObjectFromArray(defs, entry.def);
      markMetaWorldLayersDirty(worldData);
      syncBridgeWorldState(state, worldData);
      notifyMetaWorldLayersChanged({ reason: "objectLayerRemoved", objectId });
      return true;
    },
    moveObjectLayer(objectId, direction) {
      const index = layerEntries.findIndex((candidate) => candidate.id === objectId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= layerEntries.length) return false;
      this.recordHistory();
      const [entry] = layerEntries.splice(index, 1);
      layerEntries.splice(nextIndex, 0, entry);
      const objectDefs = Array.isArray(worldData?.objects) ? worldData.objects : [];
      const objectIndex = objectDefs.indexOf(entry.def);
      const nextObjectIndex = objectIndex + direction;
      if (objectIndex >= 0 && nextObjectIndex >= 0 && nextObjectIndex < objectDefs.length) {
        const [objectDef] = objectDefs.splice(objectIndex, 1);
        objectDefs.splice(nextObjectIndex, 0, objectDef);
      }
      markMetaWorldLayersDirty(worldData);
      syncBridgeWorldState(state, worldData);
      notifyMetaWorldLayersChanged({ reason: "orderChanged", objectId });
      return true;
    },
  };

  layerEntries.forEach(attachLayerBreakHandler);
  setActiveMetaWorldLayerBridge(bridge);
}

function convertMetaWorldToLegacyWorld(world) {
  if (!world || world.worldType !== "NodevisionMetaWorld") return world;

  const modeHint = String(world.worldMode || world.metadata?.worldMode || "3d").toLowerCase();
  const viewHint = String(world.viewMode || world.metadata?.viewMode || "").toLowerCase();
  const movementHint = String(world.movementMode || world.metadata?.movementMode || viewHint || "").toLowerCase();
  const directObjects = Array.isArray(world.objects) ? world.objects : [];
  if (directObjects.length > 0) {
    const spawn = world.spawnPosition || { x: 0, y: 1.75, z: 0 };
    const objects = directObjects.map((object, index) => ({
      id: object.id || object.tag || `metaworld-object-${index}`,
      tag: object.tag || object.id || `metaworld-object-${index}`,
      ...object
    }));
    if (!objects.some((object) => object.type === "spawn" || object.tag === "spawn" || object.isSpawn === true)) {
      objects.push({
        id: "metaworld-spawn",
        type: "spawn",
        tag: "spawn",
        spawnId: "default",
        position: [
          Number.isFinite(spawn.x) ? spawn.x : 0,
          Number.isFinite(spawn.y) ? spawn.y : 1.75,
          Number.isFinite(spawn.z) ? spawn.z : 0
        ],
        spawnYaw: Number.isFinite(world.spawnYaw) ? world.spawnYaw : 0
      });
    }
    return {
      name: world.name,
      type: world.type,
      worldType: world.worldType,
      worldMode: modeHint === "2d" ? "2d" : "3d",
      movementMode: movementHint,
      metadata: {
        ...(world.metadata || {}),
        source: "NodevisionMetaWorld",
        originalMetaWorld: JSON.parse(JSON.stringify(world)),
        worldMode: modeHint === "2d" ? "2d" : "3d",
        viewMode: viewHint,
        movementMode: movementHint,
        playerRules: {
          allowFly: false,
          allowRoll: false,
          allowPitch: false,
          allowPlace: false,
          allowBreak: false,
          allowInspect: true,
          allowToolUse: true,
          allowSave: false,
          ...(world.playerRules || world.metadata?.playerRules || {})
        },
        environment: {
          skyColor: "#ffffff",
          floorColor: "#d8dee4",
          backgroundMode: "color",
          backgroundImage: "",
          ...(world.environment || world.metadata?.environment || {})
        }
      },
      objects
    };
  }

  const museum = world.museum || {};
  const size = museum.size || { x: 18, y: 6, z: 14 };
  const sx = Number.isFinite(size.x) ? size.x : 18;
  const sy = Number.isFinite(size.y) ? size.y : 6;
  const sz = Number.isFinite(size.z) ? size.z : 14;
  const floorColor = museum.floorColor || "#d8dee4";
  const wallColor = museum.wallColor || "#f7f9fb";
  const accentColor = museum.accentColor || "#0f766e";
  const objects = [];
  const addBox = (id, position, boxSize, color, options = {}) => {
    objects.push({
      id,
      type: "box",
      tag: id,
      position,
      size: boxSize,
      color,
      isSolid: options.isSolid === true,
      breakable: options.breakable === true
    });
  };
  const addSphere = (id, position, radius, color, options = {}) => {
    objects.push({
      id,
      type: "sphere",
      tag: id,
      position,
      size: [radius],
      color,
      isSolid: options.isSolid === true,
      breakable: options.breakable === true
    });
  };
  const addCylinder = (id, position, radius, height, color, options = {}) => {
    objects.push({
      id,
      type: "cylinder",
      tag: id,
      position,
      size: [radius, height],
      color,
      isSolid: options.isSolid === true,
      breakable: options.breakable === true
    });
  };
  const addConsole = (id, position, demoConfig) => {
    objects.push({
      id,
      tag: id,
      type: "console",
      position,
      size: [0.35, 0.25, 0.35],
      color: "#111827",
      collider: false,
      isSolid: false,
      breakable: false,
      hidden: true,
      linkedObject: demoConfig?.linkedObject || "",
      inputs: demoConfig?.inputs || {},
      outputs: demoConfig?.outputs || {},
      metaWorldDemo: demoConfig
    });
  };
  const addButton = (id, position, consoleTag, options = {}) => {
    objects.push({
      id,
      tag: id,
      type: "button",
      position,
      size: [options.radius || 0.22, options.height || 0.12],
      color: options.color || accentColor,
      emissive: options.color || accentColor,
      emissiveIntensity: 0.35,
      isSolid: false,
      breakable: false,
      useRange: Number.isFinite(options.useRange) ? options.useRange : 3,
      useAction: {
        type: "console",
        target: consoleTag,
        event: options.event || "start",
        inputs: options.inputs || {}
      }
    });
  };
  const worldY = 0;

  addBox("metaworld-floor", [0, -0.06, 0], [sx, 0.12, sz], floorColor, { isSolid: true });
  addBox("metaworld-back-wall", [0, sy / 2, -sz / 2], [sx, sy, 0.12], wallColor, { isSolid: true });
  addBox("metaworld-left-wall", [-sx / 2, sy / 2, 0], [0.12, sy, sz], wallColor, { isSolid: true });
  addBox("metaworld-right-wall", [sx / 2, sy / 2, 0], [0.12, sy, sz], wallColor, { isSolid: true });
  addBox("metaworld-front-threshold", [0, 0.1, sz / 2], [sx, 0.2, 0.12], wallColor, { isSolid: true });

  objects.push(
    { type: "light", lightType: "hemisphere", position: [0, sy - 0.2, 0], color: "#ffffff", groundColor: "#b4bec8", intensity: 1.8 },
    { type: "light", lightType: "directional", position: [5, 8, 4], color: "#ffffff", intensity: 2.2 }
  );

  for (const exhibit of world.exhibits || []) {
    const p = exhibit.position || { x: 0, y: 0, z: 0 };
    const baseX = Number.isFinite(p.x) ? p.x : 0;
    const baseY = Number.isFinite(p.y) ? p.y : worldY;
    const baseZ = Number.isFinite(p.z) ? p.z : 0;
    const params = exhibit.parameters || {};
    const id = exhibit.id || exhibit.type || "metaworld-exhibit";

    addBox(`${id}-plinth`, [baseX, baseY + 0.08, baseZ], [2.8, 0.16, 1.6], "#d7ecdf", { isSolid: true });

    if (exhibit.type === "gravity-drop") {
      const height = Number.isFinite(params.dropHeight) ? params.dropHeight : 3.2;
      const count = Number.isFinite(params.spheres) ? Math.max(1, Math.floor(params.spheres)) : 2;
      addBox(`${id}-post`, [baseX - 1.1, baseY + height / 2, baseZ], [0.1, height, 0.1], "#384252", { isSolid: true });
      addBox(`${id}-bar`, [baseX, baseY + height, baseZ], [2.2, 0.08, 0.08], "#384252", { isSolid: true });
      for (let i = 0; i < count; i += 1) {
        const radius = Number.isFinite(params.radius) ? params.radius : 0.22;
        const x = count === 1 ? 0 : -0.45 + i * 0.9;
        addSphere(`${id}-sphere-${i}`, [baseX + x, baseY + height, baseZ], radius, i % 2 ? "#2563eb" : "#e11d48", { isSolid: true, breakable: true });
      }
    } else if (exhibit.type === "projectile-range") {
      addBox(`${id}-range-base`, [baseX + 1.6, baseY + 0.04, baseZ], [4.6, 0.08, 1.4], "#d7ecdf", { isSolid: true });
      addCylinder(`${id}-launcher`, [baseX - 1.5, baseY + 0.42, baseZ], 0.08, 0.9, "#334155", { isSolid: true });
      addSphere(`${id}-projectile`, [baseX - 1.6, baseY + 0.55, baseZ], Number.isFinite(params.radius) ? params.radius : 0.2, "#f97316", { isSolid: true, breakable: true });
    } else if (exhibit.type === "pendulum") {
      const pivotHeight = Number.isFinite(params.pivotHeight) ? params.pivotHeight : 3.1;
      const length = Number.isFinite(params.length) ? params.length : 2.2;
      addBox(`${id}-top`, [baseX, baseY + pivotHeight, baseZ], [2.4, 0.08, 0.08], "#475569", { isSolid: true });
      addBox(`${id}-left`, [baseX - 1.2, baseY + 1.55, baseZ], [0.08, 3.1, 0.08], "#475569", { isSolid: true });
      addBox(`${id}-right`, [baseX + 1.2, baseY + 1.55, baseZ], [0.08, 3.1, 0.08], "#475569", { isSolid: true });
      addBox(`${id}-rod`, [baseX, baseY + pivotHeight - length / 2, baseZ], [0.035, length, 0.035], "#111827", { isSolid: false });
      addSphere(`${id}-bob`, [baseX, baseY + pivotHeight - length, baseZ], 0.22, "#7c3aed", { isSolid: true, breakable: true });
    } else {
      addBox(`${id}-marker`, [baseX, baseY + 0.75, baseZ], [1.2, 1.2, 1.2], accentColor, { isSolid: true, breakable: true });
    }

    const consoleTag = `${id}-console`;
    const buttonColor = exhibit.button?.color || accentColor;
    const buttonPosition = Array.isArray(exhibit.button?.position)
      ? exhibit.button.position
      : [baseX, baseY + 0.18, baseZ + 1.05];
    const baseDemo = {
      id,
      title: exhibit.title || id,
      type: exhibit.type,
      linkedObject: id,
      inputs: { ...(params || {}), ...(exhibit.inputs || {}) },
      outputs: exhibit.outputs || {}
    };
    if (exhibit.type === "gravity-drop") {
      const count = Number.isFinite(params.spheres) ? Math.max(1, Math.floor(params.spheres)) : 2;
      addConsole(consoleTag, [baseX, -0.8, baseZ], {
        ...baseDemo,
        sphereTags: Array.from({ length: count }, (_, i) => `${id}-sphere-${i}`),
        dropHeight: Number.isFinite(params.dropHeight) ? params.dropHeight : 3.2,
        floorY: baseY + 0.25
      });
    } else if (exhibit.type === "projectile-range") {
      addConsole(consoleTag, [baseX, -0.8, baseZ], {
        ...baseDemo,
        projectileTag: `${id}-projectile`,
        speed: Number.isFinite(params.speed) ? params.speed : 6.5,
        angleDegrees: Number.isFinite(params.angleDegrees) ? params.angleDegrees : 38,
        startPosition: [baseX - 1.6, baseY + 0.55, baseZ],
        floorY: baseY + 0.25
      });
    } else if (exhibit.type === "pendulum") {
      const pivotHeight = Number.isFinite(params.pivotHeight) ? params.pivotHeight : 3.1;
      addConsole(consoleTag, [baseX, -0.8, baseZ], {
        ...baseDemo,
        bobTag: `${id}-bob`,
        rodTag: `${id}-rod`,
        pivot: [baseX, baseY + pivotHeight, baseZ],
        length: Number.isFinite(params.length) ? params.length : 2.2,
        initialAngleDegrees: Number.isFinite(params.initialAngleDegrees) ? params.initialAngleDegrees : 24
      });
    } else {
      addConsole(consoleTag, [baseX, -0.8, baseZ], baseDemo);
    }
    addButton(`${id}-button`, buttonPosition, consoleTag, {
      color: buttonColor,
      radius: Number.isFinite(exhibit.button?.radius) ? exhibit.button.radius : 0.22,
      height: Number.isFinite(exhibit.button?.height) ? exhibit.button.height : 0.12,
      inputs: exhibit.button?.inputs || {}
    });

  }


  for (const button of world.buttons || []) {
    if (!button || typeof button !== "object") continue;
    const id = button.id || button.tag || "metaworld-button";
    const position = Array.isArray(button.position)
      ? button.position
      : [0, 0.18, 0];
    const consoleTag = button.consoleTag || button.target || button.console || "";
    if (!consoleTag) continue;
    addButton(id, position, consoleTag, {
      color: button.color || accentColor,
      radius: Number.isFinite(button.radius) ? button.radius : 0.22,
      height: Number.isFinite(button.height) ? button.height : 0.12,
      useRange: Number.isFinite(button.useRange) ? button.useRange : 3,
      event: button.event || "start",
      inputs: button.inputs || {}
    });
  }


  const spawn = world.spawnPosition || { x: 0, y: 1.75, z: Math.min(8, sz / 2 - 1) };
  objects.push({
    id: "metaworld-spawn",
    type: "spawn",
    tag: "spawn",
    spawnId: "default",
    position: [
      Number.isFinite(spawn.x) ? spawn.x : 0,
      Number.isFinite(spawn.y) ? spawn.y : 1.75,
      Number.isFinite(spawn.z) ? spawn.z : Math.min(8, sz / 2 - 1)
    ]
  });

  return {
    name: world.name,
    type: world.type,
    worldType: world.worldType,
    worldMode: "3d",
    metadata: {
      source: "NodevisionMetaWorld",
      originalMetaWorld: JSON.parse(JSON.stringify(world)),
      worldMode: "3d",
      viewMode: world.viewMode || world.metadata?.viewMode || "",
      movementMode: world.movementMode || world.metadata?.movementMode || "",
      playerRules: {
        allowFly: true,
        allowRoll: false,
        allowPitch: false,
        allowPlace: true,
        allowBreak: true,
        allowInspect: true,
        allowToolUse: true,
        allowSave: false,
        ...(world.playerRules || world.metadata?.playerRules || {})
      },
      environment: {
        skyColor: "#ffffff",
        floorColor,
        backgroundMode: "color",
        backgroundImage: "",
        ...(world.environment || world.metadata?.environment || {})
      }
    },
    objects
  };
}

function resetLegacyWorldScene(ctx, state, worldData = null) {
  const { scene, objects, colliders, lights, portals, collisionActions, useTargets, spawnPoints, waterVolumes, measurementVisuals, movementState } = ctx;
  disposeCurrentMetaWorld(ctx);
  if (ctx.panel) ctx.panel.classList.remove("gameview-metaworld-active");
  if (ctx.canvas) ctx.canvas.style.display = "block";
  if (ctx.metaWorldHost?.parentNode) ctx.metaWorldHost.parentNode.removeChild(ctx.metaWorldHost);
  ctx.metaWorldHost = null;
  objects?.forEach(obj => scene.remove(obj));
  if (objects) objects.length = 0;
  if (colliders) colliders.length = 0;
  if (portals) portals.length = 0;
  if (collisionActions) collisionActions.length = 0;
  if (useTargets) useTargets.length = 0;
  if (spawnPoints) spawnPoints.length = 0;
  if (waterVolumes) waterVolumes.length = 0;
  if (Array.isArray(measurementVisuals) && measurementVisuals.length > 0) {
    measurementVisuals.forEach((entry) => {
      if (entry?.parent) entry.parent.remove(entry);
      if (entry?.geometry?.dispose) entry.geometry.dispose();
      if (entry?.material?.dispose) entry.material.dispose();
      if (entry?.material?.map?.dispose) entry.material.map.dispose();
    });
    measurementVisuals.length = 0;
  }
  if (movementState) {
    movementState.tapeMeasureFirstPoint = null;
    movementState.tapeMeasureSecondPoint = null;
    movementState.tapeMeasureFirstMarker = null;
    movementState.tapeMeasureSecondMarker = null;
    movementState.tapeMeasureLine = null;
    movementState.tapeMeasureLabel = null;
    movementState.tapeToolLatch = false;
  }
  if (lights) {
    lights.forEach(light => scene.remove(light));
    lights.length = 0;
  }
  if (state) state.currentWorldDefinition = worldData ? JSON.parse(JSON.stringify(worldData)) : null;
  ctx.currentWorldDefinition = worldData ? JSON.parse(JSON.stringify(worldData)) : null;
}

export async function detectWorldKind(filePath) {
  if (!filePath) return { kind: "unknown", reason: "missing path" };
  const ext = String(filePath).split(".").pop()?.toLowerCase() || "";
  if (ext !== "html" && ext !== "htm") return { kind: "legacy" };
  const worldPath = normalizeWorldPath(filePath);
  try {
    const res = await fetch("/Notebook/" + encodeURI(worldPath), { cache: "no-store" });
    if (!res.ok) return { kind: "unknown", reason: `fetch failed ${res.status}` };
    const htmlText = await res.text();
    const metaWorldDoc = parseMetaWorldDocument(htmlText);
    if (!metaWorldDoc) return { kind: "legacy" };
    const script = metaWorldDoc.getElementById("nodevision-metaworld");
    const definition = JSON.parse(script.textContent || "{}");
    if (definition?.worldType === "NodevisionMetaWorld") {
      return { kind: "metaworld", document: metaWorldDoc, worldPath };
    }
    return { kind: "legacy" };
  } catch (err) {
    return { kind: "unknown", error: err };
  }
}

export function disposeMetaWorldRuntime(runtime) {
  if (!runtime?.dispose) return;
  runtime.dispose();
  console.log("MetaWorld runtime disposed");
}

export async function mountMetaWorldPanel({ panel, filePath, state, document: metaWorldDoc }) {
  if (!panel || !metaWorldDoc) return null;
  const runtime = await ensureMetaWorldRuntime();
  const world = runtime.loadMetaWorldFromHtmlDocument(metaWorldDoc);
  if (world.worldType !== "NodevisionMetaWorld") return null;
  console.log("Detected Nodevision MetaWorld.");
  panel.innerHTML = "";
  panel.classList.add("gameview-metaworld-active");
  const host = document.createElement("div");
  host.className = "gameview-metaworld-host";
  host.innerHTML = `<main class="gameview-metaworld-viewport" aria-label="MetaWorld viewport"></main><section class="gameview-metaworld-ui" aria-label="MetaWorld controls"></section>`;
  Object.assign(host.style, {
    position: "absolute",
    inset: "0",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 320px",
    width: "100%",
    height: "100%",
    background: "#eef2f4",
  });
  const viewport = host.querySelector(".gameview-metaworld-viewport");
  const uiRoot = host.querySelector(".gameview-metaworld-ui");
  Object.assign(viewport.style, { minWidth: "0", minHeight: "0" });
  Object.assign(uiRoot.style, { minWidth: "0", minHeight: "0", overflow: "auto" });
  panel.appendChild(host);
  const mounted = runtime.mountMetaWorld({
    viewport,
    uiRoot,
    world,
    displayName: "Nodevision " + world.name,
  });
  const wrapped = {
    ...mounted,
    host,
    dispose() {
      mounted.dispose?.();
      host.parentNode?.removeChild(host);
    },
  };
  if (state) {
    state.currentWorldPath = filePath;
    state.currentWorldDefinition = JSON.parse(JSON.stringify(world));
    state.metaWorldRuntime = wrapped;
  }
  return wrapped;
}

async function loadStlWorld(filePath, state, THREE) {
  const ctx = window.VRWorldContext || {};
  const { scene, objects, colliders, lights, movementState, ground, consolePanels } = ctx;
  disposeCurrentMetaWorld(ctx);
  if (ctx.panel) ctx.panel.classList.remove("gameview-metaworld-active");
  if (ctx.canvas) ctx.canvas.style.display = "block";
  if (ctx.metaWorldHost?.parentNode) ctx.metaWorldHost.parentNode.removeChild(ctx.metaWorldHost);
  ctx.metaWorldHost = null;
  if (!scene || !movementState || !ground) return;

  objects?.forEach((obj) => scene.remove(obj));
  if (objects) objects.length = 0;
  if (colliders) colliders.length = 0;
  if (lights) {
    lights.forEach((light) => scene.remove(light));
    lights.length = 0;
  }

  movementState.worldMode = "3d";
  movementState.worldRules = {
    allowFly: true,
    allowRoll: false,
    allowPitch: false,
    allowPlace: true,
    allowBreak: true,
    allowInspect: true,
    allowToolUse: true,
    allowSave: true
  };
  movementState.stlEdit = true;
  movementState.stlVertices = [];
  movementState.stlNeedsMarkerRefresh = true;

  ground.material.color?.set("#ffffff");
  ground.material.needsUpdate = true;
  if (!scene.__nvGridHelper) {
    const grid = new THREE.GridHelper(100, 100, 0x999999, 0xcccccc);
    grid.position.y = 0.001;
    scene.add(grid);
    scene.__nvGridHelper = grid;
  } else {
    scene.__nvGridHelper.visible = true;
  }
  const envDef = { skyColor: "#ffffff", floorColor: "#ffffff", backgroundMode: "color", backgroundImage: "" };
  consolePanels?.applyEnvironmentDefinition?.(envDef);
  if (movementState.environment) Object.assign(movementState.environment, envDef);

  const normalized = normalizeWorldPath(filePath);
  const url = "/Notebook/" + encodeURI(normalized);
  let geometry = null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    const buffer = await res.arrayBuffer();
    const loader = await ensureStlLoader();
    geometry = loader.parse(buffer);
  } catch (err) {
    console.error("Failed to load STL geometry:", err);
    return;
  }
  if (!geometry) return;
  geometry.computeBoundingBox?.();
  geometry.computeVertexNormals?.();
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: "#999999", metalness: 0.1, roughness: 0.5 })
  );
  mesh.userData.nvType = "object-file";
  mesh.userData.objectFilePath = normalized;
  scene.add(mesh);
  objects?.push(mesh);

  const pos = geometry.getAttribute("position");
  if (pos?.count) {
    for (let i = 0; i < pos.count; i++) {
      movementState.stlVertices.push({
        x: pos.getX(i),
        y: pos.getY(i),
        z: pos.getZ(i)
      });
    }
    if (movementState.stlVertices.length > 500) {
      movementState.stlNeedsMarkerRefresh = false;
    }
  }
  if (state) state.currentWorldDefinition = null;
  if (ctx) ctx.currentWorldDefinition = null;
}


export async function loadWorldFromFile(filePath, state, THREE, options = {}) {
  console.log("Loading world:", filePath);

  try {
    if (!filePath) return;
    const ext = String(filePath).split(".").pop()?.toLowerCase() || "";
    state.currentWorldPath = filePath;
    const ctx = window.VRWorldContext;
    if (ctx) {
      ctx.currentWorldPath = filePath;
      if (ctx.scene?.__nvGridHelper) ctx.scene.__nvGridHelper.visible = false;
      if (ctx.movementState) {
        ctx.movementState.stlEdit = false;
        ctx.movementState.stlVertices = [];
        ctx.movementState.stlNeedsMarkerRefresh = false;
      }
    }
    if (!window.VRWorldContext) {
      state.pendingWorldPath = filePath;
      state.pendingWorldOptions = options;
      return;
    }

    // Special path: directly edit an STL file instead of an HTML world.
    if (ext === "stl") {
      await loadStlWorld(filePath, state, THREE);
      return;
    }

    const worldPath = normalizeWorldPath(filePath);
    const res = await fetch("/api/load-world", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ worldPath })
    });

    if (!res.ok) {
      let errorMessage = res.statusText;
      try {
        const payload = await res.json();
        if (payload?.error) errorMessage = payload.error;
        if (payload?.details) errorMessage = `${errorMessage} (${payload.details})`;
      } catch (_) {
        // ignore parse errors
      }
      console.warn("World load failed:", res.status, errorMessage);
      return;
    }

    const data = await res.json();
    let worldData = data?.worldDefinition || null;
    if (worldData?.worldType === "NodevisionMetaWorld") {
      worldData = convertMetaWorldToLegacyWorld(worldData);
    }
    resetLegacyWorldScene(window.VRWorldContext, state, worldData);
    if (!worldData || typeof worldData !== "object") {
      clearActiveMetaWorldLayerBridge();
      console.warn("World has no definition.");
      return;
    }
    let objectDefs = Array.isArray(worldData.objects) ? worldData.objects : [];
    worldData.objects = objectDefs;

    const { scene, camera, objects, colliders, lights, portals, collisionActions, useTargets, spawnPoints, waterVolumes, measurementVisuals, controls, movementState } = window.VRWorldContext;
    if (state) {
      state.currentWorldDefinition = worldData ? JSON.parse(JSON.stringify(worldData)) : null;
    }
    if (window.VRWorldContext) {
      window.VRWorldContext.currentWorldDefinition = worldData ? JSON.parse(JSON.stringify(worldData)) : null;
    }
    const modeHint = String(
      worldData?.worldMode
      || worldData?.mode
      || worldData?.metadata?.worldMode
      || worldData?.usd?.metadata?.worldMode
      || "3d"
    ).toLowerCase();
    if (movementState) {
      movementState.worldMode = modeHint === "2d" ? "2d" : "3d";
      movementState.viewMode = String(
        worldData?.viewMode
        || worldData?.metadata?.viewMode
        || worldData?.cameraMode
        || worldData?.metadata?.cameraMode
        || ""
      ).toLowerCase();
      movementState.movementMode = String(
        worldData?.movementMode
        || worldData?.metadata?.movementMode
        || movementState.viewMode
        || ""
      ).toLowerCase();
      movementState.cameraModeInitialized = false;
      movementState.requestCycleCamera = false;

      const rawRules = worldData?.playerRules
        || worldData?.metadata?.playerRules
        || worldData?.metadata?.capabilities
        || worldData?.usd?.metadata?.playerRules
        || worldData?.usd?.metadata?.capabilities
        || {};
      const readRule = (name, fallback = false) => {
        const value = rawRules?.[name];
        return typeof value === "boolean" ? value : fallback;
      };
      movementState.worldRules = {
        allowFly: readRule("allowFly", false),
        allowRoll: readRule("allowRoll", false),
        allowPitch: readRule("allowPitch", false),
        allowPlace: readRule("allowPlace", false),
        allowBreak: readRule("allowBreak", false),
        allowInspect: readRule("allowInspect", false),
        allowToolUse: readRule("allowToolUse", false),
        allowSave: readRule("allowSave", false)
      };

      const envDef =
        worldData?.metadata?.environment
        || worldData?.environment
        || window.VRWorldContext?.environment
        || null;
      window.VRWorldContext?.consolePanels?.applyEnvironmentDefinition?.(envDef);
    }
    objects.forEach(obj => scene.remove(obj));
    objects.length = 0;
    colliders.length = 0;
    if (portals) portals.length = 0;
    if (collisionActions) collisionActions.length = 0;
    if (useTargets) useTargets.length = 0;
    if (spawnPoints) spawnPoints.length = 0;
    if (waterVolumes) waterVolumes.length = 0;
    if (Array.isArray(measurementVisuals) && measurementVisuals.length > 0) {
      measurementVisuals.forEach((entry) => {
        if (entry?.parent) entry.parent.remove(entry);
        if (entry?.geometry?.dispose) entry.geometry.dispose();
        if (entry?.material?.dispose) entry.material.dispose();
        if (entry?.material?.map?.dispose) entry.material.map.dispose();
      });
      measurementVisuals.length = 0;
    }
    if (movementState) {
      movementState.tapeMeasureFirstPoint = null;
      movementState.tapeMeasureSecondPoint = null;
      movementState.tapeMeasureFirstMarker = null;
      movementState.tapeMeasureSecondMarker = null;
      movementState.tapeMeasureLine = null;
      movementState.tapeMeasureLabel = null;
      movementState.tapeToolLatch = false;
    }
    if (lights) {
      lights.forEach(light => scene.remove(light));
      lights.length = 0;
    }

    const isSameWorldTarget = (value) => {
      if (typeof value !== "string") return false;
      const normalized = value.trim().toLowerCase();
      return normalized === "self" || normalized === "." || normalized === "same" || normalized === "current";
    };

    const readTypedValue = (entry) => {
      if (!entry) return entry;
      if (typeof entry === "object" && "value" in entry) return entry.value;
      return entry;
    };

    const parseMaybeJson = (value) => {
      if (typeof value !== "string") return value;
      try {
        return JSON.parse(value);
      } catch (_) {
        return value;
      }
    };

    const color3fToHex = (value) => {
      if (!Array.isArray(value) || value.length < 3) return null;
      const clamp = (num) => Math.max(0, Math.min(255, Math.round(num * 255)));
      const [r, g, b] = value;
      const toHex = (num) => clamp(num).toString(16).padStart(2, "0");
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    };

    const normalizeUsdObjects = (primDefs) => {
      return primDefs.map((prim) => {
        if (!prim || typeof prim !== "object") return null;
        const attrs = prim.attributes || {};
        const custom = prim.customAttributes || prim.custom || {};
        const typeName = prim.typeName || prim.type || "";

        const readAttr = (name) => readTypedValue(attrs[name]);
        const readCustom = (name) => readTypedValue(custom[name]);

        const translate = readAttr("xformOp:translate") || readCustom("nv:position") || [0, 0, 0];
        const scale = readAttr("xformOp:scale");

        const displayColor = readAttr("primvars:displayColor");
        let colorValue = null;
        if (Array.isArray(displayColor)) {
          colorValue = Array.isArray(displayColor[0]) ? displayColor[0] : displayColor;
        }
        const colorHex = color3fToHex(colorValue) || readCustom("nv:color") || readCustom("nv:colorHex") || null;

        const nvType = readCustom("nv:type") || readCustom("nv:kind");
        const isPortal = readCustom("nv:isPortal") === true || nvType === "portal";
        const isLight = /light/i.test(typeName) || nvType === "light";

        const def = {
          position: Array.isArray(translate) ? translate : [0, 0, 0]
        };

        if (colorHex) def.color = colorHex;

        if (isLight) {
          def.type = "light";
          const lightTypeName = (typeName || readCustom("nv:lightType") || "point").toLowerCase();
          if (lightTypeName.includes("distant")) def.lightType = "directional";
          else if (lightTypeName.includes("dome")) def.lightType = "ambient";
          else if (lightTypeName.includes("disk")) def.lightType = "spot";
          else def.lightType = "point";
          const intensity = readAttr("intensity") ?? readCustom("nv:intensity");
          if (Number.isFinite(intensity)) def.intensity = intensity;
          const distance = readCustom("nv:distance");
          if (Number.isFinite(distance)) def.distance = distance;
          const decay = readCustom("nv:decay");
          if (Number.isFinite(decay)) def.decay = decay;
          const angle = readCustom("nv:angle");
          if (Number.isFinite(angle)) def.angle = angle;
          const penumbra = readCustom("nv:penumbra");
          if (Number.isFinite(penumbra)) def.penumbra = penumbra;
          const target = readCustom("nv:target");
          if (Array.isArray(target)) def.target = target;
          return def;
        }

        if (isPortal) {
          def.type = "portal";
          const shape = readCustom("nv:shape");
          if (shape) def.shape = shape;
          const size = readCustom("nv:size") || scale;
          if (Array.isArray(size)) def.size = size;
          const targetWorld = readCustom("nv:targetWorld");
          if (targetWorld) def.targetWorld = targetWorld;
          if (readCustom("nv:sameWorld") === true) def.sameWorld = true;
          const spawn = readCustom("nv:spawn");
          if (Array.isArray(spawn)) def.spawn = spawn;
          const spawnPoint = readCustom("nv:spawnPoint");
          if (spawnPoint) def.spawnPoint = spawnPoint;
          const spawnYaw = readCustom("nv:spawnYaw");
          if (Number.isFinite(spawnYaw)) def.spawnYaw = spawnYaw;
          const cooldownMs = readCustom("nv:cooldownMs");
          if (Number.isFinite(cooldownMs)) def.cooldownMs = cooldownMs;
          const opacity = readCustom("nv:opacity");
          if (Number.isFinite(opacity)) def.opacity = opacity;
          const emissive = readCustom("nv:emissive");
          if (emissive !== undefined) def.emissive = emissive;
          const emissiveIntensity = readCustom("nv:emissiveIntensity");
          if (Number.isFinite(emissiveIntensity)) def.emissiveIntensity = emissiveIntensity;
          const isSolid = readCustom("nv:isSolid");
          if (isSolid !== undefined) def.isSolid = isSolid;
          const tag = readCustom("nv:tag");
          if (tag) def.tag = tag;
          return def;
        }

        if (typeName === "Cube") {
          def.type = "box";
          def.size = Array.isArray(scale) ? scale : [1, 1, 1];
        } else if (typeName === "Sphere") {
          def.type = "sphere";
          const radius = readAttr("radius") ?? readCustom("nv:radius");
          def.size = [Number.isFinite(radius) ? radius : 0.5];
        } else if (typeName === "Cylinder") {
          def.type = "cylinder";
          const radius = readAttr("radius") ?? readCustom("nv:radius");
          const height = readAttr("height") ?? readCustom("nv:height");
          def.size = [
            Number.isFinite(radius) ? radius : 0.5,
            Number.isFinite(height) ? height : 1
          ];
        } else if (typeName === "Mesh") {
          const shape = readCustom("nv:shape");
          if (shape) {
            def.type = shape === "torus" ? "torus" : shape;
          } else {
            def.type = "box";
          }
          const size = readCustom("nv:size") || scale;
          if (Array.isArray(size)) def.size = size;
        } else if (nvType) {
          def.type = nvType;
          const size = readCustom("nv:size") || scale;
          if (Array.isArray(size)) def.size = size;
        } else {
          return null;
        }

        const isSolid = readCustom("nv:isSolid");
        if (isSolid !== undefined) def.isSolid = isSolid;
        const isWater = readCustom("nv:isWater");
        if (isWater !== undefined) def.isWater = isWater;
        const waterBuoyancyScale = readCustom("nv:waterBuoyancyScale");
        if (Number.isFinite(waterBuoyancyScale)) def.waterBuoyancyScale = waterBuoyancyScale;
        const tag = readCustom("nv:tag");
        if (tag) def.tag = tag;
        const spawnId = readCustom("nv:spawnId");
        if (spawnId) def.spawnId = spawnId;
        const spawnYaw = readCustom("nv:spawnYaw");
        if (Number.isFinite(spawnYaw)) def.spawnYaw = spawnYaw;
        const useRange = readCustom("nv:useRange");
        if (Number.isFinite(useRange)) def.useRange = useRange;
        const useAction = parseMaybeJson(readCustom("nv:useAction"));
        if (useAction) def.useAction = useAction;
        const collisionAction = parseMaybeJson(readCustom("nv:collisionAction"));
        if (collisionAction) def.collisionAction = collisionAction;

        return def;
      }).filter(Boolean);
    };

    const isUsdLike = Array.isArray(objectDefs)
      && (worldData?.usd?.metadata || objectDefs.some(def => def?.typeName || def?.path || def?.primPath));
    if (isUsdLike) {
      objectDefs = normalizeUsdObjects(objectDefs);
    }
    if (worldData) worldData.objects = objectDefs;
    if (state) {
      state.currentWorldDefinition = worldData ? JSON.parse(JSON.stringify(worldData)) : null;
    }
    if (window.VRWorldContext) {
      window.VRWorldContext.currentWorldDefinition = worldData ? JSON.parse(JSON.stringify(worldData)) : null;
    }
    const layerEntries = [];

    const normalizeAction = (action, fallbackTarget, fallbackSameWorld) => {
      if (!action) return null;
      if (typeof action === "string") return { type: action };
      if (typeof action === "object") {
        const normalized = { ...action };
        if (normalized.type === "portal") {
          const sameWorld = normalized.sameWorld === true || isSameWorldTarget(normalized.targetWorld) || fallbackSameWorld === true;
          if (!normalized.targetWorld && fallbackTarget && !sameWorld) {
            normalized.targetWorld = fallbackTarget;
          }
          if (sameWorld) {
            normalized.sameWorld = true;
            if (isSameWorldTarget(normalized.targetWorld)) {
              normalized.targetWorld = null;
            }
          }
        }
        return normalized;
      }
      return null;
    };

    const evaluateFunctionY = (equation, x) => {
      try {
        const fn = new Function("x", "Math", `"use strict"; return (${equation});`);
        const y = fn(x, Math);
        if (!Number.isFinite(y)) return null;
        return Math.max(-100, Math.min(100, y));
      } catch (_) {
        return Math.sin(x);
      }
    };

    const createTileMapMesh = (def) => {
      const rows = Array.isArray(def.tiles) ? def.tiles : [];
      if (rows.length === 0) return null;
      const normalizedRows = rows.map((row) => Array.isArray(row) ? row.join("") : String(row || ""));
      const height = normalizedRows.length;
      const width = Math.max(...normalizedRows.map((row) => row.length));
      if (width <= 0 || height <= 0) return null;
      const tilePixels = Number.isFinite(def.tilePixels) ? Math.max(4, Math.min(64, Math.floor(def.tilePixels))) : 16;
      const tileSize = Number.isFinite(def.tileSize) ? Math.max(0.05, def.tileSize) : 1;
      const canvas = document.createElement("canvas");
      canvas.width = width * tilePixels;
      canvas.height = height * tilePixels;
      const context = canvas.getContext("2d");
      const palette = def.palette && typeof def.palette === "object" ? def.palette : {};
      const defaultTile = palette[def.defaultTile || "."] || { color: "#2477a6" };
      const fillTile = (tile, px, py) => {
        const entry = palette[tile] || defaultTile;
        const color = typeof entry === "string" ? entry : entry.color || defaultTile.color || "#2477a6";
        context.fillStyle = color;
        context.fillRect(px, py, tilePixels, tilePixels);
        if (entry.noise) {
          context.fillStyle = entry.noiseColor || "rgba(255,255,255,0.12)";
          const inset = Math.max(1, Math.floor(tilePixels / 8));
          const dot = Math.max(1, Math.floor(tilePixels / 6));
          context.fillRect(px + inset, py + inset, dot, dot);
          context.fillRect(px + tilePixels - inset - dot, py + Math.floor(tilePixels * 0.58), dot, dot);
        }
        if (entry.edge) {
          context.strokeStyle = entry.edge;
          context.lineWidth = Math.max(1, Math.floor(tilePixels / 16));
          context.strokeRect(px + 0.5, py + 0.5, tilePixels - 1, tilePixels - 1);
        }
      };
      context.imageSmoothingEnabled = false;
      for (let y = 0; y < height; y += 1) {
        const row = normalizedRows[y].padEnd(width, def.defaultTile || ".");
        for (let x = 0; x < width; x += 1) {
          fillTile(row[x], x * tilePixels, y * tilePixels);
        }
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      texture.needsUpdate = true;
      const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width * tileSize, height * tileSize), material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.userData.tileMap = { width, height, tileSize, tilePixels };
      return mesh;
    };

    const createLabelSprite = (def) => {
      const text = typeof def.text === "string" && def.text.trim()
        ? def.text.trim()
        : (typeof def.label === "string" ? def.label.trim() : "");
      if (!text) return null;
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      const fontSize = Number.isFinite(def.fontSize) ? Math.max(14, Math.min(96, def.fontSize)) : 32;
      context.font = `700 ${fontSize}px system-ui, sans-serif`;
      const metrics = context.measureText(text);
      canvas.width = Math.max(128, Math.ceil(metrics.width + 36));
      canvas.height = Math.max(48, fontSize + 24);
      context.font = `700 ${fontSize}px system-ui, sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      if (def.background !== false) {
        context.fillStyle = def.backgroundColor || "rgba(255, 250, 226, 0.88)";
        context.strokeStyle = def.borderColor || "rgba(72, 52, 24, 0.5)";
        context.lineWidth = 4;
        context.fillRect(2, 2, canvas.width - 4, canvas.height - 4);
        context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
      }
      context.fillStyle = def.color || "#2f2112";
      context.fillText(text, canvas.width / 2, canvas.height / 2);
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false
      });
      const sprite = new THREE.Sprite(material);
      const scale = Number.isFinite(def.scale) ? def.scale : 1;
      sprite.scale.set((canvas.width / 80) * scale, (canvas.height / 80) * scale, 1);
      sprite.userData.labelText = text;
      return sprite;
    };

    const createMathFunctionMesh = (def) => {
      const equation = typeof def.equation === "string" && def.equation ? def.equation : "Math.sin(x)";
      const limits = Array.isArray(def.limits) && def.limits.length >= 2 ? def.limits : [-8, 8];
      const xMin = Number.isFinite(limits[0]) ? limits[0] : -8;
      const xMax = Number.isFinite(limits[1]) ? limits[1] : 8;
      const resolution = Number.isFinite(def.resolution) ? Math.max(16, Math.min(192, Math.floor(def.resolution))) : 96;
      const points = [];
      for (let i = 0; i <= resolution; i += 1) {
        const t = i / resolution;
        const x = xMin + (xMax - xMin) * t;
        const y = evaluateFunctionY(equation, x);
        if (!Number.isFinite(y)) continue;
        points.push(new THREE.Vector3(x, y, 0));
      }
      if (points.length < 2) return null;
      const curve = new THREE.CatmullRomCurve3(points);
      const geometry = new THREE.TubeGeometry(curve, Math.max(16, resolution), 0.035, 8, false);
      const material = new THREE.MeshStandardMaterial({
        color: def.color || "#44bbff",
        emissive: def.color || "#44bbff",
        emissiveIntensity: 0.22
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.mathFunctionProperties = {
        equation,
        resolution,
        limits: [xMin, xMax],
        collider: def.collider !== false,
        color: def.color || "#44bbff"
      };
      return mesh;
    };

    const spawnCandidates = [];
    const recordSpawnPoint = (def) => {
      if (!Array.isArray(def?.position) || def.position.length < 3) return;
      const id = typeof def.spawnId === "string"
        ? def.spawnId
        : typeof def.id === "string"
          ? def.id
          : typeof def.name === "string"
            ? def.name
            : typeof def.label === "string"
              ? def.label
              : null;
      const yaw = Number.isFinite(def.spawnYaw) ? def.spawnYaw : (Number.isFinite(def.yaw) ? def.yaw : null);
      spawnCandidates.push({
        id,
        position: [def.position[0], def.position[1], def.position[2]],
        yaw
      });
    };

    for (let defIndex = 0; defIndex < objectDefs.length; defIndex += 1) {
      const def = objectDefs[defIndex];
      const layerObjectId = readLayerObjectId(def, defIndex);
      let mesh = null;
      let light = null;
      const isPortal = def.type === "portal" || def.isPortal === true;
      const portalTarget = def.targetWorld || def.target || def.href || def.world;
      const sameWorld = def.sameWorld === true || isSameWorldTarget(portalTarget);
      const resolvedPortalTarget = isSameWorldTarget(portalTarget) ? null : portalTarget;
      const portalSpawnPoint = def.spawnPoint ?? def.spawnId ?? null;
      const isSpawnPoint = def.type === "spawn" || def.tag === "spawn" || def.isSpawn === true;
      if (isSpawnPoint) {
        recordSpawnPoint(def);
      }
      const rawActions = def.collisionAction ?? def.onCollide;
      const actionList = Array.isArray(rawActions) ? rawActions : (rawActions ? [rawActions] : []);
      if (isPortal && actionList.length === 0) {
        actionList.push({
          type: "portal",
          targetWorld: resolvedPortalTarget,
          sameWorld,
          spawn: def.spawn,
          spawnYaw: def.spawnYaw,
          spawnPoint: portalSpawnPoint
        });
      }
      const portalShape = (def.shape || def.geometry || (def.type === "portal" ? "box" : def.type) || "").toLowerCase();
      if (!Array.isArray(def.size) || def.size.length === 0) {
        if (portalShape === "box") def.size = [1, 1, 1];
        else if (portalShape === "sphere") def.size = [0.5];
        else if (portalShape === "cylinder") def.size = [0.5, 1];
        else if (portalShape === "cone" || portalShape === "pyramid") def.size = [0.5, 1];
        else if (portalShape === "torus") def.size = [1, 0.25];
      }
      const materialOpts = {
        color: def.color || "#888"
      };
      if (def.isWater === true) {
        materialOpts.color = def.color || "#9bd9b6";
        materialOpts.transparent = true;
        materialOpts.opacity = Number.isFinite(def.opacity) ? def.opacity : 0.28;
        materialOpts.depthWrite = false;
        materialOpts.emissive = def.emissive || "#9bd9b6";
        materialOpts.emissiveIntensity = Number.isFinite(def.emissiveIntensity) ? def.emissiveIntensity : 0.08;
        materialOpts.side = THREE.DoubleSide;
      }
      if (isPortal) {
        materialOpts.transparent = true;
        materialOpts.opacity = Number.isFinite(def.opacity) ? def.opacity : 0.65;
        materialOpts.emissive = def.emissive === true ? (def.color || "#55ccff") : (def.emissive || "#55ccff");
        materialOpts.emissiveIntensity = Number.isFinite(def.emissiveIntensity) ? def.emissiveIntensity : 0.9;
      }
      if (def.emissive && !isPortal) {
        materialOpts.emissive = def.emissive === true ? def.color || "#888" : def.emissive;
        materialOpts.emissiveIntensity = Number.isFinite(def.emissiveIntensity) ? def.emissiveIntensity : 0.75;
      }
      if (def.type === "equation-collider-plane") {
        const planeProps = def.equationCollider && typeof def.equationCollider === "object" ? def.equationCollider : {};
        const size = Array.isArray(def.size) && Number.isFinite(def.size[0]) ? def.size[0] : planeProps.size;
        const thickness = Array.isArray(def.size) && Number.isFinite(def.size[1]) ? def.size[1] : planeProps.thickness;
        mesh = createEquationColliderPlaneMesh(THREE, {
          ...planeProps,
          size,
          thickness
        }, materialOpts);
      } else if (def.type === "asset") {
        const assetType = String(def.assetType || "").toLowerCase();
        const src = typeof def.src === "string" ? def.src : "";
        const scale = Array.isArray(def.scale) ? def.scale : [1, 1, 1];
        if (assetType === "billboard") {
          mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(Number.isFinite(scale[0]) ? scale[0] : 1, Number.isFinite(scale[1]) ? scale[1] : 1),
            new THREE.MeshBasicMaterial({ color: "#ffffff", side: THREE.DoubleSide, transparent: true })
          );
          mesh.userData.imageFilePath = src;
          void (async () => {
            const applier = await ensureImagePlaneTextureApplier();
            if (applier) await applier(mesh, THREE);
          })();
        } else if (assetType === "audio") {
          mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.25, 24, 16),
            new THREE.MeshStandardMaterial({ color: def.color || "#44aaff", emissive: "#113355", emissiveIntensity: 0.35 })
          );
          mesh.userData.audioAssetPath = src;
        } else if (assetType === "video") {
          mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(Number.isFinite(scale[0]) ? scale[0] * 1.6 : 1.6, Number.isFinite(scale[1]) ? scale[1] : 1),
            new THREE.MeshStandardMaterial({ color: def.color || "#111111", emissive: "#222222", emissiveIntensity: 0.2, side: THREE.DoubleSide })
          );
          mesh.userData.videoAssetPath = src;
        } else {
          mesh = new THREE.Mesh(
            new THREE.BoxGeometry(Number.isFinite(scale[0]) ? scale[0] : 1, Number.isFinite(scale[1]) ? scale[1] : 1, Number.isFinite(scale[2]) ? scale[2] : 1),
            new THREE.MeshStandardMaterial({ color: def.color || "#8aa0b8" })
          );
          mesh.userData.objectFilePath = src;
          void (async () => {
            const applier = await ensureObjectFileGeometryApplier();
            if (applier) await applier(mesh);
          })();
        }
      } else if (def.type === "tilemap") {
        mesh = createTileMapMesh(def);
      } else if (def.type === "label") {
        mesh = createLabelSprite(def);
      } else if (isExpressionLayerType(def.type)) {
        try {
          if (!Array.isArray(def.position)) def.position = [0, 0, 0];
          const result = createExpressionLayerObject(THREE, def, getExpressionLayerOptions(camera || window.VRWorldContext?.camera));
          Object.assign(def, result.layer);
          mesh = result.object3d;
          def.error = "";
        } catch (err) {
          def.error = err?.message || String(err);
          mesh = new THREE.Group();
          mesh.name = def.name || def.id || "Expression Layer";
          mesh.visible = def.visible !== false;
          mesh.userData.nvType = def.type;
          mesh.userData.metaWorldExpressionLayer = true;
          mesh.userData.expressionLayerId = def.id || layerObjectId;
          if (!Array.isArray(def.position)) def.position = [0, 0, 0];
        }
      } else if (def.type === "math-function") {
        mesh = createMathFunctionMesh(def);
      } else if (def.type === "console") {
        const size = Array.isArray(def.size) && def.size.length >= 3 ? def.size : [0.9, 1.15, 0.7];
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(size[0], size[1], size[2]),
          new THREE.MeshStandardMaterial(materialOpts)
        );
        mesh.userData.consoleProperties = {
          collider: def.collider !== false,
          color: def.color || "#33ccaa",
          objectFile: typeof def.objectFile === "string" ? def.objectFile : "",
          linkedObject: typeof def.linkedObject === "string" ? def.linkedObject : "",
          inputs: def.inputs && typeof def.inputs === "object" ? def.inputs : {},
          outputs: def.outputs && typeof def.outputs === "object" ? def.outputs : {},
          metaWorldDemo: def.metaWorldDemo && typeof def.metaWorldDemo === "object" ? def.metaWorldDemo : null
        };
      } else if (def.type === "button") {
        const radius = Array.isArray(def.size) && Number.isFinite(def.size[0]) ? def.size[0] : 0.22;
        const height = Array.isArray(def.size) && Number.isFinite(def.size[1]) ? def.size[1] : 0.12;
        mesh = new THREE.Mesh(
          new THREE.CylinderGeometry(radius, radius, height, 32),
          new THREE.MeshStandardMaterial(materialOpts)
        );
      } else if (def.type === "object-file") {
        const size = Array.isArray(def.size) && def.size.length >= 3 ? def.size : [1, 1, 1];
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(size[0], size[1], size[2]),
          new THREE.MeshStandardMaterial(materialOpts)
        );
        if (typeof def.objectFile === "string" && def.objectFile) {
          mesh.userData.objectFilePath = def.objectFile;
          void (async () => {
            const applier = await ensureObjectFileGeometryApplier();
            if (applier) {
              await applier(mesh);
            }
          })();
        }
      } else if (def.type === "image-plane") {
        const size = Array.isArray(def.size) && def.size.length >= 2 ? def.size : [2, 2];
        mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(size[0], size[1]),
          new THREE.MeshBasicMaterial({
            color: def.color || "#ffffff",
            transparent: true,
            opacity: Number.isFinite(def.opacity) ? def.opacity : 1,
            side: THREE.DoubleSide
          })
        );
        const imageFile = typeof def.imageFile === "string"
          ? def.imageFile
          : typeof def.image === "string"
            ? def.image
            : "";
        if (imageFile) {
          mesh.userData.imageFilePath = imageFile;
          void (async () => {
            const applier = await ensureImagePlaneTextureApplier();
            if (applier) {
              await applier(mesh, THREE);
            }
          })();
        }
      } else if (def.type === "terrain-surface") {
        const terrain = def.terrain && typeof def.terrain === "object" ? def.terrain : {};
        mesh = createTerrainSurfaceMesh(THREE, {
          columns: Number.isFinite(def.columns) ? def.columns : terrain.columns,
          rows: Number.isFinite(def.rows) ? def.rows : terrain.rows,
          tileSize: Number.isFinite(def.tileSize) ? def.tileSize : terrain.tileSize,
          heights: Array.isArray(def.heights) ? def.heights : terrain.heights,
          colors: Array.isArray(def.vertexColors) ? def.vertexColors : terrain.vertexColors,
          color: def.color || terrain.color || "#3f8f46",
          texture: def.texture || terrain.texture || "solid",
          kind: def.kind || terrain.kind || "grass",
          isSolid: def.isSolid === true || def.collidable === true,
          metadata: terrain
        });
      } else if (portalShape === "box") {
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(...def.size),
          new THREE.MeshStandardMaterial(materialOpts)
        );
      } else if (portalShape === "sphere") {
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(def.size[0], 32, 32),
          new THREE.MeshStandardMaterial(materialOpts)
        );
      } else if (portalShape === "cylinder") {
        const radius = def.size[0];
        const height = def.size[1];
        mesh = new THREE.Mesh(
          new THREE.CylinderGeometry(radius, radius, height, 24),
          new THREE.MeshStandardMaterial(materialOpts)
        );
      } else if (portalShape === "cone") {
        const radius = def.size[0];
        const height = def.size[1];
        mesh = new THREE.Mesh(
          new THREE.ConeGeometry(radius, height, 32),
          new THREE.MeshStandardMaterial(materialOpts)
        );
      } else if (portalShape === "pyramid") {
        const radius = def.size[0];
        const height = def.size[1];
        mesh = new THREE.Mesh(
          new THREE.ConeGeometry(radius, height, 4),
          new THREE.MeshStandardMaterial(materialOpts)
        );
        mesh.rotation.y = Math.PI / 4;
      } else if (portalShape === "torus") {
        const radius = def.size[0];
        const tube = def.size[1];
        mesh = new THREE.Mesh(
          new THREE.TorusGeometry(radius, tube, 16, 64),
          new THREE.MeshStandardMaterial(materialOpts)
        );
      } else if (def.type === "light") {
        const lightType = (def.lightType || "point").toLowerCase();
        const color = def.color || "#ffffff";
        const intensity = Number.isFinite(def.intensity) ? def.intensity : 1;
        if (lightType === "ambient") {
          light = new THREE.AmbientLight(color, intensity);
        } else if (lightType === "directional") {
          light = new THREE.DirectionalLight(color, intensity);
        } else if (lightType === "spot") {
          const distance = Number.isFinite(def.distance) ? def.distance : 0;
          const angle = Number.isFinite(def.angle) ? def.angle : Math.PI / 6;
          const penumbra = Number.isFinite(def.penumbra) ? def.penumbra : 0;
          const decay = Number.isFinite(def.decay) ? def.decay : 1;
          light = new THREE.SpotLight(color, intensity, distance, angle, penumbra, decay);
        } else if (lightType === "hemisphere") {
          const groundColor = def.groundColor || "#111111";
          light = new THREE.HemisphereLight(color, groundColor, intensity);
        } else {
          const distance = Number.isFinite(def.distance) ? def.distance : 0;
          const decay = Number.isFinite(def.decay) ? def.decay : 1;
          light = new THREE.PointLight(color, intensity, distance, decay);
        }
      }

      if (mesh) {
        if (def.type !== "equation-collider-plane" || !(def.equationCollider && typeof def.equationCollider === "object")) {
          mesh.position.set(...def.position);
        }
        mesh.userData.nvType = def.type || portalShape || null;
        mesh.userData.metaWorldLayerId = layerObjectId;
        if (typeof def.tag === "string" && def.tag) mesh.userData.tag = def.tag;
        if (typeof def.spawnId === "string" && def.spawnId) mesh.userData.spawnId = def.spawnId;
        if (Number.isFinite(def.spawnYaw)) mesh.userData.spawnYaw = def.spawnYaw;
        mesh.userData.isSolid = isExpressionLayerType(def.type)
          ? def.collider?.enabled === true
          : (def.type === "equation-collider-plane" ? def.collider !== false : (def.isSolid === true || def.collidable === true));
        mesh.userData.breakable = isExpressionLayerType(def.type)
          ? def.locked !== true
          : (def.type === "equation-collider-plane" ? false : (def.breakable !== false && !isPortal && !isSpawnPoint && def.isWater !== true));
        mesh.userData.isWater = def.isWater === true;
        if (def.terrain && typeof def.terrain === "object") {
          const restoredTerrain = JSON.parse(JSON.stringify(def.terrain));
          mesh.userData.terrain = def.type === "terrain-surface"
            ? { ...mesh.userData.terrain, ...restoredTerrain }
            : restoredTerrain;
        }
        if (def.hidden === true || def.visible === false) mesh.visible = false;
        scene.add(mesh);
        objects.push(mesh);
        layerEntries.push({ id: layerObjectId, def, object3d: mesh });
        if (isPortal) {
          mesh.userData.isPortal = true;
          mesh.userData.portalTarget = resolvedPortalTarget;
          mesh.userData.portalSameWorld = sameWorld;
          mesh.userData.portalSpawn = Array.isArray(def.spawn) ? [...def.spawn] : null;
          mesh.userData.portalSpawnPoint = typeof portalSpawnPoint === "string" ? portalSpawnPoint : null;
          mesh.userData.portalSpawnYaw = Number.isFinite(def.spawnYaw) ? def.spawnYaw : null;
          mesh.userData.portalCooldownMs = Number.isFinite(def.cooldownMs) ? def.cooldownMs : 1200;
          if ((resolvedPortalTarget || sameWorld) && portals) {
            const box = new THREE.Box3().setFromObject(mesh);
            portals.push({
              box,
              targetWorld: resolvedPortalTarget,
              sameWorld,
              spawn: Array.isArray(def.spawn) ? def.spawn : null,
              spawnYaw: Number.isFinite(def.spawnYaw) ? def.spawnYaw : null,
              spawnPoint: typeof portalSpawnPoint === "string" ? portalSpawnPoint : null,
              cooldownMs: Number.isFinite(def.cooldownMs) ? def.cooldownMs : 1200,
              lastTriggeredAt: 0
            });
          } else {
            console.warn("Portal missing targetWorld:", def);
          }
        }
        if (actionList.length > 0 && collisionActions) {
          const box = new THREE.Box3().setFromObject(mesh);
          const actions = actionList
            .map(action => normalizeAction(action, resolvedPortalTarget, sameWorld))
            .filter(Boolean);
          if (actions.length > 0) {
            const collisionRef = {
              box,
              actions,
              cooldownMs: Number.isFinite(def.cooldownMs) ? def.cooldownMs : 1200,
              lastTriggeredAt: 0
            };
            collisionActions.push(collisionRef);
            mesh.userData.collisionActionRef = collisionRef;
          }
        }
        if (useTargets) {
          const rawUseActions = def.useAction ?? def.onUse;
          const useList = Array.isArray(rawUseActions) ? rawUseActions : (rawUseActions ? [rawUseActions] : []);
          if (useList.length > 0) {
            mesh.userData.useAction = rawUseActions;
            const actions = useList
              .map(action => normalizeAction(action, resolvedPortalTarget, sameWorld))
              .filter(Boolean);
            if (actions.length > 0) {
              const useRef = {
                position: mesh.position.clone(),
                range: Number.isFinite(def.useRange) ? def.useRange : 2,
                actions,
                cooldownMs: Number.isFinite(def.useCooldownMs) ? def.useCooldownMs : 600,
                lastTriggeredAt: 0
              };
              useTargets.push(useRef);
              mesh.userData.useTargetRef = useRef;
            }
          }
        }

        if (def.isWater === true && waterVolumes) {
          const box = new THREE.Box3().setFromObject(mesh);
          waterVolumes.push({
            box,
            buoyancyScale: Number.isFinite(def.waterBuoyancyScale) ? def.waterBuoyancyScale : 1
          });
        }

        if (((def.type === "equation-collider-plane" && def.collider !== false) || (isExpressionLayerType(def.type) && def.collider?.enabled === true) || def.isSolid || def.collidable === true) && def.isWater !== true) {
          if (isExpressionLayerType(def.type) && def.collider?.enabled === true) {
            const colliderRef = createExpressionLayerColliderRef(THREE, mesh, def, getExpressionLayerOptions(camera || window.VRWorldContext?.camera)) || { type: "box", box: new THREE.Box3().setFromObject(mesh) };
            colliders.push(colliderRef);
            mesh.userData.colliderRef = colliderRef;
          } else if (def.type === "terrain-surface") {
            const colliderRef = createTerrainSurfaceColliderRef(THREE, mesh) || { type: "box", box: new THREE.Box3().setFromObject(mesh) };
            colliders.push(colliderRef);
            mesh.userData.colliderRef = colliderRef;
          } else if (portalShape === "box") {
            const [sx, sy, sz] = def.size;
            const halfSize = new THREE.Vector3(sx / 2, sy / 2, sz / 2);
            const center = new THREE.Vector3(...def.position);
            const box = new THREE.Box3(center.clone().sub(halfSize), center.clone().add(halfSize));
            const colliderRef = { type: "box", box };
            colliders.push(colliderRef);
            mesh.userData.colliderRef = colliderRef;
          } else if (portalShape === "sphere") {
            const center = new THREE.Vector3(...def.position);
            const radius = def.size[0];
            const colliderRef = { type: "sphere", center, radius };
            colliders.push(colliderRef);
            mesh.userData.colliderRef = colliderRef;
          } else if (["cylinder", "cone", "pyramid", "torus"].includes(portalShape)) {
            const colliderRef = { type: "box", box: new THREE.Box3().setFromObject(mesh) };
            colliders.push(colliderRef);
            mesh.userData.colliderRef = colliderRef;
          } else if (def.type === "equation-collider-plane" && def.collider !== false) {
            const colliderRef = makePlaneColliderRef(THREE, mesh);
            colliders.push(colliderRef);
            mesh.userData.colliderRef = colliderRef;
          } else if (def.type === "console" || def.type === "object-file" || def.type === "asset") {
            const colliderRef = { type: "box", box: new THREE.Box3().setFromObject(mesh) };
            colliders.push(colliderRef);
            mesh.userData.colliderRef = colliderRef;
            mesh.userData.objectFileColliderFactory?.(colliderRef);
          } else if (def.type === "math-function" && def.collider !== false) {
            const sphere = new THREE.Sphere();
            new THREE.Box3().setFromObject(mesh).getBoundingSphere(sphere);
            const colliderRef = { type: "sphere", center: sphere.center.clone(), radius: sphere.radius };
            colliders.push(colliderRef);
            mesh.userData.colliderRef = colliderRef;
          }
        }
      }

      if (light) {
        light.userData = light.userData || {};
        light.userData.metaWorldLayerId = layerObjectId;
        if (def.hidden === true || def.visible === false) light.visible = false;
        if (Array.isArray(def.position)) {
          light.position.set(...def.position);
        }
        if (Array.isArray(def.target) && light.target) {
          light.target.position.set(...def.target);
          scene.add(light.target);
        }
        scene.add(light);
        if (lights) lights.push(light);
        layerEntries.push({ id: layerObjectId, def, object3d: light });
      }
    }

    registerMetaWorldLayerBridge({ state, filePath, worldData, layerEntries, THREE, scene, objects, colliders, camera });
    notifyMetaWorldLayersChanged({ reason: "worldLoaded" });

    if (spawnPoints) {
      spawnPoints.push(...spawnCandidates);
    }

    const shouldAutoSpawn = options?.skipAutoSpawn !== true;
    if (shouldAutoSpawn && controls) {
      const availableSpawns = spawnPoints && spawnPoints.length > 0 ? spawnPoints : spawnCandidates;
      const spawnPointId = typeof options?.spawnPoint === "string" ? options.spawnPoint.trim() : null;
      let chosen = null;
      if (availableSpawns.length > 0) {
        if (spawnPointId) {
          chosen = availableSpawns.find(point => point?.id === spawnPointId) || null;
        }
        if (!chosen) {
          const idx = Math.floor(Math.random() * availableSpawns.length);
          chosen = availableSpawns[idx] || null;
        }
      }
      const position = Array.isArray(chosen?.position) && chosen.position.length >= 3
        ? chosen.position
        : [0, 0, 0];
      controls.getObject().position.set(position[0], position[1], position[2]);
      if (movementState?.worldMode === "2d" && movementState?.movementMode !== "topdown") {
        movementState.planeZ = Number.isFinite(position[2]) ? position[2] : 0;
        controls.getObject().position.z = movementState.planeZ;
      }
      if (movementState) {
        movementState.velocityY = 0;
        movementState.isGrounded = true;
      }
      const yaw = Number.isFinite(options?.spawnYaw)
        ? options.spawnYaw
        : Number.isFinite(chosen?.yaw)
          ? chosen.yaw
          : null;
      if (Number.isFinite(yaw)) {
        controls.getObject().rotation.y = yaw;
      }
    }
  } catch (err) {
    console.error("Failed to load world:", err);
  }
}
