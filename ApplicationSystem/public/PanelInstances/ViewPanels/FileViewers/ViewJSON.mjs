// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewJSON.mjs
// This file fetches JSON resources and renders them as an interactive Cytoscape tree.

const MAX_TREE_NODES = 2500;
const CYTOSCAPE_SCRIPT_SOURCES = [
  "/vendor/cytoscape/cytoscape.min.js",
  "/cytoscape-bundle.js"
];

let cytoscapeLoadPromise = null;

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  const url = `${serverBase}/${filename}`;

  if (viewPanel._nodevisionJsonTreeCy) {
    viewPanel._nodevisionJsonTreeCy.destroy();
    viewPanel._nodevisionJsonTreeCy = null;
  }

  viewPanel.innerHTML = "";
  const shell = createViewerShell(filename);
  viewPanel.appendChild(shell);

  const graphEl = shell.querySelector("[data-json-tree-graph]");
  const detailsEl = shell.querySelector("[data-json-tree-details]");
  const statusEl = shell.querySelector("[data-json-tree-status]");
  const warningEl = shell.querySelector("[data-json-tree-warning]");

  try {
    const [rawText, cytoscape] = await Promise.all([
      fetchText(url),
      ensureCytoscape()
    ]);
    const parsed = parseJsonDocument(rawText);
    const rootLabel = basename(filename);
    const tree = buildJsonTree(parsed.value, rootLabel);

    statusEl.textContent = `${tree.nodeCount} nodes, ${tree.edgeCount} edges${parsed.format === "jsonl" ? " from line-delimited JSON" : ""}`;
    if (tree.truncated) {
      warningEl.hidden = false;
      warningEl.textContent = `Large document truncated after ${MAX_TREE_NODES} tree nodes.`;
    }

    const cy = renderCytoscapeTree(cytoscape, graphEl, detailsEl, tree);
    viewPanel._nodevisionJsonTreeCy = cy;
    wireToolbar(shell, cy, tree.rootId);
    return true;
  } catch (error) {
    renderError(shell, filename, error);
    return false;
  }
}

function createViewerShell(filename) {
  const shell = document.createElement("section");
  shell.className = "nv-json-tree-viewer";
  shell.setAttribute("aria-label", `JSON tree view for ${filename}`);
  shell.innerHTML = `
    <style>
      .nv-json-tree-viewer,
      .nv-json-tree-viewer * {
        box-sizing: border-box;
      }

      .nv-json-tree-viewer {
        width: 100%;
        height: 100%;
        min-height: 460px;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        background: #f6f8fb;
        color: #182230;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 13px;
      }

      .nv-json-tree-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0.65rem 0.75rem;
        border-bottom: 1px solid #ccd6e3;
        background: #ffffff;
        min-width: 0;
      }

      .nv-json-tree-title {
        min-width: 0;
      }

      .nv-json-tree-title h2 {
        margin: 0;
        font-size: 1rem;
        line-height: 1.25;
        font-weight: 650;
        color: #102030;
        overflow-wrap: anywhere;
      }

      .nv-json-tree-title p {
        margin: 0.25rem 0 0;
        color: #536273;
        font-size: 0.82rem;
      }

      .nv-json-tree-actions {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .nv-json-tree-actions button {
        border: 1px solid #b7c4d3;
        background: #f8fbff;
        color: #1b334f;
        border-radius: 6px;
        padding: 0.35rem 0.6rem;
        font: inherit;
        cursor: pointer;
      }

      .nv-json-tree-actions button:hover,
      .nv-json-tree-actions button:focus-visible {
        border-color: #356ea8;
        background: #edf6ff;
        outline: none;
      }

      .nv-json-tree-body {
        min-height: 0;
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(240px, 330px);
      }

      .nv-json-tree-canvas {
        min-width: 0;
        min-height: 360px;
        position: relative;
        background: #ffffff;
      }

      .nv-json-tree-canvas::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background-image:
          linear-gradient(#eef2f6 1px, transparent 1px),
          linear-gradient(90deg, #eef2f6 1px, transparent 1px);
        background-size: 24px 24px;
        opacity: 0.7;
      }

      .nv-json-tree-graph {
        position: absolute;
        inset: 0;
        z-index: 1;
      }

      .nv-json-tree-details {
        min-width: 0;
        overflow: auto;
        border-left: 1px solid #ccd6e3;
        background: #fbfcfe;
        padding: 0.85rem;
      }

      .nv-json-tree-details h3 {
        margin: 0 0 0.6rem;
        font-size: 0.95rem;
        color: #102030;
        overflow-wrap: anywhere;
      }

      .nv-json-tree-detail-row {
        margin: 0 0 0.65rem;
      }

      .nv-json-tree-detail-row dt {
        margin: 0 0 0.2rem;
        color: #667485;
        font-weight: 650;
        font-size: 0.76rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .nv-json-tree-detail-row dd {
        margin: 0;
        color: #17202c;
        overflow-wrap: anywhere;
      }

      .nv-json-tree-detail-code {
        margin: 0.2rem 0 0;
        padding: 0.55rem;
        max-height: 220px;
        overflow: auto;
        background: #101820;
        color: #edf6ff;
        border-radius: 6px;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 0.78rem;
      }

      .nv-json-tree-warning {
        margin: 0.5rem 0 0;
        color: #8a5200;
      }

      .nv-json-tree-error {
        padding: 1rem;
        color: #8c1d18;
      }

      .nv-json-tree-error h2 {
        margin: 0 0 0.5rem;
        font-size: 1rem;
      }

      .nv-json-tree-error pre {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }

      @media (max-width: 760px) {
        .nv-json-tree-toolbar {
          align-items: flex-start;
          flex-direction: column;
        }

        .nv-json-tree-actions {
          justify-content: flex-start;
        }

        .nv-json-tree-body {
          grid-template-columns: minmax(0, 1fr);
          grid-template-rows: minmax(360px, 1fr) auto;
        }

        .nv-json-tree-details {
          border-left: 0;
          border-top: 1px solid #ccd6e3;
          max-height: 240px;
        }
      }
    </style>
    <header class="nv-json-tree-toolbar">
      <div class="nv-json-tree-title">
        <h2></h2>
        <p data-json-tree-status>Loading JSON tree...</p>
        <p class="nv-json-tree-warning" data-json-tree-warning hidden></p>
      </div>
      <div class="nv-json-tree-actions" aria-label="JSON tree controls">
        <button type="button" data-json-tree-action="fit">Fit</button>
        <button type="button" data-json-tree-action="root">Root</button>
        <button type="button" data-json-tree-action="layout">Layout</button>
      </div>
    </header>
    <div class="nv-json-tree-body">
      <div class="nv-json-tree-canvas">
        <div class="nv-json-tree-graph" data-json-tree-graph></div>
      </div>
      <aside class="nv-json-tree-details" data-json-tree-details aria-live="polite"></aside>
    </div>
  `;

  shell.querySelector("h2").textContent = basename(filename);
  return shell;
}

async function fetchText(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function parseJsonDocument(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Empty JSON document");
  }

  try {
    return { value: JSON.parse(trimmed), format: "json" };
  } catch (jsonError) {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length <= 1) throw jsonError;

    const records = [];
    for (let index = 0; index < lines.length; index += 1) {
      try {
        records.push(JSON.parse(lines[index]));
      } catch (lineError) {
        throw new Error(`JSON parse failed; line-delimited fallback failed on line ${index + 1}: ${lineError.message}`);
      }
    }
    return { value: records, format: "jsonl" };
  }
}

function buildJsonTree(value, rootLabel) {
  const elements = [];
  const state = {
    nextId: 1,
    nodeCount: 0,
    edgeCount: 0,
    truncated: false,
    truncatedParents: new Set()
  };
  const rootId = "json-root";
  addNode(elements, state, {
    id: rootId,
    parentId: null,
    label: rootLabel,
    fullLabel: rootLabel,
    path: "$",
    value,
    isRoot: true
  });

  if (isContainer(value)) {
    addChildren(elements, state, rootId, value, "$", false);
  } else {
    const valueId = nextNodeId(state);
    addNode(elements, state, {
      id: valueId,
      parentId: rootId,
      label: `value: ${primitivePreview(value)}`,
      fullLabel: "value",
      path: "$",
      value
    });
  }

  return {
    elements,
    rootId,
    nodeCount: state.nodeCount,
    edgeCount: state.edgeCount,
    truncated: state.truncated
  };
}

function addChildren(elements, state, parentId, value, parentPath, parentIsArray) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      addEmptyNode(elements, state, parentId, "(empty array)", parentPath);
      return;
    }

    value.forEach((item, index) => {
      addValueNode(elements, state, parentId, `[${index}]`, appendPath(parentPath, index, true), item);
    });
    return;
  }

  const entries = Object.entries(value);
  if (entries.length === 0) {
    addEmptyNode(elements, state, parentId, "(empty object)", parentPath);
    return;
  }

  entries.forEach(([key, item]) => {
    addValueNode(elements, state, parentId, key, appendPath(parentPath, key, parentIsArray), item);
  });
}

function addValueNode(elements, state, parentId, keyLabel, path, value) {
  if (state.nodeCount >= MAX_TREE_NODES) {
    addTruncationNode(elements, state, parentId, path);
    return;
  }

  const type = valueType(value);
  const label = isContainer(value)
    ? keyLabel
    : `${keyLabel}: ${primitivePreview(value)}`;
  const id = nextNodeId(state);

  addNode(elements, state, {
    id,
    parentId,
    label,
    fullLabel: keyLabel,
    path,
    value
  });

  if (isContainer(value)) {
    addChildren(elements, state, id, value, path, type === "array");
  }
}

function addNode(elements, state, node) {
  const type = valueType(node.value);
  const classes = ["json-node", `json-${type}`];
  if (node.isRoot) classes.push("json-root");

  elements.push({
    group: "nodes",
    classes: classes.join(" "),
    data: {
      id: node.id,
      label: shortLabel(node.label),
      fullLabel: node.fullLabel,
      path: node.path,
      type,
      summary: valueSummary(node.value),
      valueText: detailValue(node.value)
    }
  });
  state.nodeCount += 1;

  if (node.parentId) {
    elements.push({
      group: "edges",
      data: {
        id: `edge-${node.parentId}-${node.id}`,
        source: node.parentId,
        target: node.id
      }
    });
    state.edgeCount += 1;
  }
}

function addEmptyNode(elements, state, parentId, label, path) {
  if (state.nodeCount >= MAX_TREE_NODES) {
    addTruncationNode(elements, state, parentId, path);
    return;
  }

  const id = nextNodeId(state);
  elements.push({
    group: "nodes",
    classes: "json-node json-empty",
    data: {
      id,
      label,
      fullLabel: label,
      path,
      type: "empty",
      summary: label,
      valueText: ""
    }
  });
  elements.push({
    group: "edges",
    data: {
      id: `edge-${parentId}-${id}`,
      source: parentId,
      target: id
    }
  });
  state.nodeCount += 1;
  state.edgeCount += 1;
}

function addTruncationNode(elements, state, parentId, path) {
  state.truncated = true;
  if (state.truncatedParents.has(parentId)) return;
  state.truncatedParents.add(parentId);

  const id = nextNodeId(state);
  elements.push({
    group: "nodes",
    classes: "json-node json-truncated",
    data: {
      id,
      label: "more...",
      fullLabel: "more nodes omitted",
      path,
      type: "truncated",
      summary: "This branch was omitted to keep the viewer responsive.",
      valueText: ""
    }
  });
  elements.push({
    group: "edges",
    data: {
      id: `edge-${parentId}-${id}`,
      source: parentId,
      target: id
    }
  });
  state.nodeCount += 1;
  state.edgeCount += 1;
}

function renderCytoscapeTree(cytoscape, graphEl, detailsEl, tree) {
  const cy = cytoscape({
    container: graphEl,
    elements: tree.elements,
    boxSelectionEnabled: false,
    autoungrabify: false,
    wheelSensitivity: 0.18,
    style: cytoscapeStyle(),
    layout: treeLayout(tree.rootId)
  });

  cy.on("tap", "node", (event) => {
    renderNodeDetails(detailsEl, event.target.data());
  });

  cy.on("mouseover", "node", (event) => {
    graphEl.title = `${event.target.data("path")} (${event.target.data("type")})`;
  });

  cy.on("mouseout", "node", () => {
    graphEl.removeAttribute("title");
  });

  const root = cy.getElementById(tree.rootId);
  root.select();
  renderNodeDetails(detailsEl, root.data());
  requestAnimationFrame(() => cy.fit(undefined, 36));
  return cy;
}

function cytoscapeStyle() {
  return [
    {
      selector: "node",
      style: {
        label: "data(label)",
        shape: "round-rectangle",
        width: "126px",
        height: "46px",
        padding: "8px",
        "background-color": "#ffffff",
        "border-width": 1,
        "border-color": "#95a3b6",
        color: "#17202c",
        "font-size": "11px",
        "font-family": "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        "font-weight": 600,
        "text-wrap": "wrap",
        "text-max-width": "112px",
        "text-valign": "center",
        "text-halign": "center",
        "overlay-padding": "5px"
      }
    },
    {
      selector: "node:selected",
      style: {
        "border-width": 3,
        "border-color": "#1e5f99",
        "background-color": "#eaf4ff"
      }
    },
    {
      selector: "node.json-root",
      style: {
        width: "154px",
        height: "54px",
        "background-color": "#1f3146",
        "border-color": "#111923",
        color: "#ffffff",
        "font-size": "12px"
      }
    },
    {
      selector: "node.json-object",
      style: {
        "background-color": "#e9f3ff",
        "border-color": "#70a7db"
      }
    },
    {
      selector: "node.json-array",
      style: {
        "background-color": "#edf8ed",
        "border-color": "#72ac70"
      }
    },
    {
      selector: "node.json-string",
      style: {
        "background-color": "#fff7e7",
        "border-color": "#d29b35"
      }
    },
    {
      selector: "node.json-number, node.json-boolean, node.json-null",
      style: {
        "background-color": "#f6edff",
        "border-color": "#a87bd8"
      }
    },
    {
      selector: "node.json-empty, node.json-truncated",
      style: {
        "background-color": "#f3f5f8",
        "border-style": "dashed",
        "border-color": "#9aa8b7",
        color: "#536273"
      }
    },
    {
      selector: "edge",
      style: {
        width: 2,
        "line-color": "#aeb9c6",
        "target-arrow-color": "#aeb9c6",
        "target-arrow-shape": "triangle",
        "curve-style": "bezier",
        "arrow-scale": 0.8
      }
    }
  ];
}

function treeLayout(rootId) {
  return {
    name: "breadthfirst",
    directed: true,
    roots: `#${rootId}`,
    padding: 44,
    spacingFactor: 1.2,
    avoidOverlap: true,
    animate: false
  };
}

function wireToolbar(shell, cy, rootId) {
  shell.querySelector("[data-json-tree-action='fit']")?.addEventListener("click", () => {
    cy.fit(undefined, 36);
  });

  shell.querySelector("[data-json-tree-action='root']")?.addEventListener("click", () => {
    const root = cy.getElementById(rootId);
    if (!root.length) return;
    cy.center(root);
    cy.zoom({ level: Math.max(cy.zoom(), 1), position: root.position() });
  });

  shell.querySelector("[data-json-tree-action='layout']")?.addEventListener("click", () => {
    cy.layout(treeLayout(rootId)).run();
    requestAnimationFrame(() => cy.fit(undefined, 36));
  });
}

function renderNodeDetails(detailsEl, data) {
  detailsEl.innerHTML = "";

  const heading = document.createElement("h3");
  heading.textContent = data.fullLabel || data.label;
  detailsEl.appendChild(heading);

  const list = document.createElement("dl");
  list.appendChild(detailRow("Path", data.path));
  list.appendChild(detailRow("Type", data.type));
  list.appendChild(detailRow("Summary", data.summary));
  detailsEl.appendChild(list);

  if (data.valueText) {
    const pre = document.createElement("pre");
    pre.className = "nv-json-tree-detail-code";
    pre.textContent = data.valueText;
    detailsEl.appendChild(pre);
  }
}

function detailRow(term, value) {
  const wrapper = document.createElement("div");
  wrapper.className = "nv-json-tree-detail-row";

  const dt = document.createElement("dt");
  dt.textContent = term;
  const dd = document.createElement("dd");
  dd.textContent = value || "";

  wrapper.appendChild(dt);
  wrapper.appendChild(dd);
  return wrapper;
}

function renderError(shell, filename, error) {
  shell.innerHTML = "";
  const errorEl = document.createElement("section");
  errorEl.className = "nv-json-tree-error";

  const heading = document.createElement("h2");
  heading.textContent = `Failed to render ${basename(filename)}`;
  const message = document.createElement("pre");
  message.textContent = error?.message || String(error);

  errorEl.appendChild(heading);
  errorEl.appendChild(message);
  shell.appendChild(errorEl);
}

function ensureCytoscape() {
  if (typeof window.cytoscape === "function") {
    return Promise.resolve(window.cytoscape);
  }

  if (!cytoscapeLoadPromise) {
    cytoscapeLoadPromise = loadCytoscapeFromSources(0);
  }

  return cytoscapeLoadPromise;
}

function loadCytoscapeFromSources(index) {
  const src = CYTOSCAPE_SCRIPT_SOURCES[index];
  if (!src) {
    return Promise.reject(new Error("Cytoscape could not be loaded"));
  }

  return loadScript(src)
    .then(() => {
      if (typeof window.cytoscape === "function") return window.cytoscape;
      throw new Error(`Cytoscape script loaded without exposing window.cytoscape: ${src}`);
    })
    .catch((error) => {
      if (index + 1 < CYTOSCAPE_SCRIPT_SOURCES.length) {
        return loadCytoscapeFromSources(index + 1);
      }
      throw error;
    });
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-nodevision-json-tree-cytoscape='${src}']`);
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.nodevisionJsonTreeCytoscape = src;
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
    document.head.appendChild(script);
  });
}

function basename(path) {
  const cleaned = String(path || "").replace(/\\/g, "/");
  return cleaned.split("/").filter(Boolean).pop() || cleaned || "JSON file";
}

function nextNodeId(state) {
  const id = `json-node-${state.nextId}`;
  state.nextId += 1;
  return id;
}

function valueType(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

function isContainer(value) {
  return value !== null && typeof value === "object";
}

function valueSummary(value) {
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;
  if (value !== null && typeof value === "object") {
    const count = Object.keys(value).length;
    return `${count} propert${count === 1 ? "y" : "ies"}`;
  }
  return primitivePreview(value);
}

function primitivePreview(value) {
  if (typeof value === "string") return JSON.stringify(truncate(value, 72));
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  return truncate(String(value), 72);
}

function detailValue(value) {
  if (isContainer(value)) return "";
  return primitivePreview(value);
}

function shortLabel(label) {
  return truncate(String(label), 82);
}

function truncate(value, limit) {
  const text = String(value);
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 3))}...`;
}

function appendPath(parentPath, key, parentIsArray) {
  if (parentIsArray || typeof key === "number") return `${parentPath}[${key}]`;
  if (/^[A-Za-z_$][\w$]*$/.test(key)) return `${parentPath}.${key}`;
  return `${parentPath}[${JSON.stringify(key)}]`;
}
