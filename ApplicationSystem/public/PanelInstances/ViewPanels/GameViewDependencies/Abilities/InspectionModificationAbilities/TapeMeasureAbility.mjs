// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/InspectionModificationAbilities/TapeMeasureAbility.mjs
// This file defines the Tape Measure selected-item ability for Game View. It owns measurement marker storage, distance labels, preview updates, and the tool use handler.

import { installMovementApi } from "../movementContext.mjs";

export function installTapeMeasureAbility(ctx) {
  const { THREE, scene, objects, ground, camera, movementState } = ctx;

  function getMeasurementVisualsStore() {
    if (!window.VRWorldContext) return [];
    if (!Array.isArray(window.VRWorldContext.measurementVisuals)) window.VRWorldContext.measurementVisuals = [];
    return window.VRWorldContext.measurementVisuals;
  }

  function registerMeasurementVisual(entry) {
    if (!entry) return;
    const store = getMeasurementVisualsStore();
    if (!store.includes(entry)) store.push(entry);
  }

  function removeMeasurementVisual(entry) {
    if (!entry) return;
    if (entry?.parent) entry.parent.remove(entry);
    entry?.geometry?.dispose?.();
    entry?.material?.map?.dispose?.();
    entry?.material?.dispose?.();
    const store = getMeasurementVisualsStore();
    const idx = store.indexOf(entry);
    if (idx !== -1) store.splice(idx, 1);
  }

  function clearMeasurementVisuals() {
    const store = getMeasurementVisualsStore();
    store.forEach((entry) => {
      if (entry?.parent) entry.parent.remove(entry);
      entry?.geometry?.dispose?.();
      entry?.material?.map?.dispose?.();
      entry?.material?.dispose?.();
    });
    store.length = 0;
    Object.assign(movementState, {
      tapeMeasureFirstPoint: null,
      tapeMeasureSecondPoint: null,
      tapeMeasureFirstMarker: null,
      tapeMeasureSecondMarker: null,
      tapeMeasureLine: null,
      tapeMeasureLabel: null
    });
  }

  function createMeasureMarker(point, endpointRole) {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 14, 14),
      new THREE.MeshStandardMaterial({ color: 0xffdf5d, emissive: 0x6a4d00, emissiveIntensity: 0.8 })
    );
    marker.position.copy(point);
    marker.userData.isMeasure = true;
    marker.userData.isMeasureEndpoint = endpointRole || null;
    return marker;
  }

  function createMeasureLine(startPoint, endPoint) {
    const geometry = new THREE.BufferGeometry().setFromPoints([startPoint.clone(), endPoint.clone()]);
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 }));
    line.userData.isMeasure = true;
    return line;
  }

  function createDistanceLabel(text, position) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 192;
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
    sprite.position.copy(position);
    sprite.scale.set(1.9, 0.7, 1);
    Object.assign(sprite.userData, {
      isMeasure: true,
      labelCanvas: canvas,
      labelContext: canvas.getContext("2d"),
      labelTexture: texture
    });
    updateDistanceLabel(sprite, text, position);
    return sprite;
  }

  function updateDistanceLabel(sprite, text, position) {
    const { labelContext: draw, labelCanvas: canvas, labelTexture: texture } = sprite?.userData || {};
    if (draw && canvas) {
      draw.clearRect(0, 0, canvas.width, canvas.height);
      draw.fillStyle = "rgba(0, 0, 0, 0.62)";
      draw.fillRect(40, 48, 432, 96);
      draw.strokeStyle = "rgba(255, 255, 255, 0.85)";
      draw.lineWidth = 4;
      draw.strokeRect(40, 48, 432, 96);
      draw.fillStyle = "#f7fbff";
      draw.font = "700 56px monospace";
      draw.textAlign = "center";
      draw.textBaseline = "middle";
      draw.fillText(text, canvas.width / 2, canvas.height / 2);
    }
    if (texture) texture.needsUpdate = true;
    if (position && sprite?.position) sprite.position.copy(position);
  }

  function getTapeMeasureHit() {
    ctx.raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const candidates = [];
    if (ground?.isMesh && ground?.visible) candidates.push(ground);
    candidates.push(...(objects || []).filter((obj) => obj?.isMesh && obj?.visible && obj?.userData?.isMeasure !== true && obj?.userData?.isWater !== true && obj?.userData?.isLiquid !== true));
    const hits = ctx.raycaster.intersectObjects(candidates, false);
    return hits.find((h) => Number.isFinite(h.distance) && h.distance <= ctx.useRangeMax && h.object?.visible) || null;
  }

  function ensureTapeMeasureLineAndLabel(startPoint, endPoint) {
    if (!startPoint || !endPoint) return;
    if (!movementState.tapeMeasureLine) {
      const line = createMeasureLine(startPoint, endPoint);
      scene.add(line);
      movementState.tapeMeasureLine = line;
      registerMeasurementVisual(line);
    } else {
      movementState.tapeMeasureLine.geometry.setFromPoints([startPoint.clone(), endPoint.clone()]);
      movementState.tapeMeasureLine.geometry.computeBoundingSphere();
    }
    const mid = startPoint.clone().add(endPoint).multiplyScalar(0.5);
    mid.y += 0.2;
    const text = `${startPoint.distanceTo(endPoint).toFixed(2)} m`;
    if (!movementState.tapeMeasureLabel) {
      const label = createDistanceLabel(text, mid);
      scene.add(label);
      movementState.tapeMeasureLabel = label;
      registerMeasurementVisual(label);
    } else {
      updateDistanceLabel(movementState.tapeMeasureLabel, text, mid);
    }
  }

  function updateTapeMeasurePreview() {
    const firstPoint = movementState.tapeMeasureFirstPoint;
    const secondPoint = movementState.tapeMeasureSecondPoint;
    if (!firstPoint || secondPoint) return;
    const hit = getTapeMeasureHit();
    if (!hit?.point) {
      if (movementState.tapeMeasureLine) movementState.tapeMeasureLine.visible = false;
      if (movementState.tapeMeasureLabel) movementState.tapeMeasureLabel.visible = false;
      return;
    }
    ensureTapeMeasureLineAndLabel(firstPoint, hit.point);
    if (movementState.tapeMeasureLine) movementState.tapeMeasureLine.visible = true;
    if (movementState.tapeMeasureLabel) movementState.tapeMeasureLabel.visible = true;
  }

  function useTapeMeasure() {
    const hit = getTapeMeasureHit();
    if (!hit?.point) return true;
    if (!movementState.tapeMeasureFirstPoint || movementState.tapeMeasureSecondPoint) {
      clearMeasurementVisuals();
      const firstPoint = hit.point.clone();
      const firstMarker = createMeasureMarker(firstPoint, "first");
      scene.add(firstMarker);
      registerMeasurementVisual(firstMarker);
      movementState.tapeMeasureFirstMarker = firstMarker;
      movementState.tapeMeasureFirstPoint = firstPoint;
      updateTapeMeasurePreview();
      return true;
    }
    const secondPoint = hit.point.clone();
    const firstPoint = movementState.tapeMeasureFirstPoint.clone();
    const secondMarker = createMeasureMarker(secondPoint, "second");
    scene.add(secondMarker);
    registerMeasurementVisual(secondMarker);
    movementState.tapeMeasureSecondMarker = secondMarker;
    movementState.tapeMeasureSecondPoint = secondPoint;
    ensureTapeMeasureLineAndLabel(firstPoint, secondPoint);
    if (movementState.tapeMeasureLine) movementState.tapeMeasureLine.visible = true;
    if (movementState.tapeMeasureLabel) movementState.tapeMeasureLabel.visible = true;
    return true;
  }

  ctx.api.registerSelectedItemAction("tape-measure", { use: useTapeMeasure });
  return installMovementApi(ctx, {
    getMeasurementVisualsStore,
    registerMeasurementVisual,
    removeMeasurementVisual,
    clearMeasurementVisuals,
    createMeasureMarker,
    createMeasureLine,
    createDistanceLabel,
    updateDistanceLabel,
    getTapeMeasureHit,
    ensureTapeMeasureLineAndLabel,
    updateTapeMeasurePreview,
    useTapeMeasure
  });
}
