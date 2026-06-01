// Nodevision/ApplicationSystem/MessageBroker/MQTT/test-mqtt-packet-codec.mjs
// Tests for the minimal MQTT 3.1.1 packet codec.

import {
  MQTT_PACKET_TYPES,
  decodeConnect,
  decodeDisconnect,
  decodePingreq,
  decodePublishQoS0,
  decodeRemainingLength,
  decodeSubscribe,
  encodeConnack,
  encodeConnect,
  encodeDisconnect,
  encodePacket,
  encodePingreq,
  encodePingresp,
  encodePublishQoS0,
  encodeRemainingLength,
  encodeSuback,
  encodeSubscribe,
  parseFixedHeader,
} from "./MqttPacketCodec.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function expectThrow(label, fn) {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  assert(threw, `${label} should throw`);
}

function assertBufferEquals(actual, expected, message) {
  assert(Buffer.compare(actual, expected) === 0, message);
}

async function main() {
  const remainingLengthCases = [0, 1, 42, 127, 128, 321, 16383, 16384, 2097151, 2097152, 268435455];
  for (const value of remainingLengthCases) {
    const encoded = encodeRemainingLength(value);
    const decoded = decodeRemainingLength(Buffer.concat([Buffer.from([0]), encoded]), 1);
    assert(decoded.value === value, `remaining length round trip failed for ${value}`);
    assert(decoded.bytes === encoded.length, `remaining length byte count mismatch for ${value}`);
  }
  expectThrow("too large remaining length", () => encodeRemainingLength(268435456));
  expectThrow("unterminated remaining length", () => decodeRemainingLength(Buffer.from([0, 0xff, 0xff, 0xff, 0xff]), 1));
  expectThrow("overlong remaining length", () => decodeRemainingLength(Buffer.from([0, 0x80, 0x00]), 1));

  const connectPacket = encodeConnect({
    clientId: "codec-client",
    keepAliveSeconds: 45,
    username: "codec-user",
    password: "codec-token",
  });
  const connect = decodeConnect(connectPacket);
  assert(connect.protocolName === "MQTT", "CONNECT protocol name mismatch");
  assert(connect.protocolLevel === 4, "CONNECT protocol level mismatch");
  assert(connect.cleanSession === true, "CONNECT clean session mismatch");
  assert(connect.keepAliveSeconds === 45, "CONNECT keepalive mismatch");
  assert(connect.clientId === "codec-client", "CONNECT client id mismatch");
  assert(connect.username === "codec-user", "CONNECT username mismatch");
  assert(connect.password === "codec-token", "CONNECT password mismatch");

  const badProtocolBody = Buffer.from(connectPacket);
  const protocolLevelIndex = badProtocolBody.indexOf(Buffer.from("MQTT")) + 4;
  badProtocolBody[protocolLevelIndex] = 5;
  expectThrow("unsupported CONNECT version", () => decodeConnect(badProtocolBody));

  assertBufferEquals(encodeConnack({ returnCode: 0 }), Buffer.from([0x20, 0x02, 0x00, 0x00]), "CONNACK success encoding mismatch");

  const publishPacket = encodePublishQoS0({
    topic: "nodevision/iot/test",
    payload: Buffer.from('{"hello":"mqtt"}', "utf8"),
    retain: true,
  });
  const publishHeader = parseFixedHeader(publishPacket);
  assert(publishHeader.packetType === MQTT_PACKET_TYPES.PUBLISH, "PUBLISH packet type mismatch");
  const publish = decodePublishQoS0(publishPacket);
  assert(publish.topic === "nodevision/iot/test", "PUBLISH topic mismatch");
  assert(publish.payloadBuffer.toString("utf8") === '{"hello":"mqtt"}', "PUBLISH payload mismatch");
  assert(publish.retain === true, "PUBLISH retain flag mismatch");
  assert(publish.qos === 0, "PUBLISH QoS mismatch");
  expectThrow("QoS 1 PUBLISH", () => decodePublishQoS0(encodePacket(MQTT_PACKET_TYPES.PUBLISH, 0x02, Buffer.concat([
    Buffer.from([0, 4]),
    Buffer.from("test"),
    Buffer.from("x"),
  ]))));

  const subscribePacket = encodeSubscribe({
    packetId: 7,
    subscriptions: [
      { topicFilter: "nodevision/iot/#", qos: 0 },
      { topicFilter: "nodevision/sync/+", qos: 1 },
    ],
  });
  const subscribe = decodeSubscribe(subscribePacket);
  assert(subscribe.packetId === 7, "SUBSCRIBE packet id mismatch");
  assert(subscribe.subscriptions.length === 2, "SUBSCRIBE count mismatch");
  assert(subscribe.subscriptions[0].topicFilter === "nodevision/iot/#", "SUBSCRIBE filter mismatch");
  assert(subscribe.subscriptions[1].qos === 1, "SUBSCRIBE requested QoS mismatch");

  assertBufferEquals(encodeSuback({ packetId: 7, returnCodes: [0, 0] }), Buffer.from([0x90, 0x04, 0x00, 0x07, 0x00, 0x00]), "SUBACK encoding mismatch");

  assert(decodePingreq(encodePingreq()), "PINGREQ should decode");
  assertBufferEquals(encodePingresp(), Buffer.from([0xd0, 0x00]), "PINGRESP encoding mismatch");
  assert(decodeDisconnect(encodeDisconnect()), "DISCONNECT should decode");

  console.log("PASS");
}

main().catch((err) => {
  console.error("MQTT packet codec test failed:", err);
  process.exitCode = 1;
});
