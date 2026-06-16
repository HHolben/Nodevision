// Nodevision/ApplicationSystem/public/test-sync-transport-settings.mjs
// Focused tests for Sync Panel peer URL transport selection.

import assert from "node:assert/strict";
import { getActivePeerUrl, normalizeSyncTransport } from "./SyncTransportSettings.mjs";

assert.equal(normalizeSyncTransport(), "wireless");
assert.equal(normalizeSyncTransport("usb"), "usb");
assert.equal(normalizeSyncTransport("wireless"), "wireless");
assert.equal(normalizeSyncTransport("unknown"), "wireless");

assert.equal(getActivePeerUrl({ peerUrl: "http://10.0.0.42:3000" }), "http://10.0.0.42:3000");
assert.equal(getActivePeerUrl({ syncTransport: "wireless", wirelessPeerUrl: "http://10.0.0.43:3000", peerUrl: "http://10.0.0.42:3000" }), "http://10.0.0.43:3000");
assert.equal(getActivePeerUrl({ syncTransport: "usb", wirelessPeerUrl: "http://10.0.0.43:3000", usbPeerUrl: "http://192.168.50.2:3000" }), "http://192.168.50.2:3000");
assert.equal(getActivePeerUrl({ syncTransport: "usb", wirelessPeerUrl: "http://10.0.0.43:3000", peerUrl: "http://10.0.0.42:3000" }), "");
