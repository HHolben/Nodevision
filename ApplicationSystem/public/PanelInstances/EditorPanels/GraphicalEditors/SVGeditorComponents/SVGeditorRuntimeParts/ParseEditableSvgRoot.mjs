// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/ParseEditableSvgRoot.mjs
// This module implements parse Editable Svg Root behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { createBlankSvgRoot } from "./CreateBlankSvgRoot.mjs";
import { applyEditableSvgRootDefaults } from "../SvgPreservation.mjs";
import { initializeSvgEditingFeatures } from "./InitializeSvgEditingFeatures.mjs";
import { initializeSvgDocumentFeatures, initializeSvgChromeFeatures } from "./InitializeSvgDocumentFeatures.mjs";
import { loadSvgEditorDocument } from "./LoadSvgEditorDocument.mjs";
import { connectSvgPointerEvents } from "./ConnectSvgPointerEvents.mjs";
import { publishSvgEditorContext } from "./PublishSvgEditorContext.mjs";
import { setSelectionContext } from "../../../../../EditorAttentionState.mjs";

// Parse Editable Svg Root operations.
export function parseEditableSvgRoot(svgText = "") {
  const source = String(svgText || "");
  if (!source.trim()) return {
    root: createBlankSvgRoot(),
    blank: true,
    warning: null
  };
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(source, "image/svg+xml");
  const parseError = xmlDoc.querySelector("parsererror");
  let loaded = !parseError && xmlDoc.documentElement?.localName?.toLowerCase() === "svg" ? xmlDoc.documentElement : null;
  if (!loaded && !parseError) loaded = xmlDoc.querySelector("svg");
  if (!loaded) {
    const htmlDoc = parser.parseFromString(source, "text/html");
    loaded = htmlDoc.querySelector("svg");
  }
  if (!loaded || loaded.localName?.toLowerCase() !== "svg") {
    return {
      root: createBlankSvgRoot(),
      blank: true,
      warning: "SVG content was empty or not parseable; opened a blank canvas."
    };
  }
  const root = loaded.ownerDocument === document ? loaded : document.importNode(loaded, true);
  return {
    root: applyEditableSvgRootDefaults(root),
    blank: false,
    warning: null
  };
}

export function normalizeEditorSavePath(pathValue) {
  return String(pathValue || "").trim().replace(/\\/g, "/").split(/[?#]/)[0].replace(/^\/+/, "").replace(/^Notebook\//i, "");
}

export function sameEditorSavePath(a, b) {
  return normalizeEditorSavePath(a) === normalizeEditorSavePath(b);
}

export function resolveEditorHookSavePath(editorLabel, editorPath, requestedPath) {
  const targetPath = requestedPath || editorPath;
  if (targetPath && editorPath && !sameEditorSavePath(targetPath, editorPath)) {
    console.error(editorLabel + ": refusing to save editor content into a different path.", {
      editorPath,
      savePath: targetPath
    });
    throw new Error(editorLabel + " save path mismatch");
  }
  return targetPath;
}

export async function renderEditor(filePath, container) {
  const svgSession = {};
  initializeSvgEditingFeatures({
    get svgSession() {
      return svgSession;
    },
    get filePath() {
      return filePath;
    }
  });
  initializeSvgDocumentFeatures({
    get svgSession() {
      return svgSession;
    },
    get container() {
      return container;
    },
    get filePath() {
      return filePath;
    }
  });
  const stageResult107 = await loadSvgEditorDocument({
    get svgSession() {
      return svgSession;
    },
    get filePath() {
      return filePath;
    }
  });
  const stageResult122 = initializeSvgChromeFeatures({
    get stageResult107() {
      return stageResult107;
    },
    get svgSession() {
      return svgSession;
    }
  });
  if (stageResult122) return stageResult122.value;
  const stageResult111 = connectSvgPointerEvents({
    get svgSession() {
      return svgSession;
    },
    get filePath() {
      return filePath;
    }
  });
  if (stageResult111) return stageResult111.value;
  const stageResult112 = publishSvgEditorContext({
    get filePath() {
      return filePath;
    },
    get svgSession() {
      return svgSession;
    },
    get container() {
      return container;
    }
  });
  if (stageResult112) return stageResult112.value;
}

export function reportSvgAttentionSelection(element) {
  if (!element) {
    setSelectionContext({
      selectedObjectType: null,
      selectedObjectId: null,
      hasEditableSelection: false
    });
    return;
  }
  const type = element.tagName?.toLowerCase?.() || "svg-element";
  setSelectionContext({
    selectedObjectType: type,
    selectedObjectId: element.id || null,
    selectedObjectLabel: type === "g" ? "Group" : type,
    hasEditableSelection: true
  });
}
