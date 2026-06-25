// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/jsonTreeRenderer.mjs
// Shared top-down JSON tree renderer used by the JSON viewer and graphical editor.

const STYLE_ID = "nv-json-tree-styles";

export function parseJsonText(text = "", filePath = "") {
  const source = String(text || "");
  if (!source.trim()) return {};
  try {
    return JSON.parse(source);
  } catch (err) {
    const lower = String(filePath || "").toLowerCase();
    const isJsonLines = lower.endsWith(".jsonl") || lower.endsWith(".ndjson");
    if (!isJsonLines) throw err;
    return source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        try {
          return JSON.parse(line);
        } catch (lineErr) {
          throw new Error(`Line ${index + 1}: ${lineErr.message}`);
        }
      });
  }
}

export function formatJsonText(value) {
  return JSON.stringify(value, null, 2);
}

export function cloneJsonValue(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .nv-json-tree-shell { width:100%; min-height:100%; box-sizing:border-box; padding:16px; overflow:auto; background:#f8fafc; color:#111827; font:13px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    .nv-json-tree { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; align-items:center; gap:12px; min-width:max-content; }
    .nv-json-tree ul { list-style:none; margin:0; padding:22px 0 0; display:flex; justify-content:center; align-items:flex-start; gap:16px; position:relative; }
    .nv-json-tree ul::before { content:""; position:absolute; top:0; left:50%; width:1px; height:22px; background:#94a3b8; }
    .nv-json-tree li { display:flex; flex-direction:column; align-items:center; position:relative; }
    .nv-json-tree li::before { content:""; position:absolute; top:-22px; left:50%; width:1px; height:22px; background:#94a3b8; }
    .nv-json-tree > li::before { display:none; }
    .nv-json-tree-card { min-width:150px; max-width:280px; border:1px solid #cbd5e1; border-radius:8px; background:#fff; box-shadow:0 1px 3px rgba(15,23,42,0.12); overflow:hidden; }
    .nv-json-tree-card.nv-root { min-width:220px; border-color:#2563eb; box-shadow:0 4px 14px rgba(37,99,235,0.18); }
    .nv-json-tree-head { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:7px 9px; background:#eef2ff; border-bottom:1px solid #dbe3f0; }
    .nv-json-tree-card:not(.nv-root) .nv-json-tree-head { background:#f1f5f9; }
    .nv-json-tree-name { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:700; }
    .nv-json-tree-type { flex:0 0 auto; color:#475569; font-size:11px; border:1px solid #cbd5e1; border-radius:999px; padding:1px 6px; background:#fff; }
    .nv-json-tree-value { padding:8px 9px; color:#1f2937; word-break:break-word; white-space:pre-wrap; font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:12px; }
    .nv-json-tree-summary { color:#64748b; }
    .nv-json-tree-actions { display:flex; flex-wrap:wrap; gap:5px; padding:0 8px 8px; }
    .nv-json-tree-actions button { border:1px solid #94a3b8; background:#fff; color:#111827; border-radius:4px; padding:3px 7px; font-size:11px; cursor:pointer; }
    .nv-json-tree-actions button:hover { border-color:#2563eb; background:#eff6ff; }
    .nv-json-tree-empty { padding:18px; color:#64748b; }
    html[data-nv-theme="dark"] .nv-json-tree-shell { background:#0f172a; color:#f8fafc; }
    html[data-nv-theme="dark"] .nv-json-tree-card { background:#111827; border-color:#475569; }
    html[data-nv-theme="dark"] .nv-json-tree-head, html[data-nv-theme="dark"] .nv-json-tree-card:not(.nv-root) .nv-json-tree-head { background:#1f2937; border-bottom-color:#374151; }
    html[data-nv-theme="dark"] .nv-json-tree-value { color:#e5e7eb; }
    html[data-nv-theme="dark"] .nv-json-tree-type, html[data-nv-theme="dark"] .nv-json-tree-actions button { background:#020617; color:#f8fafc; border-color:#475569; }
  `;
  document.head.appendChild(style);
}

function valueType(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

function childEntries(value) {
  if (Array.isArray(value)) return value.map((item, index) => [String(index), item, index]);
  if (value && typeof value === "object") return Object.entries(value).map(([key, item]) => [key, item, key]);
  return [];
}

function summarize(value) {
  const type = valueType(value);
  if (type === "array") return `${value.length} item${value.length === 1 ? "" : "s"}`;
  if (type === "object") {
    const count = Object.keys(value).length;
    return `${count} propert${count === 1 ? "y" : "ies"}`;
  }
  if (type === "string") return JSON.stringify(value);
  if (type === "undefined") return "undefined";
  return String(value);
}

function pathLabel(path, filePath) {
  return path.length ? String(path[path.length - 1]) : (String(filePath || "JSON file").split("/").pop() || "JSON file");
}

function getAtPath(root, path) {
  let cursor = root;
  for (const part of path) cursor = cursor?.[part];
  return cursor;
}

function setAtPath(root, path, value) {
  if (!path.length) return value;
  const clone = cloneJsonValue(root);
  let parent = clone;
  for (let i = 0; i < path.length - 1; i += 1) parent = parent[path[i]];
  parent[path[path.length - 1]] = value;
  return clone;
}

function deleteAtPath(root, path) {
  if (!path.length) return root;
  const clone = cloneJsonValue(root);
  let parent = clone;
  for (let i = 0; i < path.length - 1; i += 1) parent = parent[path[i]];
  const key = path[path.length - 1];
  if (Array.isArray(parent)) parent.splice(Number(key), 1);
  else delete parent[key];
  return clone;
}

function parsePromptValue(raw, fallback) {
  if (raw === null) return { cancelled: true, value: fallback };
  const text = String(raw);
  try {
    return { cancelled: false, value: JSON.parse(text) };
  } catch {
    return { cancelled: false, value: text };
  }
}

function editValue(current) {
  const raw = window.prompt("JSON value", formatJsonText(current));
  return parsePromptValue(raw, current);
}

function addChildValue(containerValue) {
  const type = valueType(containerValue);
  if (type !== "object" && type !== "array") return { cancelled: true };
  const key = type === "object" ? window.prompt("Property name", "newProperty") : null;
  if (type === "object" && !key) return { cancelled: true };
  const parsed = parsePromptValue(window.prompt("New JSON value", "null"), null);
  if (parsed.cancelled) return { cancelled: true };
  return { cancelled: false, key, value: parsed.value };
}

function makeButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function renderNode({ rootValue, path, filePath, editable, onChange }) {
  const value = getAtPath(rootValue, path);
  const type = valueType(value);
  const entries = childEntries(value);
  const li = document.createElement("li");

  const card = document.createElement("div");
  card.className = `nv-json-tree-card${path.length ? "" : " nv-root"}`;

  const head = document.createElement("div");
  head.className = "nv-json-tree-head";
  const name = document.createElement("div");
  name.className = "nv-json-tree-name";
  name.title = path.length ? path.join(".") : filePath;
  name.textContent = pathLabel(path, filePath);
  const badge = document.createElement("div");
  badge.className = "nv-json-tree-type";
  badge.textContent = path.length ? type : `file/${type}`;
  head.append(name, badge);
  card.appendChild(head);

  const valueEl = document.createElement("div");
  valueEl.className = entries.length ? "nv-json-tree-value nv-json-tree-summary" : "nv-json-tree-value";
  valueEl.textContent = entries.length ? summarize(value) : summarize(value);
  card.appendChild(valueEl);

  if (editable) {
    const actions = document.createElement("div");
    actions.className = "nv-json-tree-actions";
    actions.appendChild(makeButton(path.length ? "Edit" : "Edit root", () => {
      const next = editValue(value);
      if (!next.cancelled) onChange(setAtPath(rootValue, path, next.value));
    }));
    if (type === "object" || type === "array") {
      actions.appendChild(makeButton(type === "array" ? "Add item" : "Add property", () => {
        const next = addChildValue(value);
        if (next.cancelled) return;
        const clone = cloneJsonValue(rootValue);
        const target = getAtPath(clone, path);
        if (Array.isArray(target)) target.push(next.value);
        else target[next.key] = next.value;
        onChange(clone);
      }));
    }
    if (path.length) {
      actions.appendChild(makeButton("Delete", () => {
        if (window.confirm("Delete this branch?")) onChange(deleteAtPath(rootValue, path));
      }));
    }
    card.appendChild(actions);
  }

  li.appendChild(card);
  if (entries.length) {
    const ul = document.createElement("ul");
    entries.forEach(([label, child, key]) => {
      ul.appendChild(renderNode({ rootValue, path: [...path, key], filePath, editable, onChange }));
    });
    li.appendChild(ul);
  }
  return li;
}

export function renderJsonTree(container, value, options = {}) {
  ensureStyles();
  const filePath = options.filePath || "JSON file";
  const editable = Boolean(options.editable);
  const onChange = typeof options.onChange === "function" ? options.onChange : () => {};
  container.innerHTML = "";

  const shell = document.createElement("div");
  shell.className = "nv-json-tree-shell";
  if (value === undefined) {
    const empty = document.createElement("div");
    empty.className = "nv-json-tree-empty";
    empty.textContent = "No JSON data.";
    shell.appendChild(empty);
    container.appendChild(shell);
    return;
  }

  const tree = document.createElement("ul");
  tree.className = "nv-json-tree";
  tree.appendChild(renderNode({ rootValue: value, path: [], filePath, editable, onChange }));
  shell.appendChild(tree);
  container.appendChild(shell);
}
