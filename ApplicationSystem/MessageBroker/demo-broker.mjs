// Nodevision/ApplicationSystem/MessageBroker/demo-broker.mjs
// Tiny demo for Nodevision's internal MQTT-style broker benchmark.

import { createBroker } from "./BrokerCore.mjs";

const broker = createBroker({ maxEvents: 16 });

console.log("Subscribing to nodevision/#");
broker.subscribe("nodevision/#", (message) => {
  console.log("[nodevision/#]", JSON.stringify(message));
});

console.log("Publishing nodevision/test");
broker.publish("nodevision/test", { hello: "world" }, { publisherId: "demo" });

console.log("Publishing retained nodevision/status");
broker.publish("nodevision/status", { online: true }, { retain: true, publisherId: "demo" });

console.log("Subscribing later to nodevision/status");
broker.subscribe("nodevision/status", (message) => {
  console.log("[late nodevision/status]", JSON.stringify(message));
});

console.log("Demo complete");
