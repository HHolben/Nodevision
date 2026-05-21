// Nodevision/ApplicationSystem/MessageBroker/test-broker-core.mjs
// Tests for the internal MQTT-style broker core.

import { createBroker } from "./BrokerCore.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function expectThrow(label, fn) {
  let didThrow = false;
  try {
    fn();
  } catch {
    didThrow = true;
  }
  assert(didThrow, `${label} should throw`);
}

async function main() {
  const broker = createBroker({ maxEvents: 4 });
  const exactMessages = [];
  const wildcardMessages = [];

  broker.subscribe("nodevision/test", (message) => exactMessages.push(message));
  broker.subscribe("nodevision/#", (message) => wildcardMessages.push(message));

  broker.publish("nodevision/test", { hello: "world" }, { publisherId: "test-suite" });
  assert(exactMessages.length === 1, "exact subscriber should receive publish");
  assert(exactMessages[0].payload.hello === "world", "exact subscriber payload mismatch");
  assert(wildcardMessages.length === 1, "wildcard subscriber should receive publish");

  const unsubscribe = broker.subscribe("garden/+/moisture", (message) => wildcardMessages.push(message));
  broker.publish("garden/bed1/moisture", { value: 42 });
  assert(wildcardMessages.some((message) => message.topic === "garden/bed1/moisture"), "+ wildcard subscriber should receive publish");
  unsubscribe();
  broker.publish("garden/bed1/moisture", { value: 43 });
  const gardenMessages = wildcardMessages.filter((message) => message.topic === "garden/bed1/moisture");
  assert(gardenMessages.length === 1, "unsubscribe should stop future deliveries");

  broker.publish("nodevision/status", { online: true }, { retain: true });
  const retainedMessages = [];
  broker.subscribe("nodevision/status", (message) => retainedMessages.push(message));
  assert(retainedMessages.length === 1, "later subscriber should receive retained message");
  assert(retainedMessages[0].retained === true, "retained replay should be marked retained");
  assert(retainedMessages[0].payload.online === true, "retained payload mismatch");

  assert(broker.getRetained("nodevision/status")?.payload.online === true, "getRetained should return retained message");
  assert(broker.clearRetained("nodevision/status") === true, "clearRetained should remove retained message");
  assert(broker.getRetained("nodevision/status") === null, "retained message should be cleared");

  expectThrow("invalid publish topic", () => broker.publish("nodevision/+/bad", {}));

  console.log("PASS");
}

main().catch((err) => {
  console.error("Broker core test failed:", err);
  process.exitCode = 1;
});
