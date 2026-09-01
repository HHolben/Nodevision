// Nodevision/ApplicationSystem/public/ToolbarCallbacks/edit/editCircuitHere.mjs
// This callback opens the existing circuit graphical editor for the selected referenced HTML circuit.

export default async function editCircuitHere() {
  const tools = window.HTMLWysiwygTools;
  if (typeof tools?.editSelectedCircuit === "function") {
    await tools.editSelectedCircuit();
    return;
  }

  console.warn("editCircuitHere: HTML circuit tools are unavailable.");
  alert("Select a referenced circuit in the HTML editor first, then try Edit Circuit again.");
}
