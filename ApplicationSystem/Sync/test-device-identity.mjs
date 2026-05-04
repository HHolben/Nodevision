// Nodevision/ApplicationSystem/Sync/test-device-identity.mjs
// This script validates local identity bootstrap by ensuring the device identity exists, signing a hello message, and verifying that signature with the local public key.

import {
  ensureDeviceIdentity,
  signMessage,
  verifyMessage,
} from "./DeviceIdentity.mjs";

async function main() {
  const identity = await ensureDeviceIdentity();

  console.log(`deviceId: ${identity.deviceId}`);
  console.log(`deviceName: ${identity.deviceName}`);
  console.log(`publicKeyPath: ${identity.publicKeyPath}`);

  const hello = {
    type: "nodevision.peer.hello",
    deviceId: identity.deviceId,
    deviceName: identity.deviceName,
    timestamp: new Date().toISOString(),
  };

  const { payload, signatureBase64 } = await signMessage(hello);
  const verified = await verifyMessage(payload, signatureBase64, identity.publicKey);

  if (verified) {
    console.log("PASS");
    return;
  }

  console.log("FAIL");
  process.exitCode = 1;
}

main().catch((err) => {
  console.error("Identity test failed:", err);
  process.exitCode = 1;
});
