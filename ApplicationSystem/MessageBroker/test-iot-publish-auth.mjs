// Nodevision/ApplicationSystem/MessageBroker/test-iot-publish-auth.mjs
// Tests bearer-token IoT publish access into the internal broker.

import express from "express";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";

import { createBroker } from "./BrokerCore.mjs";
import { hashToken, writeDeviceTokens } from "./IoTDeviceTokens.mjs";
import { registerBrokerRoutes } from "../server/routes/brokerRoutes.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function listen(app) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

async function postJson(baseUrl, token, body) {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}/api/iot/publish`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function main() {
  const runtimeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nodevision-iot-publish-"));
  const deviceTokensPath = path.join(runtimeRoot, "ServerSettings", "IoT", "DeviceTokens.json");
  const validToken = "valid-device-token-for-test";
  const disabledToken = "disabled-device-token-for-test";

  await writeDeviceTokens(deviceTokensPath, {
    tokens: [
      {
        name: "wokwi-garden-test",
        tokenHash: hashToken(validToken),
        allowedTopicPrefixes: ["nodevision/iot/"],
        enabled: true,
        createdAt: "2026-05-28T00:00:00.000Z",
      },
      {
        name: "disabled-garden-test",
        tokenHash: hashToken(disabledToken),
        allowedTopicPrefixes: ["nodevision/iot/"],
        enabled: false,
        createdAt: "2026-05-28T00:00:00.000Z",
      },
    ],
  });

  const rawTokenFile = await fs.readFile(deviceTokensPath, "utf8");
  assert(rawTokenFile.includes(hashToken(validToken)), "token file should contain token hash");
  assert(!rawTokenFile.includes(validToken), "token file should not contain plaintext token");

  const app = express();
  const broker = createBroker({ maxEvents: 20 });
  const published = [];
  broker.subscribe("nodevision/iot/#", (message) => published.push(message));
  app.use(express.json({ limit: "16kb" }));
  registerBrokerRoutes(app, { runtimeRoot, messageBroker: broker });

  const { server, baseUrl } = await listen(app);
  try {
    const valid = await postJson(baseUrl, validToken, {
      topic: "nodevision/iot/garden/bed1/moisture",
      payload: { device: "wokwi-esp32-garden", moisture: 1234, pumpOn: true },
      retain: true,
    });
    assert(valid.status === 200, "valid token should publish allowed topic");
    assert(valid.body.ok === true, "valid publish response should be ok");
    assert(valid.body.topic === "nodevision/iot/garden/bed1/moisture", "valid publish response topic mismatch");
    assert(valid.body.retained === true, "valid publish response should report retained true");
    assert(published.length === 1, "valid publish should reach broker subscribers");
    assert(published[0].publisherId === "wokwi-garden-test", "publisherId should be token name");
    assert(broker.getRetained("nodevision/iot/garden/bed1/moisture")?.payload.moisture === 1234, "retained message should be stored");

    const invalid = await postJson(baseUrl, "not-a-valid-token", {
      topic: "nodevision/iot/garden/bed1/moisture",
      payload: { moisture: 1000 },
    });
    assert(invalid.status === 401, "invalid token should be rejected");

    const missing = await postJson(baseUrl, null, {
      topic: "nodevision/iot/garden/bed1/moisture",
      payload: { moisture: 1000 },
    });
    assert(missing.status === 401, "missing token should be rejected");

    const disabled = await postJson(baseUrl, disabledToken, {
      topic: "nodevision/iot/garden/bed1/moisture",
      payload: { moisture: 1000 },
    });
    assert(disabled.status === 403, "disabled token should be rejected");

    const disallowed = await postJson(baseUrl, validToken, {
      topic: "nodevision/private/garden/bed1/moisture",
      payload: { moisture: 1000 },
    });
    assert(disallowed.status === 403, "disallowed topic should be rejected");

    const tooLarge = await postJson(baseUrl, validToken, {
      topic: "nodevision/iot/garden/bed1/moisture",
      payload: { data: "x".repeat(4096) },
    });
    assert(tooLarge.status === 413, "payload over 4KB should be rejected");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  console.log("PASS");
}

main().catch((err) => {
  console.error("IoT publish auth test failed:", err);
  process.exitCode = 1;
});
