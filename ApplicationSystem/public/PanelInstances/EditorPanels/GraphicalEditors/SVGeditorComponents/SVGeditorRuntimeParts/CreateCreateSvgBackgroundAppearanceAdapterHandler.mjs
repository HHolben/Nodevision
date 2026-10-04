// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/CreateCreateSvgBackgroundAppearanceAdapterHandler.mjs
// This module implements create Create Svg Background Appearance Adapter Handler behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { applySvgDocumentBackgroundAppearance, syncSvgDocumentBackgroundGeometry, readSvgDocumentBackgroundAppearance, svgBackgroundCapabilities } from "../SvgDocumentBackground.mjs";
import { sampleSvgPaint } from "../EyedropperTool.mjs";

// Create Create Svg Background Appearance Adapter Handler operations.
export function createCreateSvgBackgroundAppearanceAdapterHandler(owner) {
  return function () {
    const beforeSvgText = owner.svgSession.serializeSvgForSave();
    const wasDirty = owner.svgSession.svgDocumentDirty;
    let disposed = false;
    let validationError = "";
    function restoreOpeningSnapshot() {
      owner.svgSession.setSvgFromString(beforeSvgText);
      owner.svgSession.markDocumentDirty(wasDirty);
    }
    function applyBackground(value) {
      if (disposed) return false;
      validationError = "";
      try {
        const changed = applySvgDocumentBackgroundAppearance(owner.svgSession.svgRoot, value);
        syncSvgDocumentBackgroundGeometry(owner.svgSession.svgRoot);
        window.dispatchEvent(new CustomEvent("nv-svg-background-appearance-changed", {
          detail: {
            appearance: readSvgDocumentBackgroundAppearance(owner.svgSession.svgRoot)
          }
        }));
        return changed;
      } catch (err) {
        validationError = err?.message || "Background appearance could not be applied.";
        return false;
      }
    }
    return {
      getCapabilities() {
        return svgBackgroundCapabilities();
      },
      readAppearance() {
        return readSvgDocumentBackgroundAppearance(owner.svgSession.svgRoot);
      },
      previewAppearance(value) {
        const changed = applyBackground(value);
        if (changed) owner.svgSession.setStatus("Previewing SVG background");
        return changed;
      },
      commitAppearance(value) {
        applyBackground(value);
        const afterSvgText = owner.svgSession.serializeSvgForSave();
        if (beforeSvgText !== afterSvgText) {
          owner.svgSession.history.pushCustom({
            kind: "svg-background-appearance",
            undo: () => {
              owner.svgSession.setSvgFromString(beforeSvgText);
              owner.svgSession.markDocumentDirty(wasDirty);
              return {
                label: "svg-background-appearance"
              };
            },
            redo: () => {
              owner.svgSession.setSvgFromString(afterSvgText);
              owner.svgSession.markDocumentDirty(true);
              return {
                label: "svg-background-appearance"
              };
            }
          });
          owner.svgSession.markDocumentDirty(true);
          owner.svgSession.setStatus("Applied SVG background");
        } else {
          owner.svgSession.markDocumentDirty(wasDirty);
          owner.svgSession.setStatus("SVG background unchanged");
        }
        return readSvgDocumentBackgroundAppearance(owner.svgSession.svgRoot);
      },
      cancelAppearance() {
        restoreOpeningSnapshot();
        owner.svgSession.setStatus("Canceled SVG background changes");
      },
      getValidationError() {
        return validationError;
      },
      async requestPaintSample(target = "fill") {
        const sampled = owner.svgSession.selectedElement ? sampleSvgPaint(owner.svgSession.selectedElement) : null;
        const existing = target === "outline" ? sampled?.stroke : sampled?.fill;
        if (existing && existing !== "none" && !/^url\(/.test(existing)) return existing;
        if (typeof window.EyeDropper === "function") {
          const result = await new window.EyeDropper().open();
          return result?.sRGBHex || null;
        }
        validationError = "Eyedropper is unavailable on this platform; select an SVG object with a color or use the color input.";
        owner.svgSession.setStatus(validationError);
        return null;
      },
      subscribe(callback) {
        const handler = () => callback?.(readSvgDocumentBackgroundAppearance(owner.svgSession.svgRoot));
        window.addEventListener("nv-svg-editor-layout-changed", handler);
        window.addEventListener("nv-svg-background-appearance-changed", handler);
        return () => {
          window.removeEventListener("nv-svg-editor-layout-changed", handler);
          window.removeEventListener("nv-svg-background-appearance-changed", handler);
        };
      },
      dispose() {
        disposed = true;
      }
    };
  };
}
