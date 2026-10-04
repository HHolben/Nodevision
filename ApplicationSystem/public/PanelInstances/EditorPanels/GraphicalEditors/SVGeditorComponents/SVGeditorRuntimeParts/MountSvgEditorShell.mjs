// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/MountSvgEditorShell.mjs
// This module implements mount Svg Editor Shell behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { setEditorContext } from "../../../../../EditorAttentionState.mjs";
import { updateToolbarState } from "/panels/createToolbar.mjs";
import { SVG_RULER_SIDE, SVG_RULER_THICKNESS } from "./CreateBlankSvgRoot.mjs";

// Mount Svg Editor Shell operations.
export function mountSvgEditorShell(scope) {
  setEditorContext({
    filePath: scope.filePath,
    fileFamily: "svg",
    fileFamilyLabel: "SVG",
    editorMode: "SVGediting",
    editorModeLabel: "SVG Editing",
    activeTool: "select",
    activeToolLabel: "Selection Tool"
  });
  if (!scope.container) throw new Error("Container required");
  scope.svgSession.renderToken = Symbol("svg-editor:" + scope.filePath);
  scope.container.__nvEditorRenderToken = scope.svgSession.renderToken;
  scope.container.innerHTML = "";
  scope.svgSession.wrapper = document.createElement("div");
  scope.svgSession.wrapper.id = "editor-root";
  scope.svgSession.wrapper.dataset.nvPanelZoomScope = "local";
  scope.svgSession.wrapper.dataset.nvSvgEditorRoot = "true";
  Object.assign(scope.svgSession.wrapper.style, {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    width: "100%",
    overflow: "hidden"
  });
  scope.svgSession.wrapper.tabIndex = 0;
  scope.container.appendChild(scope.svgSession.wrapper);
  scope.svgSession.disposed = false;
  scope.svgSession.isCurrentRender = () => !scope.svgSession.disposed && scope.container.__nvEditorRenderToken === scope.svgSession.renderToken && scope.svgSession.wrapper.isConnected;
  window.NodevisionState = window.NodevisionState || {};
  window.__nvHtmlEditorActivePath = null;
  updateToolbarState({
    currentMode: "SVG Editing",
    fileIsDirty: false,
    svgImageSelected: false,
    svgImagePath: null
  });
  scope.svgSession.status = document.createElement("div");
  scope.svgSession.status.id = "svg-message";
  scope.svgSession.status.textContent = "SVG editor ready";
  scope.svgSession.status.style.display = "none";
  scope.svgSession.wrapper.appendChild(scope.svgSession.status);
  scope.svgSession.body = document.createElement("div");
  Object.assign(scope.svgSession.body.style, {
    display: "flex",
    flex: "1",
    minHeight: "0",
    overflow: "hidden",
    position: "relative"
  });
  scope.svgSession.wrapper.appendChild(scope.svgSession.body);
  scope.svgSession.maskEditBanner = document.createElement("div");
  scope.svgSession.maskEditBanner.setAttribute("role", "status");
  scope.svgSession.maskEditBanner.setAttribute("aria-live", "polite");
  scope.svgSession.maskEditBanner.dataset.nvEditorUi = "mask-edit-indicator";
  Object.assign(scope.svgSession.maskEditBanner.style, {
    position: "absolute",
    top: "10px",
    right: "14px",
    zIndex: "30",
    display: "none",
    alignItems: "center",
    gap: "8px",
    maxWidth: "min(420px, calc(100% - 28px))",
    padding: "7px 9px",
    border: "2px dashed #111827",
    borderRadius: "6px",
    background: "rgba(255, 255, 255, 0.96)",
    boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
    color: "#111827",
    font: "12px/1.35 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial",
    pointerEvents: "auto"
  });
  scope.svgSession.maskEditBannerText = document.createElement("span");
  scope.svgSession.maskEditBannerText.style.fontWeight = "700";
  scope.svgSession.maskEditArtworkButton = document.createElement("button");
  scope.svgSession.maskEditArtworkButton.type = "button";
  scope.svgSession.maskEditArtworkButton.textContent = "Edit Artwork";
  scope.svgSession.maskEditArtworkButton.title = "Return selection to the masked or clipped artwork";
  Object.assign(scope.svgSession.maskEditArtworkButton.style, {
    minHeight: "28px",
    whiteSpace: "nowrap"
  });
  scope.svgSession.maskEditArtworkButton.addEventListener("click", () => scope.svgSession.editArtworkFromMaskEdit());
  scope.svgSession.maskEditBanner.append(scope.svgSession.maskEditBannerText, scope.svgSession.maskEditArtworkButton);
  scope.svgSession.body.appendChild(scope.svgSession.maskEditBanner);
  scope.svgSession.rulerLayout = document.createElement("div");
  Object.assign(scope.svgSession.rulerLayout.style, {
    flex: "1",
    minHeight: "0",
    minWidth: "0",
    display: "grid",
    width: "100%",
    height: "100%",
    gridTemplateColumns: `${SVG_RULER_SIDE}px 1fr`,
    gridTemplateRows: `${SVG_RULER_THICKNESS}px 1fr`,
    overflow: "hidden"
  });
  scope.svgSession.body.appendChild(scope.svgSession.rulerLayout);
  scope.svgSession.rulerCorner = document.createElement("div");
  Object.assign(scope.svgSession.rulerCorner.style, {
    gridArea: "1 / 1 / 2 / 2",
    background: "#f4f4f4",
    borderRight: "1px solid #ccc",
    borderBottom: "1px solid #ccc"
  });
  scope.svgSession.svgTopRuler = document.createElement("canvas");
  Object.assign(scope.svgSession.svgTopRuler.style, {
    gridArea: "1 / 2 / 2 / 3",
    width: "100%",
    height: `${SVG_RULER_THICKNESS}px`,
    display: "block",
    background: "#f4f4f4"
  });
}
