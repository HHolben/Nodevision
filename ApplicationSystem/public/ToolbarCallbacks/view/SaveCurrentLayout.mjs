// Nodevision/public/ToolbarCallbacks/view/SaveCurrentLayout.mjs
// Saves the current workspace layout (panel arrangement) to /UserSettings/DefaultLayout.json

import { serializeWorkspace } from "/panels/workspace.mjs";

export async function onToolbarClick() {
  try {
    if (!window.workspace) {
      window.workspace = document.getElementById("workspace");
    }
    if (!window.workspace) {
      alert("No workspace found to save.");
      return;
    }

    // Serialize current layout
    const layout = serializeWorkspace(window.workspace);
    console.log("Saving current layout:", layout);

    // Send to server
    const res = await fetch("/api/saveLayout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ layout }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    alert("✅ Layout saved successfully!");
  } catch (err) {
    console.error("Failed to save layout:", err);
    alert("❌ Failed to save layout. See console for details.");
  }
}
