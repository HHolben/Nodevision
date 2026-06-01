// Nodevision/ApplicationSystem/MessageBroker/MQTT/test-mqtt-server-smoke.mjs
// TCP smoke test for MQTT CONNECT, retained QoS 0 PUBLISH, SUBSCRIBE replay, PINGREQ, DISCONNECT.

import net from "node:net";

import { createBroker } from "../BrokerCore.mjs";
import {
  MQTT_PACKET_TYPES,
  decodePublishQoS0,
  encodeConnect,
  encodeDisconnect,
  encodePingreq,
  encodePublishQoS0,
  encodeSubscribe,
  readPacketFromBuffer,
} from "./MqttPacketCodec.mjs";
import { MqttTcpServer } from "./MqttTcpServer.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function waitFor(condition, message, timeoutMs = 1000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (condition()) return resolve();
      if (Date.now() - startedAt > timeoutMs) return reject(new Error(message));
      setTimeout(tick, 10);
    };
    tick();
  });
}

function createMqttNetClient(port) {
  const socket = net.createConnection({ host: "127.0.0.1", port });
  let buffer = Buffer.alloc(0);
  const packets = [];
  const waiters = [];

  function drain() {
    while (buffer.length > 0) {
      let packetInfo;
      try {
        packetInfo = readPacketFromBuffer(buffer);
      } catch (err) {
        if (err?.code === "MQTT_INCOMPLETE") return;
        throw err;
      }
      buffer = buffer.subarray(packetInfo.totalBytes);
      const waiterIndex = waiters.findIndex((waiter) => waiter.type === packetInfo.header.packetType);
      if (waiterIndex >= 0) {
        const [waiter] = waiters.splice(waiterIndex, 1);
        waiter.resolve(packetInfo);
      } else {
        packets.push(packetInfo);
      }
    }
  }

  socket.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    try {
      drain();
    } catch (err) {
      for (const waiter of waiters.splice(0)) waiter.reject(err);
      socket.destroy();
    }
  });
  socket.on("error", (err) => {
    for (const waiter of waiters.splice(0)) waiter.reject(err);
  });

  return {
    socket,
    write(packet) {
      socket.write(packet);
    },
    waitForPacket(type, timeoutMs = 1000) {
      drain();
      const queuedIndex = packets.findIndex((packetInfo) => packetInfo.header.packetType === type);
      if (queuedIndex >= 0) {
        const [packetInfo] = packets.splice(queuedIndex, 1);
        return Promise.resolve(packetInfo);
      }
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          const index = waiters.findIndex((waiter) => waiter.resolve === resolve);
          if (index >= 0) waiters.splice(index, 1);
          reject(new Error(`Timed out waiting for MQTT packet type ${type}`));
        }, timeoutMs);
        waiters.push({
          type,
          resolve: (packetInfo) => {
            clearTimeout(timer);
            resolve(packetInfo);
          },
          reject: (err) => {
            clearTimeout(timer);
            reject(err);
          },
        });
        drain();
      });
    },
    close() {
      socket.destroy();
    },
  };
}

async function main() {
  const broker = createBroker({ maxEvents: 20 });
  const server = new MqttTcpServer({
    host: "127.0.0.1",
    port: 0,
    allowAnonymous: true,
    broker,
    logger: { log() {}, warn() {}, error() {} },
  });
  await server.start();
  const { port } = server.address();
  const client = createMqttNetClient(port);

  try {
    await new Promise((resolve, reject) => {
      client.socket.once("connect", resolve);
      client.socket.once("error", reject);
    });

    client.write(encodeConnect({ clientId: "smoke-client" }));
    const connack = await client.waitForPacket(MQTT_PACKET_TYPES.CONNACK);
    assert(connack.packet[3] === 0, "CONNACK should report success");

    client.write(encodePublishQoS0({
      topic: "nodevision/iot/test",
      payload: '{"hello":"mqtt"}',
      retain: true,
    }));
    await waitFor(
      () => broker.getRetained("nodevision/iot/test")?.payload?.hello === "mqtt",
      "retained MQTT publish did not reach BrokerSingleton-compatible broker",
    );

    client.write(encodeSubscribe({
      packetId: 11,
      subscriptions: [{ topicFilter: "nodevision/iot/#", qos: 0 }],
    }));
    const suback = await client.waitForPacket(MQTT_PACKET_TYPES.SUBACK);
    assert(suback.packet[2] === 0 && suback.packet[3] === 11 && suback.packet[4] === 0, "SUBACK should grant QoS 0");

    const retainedPublish = await client.waitForPacket(MQTT_PACKET_TYPES.PUBLISH);
    const publish = decodePublishQoS0(retainedPublish.packet);
    assert(publish.topic === "nodevision/iot/test", "retained replay topic mismatch");
    assert(publish.retain === true, "retained replay should preserve retain flag");
    assert(publish.payloadBuffer.toString("utf8") === '{"hello":"mqtt"}', "retained replay payload mismatch");

    client.write(encodePingreq());
    await client.waitForPacket(MQTT_PACKET_TYPES.PINGRESP);

    client.write(encodeDisconnect());
    await new Promise((resolve) => client.socket.once("close", resolve));
  } finally {
    client.close();
    await server.stop();
  }

  console.log("PASS");
}

main().catch((err) => {
  console.error("MQTT server smoke test failed:", err);
  process.exitCode = 1;
});
