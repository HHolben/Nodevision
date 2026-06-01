// Nodevision/ApplicationSystem/MessageBroker/test-mqtt-model.mjs
// Tests shared MQTT model topic, device, publisher, and update projections.

import { createBroker } from "./BrokerCore.mjs";
import { createMqttModel } from "./MQTTModel.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const broker = createBroker({ maxEvents: 20 });
  const model = createMqttModel({ broker });
  let updateCount = 0;
  const unsubscribe = model.onUpdate(() => { updateCount += 1; });

  broker.publish("nodevision/iot/garden/bed1/moisture", {
    device: "wokwi-esp32-garden",
    moisture: 1821,
    pumpOn: true,
    tokenHash: "do-not-return",
  }, { retain: true, publisherId: "wokwi-garden-test" });

  const snapshot = model.getSnapshot({ topicPrefix: "nodevision/iot/" });
  const topic = snapshot.topics.find((item) => item.topic === "nodevision/iot/garden/bed1/moisture");
  const device = snapshot.devices.find((item) => item.name === "wokwi-esp32-garden");
  const publisher = snapshot.publishers.find((item) => item.name === "wokwi-garden-test");

  assert(topic, "retained MQTT topic should appear in model snapshot");
  assert(topic.payload.moisture === 1821, "safe payload fields should be retained");
  assert(topic.payloadPreview.includes("wokwi-esp32-garden"), "payload preview should include safe JSON");
  assert(!JSON.stringify(topic).includes("do-not-return"), "sensitive values should not be exposed");
  assert(device, "payload.device should create a device");
  assert(device.publisherId === "wokwi-garden-test", "device should retain publisher relationship");
  assert(device.topics.includes("nodevision/iot/garden/bed1/moisture"), "device should link to retained topic");
  assert(publisher?.topics.includes("nodevision/iot/garden/bed1/moisture"), "publisher should link to retained topic");
  assert(snapshot.status.retainedTopics === 1, "status should include retained topic count");
  assert(updateCount >= 1, "model should emit broker update events");

  unsubscribe();
  model.close();
  console.log("PASS");
}

main().catch((err) => {
  console.error("MQTT model test failed:", err);
  process.exitCode = 1;
});
