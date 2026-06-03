// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/TDEditor.mjs
// Graphical editor for W3C WoT Thing Description .td.json files.

import {
  buildGardenBed1Template,
  cloneThingDescription,
  extractMqttForms,
  formatThingDescription,
  parseThingDescriptionText,
  validateThingDescription,
} from "/ThingDescription/ThingDescriptionModel.mjs";
import {
  resetEditorHooks,
  ensureNodevisionState,
  createBaseLayout,
  fetchText,
  saveText,
} from "./FamilyEditorCommon.mjs";

let currentTd = null;

export async function renderEditor(filePath, container) {
  resetEditorHooks();
  ensureNodevisionState("ThingDescriptionEditing");
  const { status, body } = createBaseLayout(container, `Thing Description Editor - ${filePath}`);
  body.style.overflow = "hidden";

  const root = document.createElement("div");
  root.style.cssText = "display:flex;flex-direction:column;height:100%;gap:10px;min-height:0;";
  body.appendChild(root);

  try {
    const text = await fetchText(filePath);
    currentTd = text.trim() ? parseThingDescriptionText(text) : buildGardenBed1Template();
  } catch (err) {
    currentTd = buildGardenBed1Template();
    status.textContent = `Loaded garden template because file read failed: ${err.message}`;
  }

  const toolbar = document.createElement("div");
  toolbar.style.cssText = "display:flex;gap:8px;align-items:center;flex-wrap:wrap;";
  toolbar.innerHTML = `
    <button data-action="template" type="button">Create Garden Sensor Template</button>
    <button data-action="view-json" type="button">View JSON</button>
    <button data-action="edit-json" type="button">Edit JSON</button>
    <span data-field="status" style="font:12px monospace;color:#52606d;"></span>
  `;
  root.appendChild(toolbar);

  const editorShell = document.createElement("div");
  editorShell.style.cssText = "display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:10px;flex:1;min-height:0;";
  root.appendChild(editorShell);

  const formPane = document.createElement("div");
  formPane.style.cssText = "overflow:auto;display:flex;flex-direction:column;gap:10px;padding-right:4px;";
  editorShell.appendChild(formPane);

  const sidePane = document.createElement("div");
  sidePane.style.cssText = "overflow:auto;border-left:1px solid #d8dde6;padding-left:10px;display:flex;flex-direction:column;gap:10px;";
  editorShell.appendChild(sidePane);

  const jsonPane = document.createElement("textarea");
  jsonPane.id = "markdown-editor";
  jsonPane.spellcheck = false;
  jsonPane.style.cssText = "display:none;width:100%;height:100%;min-height:360px;resize:none;font:12px/1.45 ui-monospace,Menlo,Consolas,monospace;border:1px solid #c9c9c9;border-radius:8px;padding:10px;box-sizing:border-box;";
  root.appendChild(jsonPane);

  const render = () => renderForm({ formPane, sidePane, td: currentTd });
  render();

  const setStatus = (message, isError = false) => {
    status.textContent = message;
    const local = toolbar.querySelector('[data-field="status"]');
    if (local) {
      local.textContent = message;
      local.style.color = isError ? "#b00020" : "#166534";
    }
  };

  const showForm = () => {
    editorShell.style.display = "grid";
    jsonPane.style.display = "none";
  };
  const showJson = (editable) => {
    try {
      if (editorShell.style.display !== "none") currentTd = collectTd(formPane, sidePane, currentTd);
      jsonPane.value = formatThingDescription(currentTd);
      jsonPane.readOnly = !editable;
      jsonPane.style.background = editable ? "#fff" : "#f7f8fa";
      editorShell.style.display = "none";
      jsonPane.style.display = "block";
      setStatus(editable ? "Editing raw JSON" : "Viewing raw JSON");
    } catch (err) {
      setStatus(err.message, true);
    }
  };

  toolbar.querySelector('[data-action="template"]')?.addEventListener("click", () => {
    currentTd = buildGardenBed1Template();
    showForm();
    render();
    setStatus("Garden Bed 1 template loaded");
  });
  toolbar.querySelector('[data-action="view-json"]')?.addEventListener("click", () => showJson(false));
  toolbar.querySelector('[data-action="edit-json"]')?.addEventListener("click", () => showJson(true));

  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = target.dataset.action;
    if (action === "back-form") {
      try {
        if (jsonPane.style.display !== "none" && !jsonPane.readOnly) currentTd = parseThingDescriptionText(jsonPane.value);
        showForm();
        render();
        setStatus("Graphical editor updated from JSON");
      } catch (err) {
        setStatus(err.message, true);
      }
      return;
    }
    if (action === "add-io") addTableRow(formPane.querySelector('[data-table="io"] tbody'), ioRow({}));
    if (action === "add-property") addTableRow(formPane.querySelector('[data-table="properties"] tbody'), affordanceRow("property", "", {}));
    if (action === "add-action") addTableRow(formPane.querySelector('[data-table="actions"] tbody'), affordanceRow("action", "", {}));
    if (action === "add-event") addTableRow(formPane.querySelector('[data-table="events"] tbody'), affordanceRow("event", "", {}));
    if (action === "add-logger") addTableRow(formPane.querySelector('[data-table="loggers"] tbody'), loggerRow({}));
    if (action === "remove-row") target.closest("tr")?.remove();
    if (action === "validate") {
      try {
        const next = jsonPane.style.display !== "none" && !jsonPane.readOnly ? parseThingDescriptionText(jsonPane.value) : collectTd(formPane, sidePane, currentTd);
        validateThingDescription(next);
        setStatus("Thing Description is valid");
      } catch (err) {
        setStatus(err.message, true);
      }
    }
  });

  const getText = () => {
    if (jsonPane.style.display !== "none" && !jsonPane.readOnly) {
      currentTd = parseThingDescriptionText(jsonPane.value);
    } else {
      currentTd = collectTd(formPane, sidePane, currentTd);
    }
    return formatThingDescription(currentTd);
  };

  window.getEditorMarkdown = getText;
  window.saveMDFile = async (path = filePath) => {
    await saveText(path, getText());
    setStatus("Thing Description saved");
  };

  const backButton = document.createElement("button");
  backButton.type = "button";
  backButton.dataset.action = "back-form";
  backButton.textContent = "Back to Graphical Editor";
  backButton.style.cssText = "align-self:flex-start;display:none;";
  root.insertBefore(backButton, jsonPane);
  const observer = new MutationObserver(() => {
    backButton.style.display = jsonPane.style.display === "none" ? "none" : "inline-block";
  });
  observer.observe(jsonPane, { attributes: true, attributeFilter: ["style"] });
  container.__nvActiveEditorCleanup = () => observer.disconnect();

  setStatus("Thing Description loaded");
}

function renderForm({ formPane, sidePane, td }) {
  const nodevision = td.nodevision || {};
  const loggingEntries = Array.isArray(nodevision.logging?.csvLoggers) ? nodevision.logging.csvLoggers : [];
  const graphEdges = Array.isArray(nodevision.graph?.edges) ? nodevision.graph.edges : [];
  formPane.innerHTML = `
    ${panel("Thing Metadata", metadataHtml(td))}
    ${panel("Physical I/O", `${button("add-io", "Add I/O")} ${table("io", ["Name", "Kind", "Pin", "Unit", "Description", ""], (nodevision.physicalIO || []).map(ioRow).join(""))}`)}
    ${panel("Properties", `${button("add-property", "Add Property")} ${table("properties", ["Name", "Type", "Observable", "Unit", "MQTT form href", "Description", ""], Object.entries(td.properties || {}).map(([name, item]) => affordanceRow("property", name, item)).join(""))}`)}
    ${panel("Actions", `${button("add-action", "Add Action")} ${table("actions", ["Name", "Input schema JSON", "MQTT form href", "Description", ""], Object.entries(td.actions || {}).map(([name, item]) => affordanceRow("action", name, item)).join(""))}`)}
    ${panel("Events", `${button("add-event", "Add Event")} ${table("events", ["Name", "Data schema JSON", "MQTT form href", "Description", ""], Object.entries(td.events || {}).map(([name, item]) => affordanceRow("event", name, item)).join(""))}`)}
    ${panel("Nodevision Logging", `${button("add-logger", "Add Logger")} ${table("loggers", ["Property", "CSV relative path", "Columns", "Mappings JSON", "Enabled", ""], loggingEntries.map(loggerRow).join(""))}`)}
  `;
  sidePane.innerHTML = `
    ${panel("MQTT Forms", renderMqttList(extractMqttForms(td)))}
    ${panel("Graph Integration", graphHtml(nodevision.graph || {}, graphEdges))}
    ${panel("JSON Tools", `<button data-action="validate" type="button">Validate JSON</button>`)}
  `;
}

function metadataHtml(td) {
  return `
    <div style="display:grid;grid-template-columns:130px minmax(0,1fr);gap:8px;align-items:center;">
      ${field("title", "Title", td.title || "")}
      ${field("id", "ID", td.id || "")}
      <label>Description</label><textarea data-meta="description" rows="3">${escapeHtml(td.description || "")}</textarea>
      <label>@context JSON</label><textarea data-meta="context" rows="3">${escapeHtml(JSON.stringify(td["@context"] || ["https://www.w3.org/2022/wot/td/v1.1"], null, 2))}</textarea>
      <label>version JSON</label><textarea data-meta="version" rows="3">${escapeHtml(JSON.stringify(td.version || {}, null, 2))}</textarea>
    </div>`;
}

function field(key, label, value) {
  return `<label>${escapeHtml(label)}</label><input data-meta="${escapeHtml(key)}" value="${escapeAttr(value)}">`;
}

function ioRow(io = {}) {
  return `<tr>
    <td><input data-field="name" value="${escapeAttr(io.name || "")}"></td>
    <td><select data-field="kind">${options(["sensor", "actuator", "input", "output"], io.kind)}</select></td>
    <td><input data-field="pin" value="${escapeAttr(io.pin || "")}"></td>
    <td><input data-field="unit" value="${escapeAttr(io.unit || "")}"></td>
    <td><input data-field="description" value="${escapeAttr(io.description || "")}"></td>
    <td>${removeButton()}</td>
  </tr>`;
}

function affordanceRow(kind, name, item = {}) {
  const formHref = (item.forms || []).find((form) => String(form?.href || "").startsWith("mqtt"))?.href || "";
  if (kind === "property") {
    return `<tr data-original-name="${escapeAttr(name)}">
      <td><input data-field="name" value="${escapeAttr(name)}"></td>
      <td><input data-field="type" value="${escapeAttr(item.type || "string")}"></td>
      <td><input data-field="observable" type="checkbox" ${item.observable ? "checked" : ""}></td>
      <td><input data-field="unit" value="${escapeAttr(item.unit || "")}"></td>
      <td><input data-field="href" value="${escapeAttr(formHref)}"></td>
      <td><input data-field="description" value="${escapeAttr(item.description || "")}"></td>
      <td>${removeButton()}</td>
    </tr>`;
  }
  const schema = kind === "action" ? item.input || { type: "object" } : item.data || { type: "object" };
  return `<tr data-original-name="${escapeAttr(name)}">
    <td><input data-field="name" value="${escapeAttr(name)}"></td>
    <td><textarea data-field="schema" rows="4">${escapeHtml(JSON.stringify(schema, null, 2))}</textarea></td>
    <td><input data-field="href" value="${escapeAttr(formHref)}"></td>
    <td><input data-field="description" value="${escapeAttr(item.description || "")}"></td>
    <td>${removeButton()}</td>
  </tr>`;
}

function loggerRow(logger = {}) {
  return `<tr>
    <td><input data-field="property" value="${escapeAttr(logger.property || "")}"></td>
    <td><input data-field="csvRelativePath" value="${escapeAttr(logger.csvRelativePath || "")}"></td>
    <td><input data-field="columns" value="${escapeAttr((logger.columns || []).join(", "))}"></td>
    <td><textarea data-field="mappings" rows="4">${escapeHtml(JSON.stringify(logger.mappings || {}, null, 2))}</textarea></td>
    <td><input data-field="enabled" type="checkbox" ${logger.enabled !== false ? "checked" : ""}></td>
    <td>${removeButton()}</td>
  </tr>`;
}

function graphHtml(graph, edges) {
  return `
    <label><input data-graph="createDeviceNode" type="checkbox" ${graph.createDeviceNode !== false ? "checked" : ""}> Create device node</label>
    <label><input data-graph="createTopicNodes" type="checkbox" ${graph.createTopicNodes !== false ? "checked" : ""}> Create topic nodes</label>
    <label><input data-graph="createPhysicalIONodes" type="checkbox" ${graph.createPhysicalIONodes !== false ? "checked" : ""}> Create physical I/O nodes</label>
    <label style="display:block;margin-top:8px;">Edges JSON<textarea data-graph="edges" rows="12" style="width:100%;box-sizing:border-box;">${escapeHtml(JSON.stringify(edges, null, 2))}</textarea></label>
  `;
}

function renderMqttList(forms) {
  if (!forms.length) return `<div style="color:#6b7280;">No MQTT forms yet.</div>`;
  return forms.map((form) => `<div style="margin-bottom:8px;"><strong>${escapeHtml(form.kind)}:${escapeHtml(form.name)}</strong><br><code>${escapeHtml(form.topic)}</code></div>`).join("");
}

function collectTd(formPane, sidePane, baseTd) {
  const next = cloneThingDescription(baseTd || {});
  next.title = value(formPane, '[data-meta="title"]');
  next.id = value(formPane, '[data-meta="id"]');
  next.description = value(formPane, '[data-meta="description"]');
  next["@context"] = parseJsonField(formPane, '[data-meta="context"]', "@context");
  next.version = parseJsonField(formPane, '[data-meta="version"]', "version");
  next.nodevision = next.nodevision && typeof next.nodevision === "object" ? next.nodevision : {};
  next.nodevision.physicalIO = collectIo(formPane);
  next.properties = collectProperties(formPane, baseTd.properties || {});
  next.actions = collectAffordances(formPane, "actions", "action", baseTd.actions || {});
  next.events = collectAffordances(formPane, "events", "event", baseTd.events || {});
  next.nodevision.logging = next.nodevision.logging && typeof next.nodevision.logging === "object" ? next.nodevision.logging : {};
  next.nodevision.logging.csvLoggers = collectLoggers(formPane);
  next.nodevision.graph = collectGraph(sidePane, next.nodevision.graph || {});
  validateThingDescription(next);
  return next;
}

function collectIo(root) {
  return rows(root, "io").map((row) => ({
    name: rowValue(row, "name"),
    kind: rowValue(row, "kind"),
    pin: rowValue(row, "pin"),
    unit: rowValue(row, "unit"),
    description: rowValue(row, "description"),
  })).filter((item) => item.name);
}

function collectProperties(root, original) {
  const props = {};
  for (const row of rows(root, "properties")) {
    const name = rowValue(row, "name");
    if (!name) continue;
    const base = cloneThingDescription(original[row.dataset.originalName] || {});
    base.type = rowValue(row, "type") || "string";
    base.observable = row.querySelector('[data-field="observable"]')?.checked || false;
    base.unit = rowValue(row, "unit");
    base.description = rowValue(row, "description");
    base.forms = updateMqttForm(base.forms, rowValue(row, "href"), "observeproperty");
    props[name] = base;
  }
  return props;
}

function collectAffordances(root, tableName, kind, original) {
  const items = {};
  for (const row of rows(root, tableName)) {
    const name = rowValue(row, "name");
    if (!name) continue;
    const base = cloneThingDescription(original[row.dataset.originalName] || {});
    base.description = rowValue(row, "description");
    const schema = parseJsonText(rowValue(row, "schema"), `${kind} ${name} schema`);
    if (kind === "action") base.input = schema;
    else base.data = schema;
    base.forms = updateMqttForm(base.forms, rowValue(row, "href"), kind === "action" ? "invokeaction" : "subscribeevent");
    items[name] = base;
  }
  return items;
}

function collectLoggers(root) {
  return rows(root, "loggers").map((row) => ({
    id: `td-${safeId(rowValue(row, "property") || "logger")}`,
    name: `${rowValue(row, "property") || "Thing"} CSV Logger`,
    enabled: row.querySelector('[data-field="enabled"]')?.checked !== false,
    property: rowValue(row, "property"),
    csvRelativePath: rowValue(row, "csvRelativePath"),
    columns: rowValue(row, "columns").split(",").map((item) => item.trim()).filter(Boolean),
    mappings: parseJsonText(rowValue(row, "mappings"), "logger mappings"),
    timezone: "local",
    writeHeader: true,
    minIntervalMs: 0,
  })).filter((logger) => logger.property && logger.csvRelativePath && logger.columns.length);
}

function collectGraph(root, original) {
  return {
    ...original,
    createDeviceNode: root.querySelector('[data-graph="createDeviceNode"]')?.checked !== false,
    createTopicNodes: root.querySelector('[data-graph="createTopicNodes"]')?.checked !== false,
    createPhysicalIONodes: root.querySelector('[data-graph="createPhysicalIONodes"]')?.checked !== false,
    edges: parseJsonField(root, '[data-graph="edges"]', "graph edges"),
  };
}

function updateMqttForm(forms = [], href, op) {
  const next = Array.isArray(forms) ? cloneThingDescription(forms) : [];
  const idx = next.findIndex((form) => String(form?.href || "").startsWith("mqtt"));
  if (!href) return idx >= 0 ? next.filter((_, i) => i !== idx) : next;
  const form = { ...(idx >= 0 ? next[idx] : {}), href, op, contentType: "application/json" };
  if (idx >= 0) next[idx] = form;
  else next.push(form);
  return next;
}

function rows(root, tableName) {
  return Array.from(root.querySelectorAll(`[data-table="${tableName}"] tbody tr`));
}

function rowValue(row, field) {
  const el = row.querySelector(`[data-field="${field}"]`);
  return String(el?.value || "").trim();
}

function value(root, selector) {
  return String(root.querySelector(selector)?.value || "").trim();
}

function parseJsonField(root, selector, label) {
  return parseJsonText(root.querySelector(selector)?.value || "", label);
}

function parseJsonText(text, label) {
  try { return JSON.parse(text || "{}"); } catch (err) { throw new Error(`Invalid ${label} JSON: ${err.message}`); }
}

function table(name, headers, rowsHtml) {
  return `<table data-table="${name}" style="width:100%;border-collapse:collapse;margin-top:8px;"><thead><tr>${headers.map((h) => `<th style="text-align:left;border-bottom:1px solid #d8dde6;padding:4px;">${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rowsHtml}</tbody></table>`;
}

function panel(title, body) {
  return `<section style="border:1px solid #d8dde6;border-radius:8px;background:#fff;padding:10px;"><h3 style="font-size:14px;margin:0 0 8px;">${escapeHtml(title)}</h3>${body}</section>`;
}

function button(action, label) {
  return `<button data-action="${action}" type="button">${escapeHtml(label)}</button>`;
}

function removeButton() {
  return `<button data-action="remove-row" type="button" title="Remove">x</button>`;
}

function addTableRow(tbody, html) {
  if (!tbody) return;
  tbody.insertAdjacentHTML("beforeend", html);
}

function options(values, selected) {
  return values.map((value) => `<option value="${escapeAttr(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(value)}</option>`).join("");
}

function safeId(value = "item") {
  return String(value || "item").trim().replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}

function escapeHtml(value = "") {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(value = "") {
  return escapeHtml(value).replace(/"/g, "&quot;");
}
