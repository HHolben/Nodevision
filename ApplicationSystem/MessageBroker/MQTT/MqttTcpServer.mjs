// Nodevision/ApplicationSystem/MessageBroker/MQTT/MqttTcpServer.mjs
// MQTT 3.1.1 QoS 0 TCP listener that bridges standard clients into BrokerCore.

import net from "node:net";

import { getBroker } from "../BrokerSingleton.mjs";
import { topicMatchesFilter, validateTopicFilter, validateTopicName } from "../TopicMatcher.mjs";
import { findTokenRecord, readDeviceTokens, resolveDeviceTokensPath } from "../IoTDeviceTokens.mjs";
import {
  MQTT_PACKET_TYPES,
  MqttPacketError,
  decodeConnect,
  decodeDisconnect,
  decodePingreq,
  decodePublishQoS0,
  decodeSubscribe,
  encodeConnack,
  encodePingresp,
  encodePublishQoS0,
  encodeSuback,
  readPacketFromBuffer,
} from "./MqttPacketCodec.mjs";

const DEFAULT_MQTT_HOST = "127.0.0.1";
const DEFAULT_MQTT_PORT = 1883;
const ANONYMOUS_PREFIXES = ["nodevision/"];

let activeServer = null;
let lastStatus = {
  enabled: false,
  host: DEFAULT_MQTT_HOST,
  port: DEFAULT_MQTT_PORT,
  anonymousAllowed: false,
  listening: false,
  clientCount: 0,
  subscriptionCount: 0,
};

function envFlag(name, defaultValue = false) {
  if (!(name in process.env)) return defaultValue;
  const raw = String(process.env[name] || "").trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(raw)) return true;
  if (["0", "false", "no", "off", ""].includes(raw)) return false;
  return defaultValue;
}

function envPort(name, defaultValue) {
  const parsed = Number(process.env[name]);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) return defaultValue;
  return parsed;
}

export function mqttConfigFromEnv({ runtimeRoot, deviceTokensPath, broker } = {}) {
  return {
    enabled: envFlag("NODEVISION_MQTT_ENABLED", false),
    host: process.env.NODEVISION_MQTT_HOST || DEFAULT_MQTT_HOST,
    port: envPort("NODEVISION_MQTT_PORT", DEFAULT_MQTT_PORT),
    allowAnonymous: envFlag("NODEVISION_MQTT_ALLOW_ANONYMOUS", false),
    runtimeRoot,
    deviceTokensPath,
    broker,
  };
}

function isLocalAddress(address) {
  const text = String(address || "");
  return text === "127.0.0.1" || text === "::1" || text === "::ffff:127.0.0.1" || text === "localhost";
}

function normalizePrefixes(prefixes) {
  return (Array.isArray(prefixes) ? prefixes : [])
    .map((prefix) => String(prefix || "").trim())
    .filter(Boolean);
}

export function topicAllowedByPrefixes(topic, allowedTopicPrefixes = []) {
  const prefixes = normalizePrefixes(allowedTopicPrefixes);
  return prefixes.some((prefix) => topic.startsWith(prefix));
}

function literalPrefixBeforeWildcard(filter) {
  const text = String(filter || "");
  const wildcardIndexes = [text.indexOf("+"), text.indexOf("#")].filter((index) => index >= 0);
  if (wildcardIndexes.length === 0) return text;
  const firstWildcard = Math.min(...wildcardIndexes);
  return text.slice(0, firstWildcard);
}

export function topicFilterAllowedByPrefixes(topicFilter, allowedTopicPrefixes = []) {
  const prefixes = normalizePrefixes(allowedTopicPrefixes);
  const filter = String(topicFilter || "");
  if (filter === "#") return prefixes.includes("nodevision/") || prefixes.includes("");
  if (!filter.includes("+") && !filter.includes("#")) return topicAllowedByPrefixes(filter, prefixes);

  const literalPrefix = literalPrefixBeforeWildcard(filter);
  return prefixes.some((prefix) => literalPrefix.startsWith(prefix));
}

export async function authenticateMqttConnect(connectPacket, options = {}) {
  const allowAnonymous = options.allowAnonymous === true;
  const remoteAddress = options.remoteAddress || "127.0.0.1";

  if (allowAnonymous && !connectPacket.password && !connectPacket.passwordBuffer && isLocalAddress(remoteAddress)) {
    return {
      ok: true,
      principal: {
        name: "anonymous-local-mqtt",
        anonymous: true,
        allowedTopicPrefixes: ANONYMOUS_PREFIXES,
      },
    };
  }

  if (!connectPacket.password) {
    return { ok: false, returnCode: 4, reason: "MQTT password token required" };
  }

  const deviceTokensPath = resolveDeviceTokensPath({
    runtimeRoot: options.runtimeRoot,
    deviceTokensPath: options.deviceTokensPath,
  });
  let record = null;
  try {
    const tokenData = await readDeviceTokens(deviceTokensPath);
    record = findTokenRecord(tokenData, connectPacket.password);
  } catch {
    return { ok: false, returnCode: 5, reason: "MQTT token store unavailable" };
  }
  if (!record) return { ok: false, returnCode: 4, reason: "Invalid MQTT token" };
  if (record.enabled !== true) return { ok: false, returnCode: 5, reason: "MQTT token disabled" };

  return {
    ok: true,
    principal: {
      name: String(record.name || connectPacket.username || "mqtt-token"),
      anonymous: false,
      allowedTopicPrefixes: normalizePrefixes(record.allowedTopicPrefixes),
    },
  };
}

function payloadBufferToBrokerPayload(buffer) {
  try {
    const text = buffer.toString("utf8");
    if (Buffer.from(text, "utf8").equals(buffer)) {
      const trimmed = text.trim();
      if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
        try {
          return JSON.parse(trimmed);
        } catch {
          return text;
        }
      }
      return text;
    }
  } catch {}

  return {
    encoding: "base64",
    byteLength: buffer.length,
    data: buffer.subarray(0, 512).toString("base64"),
    truncated: buffer.length > 512,
  };
}

function brokerPayloadToBuffer(payload) {
  if (Buffer.isBuffer(payload)) return payload;
  if (payload instanceof Uint8Array) return Buffer.from(payload);
  if (typeof payload === "string") return Buffer.from(payload, "utf8");
  if (payload === undefined) return Buffer.alloc(0);
  return Buffer.from(JSON.stringify(payload), "utf8");
}

function sanitizeLogError(err) {
  const text = String(err?.message || err || "unknown error");
  return text.replace(/token|password|secret|privatekey/gi, "[redacted]");
}

export class MqttTcpServer {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.host = options.host || DEFAULT_MQTT_HOST;
    this.port = options.port ?? DEFAULT_MQTT_PORT;
    this.allowAnonymous = options.allowAnonymous === true;
    this.runtimeRoot = options.runtimeRoot;
    this.deviceTokensPath = options.deviceTokensPath;
    this.broker = options.broker || getBroker();
    this.logger = options.logger || console;
    this.server = null;
    this.clients = new Set();
  }

  status() {
    let subscriptionCount = 0;
    for (const client of this.clients) subscriptionCount += client.unregisters.length;
    const address = this.server?.address?.();
    return {
      enabled: this.enabled,
      host: typeof address === "object" && address ? address.address : this.host,
      port: typeof address === "object" && address ? address.port : this.port,
      anonymousAllowed: this.allowAnonymous,
      listening: Boolean(this.server?.listening),
      clientCount: this.clients.size,
      subscriptionCount,
    };
  }

  updateStatus() {
    lastStatus = this.status();
    activeServer = this;
  }

  async start() {
    if (!this.enabled) {
      this.updateStatus();
      return this;
    }
    if (this.server?.listening) return this;

    this.server = net.createServer((socket) => this.handleSocket(socket));
    this.server.on("error", (err) => {
      this.logger.error?.("[mqtt] server error:", sanitizeLogError(err));
      this.updateStatus();
    });

    await new Promise((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(this.port, this.host, () => {
        this.server.off("error", reject);
        this.updateStatus();
        const status = this.status();
        this.logger.log?.(`Nodevision MQTT broker listening on ${status.host}:${status.port}`);
        resolve();
      });
    });
    return this;
  }

  async stop() {
    for (const client of [...this.clients]) {
      client.socket.destroy();
      this.cleanupClient(client);
    }
    if (this.server) {
      await new Promise((resolve) => this.server.close(() => resolve()));
      this.server = null;
    }
    this.updateStatus();
  }

  address() {
    return this.server?.address?.() || null;
  }

  handleSocket(socket) {
    const client = {
      socket,
      buffer: Buffer.alloc(0),
      connected: false,
      gracefulDisconnect: false,
      clientId: null,
      principal: null,
      unregisters: [],
      processing: false,
      needsProcess: false,
    };
    this.clients.add(client);
    this.updateStatus();
    this.logger.log?.(`[mqtt] client connected from ${socket.remoteAddress || "unknown"}`);

    socket.on("data", (chunk) => {
      client.buffer = Buffer.concat([client.buffer, chunk]);
      this.processClientBuffer(client).catch((err) => {
        this.logger.warn?.("[mqtt] invalid packet:", sanitizeLogError(err));
        socket.destroy();
      });
    });
    socket.on("close", () => {
      this.cleanupClient(client);
      this.logger.log?.(`[mqtt] client disconnected from ${socket.remoteAddress || "unknown"}`);
    });
    socket.on("error", (err) => {
      this.logger.warn?.("[mqtt] socket error:", sanitizeLogError(err));
    });
  }

  cleanupClient(client) {
    for (const unregister of client.unregisters.splice(0)) {
      try {
        unregister();
      } catch {}
    }
    this.clients.delete(client);
    this.updateStatus();
  }

  async processClientBuffer(client) {
    if (client.processing) {
      client.needsProcess = true;
      return;
    }

    client.processing = true;
    try {
      do {
        client.needsProcess = false;
        while (client.buffer.length > 0) {
          let packetInfo;
          try {
            packetInfo = readPacketFromBuffer(client.buffer);
          } catch (err) {
            if (err?.code === "MQTT_INCOMPLETE") return;
            throw err;
          }
          client.buffer = client.buffer.subarray(packetInfo.totalBytes);
          await this.handlePacket(client, packetInfo.header, packetInfo.packet);
          if (client.socket.destroyed) return;
        }
      } while (client.needsProcess);
    } finally {
      client.processing = false;
    }
  }

  async handlePacket(client, header, packet) {
    if (!client.connected && header.packetType !== MQTT_PACKET_TYPES.CONNECT) {
      client.socket.end();
      return;
    }

    switch (header.packetType) {
      case MQTT_PACKET_TYPES.CONNECT:
        await this.handleConnect(client, packet);
        return;
      case MQTT_PACKET_TYPES.PUBLISH:
        this.handlePublish(client, packet);
        return;
      case MQTT_PACKET_TYPES.SUBSCRIBE:
        this.handleSubscribe(client, packet);
        return;
      case MQTT_PACKET_TYPES.PINGREQ:
        decodePingreq(packet);
        client.socket.write(encodePingresp());
        return;
      case MQTT_PACKET_TYPES.DISCONNECT:
        decodeDisconnect(packet);
        client.gracefulDisconnect = true;
        client.socket.end();
        return;
      default:
        throw new MqttPacketError(`Unsupported MQTT packet type ${header.packetType}`);
    }
  }

  async handleConnect(client, packet) {
    if (client.connected) throw new MqttPacketError("Duplicate MQTT CONNECT");

    let connect;
    try {
      connect = decodeConnect(packet);
    } catch (err) {
      const returnCode = err?.code === "MQTT_UNSUPPORTED_PROTOCOL" ? 1 : 2;
      client.socket.write(encodeConnack({ returnCode }));
      client.socket.end();
      return;
    }

    const auth = await authenticateMqttConnect(connect, {
      allowAnonymous: this.allowAnonymous,
      remoteAddress: client.socket.remoteAddress,
      runtimeRoot: this.runtimeRoot,
      deviceTokensPath: this.deviceTokensPath,
    });
    if (!auth.ok) {
      client.socket.write(encodeConnack({ returnCode: auth.returnCode || 5 }));
      client.socket.end();
      this.logger.warn?.(`[mqtt] connection rejected: ${auth.reason || "not authorized"}`);
      return;
    }

    client.connected = true;
    client.clientId = connect.clientId || null;
    client.principal = auth.principal;
    client.socket.write(encodeConnack({ returnCode: 0 }));
  }

  handlePublish(client, packet) {
    const publish = decodePublishQoS0(packet);
    validateTopicName(publish.topic);
    if (!topicAllowedByPrefixes(publish.topic, client.principal?.allowedTopicPrefixes)) {
      this.logger.warn?.("[mqtt] publish rejected: topic not allowed");
      client.socket.end();
      return;
    }

    const payload = payloadBufferToBrokerPayload(publish.payloadBuffer);
    this.broker.publish(publish.topic, payload, {
      retain: publish.retain,
      publisherId: client.principal?.name || client.clientId || "mqtt-client",
    });
  }

  handleSubscribe(client, packet) {
    const subscribe = decodeSubscribe(packet);
    const returnCodes = [];
    const retainedToReplay = [];

    for (const subscription of subscribe.subscriptions) {
      try {
        validateTopicFilter(subscription.topicFilter);
        if (!topicFilterAllowedByPrefixes(subscription.topicFilter, client.principal?.allowedTopicPrefixes)) {
          throw new Error("Topic filter is not allowed");
        }
        const unregister = this.broker.subscribe(
          subscription.topicFilter,
          (message) => this.deliverBrokerMessage(client, message),
          { replayRetained: false },
        );
        client.unregisters.push(unregister);
        returnCodes.push(0);
        for (const retained of this.broker.listRetained()) {
          if (topicMatchesFilter(retained.topic, subscription.topicFilter)) retainedToReplay.push(retained);
        }
      } catch (err) {
        this.logger.warn?.("[mqtt] subscribe rejected:", sanitizeLogError(err));
        returnCodes.push(0x80);
      }
    }

    client.socket.write(encodeSuback({ packetId: subscribe.packetId, returnCodes }));
    for (const retained of retainedToReplay) this.deliverBrokerMessage(client, retained);
    this.updateStatus();
  }

  deliverBrokerMessage(client, message) {
    if (client.socket.destroyed) return;
    try {
      client.socket.write(encodePublishQoS0({
        topic: message.topic,
        payload: brokerPayloadToBuffer(message.payload),
        retain: message.retained === true,
      }));
    } catch (err) {
      this.logger.warn?.("[mqtt] failed to deliver broker message:", sanitizeLogError(err));
    }
  }
}

export async function startMqttServerFromEnv(options = {}) {
  const config = mqttConfigFromEnv(options);
  if (!config.enabled) {
    activeServer = null;
    lastStatus = {
      enabled: false,
      host: config.host,
      port: config.port,
      anonymousAllowed: config.allowAnonymous,
      listening: false,
      clientCount: 0,
      subscriptionCount: 0,
    };
    return null;
  }
  const server = new MqttTcpServer(config);
  await server.start();
  return server;
}

export function getMqttServerStatus() {
  if (activeServer) return activeServer.status();
  return { ...lastStatus };
}
