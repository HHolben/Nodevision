// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/LoadSvgEditorDocument.mjs
// This module implements load Svg Editor Document behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { SVG_RULER_SIDE } from "./CreateBlankSvgRoot.mjs";
import { createSvgEl } from "../svgDom.mjs";
import { fetchSvgText } from "../svgFetch.mjs";
import { parseEditableSvgRoot } from "./ParseEditableSvgRoot.mjs";
import { cleanupSvgCloneForSave, prepareSvgRootForEditor } from "../SvgPreservation.mjs";
import { syncSvgDocumentBackgroundGeometry } from "../SvgDocumentBackground.mjs";
import { createElementLayers } from "../../ElementLayers.mjs";
import { setDrawingAssistSettings, getDrawingAssistSettings, readDrawingAssistMetadata } from "../DrawingAssistSettings.mjs";
import { createSvgSelectionMarkers } from "../SvgSelectionMarkers.mjs";

// Load Svg Editor Document operations.
export async function loadSvgEditorDocument(scope) {
  scope.svgSession.svgLeftRuler = document.createElement("canvas");
  Object.assign(scope.svgSession.svgLeftRuler.style, {
    gridArea: "2 / 1 / 3 / 2",
    width: `${SVG_RULER_SIDE}px`,
    height: "100%",
    display: "block",
    background: "#f4f4f4"
  });
  scope.svgSession.svgViewportHost = document.createElement("div");
  Object.assign(scope.svgSession.svgViewportHost.style, {
    gridArea: "2 / 2 / 3 / 3",
    position: "relative",
    overflow: "hidden",
    background: "#ffffff",
    minWidth: "0",
    minHeight: "0"
  });
  scope.svgSession.svgViewport = document.createElement("div");
  Object.assign(scope.svgSession.svgViewport.style, {
    position: "absolute",
    inset: "0",
    overflow: "auto",
    background: "#fff"
  });
  scope.svgSession.svgViewportHost.appendChild(scope.svgSession.svgViewport);
  scope.svgSession.rulerLayout.append(scope.svgSession.rulerCorner, scope.svgSession.svgTopRuler, scope.svgSession.svgLeftRuler, scope.svgSession.svgViewportHost);
  scope.svgSession.svgRoot = createSvgEl("svg");
  scope.svgSession.svgRoot.id = "svg-editor";
  Object.assign(scope.svgSession.svgRoot.style, {
    width: "100%",
    height: "100%",
    minHeight: "400px",
    display: "block"
  });
  scope.svgSession.svgViewport.appendChild(scope.svgSession.svgRoot);
  scope.svgSession.svgText = "";
  scope.svgSession.loadError = null;
  if (scope.filePath) {
    try {
      scope.svgSession.svgText = await fetchSvgText(scope.filePath);
      if (!scope.svgSession.isCurrentRender()) return {
        value: void 0
      };
    } catch (err) {
      scope.svgSession.loadError = err;
    }
  }
  if (scope.svgSession.loadError && scope.filePath) {
    scope.svgSession.status.textContent = "Failed to load SVG; opened a blank canvas.";
    scope.svgSession.status.style.display = "block";
    console.warn("SVG editor: failed to load file, showing blank canvas as fallback.", scope.svgSession.loadError);
    scope.svgSession.svgText = "";
  }
  scope.svgSession.parsedSvg = parseEditableSvgRoot(scope.svgSession.svgText);
  if (scope.svgSession.parsedSvg.warning) {
    scope.svgSession.status.textContent = scope.svgSession.parsedSvg.warning;
    scope.svgSession.status.style.display = "block";
    console.warn("SVG editor: " + scope.svgSession.parsedSvg.warning);
  } else if (scope.svgSession.parsedSvg.blank) {
    scope.svgSession.status.textContent = "Blank SVG canvas ready.";
  }
  scope.svgSession.svgRoot.replaceWith(scope.svgSession.parsedSvg.root);
  scope.svgSession.svgRoot = scope.svgSession.parsedSvg.root;
  cleanupSvgCloneForSave(scope.svgSession.svgRoot);
  scope.svgSession.rootRuntimeState = prepareSvgRootForEditor(scope.svgSession.svgRoot);
  syncSvgDocumentBackgroundGeometry(scope.svgSession.svgRoot);
  scope.svgSession.layersMgr = createElementLayers(scope.svgSession.svgRoot, null, {
    getContext: () => scope.svgSession.svgEditorContext
  });
  scope.svgSession.layersPanelHost = null;
  scope.svgSession.originalLayersAttachHost = typeof scope.svgSession.layersMgr?.attachHost === "function" ? scope.svgSession.layersMgr.attachHost.bind(scope.svgSession.layersMgr) : null;
  if (scope.svgSession.originalLayersAttachHost) {
    scope.svgSession.layersMgr.attachHost = host => {
      scope.svgSession.layersPanelHost = host || null;
      return scope.svgSession.originalLayersAttachHost(host);
    };
  }
  scope.svgSession.styleState = {
    fill: "#80c0ff",
    stroke: "#000000",
    strokeWidth: "0.1"
  };
  scope.svgSession.drawingAssistSettings = setDrawingAssistSettings({
    ...getDrawingAssistSettings(window),
    ...(readDrawingAssistMetadata(scope.svgSession.svgRoot) || {})
  }, window);
  scope.svgSession.toolState = {
    mode: "select",
    drawing: false,
    startPoint: null,
    tempShape: null,
    bezierStep: 0,
    bezierPoints: []
  };
  scope.svgSession.selectedElement = null;
  scope.svgSession.selectedElements = [];
  scope.svgSession.selectionMarkers = createSvgSelectionMarkers(scope.svgSession.getSelectableElements);
  scope.svgSession.selectedLineVertex = null;
  scope.svgSession.lastPointerRoot = null;
  scope.svgSession.svgClipboard = [];
  scope.svgSession.dragState = null;
  scope.svgSession.marqueeState = null;
  scope.svgSession.lineHandleDragState = null;
  scope.svgSession.resizeState = null;
  scope.svgSession.rotateState = null;
  scope.svgSession.pendingRotateCommand = null;
  scope.svgSession.selectionGrabState = null;
  scope.svgSession.svgCanvasZoom = 1;
  scope.svgSession.freehandStrokeState = null;
  scope.svgSession.freehandRenderRaf = 0;
  scope.svgSession.lastPointerClient = null;
  scope.svgSession.eyedropperHoldState = null;
  scope.svgSession.maskEditState = null;
}
