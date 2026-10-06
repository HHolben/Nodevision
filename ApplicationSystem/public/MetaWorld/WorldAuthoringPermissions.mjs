// Nodevision/ApplicationSystem/public/MetaWorld/WorldAuthoringPermissions.mjs
// This module applies temporary view-level authoring restrictions without changing the permissions stored in a world document.

const AUTHORING_ABILITIES = new Set(["allowPlace", "allowBreak", "allowInspect", "allowToolUse", "allowSave"]);
const viewScopes = new Set();
export function acquireWorldViewPermissions(permissions) {
  const scope = Object.freeze({ authoring: permissions?.authoring !== false });
  viewScopes.add(scope);
  return () => viewScopes.delete(scope);
}
export const worldAuthoringAllowed = state => state?.viewPermissions?.authoring !== false
  && [...viewScopes].every(scope => scope.authoring);
export function viewAllowsAbility(state, key) {
  return worldAuthoringAllowed(state) || !AUTHORING_ABILITIES.has(key);
}
export function guardWorldMethods(api, state, names) {
  if (!api) return api;
  for (const name of names) {
    const method = api[name];
    if (typeof method !== "function") continue;
    api[name] = function (...args) { return worldAuthoringAllowed(state) ? method.apply(this, args) : false; };
  }
  return api;
}
export function guardWorldLayerBridge(bridge, state) {
  const readOnly = new Set(["getLayers", "getObjects", "listObjects", "getState", "getSnapshot"]);
  return guardWorldMethods(bridge, state, Object.keys(bridge).filter(key => !readOnly.has(key)));
}
export function guardWorldControllers(context) {
  const state = context.movementState;
  const controllers = {
    objectInspector: ["inspectTarget", "refreshActiveTarget"],
    worldPropertiesPanel: ["open"], functionPlotterPanel: ["open", "consumePendingConfig"],
    terrainToolController: ["openPanel", "setPaintModeActive", "generateTerrain", "clearGeneratedTerrain", "paintAtPoint"],
    equationColliderController: ["addPlane"], equationObjectsPanel: ["open", "openForTarget", "syncTargetLayer"],
    embeddedResourceEditor: ["open", "openSelectedResource", "finish"],
    temporalManipulatorPanel: ["open"], consolePanels: ["openInspectPanel"]
  };
  for (const [name, methods] of Object.entries(controllers)) guardWorldMethods(context[name], state, methods);
}
export function guardMovementAuthoring(methods, state) {
  return guardWorldMethods(methods, state, ["handleInspectAction", "handleSelectedItemAction", "handleEditorGrabPress",
    "handleDoubleClickGrab", "createTranslateGizmo", "createRotateGizmo", "createStretchGizmo", "startGrabFromHit",
    "tryPlaceVoxel", "tryDeleteVoxel", "removeVoxelMesh", "tryBreakTargetBlock", "handleStlEditUse"]);
}
