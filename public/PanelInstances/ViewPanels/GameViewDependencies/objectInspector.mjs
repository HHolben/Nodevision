// Nodevision/public/PanelInstances/ViewPanels/GameViewDependencies/objectInspector.mjs
// Floating inspect/modify panel for in-range world objects.

import { createFloatingInventoryPanel } from "/PanelInstances/InfoPanels/PlayerInventory.mjs";

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
  if (colliderRef.type === "box") {
    colliderRef.box = new THREE.Box3().setFromObject(target);
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
}

function removeColliderForTarget(colliders, target) {
  const colliderRef = target?.userData?.colliderRef;
  if (!colliderRef) return;
  const idx = colliders.indexOf(colliderRef);
  if (idx !== -1) colliders.splice(idx, 1);
  delete target.userData.colliderRef;
}

export function createObjectInspector({ THREE, panel, sceneObjects, colliders }) {
  const floatingPanel = createFloatingInventoryPanel({
    title: "Inspect / Modify",
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

    const kind = target.userData?.nvType || target.name || target.type || "Object";
    const distanceText = Number.isFinite(distance) ? ` | distance ${distance.toFixed(2)}m` : "";
    infoLine.textContent = `Target: ${kind}${distanceText}`;
  }

  function applyFormToTarget() {
    if (!activeTarget) return;
    activeTarget.scale.set(
      Math.max(0.1, parseNumber(sxInput.value, activeTarget.scale.x || 1)),
      Math.max(0.1, parseNumber(syInput.value, activeTarget.scale.y || 1)),
      Math.max(0.1, parseNumber(szInput.value, activeTarget.scale.z || 1))
    );

    applyColorToTarget(activeTarget, colorInput.value);
    applyMaterialType(THREE, activeTarget, materialSelect.value, colorInput.value);

    if (colliderInput.checked && !activeTarget.userData?.colliderRef) {
      addBoxColliderForTarget(THREE, colliders, activeTarget);
    } else if (!colliderInput.checked && activeTarget.userData?.colliderRef) {
      removeColliderForTarget(colliders, activeTarget);
    }

    activeTarget.userData.physicsEnabled = physicsInput.checked;
    activeTarget.userData.isSolid = physicsInput.checked;

    syncTargetCollider(THREE, colliders, activeTarget);
    loadPreviewFromTarget(activeTarget);
    populateFormFromTarget(activeTarget);
  }

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
      if (!target) return false;
      if (!sceneObjects?.includes?.(target)) return false;
      activeTarget = target;
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
