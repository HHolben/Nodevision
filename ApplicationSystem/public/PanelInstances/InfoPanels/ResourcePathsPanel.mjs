// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/ResourcePathsPanel.mjs
// Settings panel for typed Resource Registry sources.

import { browseResourceDirectories, loadResourceRegistry, saveResourceSources } from "/ResourcePaths/ResourcePathsClient.mjs";

const STYLE_ID = "nv-resource-paths-style";
const TYPE_ORDER = ["font", "dictionary", "faa.sectional", "material", "electronics.component"];

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
.nv-resource-paths { display:grid; gap:14px; min-width:min(980px, calc(100vw - 40px)); color:#1f2832; font:13px Arial, sans-serif; }
.nv-resource-paths__head { display:flex; justify-content:space-between; gap:10px; align-items:center; }
.nv-resource-paths h2 { margin:0; font-size:19px; }
.nv-resource-paths h3 { margin:0; font-size:15px; }
.nv-resource-paths__type { border-top:1px solid #d7dde5; padding-top:10px; display:grid; gap:8px; }
.nv-resource-paths__type-head { display:flex; align-items:center; justify-content:space-between; gap:10px; }
.nv-resource-paths__meta { color:#56616f; font-size:12px; }
.nv-resource-paths__table { width:100%; border-collapse:collapse; table-layout:fixed; }
.nv-resource-paths__table th { text-align:left; font-size:11px; color:#465361; border-bottom:1px solid #cfd7e1; padding:6px; }
.nv-resource-paths__table td { border-bottom:1px solid #edf1f5; padding:6px; vertical-align:middle; }
.nv-resource-paths__check { width:18px; height:18px; }
.nv-resource-paths input[type="text"] { width:100%; box-sizing:border-box; padding:6px; border:1px solid #b8c4d0; border-radius:5px; font:12px ui-monospace, monospace; }
.nv-resource-paths input[readonly] { background:#f4f6f8; color:#606b76; }
.nv-resource-paths__kind { font-size:12px; color:#344454; text-transform:capitalize; }
.nv-resource-paths__status { font-size:12px; white-space:nowrap; }
.nv-resource-paths__status[data-kind="disabled"] { color:#687380; }
.nv-resource-paths__status[data-kind="missing"] { color:#8a4d00; }
.nv-resource-paths__status[data-kind="ready"] { color:#176f2d; }
.nv-resource-paths__row-actions { display:flex; flex-wrap:wrap; gap:6px; justify-content:flex-end; }
.nv-resource-paths__actions { display:flex; flex-wrap:wrap; gap:8px; justify-content:flex-end; }
.nv-resource-paths button { border:1px solid #93a0ae; border-radius:5px; padding:6px 9px; background:#f7f9fb; cursor:pointer; font:12px Arial, sans-serif; }
.nv-resource-paths button[data-primary] { background:#243746; color:#fff; border-color:#243746; }
.nv-resource-paths button:disabled { opacity:.5; cursor:not-allowed; }
.nv-resource-paths__browser { border:1px solid #d7dde5; border-radius:7px; padding:8px; background:#fbfcfd; }
.nv-resource-paths__browser-list { display:flex; flex-wrap:wrap; gap:6px; margin-top:6px; }
.nv-resource-paths__message { min-height:18px; font-weight:700; color:#30475e; }
`;
  document.head.appendChild(style);
}

function el(tag, text = "", className = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function statusLabel(source) {
  if (source.enabled === false) return { label: "Disabled", kind: "disabled" };
  if (source.exists && source.isDirectory) return { label: "Ready", kind: "ready" };
  if (source.exists && !source.isDirectory) return { label: "Not a directory", kind: "missing" };
  return { label: "Missing", kind: "missing" };
}

function renumberRows(body) {
  const rows = [...body.querySelectorAll("tr")];
  rows.forEach((row, index) => {
    row.dataset.priority = String((rows.length - index - 1) * 100);
    row.querySelector("[data-action=up]").disabled = index === 0;
    row.querySelector("[data-action=down]").disabled = index === rows.length - 1;
  });
}

function sourceId(typeId) {
  return `${typeId}.notebook.user-${Date.now().toString(36)}`;
}

function blankNotebookSource(type) {
  return {
    id: sourceId(type.id),
    typeId: type.id,
    name: "Notebook Source",
    sourceType: "notebook",
    path: "Resources/",
    enabled: true,
    priority: 999,
    protected: false,
    removable: true,
    editable: true,
  };
}

function renderSourceRow(body, type, source) {
  const tr = el("tr");
  tr.dataset.sourceId = source.id;
  tr.dataset.sourceType = source.sourceType;
  tr.dataset.protected = String(Boolean(source.protected));
  tr.dataset.removable = String(source.removable !== false && !source.protected);
  tr.dataset.editable = String(source.editable !== false);
  tr.dataset.legacyPath = String(Boolean(source.legacyPath));
  tr.dataset.priority = String(Number(source.priority || 0));

  const enabledCell = el("td");
  const enabled = document.createElement("input");
  enabled.type = "checkbox";
  enabled.className = "nv-resource-paths__check";
  enabled.dataset.field = "enabled";
  enabled.checked = source.enabled !== false;
  enabledCell.append(enabled);

  const nameCell = el("td");
  const name = document.createElement("input");
  name.type = "text";
  name.dataset.field = "name";
  name.value = source.name || "";
  name.readOnly = Boolean(source.protected);
  nameCell.append(name);

  const kindCell = el("td", source.sourceType, "nv-resource-paths__kind");

  const pathCell = el("td");
  const sourcePath = document.createElement("input");
  sourcePath.type = "text";
  sourcePath.dataset.field = "path";
  sourcePath.value = source.path || "";
  sourcePath.readOnly = source.sourceType !== "notebook" || source.editable === false;
  pathCell.append(sourcePath);

  const statusCell = el("td");
  const status = statusLabel(source);
  const statusNode = el("span", status.label, "nv-resource-paths__status");
  statusNode.dataset.kind = status.kind;
  statusCell.append(statusNode);

  const actionCell = el("td", "", "nv-resource-paths__row-actions");
  const up = el("button", "Up");
  up.type = "button";
  up.dataset.action = "up";
  const down = el("button", "Down");
  down.type = "button";
  down.dataset.action = "down";
  const browse = el("button", "Browse");
  browse.type = "button";
  browse.dataset.action = "browse";
  browse.disabled = source.sourceType !== "notebook" || source.editable === false;
  const remove = el("button", "Remove");
  remove.type = "button";
  remove.dataset.action = "remove";
  remove.disabled = tr.dataset.removable !== "true";
  actionCell.append(up, down, browse, remove);

  tr.append(enabledCell, nameCell, kindCell, pathCell, statusCell, actionCell);
  body.append(tr);
  renumberRows(body);
}

function renderType(root, type) {
  const section = el("section", "", "nv-resource-paths__type");
  section.dataset.typeId = type.id;
  section.innerHTML = `
    <div class="nv-resource-paths__type-head">
      <div><h3></h3><div class="nv-resource-paths__meta"></div></div>
      <button type="button" data-action="add-source">Add Notebook Location</button>
    </div>
    <table class="nv-resource-paths__table">
      <thead><tr><th style="width:54px;">On</th><th>Name</th><th style="width:92px;">Type</th><th>Path</th><th style="width:112px;">Status</th><th style="width:240px;">Actions</th></tr></thead>
      <tbody></tbody>
    </table>`;
  section.querySelector("h3").textContent = type.displayName;
  section.querySelector(".nv-resource-paths__meta").textContent = `${type.resolutionStrategy} precedence, higher rows override lower rows`;
  const body = section.querySelector("tbody");
  for (const source of type.sources || []) renderSourceRow(body, type, source);
  root.append(section);
}

function serializeType(section) {
  const rows = [...section.querySelectorAll("tbody tr")];
  return rows.map((row, index) => ({
    id: row.dataset.sourceId,
    name: row.querySelector("[data-field=name]").value,
    sourceType: row.dataset.sourceType,
    path: row.querySelector("[data-field=path]").value,
    enabled: row.querySelector("[data-field=enabled]").checked,
    priority: (rows.length - index - 1) * 100,
    protected: row.dataset.protected === "true",
    removable: row.dataset.removable === "true",
    editable: row.dataset.editable === "true",
    legacyPath: row.dataset.legacyPath === "true",
  }));
}

function setMessage(root, text, error = false) {
  const message = root.querySelector("[data-message]");
  message.textContent = text || "";
  message.style.color = error ? "#b02a37" : "#30475e";
}

async function showBrowser(root, targetInput) {
  const browser = root.querySelector("[data-browser]");
  const list = root.querySelector("[data-browser-list]");
  const current = targetInput.value || "";
  browser.hidden = false;
  list.replaceChildren(el("span", "Loading directories..."));
  const data = await browseResourceDirectories(current);
  const upPath = (data.path || "").split("/").slice(0, -1).join("/");
  list.replaceChildren();
  const items = [{ name: "Use This Folder", path: data.path }, { name: "Up", path: upPath }, ...(data.directories || [])];
  for (const item of items) {
    const button = el("button", item.name || "Notebook");
    button.type = "button";
    button.addEventListener("click", () => {
      targetInput.value = item.path || "";
      if (item.name !== "Use This Folder") showBrowser(root, targetInput).catch((err) => setMessage(root, err.message, true));
    });
    list.append(button);
  }
}

function sortedTypes(types) {
  return [...(types || [])].sort((a, b) => TYPE_ORDER.indexOf(a.id) - TYPE_ORDER.indexOf(b.id));
}

export async function createPanel(content, panelVars = {}) {
  ensureStyles();
  const root = el("section", "", "nv-resource-paths");
  root.innerHTML = `
    <div class="nv-resource-paths__head"><h2>Resources</h2><button type="button" data-action="close">Close</button></div>
    <div data-types></div>
    <div class="nv-resource-paths__browser" data-browser hidden><strong>Notebook folders</strong><div class="nv-resource-paths__browser-list" data-browser-list></div></div>
    <div class="nv-resource-paths__actions"><button type="button" data-action="cancel">Cancel</button><button type="button" data-primary data-action="save">Save</button></div>
    <div class="nv-resource-paths__message" data-message></div>`;
  content.replaceChildren(root);

  async function reload() {
    const container = root.querySelector("[data-types]");
    container.replaceChildren();
    const payload = await loadResourceRegistry();
    for (const type of sortedTypes(payload.types || [])) renderType(container, type);
  }

  root.addEventListener("click", async (event) => {
    const target = event.target?.closest?.("[data-action]");
    const action = target?.dataset?.action || "";
    if (!action) return;
    if (action === "close" || action === "cancel") panelVars.onCancel?.();
    if (action === "add-source") {
      const section = target.closest("[data-type-id]");
      const type = { id: section.dataset.typeId };
      const body = section.querySelector("tbody");
      renderSourceRow(body, type, blankNotebookSource(type));
      const row = body.lastElementChild;
      body.insertBefore(row, body.firstElementChild);
      renumberRows(body);
    }
    if (action === "remove") {
      const row = target.closest("tr");
      if (row?.dataset?.removable === "true") {
        const body = row.parentElement;
        row.remove();
        renumberRows(body);
      }
    }
    if (action === "up" || action === "down") {
      const row = target.closest("tr");
      const body = row?.parentElement;
      if (!row || !body) return;
      if (action === "up" && row.previousElementSibling) body.insertBefore(row, row.previousElementSibling);
      if (action === "down" && row.nextElementSibling) body.insertBefore(row.nextElementSibling, row);
      renumberRows(body);
    }
    if (action === "browse") {
      const input = target.closest("tr")?.querySelector("[data-field=path]");
      if (input) showBrowser(root, input).catch((err) => setMessage(root, err.message, true));
    }
    if (action === "save") {
      try {
        const sections = [...root.querySelectorAll("[data-type-id]")];
        for (const section of sections) await saveResourceSources(section.dataset.typeId, serializeType(section));
        setMessage(root, "Resources saved.");
        await reload();
      } catch (err) {
        setMessage(root, err?.message || String(err), true);
      }
    }
  });

  setMessage(root, "Loading Resources...");
  await reload();
  setMessage(root, "");
}
