// Nodevision/ApplicationSystem/public/ThingDescription/test-thing-description-model.mjs

import assert from "node:assert/strict";

import {
  buildGardenBed1Template,
  cloneThingDescription,
  deriveThingDescriptionGraph,
  extractCsvLoggersFromThingDescription,
  extractMqttForms,
  formatThingDescription,
  parseThingDescriptionText,
  validateSafeCsvRelativePath,
} from "./ThingDescriptionModel.mjs";

const validTdText = JSON.stringify({
  "@context": ["https://www.w3.org/2022/wot/td/v1.1"],
  title: "Test Thing",
  id: "urn:test:thing",
  securityDefinitions: { nosec_sc: { scheme: "nosec" } },
  security: ["nosec_sc"],
  properties: {
    moisture: {
      type: "integer",
      observable: true,
      forms: [{ href: "mqtt://localhost/nodevision/iot/garden/bed1/moisture", op: "observeproperty" }],
      "x-unknown-property-field": true,
    }
  },
  actions: {
    setPump: {
      input: { type: "object", properties: { pumpOn: { type: "boolean" } } },
      forms: [{ href: "mqtt://localhost/nodevision/iot/garden/bed1/pump/set", op: "invokeaction" }]
    }
  },
  nodevision: {
    physicalIO: [{ name: "moisture sensor", kind: "sensor", pin: "GPIO 34" }],
    logging: {
      csvLoggers: [{
        id: "garden-bed1-moisture",
        name: "Garden Bed 1 Moisture",
        enabled: true,
        property: "moisture",
        csvRelativePath: "IoTGarden/MoistureReadings.csv",
        columns: ["Date", "Time", "Moisture Reading"],
        mappings: { Date: "$date", Time: "$time", "Moisture Reading": "moisture" }
      }]
    },
    customExtension: { shouldSurvive: true }
  },
  "x-standard-extension": { shouldSurvive: true }
});

const td = parseThingDescriptionText(validTdText);
assert.equal(td.title, "Test Thing", "loads valid TD JSON");

const edited = cloneThingDescription(td);
edited.title = "Edited Thing";
const saved = parseThingDescriptionText(formatThingDescription(edited));
assert.equal(saved["x-standard-extension"].shouldSurvive, true, "preserves unknown standard TD fields");
assert.equal(saved.nodevision.customExtension.shouldSurvive, true, "preserves unknown nodevision extension fields");
assert.equal(saved.properties.moisture["x-unknown-property-field"], true, "preserves unknown affordance fields");

const template = buildGardenBed1Template();
assert.equal(template.title, "Garden Bed 1 Controller", "generates Garden Bed 1 template");
assert.ok(template.properties.moisture, "template includes moisture property");
assert.ok(template.actions.setPump, "template includes setPump action");

const topics = extractMqttForms(template).map((form) => form.topic).sort();
assert.ok(topics.includes("nodevision/iot/garden/bed1/moisture"), "extracts property MQTT topic");
assert.ok(topics.includes("nodevision/iot/garden/bed1/pump/set"), "extracts action MQTT topic");

const graph = deriveThingDescriptionGraph(template);
assert.ok(graph.some((item) => item.group === "nodes" && item.data.type === "td-device"), "derives device node");
assert.ok(graph.some((item) => item.group === "nodes" && item.data.type === "td-physical-io"), "derives physical I/O node");
assert.ok(graph.some((item) => item.group === "edges" && item.data.label === "logs_to"), "derives CSV logging edge");
assert.ok(graph.some((item) => item.group === "edges" && item.data.label === "controls"), "derives action control edge from graph hints");

const loggers = extractCsvLoggersFromThingDescription(template);
assert.equal(loggers.length, 1, "extracts CSV logger config from nodevision.logging");
assert.equal(loggers[0].topicFilter, "nodevision/iot/garden/bed1/moisture", "CSV logger uses property MQTT topic");
assert.equal(loggers[0].csvRelativePath, "IoTGarden/MoistureReadings.csv", "CSV logger keeps compatible Notebook-relative path");

assert.throws(() => parseThingDescriptionText("{bad json"), /Invalid JSON/, "rejects invalid JSON");
assert.throws(() => validateSafeCsvRelativePath("../bad.csv"), /\.\./, "rejects path traversal");
assert.throws(() => validateSafeCsvRelativePath("/tmp/bad.csv"), /Notebook-relative/, "rejects absolute paths");
assert.throws(() => validateSafeCsvRelativePath("IoT\\bad.csv"), /forward slashes/, "rejects backslash paths");

console.log("PASS test-thing-description-model");
