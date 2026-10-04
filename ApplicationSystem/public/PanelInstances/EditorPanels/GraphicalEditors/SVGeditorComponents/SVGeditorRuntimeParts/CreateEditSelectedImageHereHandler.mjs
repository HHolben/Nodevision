// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/CreateEditSelectedImageHereHandler.mjs
// This module implements create Edit Selected Image Here Handler behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { createPanelDOM } from "/panels/panelFactory.mjs";
import { createSvgEl } from "../svgDom.mjs";

// Create Edit Selected Image Here Handler operations.
export function createEditSelectedImageHereHandler(owner) {
  return async function () {
    const context = owner.svgSession.selectedSvgImageContext();
    if (!context?.element) {
      alert("Select an SVG image first.");
      return null;
    }
    if (owner.svgSession.internalPngController.isInternalPng(context.element)) {
      return owner.svgSession.internalPngController.editSelectedPng();
    }
    const imagePath = context.linkedNotebookPath || "";
    if (!imagePath) {
      alert("Only embedded PNGs or linked Notebook images can be edited here.");
      return null;
    }
    const safeId = btoa(imagePath).replace(/[^a-z0-9]/gi, "-");
    const instanceId = `nv-svg-image-editor-${safeId}`;
    const existing = document.querySelector(`.panel[data-instance-id="${instanceId}"]`);
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    const panelInst = await createPanelDOM("GraphicalEditor", instanceId, "EditorPanel", {
      filePath: imagePath,
      displayName: `Edit Image: ${imagePath}`
    });
    document.body.appendChild(panelInst.panel);
    panelInst.panel.classList.remove("docked");
    panelInst.panel.classList.add("undocked");
    panelInst.panel.__nvDefaultDockCell = window.activeCell && window.activeCell.classList?.contains("panel-cell") ? window.activeCell : null;
    if (panelInst.dockBtn && typeof panelInst.dockBtn.click === "function") {
      try {
        panelInst.dockBtn.dispatchEvent(new MouseEvent("click", {
          bubbles: false,
          cancelable: true,
          view: window
        }));
      } catch {
        panelInst.dockBtn.click();
      }
    }
    const rect = context.element.getBoundingClientRect?.() || null;
    const left = rect ? Math.min(window.innerWidth - 80, Math.max(20, Math.round(rect.left))) : Math.max(20, Math.round(window.innerWidth * 0.18));
    const top = rect ? Math.min(window.innerHeight - 80, Math.max(20, Math.round(rect.top))) : Math.max(20, Math.round(window.innerHeight * 0.12));
    panelInst.panel.style.width = "min(760px, 94vw)";
    panelInst.panel.style.height = "min(560px, 90vh)";
    panelInst.panel.style.left = `${left}px`;
    panelInst.panel.style.top = `${top}px`;
    panelInst.panel.style.zIndex = "23010";
    panelInst.panel.style.pointerEvents = "auto";
    owner.svgSession.setStatus(`Opened image editor: ${imagePath}`);
    return panelInst.panel;
  };
}

export function createInsertShapeHandler(owner) {
  return function (kind) {
    const style = owner.svgSession.currentStyleDefaults();
    let el = null;
    if (kind === "rect") {
      el = createSvgEl("rect", {
        x: 20,
        y: 20,
        width: 120,
        height: 80,
        fill: style.fill,
        stroke: style.stroke,
        "stroke-width": style.strokeWidth
      });
    } else if (kind === "circle") {
      el = createSvgEl("circle", {
        cx: 80,
        cy: 80,
        r: 40,
        fill: style.fill,
        stroke: style.stroke,
        "stroke-width": style.strokeWidth
      });
    } else if (kind === "ellipse") {
      el = createSvgEl("ellipse", {
        cx: 90,
        cy: 70,
        rx: 70,
        ry: 35,
        fill: style.fill,
        stroke: style.stroke,
        "stroke-width": style.strokeWidth
      });
    } else if (kind === "polygon") {
      el = createSvgEl("polygon", {
        points: "90,20 145,60 125,120 55,120 35,60",
        fill: style.fill,
        stroke: style.stroke,
        "stroke-width": style.strokeWidth
      });
    } else if (kind === "triangle") {
      el = createSvgEl("polygon", {
        points: "90,20 155,125 25,125",
        fill: style.fill,
        stroke: style.stroke,
        "stroke-width": style.strokeWidth
      });
    } else if (kind === "star") {
      el = createSvgEl("polygon", {
        points: "100,20 118,72 173,72 128,104 145,158 100,126 55,158 72,104 27,72 82,72",
        fill: style.fill,
        stroke: style.stroke,
        "stroke-width": style.strokeWidth
      });
    } else if (kind === "line") {
      el = createSvgEl("line", {
        x1: 20,
        y1: 20,
        x2: 140,
        y2: 80,
        stroke: style.stroke,
        "stroke-width": style.strokeWidth
      });
    } else if (kind === "path-bezier") {
      el = createSvgEl("path", {
        d: "M 20 20 C 60 0 120 120 170 70",
        fill: "none",
        stroke: style.stroke,
        "stroke-width": style.strokeWidth
      });
    }
    if (!el) return null;
    owner.svgSession.appendElement(el);
    owner.svgSession.setStatus(`Inserted ${kind}`);
    return el;
  };
}
