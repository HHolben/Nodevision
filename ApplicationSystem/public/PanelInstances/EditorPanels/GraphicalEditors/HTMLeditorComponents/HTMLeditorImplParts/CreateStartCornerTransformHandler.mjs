// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/CreateStartCornerTransformHandler.mjs
// This module implements create Start Corner Transform Handler behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { createImageCornerMoveHandler } from "./CreateSyncImageHandlesNowHandler.mjs";
import { findCircuitReferenceElement, readCircuitReferenceFromElement } from "../../CircuitEditorComponents/CircuitReferenceElement.mjs";
import { markSelectedCircuit, updateSelectedCircuitState, updateSelectedAudioState } from "./UpdateImageTextStateFromSelection.mjs";
import { markSelectedImage, markSelectedAudio } from "./GetImageEditorDescriptor.mjs";
import { updateSelectedImageState } from "./UpdateSelectedImageState.mjs";
import { findClickedImage } from "./FindClickedImage.mjs";
import { buildImageContextFromElement, findClickedAudio, buildAudioContextFromElement } from "./BuildImageContextFromElement.mjs";

// Create Start Corner Transform Handler operations.
export function createStartCornerTransformHandler(owner) {
  return startEvt => {
    const imageEl = owner.imageToolsState.selectedImageForHandles;
    if (!(imageEl instanceof HTMLImageElement) || !imageEl.isConnected) return;
    if (imageEl.closest(".nv-canvas-item")) return;
    startEvt.preventDefault();
    startEvt.stopPropagation();
    const rect = imageEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const startWidth = Math.max(1, imageEl.offsetWidth || rect.width || imageEl.naturalWidth || 1);
    const startHeight = Math.max(1, imageEl.offsetHeight || rect.height || imageEl.naturalHeight || 1);
    const aspect = startWidth / Math.max(1, startHeight);
    const startDistance = Math.max(8, Math.hypot(startEvt.clientX - centerX, startEvt.clientY - centerY));
    const startAngle = Math.atan2(startEvt.clientY - centerY, startEvt.clientX - centerX);
    const startRotation = owner.imageToolsState.readImageRotation(imageEl);
    const rotateMode = Boolean(startEvt.shiftKey);
    const onMove = createImageCornerMoveHandler({
      get rotateMode() {
        return rotateMode;
      },
      get centerY() {
        return centerY;
      },
      get centerX() {
        return centerX;
      },
      get startRotation() {
        return startRotation;
      },
      get startAngle() {
        return startAngle;
      },
      get imageToolsState() {
        return owner.imageToolsState;
      },
      get imageEl() {
        return imageEl;
      },
      get startDistance() {
        return startDistance;
      },
      get startWidth() {
        return startWidth;
      },
      get aspect() {
        return aspect;
      }
    });
    const onUp = () => {
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
      owner.imageToolsState.scheduleImageHandleSync();
    };
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);
  };
}

export function createOnClickHandler(owner) {
  return evt => {
    if (owner.imageToolsState.inlineEditorSession?.frame && owner.imageToolsState.inlineEditorSession.frame.contains(evt.target)) {
      return;
    }
    const circuitEl = findCircuitReferenceElement(evt.target);
    if (circuitEl && owner.wysiwyg.contains(circuitEl)) {
      const context = readCircuitReferenceFromElement(circuitEl, {
        sourcePath: owner.editorFilePath
      });
      markSelectedCircuit(owner.wysiwyg, circuitEl);
      updateSelectedCircuitState(context);
      markSelectedImage(owner.wysiwyg, null);
      updateSelectedImageState(null);
      markSelectedAudio(owner.wysiwyg, null);
      updateSelectedAudioState(null);
      owner.imageToolsState.setSelectedImageForHandles(null);
      return;
    }
    const imageEl = findClickedImage(evt.target);
    if (imageEl && owner.wysiwyg.contains(imageEl)) {
      const context = buildImageContextFromElement(imageEl, owner.editorFilePath);
      markSelectedImage(owner.wysiwyg, imageEl);
      updateSelectedImageState(context);
      owner.imageToolsState.setSelectedImageForHandles(imageEl);
      markSelectedAudio(owner.wysiwyg, null);
      updateSelectedAudioState(null);
      markSelectedCircuit(owner.wysiwyg, null);
      updateSelectedCircuitState(null);
      return;
    }
    const audioEl = findClickedAudio(evt.target);
    if (audioEl && owner.wysiwyg.contains(audioEl)) {
      const context = buildAudioContextFromElement(audioEl, owner.editorFilePath);
      markSelectedAudio(owner.wysiwyg, audioEl);
      updateSelectedAudioState(context);
      markSelectedImage(owner.wysiwyg, null);
      updateSelectedImageState(null);
      markSelectedCircuit(owner.wysiwyg, null);
      updateSelectedCircuitState(null);
      owner.imageToolsState.setSelectedImageForHandles(null);
      return;
    }
    markSelectedImage(owner.wysiwyg, null);
    updateSelectedImageState(null);
    markSelectedAudio(owner.wysiwyg, null);
    updateSelectedAudioState(null);
    markSelectedCircuit(owner.wysiwyg, null);
    updateSelectedCircuitState(null);
    owner.imageToolsState.setSelectedImageForHandles(null);
  };
}
