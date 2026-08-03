// Nodevision/ApplicationSystem/public/test-sync-transport-settings.mjs
// This test file verifies Sync Panel peer URL transport selection for Wi-Fi, Ethernet, and combined transport modes.

import assert from "node:assert/strict";
import { getActivePeerUrl, getActivePeerUrls, getPeerUrlFromDiscoveredPeer, normalizeSyncTransport, withActivePeerUrlFromDiscoveredPeer } from "./SyncTransportSettings.mjs";

assert.equal(normalizeSyncTransport(), "wireless");
assert.equal(normalizeSyncTransport("usb"), "usb");
assert.equal(normalizeSyncTransport("USB Cable"), "usb");
assert.equal(normalizeSyncTransport("USB Network"), "usb");
assert.equal(normalizeSyncTransport("offline-package"), "offline-package");
assert.equal(normalizeSyncTransport("Offline Package"), "offline-package");
assert.equal(normalizeSyncTransport("Wireless + Direct"), "combined");
assert.equal(normalizeSyncTransport("wifi+ethernet"), "combined");
assert.equal(normalizeSyncTransport("hybrid"), "combined");
assert.equal(normalizeSyncTransport("wireless"), "wireless");
assert.equal(normalizeSyncTransport("unknown"), "wireless");

assert.equal(getActivePeerUrl({ peerUrl: "http://10.0.0.42:3000" }), "http://10.0.0.42:3000");
assert.equal(getActivePeerUrl({ syncTransport: "wireless", wirelessPeerUrl: "http://10.0.0.43:3000", peerUrl: "http://10.0.0.42:3000" }), "http://10.0.0.43:3000");
assert.equal(getActivePeerUrl({ syncTransport: "usb", wirelessPeerUrl: "http://10.0.0.43:3000", usbPeerUrl: "http://192.168.50.2:3000" }), "http://192.168.50.2:3000");
assert.equal(getActivePeerUrl({ syncTransport: "usb", wirelessPeerUrl: "http://10.0.0.43:3000", peerUrl: "http://10.0.0.42:3000" }), "");
assert.equal(getActivePeerUrl({ syncTransport: "combined", wirelessPeerUrl: "http://10.0.0.43:3000", usbPeerUrl: "http://192.168.50.2:3000" }), "http://10.0.0.43:3000");
assert.deepEqual(getActivePeerUrls({ syncTransport: "combined", wirelessPeerUrl: "http://10.0.0.43:3000", usbPeerUrl: "http://192.168.50.2:3000" }), ["http://10.0.0.43:3000", "http://192.168.50.2:3000"]);
assert.deepEqual(getActivePeerUrls({ syncTransport: "combined", wirelessPeerUrl: "http://10.0.0.43:3000", usbPeerUrl: "http://10.0.0.43:3000" }), ["http://10.0.0.43:3000"]);
assert.equal(getActivePeerUrl({ syncTransport: "offline-package", wirelessPeerUrl: "http://10.0.0.43:3000", usbPeerUrl: "http://192.168.50.2:3000" }), "");

const discoveredPeer = { address: "192.168.50.2", port: 3000 };
assert.equal(getPeerUrlFromDiscoveredPeer(discoveredPeer), "http://192.168.50.2:3000");
assert.equal(getPeerUrlFromDiscoveredPeer({ address: "fd00::2", port: 3000 }), "http://[fd00::2]:3000");
assert.equal(getPeerUrlFromDiscoveredPeer({ address: "192.168.50.2", port: 70000 }), "");

const usbFilled = withActivePeerUrlFromDiscoveredPeer({ syncTransport: "usb", wirelessPeerUrl: "http://10.0.0.43:3000" }, discoveredPeer);
assert.equal(usbFilled.peerUrl, "http://192.168.50.2:3000");
assert.equal(usbFilled.settings.usbPeerUrl, "http://192.168.50.2:3000");
assert.equal(usbFilled.settings.wirelessPeerUrl, "http://10.0.0.43:3000");

const offlineFilled = withActivePeerUrlFromDiscoveredPeer({ syncTransport: "offline-package", wirelessPeerUrl: "http://10.0.0.43:3000" }, discoveredPeer);
assert.equal(offlineFilled.peerUrl, "");
assert.equal(offlineFilled.settings.syncTransport, "offline-package");
assert.equal(offlineFilled.settings.wirelessPeerUrl, "http://10.0.0.43:3000");

const wirelessFilled = withActivePeerUrlFromDiscoveredPeer({ syncTransport: "wireless", usbPeerUrl: "http://192.168.50.2:3000" }, { address: "10.0.0.44", port: 3000 });
assert.equal(wirelessFilled.peerUrl, "http://10.0.0.44:3000");
assert.equal(wirelessFilled.settings.wirelessPeerUrl, "http://10.0.0.44:3000");
assert.equal(wirelessFilled.settings.usbPeerUrl, "http://192.168.50.2:3000");

const combinedFirstFill = withActivePeerUrlFromDiscoveredPeer({ syncTransport: "combined" }, { address: "10.0.0.45", port: 3000 });
assert.equal(combinedFirstFill.peerUrl, "http://10.0.0.45:3000");
assert.equal(combinedFirstFill.settings.wirelessPeerUrl, "http://10.0.0.45:3000");

const combinedSecondFill = withActivePeerUrlFromDiscoveredPeer({ syncTransport: "combined", wirelessPeerUrl: "http://10.0.0.45:3000" }, { address: "192.168.50.2", port: 3000 });
assert.equal(combinedSecondFill.peerUrl, "http://192.168.50.2:3000");
assert.equal(combinedSecondFill.settings.wirelessPeerUrl, "http://10.0.0.45:3000");
assert.equal(combinedSecondFill.settings.usbPeerUrl, "http://192.168.50.2:3000");
