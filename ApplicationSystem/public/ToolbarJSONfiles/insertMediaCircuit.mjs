// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/insertMediaCircuit.mjs
// Insert Media form for creating or referencing .cir files from the HTML graphical editor.

import {
  dirname,
  getActiveEditorNotebookPath,
  insertHtmlAtCaret,
  joinNotebookPath,
  normalizeNotebookPath,
  notebookPathFromPickedFile,
  saveNotebookText,
} from "./insertMediaCommon.mjs";
import { readFileAsText } from "./insertMediaIO.mjs";
import { createBlankCircuitFileContent } from "/PanelInstances/EditorPanels/GraphicalEditors/CircuitEditorComponents/CircuitFileFormat.mjs";
import { buildCircuitReferenceMarkup } from "/PanelInstances/EditorPanels/GraphicalEditors/CircuitEditorComponents/CircuitReferenceElement.mjs";

function sanitizeName(name = "") {
  return String(name || "").trim().replace(/[^\w.\-]+/g, "_").replace(/^_+|_+$/g, "") || `circuit-${Date.now()}.cir`;
}

function ensureCirExt(name = "") {
  const clean = sanitizeName(name || `circuit-${Date.now()}.cir`);
  return clean.toLowerCase().endsWith(".cir") ? clean : `${clean.replace(/\.[^.]+$/, "")}.cir`;
}

function selectedValue(root, name) {
  return Array.from(root.querySelectorAll(`input[name="${name}"]`)).find((el) => el.checked)?.value || "";
}

function clampDimension(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(4096, Math.max(120, parsed));
}

async function createNotebookTextFile(notebookPath, content) {
  const path = normalizeNotebookPath(notebookPath);
  if (!path) throw new Error("Missing Notebook path.");
  const created = await fetch("/api/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  if (!created.ok) {
    const message = await created.text().catch(() => "");
    throw new Error(message || `Create failed (${created.status}).`);
  }
  await saveNotebookText(path, content, "application/x-spice");
  window.dispatchEvent(new CustomEvent("nodevision-file-saved", { detail: { filePath: path, path, resourceType: "circuit" } }));
  return path;
}

function refreshLinkedManagers(linkedPath = "") {
  if (!linkedPath) return;
  const dir = dirname(linkedPath);
  if (typeof window.refreshFileManager === "function") window.refreshFileManager(dir);
  document.dispatchEvent(new CustomEvent("refreshFileManager", { detail: { path: dir } }));
  if (typeof window.refreshGraphManager === "function") window.refreshGraphManager({ fit: false, reason: "insert-media-circuit" });
  document.dispatchEvent(new CustomEvent("refreshGraphManager", { detail: { path: dir, reason: "insert-media-circuit" } }));
}

export function renderCircuit(root) {
  const editorPath = () => getActiveEditorNotebookPath();
  root.innerHTML = `<form style="display:flex;flex-direction:column;gap:10px;font:12px monospace;min-width:280px;max-width:540px;">
    <fieldset style="border:1px solid #c6c6c6;padding:8px;">
      <legend>Circuit Source</legend>
      <label style="display:block;margin-bottom:6px;"><input type="radio" name="nv-circuit-source" value="new" checked> New Circuit</label>
      <label style="display:block;"><input type="radio" name="nv-circuit-source" value="existing"> Existing Circuit</label>
    </fieldset>
    <fieldset style="border:1px solid #c6c6c6;padding:8px;">
      <legend>Storage Mode</legend>
      <label style="display:block;"><input type="radio" name="nv-circuit-storage" value="referenced" checked> Referenced .cir File</label>
    </fieldset>
    <div data-section="new" style="display:flex;flex-direction:column;gap:8px;">
      <label>New Circuit File Name<input data-field="newName" type="text" style="display:block;width:100%;margin-top:4px;" /></label>
      <div data-field="targetHint" style="font-size:11px;color:#4b4b4b;"></div>
    </div>
    <div data-section="existing" style="display:none;flex-direction:column;gap:8px;">
      <div style="display:flex;gap:8px;align-items:flex-end;">
        <label style="flex:1;">Existing .cir Notebook Path<input data-field="existingSource" type="text" placeholder="Electronics/Circuits/Test.cir" style="display:block;width:100%;margin-top:4px;" /></label>
        <button type="button" data-action="choose-existing" style="font:12px monospace;padding:6px 10px;border:1px solid #333;background:#eee;cursor:pointer;">Choose File...</button>
      </div>
      <div data-field="existingFileStatus" style="font-size:11px;color:#4b4b4b;">No local file selected.</div>
    </div>
    <div style="display:flex;gap:8px;align-items:flex-end;">
      <label style="flex:1;">Width (px)<input data-field="width" type="number" min="120" max="4096" value="480" style="display:block;width:100%;margin-top:4px;" /></label>
      <label style="flex:1;">Height (px)<input data-field="height" type="number" min="120" max="4096" value="320" style="display:block;width:100%;margin-top:4px;" /></label>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;"><button type="submit" style="font:12px monospace;padding:6px 10px;border:1px solid #333;background:#eee;cursor:pointer;">Insert</button></div>
    <div data-field="status" style="font-size:11px;color:#b00;min-height:14px;"></div>
  </form>`;

  const newSection = root.querySelector('[data-section="new"]');
  const existingSection = root.querySelector('[data-section="existing"]');
  const newNameEl = root.querySelector('[data-field="newName"]');
  const targetHintEl = root.querySelector('[data-field="targetHint"]');
  const existingSourceEl = root.querySelector('[data-field="existingSource"]');
  const existingFileStatusEl = root.querySelector('[data-field="existingFileStatus"]');
  const widthEl = root.querySelector('[data-field="width"]');
  const heightEl = root.querySelector('[data-field="height"]');
  const statusEl = root.querySelector('[data-field="status"]');
  const hiddenExisting = document.createElement("input");
  hiddenExisting.type = "file";
  hiddenExisting.accept = ".cir";
  hiddenExisting.style.display = "none";
  root.querySelector("form").appendChild(hiddenExisting);

  let existingFile = { text: "", name: "", notebookPath: "" };
  const setStatus = (message) => { statusEl.textContent = String(message || ""); };
  const targetPathForNew = () => normalizeNotebookPath(joinNotebookPath(dirname(editorPath()), ensureCirExt(newNameEl.value)));
  const updateHint = () => {
    const sourceMode = selectedValue(root, "nv-circuit-source");
    newSection.style.display = sourceMode === "new" ? "flex" : "none";
    existingSection.style.display = sourceMode === "existing" ? "flex" : "none";
    targetHintEl.textContent = sourceMode === "new" ? `Will save to: ${targetPathForNew()}` : "";
  };
  newNameEl.value = `circuit-${Date.now()}.cir`;
  updateHint();

  root.querySelectorAll('input[name="nv-circuit-source"]').forEach((el) => el.addEventListener("change", updateHint));
  newNameEl.addEventListener("input", updateHint);
  root.querySelector('[data-action="choose-existing"]').addEventListener("click", () => hiddenExisting.click());
  hiddenExisting.addEventListener("change", async () => {
    const file = hiddenExisting.files?.[0] || null;
    hiddenExisting.value = "";
    if (!file) return;
    const notebookPath = notebookPathFromPickedFile(file);
    existingFileStatusEl.textContent = `Loading: ${file.name || "circuit.cir"}`;
    try {
      existingFile = { text: await readFileAsText(file), name: file.name || "circuit.cir", notebookPath };
      existingSourceEl.value = notebookPath || normalizeNotebookPath(joinNotebookPath(dirname(editorPath()), ensureCirExt(existingFile.name)));
      existingSourceEl.dataset.localFile = "true";
      existingFileStatusEl.textContent = notebookPath ? `Selected Notebook file: ${notebookPath}` : `Selected local file: ${existingFile.name}`;
    } catch (err) {
      existingFile = { text: "", name: "", notebookPath: "" };
      delete existingSourceEl.dataset.localFile;
      existingFileStatusEl.textContent = "No local file selected.";
      setStatus(err?.message || String(err));
    }
  });

  root.querySelector("form").addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("");
    try {
      const sourceMode = selectedValue(root, "nv-circuit-source");
      let linkedNotebookPath = "";
      if (sourceMode === "new") {
        linkedNotebookPath = targetPathForNew();
        await createNotebookTextFile(linkedNotebookPath, createBlankCircuitFileContent(linkedNotebookPath));
      } else {
        const entered = normalizeNotebookPath(existingSourceEl.value);
        if (!entered) throw new Error("Enter an existing .cir Notebook path.");
        if (!entered.toLowerCase().endsWith(".cir")) throw new Error("Referenced circuits must be .cir files.");
        linkedNotebookPath = entered;
        if (existingFile.text && existingSourceEl.dataset.localFile === "true" && entered !== existingFile.notebookPath) {
          await createNotebookTextFile(linkedNotebookPath, existingFile.text);
        }
      }
      const html = buildCircuitReferenceMarkup({
        notebookPath: linkedNotebookPath,
        editorFilePath: editorPath(),
        width: clampDimension(widthEl.value, 480),
        height: clampDimension(heightEl.value, 320),
        title: linkedNotebookPath.split("/").pop() || "Circuit",
      });
      const inserted = insertHtmlAtCaret(html);
      if (inserted === false) throw new Error("Circuit insertion was not available.");
      window.HTMLWysiwygTools?.hydrateReferencedCircuits?.();
      refreshLinkedManagers(linkedNotebookPath);
      setStatus(`Inserted ${linkedNotebookPath}.`);
    } catch (err) {
      console.warn("[insertMediaCircuit]", err);
      setStatus(err?.message || String(err));
    }
  });
}
