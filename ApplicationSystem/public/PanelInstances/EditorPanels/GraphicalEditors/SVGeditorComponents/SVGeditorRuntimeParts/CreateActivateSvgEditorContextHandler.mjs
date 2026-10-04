// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/CreateActivateSvgEditorContextHandler.mjs
// This module implements create Activate Svg Editor Context Handler behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { setEditorContext } from "../../../../../EditorAttentionState.mjs";
import { reportSvgAttentionSelection } from "./ParseEditableSvgRoot.mjs";
import { updateToolbarState } from "/panels/createToolbar.mjs";
import { syncSvgDocumentBackgroundGeometry } from "../SvgDocumentBackground.mjs";
import { getAttrNumber, parsePoints } from "../svgDom.mjs";

// Create Activate Svg Editor Context Handler operations.
export function createActivateSvgEditorContextHandler(owner) {
  return function () {
    if (!owner.svgSession.isCurrentRender()) return false;
    window.__nvSvgEditorActivePath = owner.filePath;
    window.__nvWysiwygActivePath = owner.filePath;
    window.currentActiveFilePath = owner.filePath;
    window.filePath = owner.filePath;
    window.NodevisionState = window.NodevisionState || {};
    window.NodevisionState.activePanelType = "GraphicalEditor";
    window.NodevisionState.currentMode = "SVG Editing";
    window.NodevisionState.selectedFile = owner.filePath;
    window.NodevisionState.selectedFileIsDirectory = false;
    window.NodevisionState.activeEditorFilePath = owner.filePath;
    window.NodevisionState.activeActionHandler = null;
    window.NodevisionState.fileIsDirty = owner.svgSession.svgDocumentDirty;
    const activeTool = owner.svgSession.toolState?.mode || window.NodevisionState.svgDrawTool || "select";
    setEditorContext({
      filePath: owner.filePath,
      fileFamily: "svg",
      fileFamilyLabel: "SVG",
      editorMode: "SVGediting",
      editorModeLabel: "SVG Editing",
      activeTool,
      activeToolLabel: String(activeTool || "select") + " Tool"
    });
    reportSvgAttentionSelection(owner.svgSession.selectedElement);
    const imageContext = owner.svgSession.selectedSvgImageContext();
    updateToolbarState({
      currentMode: "SVG Editing",
      selectedFile: owner.filePath,
      activeEditorFilePath: owner.filePath,
      activeActionHandler: null,
      fileIsDirty: owner.svgSession.svgDocumentDirty,
      svgImageSelected: Boolean(imageContext?.element),
      svgImagePath: imageContext?.linkedNotebookPath || null
    }, {
      rebuildDropdowns: false
    });
    return true;
  };
}

export function createCropToSelectionHandler(owner) {
  return function (padding = 8) {
    if (!owner.svgSession.selectedElement || owner.svgSession.selectedElement === owner.svgSession.svgRoot) {
      owner.svgSession.setStatus("Select an element first");
      return false;
    }
    try {
      const bbox = owner.svgSession.getElementBBoxInRoot(owner.svgSession.selectedElement);
      if (!bbox || !Number.isFinite(bbox.width) || !Number.isFinite(bbox.height) || bbox.width <= 0 || bbox.height <= 0) {
        owner.svgSession.setStatus("Unable to crop: invalid selection bounds");
        return false;
      }
      const pad = Number.isFinite(padding) ? Math.max(0, padding) : 0;
      const x = bbox.x - pad;
      const y = bbox.y - pad;
      const w = Math.max(1, bbox.width + pad * 2);
      const h = Math.max(1, bbox.height + pad * 2);
      owner.svgSession.svgRoot.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
      owner.svgSession.svgRoot.setAttribute("width", String(w));
      owner.svgSession.svgRoot.setAttribute("height", String(h));
      syncSvgDocumentBackgroundGeometry(owner.svgSession.svgRoot);
      owner.svgSession.setStatus(`Cropped to selection (${Math.round(w)}x${Math.round(h)})`);
      window.dispatchEvent(new CustomEvent("nv-svg-editor-layout-changed", {
        detail: {
          width: w,
          height: h
        }
      }));
      owner.svgSession.updateSvgRulers();
      return true;
    } catch (err) {
      console.warn("Crop to selection failed:", err);
      owner.svgSession.setStatus("Crop failed");
      return false;
    }
  };
}

export function createCollectSnapPointsHandler(owner) {
  return () => {
    const points = [];
    const addPoint = rootPt => {
      if (!rootPt) return;
      const x = Number(rootPt.x);
      const y = Number(rootPt.y);
      if (Number.isFinite(x) && Number.isFinite(y)) points.push({
        x,
        y
      });
    };
    const els = owner.svgSession.getSelectableElements();
    for (const el of els) {
      if (!el) continue;
      if (owner.options.ignoreElement && el === owner.options.ignoreElement) continue;
      const tag = el.tagName.toLowerCase();
      if (tag === "line") {
        const x1 = getAttrNumber(el, "x1", 0);
        const y1 = getAttrNumber(el, "y1", 0);
        const x2 = getAttrNumber(el, "x2", 0);
        const y2 = getAttrNumber(el, "y2", 0);
        addPoint(owner.svgSession.elementPointToRootPoint(el, x1, y1));
        addPoint(owner.svgSession.elementPointToRootPoint(el, x2, y2));
        continue;
      }
      if (tag === "polygon" || tag === "polyline") {
        const pts = parsePoints(el.getAttribute("points") || "");
        if (pts.length > 2000) continue;
        for (const [x, y] of pts) addPoint(owner.svgSession.elementPointToRootPoint(el, x, y));
        continue;
      }
      if (tag === "rect" || tag === "image" || tag === "use" || tag === "foreignobject") {
        const x = getAttrNumber(el, "x", 0);
        const y = getAttrNumber(el, "y", 0);
        const w = getAttrNumber(el, "width", 0);
        const h = getAttrNumber(el, "height", 0);
        addPoint(owner.svgSession.elementPointToRootPoint(el, x, y));
        addPoint(owner.svgSession.elementPointToRootPoint(el, x + w, y));
        addPoint(owner.svgSession.elementPointToRootPoint(el, x, y + h));
        addPoint(owner.svgSession.elementPointToRootPoint(el, x + w, y + h));
        continue;
      }
      if (tag === "circle" || tag === "ellipse") {
        const cx = getAttrNumber(el, "cx", 0);
        const cy = getAttrNumber(el, "cy", 0);
        addPoint(owner.svgSession.elementPointToRootPoint(el, cx, cy));
      }
    }
    return points;
  };
}
