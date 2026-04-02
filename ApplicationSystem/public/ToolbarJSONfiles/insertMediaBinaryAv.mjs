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

function createSilentWavDataUrl(durationSec = 1, sampleRate = 8000) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = Math.max(1, Math.round(sampleRate * durationSec));
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (offset, str) => { for (let i = 0; i < str.length; i += 1) view.setUint8(offset + i, str.charCodeAt(i)); };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
  // data section already zeroed (silence)
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

export function renderBinaryAv(root, cfg) {
  const kind = String(cfg?.kind || "Media");
  const tag = String(cfg?.tagName || "video");
  const accept = String(cfg?.accept || "");
  const dirName = String(cfg?.defaultDirName || "media");
  const preferredExt = String(cfg?.preferredExt || "");
  const mimeFromExt = typeof cfg?.mimeFromExt === "function" ? cfg.mimeFromExt : (() => "application/octet-stream");
  const elementStyle = String(cfg?.elementStyle || "");
  const isSound = kind.toLowerCase() === "sound";

  const extensions = Array.from(new Set(cfg?.exts || [])).map((e) => String(e).toLowerCase()).filter(Boolean).sort((a, b) => a.localeCompare(b));
  const defaultExt = pickDefaultExt(extensions, preferredExt || extensions[0] || "");

  const newChooserLabel = isSound ? "Choose Directory..." : "Choose File...";
  const newChooserDefault = isSound ? "No directory selected. Using current file folder." : "No local file selected.";

  root.innerHTML = `<form style="display:flex;flex-direction:column;gap:10px;font:12px monospace;min-width:280px;max-width:540px;"><fieldset style="border:1px solid #c6c6c6;padding:8px;"><legend>${escapeHtml(kind)} Source</legend><label style="display:block;margin-bottom:6px;"><input type="radio" name="nv-source" value="new" checked> New ${escapeHtml(kind)}</label><label style="display:block;"><input type="radio" name="nv-source" value="existing"> Existing ${escapeHtml(kind)}</label></fieldset><fieldset style="border:1px solid #c6c6c6;padding:8px;"><legend>Storage Mode</legend><label style="display:block;margin-bottom:6px;"><input type="radio" name="nv-storage" value="referenced" checked> Referenced (src points to file path)</label><label style="display:block;"><input type="radio" name="nv-storage" value="inline"> Inline (embed as data URL)</label></fieldset><div data-section="new" style="display:flex;flex-direction:column;gap:8px;"><div style="display:flex;gap:8px;align-items:flex-end;"><button type="button" data-action="choose-new" style="font:12px monospace;padding:6px 10px;border:1px solid #333;background:#eee;cursor:pointer;">${escapeHtml(newChooserLabel)}</button><span data-field="newFileStatus" style="font-size:11px;color:#4b4b4b;">${escapeHtml(newChooserDefault)}</span></div><div data-section="new-ref" style="display:flex;flex-direction:column;gap:8px;"><label>New ${escapeHtml(kind)} Format<select data-field="format" style="display:block;width:100%;margin-top:4px;">${extensions.map((e) => `<option value="${escapeHtml(e)}"${e === defaultExt ? " selected" : ""}>${escapeHtml(e)}</option>`).join("")}</select></label><label>Destination File Name (optional)<input data-field="newName" type="text" placeholder="${escapeHtml(kind.toLowerCase())}.${escapeHtml(defaultExt)}" style="display:block;width:100%;margin-top:4px;" /></label></div></div><div data-section="existing" style="display:none;flex-direction:column;gap:8px;"><div style="display:flex;gap:8px;align-items:flex-end;"><label style="flex:1;">Existing Source (Notebook path or URL)<input data-field="existingSource" type="text" placeholder="${escapeHtml(dirName)}/example.${escapeHtml(defaultExt)} or https://..." style="display:block;width:100%;margin-top:4px;" /></label><button type="button" data-action="choose-existing" style="font:12px monospace;padding:6px 10px;border:1px solid #333;background:#eee;cursor:pointer;">Choose File...</button></div><div data-field="existingFileStatus" style="font-size:11px;color:#4b4b4b;">No local file selected.</div></div><div style="display:flex;gap:10px;justify-content:flex-end;"><button type="submit" style="font:12px monospace;padding:6px 10px;border:1px solid #333;background:#eee;cursor:pointer;">Insert</button></div><div data-field="status" style="font-size:11px;color:#b00;min-height:14px;"></div></form>`;

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
  const hiddenNewDir = document.createElement("input");
  hiddenNewDir.type = "file";
  hiddenNewDir.webkitdirectory = true;
  hiddenNewDir.directory = true;
  hiddenNewDir.style.display = "none";
  const hiddenExisting = document.createElement("input");
  hiddenExisting.type = "file";
  hiddenExisting.accept = accept;
  hiddenExisting.style.display = "none";
  form.append(hiddenNew, hiddenNewDir, hiddenExisting);

  let newFile = { dataUrl: "", name: "" };
  let existingFile = { dataUrl: "", name: "" };
  let newFileObj = null;
  let existingFileObj = null;
  let newFilePending = null;
  let existingFilePending = null;
  let newDirInput = "";
  const setStatus = (t) => { statusEl.textContent = String(t || ""); };
  const valueOf = (radios) => radios.find((r) => r.checked)?.value || "";
  const waitForPending = async (pending, label) => {
    if (!pending) return;
    setStatus(`Loading ${label}...`);
    try { await pending; } catch { /* handled in change listeners */ }
  };

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
    if (isSound) {
      newFileStatus.textContent = newDirInput
        ? `Directory: ${newDirInput}`
        : `${newChooserDefault}`;
    } else {
      newFileStatus.textContent = newFilePending
        ? `Loading: ${newFile.name || "..."}`
        : (newFile.dataUrl ? `Selected: ${newFile.name}` : "No local file selected.");
    }
    existingFileStatus.textContent = existingFilePending
      ? `Loading: ${existingFile.name || "..."}`
      : (existingFile.dataUrl ? `Selected: ${existingFile.name}` : "No local file selected.");
  };
  updateFileLabels();

  root.querySelector('[data-action="choose-new"]').addEventListener("click", () => {
    if (isSound) {
      hiddenNewDir.click();
    } else {
      hiddenNew.click();
    }
  });
  root.querySelector('[data-action="choose-existing"]').addEventListener("click", () => hiddenExisting.click());

  hiddenNew.addEventListener("change", async () => {
    const file = hiddenNew.files?.[0];
    hiddenNew.value = "";
    if (!file) return;
    newFile = { dataUrl: "", name: file.name };
    newFileObj = file;
    newFilePending = readFileAsDataUrl(file);
    updateFileLabels();
    try {
      const dataUrl = await newFilePending;
      newFile = { dataUrl, name: file.name };
    } catch (e) {
      newFile = { dataUrl: "", name: "" };
      newFileObj = null;
      setStatus(e?.message || String(e));
    } finally {
      newFilePending = null;
      updateFileLabels();
    }
  });

  hiddenExisting.addEventListener("change", async () => {
    const file = hiddenExisting.files?.[0];
    hiddenExisting.value = "";
    if (!file) return;
    existingFile = { dataUrl: "", name: file.name };
    existingFileObj = file;
    existingFilePending = readFileAsDataUrl(file);
    existingSourceEl.value = file.name;
    existingSourceEl.dataset.localFile = "true";
    try {
      const dataUrl = await existingFilePending;
      existingFile = { dataUrl, name: file.name };
    } catch (e) {
      existingFile = { dataUrl: "", name: "" };
      delete existingSourceEl.dataset.localFile;
      existingFileObj = null;
      setStatus(e?.message || String(e));
    } finally {
      existingFilePending = null;
      updateFileLabels();
    }
  });

  hiddenNewDir.addEventListener("change", () => {
    const first = hiddenNewDir.files?.[0];
    hiddenNewDir.value = "";
    if (!first) {
      newDirInput = "";
      updateFileLabels();
      return;
    }
        const rel = String(first.webkitRelativePath || first.name || "").split("/")[0] || "";
    newDirInput = rel;
    updateFileLabels();
  });

  existingSourceEl.addEventListener("input", () => {
    if (existingSourceEl.dataset.localFile === "true" && existingSourceEl.value !== existingFile.name) {
      existingFile = { dataUrl: "", name: "" };
      delete existingSourceEl.dataset.localFile;
      existingFileObj = null;
      existingFilePending = null;
      updateFileLabels();
    }
  });

  const ensureLocalReady = async (fileObj, fileState, setState, label, pendingRefSetter, pendingRef) => {
    if (fileState.dataUrl) return;
    if (!fileObj) throw new Error(`Choose a local ${kind.toLowerCase()} file.`);
    if (!pendingRefSetter || pendingRef) {
      // already pending; caller will wait separately
      return;
    }
    const p = readFileAsDataUrl(fileObj);
    pendingRefSetter(p);
    setStatus(`Loading ${label}...`);
    try {
      const dataUrl = await p;
      setState({ dataUrl, name: fileObj.name || "" });
    } finally {
      pendingRefSetter(null);
      updateFileLabels();
    }
  };

  form.addEventListener("submit", async (evt) => {
    evt.preventDefault();
    setStatus("");
    try {
      const sourceMode = valueOf(sourceEls());
      const storageMode = valueOf(storageEls());
      const editorPath = getActiveEditorNotebookPath();
      const baseDir = dirname(editorPath);
      const defaultDir = joinNotebookPath(baseDir, dirName);
      const normalizeDirInput = (v) => String(v || "").replace(/^\/+/, "").replace(/^Notebook\//i, "").replace(/\/+/g, "/");
      const soundDir = (() => {
        if (!isSound) return "";
        const chosen = normalizeDirInput(newDirInput);
        if (!chosen) return baseDir; // default: same folder as current HTML file
        return normalizeNotebookPath(joinNotebookPath(baseDir, chosen));
      })();
      const resolvedDir = isSound && soundDir ? soundDir : normalizeNotebookPath(defaultDir);
      let src = "", linked = "";
      const fmtSelected = String(formatEl?.value || defaultExt).trim().toLowerCase() || defaultExt;

      if (sourceMode === "new") {
        await waitForPending(newFilePending, `${kind.toLowerCase()} file`);
        if (newFileObj || newFilePending || newFile.dataUrl) {
          await ensureLocalReady(
            newFileObj,
            newFile,
            (v) => { newFile = v; },
            `${kind.toLowerCase()} file`,
            (p) => { newFilePending = p; },
            newFilePending
          );
        }
        let usedPlaceholder = false;
        if (!newFile.dataUrl) {
          if (kind.toLowerCase() !== "sound") {
            throw new Error(`Choose a local ${kind.toLowerCase()} file.`);
          }
          // Create a silent WAV placeholder when no local file is provided (Sound only).
          const fallbackBase = (newNameEl.value || `${kind.toLowerCase()}-${Date.now()}`).replace(/\.[^.]+$/, "");
          newFile = {
            dataUrl: createSilentWavDataUrl(),
            name: ensureExt(fallbackBase, fmtSelected),
          };
          usedPlaceholder = true;
        }
        if (storageMode === "inline") {
          src = newFile.dataUrl;
        } else {
          const fmt = fmtSelected;
          const entered = String(newNameEl.value || "").trim();
          const baseName = entered ? entered.replace(/\.[^.]+$/, "") : "";
          const fileName = ensureExt(baseName, fmt) || newFile.name || `${kind.toLowerCase()}-${Date.now()}.${fmt}`;
          const notebookPath = normalizeNotebookPath(joinNotebookPath(resolvedDir, fileName));
          const mime = newFile.dataUrl.match(/^data:([^;]+);/i)?.[1] || mimeFromExt(fmt);
          await saveNotebookBinaryFromDataUrl(notebookPath, newFile.dataUrl, mime);
          src = notebookSourceFromPath(notebookPath, editorPath);
          linked = notebookPath;
        }
      } else {
        const entered = String(existingSourceEl.value || "").trim();
        if (existingFilePending && existingSourceEl.dataset.localFile === "true") {
          await waitForPending(existingFilePending, `${kind.toLowerCase()} file`);
        }
        if (existingSourceEl.dataset.localFile === "true") {
          await ensureLocalReady(
            existingFileObj,
            existingFile,
            (v) => { existingFile = v; },
            `${kind.toLowerCase()} file`,
            (p) => { existingFilePending = p; },
            existingFilePending
          );
        }
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
      try {
        // Update managers so the new media shows up immediately.
        if (linked) {
          const dir = dirname(linked);
          if (typeof window.refreshFileManager === "function") {
            window.refreshFileManager(dir);
          }
          document.dispatchEvent(new CustomEvent("refreshFileManager", { detail: { path: dir } }));
          if (typeof window.refreshGraphManager === "function") {
            window.refreshGraphManager({ fit: false, reason: "insert-media" });
          }
          document.dispatchEvent(new CustomEvent("refreshGraphManager", { detail: { path: dir, reason: "insert-media" } }));
        }
      } catch (notifyErr) {
        console.warn("[insertMediaBinaryAv] refresh after insert failed", notifyErr);
      }
      setStatus("Inserted.");
    } catch (err) {
      console.warn("[insertMediaBinaryAv]", err);
      setStatus(err?.message || String(err));
    }
  });
}
