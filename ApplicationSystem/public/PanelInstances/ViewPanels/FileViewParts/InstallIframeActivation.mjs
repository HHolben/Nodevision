// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewParts/InstallIframeActivation.mjs
// This module implements install Iframe Activation behavior for the FileView feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { fileViewRootFromTarget, describeFileViewElement } from "./ActivateFileViewPanel.mjs";
import { createActivateOwnerHandler, createTryAttachDocumentHandler } from "./CreateActivateOwnerHandler.mjs";
import { debugFileViewIframe, describeFileViewOwner, describeIframeEvent } from "./DescribeFileViewOwner.mjs";
import { tryScrollToPendingFileViewAnchor } from "./RevealLinkedPathInOriginNavigator.mjs";
import { getActiveFilePath } from "./ShowGraphLinkInFileView.mjs";

// Install Iframe Activation operations.
export function installIframeActivation(iframe, ownerRoot = null) {
  const _editorState = {};
  if (!iframe) return;
  _editorState.root = ownerRoot || fileViewRootFromTarget(iframe);
  if (!_editorState.root) {
    console.warn?.("[FileView] iframe activation skipped: owning File Viewer root unavailable.");
    return;
  }
  if (iframe.__nvFileViewActivationBridge) {
    iframe.__nvFileViewActivationBridge.updateOwner(_editorState.root);
    return;
  }
  _editorState.attachedDoc = null;
  _editorState.documentCleanup = null;
  _editorState.attachedFrameWindow = null;
  _editorState.frameWindowCleanup = null;
  _editorState.pendingFocusedFrameCheck = 0;
  _editorState.iframeActivationOptions = {
    capture: true
  };
  _editorState.docActivationOptions = {
    capture: true
  };
  _editorState.activateOwner = createActivateOwnerHandler({
    get _editorState() {
      return _editorState;
    },
    get iframe() {
      return iframe;
    }
  });
  _editorState.onIframeShellInteraction = event => _editorState.activateOwner("iframe-shell-" + (event?.type || "event"), event);
  _editorState.onIframeDocumentInteraction = event => _editorState.activateOwner("iframe-document-" + (event?.type || "event"), event);
  _editorState.onFrameWindowFocus = event => _editorState.activateOwner("iframe-window-focus", event);
  _editorState.scheduleFocusedFrameActivation = reason => {
    if (_editorState.pendingFocusedFrameCheck) return;
    const run = () => {
      _editorState.pendingFocusedFrameCheck = 0;
      const iframeHasFocus = document.activeElement === iframe;
      debugFileViewIframe("focused-frame-check:" + reason, () => ({
        owner: describeFileViewOwner(_editorState.root, iframe),
        iframeHasFocus,
        activeElement: describeFileViewElement(document.activeElement)
      }));
      if (iframeHasFocus) _editorState.activateOwner(reason);
    };
    _editorState.pendingFocusedFrameCheck = window.setTimeout(run, 0);
  };
  _editorState.removeDocumentListeners = () => {
    if (typeof _editorState.documentCleanup === "function") {
      _editorState.documentCleanup();
      _editorState.documentCleanup = null;
    }
    _editorState.attachedDoc = null;
  };
  _editorState.removeFrameWindowListeners = () => {
    if (typeof _editorState.frameWindowCleanup === "function") {
      _editorState.frameWindowCleanup();
      _editorState.frameWindowCleanup = null;
    }
    _editorState.attachedFrameWindow = null;
  };
  _editorState.tryAttachFrameWindow = () => {
    try {
      const frameWindow = iframe.contentWindow;
      if (!frameWindow || frameWindow === _editorState.attachedFrameWindow) return;
      _editorState.removeFrameWindowListeners();
      frameWindow.addEventListener("focus", _editorState.onFrameWindowFocus, true);
      _editorState.attachedFrameWindow = frameWindow;
      _editorState.frameWindowCleanup = () => {
        frameWindow.removeEventListener("focus", _editorState.onFrameWindowFocus, true);
      };
      debugFileViewIframe("frame-window-listeners-installed", () => describeFileViewOwner(_editorState.root, iframe));
    } catch (err) {
      debugFileViewIframe("frame-window-inaccessible", () => ({
        message: err?.message || String(err),
        owner: describeFileViewOwner(_editorState.root, iframe)
      }));
    }
  };
  _editorState.tryAttachDocument = createTryAttachDocumentHandler({
    get iframe() {
      return iframe;
    },
    get _editorState() {
      return _editorState;
    }
  });
  _editorState.onLoad = event => {
    debugFileViewIframe("iframe-load", () => ({
      owner: describeFileViewOwner(_editorState.root, iframe),
      event: describeIframeEvent(event)
    }));
    _editorState.tryAttachFrameWindow();
    _editorState.tryAttachDocument("load");
    _editorState.scheduleFocusedFrameActivation("iframe-load-active-element");
    tryScrollToPendingFileViewAnchor(getActiveFilePath());
  };
  _editorState.onParentWindowBlur = () => _editorState.scheduleFocusedFrameActivation("parent-window-blur-active-element");
  iframe.addEventListener("pointerdown", _editorState.onIframeShellInteraction, _editorState.iframeActivationOptions);
  iframe.addEventListener("mousedown", _editorState.onIframeShellInteraction, _editorState.iframeActivationOptions);
  iframe.addEventListener("contextmenu", _editorState.onIframeShellInteraction, _editorState.iframeActivationOptions);
  iframe.addEventListener("focus", _editorState.onIframeShellInteraction, true);
  iframe.addEventListener("load", _editorState.onLoad);
  window.addEventListener("blur", _editorState.onParentWindowBlur, true);
  iframe.__nvFileViewActivationBridge = {
    updateOwner(nextRoot) {
      if (!nextRoot || nextRoot === _editorState.root) return;
      this.cleanup();
      installIframeActivation(iframe, nextRoot);
    },
    cleanup() {
      if (_editorState.pendingFocusedFrameCheck) {
        window.clearTimeout(_editorState.pendingFocusedFrameCheck);
        _editorState.pendingFocusedFrameCheck = 0;
      }
      _editorState.removeDocumentListeners();
      _editorState.removeFrameWindowListeners();
      iframe.removeEventListener("pointerdown", _editorState.onIframeShellInteraction, _editorState.iframeActivationOptions);
      iframe.removeEventListener("mousedown", _editorState.onIframeShellInteraction, _editorState.iframeActivationOptions);
      iframe.removeEventListener("contextmenu", _editorState.onIframeShellInteraction, _editorState.iframeActivationOptions);
      iframe.removeEventListener("focus", _editorState.onIframeShellInteraction, true);
      iframe.removeEventListener("load", _editorState.onLoad);
      window.removeEventListener("blur", _editorState.onParentWindowBlur, true);
      iframe.__nvFileViewActivationBridge = null;
      debugFileViewIframe("bridge-cleaned", () => describeFileViewOwner(_editorState.root, iframe));
    }
  };
  debugFileViewIframe("bridge-installed", () => describeFileViewOwner(_editorState.root, iframe));
  _editorState.tryAttachFrameWindow();
  _editorState.tryAttachDocument("initial");
  if (document.activeElement === iframe) _editorState.scheduleFocusedFrameActivation("already-focused-active-element");
}
