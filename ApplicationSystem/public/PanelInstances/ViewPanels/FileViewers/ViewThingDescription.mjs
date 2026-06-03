// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewThingDescription.mjs
// W3C Web of Things Thing Description viewer for .td.json files.

import {
  deriveThingDescriptionGraph,
  extractCsvLoggersFromThingDescription,
  extractMqttForms,
  parseThingDescriptionText,
  securitySummary,
  summarizeThingDescription,
} from "/ThingDescription/ThingDescriptionModel.mjs";

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  const url = `${serverBase}/${filename}`;
  viewPanel.innerHTML = `<div style="padding:14px;font:13px/1.45 system-ui, sans-serif;">Loading Thing Description...</div>`;

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const td = parseThingDescriptionText(await response.text());
    renderThingDescription(viewPanel, td);
  } catch (err) {
    viewPanel.innerHTML = `<p style="color:#b00020;padding:14px;">Failed to load Thing Description: ${escapeHtml(err.message)}</p>`;
  }
}

export async function ViewThingDescription(filename, infoPanel, serverBase) {
  return renderFile(filename, infoPanel, null, serverBase);
}

function renderThingDescription(container, td) {
  const summary = summarizeThingDescription(td);
  const mqttForms = extractMqttForms(td);
  const loggers = extractCsvLoggersFromThingDescription(td);
  const graph = deriveThingDescriptionGraph(td);
  const graphNodes = graph.filter((item) => item.group === "nodes");
  const graphEdges = graph.filter((item) => item.group === "edges");

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px;padding:14px;box-sizing:border-box;font:13px/1.45 system-ui, sans-serif;color:#17202a;">
      <section style="border-bottom:1px solid #d8dde6;padding-bottom:10px;">
        <div style="font-size:20px;font-weight:700;">${escapeHtml(summary.title)}</div>
        <div style="color:#52606d;overflow-wrap:anywhere;">${escapeHtml(summary.id || "No id declared")}</div>
        ${summary.description ? `<p style="max-width:820px;margin:8px 0 0;">${escapeHtml(summary.description)}</p>` : ""}
      </section>

      <section>${kvTable([
        ["@context", formatContext(summary.context)],
        ["version", JSON.stringify(summary.version || {})],
        ["security", securitySummary(td)],
        ["properties", String(summary.propertyCount)],
        ["actions", String(summary.actionCount)],
        ["events", String(summary.eventCount)],
      ])}</section>

      ${renderAffordanceSection("Properties", td.properties || {}, "property")}
      ${renderAffordanceSection("Actions", td.actions || {}, "action")}
      ${renderAffordanceSection("Events", td.events || {}, "event")}
      ${renderMqttForms(mqttForms)}
      ${renderPhysicalIO(summary.physicalIO)}
      ${renderCsvLoggers(loggers)}
      ${renderGraphPreview(graphNodes, graphEdges)}

      <details>
        <summary style="cursor:pointer;font-weight:600;">View JSON</summary>
        <pre style="white-space:pre-wrap;overflow-wrap:anywhere;background:#f7f8fa;border:1px solid #d8dde6;border-radius:6px;padding:10px;">${escapeHtml(JSON.stringify(td, null, 2))}</pre>
      </details>
    </div>
  `;
}

function renderAffordanceSection(title, group, kind) {
  const entries = Object.entries(group || {});
  if (!entries.length) return section(title, `<div style="color:#6b7280;">None declared.</div>`);
  const rows = entries.map(([name, value]) => {
    const schema = kind === "action" ? value.input : kind === "event" ? value.data : value;
    return `
      <tr>
        <td><strong>${escapeHtml(name)}</strong></td>
        <td>${escapeHtml(value.title || value.description || "")}</td>
        <td>${escapeHtml(schema?.type || value.type || "")}</td>
        <td>${value.observable ? "observable" : ""}</td>
        <td>${escapeHtml(value.unit || "")}</td>
      </tr>`;
  }).join("");
  return section(title, `<table style="width:100%;border-collapse:collapse;">${tableHead(["Name", "Description", "Type", "Flags", "Unit"])}<tbody>${rows}</tbody></table>`);
}

function renderMqttForms(forms) {
  if (!forms.length) return section("MQTT Forms", `<div style="color:#6b7280;">No MQTT forms declared.</div>`);
  const rows = forms.map((form) => `
    <tr>
      <td>${escapeHtml(form.kind)}</td>
      <td>${escapeHtml(form.name)}</td>
      <td><code>${escapeHtml(form.topic)}</code></td>
      <td>${escapeHtml(String(form.op || ""))}</td>
      <td><code>${escapeHtml(form.href)}</code></td>
    </tr>`).join("");
  return section("MQTT Forms", `<table style="width:100%;border-collapse:collapse;">${tableHead(["Kind", "Affordance", "Topic", "Operation", "Href"])}<tbody>${rows}</tbody></table>`);
}

function renderPhysicalIO(items) {
  if (!items.length) return section("Nodevision Physical I/O", `<div style="color:#6b7280;">No physical I/O extension declared.</div>`);
  const rows = items.map((item) => `
    <tr><td>${escapeHtml(item.name || "")}</td><td>${escapeHtml(item.kind || "")}</td><td>${escapeHtml(item.pin || "")}</td><td>${escapeHtml(item.unit || "")}</td><td>${escapeHtml(item.description || "")}</td></tr>`).join("");
  return section("Nodevision Physical I/O", `<table style="width:100%;border-collapse:collapse;">${tableHead(["Name", "Kind", "Pin", "Unit", "Description"])}<tbody>${rows}</tbody></table>`);
}

function renderCsvLoggers(loggers) {
  if (!loggers.length) return section("Nodevision Logging", `<div style="color:#6b7280;">No CSV logging extension declared.</div>`);
  const rows = loggers.map((logger) => `
    <tr><td>${escapeHtml(logger.name)}</td><td>${escapeHtml(logger.topicFilter)}</td><td>${escapeHtml(logger.csvRelativePath)}</td><td>${escapeHtml(logger.columns.join(", "))}</td></tr>`).join("");
  return section("Nodevision Logging", `<table style="width:100%;border-collapse:collapse;">${tableHead(["Name", "Topic Filter", "CSV", "Columns"])}<tbody>${rows}</tbody></table>`);
}

function renderGraphPreview(nodes, edges) {
  const nodeHtml = nodes.slice(0, 16).map((node) => `<li>${escapeHtml(node.data.type)}: ${escapeHtml(node.data.label)}</li>`).join("");
  const edgeHtml = edges.slice(0, 16).map((edge) => `<li>${escapeHtml(edge.data.source)} -> ${escapeHtml(edge.data.target)} <em>${escapeHtml(edge.data.label)}</em></li>`).join("");
  return section("Graph Relationships Preview", `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;">
      <div><strong>${nodes.length} derived node(s)</strong><ul>${nodeHtml || "<li>None</li>"}</ul></div>
      <div><strong>${edges.length} derived edge(s)</strong><ul>${edgeHtml || "<li>None</li>"}</ul></div>
    </div>`);
}

function section(title, body) {
  return `<section style="border:1px solid #d8dde6;border-radius:8px;padding:10px;background:#fff;"><h3 style="font-size:14px;margin:0 0 8px;">${escapeHtml(title)}</h3>${body}</section>`;
}

function tableHead(labels) {
  return `<thead><tr>${labels.map((label) => `<th style="text-align:left;border-bottom:1px solid #d8dde6;padding:5px;">${escapeHtml(label)}</th>`).join("")}</tr></thead>`;
}

function kvTable(rows) {
  return `<table style="width:100%;border-collapse:collapse;">${rows.map(([key, value]) => `<tr><th style="text-align:left;width:130px;padding:4px;border-bottom:1px solid #eef1f5;color:#52606d;">${escapeHtml(key)}</th><td style="padding:4px;border-bottom:1px solid #eef1f5;overflow-wrap:anywhere;">${escapeHtml(value)}</td></tr>`).join("")}</table>`;
}

function formatContext(context) {
  if (Array.isArray(context)) return context.map((item) => typeof item === "string" ? item : JSON.stringify(item)).join(", ");
  if (context && typeof context === "object") return JSON.stringify(context);
  return String(context || "");
}

function escapeHtml(value = "") {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
