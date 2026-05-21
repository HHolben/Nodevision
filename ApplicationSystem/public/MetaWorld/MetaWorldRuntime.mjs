// Nodevision/ApplicationSystem/public/MetaWorld/MetaWorldRuntime.mjs
// Shared MetaWorld runtime used by standalone pages and the GameView panel.

import { loadMetaWorldFromDocument } from "./MetaWorldLoader.mjs";
import { MetaWorldScene } from "./MetaWorldScene.mjs";
import { MetaWorldPhysics } from "./MetaWorldPhysics.mjs";
import { MetaWorldInteractions } from "./MetaWorldInteractions.mjs";
import { MetaWorldUI } from "./MetaWorldUI.mjs";
import { GravityDropExhibit } from "./Exhibits/GravityDropExhibit.mjs";
import { ProjectileRangeExhibit } from "./Exhibits/ProjectileRangeExhibit.mjs";
import { PendulumExhibit } from "./Exhibits/PendulumExhibit.mjs";

const exhibitTypes = {
  "gravity-drop": GravityDropExhibit,
  "projectile-range": ProjectileRangeExhibit,
  "pendulum": PendulumExhibit,
};

const exhibitLogNames = {
  "gravity-drop": "Gravity Drop",
  "projectile-range": "Projectile Range",
  "pendulum": "Pendulum Study",
};

function ensureMetaWorldStyles() {
  if (document.getElementById("nodevision-metaworld-runtime-styles")) return;
  const style = document.createElement("style");
  style.id = "nodevision-metaworld-runtime-styles";
  style.textContent = `
    .metaworld-panel { box-sizing: border-box; height: 100%; border-left: 1px solid #cad2dc; background: rgba(250, 252, 253, 0.94); padding: 22px; overflow: auto; box-shadow: -12px 0 26px rgba(23, 32, 51, 0.08); color: #172033; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .metaworld-panel h1 { margin: 6px 0 10px; font-size: 1.35rem; line-height: 1.2; }
    .metaworld-panel p { margin: 0 0 18px; line-height: 1.45; color: #485568; }
    .panel-kicker { color: #0f766e; font-size: 0.72rem; font-weight: 750; letter-spacing: 0.08em; text-transform: uppercase; }
    .parameter-list { display: grid; grid-template-columns: 1fr auto; gap: 8px 14px; margin: 16px 0; padding: 12px 0; border-top: 1px solid #d9e0e7; border-bottom: 1px solid #d9e0e7; }
    .parameter-list dt { color: #5c687a; font-size: 0.86rem; }
    .parameter-list dd { margin: 0; font-variant-numeric: tabular-nums; font-weight: 700; }
    .control-row { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0; }
    .control-row button { border: 1px solid #9aa8b6; border-radius: 6px; background: #172033; color: white; padding: 8px 12px; font: inherit; cursor: pointer; }
    .control-row button:hover { background: #263244; }
    .readout-list { display: grid; gap: 9px; }
    .readout { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 32px; border-bottom: 1px solid #e1e7ed; font-variant-numeric: tabular-nums; }
    .readout span { color: #5c687a; }
  `;
  document.head.appendChild(style);
}

export function loadMetaWorldFromHtmlDocument(doc) {
  return loadMetaWorldFromDocument(doc);
}

export function mountMetaWorld({ viewport, uiRoot, world, displayName = world?.name } = {}) {
  if (!viewport) throw new Error("MetaWorldRuntime: viewport is required");
  if (!uiRoot) throw new Error("MetaWorldRuntime: uiRoot is required");
  if (!world) throw new Error("MetaWorldRuntime: world is required");

  ensureMetaWorldStyles();

  const sceneSystem = new MetaWorldScene({ container: viewport, world });
  const physics = new MetaWorldPhysics({ gravity: world.gravity, timestep: world.timestep });
  const ui = new MetaWorldUI({ root: uiRoot, world });

  const controllers = world.exhibits.map((definition) => {
    const Controller = exhibitTypes[definition.type];
    if (!Controller) throw new Error(`Unknown MetaWorld exhibit type: ${definition.type}`);
    const controller = new Controller({ definition, sceneSystem, physics, ui });
    controller.mount();
    console.log(`Loaded exhibit: ${exhibitLogNames[definition.type] || definition.title}.`);
    return controller;
  });

  const interactions = new MetaWorldInteractions({
    sceneSystem,
    ui,
    permissions: world.interactionPermissions,
  });

  let accumulator = 0;
  sceneSystem.addAnimationHook((dt) => {
    accumulator += dt;
    while (accumulator >= world.timestep) {
      physics.step(world.timestep);
      accumulator -= world.timestep;
    }
  });

  interactions.start();
  if (controllers[0]) interactions.selectController(controllers[0]);
  sceneSystem.start();
  console.log(`Loaded MetaWorld: ${displayName}.`);

  return {
    world,
    sceneSystem,
    physics,
    ui,
    interactions,
    controllers,
    dispose() {
      interactions.dispose?.();
      sceneSystem.dispose?.();
      viewport.replaceChildren();
      uiRoot.replaceChildren();
    },
  };
}
