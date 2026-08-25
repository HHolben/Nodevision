// Nodevision/ApplicationSystem/Sync/test-local-peer-urls.mjs
// Focused tests for local peer URL selection displayed by the Sync Panel.

import assert from "node:assert/strict";

import { getPreferredLocalPeerUrls } from "./LocalPeerUrls.mjs";

function ipv4(address) {
  const parts = String(address || "").split(".").map((part) => Number(part));
  const loopback = parts[0] === 127;
  const linkLocal = parts[0] === 169 && parts[1] === 254;
  const privateAddress = parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168);
  const unspecified = parts.every((part) => part === 0);
  const multicast = parts[0] >= 224 && parts[0] <= 239;
  return {
    family: "IPv4",
    address,
    loopback,
    linkLocal,
    private: privateAddress,
    global: !loopback && !linkLocal && !privateAddress && !unspecified && !multicast,
    scope: loopback ? "loopback" : linkLocal ? "link-local" : privateAddress ? "private" : "global",
    usableForPeerUrl: !loopback && !unspecified && !multicast,
  };
}

function iface(name, address, options = {}) {
  return {
    name,
    appearsWireless: options.wireless ?? /^wl/i.test(name),
    appearsVirtual: options.virtual === true,
    appearsUsbEthernet: options.usb === true,
    likelyDirectWired: options.direct === true,
    hasDefaultRoute: options.defaultRoute === true,
    carrier: options.carrier ?? true,
    administrativeState: options.active === false ? "down" : "up",
    operstate: options.active === false ? "down" : "up",
    ipv4Addresses: Array.isArray(address) ? address.map(ipv4) : [ipv4(address)],
  };
}

function urls(options) {
  return getPreferredLocalPeerUrls({
    bindHost: "0.0.0.0",
    port: 3000,
    ...options,
  });
}

function testLoopbackExcluded() {
  const result = urls({ interfaces: [iface("lo", "127.0.0.1", { virtual: true })] });
  assert.equal(result.preferred, null);
  assert.equal(result.unavailableReason, "no-usable-interface");
  assert(!result.alternatives.includes("http://127.0.0.1:3000"));
}

function testWirelessSelectedInWirelessMode() {
  const result = urls({
    transport: "wireless",
    interfaces: [
      iface("wlp4s0", "172.20.10.4", { wireless: true, defaultRoute: true }),
      iface("enp3s0", "192.168.50.1", { direct: true }),
    ],
  });
  assert.equal(result.preferred, "http://172.20.10.4:3000");
  assert(result.alternatives.includes("http://192.168.50.1:3000"));
}

function testWiredSelectedInUsbMode() {
  const result = urls({
    transport: "usb",
    interfaces: [
      iface("wlp0s20f3", "172.20.10.3", { wireless: true, defaultRoute: true }),
      iface("enp0s13f0u3", "192.168.50.2", { direct: true }),
    ],
  });
  assert.equal(result.preferred, "http://192.168.50.2:3000");
  assert(result.alternatives.includes("http://172.20.10.3:3000"));
}

function testMultipleAddressesAndPort() {
  const result = urls({
    transport: "usb",
    port: 3100,
    interfaces: [
      iface("enx001122334455", "169.254.20.1", { usb: true, direct: true }),
      iface("eth0", "10.42.0.12"),
    ],
  });
  assert.equal(result.preferred, "http://169.254.20.1:3100");
  assert.deepEqual(result.alternatives, ["http://10.42.0.12:3100"]);
}

function testBindingRules() {
  const interfaces = [iface("enp3s0", "192.168.50.1", { direct: true })];
  const loopback = urls({ bindHost: "127.0.0.1", interfaces });
  assert.equal(loopback.preferred, null);
  assert.equal(loopback.unavailableReason, "localhost-only");

  const allInterfaces = urls({ bindHost: "0.0.0.0", interfaces });
  assert.equal(allInterfaces.preferred, "http://192.168.50.1:3000");
}

function testInactiveInterfacesIgnored() {
  const result = urls({
    transport: "usb",
    interfaces: [
      iface("enp3s0", "192.168.50.1", { active: false, direct: true }),
      iface("wlp4s0", "172.20.10.4", { wireless: true }),
    ],
  });
  assert.equal(result.preferred, "http://172.20.10.4:3000");
  assert(!result.alternatives.includes("http://192.168.50.1:3000"));
}

function main() {
  testLoopbackExcluded();
  testWirelessSelectedInWirelessMode();
  testWiredSelectedInUsbMode();
  testMultipleAddressesAndPort();
  testBindingRules();
  testInactiveInterfacesIgnored();
  console.log("PASS");
}

main();
