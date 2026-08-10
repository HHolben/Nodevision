// Nodevision/ApplicationSystem/public/Sessions/SessionController.mjs
// This module coordinates Nodevision Session selection, execution, pause handling, restart, and editor launching in the browser.

import { createPanelDOM } from "../panels/panelFactory.mjs";
import { openNodevisionOverlayPanel } from "../TemplateSystem/NodevisionOverlayPanel.mjs";
import { readSession } from "./SessionApi.mjs";
import { SessionExecutionContext } from "./SessionExecutionContext.mjs";
import { SessionRuntime } from "./SessionRuntime.mjs";
import { SessionUiOwnership } from "./SessionUiOwnership.mjs";

let activeSession = null;
let pauseOpen = false;

export function getActiveSession() {
  return activeSession;
}

export async function openSessionSelector() {
  const choice = await openNodevisionOverlayPanel("SessionSelectionPanel", {
    title: "Sessions",
    displayName: "Sessions",
  });
  if (!choice) return null;
  if (choice.action === "run") return startSession(choice.scope, choice.id);
  if (choice.action === "edit") return openSessionEditor(choice.scope, choice.id);
  return null;
}

export async function openSessionEditor(scope, id) {
  const session = await readSession(scope, id);
  const created = await createPanelDOM("SessionEditor", `SessionEditor-${Date.now()}`, "EditorPanel", {
    displayName: session.title || "Session Editor",
    session,
  });
  document.body.appendChild(created.panel);
  created.panel.__nvSetLayout?.("floating");
  created.panel.style.left = "72px";
  created.panel.style.top = "88px";
  created.panel.style.width = "min(980px, calc(100vw - 112px))";
  created.panel.style.height = "min(720px, calc(100vh - 128px))";
  return created.panel;
}

export async function startSession(scope, id) {
  if (activeSession) await quitActiveSession();
  const session = await readSession(scope, id);
  const ui = new SessionUiOwnership(session, { onEscape: pauseActiveSession });
  const context = new SessionExecutionContext({ session, ui });
  const runtime = new SessionRuntime(session.source, context);
  activeSession = { scope, id, session, ui, context, runtime };
  ui.take();
  runtime.start()
    .then(() => {
      if (activeSession?.runtime === runtime) quitActiveSession();
    })
    .catch(async (err) => {
      if (["SESSION_STOPPED", "SESSION_WAIT_CANCELLED"].includes(err?.code)) return;
      runtime.pause();
      await ui.showError(err);
      if (activeSession?.runtime === runtime) await quitActiveSession();
    });
  return activeSession;
}

export async function pauseActiveSession() {
  if (!activeSession || pauseOpen) return null;
  pauseOpen = true;
  activeSession.runtime.pause();
  const choice = await activeSession.ui.showPauseMenu();
  pauseOpen = false;
  if (!activeSession) return null;
  if (choice === "restart") {
    const { scope, id } = activeSession;
    await quitActiveSession();
    return startSession(scope, id);
  }
  if (choice === "quit") return quitActiveSession();
  activeSession.runtime.resume();
  return activeSession;
}

export async function quitActiveSession() {
  if (!activeSession) return null;
  const session = activeSession;
  activeSession = null;
  session.runtime.abort();
  session.context.cleanup();
  session.ui.release();
  return session;
}

if (typeof window !== "undefined") window.NodevisionSessions = {
  openSessionSelector,
  openSessionEditor,
  startSession,
  pauseActiveSession,
  quitActiveSession,
  getActiveSession,
};

