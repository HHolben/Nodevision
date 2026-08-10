// Nodevision/ApplicationSystem/public/ToolbarCallbacks/terminal/openSessionSelector.mjs
// This callback opens the Nodevision Sessions selector from the Run toolbar menu.

export default async function openSessionSelectorCallback() {
  const module = await import("/Sessions/SessionController.mjs");
  return module.openSessionSelector();
}

