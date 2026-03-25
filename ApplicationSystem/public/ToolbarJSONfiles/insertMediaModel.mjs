// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/insertMediaModel.mjs
// Renders and executes the Insert Model workflow with New/Existing and Referenced/Inline (mirrors Insert Image panel structure).

import { escapeHtml, getActiveEditorNotebookPath, dirname, joinNotebookPath, normalizeNotebookPath, notebookHrefFromPath, saveNotebookText, insertHtmlAtCaret } from "./insertMediaCommon.mjs";
import { fetchUrlAsText, looksLikeUrlOrAbsPath, notebookSourceFromPath, readFileAsDataUrl, readFileAsText, saveNotebookBinaryFromDataUrl } from "./insertMediaIO.mjs";

function ensureExt(fileName, ext) {
  const name = String(fileName || "").trim();
  if (!name) return "";
  const lower = name.toLowerCase();
  if (lower.endsWith(`.${ext}`)) return name;
  if (name.includes(".")) return name;
  return `${name}.${ext}`;
}

function defaultModelContent(ext, baseName) {
  const label = String(baseName || "model").replace(/[^a-z0-9_-]+/gi, "-").slice(0, 32) || "model";
  if (ext === "stl") return `solid ${label}\n  facet normal 0 0 1\n    outer loop\n      vertex 0 0 0\n      vertex 1 0 0\n      vertex 0 1 0\n    endloop\n  endfacet\nendsolid ${label}\n`;
  if (ext === "obj") return `# ${label}.obj\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n`;
  if (ext === "gltf") return JSON.stringify({ asset: { version: "2.0", generator: "Nodevision Insert Media" } }, null, 2) + "\n";
  return `# New ${ext} model placeholder (${label})\n`;
}

function pickDefaultExt(exts) {
  const list = Array.from(new Set(exts || [])).map((e) => String(e).toLowerCase()).filter(Boolean).sort((a, b) => a.localeCompare(b));
  return list.includes("stl") ? "stl" : (list[0] || "stl");
}

export function renderInsertModel(root, exts = []) {
  const extensions = Array.from(new Set(exts)).map((e) => String(e).toLowerCase()).filter(Boolean).sort((a, b) => a.localeCompare(b));
  const defaultExt = pickDefaultExt(extensions);
  const options = extensions.length ? extensions : [defaultExt];

  root.innerHTML = `<form style="display:flex;flex-direction:column;gap:10px;font:12px monospace;min-width:300px;max-width:660px;"><fieldset style="border:1px solid #c6c6c6;padding:8px;"><legend>Model Source</legend><label style="display:block;margin-bottom:6px;"><input type="radio" name="nv-source" value="new" checked> New Model</label><label style="display:block;"><input type="radio" name="nv-source" value="existing"> Existing Model</label></fieldset><fieldset style="border:1px solid #c6c6c6;padding:8px;"><legend>Storage Mode</legend><label style="display:block;margin-bottom:6px;"><input type="radio" name="nv-storage" value="referenced" checked> Referenced (link to file)</label><label style="display:block;"><input type="radio" name="nv-storage" value="inline"> Inline (embed preview text)</label></fieldset><div data-section="new" style="display:flex;flex-direction:column;gap:8px;"><div data-section="new-ref" style="display:flex;flex-direction:column;gap:8px;"><label>New Model Format<select data-field="format" style="display:block;width:100%;margin-top:4px;">${options.map((e) => `<option value="${escapeHtml(e)}"${e === defaultExt ? " selected" : ""}>${escapeHtml(e)}</option>`).join("")}</select></label><label>New Model File Name<input data-field="fileName" type="text" placeholder="model.${escapeHtml(defaultExt)}" style="display:block;width:100%;margin-top:4px;" /></label></div><div style="font-size:11px;color:#666;line-height:1.3;">Inline inserts a text preview; Referenced saves a Notebook file and links to it.</div></div><div data-section="existing" style="display:none;flex-direction:column;gap:8px;"><div style="display:flex;gap:8px;align-items:flex-end;"><label style="flex:1;">Existing Source (Notebook path or URL)<input data-field="existingSource" type="text" placeholder="models/example.${escapeHtml(defaultExt)} or https://..." style="display:block;width:100%;margin-top:4px;" /></label><button type="button" data-action="choose-existing" style="font:12px monospace;padding:6px 10px;border:1px solid #333;background:#eee;cursor:pointer;">Choose File...</button></div><div data-field="existingFileStatus" style="font-size:11px;color:#4b4b4b;">No local file selected.</div></div><div style="display:flex;gap:10px;justify-content:flex-end;"><button type="submit" style="font:12px monospace;padding:6px 10px;border:1px solid #333;background:#eee;cursor:pointer;">Insert</button></div><div data-field="status" style="font-size:11px;color:#b00;min-height:14px;"></div></form>`;

  const form = root.querySelector("form");
  const sourceEls = () => Array.from(root.querySelectorAll('input[name="nv-source"]'));
  const storageEls = () => Array.from(root.querySelectorAll('input[name="nv-storage"]'));
  const newSection = root.querySelector('[data-section="new"]');
  const existingSection = root.querySelector('[data-section="existing"]');
  const newRefSection = root.querySelector('[data-section="new-ref"]');
  const formatEl = root.querySelector('[data-field="format"]');
  const fileEl = root.querySelector('[data-field="fileName"]');
  const existingSourceEl = root.querySelector('[data-field="existingSource"]');
  const existingFileStatus = root.querySelector('[data-field="existingFileStatus"]');
  const statusEl = root.querySelector('[data-field="status"]');

  const hiddenExisting = document.createElement("input");
  hiddenExisting.type = "file";
  hiddenExisting.accept = options.map((e) => `.${e}`).join(",") || "";
  hiddenExisting.style.display = "none";
  form.appendChild(hiddenExisting);

  let existingLocal = { dataUrl: "", text: "", name: "" };
  const setStatus = (t) => { statusEl.textContent = String(t || ""); };
  const valueOf = (radios) => radios.find((r) => r.checked)?.value || "";

  const sync = () => {
    const src = valueOf(sourceEls());
    const storage = valueOf(storageEls());
    newSection.style.display = src === "new" ? "flex" : "none";
    existingSection.style.display = src === "existing" ? "flex" : "none";
    newRefSection.style.display = (src === "new" && storage === "referenced") ? "flex" : "none";
  };
  sourceEls().forEach((r) => r.addEventListener("change", sync));
  storageEls().forEach((r) => r.addEventListener("change", sync));
  sync();

  const updateExistingLabel = () => {
    existingFileStatus.textContent = existingLocal.dataUrl ? `Selected: ${existingLocal.name}` : "No local file selected.";
  };
  updateExistingLabel();

  root.querySelector('[data-action="choose-existing"]').addEventListener("click", () => hiddenExisting.click());
  hiddenExisting.addEventListener("change", async () => {
    const file = hiddenExisting.files?.[0];
    hiddenExisting.value = "";
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      let text = "";
      if (file.size <= 800_000) {
        try { text = await readFileAsText(file); } catch { text = ""; }
      }
      existingLocal = { dataUrl, text, name: file.name };
      existingSourceEl.value = file.name;
      existingSourceEl.dataset.localFile = "true";
    } catch (e) {
      existingLocal = { dataUrl: "", text: "", name: "" };
      delete existingSourceEl.dataset.localFile;
      setStatus(e?.message || String(e));
    }
    updateExistingLabel();
  });

  existingSourceEl.addEventListener("input", () => {
    if (existingSourceEl.dataset.localFile === "true" && existingSourceEl.value !== existingLocal.name) {
      existingLocal = { dataUrl: "", text: "", name: "" };
      delete existingSourceEl.dataset.localFile;
      updateExistingLabel();
    }
  });

  form.addEventListener("submit", async (evt) => {
    evt.preventDefault();
    setStatus("");
    try {
      const sourceMode = valueOf(sourceEls());
      const storageMode = valueOf(storageEls());
      const editorPath = getActiveEditorNotebookPath();
      const baseDir = dirname(editorPath);
      const defaultDir = joinNotebookPath(baseDir, "models");
      let html = "";

      if (sourceMode === "new") {
        const ext = String(formatEl.value || defaultExt).trim().toLowerCase() || defaultExt;
        const fileName = ensureExt(fileEl.value || `model-${Date.now()}`, ext) || `model-${Date.now()}.${ext}`;
        const content = defaultModelContent(ext, fileName.replace(/\.[^.]+$/, ""));

        if (storageMode === "inline") {
          html = `<details class="nv-inline-model"><summary>${escapeHtml(fileName)}</summary><pre style="white-space:pre-wrap;">${escapeHtml(content)}</pre></details>`;
        } else {
          const notebookPath = normalizeNotebookPath(joinNotebookPath(defaultDir, fileName));
          await saveNotebookText(notebookPath, content, "text/plain");
          const href = notebookSourceFromPath(notebookPath, editorPath);
          html = `<a href="${escapeHtml(href)}" data-nv-linked-path="${escapeHtml(notebookPath)}">Model: ${escapeHtml(fileName)}</a>`;
        }
      } else {
        const entered = String(existingSourceEl.value || "").trim();
        const localSelected = Boolean(existingLocal.dataUrl && existingSourceEl.dataset.localFile === "true");
        if (!entered && !localSelected) throw new Error("Enter an existing model source or choose a local file.");

        if (storageMode === "inline") {
          let text = "";
          if (localSelected) {
            text = existingLocal.text || "(Binary model selected; no text preview available.)";
          } else {
            const url = looksLikeUrlOrAbsPath(entered) ? entered : notebookHrefFromPath(normalizeNotebookPath(entered));
            text = await fetchUrlAsText(url);
          }
          if (text.length > 20000) text = text.slice(0, 20000) + "\n... (truncated)";
          const label = localSelected ? (existingLocal.name || "model") : (entered.split("/").pop() || entered);
          html = `<details class="nv-inline-model"><summary>${escapeHtml(label)}</summary><pre style="white-space:pre-wrap;">${escapeHtml(text)}</pre></details>`;
        } else if (localSelected) {
          const notebookPath = normalizeNotebookPath(entered) || normalizeNotebookPath(joinNotebookPath(defaultDir, existingLocal.name || `model-${Date.now()}.${defaultExt}`));
          await saveNotebookBinaryFromDataUrl(notebookPath, existingLocal.dataUrl, "application/octet-stream");
          const href = notebookSourceFromPath(notebookPath, editorPath);
          html = `<a href="${escapeHtml(href)}" data-nv-linked-path="${escapeHtml(notebookPath)}">Model: ${escapeHtml(notebookPath.split("/").pop() || notebookPath)}</a>`;
        } else if (looksLikeUrlOrAbsPath(entered)) {
          html = `<a href="${escapeHtml(entered)}">${escapeHtml(entered.split("/").pop() || entered)}</a>`;
        } else {
          const notebookPath = normalizeNotebookPath(entered);
          const href = notebookSourceFromPath(notebookPath, editorPath);
          html = `<a href="${escapeHtml(href)}" data-nv-linked-path="${escapeHtml(notebookPath)}">Model: ${escapeHtml(notebookPath.split("/").pop() || notebookPath)}</a>`;
        }
      }

      insertHtmlAtCaret(html);
      setStatus("Inserted.");
    } catch (err) {
      console.warn("[insertMediaModel]", err);
      setStatus(err?.message || String(err));
    }
  });
}

