// Nodevision/ApplicationSystem/MessageBroker/MQTT/test-mqtt-auth.mjs
// Tests MQTT username/password token mapping and prefix authorization.

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { hashToken, writeDeviceTokens } from "../IoTDeviceTokens.mjs";
import {
  authenticateMqttConnect,
  topicAllowedByPrefixes,
  topicFilterAllowedByPrefixes,
} from "./MqttTcpServer.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const runtimeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nodevision-mqtt-auth-"));
  const deviceTokensPath = path.join(runtimeRoot, "ServerSettings", "IoT", "DeviceTokens.json");
  const validToken = "valid-mqtt-token-for-test";
  const disabledToken = "disabled-mqtt-token-for-test";

  await writeDeviceTokens(deviceTokensPath, {
    tokens: [
      {
        name: "mqtt-garden-test",
        tokenHash: hashToken(validToken),
        allowedTopicPrefixes: ["nodevision/iot/"],
        enabled: true,
        createdAt: "2026-05-31T00:00:00.000Z",
      },
      {
        name: "mqtt-disabled-test",
        tokenHash: hashToken(disabledToken),
        allowedTopicPrefixes: ["nodevision/iot/"],
        enabled: false,
        createdAt: "2026-05-31T00:00:00.000Z",
      },
    ],
  });

  const valid = await authenticateMqttConnect(
    { username: "any-user", password: validToken },
    { deviceTokensPath, allowAnonymous: false, remoteAddress: "127.0.0.1" },
  );
  assert(valid.ok === true, "valid token password should be accepted");
  assert(valid.principal.name === "mqtt-garden-test", "principal should use token record name");
  assert(valid.principal.allowedTopicPrefixes[0] === "nodevision/iot/", "principal prefixes mismatch");

  const invalid = await authenticateMqttConnect(
    { username: "any-user", password: "not-valid" },
    { deviceTokensPath, allowAnonymous: false, remoteAddress: "127.0.0.1" },
  );
  assert(invalid.ok === false, "invalid token should be rejected");

  const disabled = await authenticateMqttConnect(
    { username: "any-user", password: disabledToken },
    { deviceTokensPath, allowAnonymous: false, remoteAddress: "127.0.0.1" },
  );
  assert(disabled.ok === false, "disabled token should be rejected");
  assert(disabled.returnCode === 5, "disabled token should use not-authorized return code");

  assert(topicAllowedByPrefixes("nodevision/iot/garden/bed1/moisture", valid.principal.allowedTopicPrefixes), "publish inside prefix should be allowed");
  assert(!topicAllowedByPrefixes("nodevision/private/garden/bed1/moisture", valid.principal.allowedTopicPrefixes), "publish outside prefix should be rejected");

  assert(topicFilterAllowedByPrefixes("nodevision/iot/#", valid.principal.allowedTopicPrefixes), "subscribe inside prefix should be allowed");
  assert(topicFilterAllowedByPrefixes("nodevision/iot/+/moisture", valid.principal.allowedTopicPrefixes), "single-level wildcard inside prefix should be allowed");
  assert(!topicFilterAllowedByPrefixes("nodevision/#", valid.principal.allowedTopicPrefixes), "subscribe outside prefix should be rejected");
  assert(!topicFilterAllowedByPrefixes("#", valid.principal.allowedTopicPrefixes), "broad # should be rejected without nodevision/ prefix");
  assert(topicFilterAllowedByPrefixes("#", ["nodevision/"]), "broad # can be allowed by explicit nodevision/ prefix");

  const anonymousDefault = await authenticateMqttConnect(
    { username: null, password: null },
    { deviceTokensPath, allowAnonymous: false, remoteAddress: "127.0.0.1" },
  );
  assert(anonymousDefault.ok === false, "anonymous should be rejected by default");

  const anonymousAllowed = await authenticateMqttConnect(
    { username: null, password: null },
    { deviceTokensPath, allowAnonymous: true, remoteAddress: "127.0.0.1" },
  );
  assert(anonymousAllowed.ok === true, "anonymous should be allowed when explicitly enabled locally");
  assert(anonymousAllowed.principal.anonymous === true, "anonymous principal flag mismatch");

  const anonymousRemote = await authenticateMqttConnect(
    { username: null, password: null },
    { deviceTokensPath, allowAnonymous: true, remoteAddress: "192.168.1.20" },
  );
  assert(anonymousRemote.ok === false, "anonymous should not be allowed for non-local clients");

  console.log("PASS");
}

main().catch((err) => {
  console.error("MQTT auth test failed:", err);
  process.exitCode = 1;
});
