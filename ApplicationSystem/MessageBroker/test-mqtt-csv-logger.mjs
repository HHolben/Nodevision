// Nodevision/ApplicationSystem/MessageBroker/test-mqtt-csv-logger.mjs
// Tests MQTT topic-to-Notebook CSV logger mapping, safety, config, and broker subscription behavior.

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createBroker } from "./BrokerCore.mjs";
import {
  appendCsvLoggerRow,
  buildCsvLoggerRow,
  loadTopicCsvLoggerConfig,
  saveTopicCsvLoggerConfig,
  loadThingDescriptionCsvLoggers,
  startMqttCsvLoggers,
} from "./MQTTCsvLogger.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitFor(condition, message, timeoutMs = 1000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(message);
}

async function readIfExists(filePath) {
  try { return await fs.readFile(filePath, "utf8"); } catch (err) { if (err?.code === "ENOENT") return ""; throw err; }
}

function baseLogger(overrides = {}) {
  return {
    id: "garden-bed1-moisture",
    name: "Garden Bed 1 Moisture",
    enabled: true,
    topicFilter: "nodevision/iot/garden/bed1/moisture",
    csvRelativePath: "IoTGarden/MoistureReadings.csv",
    columns: ["Date", "Time", "Moisture Reading"],
    mappings: { Date: "$date", Time: "$time", "Moisture Reading": "moisture" },
    timezone: "local",
    writeHeader: true,
    minIntervalMs: 0,
    ...overrides,
  };
}

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "nodevision-mqtt-csv-"));
  const notebookDir = path.join(root, "Notebook");
  const settingsDir = path.join(root, "ServerSettings");
  const fixedNow = () => new Date("2026-05-28T19:42:10");
  const logger = baseLogger();
  const message = {
    topic: logger.topicFilter,
    payload: { device: "wokwi-esp32-garden", moisture: 1775, threshold: 2000, pumpOn: true },
    retained: true,
    timestamp: "2026-05-28T19:42:00.000Z",
    publisherId: "wokwi-garden-test",
  };

  const row = buildCsvLoggerRow({ logger, message, now: fixedNow });
  assert(row.headers.join(",") === "Date,Time,Moisture Reading", "headers should map from columns");
  assert(row.row.join(",") === "2026-05-28,19:42:10,1775", "$date/$time/moisture should map");

  await appendCsvLoggerRow({ notebookDir, logger, message, now: fixedNow });
  const csvPath = path.join(notebookDir, "IoTGarden", "MoistureReadings.csv");
  let text = await readIfExists(csvPath);
  assert(text === "Date,Time,Moisture Reading\n2026-05-28,19:42:10,1775\n", "append should create CSV with header and row");

  await appendCsvLoggerRow({ notebookDir, logger, { ...message, payload: { moisture: 1800 } }, now: fixedNow });
  text = await readIfExists(csvPath);
  assert(text.split("\n").filter(Boolean).length === 3, "header should be written once and multiple rows appended");

  const escapingLogger = baseLogger({
    csvRelativePath: "IoTGarden/Escaping.csv",
    columns: ["Comma", "Quote", "Newline"],
    mappings: { Comma: "comma", Quote: "quote", Newline: "newline" },
  });
  await appendCsvLoggerRow({
    notebookDir,
    logger: escapingLogger,
    message: { ...message, payload: { comma: "a,b", quote: "a\"b", newline: "a\nb" } },
    now: fixedNow,
  });
  text = await readIfExists(path.join(notebookDir, "IoTGarden", "Escaping.csv"));
  assert(text.includes('"a,b","a""b","a\nb"'), "CSV values should be escaped");

  for (const badPath of ["../bad.csv", "/tmp/bad.csv", "IoT\\bad.csv"]) {
    let rejected = false;
    try { await appendCsvLoggerRow({ notebookDir, logger: baseLogger({ csvRelativePath: badPath }), message, now: fixedNow }); } catch { rejected = true; }
    assert(rejected, `${badPath} should be rejected`);
  }

  const missingConfig = await loadTopicCsvLoggerConfig({ settingsDir: path.join(root, "MissingSettings") });
  assert(Array.isArray(missingConfig.loggers) && missingConfig.loggers.length === 0, "missing config should load as empty default");

  await saveTopicCsvLoggerConfig({
    settingsDir,
    config: {
      loggers: [
        baseLogger({ id: "disabled", enabled: false, csvRelativePath: "IoTGarden/Disabled.csv" }),
        baseLogger({ id: "enabled", csvRelativePath: "IoTGarden/Enabled.csv" }),
      ],
    },
  });
  const broker = createBroker({ maxEvents: 10 });
  const cleanup = await startMqttCsvLoggers({ broker, notebookDir, settingsDir, now: fixedNow });
  assert(cleanup.count === 1, "disabled logger should not subscribe");
  broker.publish(logger.topicFilter, { moisture: 1900 }, { retain: true, publisherId: "mqtt-test" });
  await waitFor(async () => (await readIfExists(path.join(notebookDir, "IoTGarden", "Enabled.csv"))).includes("1900"), "enabled logger should append retained-style publish");
  assert(await readIfExists(path.join(notebookDir, "IoTGarden", "Disabled.csv")) === "", "disabled logger should not write");
  cleanup();

  let mutableNow = new Date("2026-05-28T19:42:10");
  await saveTopicCsvLoggerConfig({ settingsDir, config: { loggers: [baseLogger({ id: "throttle", csvRelativePath: "IoTGarden/Throttle.csv", minIntervalMs: 1000 })] } });
  const throttledBroker = createBroker({ maxEvents: 10 });
  const throttledCleanup = await startMqttCsvLoggers({ throttledBroker, broker: throttledBroker, notebookDir, settingsDir, now: () => mutableNow });
  throttledBroker.publish(logger.topicFilter, { moisture: 2000 }, { publisherId: "mqtt-test" });
  throttledBroker.publish(logger.topicFilter, { moisture: 2001 }, { publisherId: "mqtt-test" });
  await waitFor(async () => (await readIfExists(path.join(notebookDir, "IoTGarden", "Throttle.csv"))).includes("2000"), "first throttled row should write");
  text = await readIfExists(path.join(notebookDir, "IoTGarden", "Throttle.csv"));
  assert(!text.includes("2001"), "minIntervalMs should throttle immediate second row");
  mutableNow = new Date("2026-05-28T19:42:11.100");
  throttledBroker.publish(logger.topicFilter, { moisture: 2002 }, { publisherId: "mqtt-test" });
  await waitFor(async () => (await readIfExists(path.join(notebookDir, "IoTGarden", "Throttle.csv"))).includes("2002"), "row after minIntervalMs should write");
  throttledCleanup();

  await saveTopicCsvLoggerConfig({ settingsDir, config: { loggers: [] } });
  await fs.writeFile(path.join(notebookDir, "GardenBed1Controller.td.json"), JSON.stringify({
    "@context": ["https://www.w3.org/2022/wot/td/v1.1"],
    title: "Garden Bed 1 Controller",
    id: "urn:nodevision:thing:garden-bed1-controller",
    securityDefinitions: { nosec_sc: { scheme: "nosec" } },
    security: ["nosec_sc"],
    properties: {
      moisture: {
        type: "integer",
        observable: true,
        forms: [{ href: "mqtt://localhost/nodevision/iot/garden/bed1/moisture", op: "observeproperty" }],
      },
    },
    nodevision: {
      logging: {
        csvLoggers: [{
          id: "td-garden-bed1-moisture",
          name: "TD Garden Bed 1 Moisture",
          enabled: true,
          property: "moisture",
          csvRelativePath: "IoTGarden/TdMoisture.csv",
          columns: ["Date", "Time", "Moisture Reading"],
          mappings: { Date: "$date", Time: "$time", "Moisture Reading": "moisture" },
        }],
      },
    },
  }, null, 2), "utf8");
  const tdLoggers = await loadThingDescriptionCsvLoggers({ notebookDir });
  assert(tdLoggers.some((item) => item.id === "td-garden-bed1-moisture"), "TD file should generate compatible CSV logger config");
  const tdBroker = createBroker({ maxEvents: 10 });
  const tdCleanup = await startMqttCsvLoggers({ broker: tdBroker, notebookDir, settingsDir, now: fixedNow });
  assert(tdCleanup.count === 1, "TD-derived logger should subscribe");
  tdBroker.publish(logger.topicFilter, { moisture: 2222 }, { retain: true, publisherId: "mqtt-td-test" });
  await waitFor(async () => (await readIfExists(path.join(notebookDir, "IoTGarden", "TdMoisture.csv"))).includes("2222"), "TD-derived logger should write CSV row");
  tdCleanup();

  const jsonStringRow = buildCsvLoggerRow({ logger, message: { ...message, payload: '{"moisture":2111}' }, now: fixedNow });
  assert(jsonStringRow.row[2] === "2111", "JSON string payload should parse");

  await fs.rm(root, { recursive: true, force: true });
  console.log("PASS");
}

main().catch((err) => {
  console.error("MQTT CSV logger test failed:", err);
  process.exitCode = 1;
});
