// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/USDeditor.mjs
// Source-first USD editor with a live scene preview.

import {
  resetEditorHooks,
  ensureNodevisionState,
  createBaseLayout,
  fetchArrayBuffer,
  saveText,
  saveBase64,
  fileExt,
} from "./FamilyEditorCommon.mjs";
import { updateToolbarState } from "/panels/createToolbar.mjs";
import { createUSDSceneViewer, DEFAULT_USDA_SCENE } from "/PanelInstances/ViewPanels/FileViewers/USDSceneRuntime.mjs";

const USD_TEXT_EXTS = new Set(["usd", "usda"]);
const textDecoder = new TextDecoder("utf-8", { fatal: false });

function isLikelyText(bytes) {
  const sample = bytes.slice(0, Math.min(bytes.length, 2048));
  if (!sample.length) return true;
  let suspicious = 0;
  for (const byte of sample) {
    if (byte === 0) return false;
    if (byte < 9 || (byte > 13 && byte < 32)) suspicious += 1;
  }
  return suspicious / sample.length < 0.08;
}

function setDirty(value, message = "") {
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.fileIsDirty = Boolean(value);
  updateToolbarState({ fileIsDirty: Boolean(value) });
  if (message) {
    window.dispatchEvent(new CustomEvent("nodevision-editor-dirty", {
      detail: { filePath: window.__nvMarkdownActivePath || "", message },
    }));
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read replacement file."));
    reader.readAsDataURL(file);
  });
}

function buildToolbar({ textarea, viewer, status, filePath }) {
  const bar = document.createElement("div");
  bar.style.cssText = "display:flex;gap:8px;align-items:center;flex-wrap:wrap;";

  const previewBtn = document.createElement("button");
  previewBtn.type = "button";
  previewBtn.textContent = "Reload Preview";
  previewBtn.style.cssText = "font:12px monospace;padding:6px 10px;border:1px solid #334155;background:#f8fafc;color:#111827;cursor:pointer;border-radius:5px;";
  previewBtn.addEventListener("click", () => {
    viewer.loadFromText(textarea.value);
    status.textContent = "Preview reloaded";
  });

  const sampleBtn = document.createElement("button");
  sampleBtn.type = "button";
  sampleBtn.textContent = "Sample Scene";
  sampleBtn.style.cssText = previewBtn.style.cssText;
  sampleBtn.addEventListener("click", () => {
    textarea.value = DEFAULT_USDA_SCENE;
    viewer.loadFromText(textarea.value);
    status.textContent = "Sample USD scene loaded";
    setDirty(true, "USD sample scene inserted");
  });

  const pathLabel = document.createElement("span");
  pathLabel.textContent = filePath;
  pathLabel.style.cssText = "min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#475569;font:12px monospace;";

  bar.append(previewBtn, sampleBtn, pathLabel);
  return bar;
}

function renderBinaryEditor({ filePath, bytes, body, status }) {
  body.style.cssText = "flex:1;min-height:0;overflow:auto;";

  const panel = document.createElement("section");
  panel.style.cssText = "display:flex;flex-direction:column;gap:10px;border:1px solid #cbd5e1;border-radius:8px;padding:12px;background:#f8fafc;color:#1f2933;font:13px/1.45 system-ui,sans-serif;";

  const summary = document.createElement("div");
  summary.textContent = `Binary USD file: ${bytes.length.toLocaleString()} bytes`;

  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".usd,.usda,.usdc";

  const replaceState = document.createElement("div");
  replaceState.style.cssText = "font:12px monospace;color:#475569;";
  replaceState.textContent = "No replacement file loaded.";

  panel.append(summary, input, replaceState);
  body.appendChild(panel);

  let replacementBase64 = "";
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    replacementBase64 = dataUrl.split(",")[1] || "";
    replaceState.textContent = `Ready to replace with ${file.name} (${file.size.toLocaleString()} bytes)`;
    status.textContent = "Replacement loaded. Use File -> Save to apply.";
    setDirty(true, "USD binary replacement loaded");
  });

  window.saveWYSIWYGFile = async (path = filePath) => {
    if (!replacementBase64) throw new Error("No replacement USD file selected.");
    await saveBase64(path, replacementBase64, "application/octet-stream");
    status.textContent = "Saved binary USD replacement";
    setDirty(false);
  };

  status.textContent = "Binary USD preview unavailable. Replacement editing is active.";
}

function renderTextEditor({ filePath, text, body, status }) {
  body.style.cssText = "flex:1;min-height:0;overflow:hidden;";

  const layout = document.createElement("section");
  layout.style.cssText = "height:100%;min-height:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr));gap:10px;";

  const sourceCol = document.createElement("div");
  sourceCol.style.cssText = "display:flex;flex-direction:column;min-height:0;gap:8px;";

  const previewCol = document.createElement("div");
  previewCol.style.cssText = "display:flex;min-width:0;min-height:0;position:relative;overflow:hidden;border:1px solid #2f3a48;border-radius:8px;";

  const textarea = document.createElement("textarea");
  textarea.id = "markdown-editor";
  textarea.value = text || DEFAULT_USDA_SCENE;
  textarea.spellcheck = false;
  textarea.style.cssText = [
    "flex:1",
    "min-height:0",
    "width:100%",
    "resize:none",
    "padding:12px",
    "box-sizing:border-box",
    "font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace",
    "border:1px solid #cbd5e1",
    "border-radius:8px",
    "background:#ffffff",
    "color:#111827",
  ].join(";");

  sourceCol.appendChild(textarea);
  layout.append(sourceCol, previewCol);
  body.appendChild(layout);

  const viewer = createUSDSceneViewer(previewCol, { minHeight: "320px", background: "#151a20" });
  sourceCol.insertBefore(buildToolbar({ textarea, viewer, status, filePath }), textarea);

  let previewTimer = 0;
  const schedulePreview = () => {
    window.clearTimeout(previewTimer);
    previewTimer = window.setTimeout(() => {
      viewer.loadFromText(textarea.value);
      status.textContent = "Preview updated";
    }, 260);
  };

  textarea.addEventListener("input", () => {
    setDirty(true, "USD source edited");
    schedulePreview();
  });

  window.__nvMarkdownActivePath = filePath;
  window.getEditorMarkdown = () => textarea.value;
  window.saveMDFile = async (path = filePath) => {
    await saveText(path, textarea.value);
    status.textContent = "USD source saved";
    setDirty(false);
  };

  body.closest?.(".panel-cell")?.setAttribute("data-current-file-path", filePath);
  body.__nvUsdEditorDispose = () => {
    window.clearTimeout(previewTimer);
    viewer.dispose();
  };
  viewer.loadFromText(textarea.value);
  status.textContent = "USD source loaded";
}

export async function renderEditor(filePath, container) {
  resetEditorHooks();
  ensureNodevisionState("USDediting");
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.activePanelType = "GraphicalEditor";
  window.NodevisionState.selectedFile = filePath;
  window.NodevisionState.activeEditorFilePath = filePath;
  window.currentActiveFilePath = filePath;
  window.filePath = filePath;
  window.__nvMarkdownActivePath = filePath;
  updateToolbarState({
    currentMode: "USDediting",
    activePanelType: "GraphicalEditor",
    selectedFile: filePath,
    activeEditorFilePath: filePath,
    activeActionHandler: null,
    fileIsDirty: false,
  });

  if (typeof container.__nvUsdEditorCleanup === "function") {
    try {
      container.__nvUsdEditorCleanup();
    } catch (err) {
      console.warn("[USDeditor] Previous editor cleanup failed:", err);
    }
  }
  container.__nvUsdEditorCleanup = null;

  const { status, body } = createBaseLayout(container, `USD Editor - ${filePath}`);

  try {
    const buffer = await fetchArrayBuffer(filePath);
    const bytes = new Uint8Array(buffer);
    const ext = fileExt(filePath);
    const canEditAsText = USD_TEXT_EXTS.has(ext) || isLikelyText(bytes);

    if (!canEditAsText) {
      renderBinaryEditor({ filePath, bytes, body, status });
      container.__nvActiveEditorCleanup = () => {
        if (window.__nvMarkdownActivePath === filePath) window.__nvMarkdownActivePath = "";
        container.__nvUsdEditorCleanup = null;
      };
      return;
    }

    renderTextEditor({ filePath, text: textDecoder.decode(bytes), body, status });
    container.__nvUsdEditorCleanup = () => {
      body.__nvUsdEditorDispose?.();
      if (window.__nvMarkdownActivePath === filePath) window.__nvMarkdownActivePath = "";
      container.__nvUsdEditorCleanup = null;
    };
    container.__nvActiveEditorCleanup = container.__nvUsdEditorCleanup;
  } catch (err) {
    body.innerHTML = `<div style="color:#b00020;font:13px monospace;">Failed to load USD file: ${err?.message || err}</div>`;
    status.textContent = "Load failed";
  }
}
