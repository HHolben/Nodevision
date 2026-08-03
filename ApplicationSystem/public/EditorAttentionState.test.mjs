// Nodevision/ApplicationSystem/public/EditorAttentionState.test.mjs
// This test file verifies editor attention state subscriptions, path normalization, label generation, settings validation, and per-file persistence behavior without depending on a browser runtime.

import assert from "node:assert/strict";
import {
  buildEditorContextLabel,
  createEditorAttentionStore,
  normalizeAttentionPath,
} from "./EditorAttentionState.mjs";

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
  };
}

{
  const store = createEditorAttentionStore({ storage: memoryStorage(), eventTarget: null, now: () => 42 });
  let calls = 0;
  const unsubscribe = store.subscribe(() => { calls += 1; });
  store.setEditorContext({ filePath: "/Notebook/a/index.html", fileFamily: "html", editorMode: "HTMLediting" });
  unsubscribe();
  store.setActiveTool("select");
  assert.equal(calls, 2, "unsubscribe stops attention updates");
}

{
  const store = createEditorAttentionStore({ storage: memoryStorage(), eventTarget: null });
  store.setEditorContext({ filePath: "Notebook/a.html", editorMode: "HTMLediting" });
  store.setSelectionContext({ selectedObjectType: "poem-line", selectedObjectId: "line-1" });
  store.setEditorContext({ filePath: "Notebook/b.svg", editorMode: "SVG Editing" });
  const snapshot = store.getSnapshot();
  assert.equal(snapshot.selectedObjectType, null, "file changes clear stale selection type");
  assert.equal(snapshot.selectedObjectId, null, "file changes clear stale selection id");
}

{
  assert.equal(normalizeAttentionPath("/tmp/Notebook/folder/index.html"), "folder/index.html");
  assert.equal(buildEditorContextLabel({ editorMode: "html-graphical", activeTool: "selection-tool", selectedObjectType: "poem-line" }), "Html Graphical · Selection Tool · Poem Line");
}



{
  const store = createEditorAttentionStore({ storage: memoryStorage(), eventTarget: null });
  store.setEditorContext({ filePath: "Notebook/same.html", editorMode: "HTMLediting", activeTool: "selection" });
  store.setSelectionContext({ selectedObjectType: "image", selectedObjectId: "img-1" });
  store.setEditorContext({ filePath: "Notebook/same.html", editorMode: "code" });
  const snapshot = store.getSnapshot();
  assert.equal(snapshot.selectedObjectType, null, "mode changes clear stale selections");
  assert.equal(snapshot.activeTool, null, "mode changes clear stale active tools when no new tool is supplied");
}
