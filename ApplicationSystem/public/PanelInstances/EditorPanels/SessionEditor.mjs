// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/SessionEditor.mjs
// This file implements the first Nodevision Session editor with a procedural flow preview, source editing, and command metadata discovered from the shared command registry.

import { getNodevisionCommandDefinitions } from "../../Sessions/SessionCommandAdapter.mjs";
import { summarizeSessionFlow } from "../../Sessions/SessionFlowModel.mjs";
import { duplicateBuiltInSession, saveUserSession } from "../../Sessions/SessionApi.mjs";
import { openSessionEditor, startSession } from "../../Sessions/SessionController.mjs";

const STYLE_ID = "nv-session-editor-styles";

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
.nv-session-editor {
  box-sizing: border-box;
  display: grid;
  grid-template-columns: minmax(230px, 0.85fr) minmax(320px, 1.4fr) minmax(220px, 0.7fr);
  gap: 12px;
  height: 100%;
  padding: 12px;
  color: #111827;
  background: #f8fafc;
  font: 13px system-ui, sans-serif;
}
.nv-session-editor h3 {
  margin: 0 0 8px;
  font-size: 14px;
}
.nv-session-editor-panel {
  min-width: 0;
  overflow: auto;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  background: #fff;
  padding: 10px;
}
.nv-session-flow-step {
  display: grid;
  gap: 2px;
  margin: 0 0 8px;
  padding: 7px;
  border-left: 3px solid #0078d7;
  background: #eff6ff;
}
.nv-session-flow-line {
  color: #64748b;
  font-size: 11px;
}
.nv-session-source {
  box-sizing: border-box;
  width: 100%;
  height: calc(100% - 42px);
  min-height: 320px;
  resize: none;
  border: 1px solid #94a3b8;
  border-radius: 6px;
  padding: 10px;
  font: 13px ui-monospace, SFMono-Regular, Menlo, monospace;
}
.nv-session-toolbar,
.nv-session-command-row {
  display: flex;
  gap: 7px;
  align-items: center;
}
.nv-session-toolbar {
  margin-bottom: 8px;
}
.nv-session-toolbar button,
.nv-session-command-row button {
  border: 1px solid #64748b;
  border-radius: 6px;
  padding: 6px 9px;
  background: #fff;
  color: #111827;
  cursor: pointer;
  font: inherit;
}
.nv-session-command-row {
  justify-content: space-between;
  border-bottom: 1px solid #e2e8f0;
  padding: 7px 0;
}
.nv-session-command-row small {
  display: block;
  color: #64748b;
}
.nv-session-status {
  color: #475569;
  min-height: 18px;
}
`;
  document.head.appendChild(style);
}

function renderFlow(target, source) {
  target.replaceChildren();
  const heading = document.createElement("h3");
  heading.textContent = "Flow";
  target.appendChild(heading);
  try {
    for (const step of summarizeSessionFlow(source)) {
      const row = document.createElement("div");
      row.className = "nv-session-flow-step";
      row.style.marginLeft = `${step.depth * 14}px`;
      const label = document.createElement("strong");
      label.textContent = step.label;
      const line = document.createElement("span");
      line.className = "nv-session-flow-line";
      line.textContent = step.line ? "Line " + step.line : "";
      row.append(label, line);
      target.appendChild(row);
    }
  } catch (err) {
    const error = document.createElement("div");
    error.className = "nv-session-status";
    error.textContent = err.message;
    target.appendChild(error);
  }
}

function renderCommands(target, textarea) {
  target.replaceChildren();
  const heading = document.createElement("h3");
  heading.textContent = "Commands";
  target.appendChild(heading);
  for (const command of getNodevisionCommandDefinitions()) {
    const row = document.createElement("div");
    row.className = "nv-session-command-row";
    const info = document.createElement("div");
    const commandId = document.createElement("strong");
    commandId.textContent = command.id;
    const commandDescription = document.createElement("small");
    commandDescription.textContent = command.sessionSafe ? command.description : "Console-only command metadata.";
    info.append(commandId, commandDescription);
    const insert = document.createElement("button");
    insert.type = "button";
    insert.textContent = command.sessionSafe ? "Insert" : "Unavailable";
    insert.disabled = !command.sessionSafe;
    insert.addEventListener("click", () => {
      textarea.value += `\nrun("${command.id}");\n`;
      textarea.dispatchEvent(new Event("input"));
      textarea.focus();
    });
    row.append(info, insert);
    target.appendChild(row);
  }
}

export function createPanel(contentElem, panelVars = {}, panelRoot = null) {
  ensureStyles();
  const session = panelVars.session || {};
  const title = panelRoot?.querySelector(".panel-title");
  if (title) title.textContent = session.title || "Session Editor";
  contentElem.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.className = "nv-session-editor";
  const flowPanel = document.createElement("div");
  flowPanel.className = "nv-session-editor-panel";
  const sourcePanel = document.createElement("div");
  sourcePanel.className = "nv-session-editor-panel";
  const commandPanel = document.createElement("div");
  commandPanel.className = "nv-session-editor-panel";
  const toolbar = document.createElement("div");
  toolbar.className = "nv-session-toolbar";
  const status = document.createElement("span");
  status.className = "nv-session-status";
  const save = document.createElement("button");
  save.textContent = session.readOnly ? "Duplicate To Edit" : "Save";
  const run = document.createElement("button");
  run.textContent = "Run Saved";
  const textarea = document.createElement("textarea");
  textarea.className = "nv-session-source";
  textarea.value = session.source || "";
  textarea.readOnly = Boolean(session.readOnly);

  save.addEventListener("click", async () => {
    try {
      if (session.readOnly) {
        const copy = await duplicateBuiltInSession(session.id, session.title);
        await openSessionEditor("user", copy.id);
        status.textContent = "Duplicated " + copy.id;
        return;
      }
      const updated = await saveUserSession(session.id, textarea.value);
      status.textContent = "Saved " + updated.id;
    } catch (err) {
      status.textContent = err.message;
    }
  });
  run.addEventListener("click", () => startSession(session.scope, session.id));
  textarea.addEventListener("input", () => renderFlow(flowPanel, textarea.value));
  toolbar.append(save, run, status);
  sourcePanel.append(toolbar, textarea);
  renderFlow(flowPanel, textarea.value);
  renderCommands(commandPanel, textarea);
  wrapper.append(flowPanel, sourcePanel, commandPanel);
  contentElem.appendChild(wrapper);
}

