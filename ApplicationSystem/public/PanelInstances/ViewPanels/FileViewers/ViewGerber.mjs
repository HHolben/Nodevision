// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewGerber.mjs
// FileView module for Gerber RS-274X and Excellon drill previews.

import { createGerberCanvasView } from "/Gerber/GerberCanvasRenderer.mjs";
import { formatBoardSummary, parseBoardFile } from "/Gerber/GerberParser.mjs";

function notebookUrl(serverBase, path) {
  const encoded = String(path || "")
    .replace(/^\/+/, "")
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
  return `${serverBase}/${encoded}`;
}

function makeButton(label, title, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.title = title;
  button.style.cssText = [
    "height:28px",
    "min-width:32px",
    "padding:0 10px",
    "border:1px solid rgba(60,64,67,0.22)",
    "border-radius:6px",
    "background:#ffffff",
    "color:#202124",
    "font:12px/1 ui-sans-serif, system-ui, sans-serif",
    "cursor:pointer",
  ].join(";");
  button.addEventListener("click", onClick);
  return button;
}

function renderDiagnostics(host, model) {
  host.innerHTML = "";
  const diagnostics = model?.diagnostics || [];
  if (!diagnostics.length) {
    host.textContent = "No diagnostics";
    return;
  }

  const list = document.createElement("div");
  list.style.cssText = "display:flex;flex-direction:column;gap:4px;";
  diagnostics.slice(0, 8).forEach((item) => {
    const row = document.createElement("div");
    row.textContent = `${item.severity}${item.line ? `:${item.line}` : ""} ${item.message}`;
    list.appendChild(row);
  });
  if (diagnostics.length > 8) {
    const extra = document.createElement("div");
    extra.textContent = `+${diagnostics.length - 8} more`;
    list.appendChild(extra);
  }
  host.appendChild(list);
}

function describeShape(shape) {
  if (!shape) return "No selection";
  const line = shape.line ? `line ${shape.line}` : "source";
  if (shape.type === "segment") {
    return `Trace ${line}: (${shape.x1}, ${shape.y1}) -> (${shape.x2}, ${shape.y2})`;
  }
  if (shape.type === "arc") {
    return `Arc ${line}: (${shape.x1}, ${shape.y1}) -> (${shape.x2}, ${shape.y2})`;
  }
  if (shape.type === "flash") return `Flash ${line}: (${shape.x}, ${shape.y})`;
  if (shape.type === "drill") return `Drill ${line}: ${shape.tool || "tool"} at (${shape.x}, ${shape.y})`;
  if (shape.type === "slot") return `Slot ${line}: ${shape.tool || "tool"}`;
  if (shape.type === "region") return `Region ${line}: ${shape.points?.length || 0} points`;
  return `${shape.type || "Shape"} ${line}`;
}

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  viewPanel.innerHTML = "";

  const root = document.createElement("div");
  root.style.cssText = [
    "width:100%",
    "height:100%",
    "min-height:320px",
    "display:flex",
    "flex-direction:column",
    "background:#f0f2f0",
    "color:#202124",
    "font:12px/1.4 ui-sans-serif, system-ui, sans-serif",
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
  title.style.cssText = "font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:160px;";
  title.textContent = filename;

  const summary = document.createElement("div");
  summary.style.cssText = "color:#4c5550;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;";
  summary.textContent = "Loading";

  const canvasHost = document.createElement("div");
  canvasHost.style.cssText = "position:relative;flex:1;min-height:260px;overflow:hidden;";

  const footer = document.createElement("div");
  footer.style.cssText = [
    "display:grid",
    "grid-template-columns:minmax(180px,1fr) minmax(180px,1fr)",
    "gap:12px",
    "padding:8px",
    "border-top:1px solid rgba(60,64,67,0.18)",
    "background:#f9faf7",
    "color:#4c5550",
    "min-height:34px",
  ].join(";");

  const selection = document.createElement("div");
  selection.textContent = "No selection";
  const diagnostics = document.createElement("div");
  diagnostics.textContent = "Loading";
  footer.append(selection, diagnostics);

  root.append(toolbar, canvasHost, footer);
  viewPanel.appendChild(root);

  let renderer = null;
  toolbar.append(
    title,
    summary,
    makeButton("Fit", "Fit board to view", () => renderer?.fit()),
    makeButton("-", "Zoom out", () => renderer?.zoomOut()),
    makeButton("+", "Zoom in", () => renderer?.zoomIn()),
    makeButton("Light", "Light canvas theme", () => renderer?.setTheme("light")),
    makeButton("Dark", "Dark canvas theme", () => renderer?.setTheme("dark")),
  );

  try {
    const response = await fetch(notebookUrl(serverBase, filename), { cache: "no-store" });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const source = await response.text();
    const model = parseBoardFile(source, filename);

    summary.textContent = formatBoardSummary(model);
    renderDiagnostics(diagnostics, model);
    renderer = createGerberCanvasView(canvasHost, model, { theme: "dark" });
    canvasHost.addEventListener("nodevision:gerber-shape-selected", (event) => {
      selection.textContent = describeShape(event.detail?.shape);
    });
  } catch (err) {
    summary.textContent = "Load failed";
    diagnostics.textContent = err?.message || String(err);
    const failed = document.createElement("div");
    failed.style.cssText = "padding:16px;color:#9c1c1c;font:13px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;";
    failed.textContent = `Failed to render board file: ${err?.message || err}`;
    canvasHost.appendChild(failed);
    return false;
  }

  return true;
}
