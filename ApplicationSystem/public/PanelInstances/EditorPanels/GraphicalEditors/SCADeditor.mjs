// Nodevision/public/PanelInstances/EditorPanels/GraphicalEditors/SCADeditor.mjs
// Parametric OpenSCAD graphical editor (viewport-first). Generates and saves .scad.

import { updateToolbarState } from "/panels/createToolbar.mjs";
import {
  resetEditorHooks,
  ensureNodevisionState,
  saveText,
} from "./FamilyEditorCommon.mjs";

import { mountSCADParametricEditor } from "/PanelInstances/ViewPanels/FileViewers/scad/mountEditor.mjs";
import { NODE_TYPES } from "/PanelInstances/ViewPanels/FileViewers/scad/sceneTree.mjs";

export async function renderEditor(filePath, container) {
  resetEditorHooks();
  ensureNodevisionState("SCADediting");

  container.innerHTML = "";
  container.style.width = "100%";
  container.style.height = "100%";
  container.style.minHeight = "640px";
  container.style.display = "block";

  let controller = null;

  function handleSCADToolbarAction(callbackKey) {
    if (!controller?.ui) return;

    switch (callbackKey) {
      case "scadAddCube":
        controller.ui.addNodeOfType(NODE_TYPES.cube);
        break;
      case "scadAddSphere":
        controller.ui.addNodeOfType(NODE_TYPES.sphere);
        break;
      case "scadAddCylinder":
        controller.ui.addNodeOfType(NODE_TYPES.cylinder);
        break;
      case "scadAddUnion":
        controller.ui.addNodeOfType(NODE_TYPES.union);
        break;
      case "scadAddDifference":
        controller.ui.addNodeOfType(NODE_TYPES.difference);
        break;
      case "scadAddIntersection":
        controller.ui.addNodeOfType(NODE_TYPES.intersection);
        break;
      case "scadWrapTranslate":
        controller.ui.wrapSelectedWith(NODE_TYPES.translate, { v: ["0", "0", "0"] });
        break;
      case "scadWrapRotate":
        controller.ui.wrapSelectedWith(NODE_TYPES.rotate, { a: ["0", "0", "0"] });
        break;
      case "scadWrapScale":
        controller.ui.wrapSelectedWith(NODE_TYPES.scale, { v: ["1", "1", "1"] });
        break;
      case "scadWrapUnion":
        controller.ui.wrapSelectedWith(NODE_TYPES.union, {});
        break;
      case "scadWrapDifference":
        controller.ui.wrapSelectedWith(NODE_TYPES.difference, {});
        break;
      case "scadWrapIntersection":
        controller.ui.wrapSelectedWith(NODE_TYPES.intersection, {});
        break;
      case "scadDeleteSelected":
        controller.ui.deleteSelected();
        break;
      case "scadFitView":
        controller.fit?.();
        break;
      case "scadRender":
        controller.renderOpenSCAD?.().catch(() => {});
        break;
      case "scadOpenCode":
        controller.ui.openCodeDialog?.();
        break;
      default:
        break;
    }
  }

  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.activeActionHandler = handleSCADToolbarAction;
  updateToolbarState({
    currentMode: "SCADediting",
    activeActionHandler: handleSCADToolbarAction,
  });

  controller = await mountSCADParametricEditor(container, filePath, { initialOpenMode: "parametric" });

  // Hook toolbar save to the active file path as .scad.
  window.getEditorMarkdown = () => controller?.generateSCAD?.() || "";
  window.saveMDFile = async (path = filePath) => {
    // saveMDFile must save to the requested path (File -> Save As flows may pass a path)
    await saveText(path, controller?.generateSCAD?.() || "");
  };

  // Provide a WYSIWYG-style save as well so generic save routes succeed.
  window.saveWYSIWYGFile = async (path = filePath) => {
    await saveText(path, controller?.generateSCAD?.() || "");
  };

  return {
    destroy() {
      try {
        controller?.dispose?.();
      } catch {
        // ignore
      }
      if (window.NodevisionState?.activeActionHandler === handleSCADToolbarAction) {
        window.NodevisionState.activeActionHandler = null;
      }
      container.innerHTML = "";
    },
  };
}
