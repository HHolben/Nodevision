// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/JSONFamilyEditor.mjs
// Graphical JSON editor built on Cytoscape and the shared Nodevision toolbar system.
import {
  resetEditorHooks,
  ensureNodevisionState,
  createBaseLayout,
  fetchText,
  saveText,
} from "./FamilyEditorCommon.mjs";
import { showToolbarSubToolbar, updateToolbarState } from "/panels/createToolbar.mjs";

const JSON_MODE = "JSONEditing";
const TOOLBAR_HEADING = "JSON Tools";
const STYLE_ID = "nodevision-json-graphical-editor-styles";
const CYTOSCAPE_SCRIPT_SOURCES = ["/vendor/cytoscape/cytoscape.min.js", "/cytoscape-bundle.js"];
const MAX_VISIBLE_NODES = 2500;

let cytoscapeLoadPromise = null;

export async function renderEditor(filePath, container) {
  resetEditorHooks();
  ensureNodevisionState(JSON_MODE);
  ensureStylesheet();

  const { status, body } = createBaseLayout(container, `JSON Editor - ${filePath}`);
  body.className = "nv-json-editor-body";
  body.style.cssText = "flex:1;min-height:0;overflow:hidden;";

  const state = createEditorState({ filePath, container, status });
  state.actionHandler = (actionKey) => handleToolbarAction(state, actionKey);

  try {
    const [text, cytoscape] = await Promise.all([fetchText(filePath), ensureCytoscape()]);
    state.cytoscape = cytoscape;
    state.data = parseJsonText(text || "{}");
    buildEditorDom(state, body);
    syncSourceText(state);
    renderTree(state);
    installSaveHooks(state);
    installCleanup(state);
    notifyToolbar(state, { fileIsDirty: false });
    status.textContent = "JSON loaded";
  } catch (err) {
    renderLoadError(state, body, err);
    updateToolbarState({
      currentMode: JSON_MODE,
      activePanelType: "GraphicalEditor",
      selectedFile: filePath,
      activeEditorFilePath: filePath,
      activeActionHandler: null,
      fileIsDirty: false,
    });
    status.textContent = "Load failed";
  }
}

function createEditorState({ filePath, container, status }) {
  return {
    filePath,
    container,
    status,
    cytoscape: null,
    cy: null,
    data: {},
    dirty: false,
    sourceVisible: false,
    sourceDirty: false,
    selectedPathKey: pathKey([]),
    tree: null,
    actionHandler: null,
    refs: {},
  };
}

function buildEditorDom(state, body) {
  body.innerHTML = `
    <section class="nv-json-editor" aria-label="JSON graphical editor">
      <div class="nv-json-editor-graph-wrap">
        <div class="nv-json-editor-graph" data-json-editor-graph></div>
      </div>
      <aside class="nv-json-editor-inspector" data-json-editor-inspector>
        <h3>Selection</h3>
        <label class="nv-json-editor-field"><span>Path</span><input type="text" data-json-path readonly></label>
        <label class="nv-json-editor-field"><span>Key</span><input type="text" data-json-key></label>
        <label class="nv-json-editor-field">
          <span>Type</span>
          <select data-json-type>
            <option value="object">object</option>
            <option value="array">array</option>
            <option value="string">string</option>
            <option value="number">number</option>
            <option value="boolean">boolean</option>
            <option value="null">null</option>
          </select>
        </label>
        <div data-json-value-editor></div>
        <p class="nv-json-editor-help" data-json-help></p>
        <section class="nv-json-source-panel" data-json-source-panel hidden>
          <label><span>Source JSON</span><textarea id="markdown-editor" spellcheck="false" data-json-source></textarea></label>
        </section>
      </aside>
    </section>
  `;

  state.refs.graph = body.querySelector("[data-json-editor-graph]");
  state.refs.pathInput = body.querySelector("[data-json-path]");
  state.refs.keyInput = body.querySelector("[data-json-key]");
  state.refs.typeSelect = body.querySelector("[data-json-type]");
  state.refs.valueEditor = body.querySelector("[data-json-value-editor]");
  state.refs.help = body.querySelector("[data-json-help]");
  state.refs.sourcePanel = body.querySelector("[data-json-source-panel]");
  state.refs.source = body.querySelector("[data-json-source]");

  state.refs.keyInput.addEventListener("change", () => renameSelectedKey(state, state.refs.keyInput.value));
  state.refs.keyInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      renameSelectedKey(state, state.refs.keyInput.value);
    }
  });
  state.refs.typeSelect.addEventListener("change", () => changeSelectedType(state, state.refs.typeSelect.value));
  state.refs.source.addEventListener("input", () => {
    state.sourceDirty = true;
    setStatus(state, "Source edits pending. Use JSON Tools > Apply Source before saving.", "warn");
    notifyToolbar(state);
  });
}

function renderLoadError(state, body, err) {
  body.innerHTML = `<section class="nv-json-editor-error"><h3>JSON could not be loaded</h3><p></p></section>`;
  body.querySelector("p").textContent = err?.message || String(err);
  installCleanup(state);
}

function renderTree(state, preferredPathKey = state.selectedPathKey) {
  if (!state.refs.graph || typeof state.cytoscape !== "function") return;
  if (state.cy) state.cy.destroy();

  const tree = buildJsonTree(state.data, basename(state.filePath));
  state.tree = tree;
  if (!tree.records.has(preferredPathKey)) preferredPathKey = pathKey([]);
  state.selectedPathKey = preferredPathKey;

  state.cy = state.cytoscape({
    container: state.refs.graph,
    elements: tree.elements,
    boxSelectionEnabled: false,
    autoungrabify: false,
    wheelSensitivity: 0.18,
    style: cytoscapeStyle(),
    layout: treeLayout(tree.rootId),
  });

  state.cy.on("tap", "node", (event) => {
    const data = event.target.data();
    selectPath(state, data.placeholderForPathKey || data.pathKey);
  });

  requestAnimationFrame(() => {
    if (!state.cy) return;
    state.cy.fit(undefined, 42);
    selectPath(state, state.selectedPathKey, { skipToolbarRefresh: true });
    notifyToolbar(state);
  });
}

function buildJsonTree(rootValue, rootLabel) {
  const treeState = {
    elements: [],
    records: new Map(),
    pathKeyToId: new Map(),
    nextNodeId: 1,
    visibleNodes: 0,
    truncated: false,
  };
  const rootRecord = createRecord([], null, rootLabel, rootValue, true);
  addRecordNode(treeState, rootRecord);
  if (isContainer(rootValue)) addChildRecords(treeState, rootRecord, rootValue);
  return {
    elements: treeState.elements,
    records: treeState.records,
    pathKeyToId: treeState.pathKeyToId,
    rootId: rootRecord.id,
    truncated: treeState.truncated,
  };
}

function addChildRecords(treeState, parentRecord, value) {
  if (treeState.visibleNodes >= MAX_VISIBLE_NODES) {
    addTruncatedNode(treeState, parentRecord);
    return;
  }
  if (Array.isArray(value)) {
    if (!value.length) {
      addPlaceholderNode(treeState, parentRecord, "(empty array)");
      return;
    }
    value.forEach((childValue, index) => addValueRecord(treeState, parentRecord, index, childValue));
    return;
  }
  const entries = Object.entries(value || {});
  if (!entries.length) {
    addPlaceholderNode(treeState, parentRecord, "(empty object)");
    return;
  }
  entries.forEach(([key, childValue]) => addValueRecord(treeState, parentRecord, key, childValue));
}

function addValueRecord(treeState, parentRecord, key, value) {
  if (treeState.visibleNodes >= MAX_VISIBLE_NODES) {
    addTruncatedNode(treeState, parentRecord);
    return;
  }
  const record = createRecord(parentRecord.path.concat(key), parentRecord.path, String(key), value, false);
  addRecordNode(treeState, record, parentRecord.id);
  if (isContainer(value)) addChildRecords(treeState, record, value);
}

function createRecord(path, parentPath, keyLabel, value, isRoot) {
  const key = pathKey(path);
  const id = path.length === 0 ? "json-root" : `json-node-${encodePathKey(key)}`;
  const type = valueType(value);
  const label = isRoot
    ? keyLabel
    : isContainer(value)
      ? displayKey(path[path.length - 1])
      : `${displayKey(path[path.length - 1])}: ${primitivePreview(value)}`;

  return {
    id,
    path,
    pathKey: key,
    parentPath,
    parentPathKey: parentPath ? pathKey(parentPath) : "",
    keyLabel,
    label,
    type,
    value,
    isRoot,
    jsonPath: jsonPath(path),
  };
}

function addRecordNode(treeState, record, parentId = null) {
  const classes = ["json-node", `json-${record.type}`];
  if (record.isRoot) classes.push("json-root");
  treeState.elements.push({
    group: "nodes",
    classes: classes.join(" "),
    data: {
      id: record.id,
      label: shortLabel(record.label),
      pathKey: record.pathKey,
      jsonPath: record.jsonPath,
      type: record.type,
      summary: valueSummary(record.value),
    },
  });
  treeState.records.set(record.pathKey, record);
  treeState.pathKeyToId.set(record.pathKey, record.id);
  treeState.visibleNodes += 1;
  if (parentId) {
    treeState.elements.push({
      group: "edges",
      data: { id: `edge-${parentId}-${record.id}`, source: parentId, target: record.id },
    });
  }
}

function addPlaceholderNode(treeState, parentRecord, label) {
  const id = `json-placeholder-${treeState.nextNodeId++}`;
  treeState.elements.push({
    group: "nodes",
    classes: "json-node json-empty",
    data: { id, label, placeholderForPathKey: parentRecord.pathKey, jsonPath: parentRecord.jsonPath, type: "empty", summary: label },
  });
  treeState.elements.push({ group: "edges", data: { id: `edge-${parentRecord.id}-${id}`, source: parentRecord.id, target: id } });
  treeState.visibleNodes += 1;
}

function addTruncatedNode(treeState, parentRecord) {
  if (treeState.truncated) return;
  treeState.truncated = true;
  const id = `json-truncated-${treeState.nextNodeId++}`;
  treeState.elements.push({
    group: "nodes",
    classes: "json-node json-truncated",
    data: {
      id,
      label: "more...",
      placeholderForPathKey: parentRecord.pathKey,
      jsonPath: parentRecord.jsonPath,
      type: "truncated",
      summary: `Document truncated after ${MAX_VISIBLE_NODES} nodes`,
    },
  });
  treeState.elements.push({ group: "edges", data: { id: `edge-${parentRecord.id}-${id}`, source: parentRecord.id, target: id } });
}

function selectPath(state, nextPathKey, options = {}) {
  const record = state.tree?.records.get(nextPathKey) || state.tree?.records.get(pathKey([]));
  if (!record) return;
  state.selectedPathKey = record.pathKey;
  if (state.cy) {
    state.cy.nodes().unselect();
    const id = state.tree.pathKeyToId.get(record.pathKey);
    const node = id ? state.cy.getElementById(id) : null;
    if (node?.length) node.select();
  }
  renderInspector(state, record);
  if (!options.skipToolbarRefresh) notifyToolbar(state);
}

function renderInspector(state, record) {
  state.refs.pathInput.value = record.jsonPath;
  state.refs.keyInput.value = record.isRoot ? basename(state.filePath) : String(record.path[record.path.length - 1]);
  state.refs.keyInput.disabled = record.isRoot || Array.isArray(getAtPath(state.data, record.parentPath || []));
  state.refs.typeSelect.value = record.type;
  state.refs.help.textContent = inspectorHelpText(state, record);
  renderValueEditor(state, record);
}

function renderValueEditor(state, record) {
  const host = state.refs.valueEditor;
  host.innerHTML = "";
  const label = document.createElement("label");
  label.className = "nv-json-editor-field nv-json-editor-value-field";
  const caption = document.createElement("span");
  caption.textContent = "Value";
  label.appendChild(caption);

  if (record.type === "string") {
    const textarea = document.createElement("textarea");
    textarea.value = typeof record.value === "string" ? record.value : "";
    textarea.addEventListener("change", () => setSelectedPrimitiveValue(state, textarea.value));
    label.appendChild(textarea);
    host.appendChild(label);
    return;
  }

  if (record.type === "number") {
    const input = document.createElement("input");
    input.type = "number";
    input.value = Number.isFinite(record.value) ? String(record.value) : "0";
    input.addEventListener("change", () => setSelectedPrimitiveValue(state, input.value));
    label.appendChild(input);
    host.appendChild(label);
    return;
  }

  if (record.type === "boolean") {
    const select = document.createElement("select");
    select.innerHTML = `<option value="true">true</option><option value="false">false</option>`;
    select.value = record.value ? "true" : "false";
    select.addEventListener("change", () => setSelectedPrimitiveValue(state, select.value));
    label.appendChild(select);
    host.appendChild(label);
    return;
  }

  const summary = document.createElement("p");
  summary.className = "nv-json-editor-summary";
  summary.textContent = record.type === "null" ? "null" : valueSummary(record.value);
  host.appendChild(summary);
}

function inspectorHelpText(state, record) {
  if (record.isRoot) return "The root node is the file itself. Change its type to replace the whole document.";
  const parent = getAtPath(state.data, record.parentPath || []);
  if (Array.isArray(parent)) return "Array item keys are positional. Add or delete items from JSON Tools.";
  return "Object property keys are editable. Press Enter or leave the key field to rename.";
}

function renameSelectedKey(state, rawKey) {
  if (!applySourceBeforeMutation(state)) return;
  const record = getSelectedRecord(state);
  if (!record || record.isRoot) return;
  const parent = getAtPath(state.data, record.parentPath || []);
  if (!parent || Array.isArray(parent) || typeof parent !== "object") return;

  const oldKey = String(record.path[record.path.length - 1]);
  const newKey = String(rawKey || "").trim();
  if (!newKey) {
    setStatus(state, "Object keys cannot be empty.", "error");
    renderInspector(state, record);
    return;
  }
  if (newKey !== oldKey && Object.prototype.hasOwnProperty.call(parent, newKey)) {
    setStatus(state, `A property named "${newKey}" already exists.`, "error");
    renderInspector(state, record);
    return;
  }
  if (newKey === oldKey) return;

  const entries = Object.entries(parent);
  Object.keys(parent).forEach((key) => delete parent[key]);
  entries.forEach(([key, value]) => { parent[key === oldKey ? newKey : key] = value; });
  const newPath = record.parentPath.concat(newKey);
  markDirty(state, `Renamed ${oldKey} to ${newKey}`);
  renderTree(state, pathKey(newPath));
}

function changeSelectedType(state, nextType) {
  if (!applySourceBeforeMutation(state)) return;
  const record = getSelectedRecord(state);
  if (!record || record.type === nextType) return;
  setAtPath(state, record.path, defaultValueForType(nextType, record.value));
  markDirty(state, `Changed ${record.jsonPath} to ${nextType}`);
  renderTree(state, record.pathKey);
}

function setSelectedPrimitiveValue(state, rawValue) {
  if (!applySourceBeforeMutation(state)) return;
  const record = getSelectedRecord(state);
  if (!record) return;
  try {
    const nextValue = parsePrimitiveValue(record.type, rawValue);
    setAtPath(state, record.path, nextValue);
    markDirty(state, `Updated ${record.jsonPath}`);
    renderTree(state, record.pathKey);
  } catch (err) {
    setStatus(state, err.message, "error");
    renderInspector(state, record);
  }
}

function handleToolbarAction(state, actionKey) {
  switch (actionKey) {
    case "jsonAddProperty":
      addProperty(state);
      break;
    case "jsonAddItem":
      addArrayItem(state);
      break;
    case "jsonDeleteNode":
      deleteSelectedNode(state);
      break;
    case "jsonRenameKey":
      state.refs.keyInput?.focus();
      state.refs.keyInput?.select?.();
      break;
    case "jsonFormat":
      formatDocument(state);
      break;
    case "jsonToggleSource":
      toggleSource(state);
      break;
    case "jsonApplySource":
      applySourceText(state);
      break;
    case "jsonSave":
      saveJson(state).catch((err) => setStatus(state, `Save failed: ${err.message}`, "error"));
      break;
    case "jsonFitTree":
      state.cy?.fit(undefined, 42);
      break;
    default:
      console.warn("Unknown JSON editor toolbar action:", actionKey);
  }
}

function addProperty(state) {
  if (!applySourceBeforeMutation(state)) return;
  const target = selectedContainer(state, "object");
  if (!target) {
    setStatus(state, "Select an object to add a property.", "error");
    return;
  }
  const key = nextAvailableKey(target.value, "newProperty");
  target.value[key] = "";
  const newPath = target.path.concat(key);
  markDirty(state, `Added ${jsonPath(newPath)}`);
  renderTree(state, pathKey(newPath));
}

function addArrayItem(state) {
  if (!applySourceBeforeMutation(state)) return;
  const target = selectedContainer(state, "array");
  if (!target) {
    setStatus(state, "Select an array to add an item.", "error");
    return;
  }
  target.value.push(null);
  const newPath = target.path.concat(target.value.length - 1);
  markDirty(state, `Added ${jsonPath(newPath)}`);
  renderTree(state, pathKey(newPath));
}

function deleteSelectedNode(state) {
  if (!applySourceBeforeMutation(state)) return;
  const record = getSelectedRecord(state);
  if (!record || record.isRoot) {
    setStatus(state, "The root file node cannot be deleted.", "error");
    return;
  }
  const parent = getAtPath(state.data, record.parentPath || []);
  const key = record.path[record.path.length - 1];
  if (Array.isArray(parent)) parent.splice(Number(key), 1);
  else if (parent && typeof parent === "object") delete parent[key];
  markDirty(state, `Deleted ${record.jsonPath}`);
  renderTree(state, pathKey(record.parentPath || []));
}

function formatDocument(state) {
  if (!applySourceBeforeMutation(state)) return;
  syncSourceText(state);
  setStatus(state, "JSON formatted", "ok");
}

function toggleSource(state) {
  state.sourceVisible = !state.sourceVisible;
  state.refs.sourcePanel.hidden = !state.sourceVisible;
  if (state.sourceVisible && !state.sourceDirty) syncSourceText(state);
  notifyToolbar(state);
}

function applySourceText(state) {
  try {
    state.data = parseJsonText(state.refs.source.value || "{}");
    state.sourceDirty = false;
    markDirty(state, "Applied source JSON", { syncSource: false });
    renderTree(state, pathKey([]));
  } catch (err) {
    setStatus(state, `Source JSON is invalid: ${err.message}`, "error");
    notifyToolbar(state);
  }
}

function applySourceBeforeMutation(state) {
  if (!state.sourceDirty) return true;
  try {
    state.data = parseJsonText(state.refs.source.value || "{}");
    state.sourceDirty = false;
    return true;
  } catch (err) {
    setStatus(state, `Source JSON is invalid: ${err.message}`, "error");
    notifyToolbar(state);
    return false;
  }
}

async function saveJson(state, path = state.filePath) {
  if (state.sourceDirty && !applySourceBeforeMutation(state)) throw new Error("Source JSON is invalid");
  await saveText(path, serializeJson(state.data));
  state.dirty = false;
  syncSourceText(state);
  setStatus(state, "JSON saved", "ok");
  notifyToolbar(state, { fileIsDirty: false });
}

function markDirty(state, message, options = {}) {
  state.dirty = true;
  if (options.syncSource !== false) syncSourceText(state);
  setStatus(state, message || "JSON changed", "ok");
  notifyToolbar(state, { fileIsDirty: true });
}

function notifyToolbar(state, extra = {}) {
  const record = getSelectedRecord(state);
  const selectedType = record?.type || valueType(state.data);
  updateToolbarState({
    currentMode: JSON_MODE,
    activePanelType: "GraphicalEditor",
    selectedFile: state.filePath,
    activeEditorFilePath: state.filePath,
    activeActionHandler: state.actionHandler,
    fileIsDirty: state.dirty,
    jsonSelectedType: selectedType,
    jsonCanDeleteSelection: Boolean(record && !record.isRoot),
    jsonCanRenameSelection: Boolean(record && !record.isRoot && !Array.isArray(getAtPath(state.data, record.parentPath || []))),
    jsonSourceVisible: state.sourceVisible,
    jsonSourceDirty: state.sourceDirty,
    ...extra,
  });
  showToolbarSubToolbar(TOOLBAR_HEADING, { force: true, toggle: false });
}

function installSaveHooks(state) {
  window.saveMDFile = async (path = state.filePath) => saveJson(state, path);
  window.saveWYSIWYGFile = window.saveMDFile;
}

function installCleanup(state) {
  state.container.__nvActiveEditorCleanup = () => {
    if (state.cy) {
      state.cy.destroy();
      state.cy = null;
    }
    if (window.NodevisionState?.activeActionHandler === state.actionHandler) {
      updateToolbarState({ activeActionHandler: null, fileIsDirty: false });
    }
    if (window.saveMDFile === window.saveWYSIWYGFile) window.saveWYSIWYGFile = undefined;
    window.saveMDFile = undefined;
  };
}

function getSelectedRecord(state) {
  return state.tree?.records.get(state.selectedPathKey) || null;
}

function selectedContainer(state, expectedType) {
  const selected = getSelectedRecord(state);
  if (selected && selected.type === expectedType) return selected;
  if (selected?.parentPath) {
    const parentValue = getAtPath(state.data, selected.parentPath);
    if (valueType(parentValue) === expectedType) return { path: selected.parentPath, value: parentValue };
  }
  return null;
}

function getAtPath(root, path = []) {
  let current = root;
  for (const part of path || []) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

function setAtPath(state, path, value) {
  if (!path.length) {
    state.data = value;
    return;
  }
  const parent = getAtPath(state.data, path.slice(0, -1));
  parent[path[path.length - 1]] = value;
}

function parseJsonText(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return {};
  return JSON.parse(trimmed);
}

function serializeJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function syncSourceText(state) {
  if (!state.refs.source) return;
  state.refs.source.value = serializeJson(state.data);
  state.sourceDirty = false;
}

function parsePrimitiveValue(type, rawValue) {
  if (type === "string") return String(rawValue ?? "");
  if (type === "number") {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) throw new Error("Number values must be finite.");
    return value;
  }
  if (type === "boolean") return String(rawValue) === "true";
  if (type === "null") return null;
  return rawValue;
}

function defaultValueForType(type, oldValue) {
  switch (type) {
    case "object": return {};
    case "array": return [];
    case "string": return typeof oldValue === "string" ? oldValue : "";
    case "number": return typeof oldValue === "number" && Number.isFinite(oldValue) ? oldValue : 0;
    case "boolean": return typeof oldValue === "boolean" ? oldValue : false;
    case "null": return null;
    default: return null;
  }
}

function nextAvailableKey(objectValue, baseName) {
  if (!Object.prototype.hasOwnProperty.call(objectValue, baseName)) return baseName;
  let index = 2;
  while (Object.prototype.hasOwnProperty.call(objectValue, `${baseName}${index}`)) index += 1;
  return `${baseName}${index}`;
}

function valueType(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value === "object" ? "object" : typeof value;
}

function isContainer(value) {
  return value !== null && typeof value === "object";
}

function valueSummary(value) {
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;
  if (value && typeof value === "object") {
    const count = Object.keys(value).length;
    return `${count} propert${count === 1 ? "y" : "ies"}`;
  }
  return primitivePreview(value);
}

function primitivePreview(value) {
  if (typeof value === "string") return JSON.stringify(truncate(value, 60));
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null) return "null";
  return truncate(String(value), 60);
}

function displayKey(key) {
  return typeof key === "number" ? `[${key}]` : String(key);
}

function pathKey(path = []) {
  return JSON.stringify(path || []);
}

function encodePathKey(key) {
  return encodeURIComponent(key).replace(/%/g, "_");
}

function jsonPath(path = []) {
  let output = "$";
  for (const part of path || []) {
    if (typeof part === "number") output += `[${part}]`;
    else if (/^[A-Za-z_$][\w$]*$/.test(part)) output += `.${part}`;
    else output += `[${JSON.stringify(part)}]`;
  }
  return output;
}

function basename(path) {
  const clean = String(path || "").replace(/\\/g, "/");
  return clean.split("/").filter(Boolean).pop() || clean || "JSON file";
}

function shortLabel(label) {
  return truncate(String(label), 82);
}

function truncate(value, limit) {
  const text = String(value);
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 3))}...`;
}

function setStatus(state, message, tone = "normal") {
  if (!state.status) return;
  state.status.textContent = message;
  state.status.dataset.tone = tone;
}

function treeLayout(rootId) {
  return { name: "breadthfirst", directed: true, roots: `#${rootId}`, padding: 42, spacingFactor: 1.15, avoidOverlap: true, animate: false };
}

function cytoscapeStyle() {
  return [
    {
      selector: "node",
      style: {
        label: "data(label)",
        shape: "round-rectangle",
        width: "128px",
        height: "46px",
        padding: "8px",
        "background-color": "#ffffff",
        "border-width": 1,
        "border-color": "#96a5b8",
        color: "#182230",
        "font-size": "11px",
        "font-family": "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        "font-weight": 600,
        "text-wrap": "wrap",
        "text-max-width": "112px",
        "text-valign": "center",
        "text-halign": "center",
        "overlay-padding": "5px",
      },
    },
    { selector: "node:selected", style: { "border-width": 3, "border-color": "#1e5f99", "background-color": "#eaf4ff" } },
    { selector: "node.json-root", style: { width: "156px", height: "54px", "background-color": "#1f3146", "border-color": "#111923", color: "#ffffff", "font-size": "12px" } },
    { selector: "node.json-object", style: { "background-color": "#e9f3ff", "border-color": "#70a7db" } },
    { selector: "node.json-array", style: { "background-color": "#edf8ed", "border-color": "#72ac70" } },
    { selector: "node.json-string", style: { "background-color": "#fff7e7", "border-color": "#d29b35" } },
    { selector: "node.json-number, node.json-boolean, node.json-null", style: { "background-color": "#f6edff", "border-color": "#a87bd8" } },
    { selector: "node.json-empty, node.json-truncated", style: { "background-color": "#f3f5f8", "border-style": "dashed", "border-color": "#9aa8b7", color: "#536273" } },
    { selector: "edge", style: { width: 2, "line-color": "#aeb9c6", "target-arrow-color": "#aeb9c6", "target-arrow-shape": "triangle", "curve-style": "bezier", "arrow-scale": 0.8 } },
  ];
}

function ensureStylesheet() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .nv-json-editor-body [data-tone="ok"] { color: #17693a !important; }
    .nv-json-editor-body [data-tone="warn"] { color: #8a5200 !important; }
    .nv-json-editor-body [data-tone="error"] { color: #b00020 !important; }
    .nv-json-editor { width: 100%; height: 100%; min-height: 420px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 340px); border: 1px solid #c8d2df; border-radius: 8px; overflow: hidden; background: #fff; color: #182230; font: 13px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .nv-json-editor-graph-wrap { position: relative; min-width: 0; min-height: 0; background: #fff; }
    .nv-json-editor-graph-wrap::before { content: ""; position: absolute; inset: 0; pointer-events: none; background-image: linear-gradient(#eef2f6 1px, transparent 1px), linear-gradient(90deg, #eef2f6 1px, transparent 1px); background-size: 24px 24px; opacity: 0.72; }
    .nv-json-editor-graph { position: absolute; inset: 0; z-index: 1; }
    .nv-json-editor-inspector { min-width: 0; overflow: auto; border-left: 1px solid #c8d2df; background: #fbfcfe; padding: 12px; }
    .nv-json-editor-inspector h3 { margin: 0 0 10px; font-size: 1rem; color: #102030; }
    .nv-json-editor-field { display: grid; gap: 4px; margin: 0 0 10px; color: #526173; font-weight: 650; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em; }
    .nv-json-editor-field input, .nv-json-editor-field select, .nv-json-editor-field textarea, .nv-json-source-panel textarea { width: 100%; box-sizing: border-box; border: 1px solid #b7c4d3; border-radius: 6px; background: #fff; color: #17202c; font: 13px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; padding: 7px 8px; text-transform: none; letter-spacing: 0; font-weight: 400; }
    .nv-json-editor-field input[readonly], .nv-json-editor-field input:disabled { background: #f0f3f7; color: #667485; }
    .nv-json-editor-value-field textarea { min-height: 92px; resize: vertical; }
    .nv-json-editor-summary, .nv-json-editor-help { margin: 8px 0 12px; color: #536273; font-size: 0.86rem; }
    .nv-json-source-panel { margin-top: 12px; padding-top: 12px; border-top: 1px solid #d8e0ea; }
    .nv-json-source-panel span { display: block; margin-bottom: 6px; color: #526173; font-weight: 650; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em; }
    .nv-json-source-panel textarea { min-height: 220px; resize: vertical; }
    .nv-json-editor-error { padding: 14px; border: 1px solid #f0b4b4; border-radius: 8px; background: #fff6f6; color: #8c1d18; font: 13px/1.5 system-ui, sans-serif; }
    .nv-json-editor-error h3 { margin: 0 0 6px; font-size: 1rem; }
    @media (max-width: 820px) { .nv-json-editor { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(320px, 1fr) auto; } .nv-json-editor-inspector { border-left: 0; border-top: 1px solid #c8d2df; max-height: 300px; } }
  `;
  document.head.appendChild(style);
}

function ensureCytoscape() {
  if (typeof window.cytoscape === "function") return Promise.resolve(window.cytoscape);
  if (!cytoscapeLoadPromise) cytoscapeLoadPromise = loadCytoscapeFromSources(0);
  return cytoscapeLoadPromise;
}

function loadCytoscapeFromSources(index) {
  const src = CYTOSCAPE_SCRIPT_SOURCES[index];
  if (!src) return Promise.reject(new Error("Cytoscape could not be loaded"));
  return loadScript(src).then(() => {
    if (typeof window.cytoscape === "function") return window.cytoscape;
    throw new Error(`Cytoscape script loaded without exposing window.cytoscape: ${src}`);
  }).catch((error) => {
    if (index + 1 < CYTOSCAPE_SCRIPT_SOURCES.length) return loadCytoscapeFromSources(index + 1);
    throw error;
  });
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-nodevision-json-editor-cytoscape="${src}"]`);
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.nodevisionJsonEditorCytoscape = src;
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
    document.head.appendChild(script);
  });
}
