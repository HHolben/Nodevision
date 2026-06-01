// Nodevision/ApplicationSystem/MessageBroker/MQTT/MqttPacketCodec.mjs
// Minimal MQTT 3.1.1 packet helpers for Nodevision's QoS 0 TCP bridge.

import { TextDecoder } from "node:util";

export const MQTT_PACKET_TYPES = Object.freeze({
  CONNECT: 1,
  CONNACK: 2,
  PUBLISH: 3,
  PUBACK: 4,
  PUBREC: 5,
  PUBREL: 6,
  PUBCOMP: 7,
  SUBSCRIBE: 8,
  SUBACK: 9,
  UNSUBSCRIBE: 10,
  UNSUBACK: 11,
  PINGREQ: 12,
  PINGRESP: 13,
  DISCONNECT: 14,
});

const MAX_REMAINING_LENGTH = 268435455;
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

export class MqttPacketError extends Error {
  constructor(message, { code = "MQTT_MALFORMED" } = {}) {
    super(message);
    this.name = "MqttPacketError";
    this.code = code;
  }
}

function incomplete(message) {
  return new MqttPacketError(message, { code: "MQTT_INCOMPLETE" });
}

function assertBuffer(buffer, label = "buffer") {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError(`${label} must be a Buffer`);
  }
}

function ensureAvailable(buffer, offset, byteCount, label) {
  if (offset + byteCount > buffer.length) {
    throw incomplete(`Incomplete MQTT ${label}`);
  }
}

export function encodeRemainingLength(value) {
  if (!Number.isInteger(value) || value < 0 || value > MAX_REMAINING_LENGTH) {
    throw new MqttPacketError("Invalid MQTT remaining length");
  }

  const bytes = [];
  let remaining = value;
  do {
    let encodedByte = remaining % 128;
    remaining = Math.floor(remaining / 128);
    if (remaining > 0) encodedByte |= 0x80;
    bytes.push(encodedByte);
  } while (remaining > 0);
  return Buffer.from(bytes);
}

export function decodeRemainingLength(buffer, offset = 1) {
  assertBuffer(buffer);
  let multiplier = 1;
  let value = 0;
  const bytes = [];

  for (let index = 0; index < 4; index += 1) {
    if (offset + index >= buffer.length) {
      throw incomplete("Incomplete MQTT remaining length");
    }

    const encodedByte = buffer[offset + index];
    bytes.push(encodedByte);
    value += (encodedByte & 0x7f) * multiplier;

    if ((encodedByte & 0x80) === 0) {
      const canonical = encodeRemainingLength(value);
      if (canonical.length !== bytes.length || !canonical.equals(Buffer.from(bytes))) {
        throw new MqttPacketError("Overlong MQTT remaining length encoding");
      }
      return { value, bytes: bytes.length };
    }

    multiplier *= 128;
  }

  throw new MqttPacketError("Malformed MQTT remaining length");
}

export function encodeUtf8String(value) {
  const text = String(value ?? "");
  const payload = Buffer.from(text, "utf8");
  if (payload.length > 65535) {
    throw new MqttPacketError("MQTT UTF-8 string exceeds 65535 bytes");
  }
  const header = Buffer.alloc(2);
  header.writeUInt16BE(payload.length, 0);
  return Buffer.concat([header, payload]);
}

export function decodeUtf8String(buffer, offset = 0, end = buffer.length) {
  assertBuffer(buffer);
  ensureAvailable(buffer, offset, 2, "UTF-8 string length");
  const byteLength = buffer.readUInt16BE(offset);
  const start = offset + 2;
  const nextOffset = start + byteLength;
  if (nextOffset > end || nextOffset > buffer.length) {
    throw incomplete("Incomplete MQTT UTF-8 string");
  }

  let value;
  try {
    value = utf8Decoder.decode(buffer.subarray(start, nextOffset));
  } catch {
    throw new MqttPacketError("Invalid MQTT UTF-8 string");
  }

  return { value, bytes: 2 + byteLength, nextOffset };
}

export function parseFixedHeader(buffer, offset = 0) {
  assertBuffer(buffer);
  ensureAvailable(buffer, offset, 1, "fixed header");
  const firstByte = buffer[offset];
  const remaining = decodeRemainingLength(buffer, offset + 1);
  const headerBytes = 1 + remaining.bytes;
  return {
    packetType: firstByte >> 4,
    flags: firstByte & 0x0f,
    remainingLength: remaining.value,
    headerBytes,
  };
}

export function readPacketFromBuffer(buffer, offset = 0) {
  const header = parseFixedHeader(buffer, offset);
  const totalBytes = header.headerBytes + header.remainingLength;
  if (offset + totalBytes > buffer.length) {
    throw incomplete("Incomplete MQTT packet payload");
  }
  return {
    header,
    packet: buffer.subarray(offset, offset + totalBytes),
    totalBytes,
  };
}

function packetBody(packet, expectedType, expectedFlags = null) {
  const header = parseFixedHeader(packet);
  if (header.packetType !== expectedType) {
    throw new MqttPacketError(`Expected MQTT packet type ${expectedType}`);
  }
  if (expectedFlags !== null && header.flags !== expectedFlags) {
    throw new MqttPacketError(`Invalid MQTT packet flags for type ${expectedType}`);
  }
  if (packet.length !== header.headerBytes + header.remainingLength) {
    throw new MqttPacketError("MQTT packet length mismatch");
  }
  return { header, body: packet.subarray(header.headerBytes) };
}

export function encodePacket(packetType, flags, body = Buffer.alloc(0)) {
  assertBuffer(body, "body");
  return Buffer.concat([
    Buffer.from([(packetType << 4) | (flags & 0x0f)]),
    encodeRemainingLength(body.length),
    body,
  ]);
}

export function decodeConnect(packet) {
  const { body } = packetBody(packet, MQTT_PACKET_TYPES.CONNECT, 0);
  let offset = 0;
  const protocol = decodeUtf8String(body, offset);
  offset = protocol.nextOffset;
  ensureAvailable(body, offset, 4, "CONNECT variable header");
  const protocolLevel = body[offset];
  offset += 1;
  const connectFlags = body[offset];
  offset += 1;
  const keepAliveSeconds = body.readUInt16BE(offset);
  offset += 2;

  const protocolName = protocol.value;
  if (protocolName !== "MQTT" || protocolLevel !== 4) {
    throw new MqttPacketError("Unsupported MQTT protocol version", { code: "MQTT_UNSUPPORTED_PROTOCOL" });
  }
  if ((connectFlags & 0x01) !== 0) {
    throw new MqttPacketError("Invalid MQTT CONNECT flags");
  }

  const hasUsername = (connectFlags & 0x80) !== 0;
  const hasPassword = (connectFlags & 0x40) !== 0;
  const willRetain = (connectFlags & 0x20) !== 0;
  const willQos = (connectFlags & 0x18) >> 3;
  const hasWill = (connectFlags & 0x04) !== 0;
  const cleanSession = (connectFlags & 0x02) !== 0;

  if (!hasWill && (willRetain || willQos !== 0)) {
    throw new MqttPacketError("Invalid MQTT will flags");
  }
  if (willQos > 2) {
    throw new MqttPacketError("Invalid MQTT will QoS");
  }
  if (hasPassword && !hasUsername) {
    throw new MqttPacketError("MQTT password flag requires username flag");
  }

  const clientIdField = decodeUtf8String(body, offset);
  offset = clientIdField.nextOffset;

  let will = null;
  if (hasWill) {
    const willTopic = decodeUtf8String(body, offset);
    offset = willTopic.nextOffset;
    ensureAvailable(body, offset, 2, "will payload length");
    const willPayloadLength = body.readUInt16BE(offset);
    offset += 2;
    ensureAvailable(body, offset, willPayloadLength, "will payload");
    will = {
      topic: willTopic.value,
      payloadBuffer: body.subarray(offset, offset + willPayloadLength),
      qos: willQos,
      retain: willRetain,
    };
    offset += willPayloadLength;
  }

  let username = null;
  if (hasUsername) {
    const usernameField = decodeUtf8String(body, offset);
    username = usernameField.value;
    offset = usernameField.nextOffset;
  }

  let password = null;
  let passwordBuffer = null;
  if (hasPassword) {
    ensureAvailable(body, offset, 2, "password length");
    const passwordLength = body.readUInt16BE(offset);
    offset += 2;
    ensureAvailable(body, offset, passwordLength, "password");
    passwordBuffer = body.subarray(offset, offset + passwordLength);
    try {
      password = utf8Decoder.decode(passwordBuffer);
    } catch {
      password = null;
    }
    offset += passwordLength;
  }

  if (offset !== body.length) {
    throw new MqttPacketError("MQTT CONNECT contains trailing bytes");
  }

  return {
    protocolName,
    protocolLevel,
    cleanSession,
    keepAliveSeconds,
    clientId: clientIdField.value,
    username,
    password,
    passwordBuffer,
    will,
  };
}

export function encodeConnect({ clientId = "nodevision-test-client", keepAliveSeconds = 30, username = null, password = null } = {}) {
  let flags = 0x02;
  const parts = [
    encodeUtf8String("MQTT"),
    Buffer.from([4]),
    null,
    Buffer.from([(keepAliveSeconds >> 8) & 0xff, keepAliveSeconds & 0xff]),
    encodeUtf8String(clientId),
  ];
  if (username !== null && username !== undefined) flags |= 0x80;
  if (password !== null && password !== undefined) flags |= 0x40;
  parts[2] = Buffer.from([flags]);
  if (username !== null && username !== undefined) parts.push(encodeUtf8String(username));
  if (password !== null && password !== undefined) {
    const passwordBuffer = Buffer.isBuffer(password) ? password : Buffer.from(String(password), "utf8");
    const header = Buffer.alloc(2);
    header.writeUInt16BE(passwordBuffer.length, 0);
    parts.push(Buffer.concat([header, passwordBuffer]));
  }
  return encodePacket(MQTT_PACKET_TYPES.CONNECT, 0, Buffer.concat(parts));
}

export function encodeConnack({ sessionPresent = false, returnCode = 0 } = {}) {
  return encodePacket(MQTT_PACKET_TYPES.CONNACK, 0, Buffer.from([sessionPresent ? 1 : 0, returnCode & 0xff]));
}

export function decodePublishQoS0(packet) {
  const { header, body } = packetBody(packet, MQTT_PACKET_TYPES.PUBLISH);
  const qos = (header.flags & 0x06) >> 1;
  if (qos > 0) {
    throw new MqttPacketError("MQTT QoS 1/2 PUBLISH is not supported yet", { code: "MQTT_UNSUPPORTED_QOS" });
  }
  const topicField = decodeUtf8String(body, 0);
  const payloadBuffer = body.subarray(topicField.nextOffset);
  return {
    topic: topicField.value,
    payloadBuffer,
    retain: (header.flags & 0x01) !== 0,
    qos,
    dup: (header.flags & 0x08) !== 0,
  };
}

export function encodePublishQoS0({ topic, payload = Buffer.alloc(0), retain = false, dup = false } = {}) {
  const payloadBuffer = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload ?? ""), "utf8");
  const flags = (dup ? 0x08 : 0) | (retain ? 0x01 : 0);
  return encodePacket(MQTT_PACKET_TYPES.PUBLISH, flags, Buffer.concat([encodeUtf8String(topic), payloadBuffer]));
}

export function decodeSubscribe(packet) {
  const { body } = packetBody(packet, MQTT_PACKET_TYPES.SUBSCRIBE, 2);
  let offset = 0;
  ensureAvailable(body, offset, 2, "SUBSCRIBE packet id");
  const packetId = body.readUInt16BE(offset);
  offset += 2;
  if (packetId === 0) throw new MqttPacketError("MQTT SUBSCRIBE packet id must be nonzero");

  const subscriptions = [];
  while (offset < body.length) {
    const topicField = decodeUtf8String(body, offset);
    offset = topicField.nextOffset;
    ensureAvailable(body, offset, 1, "SUBSCRIBE requested QoS");
    const qos = body[offset] & 0x03;
    const rawQos = body[offset];
    offset += 1;
    if ((rawQos & 0xfc) !== 0 || qos > 2) {
      throw new MqttPacketError("Invalid MQTT SUBSCRIBE requested QoS");
    }
    subscriptions.push({ topicFilter: topicField.value, qos });
  }
  if (subscriptions.length === 0) throw new MqttPacketError("MQTT SUBSCRIBE must contain at least one topic filter");
  return { packetId, subscriptions };
}

export function encodeSubscribe({ packetId = 1, subscriptions = [] } = {}) {
  const id = Buffer.alloc(2);
  id.writeUInt16BE(packetId, 0);
  const parts = [id];
  for (const subscription of subscriptions) {
    parts.push(encodeUtf8String(subscription.topicFilter));
    parts.push(Buffer.from([Number(subscription.qos || 0) & 0x03]));
  }
  return encodePacket(MQTT_PACKET_TYPES.SUBSCRIBE, 2, Buffer.concat(parts));
}

export function encodeSuback({ packetId, returnCodes = [] } = {}) {
  if (!Number.isInteger(packetId) || packetId <= 0 || packetId > 65535) {
    throw new MqttPacketError("Invalid MQTT SUBACK packet id");
  }
  const id = Buffer.alloc(2);
  id.writeUInt16BE(packetId, 0);
  return encodePacket(MQTT_PACKET_TYPES.SUBACK, 0, Buffer.concat([id, Buffer.from(returnCodes)]));
}

export function decodePingreq(packet) {
  packetBody(packet, MQTT_PACKET_TYPES.PINGREQ, 0);
  if (packet.length !== 2 || packet[1] !== 0) throw new MqttPacketError("Malformed MQTT PINGREQ");
  return {};
}

export function encodePingreq() {
  return encodePacket(MQTT_PACKET_TYPES.PINGREQ, 0);
}

export function encodePingresp() {
  return encodePacket(MQTT_PACKET_TYPES.PINGRESP, 0);
}

export function decodeDisconnect(packet) {
  packetBody(packet, MQTT_PACKET_TYPES.DISCONNECT, 0);
  if (packet.length !== 2 || packet[1] !== 0) throw new MqttPacketError("Malformed MQTT DISCONNECT");
  return {};
}

export function encodeDisconnect() {
  return encodePacket(MQTT_PACKET_TYPES.DISCONNECT, 0);
}
