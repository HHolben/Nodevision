// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/SessionOverlayPanel.mjs
// This file renders reusable Nodevision Session overlay prompts for messages, errors, and pause choices through the existing panel system.

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
.nv-session-overlay h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}
.nv-session-overlay p {
  margin: 0;
  line-height: 1.45;
  white-space: pre-wrap;
}
.nv-session-overlay-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}
.nv-session-overlay-actions button {
  border: 1px solid #64748b;
  border-radius: 6px;
  padding: 8px 12px;
  background: #fff;
  color: #111827;
  cursor: pointer;
  font: inherit;
}
.nv-session-overlay-actions button.primary {
  border-color: #006fbe;
  background: #0078d7;
  color: #fff;
}
html[data-nv-theme="dark"] .nv-session-overlay {
  color: #e5e7eb;
  background: #111827;
}
html[data-nv-theme="dark"] .nv-session-overlay-actions button {
  color: #e5e7eb;
  background: #0f172a;
  border-color: #475569;
}
`;
  document.head.appendChild(style);
}

function button(label, value, primary, panelVars) {
  const el = document.createElement("button");
  el.type = "button";
  el.textContent = label;
  if (primary) el.className = "primary";
  el.addEventListener("click", () => {
    if (value === "continue") {
      window.dispatchEvent(new CustomEvent("session.continue", { detail: { source: "overlay" } }));
    }
    panelVars.onDone?.(value);
  });
  return el;
}

export function createPanel(contentElem, panelVars = {}, panelRoot = null) {
  ensureStyles();
  const titleEl = panelRoot?.querySelector(".panel-title");
  if (titleEl) titleEl.textContent = panelVars.title || "Session";
  contentElem.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.className = "nv-session-overlay";

  const heading = document.createElement("h2");
  heading.textContent = panelVars.heading || panelVars.title || "Session";

  const message = document.createElement("p");
  message.textContent = panelVars.message || "";

  const actions = document.createElement("div");
  actions.className = "nv-session-overlay-actions";
  const choices = Array.isArray(panelVars.choices) && panelVars.choices.length
    ? panelVars.choices
    : [{ label: "Continue", value: "continue", primary: true }];
  for (const choice of choices) {
    actions.appendChild(button(choice.label, choice.value, Boolean(choice.primary), panelVars));
  }

  wrapper.append(heading, message, actions);
  contentElem.appendChild(wrapper);
  requestAnimationFrame(() => actions.querySelector("button")?.focus());
}

