// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/GerberFamilyEditor.mjs
// Graphical editor for Gerber RS-274X and Excellon drill files.

import { createGerberCanvasView } from "/Gerber/GerberCanvasRenderer.mjs";
import { createStarterBoardSource, formatBoardSummary, parseBoardFile } from "/Gerber/GerberParser.mjs";
import {
  ensureNodevisionState,
  fetchText,
  resetEditorHooks,
  saveText,
} from "./FamilyEditorCommon.mjs";

function button(label, title, onClick) {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = label;
  element.title = title;
  element.style.cssText = [
    "height:30px",
    "min-width:34px",
    "padding:0 10px",
    "border:1px solid rgba(58,64,67,0.22)",
    "border-radius:6px",
    "background:#ffffff",
    "color:#202124",
    "font:12px/1 ui-sans-serif, system-ui, sans-serif",
    "cursor:pointer",
  ].join(";");
  element.addEventListener("click", onClick);
  return element;
}

function setStatus(node, text, tone = "neutral") {
  node.textContent = text;
  node.dataset.tone = tone;
  node.style.color = tone === "error" ? "#9c1c1c" : tone === "saved" ? "#1c6b3f" : "#4c5550";
}

function renderDiagnostics(host, diagnostics) {
  host.innerHTML = "";
  const items = diagnostics || [];
  if (!items.length) {
    const empty = document.createElement("div");
    empty.textContent = "No diagnostics";
    empty.style.color = "#5f6b63";
    host.appendChild(empty);
    return;
  }

  items.slice(0, 12).forEach((item) => {
    const row = document.createElement("div");
    row.style.cssText = [
      "display:flex",
      "gap:6px",
      "align-items:flex-start",
      "padding:3px 0",
      "border-bottom:1px solid rgba(60,64,67,0.08)",
    ].join(";");
    const badge = document.createElement("span");
    badge.textContent = item.severity || "info";
    badge.style.cssText = [
      "flex:0 0 auto",
      "min-width:48px",
      "color:#1f6f8f",
      "font-weight:650",
    ].join(";");
    const text = document.createElement("span");
    text.textContent = `${item.line ? `line ${item.line}: ` : ""}${item.message}`;
    row.append(badge, text);
    host.appendChild(row);
  });

  if (items.length > 12) {
    const more = document.createElement("div");
    more.textContent = `+${items.length - 12} more`;
    more.style.cssText = "padding-top:4px;color:#5f6b63;";
    host.appendChild(more);
  }
}

function shapeText(shape) {
  if (!shape) return "No selection";
  const line = shape.line ? `line ${shape.line}` : "source";
  if (shape.type === "segment") return `Trace ${line} (${shape.x1}, ${shape.y1}) -> (${shape.x2}, ${shape.y2})`;
  if (shape.type === "arc") return `Arc ${line} (${shape.x1}, ${shape.y1}) -> (${shape.x2}, ${shape.y2})`;
  if (shape.type === "flash") return `Flash ${line} (${shape.x}, ${shape.y})`;
  if (shape.type === "drill") return `Drill ${line} ${shape.tool || "tool"} (${shape.x}, ${shape.y})`;
  if (shape.type === "slot") return `Slot ${line} ${shape.tool || "tool"}`;
  if (shape.type === "region") return `Region ${line} ${shape.points?.length || 0} points`;
  return `${shape.type || "Shape"} ${line}`;
}

function statRows(model) {
  const stats = model?.stats || {};
  const bounds = model?.bounds || {};
  const rows = [
    ["Kind", model?.kind || ""],
    ["Units", model?.units || ""],
    ["Bounds", bounds.empty ? "empty" : `${bounds.width.toFixed(4)} x ${bounds.height.toFixed(4)}`],
    ["Traces", stats.segments || 0],
    ["Arcs", stats.arcs || 0],
    ["Flashes", stats.flashes || 0],
    ["Regions", stats.regions || 0],
    ["Drills", stats.drills || 0],
    ["Slots", stats.slots || 0],
  ];

  if (stats.apertures !== undefined) rows.push(["Apertures", stats.apertures]);
  if (stats.tools !== undefined) rows.push(["Tools", stats.tools]);
  return rows;
}

function renderStats(host, model) {
  host.innerHTML = "";
  const table = document.createElement("table");
  table.style.cssText = "border-collapse:collapse;width:100%;font:12px/1.35 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;";

  statRows(model).forEach(([label, value]) => {
    const row = document.createElement("tr");
    const key = document.createElement("td");
    key.textContent = label;
    key.style.cssText = "padding:3px 8px 3px 0;color:#5f6b63;white-space:nowrap;";
    const val = document.createElement("td");
    val.textContent = String(value);
    val.style.cssText = "padding:3px 0;color:#202124;";
    row.append(key, val);
    table.appendChild(row);
  });

  host.appendChild(table);
}

function dispatchSaved(filePath) {
  window.dispatchEvent(new CustomEvent("nodevision-file-saved", {
    detail: { filePath },
  }));
}

export async function renderEditor(filePath, container) {
  resetEditorHooks();
  ensureNodevisionState("GerberEditing");

  container.innerHTML = "";
  container.style.alignItems = "stretch";
  container.style.justifyContent = "stretch";

  const root = document.createElement("div");
  root.style.cssText = [
    "width:100%",
    "height:100%",
    "min-height:360px",
    "display:flex",
    "flex-direction:column",
    "background:#f0f2f0",
    "color:#202124",
    "font:12px/1.4 ui-sans-serif, system-ui, sans-serif",
    "overflow:hidden",
  ].join(";");

  const toolbar = document.createElement("div");
  toolbar.style.cssText = [
    "display:flex",
    "align-items:center",
    "gap:8px",
    "padding:8px",
    "border-bottom:1px solid rgba(60,64,67,0.18)",
    "background:#f9faf7",
    "flex:0 0 auto",
  ].join(";");

  const title = document.createElement("div");
  title.textContent = filePath;
  title.style.cssText = "font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:140px;max-width:34%;";

  const status = document.createElement("div");
  status.style.cssText = "flex:1;color:#4c5550;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
  status.textContent = "Loading";

  const workbench = document.createElement("div");
  workbench.style.cssText = [
    "flex:1",
    "min-height:0",
    "display:grid",
    "grid-template-columns:minmax(320px,1.15fr) minmax(300px,0.85fr)",
    "gap:0",
    "overflow:hidden",
  ].join(";");

  const previewColumn = document.createElement("div");
  previewColumn.style.cssText = "display:flex;flex-direction:column;min-width:0;min-height:0;border-right:1px solid rgba(60,64,67,0.18);";

  const canvasHost = document.createElement("div");
  canvasHost.style.cssText = "position:relative;flex:1;min-height:220px;overflow:hidden;";

  const previewFooter = document.createElement("div");
  previewFooter.style.cssText = [
    "display:grid",
    "grid-template-columns:1fr 1fr",
    "gap:12px",
    "padding:8px",
    "border-top:1px solid rgba(60,64,67,0.18)",
    "background:#f9faf7",
    "min-height:92px",
    "overflow:auto",
  ].join(";");

  const statsHost = document.createElement("div");
  const selectionHost = document.createElement("div");
  selectionHost.textContent = "No selection";
  previewFooter.append(statsHost, selectionHost);
  previewColumn.append(canvasHost, previewFooter);

  const sourceColumn = document.createElement("div");
  sourceColumn.style.cssText = "display:flex;flex-direction:column;min-width:0;min-height:0;background:#ffffff;";

  const sourceHeader = document.createElement("div");
  sourceHeader.style.cssText = [
    "display:flex",
    "align-items:center",
    "justify-content:space-between",
    "gap:8px",
    "padding:8px 10px",
    "border-bottom:1px solid rgba(60,64,67,0.18)",
    "background:#ffffff",
  ].join(";");
  const sourceTitle = document.createElement("div");
  sourceTitle.textContent = "Source";
  sourceTitle.style.fontWeight = "650";
  const sourceMeta = document.createElement("div");
  sourceMeta.style.cssText = "color:#5f6b63;white-space:nowrap;";
  sourceHeader.append(sourceTitle, sourceMeta);

  const textarea = document.createElement("textarea");
  textarea.id = "gerber-source-editor";
  textarea.spellcheck = false;
  textarea.style.cssText = [
    "flex:1",
    "min-height:0",
    "width:100%",
    "resize:none",
    "box-sizing:border-box",
    "border:0",
    "outline:0",
    "padding:12px",
    "font:12px/1.45 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    "color:#151917",
    "background:#ffffff",
    "tab-size:2",
  ].join(";");

  const diagnosticsHost = document.createElement("div");
  diagnosticsHost.style.cssText = [
    "flex:0 0 116px",
    "overflow:auto",
    "padding:8px 10px",
    "border-top:1px solid rgba(60,64,67,0.18)",
    "background:#fbfbf9",
    "color:#202124",
  ].join(";");

  sourceColumn.append(sourceHeader, textarea, diagnosticsHost);
  workbench.append(previewColumn, sourceColumn);

  let renderer = null;
  let model = null;
  let dirty = false;
  let parseTimer = null;
  let starterButton = null;

  async function saveCurrent(path = filePath, { notify = false } = {}) {
    await saveText(path, textarea.value);
    dirty = false;
    setStatus(status, `Saved ${path}`, "saved");
    if (notify) dispatchSaved(path);
  }

  function parseAndRender() {
    try {
      model = parseBoardFile(textarea.value, filePath);
      sourceMeta.textContent = `${textarea.value.length.toLocaleString()} chars`;
      setStatus(status, (model.sourceEmpty ? "Empty source" : dirty ? "Unsaved" : "Loaded") + " | " + formatBoardSummary(model));
      if (starterButton) starterButton.hidden = !model.sourceEmpty;
      renderDiagnostics(diagnosticsHost, model.diagnostics);
      renderStats(statsHost, model);
      if (renderer) renderer.setModel(model);
      else renderer = createGerberCanvasView(canvasHost, model, { theme: "dark" });
    } catch (err) {
      setStatus(status, err?.message || String(err), "error");
      renderDiagnostics(diagnosticsHost, [{ severity: "error", message: err?.message || String(err) }]);
    }
  }

  function scheduleParse() {
    dirty = true;
    window.clearTimeout(parseTimer);
    parseTimer = window.setTimeout(parseAndRender, 180);
  }

  function applyStarterSource() {
    textarea.value = createStarterBoardSource(filePath);
    dirty = true;
    parseAndRender();
    textarea.focus();
  }

  starterButton = button("Starter", "Insert starter source", applyStarterSource);

  toolbar.append(
    title,
    status,
    button("Save", "Save board source", () => saveCurrent(filePath, { notify: true }).catch((err) => setStatus(status, err?.message || String(err), "error"))),
    starterButton,
    button("Fit", "Fit board to view", () => renderer?.fit()),
    button("-", "Zoom out", () => renderer?.zoomOut()),
    button("+", "Zoom in", () => renderer?.zoomIn()),
    button("Light", "Light canvas theme", () => renderer?.setTheme("light")),
    button("Dark", "Dark canvas theme", () => renderer?.setTheme("dark")),
  );

  root.append(toolbar, workbench);
  container.appendChild(root);

  canvasHost.addEventListener("nodevision:gerber-shape-selected", (event) => {
    selectionHost.textContent = shapeText(event.detail?.shape);
  });

  try {
    textarea.value = await fetchText(filePath);
    dirty = false;
    parseAndRender();
  } catch (err) {
    setStatus(status, `Load failed: ${err?.message || err}`, "error");
    textarea.value = "";
    renderDiagnostics(diagnosticsHost, [{ severity: "error", message: err?.message || String(err) }]);
  }

  textarea.addEventListener("input", scheduleParse);

  const saveHook = async (path = filePath) => saveCurrent(path, { notify: false });
  window.__nvMarkdownActivePath = filePath;
  window.__nvGerberActivePath = filePath;
  const getHook = () => textarea.value;
  window.getEditorMarkdown = getHook;
  window.saveMDFile = saveHook;
  window.saveWYSIWYGFile = saveHook;

  container.__nvActiveEditorCleanup = () => {
    window.clearTimeout(parseTimer);
    renderer?.destroy();
    if (window.__nvMarkdownActivePath === filePath) window.__nvMarkdownActivePath = undefined;
    if (window.__nvGerberActivePath === filePath) window.__nvGerberActivePath = undefined;
    if (window.saveMDFile === saveHook) window.saveMDFile = undefined;
    if (window.saveWYSIWYGFile === saveHook) window.saveWYSIWYGFile = undefined;
    if (window.getEditorMarkdown === getHook) window.getEditorMarkdown = undefined;
  };
}
