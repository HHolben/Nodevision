// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/ConstructAbilities/PlacedMeshFactoryAbility.mjs
// This file creates meshes for Game View inventory placement abilities. It maps selected inventory item IDs to transparent Three.js objects and initial collider shapes.

import { installMovementApi } from "../movementContext.mjs";

export function installPlacedMeshFactoryAbility(ctx) {
  const { THREE, functionPlotterPanel } = ctx;

  function createPlacedMesh(selectedItem, inventory) {
    const id = String(selectedItem?.id || "").toLowerCase();
    if (id === "box") return boxPlacement();
    if (id === "sphere") return spherePlacement();
    if (id === "cylinder") return cylinderPlacement();
    if (id === ctx.FLYING_CARPET_ITEM_ID) return flyingCarpetPlacement();
    if (id === "math-function") return mathFunctionPlacement();
    if (id === "portal") return portalPlacement();
    if (id === "spawn" || id === "spawn-point" || id === "spawnpoint") return spawnPlacement();
    if (id === "console") return consolePlacement(inventory);
    if (id === "iframe") return iframePlacement();
    if (id === "object-file") return objectFilePlacement(selectedItem, inventory);
    if (id === "image-plane") return imagePlanePlacement(selectedItem, inventory);
    return null;
  }

  function boxPlacement() {
    return {
      mesh: new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xa0a0a0 })),
      collider: { type: "box", half: new THREE.Vector3(0.5, 0.5, 0.5) }
    };
  }

  function spherePlacement() {
    return {
      mesh: new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 24), new THREE.MeshStandardMaterial({ color: 0x7ec8ff })),
      collider: { type: "sphere", radius: 0.5 }
    };
  }

  function cylinderPlacement() {
    return {
      mesh: new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 20), new THREE.MeshStandardMaterial({ color: 0xb5a67a })),
      collider: { type: "cylinder", radius: 0.5, halfHeight: 0.5 }
    };
  }

  function flyingCarpetPlacement() {
    return {
      mesh: ctx.api.createFlyingCarpetMesh(),
      collider: { type: "box", half: new THREE.Vector3(ctx.FLYING_CARPET_WIDTH / 2, ctx.FLYING_CARPET_HEIGHT / 2, ctx.FLYING_CARPET_DEPTH / 2) }
    };
  }

  function mathFunctionPlacement() {
    const panelRef = functionPlotterPanel || window.VRWorldContext?.functionPlotterPanel;
    const pending = panelRef?.consumePendingConfig?.() || null;
    if (!pending) {
      panelRef?.open?.();
      return null;
    }
    const mesh = ctx.api.buildMathFunctionMesh(pending);
    if (!mesh) return null;
    return { mesh, collider: mesh.userData?.mathFunctionProperties?.collider ? { type: "sphere", radius: 0.7 } : null };
  }

  function portalPlacement() {
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.72, 0.075, 16, 64),
      new THREE.MeshStandardMaterial({ color: 0x55ccff, emissive: 0x55ccff, emissiveIntensity: 0.95, transparent: true, opacity: 0.72 })
    );
    mesh.userData.portalSameWorld = true;
    mesh.userData.portalDestinationMode = "coordinate";
    mesh.userData.portalSpawn = null;
    return { mesh, collider: null };
  }

  function spawnPlacement() {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 18, 14),
      new THREE.MeshStandardMaterial({ color: 0x35d07f, emissive: 0x0a4f2a, emissiveIntensity: 0.45 })
    );
    mesh.userData.isSpawn = true;
    mesh.userData.spawnYaw = 0;
    return { mesh, collider: null };
  }

  function consolePlacement(inventory) {
    const props = ctx.api.parseConsoleProperties(inventory);
    if (!props) return null;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.15, 0.7), new THREE.MeshStandardMaterial({ color: props.color }));
    mesh.userData.consoleProperties = props;
    return { mesh, collider: props.collider ? { type: "box", half: new THREE.Vector3(0.45, 0.575, 0.35) } : null };
  }

  function iframePlacement() {
    const props = ctx.api.parseIframeProperties();
    if (!props) return null;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(props.width, props.height, props.depth),
      new THREE.MeshStandardMaterial({ color: 0xf8fbff, emissive: 0x183a5f, emissiveIntensity: 0.28 })
    );
    Object.assign(mesh.userData, {
      iframeSrc: props.src,
      iframeTitle: props.title,
      iframeAllow: props.allow,
      iframeSandbox: props.sandbox,
      iframeColor: "#f8fbff",
      iframeObject: { src: props.src, iframeSrc: props.src, title: props.title, iframeTitle: props.title, allow: props.allow, sandbox: props.sandbox }
    });
    return { mesh, collider: null };
  }

  function objectFilePlacement(selectedItem, inventory) {
    const objectFilePath = String(selectedItem?.objectFilePath || inventory?.getSelectedObjectFile?.() || "").trim();
    if (!objectFilePath) return null;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x6e80d8 }));
    mesh.userData.objectFilePath = objectFilePath;
    mesh.userData.objectFileColliderBinding = "geometry";
    return { mesh, collider: { type: "box", half: new THREE.Vector3(0.5, 0.5, 0.5) } };
  }

  function imagePlanePlacement(selectedItem, inventory) {
    const presetPath = String(selectedItem?.imageFilePath || inventory?.getSelectedImageFile?.() || "").trim();
    const props = ctx.api.parseImagePlaneProperties(inventory, presetPath);
    if (!props) return null;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(props.width, props.height),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, side: THREE.DoubleSide })
    );
    Object.assign(mesh.userData, { imageFilePath: props.imageFilePath, imageWidth: props.width, imageHeight: props.height });
    void (async () => {
      const applier = await ctx.api.ensureImagePlaneTextureApplier();
      if (applier) await applier(mesh, THREE);
    })();
    return { mesh, collider: null };
  }

  return installMovementApi(ctx, {
    createPlacedMesh,
    boxPlacement,
    spherePlacement,
    cylinderPlacement,
    flyingCarpetPlacement,
    mathFunctionPlacement,
    portalPlacement,
    spawnPlacement,
    consolePlacement,
    iframePlacement,
    objectFilePlacement,
    imagePlanePlacement
  });
}
