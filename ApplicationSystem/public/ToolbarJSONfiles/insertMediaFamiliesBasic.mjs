// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/insertMediaFamiliesBasic.mjs
// Basic Insert Media family renderer delegates specialized families and handles generic link or text media placeholders.

import { escapeHtml, getActiveEditorNotebookPath, dirname, joinNotebookPath, normalizeNotebookPath, saveNotebookText, insertHtmlAtCaret } from "./insertMediaCommon.mjs";
import { fetchUrlAsText, looksLikeUrlOrAbsPath, notebookSourceFromPath } from "./insertMediaIO.mjs";
import { renderEquation } from "./insertMediaEquation.mjs";

// === Shared Button ===
export function button(label) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  Object.assign(b.style, { padding: "6px 10px", border: "1px solid #333", background: "#eee", cursor: "pointer" });
  return b;
}

// === Generic Media Form ===
function valueOf(radios) {
  return Array.from(radios || []).find((radio) => radio.checked)?.value || "";
}

function genericFamilyDir(family) {
  const slug = String(family || "media").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `assets/${slug || "media"}`;
}

function linkHtmlForSource(source, editorPath) {
  const entered = String(source || "").trim();
  if (!entered) throw new Error("Enter an existing source.");
  if (looksLikeUrlOrAbsPath(entered)) {
    return `<a href="${escapeHtml(entered)}">${escapeHtml(entered.split("/").pop() || entered)}</a>`;
  }

  const notebookPath = normalizeNotebookPath(entered);
  const href = notebookSourceFromPath(notebookPath, editorPath);
  const label = notebookPath.split("/").pop() || notebookPath;
  return `<a href="${escapeHtml(href)}" data-nv-linked-path="${escapeHtml(notebookPath)}">${escapeHtml(label)}</a>`;
}

export function renderGenericLink(root, familyLabel, exts = []) {
  const family = String(familyLabel || "Insert Media");
  if (family.trim().toLowerCase() === "equation") {
    renderEquation(root, exts);
    return;
  }

  const extensions = Array.from(new Set(exts || [])).map((e) => String(e).toLowerCase()).filter(Boolean).sort((a, b) => a.localeCompare(b));
  const defaultExt = extensions[0] || "txt";
  const optionHtml = extensions.length
    ? extensions.map((e) => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`).join("")
    : `<option value="${escapeHtml(defaultExt)}">${escapeHtml(defaultExt)}</option>`;

  root.innerHTML = `<form style="display:flex;flex-direction:column;gap:10px;font:12px monospace;min-width:280px;max-width:560px;"><div style="font-weight:600;">${escapeHtml(family)}</div><fieldset style="border:1px solid #c6c6c6;padding:8px;"><legend>Source</legend><label style="display:block;margin-bottom:6px;"><input type="radio" name="nv-source" value="new" checked> New</label><label style="display:block;"><input type="radio" name="nv-source" value="existing"> Existing</label></fieldset><fieldset style="border:1px solid #c6c6c6;padding:8px;"><legend>Storage Mode</legend><label style="display:block;margin-bottom:6px;"><input type="radio" name="nv-storage" value="referenced" checked> Referenced</label><label style="display:block;"><input type="radio" name="nv-storage" value="inline"> Inline</label></fieldset><div data-section="new" style="display:flex;flex-direction:column;gap:8px;"><div data-section="new-ref" style="display:flex;flex-direction:column;gap:8px;"><label>New Format<select data-field="format" style="display:block;width:100%;margin-top:4px;">${optionHtml}</select></label><label>New File Name<input data-field="newName" type="text" placeholder="file.${escapeHtml(defaultExt)}" style="display:block;width:100%;margin-top:4px;" /></label></div><label>Inline Content<textarea data-field="inlineContent" rows="5" style="display:block;width:100%;margin-top:4px;white-space:pre;">New ${escapeHtml(family)} item</textarea></label></div><div data-section="existing" style="display:none;flex-direction:column;gap:8px;"><label>Existing Source (Notebook path or URL)<input data-field="existingSource" type="text" placeholder="path/to/file or https://..." style="display:block;width:100%;margin-top:4px;" /></label></div><div style="display:flex;gap:10px;justify-content:flex-end;"><button type="submit" style="font:12px monospace;padding:6px 10px;border:1px solid #333;background:#eee;cursor:pointer;">Insert</button></div><div data-field="status" style="font-size:11px;color:#b00;min-height:14px;"></div></form>`;

  const form = root.querySelector("form");
  const sourceEls = () => root.querySelectorAll("input[name=\"nv-source\"]");
  const storageEls = () => root.querySelectorAll("input[name=\"nv-storage\"]");
  const newSection = root.querySelector("[data-section=\"new\"]");
  const existingSection = root.querySelector("[data-section=\"existing\"]");
  const newRefSection = root.querySelector("[data-section=\"new-ref\"]");
  const formatEl = root.querySelector("[data-field=\"format\"]");
  const newNameEl = root.querySelector("[data-field=\"newName\"]");
  const inlineContentEl = root.querySelector("[data-field=\"inlineContent\"]");
  const existingSourceEl = root.querySelector("[data-field=\"existingSource\"]");
  const statusEl = root.querySelector("[data-field=\"status\"]");
  const setStatus = (t) => { statusEl.textContent = String(t || ""); };

  const sync = () => {
    const source = valueOf(sourceEls());
    const storage = valueOf(storageEls());
    newSection.style.display = source === "new" ? "flex" : "none";
    existingSection.style.display = source === "existing" ? "flex" : "none";
    newRefSection.style.display = source === "new" && storage === "referenced" ? "flex" : "none";
  };
  sourceEls().forEach((radio) => radio.addEventListener("change", sync));
  storageEls().forEach((radio) => radio.addEventListener("change", sync));
  sync();

  form.addEventListener("submit", async (evt) => {
    evt.preventDefault();
    setStatus("");
    try {
      const sourceMode = valueOf(sourceEls());
      const storageMode = valueOf(storageEls());
      const editorPath = getActiveEditorNotebookPath();
      let html = "";

      if (sourceMode === "new" && storageMode === "referenced") {
        const fmt = String(formatEl.value || defaultExt).trim().toLowerCase() || defaultExt;
        const rawName = String(newNameEl.value || `new-${Date.now()}.${fmt}`).trim();
        const fileName = rawName.includes(".") ? rawName : `${rawName}.${fmt}`;
        const notebookPath = normalizeNotebookPath(joinNotebookPath(joinNotebookPath(dirname(editorPath), genericFamilyDir(family)), fileName));
        await saveNotebookText(notebookPath, `New ${family}: ${fileName}\n`, "text/plain");
        html = linkHtmlForSource(notebookPath, editorPath);
      } else if (sourceMode === "new") {
        html = `<pre style="white-space:pre-wrap;border:1px solid #ccc;padding:8px;">${escapeHtml(String(inlineContentEl.value || ""))}</pre>`;
      } else if (storageMode === "inline") {
        const entered = String(existingSourceEl.value || "").trim();
        const url = looksLikeUrlOrAbsPath(entered) ? entered : notebookSourceFromPath(normalizeNotebookPath(entered), editorPath);
        html = `<pre style="white-space:pre-wrap;border:1px solid #ccc;padding:8px;">${escapeHtml(await fetchUrlAsText(url))}</pre>`;
      } else {
        html = linkHtmlForSource(existingSourceEl.value, editorPath);
      }

      insertHtmlAtCaret(html);
      setStatus("Inserted.");
    } catch (err) {
      console.warn("[insertMediaGeneric]", err);
      setStatus(err?.message || String(err));
    }
  });
}
