// Nodevision/ApplicationSystem/public/ThingDescription/ThingDescriptionModel.mjs
// Shared W3C WoT Thing Description helpers for viewers, editors, graph derivation, and CSV logger integration.

const TD_CONTEXT = "https://www.w3.org/2022/wot/td/v1.1";

export function isThingDescriptionPath(path = "") {
  return String(path || "").toLowerCase().replace(/%2e/g, ".").endsWith(".td.json");
}

export function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function parseThingDescriptionText(text) {
  let parsed;
  try {
    parsed = JSON.parse(String(text || ""));
  } catch (err) {
    throw new Error(`Invalid JSON: ${err.message}`);
  }
  if (!isPlainObject(parsed)) throw new Error("Thing Description must be a JSON object");
  return parsed;
}

export function validateThingDescription(td) {
  if (!isPlainObject(td)) throw new Error("Thing Description must be an object");
  if (td.properties !== undefined && !isPlainObject(td.properties)) throw new Error("TD properties must be an object");
  if (td.actions !== undefined && !isPlainObject(td.actions)) throw new Error("TD actions must be an object");
  if (td.events !== undefined && !isPlainObject(td.events)) throw new Error("TD events must be an object");
  const csvLoggers = extractCsvLoggersFromThingDescription(td);
  for (const logger of csvLoggers) validateSafeCsvRelativePath(logger.csvRelativePath);
  return true;
}

export function cloneThingDescription(td) {
  return JSON.parse(JSON.stringify(td || {}));
}

function arrayify(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function displayName(value = "") {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function safeId(value = "td") {
  const id = String(value || "td").trim().replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return id || "td";
}

function thingKey(td) {
  return safeId(td?.id || td?.title || "thing");
}

function parseMqttTopicFromHref(href = "") {
  const raw = String(href || "").trim();
  if (!raw) return "";
  if (!/^mqtts?:\/\//i.test(raw)) return "";
  try {
    const url = new URL(raw);
    const pathTopic = decodeURIComponent((url.pathname || "").replace(/^\/+/, ""));
    if (pathTopic) return pathTopic;
    return decodeURIComponent(`${url.hostname}${url.pathname || ""}`.replace(/^\/+/, ""));
  } catch {
    return raw.replace(/^mqtts?:\/\/[^/]*\/?/i, "").replace(/^\/+/, "");
  }
}

export function extractMqttForms(td = {}) {
  const forms = [];
  const affordanceGroups = [
    ["property", td.properties || {}],
    ["action", td.actions || {}],
    ["event", td.events || {}],
  ];

  for (const [kind, group] of affordanceGroups) {
    if (!isPlainObject(group)) continue;
    for (const [name, affordance] of Object.entries(group)) {
      for (const form of arrayify(affordance?.forms)) {
        const href = String(form?.href || "").trim();
        const topic = parseMqttTopicFromHref(href);
        if (!topic) continue;
        forms.push({
          kind,
          name,
          href,
          topic,
          op: form?.op || defaultOperationForKind(kind),
          contentType: form?.contentType || affordance?.contentType || "application/json",
        });
      }
    }
  }
  return forms;
}

function defaultOperationForKind(kind) {
  if (kind === "action") return "invokeaction";
  if (kind === "event") return "subscribeevent";
  return "observeproperty";
}

export function securitySummary(td = {}) {
  const security = arrayify(td.security).filter(Boolean);
  const definitions = td.securityDefinitions || {};
  if (!security.length && !Object.keys(definitions).length) return "No security metadata declared";
  const labels = security.map((key) => {
    const definition = definitions?.[key];
    if (!definition) return String(key);
    return `${key}: ${definition.scheme || "scheme"}`;
  });
  return labels.join(", ") || `${Object.keys(definitions).length} security definition(s)`;
}

export function summarizeThingDescription(td = {}) {
  return {
    title: td.title || "Untitled Thing",
    id: td.id || "",
    description: td.description || "",
    context: td["@context"] || "",
    version: td.version || {},
    security: securitySummary(td),
    propertyCount: Object.keys(td.properties || {}).length,
    actionCount: Object.keys(td.actions || {}).length,
    eventCount: Object.keys(td.events || {}).length,
    mqttForms: extractMqttForms(td),
    physicalIO: arrayify(td.nodevision?.physicalIO),
    logging: extractCsvLoggersFromThingDescription(td),
    graph: deriveThingDescriptionGraph(td),
  };
}

export function validateSafeCsvRelativePath(csvRelativePath = "") {
  const rel = String(csvRelativePath || "").trim();
  if (!rel) throw new Error("csvRelativePath is required");
  if (rel.startsWith("/") || /^[A-Za-z]:/.test(rel)) throw new Error("csvRelativePath must be Notebook-relative");
  if (rel.includes("\\")) throw new Error("csvRelativePath must use forward slashes");
  const parts = rel.split("/").filter(Boolean);
  if (parts.some((part) => part === "..")) throw new Error("csvRelativePath must not contain ..");
  if (parts.some((part) => part === "ServerSettings" || /token|secret|privatekey/i.test(part))) {
    throw new Error("csvRelativePath contains a restricted segment");
  }
  if (!/\.csv$/i.test(rel)) throw new Error("csvRelativePath must end with .csv");
  return rel;
}

function loggerIdFor(td, entry = {}) {
  return safeId(entry.id || `${td.title || td.id || "thing"}-${entry.property || entry.name || "logger"}`.toLowerCase());
}

function topicForLoggingEntry(td, entry = {}) {
  if (entry.topicFilter) return String(entry.topicFilter);
  const propertyName = entry.property || entry.affordance;
  const form = extractMqttForms(td).find((candidate) => candidate.kind === "property" && candidate.name === propertyName);
  return form?.topic || "";
}

export function extractCsvLoggersFromThingDescription(td = {}) {
  const logging = td.nodevision?.logging;
  if (!isPlainObject(logging)) return [];
  const entries = [
    ...arrayify(logging.csvLoggers),
    ...arrayify(logging.propertyCsv),
  ].filter(isPlainObject);

  return entries.map((entry) => {
    const columns = arrayify(entry.columns).map(String).filter(Boolean);
    const mappings = isPlainObject(entry.mappings) ? { ...entry.mappings } : {};
    return {
      id: loggerIdFor(td, entry),
      name: entry.name || `${td.title || "Thing"} ${displayName(entry.property || "CSV Logger")}`,
      enabled: entry.enabled !== false,
      topicFilter: topicForLoggingEntry(td, entry),
      csvRelativePath: validateSafeCsvRelativePath(entry.csvRelativePath || ""),
      columns,
      mappings,
      timezone: entry.timezone || "local",
      writeHeader: entry.writeHeader !== false,
      minIntervalMs: Math.max(0, Number(entry.minIntervalMs || 0)),
      source: "thing-description",
      thingId: td.id || "",
      property: entry.property || "",
    };
  }).filter((logger) => logger.topicFilter && logger.columns.length > 0);
}

function addUnique(elements, seen, element) {
  const id = element?.data?.id;
  if (!id || seen.has(id)) return;
  seen.add(id);
  elements.push(element);
}

function node(id, label, type, extra = {}) {
  return { group: "nodes", data: { id, label, type, source: "thing-description", ...extra } };
}

function edge(id, source, target, label, extra = {}) {
  return { group: "edges", data: { id, source, target, label, layer: "thing-description", ...extra } };
}

export function deriveThingDescriptionGraph(td = {}) {
  const elements = [];
  const seen = new Set();
  const key = thingKey(td);
  const deviceId = `td:${key}:device`;
  addUnique(elements, seen, node(deviceId, td.title || td.id || "Thing", "td-device", { thingId: td.id || "" }));

  const mqttForms = extractMqttForms(td);
  const formsByAffordance = new Map();
  for (const form of mqttForms) {
    const affordanceKey = `${form.kind}:${form.name}`;
    if (!formsByAffordance.has(affordanceKey)) formsByAffordance.set(affordanceKey, []);
    formsByAffordance.get(affordanceKey).push(form);
    const topicId = `td:${key}:topic:${safeId(form.topic)}`;
    addUnique(elements, seen, node(topicId, form.topic, "td-topic", { topic: form.topic, href: form.href }));
  }

  for (const [name, property] of Object.entries(td.properties || {})) {
    const propertyId = `td:${key}:property:${safeId(name)}`;
    addUnique(elements, seen, node(propertyId, name, "td-property", { observable: Boolean(property?.observable), dataType: property?.type || "" }));
    addUnique(elements, seen, edge(`td:${key}:edge:device-property:${safeId(name)}`, deviceId, propertyId, property?.observable ? "observes" : "has_property"));
    for (const form of formsByAffordance.get(`property:${name}`) || []) {
      const topicId = `td:${key}:topic:${safeId(form.topic)}`;
      addUnique(elements, seen, edge(`td:${key}:edge:property-topic:${safeId(name)}:${safeId(form.topic)}`, propertyId, topicId, "publishes"));
    }
  }

  for (const [name] of Object.entries(td.actions || {})) {
    const actionId = `td:${key}:action:${safeId(name)}`;
    addUnique(elements, seen, node(actionId, name, "td-action"));
    addUnique(elements, seen, edge(`td:${key}:edge:device-action:${safeId(name)}`, deviceId, actionId, "has_action"));
    for (const form of formsByAffordance.get(`action:${name}`) || []) {
      const topicId = `td:${key}:topic:${safeId(form.topic)}`;
      addUnique(elements, seen, edge(`td:${key}:edge:action-topic:${safeId(name)}:${safeId(form.topic)}`, actionId, topicId, "commands"));
    }
  }

  for (const [name] of Object.entries(td.events || {})) {
    const eventId = `td:${key}:event:${safeId(name)}`;
    addUnique(elements, seen, node(eventId, name, "td-event"));
    addUnique(elements, seen, edge(`td:${key}:edge:device-event:${safeId(name)}`, deviceId, eventId, "emits"));
    for (const form of formsByAffordance.get(`event:${name}`) || []) {
      const topicId = `td:${key}:topic:${safeId(form.topic)}`;
      addUnique(elements, seen, edge(`td:${key}:edge:event-topic:${safeId(name)}:${safeId(form.topic)}`, eventId, topicId, "notifies"));
    }
  }

  for (const io of arrayify(td.nodevision?.physicalIO).filter(isPlainObject)) {
    const ioId = `td:${key}:io:${safeId(io.name)}`;
    addUnique(elements, seen, node(ioId, io.name || "Physical I/O", "td-physical-io", { kind: io.kind || "", pin: io.pin || "", unit: io.unit || "" }));
    const rel = io.kind === "actuator" || io.kind === "output" ? "has_actuator" : "has_sensor";
    addUnique(elements, seen, edge(`td:${key}:edge:device-io:${safeId(io.name)}`, deviceId, ioId, rel));
  }

  for (const logger of extractCsvLoggersFromThingDescription(td)) {
    const csvId = `td:${key}:csv:${safeId(logger.csvRelativePath)}`;
    addUnique(elements, seen, node(csvId, logger.csvRelativePath, "td-csv", { csvRelativePath: logger.csvRelativePath }));
    const topicId = `td:${key}:topic:${safeId(logger.topicFilter)}`;
    addUnique(elements, seen, node(topicId, logger.topicFilter, "td-topic", { topic: logger.topicFilter }));
    addUnique(elements, seen, edge(`td:${key}:edge:topic-csv:${safeId(logger.id)}`, topicId, csvId, "logs_to"));
  }

  for (const hint of arrayify(td.nodevision?.graph?.edges).filter(isPlainObject)) {
    const from = hint.from || hint.source;
    const to = hint.to || hint.target;
    if (!from || !to) continue;
    const fromId = resolveGraphHintId(td, from);
    const toId = resolveGraphHintId(td, to);
    addUnique(elements, seen, edge(`td:${key}:edge:hint:${safeId(from)}:${safeId(to)}:${safeId(hint.label || hint.type || "rel")}`, fromId, toId, hint.label || hint.type || "relates_to", { hinted: true }));
  }

  return elements;
}

function resolveGraphHintId(td, ref = "") {
  const key = thingKey(td);
  const value = String(ref || "");
  if (value === "device") return `td:${key}:device`;
  if (value.startsWith("property:")) return `td:${key}:property:${safeId(value.slice(9))}`;
  if (value.startsWith("action:")) return `td:${key}:action:${safeId(value.slice(7))}`;
  if (value.startsWith("event:")) return `td:${key}:event:${safeId(value.slice(6))}`;
  if (value.startsWith("io:")) return `td:${key}:io:${safeId(value.slice(3))}`;
  if (value.startsWith("topic:")) return `td:${key}:topic:${safeId(value.slice(6))}`;
  if (value.startsWith("csv:")) return `td:${key}:csv:${safeId(value.slice(4))}`;
  return `td:${key}:hint:${safeId(value)}`;
}

export function buildGardenBed1Template() {
  return {
    "@context": [TD_CONTEXT, { nv: "https://nodevision.local/ns#" }],
    title: "Garden Bed 1 Controller",
    id: "urn:nodevision:thing:garden-bed1-controller",
    description: "ESP32 garden controller for Garden Bed 1 moisture sensing and pump control.",
    version: { instance: "1.0.0" },
    securityDefinitions: { nosec_sc: { scheme: "nosec" } },
    security: ["nosec_sc"],
    properties: {
      moisture: {
        title: "Moisture",
        description: "Raw ADC soil moisture reading from GPIO 34.",
        type: "integer",
        observable: true,
        unit: "raw ADC",
        forms: [
          { href: "mqtt://localhost/nodevision/iot/garden/bed1/moisture", op: "observeproperty", contentType: "application/json" }
        ]
      }
    },
    actions: {
      setPump: {
        title: "Set Pump",
        description: "Turn the pump relay on or off.",
        input: {
          type: "object",
          properties: { pumpOn: { type: "boolean" } },
          required: ["pumpOn"]
        },
        forms: [
          { href: "mqtt://localhost/nodevision/iot/garden/bed1/pump/set", op: "invokeaction", contentType: "application/json" }
        ]
      }
    },
    events: {
      lowMoisture: {
        title: "Low Moisture",
        description: "Emitted when moisture drops below the configured threshold.",
        data: {
          type: "object",
          properties: {
            moisture: { type: "integer" },
            threshold: { type: "integer" }
          }
        },
        forms: [
          { href: "mqtt://localhost/nodevision/iot/garden/bed1/low-moisture", op: "subscribeevent", contentType: "application/json" }
        ]
      }
    },
    nodevision: {
      physicalIO: [
        { name: "moisture sensor", kind: "sensor", pin: "GPIO 34", unit: "raw ADC", description: "Soil moisture potentiometer or capacitive sensor." },
        { name: "relay/pump", kind: "actuator", pin: "GPIO 26", unit: "boolean", description: "Relay output for the pump motor." }
      ],
      logging: {
        csvLoggers: [
          {
            id: "garden-bed1-moisture",
            name: "Garden Bed 1 Moisture",
            enabled: true,
            property: "moisture",
            csvRelativePath: "IoTGarden/MoistureReadings.csv",
            columns: ["Date", "Time", "Moisture Reading"],
            mappings: { Date: "$date", Time: "$time", "Moisture Reading": "moisture" },
            timezone: "local",
            writeHeader: true,
            minIntervalMs: 0
          }
        ]
      },
      graph: {
        createDeviceNode: true,
        createTopicNodes: true,
        createPhysicalIONodes: true,
        edges: [
          { from: "device", to: "io:moisture sensor", label: "has_sensor" },
          { from: "io:moisture sensor", to: "topic:nodevision/iot/garden/bed1/moisture", label: "publishes" },
          { from: "topic:nodevision/iot/garden/bed1/moisture", to: "csv:IoTGarden/MoistureReadings.csv", label: "logs_to" },
          { from: "action:setPump", to: "io:relay/pump", label: "controls" }
        ]
      },
      dashboard: {
        group: "Garden Bed 1",
        primaryProperty: "moisture"
      }
    }
  };
}

export function formatThingDescription(td) {
  validateThingDescription(td);
  return `${JSON.stringify(td, null, 2)}\n`;
}
