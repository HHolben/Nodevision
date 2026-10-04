// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/InitializeSvgEditingFeatures.mjs
// This module implements initialize Svg Editing Features behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { installSvgLineFeedback } from "./InstallSvgLineFeedback.mjs";
import { installSvgShapeGeometry } from "./InstallSvgShapeGeometry.mjs";
import { installSvgLineConstraints } from "./InstallSvgLineConstraints.mjs";
import { installSvgLinePlacement } from "./InstallSvgLinePlacement.mjs";
import { installSvgLineAngleInput } from "./InstallSvgLineAngleInput.mjs";
import { installSvgLineKeyboardInput } from "./InstallSvgLineKeyboardInput.mjs";
import { installSvgViewportControls } from "./InstallSvgViewportControls.mjs";
import { installSvgSelectionGeometry } from "./InstallSvgSelectionGeometry.mjs";
import { installSvgRotationOriginGeometry } from "./InstallSvgRotationOriginGeometry.mjs";
import { installSvgRotationOriginSelection } from "./InstallSvgRotationOriginSelection.mjs";
import { installSvgSelectionHandles } from "./InstallSvgSelectionHandles.mjs";
import { installSvgSelectionPublishing } from "./InstallSvgSelectionPublishing.mjs";
import { installSvgSelectionTranslation } from "./InstallSvgSelectionTranslation.mjs";
import { installSvgSelectionOrdering } from "./InstallSvgSelectionOrdering.mjs";
import { installSvgRotationCommands } from "./InstallSvgRotationCommands.mjs";
import { installSvgClipboardCommands } from "./InstallSvgClipboardCommands.mjs";
import { installSvgGroupingAndVisibility } from "./InstallSvgGroupingAndVisibility.mjs";
import { installSvgFreehandPreview } from "./InstallSvgFreehandPreview.mjs";
import { installSvgEyedropperAndMaskTools } from "./InstallSvgEyedropperAndMaskTools.mjs";
import { installSvgCanvasCommands } from "./InstallSvgCanvasCommands.mjs";
import { installSvgLayerCommands } from "./InstallSvgLayerCommands.mjs";

// Initialize Svg Editing Features operations.
export function initializeSvgEditingFeatures(scope) {
  installSvgLineFeedback({
    get svgSession() {
      return scope.svgSession;
    }
  });
  installSvgShapeGeometry({
    get svgSession() {
      return scope.svgSession;
    }
  });
  installSvgLineConstraints({
    get svgSession() {
      return scope.svgSession;
    }
  });
  installSvgLinePlacement({
    get svgSession() {
      return scope.svgSession;
    }
  });
  installSvgLineAngleInput({
    get svgSession() {
      return scope.svgSession;
    }
  });
  installSvgLineKeyboardInput({
    get svgSession() {
      return scope.svgSession;
    }
  });
  installSvgViewportControls({
    get svgSession() {
      return scope.svgSession;
    },
    get filePath() {
      return scope.filePath;
    }
  });
  installSvgSelectionGeometry({
    get svgSession() {
      return scope.svgSession;
    }
  });
  installSvgRotationOriginGeometry({
    get svgSession() {
      return scope.svgSession;
    }
  });
  installSvgRotationOriginSelection({
    get svgSession() {
      return scope.svgSession;
    }
  });
  installSvgSelectionHandles({
    get svgSession() {
      return scope.svgSession;
    }
  });
  installSvgSelectionPublishing({
    get svgSession() {
      return scope.svgSession;
    },
    get filePath() {
      return scope.filePath;
    }
  });
  installSvgSelectionTranslation({
    get svgSession() {
      return scope.svgSession;
    }
  });
  installSvgSelectionOrdering({
    get svgSession() {
      return scope.svgSession;
    }
  });
  installSvgRotationCommands({
    get svgSession() {
      return scope.svgSession;
    }
  });
  installSvgClipboardCommands({
    get svgSession() {
      return scope.svgSession;
    }
  });
  installSvgGroupingAndVisibility({
    get svgSession() {
      return scope.svgSession;
    }
  });
  installSvgFreehandPreview({
    get svgSession() {
      return scope.svgSession;
    }
  });
  installSvgEyedropperAndMaskTools({
    get svgSession() {
      return scope.svgSession;
    }
  });
  installSvgCanvasCommands({
    get svgSession() {
      return scope.svgSession;
    }
  });
  installSvgLayerCommands({
    get svgSession() {
      return scope.svgSession;
    }
  });
}
