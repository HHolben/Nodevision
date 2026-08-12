// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/InspectionModificationAbilities/StlVertexEditingAbility.mjs
// This file defines STL vertex editing markers for Game View. It manages marker meshes and vertex collection separately from the frame update loop.

import { installMovementApi } from "../movementContext.mjs";

export function installStlVertexEditingAbility(ctx) {
  const { THREE, scene, movementState } = ctx;

  function clearStlVertexMarkers() {
    ctx.stlVertexMarkers.forEach((marker) => {
      if (marker?.parent) marker.parent.remove(marker);
      marker.geometry?.dispose?.();
      marker.material?.dispose?.();
    });
    ctx.stlVertexMarkers.length = 0;
  }

  function refreshStlVertexMarkers() {
    clearStlVertexMarkers();
    if (!movementState.stlEdit || !Array.isArray(movementState.stlVertices)) return;
    if (movementState.stlVertices.length > 500) return;
    const material = new THREE.MeshStandardMaterial({ color: 0xff8844, emissive: 0xff6600, emissiveIntensity: 0.35 });
    for (const vertex of movementState.stlVertices) {
      const marker = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), material.clone());
      marker.position.set(vertex.x || 0, vertex.y || 0, vertex.z || 0);
      marker.userData.isStlVertex = true;
      scene.add(marker);
      ctx.stlVertexMarkers.push(marker);
    }
  }

  function addStlVertex(point) {
    if (!movementState.stlEdit) return false;
    if (!Array.isArray(movementState.stlVertices)) movementState.stlVertices = [];
    movementState.stlVertices.push({ x: point.x, y: point.y, z: point.z });
    movementState.stlNeedsMarkerRefresh = true;
    return true;
  }

  return installMovementApi(ctx, {
    clearStlVertexMarkers,
    refreshStlVertexMarkers,
    addStlVertex
  });
}
