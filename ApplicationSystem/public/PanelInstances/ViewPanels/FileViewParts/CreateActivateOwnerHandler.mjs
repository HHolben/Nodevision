// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewParts/CreateActivateOwnerHandler.mjs
// This module implements create Activate Owner Handler behavior for the FileView feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { debugFileViewIframe, describeFileViewOwner, describeIframeEvent, installIframeDebugEventDiagnostics, describeSvgDocumentHitTest } from "./DescribeFileViewOwner.mjs";
import { describeFileViewElement, activateFileViewHost } from "./ActivateFileViewPanel.mjs";
import { handleFileViewLinkClick } from "./SelectLinkedPathInFileView.mjs";

// Create Activate Owner Handler operations.
export function createActivateOwnerHandler(owner) {
  return (reason = "iframe-interaction", event = null) => {
    debugFileViewIframe("activate:" + reason, () => ({
      owner: describeFileViewOwner(owner._editorState.root, owner.iframe),
      event: describeIframeEvent(event),
      before: {
        activeCell: describeFileViewElement(window.activeCell),
        activePanel: window.activePanel || "",
        activePanelClass: window.activePanelClass || "",
        activePanelElement: describeFileViewElement(window.__nvActivePanelElement),
        activePanelType: window.NodevisionState?.activePanelType || "",
        documentActiveElement: describeFileViewElement(document.activeElement)
      }
    }));
    const activated = activateFileViewHost(owner._editorState.root);
    debugFileViewIframe("activated:" + reason, () => ({
      activated,
      after: {
        activeCell: describeFileViewElement(window.activeCell),
        activePanel: window.activePanel || "",
        activePanelClass: window.activePanelClass || "",
        activePanelElement: describeFileViewElement(window.__nvActivePanelElement),
        activePanelType: window.NodevisionState?.activePanelType || "",
        documentActiveElement: describeFileViewElement(document.activeElement)
      }
    }));
    return activated;
  };
}

export function createTryAttachDocumentHandler(owner) {
  return (reason = "document-attach") => {
    try {
      const doc = owner.iframe.contentDocument;
      if (!doc) {
        debugFileViewIframe("document-unavailable:" + reason, () => describeFileViewOwner(owner._editorState.root, owner.iframe));
        return;
      }
      if (doc === owner._editorState.attachedDoc) return;
      owner._editorState.removeDocumentListeners();
      doc.addEventListener("click", handleFileViewLinkClick, {
        capture: true
      });
      doc.addEventListener("pointerdown", owner._editorState.onIframeDocumentInteraction, owner._editorState.docActivationOptions);
      doc.addEventListener("mousedown", owner._editorState.onIframeDocumentInteraction, owner._editorState.docActivationOptions);
      doc.addEventListener("focusin", owner._editorState.onIframeDocumentInteraction, owner._editorState.docActivationOptions);
      doc.addEventListener("contextmenu", owner._editorState.onIframeDocumentInteraction, owner._editorState.docActivationOptions);
      const debugCleanup = installIframeDebugEventDiagnostics(owner.iframe, doc, owner._editorState.root);
      owner._editorState.attachedDoc = doc;
      owner._editorState.documentCleanup = () => {
        doc.removeEventListener("click", handleFileViewLinkClick, {
          capture: true
        });
        doc.removeEventListener("pointerdown", owner._editorState.onIframeDocumentInteraction, owner._editorState.docActivationOptions);
        doc.removeEventListener("mousedown", owner._editorState.onIframeDocumentInteraction, owner._editorState.docActivationOptions);
        doc.removeEventListener("focusin", owner._editorState.onIframeDocumentInteraction, owner._editorState.docActivationOptions);
        doc.removeEventListener("contextmenu", owner._editorState.onIframeDocumentInteraction, owner._editorState.docActivationOptions);
        debugCleanup?.();
      };
      debugFileViewIframe("document-listeners-installed:" + reason, () => ({
        owner: describeFileViewOwner(owner._editorState.root, owner.iframe),
        svgHitTest: describeSvgDocumentHitTest(owner.iframe, doc)
      }));
    } catch (err) {
      debugFileViewIframe("document-inaccessible:" + reason, () => ({
        message: err?.message || String(err),
        owner: describeFileViewOwner(owner._editorState.root, owner.iframe)
      }));
    }
  };
}
