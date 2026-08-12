// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/InspectionModificationAbilities/ConsoleInspectionAbility.mjs
// This file defines object and console inspection/editing helpers for Game View. It applies console color and collider settings and delegates detailed inspection to the object inspector panel.

import { installMovementApi } from "../movementContext.mjs";

export function installConsoleInspectionAbility(ctx) {
  const { THREE, colliders, objectInspector, worldPropertiesPanel, consolePanels } = ctx;

  function applyColorToMeshTarget(target, colorHex) {
    if (!target || !colorHex) return;
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
      } else if (mesh.material?.color) mesh.material.color.set(colorHex);
    });
  }

  function setBoxColliderEnabled(target, enabled) {
    if (!target) return;
    const existing = target.userData?.colliderRef;
    if (!enabled && existing) {
      const idx = colliders.indexOf(existing);
      if (idx !== -1) colliders.splice(idx, 1);
      delete target.userData.colliderRef;
      return;
    }
    if (enabled && !existing) {
      const colliderRef = { type: "box", box: new THREE.Box3().setFromObject(target) };
      colliders.push(colliderRef);
      target.userData.colliderRef = colliderRef;
      target.userData.objectFileColliderFactory?.(colliderRef);
      return;
    }
    if (enabled && existing) {
      if (existing.type === "compound" && typeof existing.update === "function") existing.update();
      else existing.box = new THREE.Box3().setFromObject(target);
    }
  }

  function applyConsoleConfig(target, config) {
    if (!target || !config) return;
    if (config.color) applyColorToMeshTarget(target, config.color);
    setBoxColliderEnabled(target, config.collider);
    const existing = target.userData?.consoleProperties || {};
    target.userData.consoleProperties = {
      ...existing,
      color: config.color || existing.color,
      collider: config.collider !== false,
      objectFile: config.objectFile || existing.objectFile || "",
      linkedObject: config.linkedObject || existing.linkedObject || ""
    };
  }

  function tryUseConsoleTarget() {
    const hit = ctx.api.getInspectHit();
    const consoleMesh = hit?.object;
    if (!consoleMesh || String(consoleMesh.userData?.nvType || "").toLowerCase() !== "console") return false;
    consolePanels?.openUsePanel?.(consoleMesh);
    return true;
  }

  function openInspectTarget(target, distance = null) {
    if (!target) return false;
    const type = String(target.userData?.nvType || "").toLowerCase();
    if (["equation-collider-plane", "equation-inequality"].includes(type) && window.VRWorldContext?.equationObjectsPanel?.openForTarget) {
      return window.VRWorldContext.equationObjectsPanel.openForTarget(target);
    }
    if (type === "console" && consolePanels?.openInspectPanel) {
      return consolePanels.openInspectPanel(target, distance, { onApply: (mesh, config) => applyConsoleConfig(mesh, config) });
    }
    if (objectInspector) return objectInspector.inspectTarget(target, distance);
    return false;
  }

  function handleInspectAction() {
    const hit = ctx.api.getInspectHit();
    if (hit?.object && openInspectTarget(hit.object, hit.distance)) return true;
    const portalHit = ctx.api.getPortalInspectFallbackHit();
    if (portalHit?.object && openInspectTarget(portalHit.object, portalHit.distance)) return true;
    if (!hit) {
      objectInspector?.hide?.();
      worldPropertiesPanel?.open?.();
      return true;
    }
    objectInspector?.hide?.();
    return false;
  }

  return installMovementApi(ctx, {
    applyColorToMeshTarget,
    setBoxColliderEnabled,
    applyConsoleConfig,
    tryUseConsoleTarget,
    openInspectTarget,
    handleInspectAction
  });
}
