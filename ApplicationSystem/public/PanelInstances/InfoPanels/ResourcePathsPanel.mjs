// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/ResourcePathsPanel.mjs
// This panel edits Notebook-relative Resource Paths through the shared Resource Paths API.

import { browseResourceDirectories, loadResourcePaths, saveResourcePaths } from "/ResourcePaths/ResourcePathsClient.mjs";

const STYLE_ID = "nv-resource-paths-style";

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
.nv-resource-paths { display:grid; gap:12px; min-width:min(820px, calc(100vw - 40px)); color:#20252b; font:14px Arial, sans-serif; }
.nv-resource-paths__head { display:flex; justify-content:space-between; gap:10px; align-items:center; }
.nv-resource-paths h2 { margin:0; font-size:18px; }
.nv-resource-paths__text { margin:0; color:#51606d; max-width:78ch; }
.nv-resource-paths__table { width:100%; border-collapse:collapse; table-layout:fixed; }
.nv-resource-paths__table th { text-align:left; font-size:12px; color:#4c5865; border-bottom:1px solid #d6dde5; padding:6px; }
.nv-resource-paths__table td { border-bottom:1px solid #edf1f5; padding:6px; vertical-align:middle; }
.nv-resource-paths input { width:100%; box-sizing:border-box; padding:7px; border:1px solid #b8c4d0; border-radius:6px; font:13px ui-monospace, monospace; }
.nv-resource-paths input[readonly] { background:#f5f7f9; color:#5e6872; }
.nv-resource-paths__status { font-size:12px; white-space:nowrap; }
.nv-resource-paths__status[data-kind="missing"] { color:#8a4d00; }
.nv-resource-paths__status[data-kind="ready"] { color:#176f2d; }
.nv-resource-paths__actions { display:flex; flex-wrap:wrap; gap:8px; justify-content:flex-end; }
.nv-resource-paths button { border:1px solid #94a3b2; border-radius:6px; padding:7px 10px; background:#f8fafc; cursor:pointer; }
.nv-resource-paths button[data-primary] { background:#263747; color:#fff; border-color:#263747; }
.nv-resource-paths button:disabled { opacity:.55; cursor:not-allowed; }
.nv-resource-paths__browser { border:1px solid #d6dde5; border-radius:8px; padding:8px; background:#fbfcfd; }
.nv-resource-paths__browser-list { display:flex; flex-wrap:wrap; gap:6px; margin-top:6px; }
.nv-resource-paths__message { min-height:20px; font-weight:700; color:#30475e; }
`;
  document.head.appendChild(style);
}

function el(tag, text = "", className = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function blankCustom() {
  return { key: "", name: "", path: "Resources/", builtIn: false, protected: false, exists: false, isDirectory: false };
}

function serializeRows(body) {
  return [...body.querySelectorAll("tr")].map((row) => ({
    key: row.querySelector('[name="key"]').value,
    name: row.querySelector('[name="name"]').value,
    path: row.querySelector('[name="path"]').value,
    builtIn: row.dataset.builtIn === "true",
  }));
}

function setMessage(root, text, error = false) {
  const message = root.querySelector("[data-message]");
  message.textContent = text || "";
  message.style.color = error ? "#b02a37" : "#30475e";
}

function renderRow(body, entry) {
  const tr = el("tr");
  tr.dataset.builtIn = String(Boolean(entry.builtIn));
  const cells = ["name", "key", "path", "status", "actions"].map(() => el("td"));
  const name = el("input");
  name.name = "name";
  name.value = entry.name || "";
  name.readOnly = Boolean(entry.builtIn);
  const key = el("input");
  key.name = "key";
  key.value = entry.key || "";
  key.readOnly = Boolean(entry.builtIn);
  const path = el("input");
  path.name = "path";
  path.value = entry.path || "";
  const label = entry.exists ? (entry.isDirectory ? "Ready" : "Not a directory") : "Missing";
  const status = el("span", label, "nv-resource-paths__status");
  status.dataset.kind = entry.exists && entry.isDirectory ? "ready" : "missing";
  const browse = el("button", "Browse");
  browse.type = "button";
  browse.dataset.action = "browse";
  const remove = el("button", "Remove");
  remove.type = "button";
  remove.disabled = Boolean(entry.builtIn);
  remove.addEventListener("click", () => tr.remove());
  cells[0].append(name);
  cells[1].append(key);
  cells[2].append(path);
  cells[3].append(status);
  cells[4].append(browse, remove);
  tr.append(...cells);
  body.append(tr);
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

export async function createPanel(content, panelVars = {}) {
  ensureStyles();
  const root = el("section", "", "nv-resource-paths");
  root.innerHTML = `
    <div class="nv-resource-paths__head"><h2>Resource Paths</h2><button type="button" data-action="close">Close</button></div>
    <p class="nv-resource-paths__text">Named Notebook-relative directories for reusable local resources.</p>
    <table class="nv-resource-paths__table"><thead><tr><th>Name</th><th>Key</th><th>Path</th><th>Status</th><th>Actions</th></tr></thead><tbody></tbody></table>
    <div class="nv-resource-paths__browser" data-browser hidden><strong>Notebook folders</strong><div class="nv-resource-paths__browser-list" data-browser-list></div></div>
    <div class="nv-resource-paths__actions"><button type="button" data-action="add">Add Custom</button><button type="button" data-action="cancel">Cancel</button><button type="button" data-primary data-action="save">Save</button></div>
    <div class="nv-resource-paths__message" data-message></div>`;
  content.replaceChildren(root);

  const body = root.querySelector("tbody");
  const reload = async () => {
    body.replaceChildren();
    for (const entry of await loadResourcePaths()) renderRow(body, entry);
  };

  root.addEventListener("click", async (event) => {
    const action = event.target?.dataset?.action;
    if (action === "close" || action === "cancel") panelVars.onCancel?.();
    if (action === "add") renderRow(body, blankCustom());
    if (action === "browse") {
      const input = event.target.closest("tr")?.querySelector('[name="path"]');
      if (input) showBrowser(root, input).catch((err) => setMessage(root, err.message, true));
    }
    if (action === "save") {
      try {
        await saveResourcePaths(serializeRows(body));
        setMessage(root, "Resource Paths saved.");
        await reload();
      } catch (err) {
        setMessage(root, err.message, true);
      }
    }
  });

  setMessage(root, "Loading Resource Paths...");
  await reload();
  setMessage(root, "");
}
