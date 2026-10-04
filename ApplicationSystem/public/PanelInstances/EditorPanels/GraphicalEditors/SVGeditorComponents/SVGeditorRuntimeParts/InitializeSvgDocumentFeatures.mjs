// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/InitializeSvgDocumentFeatures.mjs
// This module implements initialize Svg Document Features behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { installSvgPointerGeometry } from "./InstallSvgPointerGeometry.mjs";
import { installSvgHistoryAndLifecycle } from "./InstallSvgHistoryAndLifecycle.mjs";
import { mountSvgEditorShell } from "./MountSvgEditorShell.mjs";
import { mountSvgSelectionChrome } from "./MountSvgSelectionChrome.mjs";
import { mountSvgDrawingChrome } from "./MountSvgDrawingChrome.mjs";
import { createSvgToolControllers } from "./CreateSvgToolControllers.mjs";

// Initialize Svg Document Features operations.
export function initializeSvgDocumentFeatures(scope) {
  installSvgPointerGeometry({
    get svgSession() {
      return scope.svgSession;
    }
  });
  installSvgHistoryAndLifecycle({
    get svgSession() {
      return scope.svgSession;
    },
    get container() {
      return scope.container;
    }
  });
  mountSvgEditorShell({
    get filePath() {
      return scope.filePath;
    },
    get container() {
      return scope.container;
    },
    get svgSession() {
      return scope.svgSession;
    }
  });
}

export function initializeSvgChromeFeatures(scope) {
  if (scope.stageResult107) return {
    value: scope.stageResult107.value
  };
  mountSvgSelectionChrome({
    get svgSession() {
      return scope.svgSession;
    }
  });
  mountSvgDrawingChrome({
    get svgSession() {
      return scope.svgSession;
    }
  });
  createSvgToolControllers({
    get svgSession() {
      return scope.svgSession;
    }
  });
}
