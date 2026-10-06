// Nodevision/ApplicationSystem/public/ToolbarCallbacks/view/SaveCurrentLayout.mjs
// This callback saves a named structural workspace through the common layout serializer while rejecting duplicate names and excluding document state.
import { saveCurrentNamedLayout } from "/panels/savedLayouts.mjs";
export function onToolbarClick() {
  const name = prompt("Name this workspace layout:");
  if (name === null) return;
  try { saveCurrentNamedLayout(name); alert("Layout saved."); }
  catch (error) { alert(error.message); }
}
export default onToolbarClick;
