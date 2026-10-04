// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/CreateAddEventListenerKeydownHandler.mjs
// This module implements create Add Event Listener Keydown Handler behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { handleSvgKeyCommands } from "./HandleSvgKeyCommands.mjs";
import { handleSvgArrowCommands } from "./HandleSvgArrowCommands.mjs";
import { handleSvgPointerToolStart } from "./HandleSvgPointerToolStart.mjs";
import { handleSvgPointerSelectionStart } from "./HandleSvgPointerSelectionStart.mjs";
import { handleSvgPointerDrawingStart } from "./HandleSvgPointerDrawingStart.mjs";
import { handleSvgPointerTransformMove } from "./HandleSvgPointerTransformMove.mjs";
import { handleSvgPointerDrawingMove } from "./HandleSvgPointerDrawingMove.mjs";

// Create Add Event Listener Keydown Handler operations.
export function createAddEventListenerKeydownHandler(owner) {
  return e => {
    const keyCommandState = {};
    const stageResult113 = handleSvgKeyCommands({
      get keyCommandState() {
        return keyCommandState;
      },
      get e() {
        return e;
      },
      get owner() {
        return owner;
      }
    });
    if (stageResult113) return stageResult113.value;
    const stageResult114 = handleSvgArrowCommands({
      get owner() {
        return owner;
      },
      get keyCommandState() {
        return keyCommandState;
      },
      get e() {
        return e;
      }
    });
    if (stageResult114) return stageResult114.value;
  };
}

export function createAddEventListenerPointerdownHandler(owner) {
  return e => {
    const pointerStartState = {};
    const stageResult115 = handleSvgPointerToolStart({
      get owner() {
        return owner;
      },
      get e() {
        return e;
      },
      get pointerStartState() {
        return pointerStartState;
      }
    });
    if (stageResult115) return stageResult115.value;
    const stageResult116 = handleSvgPointerSelectionStart({
      get owner() {
        return owner;
      },
      get pointerStartState() {
        return pointerStartState;
      },
      get e() {
        return e;
      }
    });
    if (stageResult116) return stageResult116.value;
    const stageResult117 = handleSvgPointerDrawingStart({
      get owner() {
        return owner;
      },
      get e() {
        return e;
      },
      get pointerStartState() {
        return pointerStartState;
      }
    });
    if (stageResult117) return stageResult117.value;
  };
}

export function createAddEventListenerPointermoveHandler(owner) {
  return e => {
    const pointerMoveState = {};
    const stageResult118 = handleSvgPointerTransformMove({
      get pointerMoveState() {
        return pointerMoveState;
      },
      get owner() {
        return owner;
      },
      get e() {
        return e;
      }
    });
    if (stageResult118) return stageResult118.value;
    const stageResult119 = handleSvgPointerDrawingMove({
      get owner() {
        return owner;
      },
      get e() {
        return e;
      },
      get pointerMoveState() {
        return pointerMoveState;
      }
    });
    if (stageResult119) return stageResult119.value;
  };
}
