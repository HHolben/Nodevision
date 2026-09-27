// Nodevision/ApplicationSystem/public/EditorSwitchPrompt.mjs
// This module creates the shared modal that asks users to save, cancel, or discard changes before switching files. It manages focus, pending actions, and inline failure messages.

import { applyOverlayAppearance, applyOverlayButtonAppearance } from "./OverlayAppearance.mjs";

// Native modal behavior keeps focus and keyboard commands inside the decision panel.
export function createEditorSwitchPrompt() {
  const panel = document.createElement("dialog");
  panel.className = "panel overlay";
  panel.dataset.instanceName = "UnsavedPrompt";
  panel.setAttribute("aria-labelledby", "nv-switch-title");
  panel.setAttribute("aria-describedby", "nv-switch-description");
  Object.assign(panel.style, {
    display: "none", position: "fixed", inset: "0", transform: "none", margin: "auto",
    width: "var(--nv-file-switch-width, min(400px, calc(100vw - 48px)))",
    height: "fit-content", maxHeight: "var(--nv-file-switch-max-height, calc(100vh - 48px))",
    overflow: "auto", boxSizing: "border-box",
  });
  applyOverlayAppearance(panel);
  const title = document.createElement("h3");
  title.id = "nv-switch-title";
  title.style.margin = "var(--nv-overlay-heading-margin, 0 0 10px)";
  title.textContent = "Switch files?";
  const description = document.createElement("p");
  description.id = "nv-switch-description";
  description.style.overflowWrap = "anywhere";
  const status = document.createElement("p");
  status.setAttribute("role", "alert");
  status.style.color = "var(--nv-overlay-error-color, #a51d20)";
  const buttons = document.createElement("div");
  buttons.style.cssText = "display:flex;justify-content:flex-end;gap:var(--nv-overlay-button-gap,8px);flex-wrap:wrap";
  const makeButton = (label) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    applyOverlayButtonAppearance(button);
    buttons.append(button);
    return button;
  };
  const cancelBtn = makeButton("Cancel");
  const discardBtn = makeButton("Switch Without Saving");
  const saveBtn = makeButton("Save");
  panel.append(title, description, status, buttons);
  document.body.append(panel);
  let busy = false;
  let cancel = null;
  // Pending actions cannot be canceled or redirected midway through a save.
  panel.addEventListener("keydown", event => event.stopPropagation());
  panel.addEventListener("cancel", event => {
    event.preventDefault();
    if (!busy) cancel?.();
  });
  return {
    show(handlers) {
      cancel = handlers.onCancel;
      cancelBtn.onclick = () => { if (!busy) cancel(); };
      discardBtn.onclick = () => { if (!busy) handlers.onDiscard(); };
      saveBtn.onclick = () => { if (!busy) handlers.onSave(); };
      status.textContent = "";
      panel.style.display = "block";
      panel.showModal();
      cancelBtn.focus();
    },
    describe(currentPath, nextPath) {
      description.textContent = `Save “${currentPath}” before switching to “${nextPath}”?`;
    },
    setBusy(value) {
      busy = value;
      [cancelBtn, discardBtn, saveBtn].forEach(button => { button.disabled = value; });
      panel.setAttribute("aria-busy", String(value));
    },
    showError(error) { status.textContent = error?.message || String(error); },
    hide() { panel.close(); panel.style.display = "none"; },
  };
}
