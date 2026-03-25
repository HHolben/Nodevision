// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/insertMediaBinaryAv.mjs
// Shared renderer for binary A/V inserts (Video + Sound) with New/Existing and Referenced/Inline.
import { escapeHtml, getActiveEditorNotebookPath, dirname, joinNotebookPath, normalizeNotebookPath, notebookHrefFromPath, insertHtmlAtCaret } from "./insertMediaCommon.mjs";
import { fetchUrlAsDataUrl, looksLikeUrlOrAbsPath, notebookSourceFromPath, readFileAsDataUrl, saveNotebookBinaryFromDataUrl } from "./insertMediaIO.mjs";

function pickDefaultExt(exts, preferred) {
  const list = Array.from(new Set(exts || [])).map((e) => String(e).toLowerCase()).filter(Boolean);
  const pref = String(preferred || "").toLowerCase();
  if (pref && list.includes(pref)) return pref;
  return list[0] || pref || "bin";
}
function ensureExt(name, ext) {
  const n = String(name || "").trim();
  if (!n) return "";
  if (n.toLowerCase().endsWith(`.${ext}`)) return n;
  if (n.includes(".")) return n;
  return `${n}.${ext}`;
}

export function renderBinaryAv(root, cfg) {
  const kind = String(cfg?.kind || "Media");
  const tag = String(cfg?.tagName || "video");
  const accept = String(cfg?.accept || "");
  const dirName = String(cfg?.defaultDirName || "media");
  const preferredExt = String(cfg?.preferredExt || "");
  const mimeFromExt = typeof cfg?.mimeFromExt === "function" ? cfg.mimeFromExt : (() => "application/octet-stream");
  const elementStyle = String(cfg?.elementStyle || "");

  const extensions = Array.from(new Set(cfg?.exts || [])).map((e) => String(e).toLowerCase()).filter(Boolean).sort((a, b) => a.localeCompare(b));
  const defaultExt = pickDefaultExt(extensions, preferredExt || extensions[0] || "");

  root.innerHTML = `<form style="display:flex;flex-direction:column;gap:10px;font:12px monospace;min-width:280px;max-width:540px;"><fieldset style="border:1px solid #c6c6c6;padding:8px;"><legend>${escapeHtml(kind)} Source</legend><label style="display:block;margin-bottom:6px;"><input type="radio" name="nv-source" value="new" checked> New ${escapeHtml(kind)}</label><label style="display:block;"><input type="radio" name="nv-source" value="existing"> Existing ${escapeHtml(kind)}</label></fieldset><fieldset style="border:1px solid #c6c6c6;padding:8px;"><legend>Storage Mode</legend><label style="display:block;margin-bottom:6px;"><input type="radio" name="nv-storage" value="referenced" checked> Referenced (src points to file path)</label><label style="display:block;"><input type="radio" name="nv-storage" value="inline"> Inline (embed as data URL)</label></fieldset><div data-section="new" style="display:flex;flex-direction:column;gap:8px;"><div style="display:flex;gap:8px;align-items:flex-end;"><button type="button" data-action="choose-new" style="font:12px monospace;padding:6px 10px;border:1px solid #333;background:#eee;cursor:pointer;">Choose File...</button><span data-field="newFileStatus" style="font-size:11px;color:#4b4b4b;">No local file selected.</span></div><div data-section="new-ref" style="display:flex;flex-direction:column;gap:8px;"><label>New ${escapeHtml(kind)} Format<select data-field="format" style="display:block;width:100%;margin-top:4px;">${extensions.map((e) => `<option value="${escapeHtml(e)}"${e === defaultExt ? " selected" : ""}>${escapeHtml(e)}</option>`).join("")}</select></label><label>Destination File Name (optional)<input data-field="newName" type="text" placeholder="${escapeHtml(kind.toLowerCase())}.${escapeHtml(defaultExt)}" style="display:block;width:100%;margin-top:4px;" /></label></div></div><div data-section="existing" style="display:none;flex-direction:column;gap:8px;"><div style="display:flex;gap:8px;align-items:flex-end;"><label style="flex:1;">Existing Source (Notebook path or URL)<input data-field="existingSource" type="text" placeholder="${escapeHtml(dirName)}/example.${escapeHtml(defaultExt)} or https://..." style="display:block;width:100%;margin-top:4px;" /></label><button type="button" data-action="choose-existing" style="font:12px monospace;padding:6px 10px;border:1px solid #333;background:#eee;cursor:pointer;">Choose File...</button></div><div data-field="existingFileStatus" style="font-size:11px;color:#4b4b4b;">No local file selected.</div></div><div style="display:flex;gap:10px;justify-content:flex-end;"><button type="submit" style="font:12px monospace;padding:6px 10px;border:1px solid #333;background:#eee;cursor:pointer;">Insert</button></div><div data-field="status" style="font-size:11px;color:#b00;min-height:14px;"></div></form>`;

  const form = root.querySelector("form");
  const sourceEls = () => Array.from(root.querySelectorAll('input[name="nv-source"]'));
  const storageEls = () => Array.from(root.querySelectorAll('input[name="nv-storage"]'));
  const newSection = root.querySelector('[data-section="new"]');
  const existingSection = root.querySelector('[data-section="existing"]');
  const newRefSection = root.querySelector('[data-section="new-ref"]');
  const formatEl = root.querySelector('[data-field="format"]');
  const newNameEl = root.querySelector('[data-field="newName"]');
  const existingSourceEl = root.querySelector('[data-field="existingSource"]');
  const statusEl = root.querySelector('[data-field="status"]');
  const newFileStatus = root.querySelector('[data-field="newFileStatus"]');
  const existingFileStatus = root.querySelector('[data-field="existingFileStatus"]');

  const hiddenNew = document.createElement("input");
  hiddenNew.type = "file";
  hiddenNew.accept = accept;
  hiddenNew.style.display = "none";
  const hiddenExisting = document.createElement("input");
  hiddenExisting.type = "file";
  hiddenExisting.accept = accept;
  hiddenExisting.style.display = "none";
  form.append(hiddenNew, hiddenExisting);

  let newFile = { dataUrl: "", name: "" };
  let existingFile = { dataUrl: "", name: "" };
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

  const updateFileLabels = () => {
    newFileStatus.textContent = newFile.dataUrl ? `Selected: ${newFile.name}` : "No local file selected.";
    existingFileStatus.textContent = existingFile.dataUrl ? `Selected: ${existingFile.name}` : "No local file selected.";
  };
  updateFileLabels();

  root.querySelector('[data-action="choose-new"]').addEventListener("click", () => hiddenNew.click());
  root.querySelector('[data-action="choose-existing"]').addEventListener("click", () => hiddenExisting.click());

  hiddenNew.addEventListener("change", async () => {
    const file = hiddenNew.files?.[0];
    hiddenNew.value = "";
    if (!file) return;
    try { newFile = { dataUrl: await readFileAsDataUrl(file), name: file.name }; } catch (e) { newFile = { dataUrl: "", name: "" }; setStatus(e?.message || String(e)); }
    updateFileLabels();
  });

  hiddenExisting.addEventListener("change", async () => {
    const file = hiddenExisting.files?.[0];
    hiddenExisting.value = "";
    if (!file) return;
    try {
      existingFile = { dataUrl: await readFileAsDataUrl(file), name: file.name };
      existingSourceEl.value = file.name;
      existingSourceEl.dataset.localFile = "true";
    } catch (e) {
      existingFile = { dataUrl: "", name: "" };
      delete existingSourceEl.dataset.localFile;
      setStatus(e?.message || String(e));
    }
    updateFileLabels();
  });

  existingSourceEl.addEventListener("input", () => {
    if (existingSourceEl.dataset.localFile === "true" && existingSourceEl.value !== existingFile.name) {
      existingFile = { dataUrl: "", name: "" };
      delete existingSourceEl.dataset.localFile;
      updateFileLabels();
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
      const defaultDir = joinNotebookPath(baseDir, dirName);
      let src = "", linked = "";

      if (sourceMode === "new") {
        if (!newFile.dataUrl) throw new Error(`Choose a local ${kind.toLowerCase()} file.`);
        if (storageMode === "inline") {
          src = newFile.dataUrl;
        } else {
          const fmt = String(formatEl.value || defaultExt).trim().toLowerCase() || defaultExt;
          const entered = String(newNameEl.value || "").trim();
          const fileName = ensureExt(entered, fmt) || newFile.name || `${kind.toLowerCase()}-${Date.now()}.${fmt}`;
          const notebookPath = normalizeNotebookPath(joinNotebookPath(defaultDir, fileName));
          await saveNotebookBinaryFromDataUrl(notebookPath, newFile.dataUrl, mimeFromExt(fmt));
          src = notebookSourceFromPath(notebookPath, editorPath);
          linked = notebookPath;
        }
      } else {
        const entered = String(existingSourceEl.value || "").trim();
        const localSelected = Boolean(existingFile.dataUrl && existingSourceEl.dataset.localFile === "true");
        if (!entered && !localSelected) throw new Error("Enter an existing source or choose a local file.");

        if (storageMode === "inline") {
          if (localSelected) {
            src = existingFile.dataUrl;
          } else {
            const url = looksLikeUrlOrAbsPath(entered) ? entered : notebookHrefFromPath(normalizeNotebookPath(entered));
            src = await fetchUrlAsDataUrl(url);
          }
        } else if (localSelected) {
          const asNotebook = entered.replace(/^\/+/, "").toLowerCase().startsWith("notebook/");
          if (looksLikeUrlOrAbsPath(entered) && !asNotebook) {
            throw new Error("For referenced local files, enter a Notebook destination path.");
          }
          const notebookPath = normalizeNotebookPath(entered) || normalizeNotebookPath(joinNotebookPath(defaultDir, existingFile.name || `${kind.toLowerCase()}-${Date.now()}.${defaultExt}`));
          await saveNotebookBinaryFromDataUrl(notebookPath, existingFile.dataUrl, mimeFromExt(defaultExt));
          src = notebookSourceFromPath(notebookPath, editorPath);
          linked = notebookPath;
        } else {
          if (looksLikeUrlOrAbsPath(entered)) {
            src = entered;
          } else {
            const notebookPath = normalizeNotebookPath(entered);
            src = notebookSourceFromPath(notebookPath, editorPath);
            linked = notebookPath;
          }
        }
      }

      const linkedAttr = linked ? ` data-nv-linked-path="${escapeHtml(linked)}"` : "";
      const styleAttr = elementStyle ? ` style="${escapeHtml(elementStyle)}"` : "";
      insertHtmlAtCaret(`<${tag} controls${styleAttr} src="${escapeHtml(src)}"${linkedAttr}></${tag}>`);
      setStatus("Inserted.");
    } catch (err) {
      console.warn("[insertMediaBinaryAv]", err);
      setStatus(err?.message || String(err));
    }
  });
}
