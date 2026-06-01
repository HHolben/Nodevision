// Nodevision/ApplicationSystem/MessageBroker/MQTT/demo-mqtt-server.mjs
// Local MQTT demo server for mosquitto_pub/sub testing.

import { getBroker } from "../BrokerSingleton.mjs";
import { MqttTcpServer } from "./MqttTcpServer.mjs";

const broker = getBroker();

const server = new MqttTcpServer({
  host: "127.0.0.1",
  port: 1883,
  allowAnonymous: true,
  broker,
});

broker.subscribe("nodevision/#", (message) => {
  console.log("[mqtt-demo] broker message", {
    topic: message.topic,
    retained: message.retained === true,
    publisherId: message.publisherId || null,
  });
}, { replayRetained: false });

await server.start();
console.log("[mqtt-demo] Anonymous localhost MQTT test mode is enabled.");
console.log("[mqtt-demo] Press Ctrl+C to stop.");

async function shutdown() {
  await server.stop().catch(() => {});
  process.exit(0);
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
