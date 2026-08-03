// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/DrawingGuides.mjs
// Editor-only drawing guides and simple assisted drawing helpers.

import { writeDrawingAssistMetadata } from "./DrawingAssistSettings.mjs";
import { appendIsometricGrid, appendPerspective, appendRectGrid, appendSymmetry } from "./DrawingGuideRenderers.mjs";

export function createDrawingGuidesController(deps = {}) {
  const {
    svgRoot,
    overlayLayer,
    createSvgEl,
    getViewBox,
    uiAttrName = "data-nv-editor-ui",
    markDirty,
  } = deps;
  let settings = null;
  let group = null;

  function ensureGroup() {
    if (group?.isConnected) return group;
    group = createSvgEl("g", { [uiAttrName]: "drawing-guides", "data-nv-drawing-guides": "true" });
    group.style.pointerEvents = "none";
    overlayLayer?.appendChild(group);
    return group;
  }

  function render(nextSettings = settings) {
    settings = nextSettings || settings || {};
    const host = ensureGroup();
    while (host.firstChild) host.removeChild(host.firstChild);
    if (!settings.guidesVisible) return;
    const type = String(settings.guideType || "rectangular-grid");
    if (type === "rectangular-grid") appendRectGrid(host, createSvgEl, settings, getViewBox, uiAttrName);
    else if (type === "isometric-grid") appendIsometricGrid(host, createSvgEl, settings, getViewBox, uiAttrName);
    else if (type.includes("symmetry")) appendSymmetry(host, createSvgEl, settings, getViewBox, uiAttrName);
    else if (type.includes("perspective")) appendPerspective(host, createSvgEl, settings, getViewBox, uiAttrName);
  }

  function setSettings(nextSettings = {}) {
    settings = { ...(settings || {}), ...nextSettings };
    render(settings);
    if (svgRoot) writeDrawingAssistMetadata(svgRoot, settings);
    markDirty?.(true);
    return settings;
  }

  function snapPoint(point) {
    if (!settings?.assistedDrawing && !(Number(settings?.snapStrength) > 0)) return point;
    const strength = Math.max(0, Math.min(1, Number(settings.snapStrength) || 0));
    if (strength <= 0) return point;
    const spacing = Math.max(0.001, Number(settings.guideSpacing) || 24);
    const origin = settings.guideOrigin || { x: 0, y: 0 };
    if (String(settings.guideType || "").includes("grid")) {
      const sx = origin.x + Math.round((point.x - origin.x) / spacing) * spacing;
      const sy = origin.y + Math.round((point.y - origin.y) / spacing) * spacing;
      return {
        x: point.x + (sx - point.x) * strength,
        y: point.y + (sy - point.y) * strength,
      };
    }
    return point;
  }

  function insertGuidesIntoSvg() {
    if (!svgRoot || !createSvgEl) return null;
    const artGroup = createSvgEl("g", { "data-nv-inserted-guides": "true" });
    const temp = createSvgEl("g");
    const savedVisible = settings?.guidesVisible;
    const renderSettings = { ...(settings || {}), guidesVisible: true };
    if (String(renderSettings.guideType || "rectangular-grid") === "rectangular-grid") appendRectGrid(temp, createSvgEl, renderSettings, getViewBox, "data-nv-guide-art");
    else if (String(renderSettings.guideType || "").includes("isometric")) appendIsometricGrid(temp, createSvgEl, renderSettings, getViewBox, "data-nv-guide-art");
    else if (String(renderSettings.guideType || "").includes("symmetry")) appendSymmetry(temp, createSvgEl, renderSettings, getViewBox, "data-nv-guide-art");
    else appendPerspective(temp, createSvgEl, renderSettings, getViewBox, "data-nv-guide-art");
    Array.from(temp.children).forEach((child) => {
      child.removeAttribute(uiAttrName);
      child.removeAttribute("data-nv-drawing-guide");
      artGroup.appendChild(child);
    });
    svgRoot.appendChild(artGroup);
    if (settings) settings.guidesVisible = savedVisible;
    return artGroup;
  }

  return {
    render,
    setSettings,
    snapPoint,
    insertGuidesIntoSvg,
    clear() {
      if (group) while (group.firstChild) group.removeChild(group.firstChild);
    },
    destroy() {
      group?.remove();
      group = null;
    },
  };
}

