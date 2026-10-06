// Nodevision/ApplicationSystem/public/Sessions/SandboxFocusSession.mjs
// This shared Sandbox controller hosts the normal Game View, delegates startup planning, and applies temporary Build or Play presentation through Session cleanup.

import { acquireWorldViewPermissions } from "../MetaWorld/WorldAuthoringPermissions.mjs";
import { setStatus } from "../StatusBar.mjs";
import { resolveActiveFilePath } from "../panels/workspaceParts/workspaceActiveFile.mjs";
import { getActivePanelTab } from "../panels/panelTabs.mjs";
import { createSandboxWorldStartup } from "./SandboxWorldStartup.mjs";
import { createSandboxWorkspace } from "./SandboxWorkspace.mjs";
export async function startSandboxFocus(context = {}, mode = "build") {
  if (!["build", "play"].includes(mode)) throw new Error("Sandbox mode must be build or play.");
  if (!context.executionContext?.addCleanup) throw new Error("Launch Sandbox through the Session selector.");
  const cell = window.activeCell?.closest?.(".panel-cell") || window.activeCell;
  const tab = getActivePanelTab(cell);
  const filePath = resolveActiveFilePath(tab?.panelVars?.filePath || tab?.resourcePath || cell?.dataset.currentFilePath || window.selectedFilePath);
  if (!/\.html?$/i.test(filePath)) throw new Error("Select an HTML page before starting Sandbox.");
  const startup = createSandboxWorldStartup({ status: message => setStatus(message) });
  const workspace = createSandboxWorkspace(cell, mode);
  const releasePermissions = acquireWorldViewPermissions({ authoring: mode === "build" });
  let disposed = false;
  const exit = document.createElement("button");
  exit.textContent = "Exit Sandbox";
  exit.className = "nv-sandbox-exit";
  Object.assign(exit.style, { position: "fixed", bottom: "32px", right: "16px", zIndex: "1100" });
  exit.addEventListener("click", () => {
    context.executionContext.emit("sandbox.finished", { mode, filePath });
    const sessions = window.NodevisionSessions;
    if (sessions?.getActiveSession?.()?.context === context.executionContext) void sessions.quitActiveSession();
  });
  context.executionContext.addCleanup(() => {
    disposed = true;
    try { startup.capture(); }
    finally { try { workspace.dispose(); } finally { releasePermissions(); exit.remove(); } }
  });
  // Seed selection and world classification are startup work, never frame-loop work.
  const initialDefinition = await startup.resolve(filePath);
  if (disposed) return { ok: false, cancelled: true };
  context.ui?.useWorkspace?.();
  document.body.appendChild(exit);
  let initial = true;
  const panel = await workspace.open(filePath, {
    viewPermissions: { authoring: mode === "build" },
    beforeWorldDispose: runtime => startup.capture(runtime),
    onWorldSaved: startup.saved,
    resolveWorldDefinition: path => {
      if (initial && path === filePath) { initial = false; return initialDefinition; }
      initial = false; return startup.resolve(path);
    }
  });
  if (disposed) return { ok: false, cancelled: true };
  // Game View owns its startup error/retry UI and Escape/pause behavior even after a failed load.
  return { ok: Boolean(panel), mode, filePath };
}
