// Nodevision/ApplicationSystem/MessageBroker/test-broker-retained-route-shape.mjs
// Tests the safe /api/broker/retained projection helper used by brokerRoutes.mjs.

import { createBroker } from "./BrokerCore.mjs";
import { listSafeBrokerRetained } from "../server/routes/brokerRoutes.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function serialized(value) {
  return JSON.stringify(value);
}

async function main() {
  const broker = createBroker({ maxEvents: 10 });
  broker.publish("nodevision/iot/garden/bed1/moisture", {
    device: "wokwi-esp32-garden",
    moisture: 1234,
    pumpOn: true,
    privateKey: "do-not-return",
    tokenHash: "do-not-return",
    path: "/home/henry/ServerSettings/private.key",
  }, { retain: true, publisherId: "wokwi-garden-test" });
  broker.publish("nodevision/iot/garden/bed2/moisture", { moisture: 999 }, { retain: true, publisherId: "wokwi-garden-test" });
  broker.publish("nodevision/sync/job/state", { jobId: "sync-job", privateKey: "do-not-return" }, { retain: true, publisherId: "sync" });

  const filtered = listSafeBrokerRetained(broker, { topicPrefix: "nodevision/iot/", limit: 50 });
  assert(filtered.length === 2, "topicPrefix should return only IoT retained messages");
  assert(filtered.every((message) => message.topic.startsWith("nodevision/iot/")), "all retained messages should match prefix");
  assert(filtered[0].publisherId === "wokwi-garden-test", "publisherId should be included");
  assert(filtered[0].payload.device === "wokwi-esp32-garden", "safe IoT payload fields should be retained");

  const limited = listSafeBrokerRetained(broker, { topicPrefix: "nodevision/iot/", limit: 1 });
  assert(limited.length === 1, "limit should cap retained results");
  assert(limited[0].topic === "nodevision/iot/garden/bed2/moisture", "limit should keep most recent matching retained message");

  const text = serialized(filtered);
  assert(!text.includes("privateKey"), "privateKey should not be exposed");
  assert(!text.includes("tokenHash"), "tokenHash should not be exposed");
  assert(!text.includes("do-not-return"), "sensitive values should not be exposed");
  assert(!text.includes("ServerSettings"), "ServerSettings paths should not be exposed");
  assert(!text.includes("/home/"), "absolute paths should not be exposed");

  console.log("PASS");
}

main().catch((err) => {
  console.error("Broker retained route shape test failed:", err);
  process.exitCode = 1;
});
