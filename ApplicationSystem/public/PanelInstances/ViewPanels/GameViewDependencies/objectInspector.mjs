// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/objectInspector.mjs
// This file defines browser-side object Inspector logic for the Nodevision UI. It renders interface components and handles user interactions.

import { createFloatingInventoryPanel } from "/PanelInstances/InfoPanels/PlayerInventory.mjs";
import { getActiveMetaWorldLayerBridge, notifyMetaWorldLayersChanged } from "/MetaWorld/MetaWorldLayerState.mjs";
import { normalizePlaneEquationConfig, resizeEquationColliderPlaneMesh, syncPlaneColliderRef, makePlaneColliderRef } from "./equationColliderTool.mjs";

function parseNumber(value, fallback = 0) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

function cloneRenderableObject(THREE, target) {
  if (!target) return null;
  const clone = target.clone(true);
  clone.traverse((node) => {
    if (node?.isMesh) {
      if (Array.isArray(node.material)) {
        node.material = node.material.map((mat) => mat?.clone?.() || mat);
      } else if (node.material?.clone) {
        node.material = node.material.clone();
      }
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
  if (clone.position) clone.position.set(0, 0, 0);
  if (clone.rotation) clone.rotation.set(0, 0, 0);
  return clone;
}

function firstColorHex(target) {
  if (!target?.material) return "#b0b0b0";
  const material = Array.isArray(target.material) ? target.material[0] : target.material;
  if (!material?.color) return "#b0b0b0";
  return `#${material.color.getHexString()}`;
}

function applyColorToTarget(target, colorHex) {
  if (!target) return;
  const queue = [];
  target.traverse?.((node) => {
    if (node?.isMesh) queue.push(node);
  });
  if (queue.length === 0 && target?.isMesh) queue.push(target);
  queue.forEach((mesh) => {
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((mat) => {
        if (mat?.color) mat.color.set(colorHex);
      });
    } else if (mesh.material?.color) {
      mesh.material.color.set(colorHex);
    }
  });
}

function firstMaterial(target) {
  if (!target?.material) return null;
  return Array.isArray(target.material) ? target.material[0] : target.material;
}

function applyMaterialType(THREE, target, typeName, colorHex) {
  const matCtor = {
    MeshStandardMaterial: THREE.MeshStandardMaterial,
    MeshPhongMaterial: THREE.MeshPhongMaterial,
    MeshLambertMaterial: THREE.MeshLambertMaterial,
    MeshBasicMaterial: THREE.MeshBasicMaterial
  }[typeName];
  if (!matCtor) return;

  const queue = [];
  target.traverse?.((node) => {
    if (node?.isMesh) queue.push(node);
  });
  if (queue.length === 0 && target?.isMesh) queue.push(target);

  queue.forEach((mesh) => {
    const prev = firstMaterial(mesh);
    const next = new matCtor({
      color: colorHex,
      roughness: Number.isFinite(prev?.roughness) ? prev.roughness : 0.6,
      metalness: Number.isFinite(prev?.metalness) ? prev.metalness : 0.2
    });
    mesh.material = next;
  });
}

function syncTargetCollider(THREE, colliders, target) {
  const colliderRef = target?.userData?.colliderRef;
  if (!colliderRef) return;
  if (colliderRef.type === "compound" && typeof colliderRef.update === "function") {
    colliderRef.update();
  } else if (colliderRef.type === "box") {
    colliderRef.box = new THREE.Box3().setFromObject(target);
  } else if (colliderRef.type === "equation-plane") {
    syncPlaneColliderRef(THREE, target);
  } else if (colliderRef.type === "sphere") {
    const sphere = new THREE.Sphere();
    new THREE.Box3().setFromObject(target).getBoundingSphere(sphere);
    colliderRef.center = sphere.center.clone();
    colliderRef.radius = sphere.radius;
  }
}

function addBoxColliderForTarget(THREE, colliders, target) {
  const box = new THREE.Box3().setFromObject(target);
  const colliderRef = { type: "box", box };
  colliders.push(colliderRef);
  target.userData.colliderRef = colliderRef;
  target.userData.objectFileColliderFactory?.(colliderRef);
}

function removeColliderForTarget(colliders, target) {
  const colliderRef = target?.userData?.colliderRef;
  if (!colliderRef) return;
  const idx = colliders.indexOf(colliderRef);
  if (idx !== -1) colliders.splice(idx, 1);
  delete target.userData.colliderRef;
}

export function createObjectInspector({ THREE, panel, scene, sceneObjects, colliders, portals, spawnPoints }) {
  const floatingPanel = createFloatingInventoryPanel({
    title: "Inspect / Modify",
    closeBehavior: "hide",
    onRequestClose: () => floatingPanel.setVisible(false)
  });
  floatingPanel.setVisible(false);

  const root = document.createElement("div");
  root.style.display = "flex";
  root.style.flexDirection = "column";
  root.style.gap = "10px";
  root.style.font = "12px/1.3 monospace";
  floatingPanel.content.appendChild(root);

  const previewHost = document.createElement("div");
  previewHost.style.height = "220px";
  previewHost.style.border = "1px solid rgba(140,200,255,0.45)";
  previewHost.style.borderRadius = "8px";
  previewHost.style.background = "rgba(8,12,20,0.95)";
  root.appendChild(previewHost);

  const infoLine = document.createElement("div");
  infoLine.style.opacity = "0.92";
  root.appendChild(infoLine);

  const controls = document.createElement("div");
  controls.style.display = "grid";
  controls.style.gridTemplateColumns = "repeat(2, minmax(0, 1fr))";
  controls.style.gap = "8px";
  root.appendChild(controls);

  function labeledInput(labelText, inputEl) {
    const box = document.createElement("label");
    box.style.display = "flex";
    box.style.flexDirection = "column";
    box.style.gap = "4px";
    box.textContent = labelText;
    box.appendChild(inputEl);
    controls.appendChild(box);
    return inputEl;
  }

  const sxInput = labeledInput("Size X (scale)", document.createElement("input"));
  sxInput.type = "number";
  sxInput.step = "0.1";
  sxInput.min = "0.1";

  const syInput = labeledInput("Size Y (scale)", document.createElement("input"));
  syInput.type = "number";
  syInput.step = "0.1";
  syInput.min = "0.1";

  const szInput = labeledInput("Size Z (scale)", document.createElement("input"));
  szInput.type = "number";
  szInput.step = "0.1";
  szInput.min = "0.1";

  const colorInput = labeledInput("Color", document.createElement("input"));
  colorInput.type = "color";

  const colliderInput = labeledInput("Collider?", document.createElement("input"));
  colliderInput.type = "checkbox";

  const physicsInput = labeledInput("Physics?", document.createElement("input"));
  physicsInput.type = "checkbox";

  const materialSelect = labeledInput("Material", document.createElement("select"));
  ["MeshStandardMaterial", "MeshPhongMaterial", "MeshLambertMaterial", "MeshBasicMaterial"].forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name.replace("Mesh", "").replace("Material", "");
    materialSelect.appendChild(option);
  });

  const portalControls = document.createElement("div");
  portalControls.style.display = "none";
  portalControls.style.gridColumn = "1 / -1";
  portalControls.style.gridTemplateColumns = "repeat(2, minmax(0, 1fr))";
  portalControls.style.gap = "8px";
  portalControls.style.padding = "8px";
  portalControls.style.border = "1px solid rgba(255,175,80,0.42)";
  portalControls.style.borderRadius = "8px";
  controls.appendChild(portalControls);

  const portalHeading = document.createElement("div");
  portalHeading.textContent = "Portal Destination";
  portalHeading.style.gridColumn = "1 / -1";
  portalHeading.style.fontWeight = "700";
  portalControls.appendChild(portalHeading);

  function labeledPortalInput(labelText, inputEl) {
    const box = document.createElement("label");
    box.style.display = "flex";
    box.style.flexDirection = "column";
    box.style.gap = "4px";
    box.textContent = labelText;
    box.appendChild(inputEl);
    portalControls.appendChild(box);
    return inputEl;
  }

  const portalModeSelect = labeledPortalInput("Destination", document.createElement("select"));
  [
    ["world", "Another MetaWorld File"],
    ["coordinate", "Coordinate In This World"],
    ["linkedPortal", "Linked Portal In This World"],
    ["linkedWorldPortal", "Linked Portal In Another MetaWorld"]
  ].forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    portalModeSelect.appendChild(option);
  });

  const portalWorldInput = labeledPortalInput("MetaWorld File", document.createElement("input"));
  portalWorldInput.type = "text";
  portalWorldInput.placeholder = "path/to/world.html";

  const portalSpawnPointInput = labeledPortalInput("Spawn Point ID", document.createElement("input"));
  portalSpawnPointInput.type = "text";
  portalSpawnPointInput.placeholder = "optional";

  const portalXInput = labeledPortalInput("Target X", document.createElement("input"));
  const portalYInput = labeledPortalInput("Target Y", document.createElement("input"));
  const portalZInput = labeledPortalInput("Target Z", document.createElement("input"));
  [portalXInput, portalYInput, portalZInput].forEach((input) => {
    input.type = "number";
    input.step = "0.1";
  });

  const portalLinkedInput = labeledPortalInput("Linked Portal ID", document.createElement("input"));
  portalLinkedInput.type = "text";

  const portalCreateLinkedBtn = document.createElement("button");
  portalCreateLinkedBtn.type = "button";
  portalCreateLinkedBtn.textContent = "Create Linked Portal";
  portalCreateLinkedBtn.style.gridColumn = "1 / -1";
  portalControls.appendChild(portalCreateLinkedBtn);

  const planeControls = document.createElement("div");
  planeControls.style.display = "none";
  planeControls.style.gridColumn = "1 / -1";
  planeControls.style.gridTemplateColumns = "repeat(3, minmax(0, 1fr))";
  planeControls.style.gap = "8px";
  planeControls.style.padding = "8px";
  planeControls.style.border = "1px solid rgba(140,200,255,0.35)";
  planeControls.style.borderRadius = "8px";
  controls.appendChild(planeControls);

  function labeledPlaneInput(labelText, inputEl) {
    const box = document.createElement("label");
    box.style.display = "flex";
    box.style.flexDirection = "column";
    box.style.gap = "4px";
    box.textContent = labelText;
    box.appendChild(inputEl);
    planeControls.appendChild(box);
    return inputEl;
  }

  function labeledPlaneCheckbox(labelText) {
    const box = document.createElement("label");
    box.style.display = "inline-flex";
    box.style.alignItems = "center";
    box.style.gap = "6px";
    const input = document.createElement("input");
    input.type = "checkbox";
    box.appendChild(input);
    box.appendChild(document.createTextNode(labelText));
    planeControls.appendChild(box);
    return input;
  }

  const planeAInput = labeledPlaneInput("Plane A", document.createElement("input"));
  const planeBInput = labeledPlaneInput("Plane B", document.createElement("input"));
  const planeCInput = labeledPlaneInput("Plane C", document.createElement("input"));
  const planeDInput = labeledPlaneInput("Plane D", document.createElement("input"));
  const planeBoundXInput = labeledPlaneCheckbox("Bound X");
  const planeBoundYInput = labeledPlaneCheckbox("Bound Y");
  const planeBoundZInput = labeledPlaneCheckbox("Bound Z");
  const planeXMinInput = labeledPlaneInput("X Min", document.createElement("input"));
  const planeXMaxInput = labeledPlaneInput("X Max", document.createElement("input"));
  const planeYMinInput = labeledPlaneInput("Y Min", document.createElement("input"));
  const planeYMaxInput = labeledPlaneInput("Y Max", document.createElement("input"));
  const planeZMinInput = labeledPlaneInput("Z Min", document.createElement("input"));
  const planeZMaxInput = labeledPlaneInput("Z Max", document.createElement("input"));
  const planeDepthInput = labeledPlaneInput("Plane Depth", document.createElement("input"));
  [planeAInput, planeBInput, planeCInput, planeDInput, planeXMinInput, planeXMaxInput, planeYMinInput, planeYMaxInput, planeZMinInput, planeZMaxInput, planeDepthInput].forEach((input) => {
    input.type = "number";
    input.step = "0.1";
  });
  planeDepthInput.min = "0.02";
  planeDepthInput.step = "0.05";

  function refreshPlaneBoundControls() {
    planeXMinInput.disabled = planeBoundXInput.checked !== true;
    planeXMaxInput.disabled = planeBoundXInput.checked !== true;
    planeYMinInput.disabled = planeBoundYInput.checked !== true;
    planeYMaxInput.disabled = planeBoundYInput.checked !== true;
    planeZMinInput.disabled = planeBoundZInput.checked !== true;
    planeZMaxInput.disabled = planeBoundZInput.checked !== true;
  }
  [planeBoundXInput, planeBoundYInput, planeBoundZInput].forEach((input) => input.addEventListener("change", refreshPlaneBoundControls));

  const buttonRow = document.createElement("div");
  buttonRow.style.display = "flex";
  buttonRow.style.gap = "8px";
  root.appendChild(buttonRow);

  const applyBtn = document.createElement("button");
  applyBtn.type = "button";
  applyBtn.textContent = "Apply";
  buttonRow.appendChild(applyBtn);

  const refreshBtn = document.createElement("button");
  refreshBtn.type = "button";
  refreshBtn.textContent = "Refresh";
  buttonRow.appendChild(refreshBtn);

  const previewScene = new THREE.Scene();
  previewScene.background = new THREE.Color(0x0a1020);
  const previewCamera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
  previewCamera.position.set(1.9, 1.4, 2.2);
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
  keyLight.position.set(2.6, 3.2, 2.2);
  const fillLight = new THREE.AmbientLight(0x7ea0c8, 0.45);
  previewScene.add(keyLight, fillLight);
  const previewRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  previewRenderer.setSize(previewHost.clientWidth || 320, previewHost.clientHeight || 220, false);
  previewHost.appendChild(previewRenderer.domElement);

  let rafId = 0;
  let previewMesh = null;
  let activeTarget = null;

  function stopPreviewLoop() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  function startPreviewLoop() {
    stopPreviewLoop();
    const tick = () => {
      if (previewMesh) {
        previewMesh.rotation.y += 0.01;
      }
      previewRenderer.render(previewScene, previewCamera);
      rafId = requestAnimationFrame(tick);
    };
    tick();
  }

  function updatePreviewSize() {
    const width = Math.max(220, previewHost.clientWidth || 220);
    const height = Math.max(180, previewHost.clientHeight || 180);
    previewCamera.aspect = width / height;
    previewCamera.updateProjectionMatrix();
    previewRenderer.setSize(width, height, false);
  }

  function loadPreviewFromTarget(target) {
    if (previewMesh) {
      previewScene.remove(previewMesh);
      previewMesh = null;
    }
    const clone = cloneRenderableObject(THREE, target);
    if (clone) {
      previewMesh = clone;
      previewScene.add(previewMesh);
      const box = new THREE.Box3().setFromObject(previewMesh);
      const sphere = new THREE.Sphere();
      box.getBoundingSphere(sphere);
      const radius = Math.max(0.5, sphere.radius);
      previewCamera.position.set(radius * 1.6, radius * 1.2, radius * 1.8);
      previewCamera.lookAt(sphere.center);
    }
    updatePreviewSize();
    startPreviewLoop();
  }

  function isEquationColliderPlane(target) {
    return target?.userData?.nvType === "equation-collider-plane"
      || target?.userData?.nvType === "equation-inequality"
      || target?.userData?.equationCollider?.kind === "plane";
  }

  function readPlaneInputs(target) {
    const current = normalizePlaneEquationConfig(target?.userData?.equationCollider || {});
    return normalizePlaneEquationConfig({
      a: parseNumber(planeAInput.value, current.a),
      b: parseNumber(planeBInput.value, current.b),
      c: parseNumber(planeCInput.value, current.c),
      d: parseNumber(planeDInput.value, current.d),
      xmin: parseNumber(planeXMinInput.value, current.xmin),
      xmax: parseNumber(planeXMaxInput.value, current.xmax),
      ymin: parseNumber(planeYMinInput.value, current.ymin),
      ymax: parseNumber(planeYMaxInput.value, current.ymax),
      zmin: parseNumber(planeZMinInput.value, current.zmin),
      zmax: parseNumber(planeZMaxInput.value, current.zmax),
      thickness: parseNumber(planeDepthInput.value, current.thickness),
      boundX: planeBoundXInput.checked === true,
      boundY: planeBoundYInput.checked === true,
      boundZ: planeBoundZInput.checked === true,
      inequality: current.inequality === true,
      operator: current.operator || target?.userData?.equationInequalityOperator || "",
      inequalitySide: current.inequalitySide || target?.userData?.equationInequalitySide || "negative",
      expression: current.expression || target?.userData?.equationExpression || "",
      equationTemporal: current.equationTemporal === true || target?.userData?.equationTemporal === true,
      equationBaseExpression: target?.userData?.equationBaseExpression || current.equationBaseExpression || "",
      timeSeconds: window.VRWorldContext?.temporalController?.getTimeSeconds?.() ?? current.timeSeconds ?? 0
    });
  }

  function isPortalTarget(target) {
    return target?.userData?.isPortal === true || String(target?.userData?.nvType || "").toLowerCase() === "portal";
  }

  function portalRefMatchesTarget(portalRef, target) {
    if (!portalRef || !target) return false;
    const object = portalRef.object3d;
    return object === target || object?.children?.includes?.(target) || target.parent === object;
  }

  function resolveInspectableTarget(target) {
    if (!target) return null;
    if (sceneObjects?.includes?.(target) || isPortalTarget(target)) return target;

    let parent = target.parent || null;
    while (parent) {
      if (sceneObjects?.includes?.(parent) || isPortalTarget(parent)) return parent;
      parent = parent.parent || null;
    }

    if (Array.isArray(portals)) {
      const portalRef = portals.find((entry) => portalRefMatchesTarget(entry, target));
      if (portalRef?.object3d) return portalRef.object3d;
    }

    return null;
  }

  function getPortalObjectId(target) {
    const candidates = [target?.userData?.metaWorldLayerId, target?.userData?.tag, target?.name, target?.uuid];
    const explicit = candidates.find((value) => typeof value === "string" && value.trim());
    return explicit ? explicit.trim() : "";
  }

  function inferPortalMode(target) {
    const rawMode = String(target?.userData?.portalDestinationMode || "").trim();
    if (["world", "coordinate", "linkedPortal", "linkedWorldPortal"].includes(rawMode)) return rawMode;
    const linkedId = String(target?.userData?.portalLinkedPortalId || "").trim();
    const sameWorld = target?.userData?.portalSameWorld === true;
    if (linkedId && sameWorld) return "linkedPortal";
    if (linkedId) return "linkedWorldPortal";
    if (Array.isArray(target?.userData?.portalSpawn) && target.userData.portalSpawn.length >= 3) return "coordinate";
    if (typeof target?.userData?.portalTarget === "string" && target.userData.portalTarget.trim()) return "world";
    return sameWorld ? "coordinate" : "world";
  }

  function refreshPortalControlVisibility() {
    const mode = portalModeSelect.value;
    const showWorld = mode === "world" || mode === "linkedWorldPortal";
    const showCoordinate = mode === "coordinate";
    const showLinked = mode === "linkedPortal" || mode === "linkedWorldPortal";
    portalWorldInput.parentElement.style.display = showWorld ? "flex" : "none";
    portalSpawnPointInput.parentElement.style.display = mode === "world" ? "flex" : "none";
    [portalXInput, portalYInput, portalZInput].forEach((input) => {
      input.parentElement.style.display = showCoordinate ? "flex" : "none";
    });
    portalLinkedInput.parentElement.style.display = showLinked ? "flex" : "none";
    portalCreateLinkedBtn.style.display = mode === "linkedPortal" ? "block" : "none";
  }

  function markWorldDirty() {
    if (window.NodevisionState) window.NodevisionState.fileIsDirty = true;
  }

  function findWorldObjectDefinition(objectId) {
    const bridge = getActiveMetaWorldLayerBridge();
    const defs = Array.isArray(bridge?.worldData?.objects) ? bridge.worldData.objects : [];
    return defs.find((def) => {
      if (!def || typeof def !== "object") return false;
      return def.id === objectId || def.tag === objectId || def.name === objectId;
    }) || null;
  }

  function syncPortalDefinition(target) {
    if (!isPortalTarget(target)) return;
    const objectId = getPortalObjectId(target);
    const def = findWorldObjectDefinition(objectId);
    if (!def) return;
    def.type = "portal";
    def.portalDestinationMode = target.userData.portalDestinationMode || inferPortalMode(target);
    def.destinationMode = def.portalDestinationMode;
    def.sameWorld = target.userData.portalSameWorld === true;
    if (typeof target.userData.portalTarget === "string" && target.userData.portalTarget) def.targetWorld = target.userData.portalTarget;
    else delete def.targetWorld;
    if (Array.isArray(target.userData.portalSpawn) && target.userData.portalSpawn.length >= 3) def.spawn = target.userData.portalSpawn.slice(0, 3);
    else delete def.spawn;
    if (typeof target.userData.portalSpawnPoint === "string" && target.userData.portalSpawnPoint) def.spawnPoint = target.userData.portalSpawnPoint;
    else delete def.spawnPoint;
    if (typeof target.userData.portalLinkedPortalId === "string" && target.userData.portalLinkedPortalId) def.linkedPortalId = target.userData.portalLinkedPortalId;
    else delete def.linkedPortalId;
    if (Number.isFinite(target.userData.portalSpawnYaw)) def.spawnYaw = target.userData.portalSpawnYaw;
    if (Number.isFinite(target.userData.portalCooldownMs)) def.cooldownMs = target.userData.portalCooldownMs;
    const bridge = getActiveMetaWorldLayerBridge();
    if (bridge?.worldData?.metadata && typeof bridge.worldData.metadata === "object") {
      bridge.worldData.metadata.layersDirty = true;
      bridge.worldData.metadata.visibilityDirty = true;
    }
    notifyMetaWorldLayersChanged({ reason: "portalUpdated", objectId });
    markWorldDirty();
  }

  function syncPortalRuntimeRef(target) {
    if (!isPortalTarget(target)) return null;
    const objectId = getPortalObjectId(target);
    let portalRef = target.userData.portalRef || null;
    if (!portalRef && Array.isArray(portals)) {
      portalRef = portals.find((entry) => entry?.object3d === target || entry?.objectId === objectId) || null;
    }
    if (!portalRef && Array.isArray(portals)) {
      portalRef = { lastTriggeredAt: 0 };
      portals.push(portalRef);
    }
    if (!portalRef) return null;
    target.updateWorldMatrix?.(true, false);
    portalRef.box = new THREE.Box3().setFromObject(target);
    portalRef.object3d = target;
    portalRef.objectId = objectId;
    portalRef.targetWorld = typeof target.userData.portalTarget === "string" && target.userData.portalTarget ? target.userData.portalTarget : null;
    portalRef.sameWorld = target.userData.portalSameWorld === true;
    portalRef.destinationMode = target.userData.portalDestinationMode || inferPortalMode(target);
    portalRef.linkedPortalId = typeof target.userData.portalLinkedPortalId === "string" ? target.userData.portalLinkedPortalId : "";
    portalRef.spawn = Array.isArray(target.userData.portalSpawn) ? target.userData.portalSpawn.slice(0, 3) : null;
    portalRef.spawnPoint = typeof target.userData.portalSpawnPoint === "string" ? target.userData.portalSpawnPoint : null;
    portalRef.spawnYaw = Number.isFinite(target.userData.portalSpawnYaw) ? target.userData.portalSpawnYaw : null;
    portalRef.cooldownMs = Number.isFinite(target.userData.portalCooldownMs) ? target.userData.portalCooldownMs : 1200;
    target.userData.portalRef = portalRef;
    const collisionRef = target.userData.collisionActionRef;
    if (collisionRef) {
      collisionRef.box = portalRef.box;
      collisionRef.cooldownMs = portalRef.cooldownMs;
      collisionRef.actions = [{
        type: "portal",
        targetWorld: portalRef.targetWorld,
        sameWorld: portalRef.sameWorld,
        destinationMode: portalRef.destinationMode,
        linkedPortalId: portalRef.linkedPortalId,
        spawn: portalRef.spawn,
        spawnPoint: portalRef.spawnPoint,
        spawnYaw: portalRef.spawnYaw
      }];
    }
    return portalRef;
  }

  function keepPortalMaterialReadable(target) {
    const colorHex = firstColorHex(target);
    const materials = [];
    target.traverse?.((node) => {
      if (!node?.isMesh) return;
      if (Array.isArray(node.material)) materials.push(...node.material);
      else if (node.material) materials.push(node.material);
    });
    if (target?.isMesh && target.material) {
      if (Array.isArray(target.material)) materials.push(...target.material);
      else materials.push(target.material);
    }
    materials.forEach((mat) => {
      if (!mat) return;
      mat.transparent = true;
      if (!Number.isFinite(mat.opacity) || mat.opacity > 0.86) mat.opacity = 0.72;
      if (mat.emissive?.set) mat.emissive.set(colorHex);
      if (!Number.isFinite(mat.emissiveIntensity) || mat.emissiveIntensity < 0.5) mat.emissiveIntensity = 0.95;
    });
  }

  function findSceneObjectById(objectId) {
    if (!objectId || !Array.isArray(sceneObjects)) return null;
    return sceneObjects.find((object) => object?.userData?.metaWorldLayerId === objectId || object?.userData?.tag === objectId || object?.name === objectId) || null;
  }

  function ensureSameWorldLinkedPortal(target) {
    let linkedId = String(portalLinkedInput.value || "").trim();
    if (linkedId) return linkedId;
    const bridge = getActiveMetaWorldLayerBridge();
    if (typeof bridge?.addGameObjectLayer !== "function") return "";
    const sourceId = getPortalObjectId(target);
    if (!sourceId) return "";
    const position = target.position || { x: 0, y: 1, z: 0 };
    const added = bridge.addGameObjectLayer({
      type: "portal",
      name: "Linked Portal",
      tag: sourceId + "-linked",
      position: [position.x + 2, position.y, position.z],
      shape: "torus",
      size: [0.72, 0.075],
      color: "#ff9f1c",
      emissive: "#ff9f1c",
      emissiveIntensity: 0.95,
      opacity: 0.72,
      sameWorld: true,
      linkedPortalId: sourceId,
      portalDestinationMode: "linkedPortal",
      cooldownMs: 1200,
      isSolid: false,
      breakable: false
    });
    linkedId = added?.id || added?.tag || "";
    if (!linkedId) return "";
    portalLinkedInput.value = linkedId;
    const linkedObject = findSceneObjectById(linkedId);
    if (linkedObject) {
      linkedObject.userData.isPortal = true;
      linkedObject.userData.portalDestinationMode = "linkedPortal";
      linkedObject.userData.portalSameWorld = true;
      linkedObject.userData.portalTarget = null;
      linkedObject.userData.portalSpawn = null;
      linkedObject.userData.portalSpawnPoint = null;
      linkedObject.userData.portalLinkedPortalId = sourceId;
      applyColorToTarget(linkedObject, "#ff9f1c");
      keepPortalMaterialReadable(linkedObject);
      syncPortalRuntimeRef(linkedObject);
      syncPortalDefinition(linkedObject);
    }
    return linkedId;
  }

  function populatePortalControlsFromTarget(target) {
    const showPortalControls = isPortalTarget(target);
    portalControls.style.display = showPortalControls ? "grid" : "none";
    if (!showPortalControls) return;
    const mode = inferPortalMode(target);
    portalModeSelect.value = mode;
    portalWorldInput.value = typeof target.userData?.portalTarget === "string" ? target.userData.portalTarget : "";
    portalSpawnPointInput.value = typeof target.userData?.portalSpawnPoint === "string" ? target.userData.portalSpawnPoint : "";
    const spawn = Array.isArray(target.userData?.portalSpawn) && target.userData.portalSpawn.length >= 3
      ? target.userData.portalSpawn
      : [target.position?.x || 0, target.position?.y || 0, target.position?.z || 0];
    portalXInput.value = String(Number(spawn[0] || 0).toFixed(3));
    portalYInput.value = String(Number(spawn[1] || 0).toFixed(3));
    portalZInput.value = String(Number(spawn[2] || 0).toFixed(3));
    portalLinkedInput.value = typeof target.userData?.portalLinkedPortalId === "string" ? target.userData.portalLinkedPortalId : "";
    refreshPortalControlVisibility();
  }

  function applyPortalFormToTarget(target) {
    if (!isPortalTarget(target)) return;
    const mode = portalModeSelect.value;
    let linkedId = String(portalLinkedInput.value || "").trim();
    if (mode === "linkedPortal" && !linkedId) linkedId = ensureSameWorldLinkedPortal(target);
    target.userData.isPortal = true;
    target.userData.nvType = "portal";
    target.userData.portalDestinationMode = mode;
    target.userData.portalCooldownMs = Number.isFinite(target.userData.portalCooldownMs) ? target.userData.portalCooldownMs : 1200;

    if (mode === "world") {
      target.userData.portalTarget = String(portalWorldInput.value || "").trim() || null;
      target.userData.portalSameWorld = false;
      target.userData.portalLinkedPortalId = "";
      target.userData.portalSpawn = null;
      target.userData.portalSpawnPoint = String(portalSpawnPointInput.value || "").trim() || null;
    } else if (mode === "coordinate") {
      target.userData.portalTarget = null;
      target.userData.portalSameWorld = true;
      target.userData.portalLinkedPortalId = "";
      target.userData.portalSpawn = [
        parseNumber(portalXInput.value, target.position?.x || 0),
        parseNumber(portalYInput.value, target.position?.y || 0),
        parseNumber(portalZInput.value, target.position?.z || 0)
      ];
      target.userData.portalSpawnPoint = null;
    } else if (mode === "linkedPortal") {
      target.userData.portalTarget = null;
      target.userData.portalSameWorld = true;
      target.userData.portalLinkedPortalId = linkedId;
      target.userData.portalSpawn = null;
      target.userData.portalSpawnPoint = null;
    } else if (mode === "linkedWorldPortal") {
      target.userData.portalTarget = String(portalWorldInput.value || "").trim() || null;
      target.userData.portalSameWorld = false;
      target.userData.portalLinkedPortalId = linkedId;
      target.userData.portalSpawn = null;
      target.userData.portalSpawnPoint = null;
    }

    if (mode === "linkedPortal" && linkedId) {
      const reciprocal = findSceneObjectById(linkedId);
      const sourceId = getPortalObjectId(target);
      if (reciprocal && reciprocal !== target && sourceId) {
        reciprocal.userData.isPortal = true;
        reciprocal.userData.nvType = "portal";
        reciprocal.userData.portalDestinationMode = "linkedPortal";
        reciprocal.userData.portalSameWorld = true;
        reciprocal.userData.portalTarget = null;
        reciprocal.userData.portalSpawn = null;
        reciprocal.userData.portalSpawnPoint = null;
        reciprocal.userData.portalLinkedPortalId = sourceId;
        if (!reciprocal.userData.portalCooldownMs) reciprocal.userData.portalCooldownMs = 1200;
        keepPortalMaterialReadable(reciprocal);
        syncPortalRuntimeRef(reciprocal);
        syncPortalDefinition(reciprocal);
      }
    }

    keepPortalMaterialReadable(target);
    syncPortalRuntimeRef(target);
    syncPortalDefinition(target);
  }

  function populateFormFromTarget(target, distance = null) {
    if (!target) return;
    sxInput.value = String(Number(target.scale?.x || 1).toFixed(3));
    syInput.value = String(Number(target.scale?.y || 1).toFixed(3));
    szInput.value = String(Number(target.scale?.z || 1).toFixed(3));
    colorInput.value = firstColorHex(target);
    colliderInput.checked = Boolean(target.userData?.colliderRef);
    physicsInput.checked = Boolean(target.userData?.physicsEnabled || target.userData?.isSolid);
    const mat = firstMaterial(target);
    materialSelect.value = mat?.type || "MeshStandardMaterial";

    const planeConfig = normalizePlaneEquationConfig(target.userData?.equationCollider || {});
    const showPlaneControls = isEquationColliderPlane(target);
    planeControls.style.display = showPlaneControls ? "grid" : "none";
    if (showPlaneControls) {
      planeAInput.value = String(planeConfig.a);
      planeBInput.value = String(planeConfig.b);
      planeCInput.value = String(planeConfig.c);
      planeDInput.value = String(planeConfig.d);
      planeBoundXInput.checked = planeConfig.boundX === true;
      planeBoundYInput.checked = planeConfig.boundY === true;
      planeBoundZInput.checked = planeConfig.boundZ === true;
      planeXMinInput.value = String(planeConfig.xmin);
      planeXMaxInput.value = String(planeConfig.xmax);
      planeYMinInput.value = String(planeConfig.ymin);
      planeYMaxInput.value = String(planeConfig.ymax);
      planeZMinInput.value = String(planeConfig.zmin);
      planeZMaxInput.value = String(planeConfig.zmax);
      planeDepthInput.value = String(planeConfig.thickness);
      refreshPlaneBoundControls();
    }

    populatePortalControlsFromTarget(target);

    const kind = target.userData?.nvType || target.name || target.type || "Object";
    const distanceText = Number.isFinite(distance) ? ` | distance ${distance.toFixed(2)}m` : "";
    infoLine.textContent = `Target: ${kind}${distanceText}`;
  }

  function applyFormToTarget() {
    if (!activeTarget) return;
    if (isEquationColliderPlane(activeTarget)) {
      resizeEquationColliderPlaneMesh(THREE, activeTarget, readPlaneInputs(activeTarget));
      activeTarget.userData.nvType = activeTarget.userData?.nvType === "equation-inequality" ? "equation-inequality" : "equation-collider-plane";
      activeTarget.userData.isSolid = physicsInput.checked;
      activeTarget.userData.physicsEnabled = physicsInput.checked;
    } else {
      activeTarget.scale.set(
        Math.max(0.1, parseNumber(sxInput.value, activeTarget.scale.x || 1)),
        Math.max(0.1, parseNumber(syInput.value, activeTarget.scale.y || 1)),
        Math.max(0.1, parseNumber(szInput.value, activeTarget.scale.z || 1))
      );
    }

    applyColorToTarget(activeTarget, colorInput.value);
    applyMaterialType(THREE, activeTarget, materialSelect.value, colorInput.value);

    if (isEquationColliderPlane(activeTarget)) {
      const materials = Array.isArray(activeTarget.material) ? activeTarget.material : [activeTarget.material];
      materials.forEach((mat) => {
        if (!mat) return;
        mat.transparent = true;
        if (!Number.isFinite(mat.opacity) || mat.opacity > 0.5) mat.opacity = 0.34;
        mat.depthWrite = false;
        mat.side = THREE.DoubleSide;
      });
    }

    if (isPortalTarget(activeTarget)) {
      applyPortalFormToTarget(activeTarget);
    }

    if (colliderInput.checked && !activeTarget.userData?.colliderRef) {
      if (isEquationColliderPlane(activeTarget)) {
        const colliderRef = makePlaneColliderRef(THREE, activeTarget);
        colliders.push(colliderRef);
        activeTarget.userData.colliderRef = colliderRef;
      } else {
        addBoxColliderForTarget(THREE, colliders, activeTarget);
      }
    } else if (!colliderInput.checked && activeTarget.userData?.colliderRef) {
      removeColliderForTarget(colliders, activeTarget);
    }

    activeTarget.userData.physicsEnabled = physicsInput.checked;
    activeTarget.userData.isSolid = physicsInput.checked;

    syncTargetCollider(THREE, colliders, activeTarget);
    if (isEquationColliderPlane(activeTarget)) {
      window.VRWorldContext?.equationObjectsPanel?.syncTargetLayer?.(activeTarget, "equationObjectInspectorUpdated");
    }
    loadPreviewFromTarget(activeTarget);
    populateFormFromTarget(activeTarget);
  }

  portalModeSelect.addEventListener("change", refreshPortalControlVisibility);
  portalCreateLinkedBtn.addEventListener("click", () => {
    if (!activeTarget || !isPortalTarget(activeTarget)) return;
    portalModeSelect.value = "linkedPortal";
    const linkedId = ensureSameWorldLinkedPortal(activeTarget);
    if (linkedId) {
      portalLinkedInput.value = linkedId;
      refreshPortalControlVisibility();
      applyPortalFormToTarget(activeTarget);
      populateFormFromTarget(activeTarget);
    }
  });

  applyBtn.addEventListener("click", applyFormToTarget);
  refreshBtn.addEventListener("click", () => {
    if (!activeTarget) return;
    syncTargetCollider(THREE, colliders, activeTarget);
    loadPreviewFromTarget(activeTarget);
    populateFormFromTarget(activeTarget);
  });

  const resizeObserver = new ResizeObserver(() => updatePreviewSize());
  resizeObserver.observe(previewHost);

  return {
    inspectTarget(target, distance = null) {
      const resolvedTarget = resolveInspectableTarget(target);
      if (!resolvedTarget) return false;
      activeTarget = resolvedTarget;
      loadPreviewFromTarget(activeTarget);
      populateFormFromTarget(activeTarget, distance);
      floatingPanel.setVisible(true);
      floatingPanel.undock();
      return true;
    },
    hide() {
      floatingPanel.setVisible(false);
    },
    dispose() {
      stopPreviewLoop();
      resizeObserver.disconnect();
      previewRenderer.dispose();
      floatingPanel.dispose();
    }
  };
}
