#!/usr/bin/env node
// Nodevision/ApplicationSystem/MessageBroker/create-iot-token.mjs
// Generates a one-time plaintext IoT bearer token and stores only its SHA-256 hash.

import { createAndStoreDeviceToken, resolveDeviceTokensPath } from "./IoTDeviceTokens.mjs";

function usage() {
  console.error("Usage: node ApplicationSystem/MessageBroker/create-iot-token.mjs <name> <allowedTopicPrefix> [additionalPrefix...]");
}

async function main() {
  const [, , name, ...allowedTopicPrefixes] = process.argv;
  if (!name || allowedTopicPrefixes.length === 0) {
    usage();
    process.exitCode = 1;
    return;
  }

  const deviceTokensPath = resolveDeviceTokensPath();
  const { token, record } = await createAndStoreDeviceToken({
    name,
    allowedTopicPrefixes,
    deviceTokensPath,
  });

  console.log(`Created IoT token: ${record.name}`);
  console.log(`Allowed topic prefixes: ${record.allowedTopicPrefixes.join(", ")}`);
  console.log(`Token file: ${deviceTokensPath}`);
  console.log("");
  console.log("Plaintext token - shown once:");
  console.log(token);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exitCode = 1;
});
