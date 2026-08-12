// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/SessionOverlayPanel.mjs
// This file renders Nodevision overlay prompts through the existing panel system for Sessions and shared overlay commands.

import { emitNodevisionEvent } from "../../Commands/NodevisionEventRegistry.mjs";

const STYLE_ID = "nv-session-overlay-panel-styles";

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
.nv-session-overlay {
  display: grid;
  gap: 14px;
  padding: 20px;
  color: #111827;
  background: #f8fafc;
  font: 14px system-ui, sans-serif;
}
.nv-session-overlay h2 { margin: 0; font-size: 18px; font-weight: 700; }
.nv-session-overlay p { margin: 0; line-height: 1.45; white-space: pre-wrap; }
.nv-session-overlay input {
  box-sizing: border-box;
  width: 100%;
  min-height: 34px;
  border: 1px solid #94a3b8;
  border-radius: 5px;
  padding: 7px 9px;
  font: inherit;
}
.nv-session-overlay-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.nv-session-overlay-actions button {
  border: 1px solid #64748b;
  border-radius: 6px;
  padding: 8px 12px;
  background: #fff;
  color: #111827;
  cursor: pointer;
  font: inherit;
}
.nv-session-overlay-actions button.primary { border-color: #006fbe; background: #0078d7; color: #fff; }
html[data-nv-theme="dark"] .nv-session-overlay { color: #e5e7eb; background: #111827; }
html[data-nv-theme="dark"] .nv-session-overlay-actions button,
html[data-nv-theme="dark"] .nv-session-overlay input { color: #e5e7eb; background: #0f172a; border-color: #475569; }
`;
  document.head.appendChild(style);
}

function submit(choice, panelVars, input) {
  const payload = {
    value: choice.value,
    choice: choice.value,
    label: choice.label,
    input: input?.value || "",
    source: "overlay",
    overlayId: panelVars.overlayId || "",
  };
  if (choice.value === "continue") emitNodevisionEvent("session.continue", payload);
  if (panelVars.emitOverlayEvents === true) emitNodevisionEvent("overlay.submitted", payload);
  panelVars.onDone?.(panelVars.returnPayload ? payload : choice.value);
}

function button(choice, panelVars, input) {
  const el = document.createElement("button");
  el.type = "button";
  el.textContent = choice.label;
  if (choice.primary) el.className = "primary";
  el.addEventListener("click", () => submit(choice, panelVars, input));
  return el;
}

export function createPanel(contentElem, panelVars = {}, panelRoot = null) {
  ensureStyles();
  const titleEl = panelRoot?.querySelector(".panel-title");
  if (titleEl) titleEl.textContent = panelVars.title || "Session";
  contentElem.replaceChildren();

  const wrapper = document.createElement("div");
  wrapper.className = "nv-session-overlay";
  const heading = document.createElement("h2");
  heading.textContent = panelVars.heading || panelVars.title || "Session";
  const message = document.createElement("p");
  message.textContent = panelVars.message || "";
  const input = panelVars.input ? document.createElement("input") : null;
  if (input) {
    input.type = "text";
    input.placeholder = panelVars.placeholder || "";
    input.setAttribute("aria-label", panelVars.inputLabel || "Overlay input");
  }
  const actions = document.createElement("div");
  actions.className = "nv-session-overlay-actions";
  const choices = Array.isArray(panelVars.choices) && panelVars.choices.length
    ? panelVars.choices
    : [{ label: "Continue", value: "continue", primary: true }];
  for (const choice of choices) actions.appendChild(button(choice, panelVars, input));
  wrapper.append(heading, message);
  if (input) wrapper.appendChild(input);
  wrapper.appendChild(actions);
  contentElem.appendChild(wrapper);
  if (panelRoot) panelRoot.__nvSessionOverlaySetContent = (text) => { message.textContent = String(text || ""); };
  requestAnimationFrame(() => (input || actions.querySelector("button"))?.focus());
}
