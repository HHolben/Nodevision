// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/ControlsPanel.mjs
// This InfoPanel renders the Settings Control Mappings reference by loading command rows from the reusable Controls metadata resolver and presenting them inside Nodevision's existing panel and overlay lifecycle.

import { loadControlsRows } from "/Controls/ControlsMetadata.mjs";

const STYLE_ID = "nv-controls-panel-style";

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
.nv-controls-panel{height:100%;min-height:0;display:flex;flex-direction:column;background:#fff;color:#1f2329;font:13px system-ui,sans-serif}
.nv-controls-panel-tools{display:flex;gap:8px;padding:10px;border-bottom:1px solid #dbe2ea;background:#f7f9fc}
.nv-controls-panel-tools input{flex:1;min-width:0;border:1px solid #aebaca;border-radius:5px;padding:7px 8px;font:inherit}
.nv-controls-panel-table-wrap{flex:1;min-height:0;overflow:auto}
.nv-controls-panel table{width:100%;border-collapse:collapse;font-size:12px}
.nv-controls-panel th,.nv-controls-panel td{padding:7px 9px;border-bottom:1px solid #edf1f5;text-align:left;vertical-align:top}
.nv-controls-panel th{position:sticky;top:0;z-index:1;background:#f1f5f9}
.nv-controls-panel code{font:11px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:#eef3f8;padding:1px 4px;border-radius:4px}
.nv-controls-panel-empty{padding:16px;color:#526173}
`;
  document.head.appendChild(style);
}

function text(value, fallback = "-") {
  const clean = String(value || "").trim();
  return clean || fallback;
}

function rowSearchText(row) {
  return [
    row.label,
    row.id,
    row.description,
    row.category,
    ...(row.shortcuts || []),
    ...(row.locations || []),
  ].map((part) => String(part || "")).join(" ").toLowerCase();
}

function cell(value, options = {}) {
  const td = document.createElement("td");
  if (options.code) {
    const code = document.createElement("code");
    code.textContent = text(value);
    td.appendChild(code);
  } else {
    td.textContent = text(value);
  }
  return td;
}

function renderRows(tbody, rows, query = "") {
  tbody.replaceChildren();
  const normalizedQuery = query.trim().toLowerCase();
  const visible = rows.filter((row) => !normalizedQuery || rowSearchText(row).includes(normalizedQuery));
  visible.forEach((row) => {
    const tr = document.createElement("tr");
    tr.append(
      cell(row.label),
      cell(row.id, { code: true }),
      cell((row.shortcuts || []).join(", ")),
      cell((row.locations || []).join("; ")),
      cell(row.description),
    );
    tbody.appendChild(tr);
  });
}

function createTable() {
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  ["Command", "ID / Callback", "Shortcut", "Toolbar Location", "Description"].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  const tbody = document.createElement("tbody");
  table.append(thead, tbody);
  return { table, tbody };
}

export async function createPanel(contentElem, panelVars = {}, panelRoot = null) {
  ensureStyles();
  const titleEl = panelRoot?.querySelector(".panel-title");
  if (titleEl) titleEl.textContent = panelVars.displayName || "Control Mappings";

  const wrapper = document.createElement("div");
  wrapper.className = "nv-controls-panel";
  const tools = document.createElement("div");
  tools.className = "nv-controls-panel-tools";
  const filter = document.createElement("input");
  filter.type = "search";
  filter.placeholder = "Filter commands";
  filter.setAttribute("aria-label", "Filter commands");
  tools.appendChild(filter);
  const tableWrap = document.createElement("div");
  tableWrap.className = "nv-controls-panel-table-wrap";
  const loading = document.createElement("div");
  loading.className = "nv-controls-panel-empty";
  loading.textContent = "Loading control mappings...";
  tableWrap.appendChild(loading);
  wrapper.append(tools, tableWrap);
  contentElem.replaceChildren(wrapper);

  try {
    const rows = await loadControlsRows();
    const { table, tbody } = createTable();
    tableWrap.replaceChildren(table);
    const render = () => renderRows(tbody, rows, filter.value);
    filter.addEventListener("input", render);
    render();
    requestAnimationFrame(() => filter.focus());
  } catch (err) {
    loading.textContent = err?.message || "Unable to load control mappings.";
  }
}