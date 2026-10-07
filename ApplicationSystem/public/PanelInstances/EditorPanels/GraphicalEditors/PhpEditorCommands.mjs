// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/PhpEditorCommands.mjs
// This module routes PHP toolbar commands and owns their window listener.
import { openPhpToolPanel } from './PhpEditorToolPanels.mjs';
import { saveTextFile } from './PhpEditorFiles.mjs';

export const PHP_EDITOR_COMMAND_EVENT = "nv-php-editor-command";
export function installPhpEditorCommands(state, status, renderPreview, runtimePanelState) {
  let commandHandler = null;

  async function executeCommand(command) {
    if (command === "device-manager") {
      await openPhpToolPanel("devices", state);
      status.textContent = "Opened Device Management panel.";
      return;
    }
    if (command === "logic-editor") {
      await openPhpToolPanel("logic", state);
      status.textContent = "Opened Logic Blocks panel.";
      return;
    }
    if (command === "dashboard-config") {
      await openPhpToolPanel("dashboard", state);
      status.textContent = "Opened Dashboard Configuration panel.";
      return;
    }
    if (command === "data-logging") {
      const logger = await openPhpToolPanel("logging", state);
      runtimePanelState.loggingRefresh = logger?.refresh || (() => {});
      status.textContent = "Opened Data Logging panel.";
      return;
    }
    if (command === "toggle-preview") {
      state.runtimeEnabled = !state.runtimeEnabled;
      status.textContent = state.runtimeEnabled
        ? "Runtime enabled."
        : "Runtime paused.";
      renderPreview(true);
      return;
    }
    if (command === "save") {
      try {
        await saveTextFile(state.filePath, state.code);
        status.textContent = `Saved ${state.filePath}`;
      } catch (err) {
        status.textContent = `Save failed: ${err.message}`;
        console.error("PHP editor save failed:", err);
      }
    }
  }
  commandHandler = async (event) => {
    const command = event?.detail?.command;
    if (!command) return;
    await executeCommand(command);
  };
  window.addEventListener(PHP_EDITOR_COMMAND_EVENT, commandHandler);

  return () => window.removeEventListener(PHP_EDITOR_COMMAND_EVENT, commandHandler);
}

