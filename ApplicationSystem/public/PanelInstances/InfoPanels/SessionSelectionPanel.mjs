// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/SessionSelectionPanel.mjs
// This file renders the Run > Session selector for built-in and user-owned Nodevision Sessions.

import { createUserSession, duplicateBuiltInSession, listSessions } from "../../Sessions/SessionApi.mjs";

const STYLE_ID = "nv-session-selection-styles";

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
.nv-session-selection {
  display: grid;
  gap: 14px;
  padding: 18px;
  color: #111827;
  background: #f8fafc;
  font: 13px system-ui, sans-serif;
}
.nv-session-selection h3 {
  margin: 0;
  font-size: 15px;
}
.nv-session-list {
  display: grid;
  gap: 8px;
}
.nv-session-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  padding: 10px;
  background: #fff;
}
.nv-session-title {
  font-weight: 700;
}
.nv-session-desc {
  color: #475569;
  margin-top: 3px;
}
.nv-session-actions {
  display: flex;
  gap: 6px;
}
.nv-session-actions button,
.nv-session-create {
  border: 1px solid #64748b;
  border-radius: 6px;
  padding: 7px 10px;
  background: #fff;
  color: #111827;
  cursor: pointer;
  font: inherit;
}
.nv-session-actions .primary {
  border-color: #006fbe;
  background: #0078d7;
  color: #fff;
}
.nv-session-error {
  color: #b91c1c;
  min-height: 18px;
}
html[data-nv-theme="dark"] .nv-session-selection,
html[data-nv-theme="dark"] .nv-session-row {
  color: #e5e7eb;
  background: #111827;
  border-color: #475569;
}
html[data-nv-theme="dark"] .nv-session-desc {
  color: #cbd5e1;
}
`;
  document.head.appendChild(style);
}

function actionButton(label, className, action) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  if (className) button.className = className;
  button.addEventListener("click", action);
  return button;
}

function renderSessionRow(session, panelVars, error) {
  const row = document.createElement("div");
  row.className = "nv-session-row";
  const info = document.createElement("div");
  const title = document.createElement("div");
  title.className = "nv-session-title";
  title.textContent = session.title || session.id;
  const desc = document.createElement("div");
  desc.className = "nv-session-desc";
  desc.textContent = session.description || session.id;
  info.append(title, desc);

  const actions = document.createElement("div");
  actions.className = "nv-session-actions";
  actions.append(
    actionButton("Run", "primary", () => panelVars.onDone?.({ action: "run", scope: session.scope, id: session.id })),
    actionButton("Edit", "", () => panelVars.onDone?.({ action: "edit", scope: session.scope, id: session.id })),
  );
  if (session.scope === "builtin") {
    actions.append(actionButton("Duplicate", "", async () => {
      try {
        const copy = await duplicateBuiltInSession(session.id, session.title);
        panelVars.onDone?.({ action: "edit", scope: "user", id: copy.id });
      } catch (err) {
        error.textContent = err.message;
      }
    }));
  }
  row.append(info, actions);
  return row;
}

function section(title, sessions, panelVars, error) {
  const box = document.createElement("section");
  const heading = document.createElement("h3");
  heading.textContent = title;
  const list = document.createElement("div");
  list.className = "nv-session-list";
  if (!sessions.length) {
    const empty = document.createElement("div");
    empty.className = "nv-session-desc";
    empty.textContent = "No Sessions installed.";
    list.appendChild(empty);
  }
  for (const session of sessions) list.appendChild(renderSessionRow(session, panelVars, error));
  box.append(heading, list);
  return box;
}

export async function createPanel(contentElem, panelVars = {}, panelRoot = null) {
  ensureStyles();
  const title = panelRoot?.querySelector(".panel-title");
  if (title) title.textContent = "Sessions";
  contentElem.innerHTML = "<div class=\"nv-session-selection\">Loading Sessions...</div>";
  const error = document.createElement("div");
  error.className = "nv-session-error";
  try {
    const data = await listSessions();
    const wrapper = document.createElement("div");
    wrapper.className = "nv-session-selection";
    const create = actionButton("New User Session", "nv-session-create", async () => {
      try {
        const name = window.prompt("Session name", "New Session");
        if (!name) return;
        const session = await createUserSession(name);
        panelVars.onDone?.({ action: "edit", scope: "user", id: session.id });
      } catch (err) {
        error.textContent = err.message;
      }
    });
    wrapper.append(
      create,
      section("Built-in Sessions", data.builtIn || [], panelVars, error),
      section("User Sessions", data.user || [], panelVars, error),
      error,
    );
    contentElem.replaceChildren(wrapper);
  } catch (err) {
    contentElem.innerHTML = "";
    error.textContent = err.message;
    contentElem.appendChild(error);
  }
}

