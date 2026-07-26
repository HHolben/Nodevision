// Nodevision/ApplicationSystem/Sync/WiredSyncDiagnostics.mjs
// Safe, non-destructive wired/direct-network sync diagnostics for local CLI,
// server endpoints, and Sync Panel UI probes.

import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import net from "node:net";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import { loadDeviceIdentity, loadPrivateKey, signMessage, verifyMessage } from "./DeviceIdentity.mjs";
import { findTrustedPeer } from "./TrustedPeers.mjs";
import { validateHelloMessage } from "./PeerHello.mjs";
import {
  validateScopeFileRequestMessage,
  createSignedScopeFileStreamPush,
  verifySignedScopeFileStreamPush,
  verifySignedScopeManifestRequest,
  verifySignedScopeFileRequest,
  isScopedPeerVerificationError,
} from "./ScopePeerSync.mjs";
import { buildScopeManifest, validateSyncScope } from "./SyncScopes.mjs";
import { loadSyncProtection } from "./SyncProtection.mjs";
import { startPeerDiscoveryBroadcaster, startPeerDiscoveryListener } from "./PeerDiscovery.mjs";
import { readRuntimeConfigFile, resolveRuntimeNetworkConfig } from "../core/runtimeNetworkConfig.mjs";

export const WIRED_DIAGNOSTIC_PROTOCOL_VERSION = 1;
export const DEFAULT_DISCOVERY_DIAGNOSTIC_DURATION_MS = 5_000;
export const DEFAULT_HTTP_TIMEOUT_MS = 2_500;
export const DEFAULT_TCP_TIMEOUT_MS = 2_000;
export const DEFAULT_SCOPE = "SyncTest";

export const DIAGNOSTIC_CODES = Object.freeze({
  WIRED_ADAPTER_NOT_FOUND: "WIRED_ADAPTER_NOT_FOUND",
  WIRED_LINK_NO_CARRIER: "WIRED_LINK_NO_CARRIER",
  WIRED_INTERFACE_DOWN: "WIRED_INTERFACE_DOWN",
  WIRED_ADDRESS_MISSING: "WIRED_ADDRESS_MISSING",
  WIRED_SUBNET_MISMATCH: "WIRED_SUBNET_MISMATCH",
  WIRED_ROUTE_MISSING: "WIRED_ROUTE_MISSING",
  PEER_HOST_UNREACHABLE: "PEER_HOST_UNREACHABLE",
  PEER_PORT_REFUSED: "PEER_PORT_REFUSED",
  PEER_CONNECTION_TIMEOUT: "PEER_CONNECTION_TIMEOUT",
  DIRECTIONAL_CONNECTIVITY_FAILURE: "DIRECTIONAL_CONNECTIVITY_FAILURE",
  LOCAL_SERVER_NOT_RUNNING: "LOCAL_SERVER_NOT_RUNNING",
  LOCAL_SERVER_LOOPBACK_ONLY: "LOCAL_SERVER_LOOPBACK_ONLY",
  LOCAL_SERVER_PORT_MISMATCH: "LOCAL_SERVER_PORT_MISMATCH",
  FIREWALL_SUSPECTED: "FIREWALL_SUSPECTED",
  DIAGNOSTIC_ROUTE_MISSING: "DIAGNOSTIC_ROUTE_MISSING",
  PEER_ROUTE_NOT_FOUND: "PEER_ROUTE_NOT_FOUND",
  PEER_PROTOCOL_MISMATCH: "PEER_PROTOCOL_MISMATCH",
  PEER_IDENTITY_MISSING: "PEER_IDENTITY_MISSING",
  PEER_IDENTITY_DUPLICATE: "PEER_IDENTITY_DUPLICATE",
  PEER_NOT_TRUSTED: "PEER_NOT_TRUSTED",
  PEER_PUBLIC_KEY_MISMATCH: "PEER_PUBLIC_KEY_MISMATCH",
  PEER_SIGNATURE_REJECTED: "PEER_SIGNATURE_REJECTED",
  PEER_TIMESTAMP_REJECTED: "PEER_TIMESTAMP_REJECTED",
  PEER_SCOPE_REJECTED: "PEER_SCOPE_REJECTED",
  PROTECTED_MODE_REJECTED: "PROTECTED_MODE_REJECTED",
  MANIFEST_REQUEST_FAILED: "MANIFEST_REQUEST_FAILED",
  EXPLICIT_CONNECTION_SUCCEEDED: "EXPLICIT_CONNECTION_SUCCEEDED",
  AUTOMATIC_DISCOVERY_FAILED: "AUTOMATIC_DISCOVERY_FAILED",
});

export const PUBLIC_ROUTE_INVENTORY = Object.freeze([
  {
    stage: "Minimal unauthenticated diagnostic endpoint",
    method: "GET",
    route: "/api/sync/diagnostics/ping",
    authenticationRequired: "No",
    expectedSuccess: "200 JSON with service, protocolVersion, public device identity summary, configured port, timestamp",
    sourceFile: "ApplicationSystem/server/routes/peerRoutes.mjs",
  },
  {
    stage: "Sync capability endpoint",
    method: "GET",
    route: "/api/sync/capabilities",
    authenticationRequired: "No",
    expectedSuccess: "200 JSON with protocolVersion, supported transports and sync modes, protected-mode flags",
    sourceFile: "ApplicationSystem/server/routes/peerRoutes.mjs",
  },
  {
    stage: "Public peer status",
    method: "GET",
    route: "/api/peer/status",
    authenticationRequired: "No for public status; session/localhost includes trusted-peer status list",
    expectedSuccess: "200 JSON with local device identity and sync capability flags",
    sourceFile: "ApplicationSystem/server/routes/peerRoutes.mjs",
  },
  {
    stage: "Signed peer hello",
    method: "POST",
    route: "/api/peer/hello",
    authenticationRequired: "Signed trusted peer; writes trusted-peer lastSeen/hello status",
    expectedSuccess: "200 JSON with peer and signed response",
    sourceFile: "ApplicationSystem/server/routes/peerRoutes.mjs",
  },
  {
    stage: "Diagnostic signed peer authentication",
    method: "POST",
    route: "/api/sync/diagnostics/peer-auth",
    authenticationRequired: "Signed trusted peer",
    expectedSuccess: "200 JSON with trust/signature/timestamp decision, no trust-record write",
    sourceFile: "ApplicationSystem/server/routes/peerRoutes.mjs",
  },
  {
    stage: "Diagnostic signed sync capabilities",
    method: "POST",
    route: "/api/sync/diagnostics/capabilities",
    authenticationRequired: "Signed trusted peer",
    expectedSuccess: "200 JSON with authenticated capability metadata only, no Notebook data",
    sourceFile: "ApplicationSystem/server/routes/peerRoutes.mjs",
  },
  {
    stage: "Legacy SyncTest manifest",
    method: "POST",
    route: "/api/peer/manifest",
    authenticationRequired: "Signed trusted peer",
    expectedSuccess: "200 JSON with full SyncTest manifest",
    sourceFile: "ApplicationSystem/server/routes/peerRoutes.mjs",
  },
  {
    stage: "Scoped manifest",
    method: "POST",
    route: "/api/peer/scope/manifest",
    authenticationRequired: "Signed trusted peer",
    expectedSuccess: "200 JSON with full scoped manifest",
    sourceFile: "ApplicationSystem/server/routes/peerRoutes.mjs",
  },
  {
    stage: "Diagnostic scoped manifest summary",
    method: "POST",
    route: "/api/sync/diagnostics/scope-manifest-summary",
    authenticationRequired: "Signed trusted peer",
    expectedSuccess: "200 JSON with manifest counts/bytes only",
    sourceFile: "ApplicationSystem/server/routes/peerRoutes.mjs",
  },
  {
    stage: "Legacy SyncTest file get",
    method: "POST",
    route: "/api/peer/file-get",
    authenticationRequired: "Signed trusted peer",
    expectedSuccess: "200 JSON with file content; diagnostics do not call this route",
    sourceFile: "ApplicationSystem/server/routes/peerRoutes.mjs",
  },
  {
    stage: "Legacy SyncTest file push",
    method: "POST",
    route: "/api/peer/file-push",
    authenticationRequired: "Signed trusted peer; blocked by protected mode",
    expectedSuccess: "200 JSON after write; diagnostics do not call this route",
    sourceFile: "ApplicationSystem/server/routes/peerRoutes.mjs",
  },
  {
    stage: "Scoped JSON file get",
    method: "POST",
    route: "/api/peer/scope/file-get",
    authenticationRequired: "Signed trusted peer",
    expectedSuccess: "200 JSON with file content; diagnostics do not call this route",
    sourceFile: "ApplicationSystem/server/routes/peerRoutes.mjs",
  },
  {
    stage: "Scoped JSON file push",
    method: "POST",
    route: "/api/peer/scope/file-push",
    authenticationRequired: "Signed trusted peer; blocked by protected mode",
    expectedSuccess: "200 JSON after write; diagnostics do not call this route",
    sourceFile: "ApplicationSystem/server/routes/peerRoutes.mjs",
  },
  {
    stage: "Scoped stream file get",
    method: "GET",
    route: "/api/peer/scope/file-stream",
    authenticationRequired: "Signed trusted peer",
    expectedSuccess: "200 binary stream; diagnostics do not call this route",
    sourceFile: "ApplicationSystem/server/routes/peerRoutes.mjs",
  },
  {
    stage: "Diagnostic scoped stream auth validation",
    method: "POST",
    route: "/api/sync/diagnostics/scope-file-stream-auth",
    authenticationRequired: "Signed trusted peer",
    expectedSuccess: "200 JSON after auth/path/scope validation, before file read",
    sourceFile: "ApplicationSystem/server/routes/peerRoutes.mjs",
  },
  {
    stage: "Diagnostic scoped stream push auth validation",
    method: "POST",
    route: "/api/sync/diagnostics/scope-file-stream-push-auth",
    authenticationRequired: "Signed trusted peer",
    expectedSuccess: "200 JSON or 403 protected-mode JSON after auth/path/scope validation, before file write",
    sourceFile: "ApplicationSystem/server/routes/peerRoutes.mjs",
  },
  {
    stage: "Scoped stream file push",
    method: "POST",
    route: "/api/peer/scope/file-stream-push",
    authenticationRequired: "Signed trusted peer; blocked by protected mode",
    expectedSuccess: "200 JSON after write; diagnostics do not call this route",
    sourceFile: "ApplicationSystem/server/routes/peerRoutes.mjs",
  },
  {
    stage: "Sync Panel status",
    method: "GET",
    route: "/api/sync/status",
    authenticationRequired: "Local UI session",
    expectedSuccess: "200 JSON with discovery state, peers, USB/direct diagnostics",
    sourceFile: "ApplicationSystem/server/routes/syncPanelRoutes.mjs",
  },
  {
    stage: "Sync Panel discovery scanning",
    method: "POST",
    route: "/api/sync/discovery/scanning",
    authenticationRequired: "Local UI session",
    expectedSuccess: "200 JSON after starting/stopping listener and optional direct HTTP candidate probing",
    sourceFile: "ApplicationSystem/server/routes/syncPanelRoutes.mjs",
  },
  {
    stage: "Sync Panel discovery discoverable",
    method: "POST",
    route: "/api/sync/discovery/discoverable",
    authenticationRequired: "Local UI session",
    expectedSuccess: "200 JSON after starting/stopping broadcaster and optional direct HTTP candidate probing",
    sourceFile: "ApplicationSystem/server/routes/syncPanelRoutes.mjs",
  },
  {
    stage: "Sync Panel trust peer",
    method: "POST",
    route: "/api/sync/trust-peer",
    authenticationRequired: "Local UI session",
    expectedSuccess: "200 JSON after adding discovered public key to TrustedPeers.json; diagnostics do not call this route",
    sourceFile: "ApplicationSystem/server/routes/syncPanelRoutes.mjs",
  },
  {
    stage: "Sync Panel preflight",
    method: "POST",
    route: "/api/sync/preflight",
    authenticationRequired: "Local UI session plus signed peer requests",
    expectedSuccess: "200 JSON dry-run plan; diagnostics do not apply sync",
    sourceFile: "ApplicationSystem/server/routes/syncPanelRoutes.mjs",
  },
  {
    stage: "Sync Panel run",
    method: "POST",
    route: "/api/sync/run",
    authenticationRequired: "Local UI session plus signed peer requests",
    expectedSuccess: "200 JSON; defaults to dryRun true but can apply sync",
    sourceFile: "ApplicationSystem/server/routes/syncPanelRoutes.mjs",
  },
  {
    stage: "Sync Panel job start",
    method: "POST",
    route: "/api/sync/jobs/start",
    authenticationRequired: "Local UI session plus signed peer requests",
    expectedSuccess: "202 JSON job; can apply sync when dryRun false",
    sourceFile: "ApplicationSystem/server/routes/syncPanelRoutes.mjs",
  },
]);

const TCP_LISTEN_STATE = "0A";
const PRIVATE_KEY_RE = /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/gi;
const SIGNATURE_RE = /"signature(Base64)?"\s*:\s*"[^"]+"/gi;

function nowIso() {
  return new Date().toISOString();
}

function moduleRepoRoot() {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(moduleDir, "..", "..");
}

function resolveRuntimeRoot(options = {}) {
  if (options.runtimeRoot) return path.resolve(String(options.runtimeRoot));
  if (process.env.NODEVISION_ROOT) return path.resolve(process.env.NODEVISION_ROOT);
  return moduleRepoRoot();
}

function sha256Short(value, length = 16) {
  const text = String(value || "");
  if (!text) return null;
  return createHash("sha256").update(text).digest("hex").slice(0, length);
}

function redactedId(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (text.length <= 18) return text;
  return `${text.slice(0, 10)}...${text.slice(-6)}`;
}

function redactMac(mac) {
  const text = String(mac || "").trim().toLowerCase();
  if (!/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/.test(text)) return "";
  const parts = text.split(":");
  return `${parts[0]}:${parts[1]}:xx:xx:xx:${parts[5]}`;
}

function sanitizeText(value, maxLength = 1200) {
  let text = String(value ?? "");
  text = text.replace(PRIVATE_KEY_RE, "[REDACTED_PRIVATE_KEY]");
  text = text.replace(SIGNATURE_RE, "\"signatureBase64\":\"[REDACTED_SIGNATURE]\"");
  text = text.replace(/-----BEGIN PUBLIC KEY-----[\s\S]*?-----END PUBLIC KEY-----/gi, "[REDACTED_PUBLIC_KEY]");
  if (text.length > maxLength) return `${text.slice(0, maxLength)}...`;
  return text;
}

function sanitizeJson(value, depth = 0) {
  if (depth > 6) return "[MaxDepth]";
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === "string") {
    if (value.includes("PRIVATE KEY")) return "[REDACTED_PRIVATE_KEY]";
    if (value.includes("PUBLIC KEY")) return { redacted: true, publicKeyFingerprint: sha256Short(value) };
    if (/^[A-Za-z0-9+/]{80,}={0,2}$/.test(value)) return `[REDACTED_BASE64 length=${value.length}]`;
    return value.length > 240 ? `${value.slice(0, 240)}...` : value;
  }
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    if (value.length > 8) return [...value.slice(0, 8).map((item) => sanitizeJson(item, depth + 1)), `...${value.length - 8} more`];
    return value.map((item) => sanitizeJson(item, depth + 1));
  }
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    const lower = key.toLowerCase();
    if (lower.includes("private") || lower.includes("secret") || lower.includes("token")) {
      out[key] = "[REDACTED]";
      continue;
    }
    if (lower.includes("signature")) {
      out[key] = typeof item === "string" ? `[REDACTED_SIGNATURE length=${item.length}]` : "[REDACTED_SIGNATURE]";
      continue;
    }
    if (key === "manifest" && item && typeof item === "object") {
      out[key] = summarizeManifest(item);
      continue;
    }
    out[key] = sanitizeJson(item, depth + 1);
  }
  return out;
}

export function summarizeManifest(manifest = {}) {
  const files = Array.isArray(manifest.files) ? manifest.files : [];
  let totalBytes = 0;
  let streamEntries = 0;
  let jsonEntries = 0;
  for (const file of files) {
    const size = Number(file?.size);
    if (Number.isFinite(size) && size > 0) totalBytes += size;
    if (String(file?.transferMode || "") === "stream" || file?.tooLargeForJson === true) streamEntries += 1;
    else jsonEntries += 1;
  }
  return {
    scope: String(manifest.scope || ""),
    generatedAt: String(manifest.generatedAt || ""),
    entryCount: files.length,
    totalDeclaredBytes: totalBytes,
    transferModes: { json: jsonEntries, stream: streamEntries },
    sample: files.slice(0, 3).map((file) => ({
      relativePathFingerprint: sha256Short(file?.relativePath || "", 12),
      size: Number.isFinite(Number(file?.size)) ? Number(file.size) : null,
      transferMode: String(file?.transferMode || "json"),
    })),
  };
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizePort(value, fallback = null) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return fallback;
  return port;
}

function parseIpv4(address) {
  const parts = String(address || "").split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return parts;
}

function ipv4ToInt(address) {
  const parts = parseIpv4(address);
  if (!parts) return null;
  return (((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0;
}

function intToIpv4(value) {
  const n = Number(value) >>> 0;
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

function netmaskToPrefix(netmask) {
  const n = ipv4ToInt(netmask);
  if (n === null) return null;
  let prefix = 0;
  let seenZero = false;
  for (let bit = 31; bit >= 0; bit -= 1) {
    const one = Boolean(n & (1 << bit));
    if (one && seenZero) return null;
    if (one) prefix += 1;
    else seenZero = true;
  }
  return prefix;
}

function prefixToMask(prefix) {
  const p = Number(prefix);
  if (!Number.isInteger(p) || p < 0 || p > 32) return null;
  return p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0;
}

function ipv4Network(address, prefix) {
  const ip = ipv4ToInt(address);
  const mask = prefixToMask(prefix);
  if (ip === null || mask === null) return null;
  return intToIpv4((ip & mask) >>> 0);
}

function ipv4Broadcast(address, prefix) {
  const ip = ipv4ToInt(address);
  const mask = prefixToMask(prefix);
  if (ip === null || mask === null) return null;
  return intToIpv4(((ip & mask) | (~mask >>> 0)) >>> 0);
}

function classifyIpv4(address) {
  const parts = parseIpv4(address);
  if (!parts) return { family: "IPv4", scope: "invalid", loopback: false, private: false, linkLocal: false, global: false };
  const loopback = parts[0] === 127;
  const linkLocal = parts[0] === 169 && parts[1] === 254;
  const privateAddress = parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168);
  const unspecified = parts.every((part) => part === 0);
  const multicast = parts[0] >= 224 && parts[0] <= 239;
  return {
    family: "IPv4",
    scope: loopback ? "loopback" : linkLocal ? "link-local" : privateAddress ? "private" : unspecified ? "unspecified" : multicast ? "multicast" : "global",
    loopback,
    private: privateAddress,
    linkLocal,
    global: !loopback && !linkLocal && !privateAddress && !unspecified && !multicast,
    usableForPeerUrl: !loopback && !unspecified && !multicast,
  };
}

function classifyIpv6(address) {
  const text = String(address || "").toLowerCase();
  const bare = text.split("%")[0];
  const loopback = bare === "::1" || bare === "0:0:0:0:0:0:0:1";
  const linkLocal = bare.startsWith("fe80:") || bare === "fe80::";
  const uniqueLocal = bare.startsWith("fc") || bare.startsWith("fd");
  const unspecified = bare === "::" || bare === "0:0:0:0:0:0:0:0";
  return {
    family: "IPv6",
    scope: loopback ? "loopback" : linkLocal ? "link-local" : uniqueLocal ? "private" : unspecified ? "unspecified" : "global",
    loopback,
    private: uniqueLocal,
    linkLocal,
    global: !loopback && !linkLocal && !uniqueLocal && !unspecified,
    usableForPeerUrl: !loopback && !unspecified,
    requiresZoneIdentifier: linkLocal && !text.includes("%"),
  };
}

function readTextFile(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8").trim();
  } catch {
    return "";
  }
}

function safeInterfaceName(name) {
  const text = String(name || "").trim();
  if (!text || text.includes("/") || text.includes("\0") || text.includes("..")) return "";
  return text;
}

function readSysNetFile(name, filename, options = {}) {
  if (options.systemRoot) {
    return readTextFile(path.join(options.systemRoot, "sys", "class", "net", safeInterfaceName(name), filename));
  }
  return readTextFile(path.join("/sys/class/net", safeInterfaceName(name), filename));
}

function realDevicePath(name, options = {}) {
  try {
    const root = options.systemRoot ? path.join(options.systemRoot, "sys", "class", "net") : "/sys/class/net";
    return fs.realpathSync(path.join(root, safeInterfaceName(name), "device"));
  } catch {
    return "";
  }
}

function interfaceNameLooksWireless(name) {
  return /(?:wi-?fi|wifi|wlan|airport|wireless|^wl)/i.test(String(name || ""));
}

function interfaceNameLooksVirtualOrLoopback(name) {
  return /^(?:lo|docker|br-|veth|virbr|vmnet|vboxnet|tun|tap|wg|tailscale|zt|cni|flannel|kube|podman|utun|awdl|llw|anpi|bridge|gif|stf|p2p|ipsec)/i.test(String(name || ""));
}

function interfaceNameLooksEthernet(name) {
  return /^(?:en|eth|eno|ens|enp|enx)/i.test(String(name || ""));
}

function readInterfaceMetadata(name, options = {}) {
  const interfaceName = safeInterfaceName(name);
  if (!interfaceName) return {};
  const flagsText = readSysNetFile(interfaceName, "flags", options);
  const flags = flagsText ? Number.parseInt(flagsText, 16) : null;
  const carrierText = readSysNetFile(interfaceName, "carrier", options);
  const operstate = readSysNetFile(interfaceName, "operstate", options);
  const type = readSysNetFile(interfaceName, "type", options);
  const mac = readSysNetFile(interfaceName, "address", options);
  const mtu = Number(readSysNetFile(interfaceName, "mtu", options)) || null;
  const devicePath = realDevicePath(interfaceName, options);
  const adminUp = Number.isInteger(flags) ? Boolean(flags & 1) : operstate ? operstate !== "down" : null;
  const usb = /\/usb/i.test(devicePath);
  const wireless = interfaceNameLooksWireless(interfaceName) || Boolean(readSysNetFile(interfaceName, "wireless", options));
  return {
    operstate,
    adminUp,
    carrier: carrierText === "1" ? true : carrierText === "0" ? false : null,
    mac,
    macRedacted: redactMac(mac),
    mtu,
    type,
    usb,
    wireless,
    virtual: interfaceNameLooksVirtualOrLoopback(interfaceName),
    ethernetLike: interfaceNameLooksEthernet(interfaceName) || usb || String(type) === "1",
    devicePathKind: usb ? "usb" : devicePath ? "pci-or-platform" : "unknown",
  };
}

function procPath(name, options = {}) {
  if (options.systemRoot) return path.join(options.systemRoot, "proc", name);
  return path.join("/proc", name);
}

function readProcRoute(options = {}) {
  const routePath = procPath("net/route", options);
  const routes = [];
  const raw = readTextFile(routePath);
  if (!raw) return routes;
  const lines = raw.split(/\r?\n/).slice(1);
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 8) continue;
    const iface = parts[0];
    const destinationHex = parts[1];
    const gatewayHex = parts[2];
    const flags = Number.parseInt(parts[3], 16);
    const maskHex = parts[7];
    const decodeLittleEndianIpv4 = (hex) => {
      if (!/^[0-9a-fA-F]{8}$/.test(hex)) return "";
      const bytes = hex.match(/../g).map((item) => Number.parseInt(item, 16)).reverse();
      return bytes.join(".");
    };
    routes.push({
      interfaceName: iface,
      destination: decodeLittleEndianIpv4(destinationHex),
      gateway: decodeLittleEndianIpv4(gatewayHex),
      flags,
      netmask: decodeLittleEndianIpv4(maskHex),
      defaultRoute: destinationHex === "00000000",
      up: Boolean(flags & 1),
    });
  }
  return routes;
}

function getOsNetworkInterfaces(options = {}) {
  if (options.networkInterfaces && typeof options.networkInterfaces === "object") return options.networkInterfaces;
  return os.networkInterfaces();
}

function getSystemInterfaceNames(networkInterfaces, options = {}) {
  const names = new Set(Object.keys(networkInterfaces || {}));
  const sysRoot = options.systemRoot ? path.join(options.systemRoot, "sys", "class", "net") : "/sys/class/net";
  try {
    for (const name of fs.readdirSync(sysRoot)) {
      if (safeInterfaceName(name)) names.add(name);
    }
  } catch {}
  return [...names].sort((a, b) => a.localeCompare(b));
}

function normalizeAddressEntry(entry) {
  const family = entry?.family === 4 || String(entry?.family).toLowerCase() === "ipv4"
    ? "IPv4"
    : entry?.family === 6 || String(entry?.family).toLowerCase() === "ipv6"
      ? "IPv6"
      : String(entry?.family || "");
  const address = String(entry?.address || "").trim();
  const netmask = String(entry?.netmask || "").trim();
  const prefixLength = family === "IPv4" ? netmaskToPrefix(netmask) : Number.isInteger(entry?.cidr) ? entry.cidr : null;
  const scope = family === "IPv4" ? classifyIpv4(address) : family === "IPv6" ? classifyIpv6(address) : {};
  return {
    family,
    address,
    netmask,
    cidr: family === "IPv4" && prefixLength !== null ? `${address}/${prefixLength}` : String(entry?.cidr || ""),
    prefixLength,
    internal: Boolean(entry?.internal),
    macRedacted: redactMac(entry?.mac || ""),
    scope: scope.scope || "",
    loopback: Boolean(scope.loopback || entry?.internal),
    private: Boolean(scope.private),
    linkLocal: Boolean(scope.linkLocal),
    global: Boolean(scope.global),
    usableForPeerUrl: Boolean(scope.usableForPeerUrl),
    requiresZoneIdentifier: Boolean(scope.requiresZoneIdentifier),
  };
}

export function collectNetworkInterfaceInventory(options = {}) {
  const networkInterfaces = getOsNetworkInterfaces(options);
  const routes = readProcRoute(options);
  const interfaces = [];

  for (const name of getSystemInterfaceNames(networkInterfaces, options)) {
    const metadata = readInterfaceMetadata(name, options);
    const entries = Array.isArray(networkInterfaces?.[name]) ? networkInterfaces[name] : [];
    const addresses = entries.map(normalizeAddressEntry).map((entry) => ({ ...entry, interfaceName: name }));
    const ipv4Addresses = addresses.filter((entry) => entry.family === "IPv4");
    const ipv6Addresses = addresses.filter((entry) => entry.family === "IPv6");
    const hasDefaultRoute = routes.some((route) => route.interfaceName === name && route.defaultRoute && route.up);
    const active = metadata.adminUp !== false && metadata.operstate !== "down";
    const wiredCandidate = !metadata.wireless && !metadata.virtual && name !== "lo";
    const likelyDirectWired = wiredCandidate && (metadata.usb || metadata.carrier === true || !hasDefaultRoute || ipv4Addresses.some((addr) => addr.linkLocal || addr.private));
    interfaces.push({
      name,
      type: metadata.usb ? "usb-ethernet" : metadata.wireless ? "wireless" : metadata.virtual ? "virtual-or-loopback" : "ethernet-or-direct",
      administrativeState: metadata.adminUp === true ? "up" : metadata.adminUp === false ? "down" : "unknown",
      operstate: metadata.operstate || "unknown",
      carrier: metadata.carrier,
      macAddress: metadata.macRedacted || "",
      mtu: metadata.mtu,
      ipv4Addresses,
      ipv6Addresses,
      appearsUsbEthernet: Boolean(metadata.usb),
      appearsWireless: Boolean(metadata.wireless),
      appearsVirtual: Boolean(metadata.virtual),
      hasDefaultRoute,
      likelyDirectWired,
      routeTableEntries: routes.filter((route) => route.interfaceName === name).map((route) => ({
        destination: route.destination,
        gateway: route.gateway,
        netmask: route.netmask,
        defaultRoute: route.defaultRoute,
      })),
    });
  }

  const activeIpv4 = [];
  for (const item of interfaces) {
    for (const addr of item.ipv4Addresses) {
      if (addr.loopback || !addr.usableForPeerUrl || addr.prefixLength === null) continue;
      activeIpv4.push({ interfaceName: item.name, address: addr.address, prefixLength: addr.prefixLength });
    }
  }
  for (const item of interfaces) {
    for (const addr of item.ipv4Addresses) {
      if (addr.prefixLength === null) {
        addr.overlapsAnotherActiveInterface = false;
        continue;
      }
      const network = ipv4Network(addr.address, addr.prefixLength);
      addr.network = network;
      addr.broadcast = ipv4Broadcast(addr.address, addr.prefixLength);
      addr.overlapsAnotherActiveInterface = activeIpv4.some((other) => {
        if (other.interfaceName === item.name) return false;
        const minPrefix = Math.min(addr.prefixLength, other.prefixLength);
        return ipv4Network(addr.address, minPrefix) === ipv4Network(other.address, minPrefix);
      });
    }
  }

  return { interfaces, routes };
}

export function selectLikelyWiredInterface(interfaces = []) {
  const candidates = interfaces
    .filter((item) => item && item.name !== "lo" && item.appearsWireless !== true && item.appearsVirtual !== true)
    .map((item) => {
      let score = 0;
      if (item.likelyDirectWired) score += 20;
      if (item.carrier === true) score += 30;
      if (item.carrier === false) score -= 20;
      if (item.administrativeState === "up") score += 10;
      if (item.appearsUsbEthernet) score += 15;
      if (interfaceNameLooksEthernet(item.name)) score += 8;
      if (item.hasDefaultRoute) score -= 5;
      if (item.ipv4Addresses?.some((addr) => addr.linkLocal)) score += 12;
      if (item.ipv4Addresses?.some((addr) => addr.private)) score += 8;
      if (!item.ipv4Addresses?.length && item.ipv6Addresses?.some((addr) => addr.linkLocal)) score += 2;
      return { item, score };
    })
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));
  return candidates[0]?.item || null;
}

function makeResult({
  stage,
  test,
  status,
  durationMs = 0,
  code = null,
  explanation = "",
  evidence = {},
  details = {},
  suggestedNextStep = null,
  problemLocation = "unknown",
  required = false,
} = {}) {
  return {
    stage: String(stage || "unknown"),
    test: String(test || "unknown"),
    status: String(status || "skipped"),
    durationMs: Math.max(0, Math.trunc(Number(durationMs) || 0)),
    code,
    explanation: String(explanation || ""),
    evidence: sanitizeJson(evidence || {}),
    details: sanitizeJson(details || {}),
    suggestedNextStep: suggestedNextStep ? String(suggestedNextStep) : null,
    problemLocation,
    required: Boolean(required),
  };
}

export function buildPeerUrl({ host, address, port, protocol = "http" } = {}) {
  const scheme = String(protocol || "http").replace(/:+$/g, "").toLowerCase();
  if (scheme !== "http" && scheme !== "https") throw new Error("peer URL must use http or https");
  const rawHost = String(host || address || "").trim();
  const numericPort = normalizePort(port);
  if (!rawHost) throw new Error("peer host is required");
  if (!numericPort) throw new Error("peer port must be between 1 and 65535");
  const withoutBrackets = rawHost.startsWith("[") && rawHost.endsWith("]") ? rawHost.slice(1, -1) : rawHost;
  if (withoutBrackets === "localhost" || withoutBrackets === "127.0.0.1" || withoutBrackets === "::1") {
    throw new Error("remote peer URL must not use localhost");
  }
  if (net.isIP(withoutBrackets.split("%")[0]) === 6) {
    const encoded = withoutBrackets.replace("%", "%25");
    return scheme + "://" + "[" + encoded + "]:" + numericPort;
  }
  const parsed = new URL(scheme + "://" + rawHost + ":" + numericPort);
  return parsed.origin;
}

export function parsePeerBaseUrl(rawUrl) {
  const text = String(rawUrl || "").trim();
  if (!text) throw new Error("peer URL is required");
  const parsed = new URL(text);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("peer URL must use http or https");
  if (!parsed.hostname) throw new Error("peer URL must include a host");
  const port = normalizePort(parsed.port, parsed.protocol === "https:" ? 443 : 80);
  if (!port) throw new Error("peer URL has an invalid port");
  return {
    href: parsed.origin,
    protocol: parsed.protocol,
    hostname: parsed.hostname,
    host: parsed.host,
    port,
    isLiteralIp: net.isIP(parsed.hostname.replace(/^\[|\]$/g, "").split("%")[0]) !== 0,
  };
}

export async function tcpConnect({ host, port, timeoutMs = DEFAULT_TCP_TIMEOUT_MS } = {}) {
  const started = Date.now();
  const numericPort = normalizePort(port);
  if (!host || !numericPort) {
    return { ok: false, durationMs: Date.now() - started, code: "MALFORMED_PEER_URL", error: "Malformed host or port" };
  }
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const done = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve({ ...result, durationMs: Date.now() - started });
    };
    const timer = setTimeout(() => {
      done({ ok: false, code: DIAGNOSTIC_CODES.PEER_CONNECTION_TIMEOUT, error: "TCP connection timed out" });
    }, timeoutMs);
    socket.once("connect", () => done({ ok: true, code: null, error: null }));
    socket.once("error", (err) => {
      const errCode = String(err?.code || "");
      let code = DIAGNOSTIC_CODES.PEER_HOST_UNREACHABLE;
      if (errCode === "ECONNREFUSED") code = DIAGNOSTIC_CODES.PEER_PORT_REFUSED;
      else if (errCode === "ETIMEDOUT") code = DIAGNOSTIC_CODES.PEER_CONNECTION_TIMEOUT;
      else if (errCode === "EHOSTUNREACH" || errCode === "ENETUNREACH") code = DIAGNOSTIC_CODES.PEER_HOST_UNREACHABLE;
      done({ ok: false, code, error: err?.message || String(err), errno: errCode });
    });
    socket.connect(numericPort, host);
  });
}

async function fetchWithTimeout(url, init = {}, timeoutMs = DEFAULT_HTTP_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text().catch(() => "");
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {}
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get("content-type") || "",
      body: json ?? sanitizeText(text),
      rawBodyLength: text.length,
      durationMs: Date.now() - started,
      afterHttpConnection: true,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err?.name === "AbortError" ? "Request timed out" : err?.message || String(err),
      code: err?.name === "AbortError" ? DIAGNOSTIC_CODES.PEER_CONNECTION_TIMEOUT : classifyNetworkErrorCode(err),
      durationMs: Date.now() - started,
      afterHttpConnection: false,
    };
  } finally {
    clearTimeout(timer);
  }
}

function classifyNetworkErrorCode(err) {
  const code = String(err?.cause?.code || err?.code || "");
  if (code === "ECONNREFUSED") return DIAGNOSTIC_CODES.PEER_PORT_REFUSED;
  if (code === "ETIMEDOUT") return DIAGNOSTIC_CODES.PEER_CONNECTION_TIMEOUT;
  if (code === "EHOSTUNREACH" || code === "ENETUNREACH") return DIAGNOSTIC_CODES.PEER_HOST_UNREACHABLE;
  if (code === "ECONNRESET") return DIAGNOSTIC_CODES.PEER_HOST_UNREACHABLE;
  return code || DIAGNOSTIC_CODES.PEER_HOST_UNREACHABLE;
}

function endpointUrl(baseUrl, route) {
  return new URL(String(route || "/"), `${String(baseUrl || "").replace(/\/+$/g, "")}/`).toString();
}

export async function callEndpoint(baseUrl, route, { method = "GET", body = null, timeoutMs = DEFAULT_HTTP_TIMEOUT_MS } = {}) {
  const headers = {};
  let payload;
  if (body !== null && body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const response = await fetchWithTimeout(endpointUrl(baseUrl, route), { method, headers, body: payload }, timeoutMs);
  return {
    ...response,
    route,
    method,
    sanitizedBody: sanitizeJson(response.body),
  };
}

function parseProcTcpFile(filePath, family) {
  const sockets = [];
  const raw = readTextFile(filePath);
  if (!raw) return sockets;
  for (const line of raw.split(/\r?\n/).slice(1)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 10) continue;
    const local = parts[1] || "";
    const state = parts[3] || "";
    if (state !== TCP_LISTEN_STATE) continue;
    const [addressHex, portHex] = local.split(":");
    const port = Number.parseInt(portHex, 16);
    const inode = parts[9] || "";
    if (!Number.isInteger(port)) continue;
    sockets.push({ family, address: family === "IPv4" ? decodeTcp4Address(addressHex) : decodeTcp6Address(addressHex), port, inode });
  }
  return sockets;
}

function decodeTcp4Address(hex) {
  if (!/^[0-9a-fA-F]{8}$/.test(String(hex || ""))) return "";
  return String(hex).match(/../g).map((item) => Number.parseInt(item, 16)).reverse().join(".");
}

function decodeTcp6Address(hex) {
  const text = String(hex || "");
  if (!/^[0-9a-fA-F]{32}$/.test(text)) return "";
  if (/^0+$/.test(text)) return "::";
  if (text === "00000000000000000000000001000000") return "::1";
  const bytes = [];
  for (let i = 0; i < text.length; i += 8) {
    const word = text.slice(i, i + 8).match(/../g).reverse();
    bytes.push(...word);
  }
  const groups = [];
  for (let i = 0; i < bytes.length; i += 2) groups.push(`${bytes[i]}${bytes[i + 1]}`.replace(/^0+([0-9a-fA-F])/, "$1"));
  return groups.join(":").replace(/\b0:0:0:0:0:0:0:0\b/, "::");
}

export function getListeningSockets(options = {}) {
  return [
    ...parseProcTcpFile(procPath("net/tcp", options), "IPv4"),
    ...parseProcTcpFile(procPath("net/tcp6", options), "IPv6"),
  ];
}

function resolveRuntimeNetwork(options = {}) {
  const runtimeRoot = resolveRuntimeRoot(options);
  const configFile = readRuntimeConfigFile(runtimeRoot);
  const resolved = resolveRuntimeNetworkConfig({
    env: options.env || process.env,
    runtimeConfig: options.runtimeConfig || {},
    config: configFile.values,
  });
  return {
    runtimeRoot,
    configPath: configFile.path,
    configLoaded: configFile.loaded,
    host: resolved.host,
    port: resolved.port,
    phpHost: resolved.phpHost,
    phpPort: resolved.phpPort,
  };
}

function analyzeServerBinding({ sockets, port, selectedInterface }) {
  const onPort = sockets.filter((socket) => socket.port === port);
  const ipv4 = onPort.filter((socket) => socket.family === "IPv4");
  const ipv6 = onPort.filter((socket) => socket.family === "IPv6");
  const selectedIpv4 = selectedInterface?.ipv4Addresses?.find((addr) => addr.usableForPeerUrl)?.address || "";
  const listensAllIpv4 = ipv4.some((socket) => socket.address === "0.0.0.0");
  const listensLoopbackIpv4 = ipv4.some((socket) => socket.address === "127.0.0.1");
  const listensSelectedIpv4 = selectedIpv4 && ipv4.some((socket) => socket.address === selectedIpv4);
  const listensAllIpv6 = ipv6.some((socket) => socket.address === "::");
  const listensLoopbackIpv6 = ipv6.some((socket) => socket.address === "::1");
  return {
    port,
    selectedInterfaceName: selectedInterface?.name || null,
    selectedInterfaceIpv4: selectedIpv4 || null,
    sockets: onPort.map((socket) => ({ family: socket.family, address: socket.address, port: socket.port })),
    listening: onPort.length > 0,
    listensAllIpv4,
    listensLoopbackIpv4,
    listensSelectedIpv4,
    listensAllIpv6,
    listensLoopbackIpv6,
    ipv6Only: ipv6.length > 0 && ipv4.length === 0,
    loopbackOnly: onPort.length > 0
      && !listensAllIpv4
      && !listensSelectedIpv4
      && (listensLoopbackIpv4 || listensLoopbackIpv6)
      && ipv4.every((socket) => socket.address === "127.0.0.1")
      && ipv6.every((socket) => socket.address === "::1"),
  };
}

export async function loadLocalIdentitySummary(options = {}) {
  try {
    const identity = await loadDeviceIdentity(options);
    let hasPrivateKey = false;
    try {
      await loadPrivateKey(options);
      hasPrivateKey = true;
    } catch {
      hasPrivateKey = false;
    }
    return {
      present: true,
      canSign: hasPrivateKey,
      deviceId: identity.deviceId,
      deviceIdRedacted: redactedId(identity.deviceId),
      deviceName: identity.deviceName,
      publicKeyFingerprint: sha256Short(identity.publicKey),
      publicKeyPresent: Boolean(String(identity.publicKey || "").trim()),
    };
  } catch (err) {
    return {
      present: false,
      canSign: false,
      error: err?.message || String(err),
    };
  }
}

export async function buildDiagnosticPingPayload(options = {}) {
  const identity = await loadLocalIdentitySummary(options);
  const runtime = resolveRuntimeNetwork(options);
  const protection = await loadSyncProtection({ runtimeRoot: runtime.runtimeRoot }).catch(() => ({ protectedFromPeerWrites: false }));
  return {
    ok: true,
    service: "nodevision-sync",
    protocolVersion: WIRED_DIAGNOSTIC_PROTOCOL_VERSION,
    deviceId: identity.present ? identity.deviceId : null,
    deviceIdRedacted: identity.present ? identity.deviceIdRedacted : null,
    deviceName: identity.present ? identity.deviceName : null,
    publicKeyFingerprint: identity.present ? identity.publicKeyFingerprint : null,
    identityPresent: identity.present,
    port: normalizePort(options.port, normalizePort(runtime.port, 3000)),
    protectedFromIncomingWrites: protection?.protectedFromPeerWrites === true,
    timestamp: nowIso(),
  };
}

export async function buildCapabilitiesPayload(options = {}) {
  const ping = await buildDiagnosticPingPayload(options);
  const protectedFromIncomingWrites = ping.protectedFromIncomingWrites === true;
  return {
    ok: true,
    service: "nodevision-sync",
    protocolVersion: WIRED_DIAGNOSTIC_PROTOCOL_VERSION,
    deviceId: ping.deviceId,
    deviceName: ping.deviceName,
    publicKeyFingerprint: ping.publicKeyFingerprint,
    transports: {
      wirelessLan: true,
      directUsbEthernet: true,
      offlinePackage: true,
      httpStream: true,
    },
    sync: {
      pushSupported: !protectedFromIncomingWrites,
      pullSupported: true,
      twoWaySupported: !protectedFromIncomingWrites,
      protectedFromIncomingWrites,
      supportedSyncModes: protectedFromIncomingWrites ? ["pull"] : ["pull", "push", "sync"],
      protocolVersion: WIRED_DIAGNOSTIC_PROTOCOL_VERSION,
    },
    timestamp: nowIso(),
  };
}

export async function verifyPeerHelloForDiagnostics({ payload, signatureBase64 }, options = {}) {
  const details = {
    localDeviceIdentityLoaded: false,
    peerIdentitySupplied: false,
    trustedPeerRecordFound: false,
    publicKeyFound: false,
    signatureAccepted: false,
    timestampAccepted: false,
  };
  let payloadText = "";
  let message = null;
  try {
    payloadText = typeof payload === "string" ? payload : "";
    if (!payloadText.trim()) {
      return { ok: false, status: 400, code: "malformed_request", error: "payload must be a nonempty JSON string", details };
    }
    if (typeof signatureBase64 !== "string" || !signatureBase64.trim()) {
      return { ok: false, status: 400, code: "signature_missing", error: "signatureBase64 is required", details };
    }
    try {
      await loadDeviceIdentity(options);
      details.localDeviceIdentityLoaded = true;
    } catch {
      details.localDeviceIdentityLoaded = false;
    }
    message = validateHelloMessage(JSON.parse(payloadText));
    details.peerIdentitySupplied = Boolean(message.deviceId);
    details.timestampAccepted = true;
    const peer = await findTrustedPeer(message.deviceId, options);
    details.trustedPeerRecordFound = Boolean(peer);
    details.publicKeyFound = Boolean(peer?.publicKey);
    if (!peer) {
      return { ok: false, status: 401, code: "unknown_peer", error: "Peer is not trusted on this device", details, message: safeMessageSummary(message) };
    }
    const verified = await verifyMessage(payloadText, signatureBase64, peer.publicKey);
    details.signatureAccepted = Boolean(verified);
    if (!verified) {
      return { ok: false, status: 401, code: "invalid_signature", error: "Signature did not verify against trusted peer public key", details, message: safeMessageSummary(message) };
    }
    return {
      ok: true,
      status: 200,
      code: null,
      details,
      peer: { deviceId: peer.deviceId, deviceName: peer.deviceName, publicKeyFingerprint: sha256Short(peer.publicKey) },
      message: safeMessageSummary(message),
    };
  } catch (err) {
    const msg = String(err?.message || "");
    const code = msg.toLowerCase().includes("timestamp") ? "invalid_timestamp" : "malformed_payload";
    return { ok: false, status: code === "invalid_timestamp" ? 401 : 400, code, error: msg || "Peer hello validation failed", details, message: safeMessageSummary(message) };
  }
}

function safeMessageSummary(message = {}) {
  if (!message || typeof message !== "object") return null;
  return {
    type: String(message.type || ""),
    version: Number.isFinite(Number(message.version)) ? Number(message.version) : null,
    deviceId: String(message.deviceId || ""),
    deviceIdRedacted: redactedId(message.deviceId),
    deviceName: String(message.deviceName || ""),
    scope: message.scope ? String(message.scope) : undefined,
    relativePathFingerprint: message.relativePath ? sha256Short(message.relativePath, 12) : undefined,
    timestamp: String(message.timestamp || ""),
  };
}

export async function summarizeScopeManifestForDiagnostics(signed, options = {}) {
  const started = Date.now();
  try {
    const verified = await verifySignedScopeManifestRequest(signed, options);
    const manifest = await buildScopeManifest({ notebookDir: options.notebookDir, scope: verified.message.scope });
    return {
      ok: true,
      authenticated: true,
      protectedModePermitsOperation: true,
      peer: { deviceId: verified.peer.deviceId, deviceName: verified.peer.deviceName },
      request: safeMessageSummary(verified.message),
      manifest: summarizeManifest(manifest),
      manifestGenerationDurationMs: Date.now() - started,
    };
  } catch (err) {
    return {
      ok: false,
      authenticated: false,
      code: isScopedPeerVerificationError(err) ? err.code : "manifest_request_failed",
      error: err?.message || "Manifest summary failed",
      safeDetails: sanitizeJson(err?.safeDetails || {}),
      manifestGenerationDurationMs: Date.now() - started,
    };
  }
}

export async function validateScopeFileStreamForDiagnostics(signed, options = {}) {
  try {
    const verified = await verifySignedScopeFileRequest(signed, options);
    validateScopeFileRequestMessage(verified.message);
    return {
      ok: true,
      validationStoppedBeforeFileRead: true,
      headerParsing: "not-applicable",
      deviceIdLookup: "pass",
      timestampParsing: "pass",
      signatureVerification: "pass",
      scopeValidation: "pass",
      relativePathValidation: "pass",
      trustedPeerLookup: "pass",
      protectedModeEffect: "not-applicable-for-read",
      peer: { deviceId: verified.peer.deviceId, deviceName: verified.peer.deviceName },
      request: safeMessageSummary(verified.message),
    };
  } catch (err) {
    return {
      ok: false,
      validationStoppedBeforeFileRead: true,
      code: isScopedPeerVerificationError(err) ? err.code : "stream_validation_failed",
      error: err?.message || "Scope file stream auth validation failed",
      safeDetails: sanitizeJson(err?.safeDetails || {}),
    };
  }
}

export async function validateScopeFileStreamPushForDiagnostics(signed, options = {}) {
  try {
    const protection = await loadSyncProtection(options).catch(() => ({ protectedFromPeerWrites: false }));
    const verified = await verifySignedScopeFileStreamPush(signed, options);
    if (protection?.protectedFromPeerWrites === true) {
      return {
        ok: false,
        validationStoppedBeforeFileWrite: true,
        code: "protected_mode_rejected",
        error: "Protected mode would reject incoming stream pushes",
        peer: { deviceId: verified.peer.deviceId, deviceName: verified.peer.deviceName },
        request: safeMessageSummary(verified.message),
      };
    }
    return {
      ok: true,
      validationStoppedBeforeFileWrite: true,
      trustedPeerLookup: "pass",
      signatureVerification: "pass",
      protectedModeEffect: "permits-write",
      peer: { deviceId: verified.peer.deviceId, deviceName: verified.peer.deviceName },
      request: safeMessageSummary(verified.message),
    };
  } catch (err) {
    return {
      ok: false,
      validationStoppedBeforeFileWrite: true,
      code: isScopedPeerVerificationError(err) ? err.code : "stream_push_validation_failed",
      error: err?.message || "Scope file stream push auth validation failed",
      safeDetails: sanitizeJson(err?.safeDetails || {}),
    };
  }
}

async function createSignedHelloDiagnostic(options = {}) {
  const identity = await loadDeviceIdentity(options);
  const message = validateHelloMessage({
    type: "nodevision.peer.hello",
    version: 1,
    deviceId: identity.deviceId,
    deviceName: identity.deviceName,
    timestamp: options.timestamp ?? nowIso(),
  });
  return signMessage(message, options);
}

async function createSignedScopeManifestDiagnostic({ scope = DEFAULT_SCOPE } = {}, options = {}) {
  const identity = await loadDeviceIdentity(options);
  const message = {
    type: "nodevision.peer.scopeManifestRequest",
    version: 1,
    deviceId: identity.deviceId,
    deviceName: identity.deviceName,
    timestamp: options.timestamp ?? nowIso(),
    scope: validateSyncScope(scope),
  };
  return signMessage(message, options);
}

async function createSignedScopeFileRequestDiagnostic({ scope = DEFAULT_SCOPE, relativePath } = {}, options = {}) {
  const identity = await loadDeviceIdentity(options);
  const validatedScope = validateSyncScope(scope);
  const message = validateScopeFileRequestMessage({
    type: "nodevision.peer.scopeFileRequest",
    version: 1,
    deviceId: identity.deviceId,
    deviceName: identity.deviceName,
    timestamp: options.timestamp ?? nowIso(),
    scope: validatedScope,
    relativePath: relativePath || `${validatedScope}/__nodevision_diagnostic_probe__`,
  });
  return signMessage(message, options);
}

async function createSignedScopeFileStreamPushDiagnostic({ scope = DEFAULT_SCOPE, relativePath } = {}, options = {}) {
  const validatedScope = validateSyncScope(scope);
  return createSignedScopeFileStreamPush({
    scope: validatedScope,
    relativePath: relativePath || (validatedScope + "/__nodevision_diagnostic_probe__"),
    size: 0,
    sha256: createHash("sha256").update("").digest("hex"),
  }, options);
}

function firstUsableIpv4(item) {
  return item?.ipv4Addresses?.find((addr) => addr.usableForPeerUrl && !addr.loopback) || null;
}

function routeExistsForInterfaceNetwork(selectedInterface) {
  const usable = firstUsableIpv4(selectedInterface);
  if (!usable) return false;
  const network = ipv4Network(usable.address, usable.prefixLength);
  return selectedInterface.routeTableEntries?.some((route) => route.destination === network && route.defaultRoute !== true) || false;
}

function buildReportBase(command, options = {}) {
  const runId = `wired-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    ok: true,
    command,
    runId,
    generatedAt: nowIso(),
    protocolVersion: WIRED_DIAGNOSTIC_PROTOCOL_VERSION,
    runtimeRoot: resolveRuntimeRoot(options),
    results: [],
  };
}

function finalizeReport(report) {
  const firstFailed = report.results.find((result) => result.required && result.status === "fail") || null;
  report.ok = !firstFailed;
  report.firstFailure = firstFailed ? {
    stage: firstFailed.stage,
    test: firstFailed.test,
    code: firstFailed.code,
    explanation: firstFailed.explanation,
    problemLocation: firstFailed.problemLocation,
    suggestedNextStep: firstFailed.suggestedNextStep,
  } : null;
  return report;
}

export async function runLocalDiagnostics(options = {}) {
  const report = buildReportBase("local", options);
  const runtime = resolveRuntimeNetwork(options);
  const inventory = collectNetworkInterfaceInventory(options);
  const selected = options.interfaceName
    ? inventory.interfaces.find((item) => item.name === options.interfaceName) || null
    : selectLikelyWiredInterface(inventory.interfaces);
  const selectedIpv4 = firstUsableIpv4(selected);
  const sockets = getListeningSockets(options);
  const binding = analyzeServerBinding({ sockets, port: runtime.port, selectedInterface: selected });
  report.localIdentity = await loadLocalIdentitySummary({ runtimeRoot: runtime.runtimeRoot });
  report.runtime = runtime;
  report.network = {
    selectedInterfaceName: selected?.name || null,
    selectedInterfaceAddress: selectedIpv4?.address || null,
    interfaces: inventory.interfaces,
  };
  report.serverBinding = binding;

  report.results.push(makeResult({
    stage: "ethernet-hardware",
    test: "candidate-ethernet-interfaces",
    status: selected ? "pass" : "fail",
    code: selected ? null : DIAGNOSTIC_CODES.WIRED_ADAPTER_NOT_FOUND,
    explanation: selected
      ? `Selected likely wired interface ${selected.name}.`
      : "No non-loopback wired/direct network interface was found.",
    evidence: { selectedInterface: selected?.name || null, interfaces: inventory.interfaces },
    suggestedNextStep: selected ? null : "Run `ip -brief link` and confirm Fedora sees the USB-C Ethernet adapter.",
    problemLocation: selected ? "local" : "local",
    required: true,
  }));

  if (selected) {
    let physicalStatus = "pass";
    let physicalCode = null;
    let physicalExplanation = "Carrier detected and interface is administratively usable.";
    let next = null;
    if (selected.administrativeState === "down") {
      physicalStatus = "fail";
      physicalCode = DIAGNOSTIC_CODES.WIRED_INTERFACE_DOWN;
      physicalExplanation = "The selected wired interface is administratively down.";
      next = `Bring ${selected.name} up from Fedora Network settings or NetworkManager, then rerun diagnostics.`;
    } else if (selected.carrier === false) {
      physicalStatus = "fail";
      physicalCode = DIAGNOSTIC_CODES.WIRED_LINK_NO_CARRIER;
      physicalExplanation = "The adapter is present, but Linux reports no Ethernet carrier.";
      next = "Check the cable, both USB-C Ethernet adapters, and whether both link LEDs come on.";
    }
    report.results.push(makeResult({
      stage: "ethernet-hardware",
      test: "physical-carrier",
      status: physicalStatus,
      code: physicalCode,
      explanation: physicalExplanation,
      evidence: {
        interfaceName: selected.name,
        administrativeState: selected.administrativeState,
        operstate: selected.operstate,
        carrier: selected.carrier,
      },
      suggestedNextStep: next,
      problemLocation: "local",
      required: true,
    }));

    const ipv6LinkLocal = selected.ipv6Addresses?.find((addr) => addr.linkLocal) || null;
    let addressStatus = selectedIpv4 ? "pass" : "fail";
    let addressCode = selectedIpv4 ? null : DIAGNOSTIC_CODES.WIRED_ADDRESS_MISSING;
    let addressExplanation = selectedIpv4
      ? `Selected wired IPv4 address ${selectedIpv4.cidr || selectedIpv4.address}.`
      : "The selected wired interface has no usable IPv4 address for current direct HTTP peer URLs.";
    if (selectedIpv4?.overlapsAnotherActiveInterface) {
      addressStatus = "warning";
      addressExplanation = "The wired interface has IPv4, but its subnet overlaps another active interface.";
    }
    report.results.push(makeResult({
      stage: "address-assignment",
      test: "ip-address-suitability",
      status: addressStatus,
      code: addressCode,
      explanation: addressExplanation,
      evidence: {
        interfaceName: selected.name,
        ipv4Addresses: selected.ipv4Addresses,
        ipv6LinkLocal: ipv6LinkLocal ? { address: ipv6LinkLocal.address, requiresZoneIdentifier: ipv6LinkLocal.requiresZoneIdentifier } : null,
      },
      suggestedNextStep: selectedIpv4
        ? null
        : "A direct cable without DHCP needs IPv4 link-local addressing on both computers or explicit static IPv4 addresses on the same subnet.",
      problemLocation: "local",
      required: true,
    }));

    report.results.push(makeResult({
      stage: "local-routing",
      test: "wired-subnet-route",
      status: selectedIpv4 ? (routeExistsForInterfaceNetwork(selected) ? "pass" : "warning") : "skipped",
      code: selectedIpv4 && !routeExistsForInterfaceNetwork(selected) ? DIAGNOSTIC_CODES.WIRED_ROUTE_MISSING : null,
      explanation: selectedIpv4
        ? (routeExistsForInterfaceNetwork(selected)
          ? "A local route exists for the selected wired subnet."
          : "No explicit non-default route for the selected wired subnet was visible in /proc/net/route.")
        : "Skipped because no usable IPv4 address exists.",
      evidence: { interfaceName: selected.name, routeTableEntries: selected.routeTableEntries, selectedIpv4 },
      suggestedNextStep: selectedIpv4 && !routeExistsForInterfaceNetwork(selected)
        ? `Run \`ip route\` and confirm Fedora has a connected route for ${selectedIpv4.cidr || selectedIpv4.address}.`
        : null,
      problemLocation: "local",
      required: false,
    }));
  }

  report.results.push(makeResult({
    stage: "firewall-accessibility",
    test: "local-firewall-observation",
    status: "warning",
    code: DIAGNOSTIC_CODES.FIREWALL_SUSPECTED,
    explanation: "Local diagnostics cannot prove Fedora firewalld permits incoming peer TCP without a remote test.",
    evidence: { requiredTcpPort: runtime.port, discoveryUdpPort: 39000 },
    suggestedNextStep: "Run the reciprocal full diagnostic from the other laptop, then compare reports. Use firewall-cmd list commands from the manual procedure; do not disable the firewall permanently.",
    problemLocation: "unknown",
    required: false,
  }));

  report.results.push(makeResult({
    stage: "server-binding",
    test: "configured-port-listener",
    status: !binding.listening ? "fail" : binding.loopbackOnly || binding.ipv6Only ? "fail" : "pass",
    code: !binding.listening
      ? DIAGNOSTIC_CODES.LOCAL_SERVER_NOT_RUNNING
      : binding.loopbackOnly
        ? DIAGNOSTIC_CODES.LOCAL_SERVER_LOOPBACK_ONLY
        : binding.ipv6Only
          ? DIAGNOSTIC_CODES.LOCAL_SERVER_LOOPBACK_ONLY
          : null,
    explanation: !binding.listening
      ? `No listener was found on configured Nodevision port ${runtime.port}.`
      : binding.loopbackOnly
        ? "Nodevision is listening only on loopback; another laptop cannot reach it over Ethernet."
        : binding.ipv6Only
          ? "Nodevision is listening on IPv6 but not IPv4."
          : "Nodevision is listening on an address reachable from non-loopback interfaces.",
    evidence: { runtime, binding },
    suggestedNextStep: !binding.listening
      ? "Start Nodevision and rerun diagnostics. If it fell back to another port, use that port in the peer URL."
      : binding.loopbackOnly
        ? "Start Nodevision with HOST=0.0.0.0 or configure the server to bind the wired interface address."
        : null,
    problemLocation: "local",
    required: true,
  }));

  const localhostBase = `http://127.0.0.1:${runtime.port}`;
  const localPing = await callEndpoint(localhostBase, "/api/sync/diagnostics/ping", { method: "GET", timeoutMs: options.timeoutMs || DEFAULT_HTTP_TIMEOUT_MS });
  report.results.push(makeResult({
    stage: "raw-http-reachability",
    test: "local-loopback-diagnostic-ping",
    status: localPing.ok ? "pass" : "fail",
    code: localPing.status === 404 ? DIAGNOSTIC_CODES.DIAGNOSTIC_ROUTE_MISSING : localPing.code || (localPing.status ? DIAGNOSTIC_CODES.LOCAL_SERVER_PORT_MISMATCH : DIAGNOSTIC_CODES.LOCAL_SERVER_NOT_RUNNING),
    explanation: localPing.ok
      ? "The diagnostic ping endpoint is reachable on loopback."
      : "The diagnostic ping endpoint is not reachable on loopback at the configured port.",
    evidence: localPing,
    suggestedNextStep: localPing.status === 404
      ? "Update the peer to a build that registers GET /api/sync/diagnostics/ping."
      : "Confirm Nodevision is running on the configured port.",
    problemLocation: "local",
    required: true,
  }));

  if (selectedIpv4) {
    const wiredBase = `http://${selectedIpv4.address}:${runtime.port}`;
    const wiredPing = await callEndpoint(wiredBase, "/api/sync/diagnostics/ping", { method: "GET", timeoutMs: options.timeoutMs || DEFAULT_HTTP_TIMEOUT_MS });
    report.results.push(makeResult({
      stage: "nodevision-server-binding",
      test: "local-wired-address-diagnostic-ping",
      status: wiredPing.ok ? "pass" : "fail",
      code: wiredPing.ok ? null : (binding.loopbackOnly ? DIAGNOSTIC_CODES.LOCAL_SERVER_LOOPBACK_ONLY : wiredPing.code || DIAGNOSTIC_CODES.LOCAL_SERVER_NOT_RUNNING),
      explanation: wiredPing.ok
        ? "The local Nodevision server answers through the selected wired IPv4 address."
        : "The local Nodevision server does not answer through the selected wired IPv4 address.",
      evidence: { wiredBase, wiredPing },
      suggestedNextStep: wiredPing.ok ? null : "Fix server binding before debugging remote discovery.",
      problemLocation: "local",
      required: true,
    }));
  }

  return finalizeReport(report);
}

function classifyPeerAuthBody(body = {}) {
  const code = String(body?.code || "");
  if (code === "protected_mode_rejected") return DIAGNOSTIC_CODES.PROTECTED_MODE_REJECTED;
  if (code === "unknown_peer") return DIAGNOSTIC_CODES.PEER_NOT_TRUSTED;
  if (code === "invalid_signature") return DIAGNOSTIC_CODES.PEER_SIGNATURE_REJECTED;
  if (code.includes("timestamp")) return DIAGNOSTIC_CODES.PEER_TIMESTAMP_REJECTED;
  if (code.includes("scope")) return DIAGNOSTIC_CODES.PEER_SCOPE_REJECTED;
  return code || DIAGNOSTIC_CODES.PEER_SIGNATURE_REJECTED;
}

export async function runPeerDiagnostics(rawUrl, options = {}) {
  const report = buildReportBase("peer", options);
  report.localIdentity = await loadLocalIdentitySummary({ runtimeRoot: resolveRuntimeRoot(options) });
  let parsed;
  try {
    parsed = parsePeerBaseUrl(rawUrl);
    report.peerUrl = parsed.href;
    report.results.push(makeResult({
      stage: "peer-url",
      test: "parse-peer-url",
      status: "pass",
      explanation: "Peer URL parsed successfully.",
      evidence: parsed,
      problemLocation: "unknown",
      required: true,
    }));
  } catch (err) {
    report.peerUrl = rawUrl;
    report.results.push(makeResult({
      stage: "peer-url",
      test: "parse-peer-url",
      status: "fail",
      code: "MALFORMED_PEER_URL",
      explanation: err?.message || "Malformed peer URL.",
      evidence: { rawUrl },
      suggestedNextStep: "Use a URL such as http://169.254.20.2:3000.",
      problemLocation: "unknown",
      required: true,
    }));
    return finalizeReport(report);
  }

  const tcp = await tcpConnect({ host: parsed.hostname, port: parsed.port, timeoutMs: options.tcpTimeoutMs || DEFAULT_TCP_TIMEOUT_MS });
  report.results.push(makeResult({
    stage: "basic-tcp-http",
    test: "peer-tcp-connectivity",
    status: tcp.ok ? "pass" : "fail",
    code: tcp.ok ? null : tcp.code,
    explanation: tcp.ok ? "TCP connection to peer host and port succeeded." : "TCP connection to peer host and port failed.",
    evidence: tcp,
    suggestedNextStep: tcp.ok ? null : "Check carrier, IP subnet, server binding, and Fedora firewall on the peer.",
    problemLocation: tcp.ok ? "unknown" : "directional",
    required: true,
  }));
  if (!tcp.ok) return finalizeReport(report);

  const ping = await callEndpoint(parsed.href, "/api/sync/diagnostics/ping", { method: "GET", timeoutMs: options.timeoutMs || DEFAULT_HTTP_TIMEOUT_MS });
  report.peerIdentity = isPlainObject(ping.body) ? {
    deviceId: ping.body.deviceId || null,
    deviceIdRedacted: ping.body.deviceIdRedacted || redactedId(ping.body.deviceId),
    deviceName: ping.body.deviceName || null,
    publicKeyFingerprint: ping.body.publicKeyFingerprint || null,
    protocolVersion: ping.body.protocolVersion || null,
  } : null;
  report.results.push(makeResult({
    stage: "public-peer-identification",
    test: "diagnostic-ping",
    status: ping.ok ? "pass" : "fail",
    code: ping.status === 404 ? DIAGNOSTIC_CODES.DIAGNOSTIC_ROUTE_MISSING : ping.code || null,
    explanation: ping.ok
      ? "The public diagnostic ping endpoint answered."
      : "The public diagnostic ping endpoint did not answer successfully.",
    evidence: ping,
    suggestedNextStep: ping.status === 404
      ? "Update the peer to a build that includes GET /api/sync/diagnostics/ping, or continue with /api/peer/status for older builds."
      : "Inspect HTTP status and peer server logs.",
    problemLocation: ping.ok ? "remote" : "remote",
    required: false,
  }));

  const status = await callEndpoint(parsed.href, "/api/peer/status", { method: "GET", timeoutMs: options.timeoutMs || DEFAULT_HTTP_TIMEOUT_MS });
  const statusBody = isPlainObject(status.body) ? status.body : {};
  const statusDevice = statusBody.localDevice && typeof statusBody.localDevice === "object" ? statusBody.localDevice : statusBody;
  if (!report.peerIdentity && status.ok) {
    report.peerIdentity = {
      deviceId: statusDevice.deviceId || null,
      deviceIdRedacted: redactedId(statusDevice.deviceId),
      deviceName: statusDevice.deviceName || null,
      publicKeyFingerprint: statusDevice.publicKey ? sha256Short(statusDevice.publicKey) : null,
      protocolVersion: null,
    };
  }
  report.results.push(makeResult({
    stage: "public-peer-identification",
    test: "peer-status",
    status: status.ok ? "pass" : "fail",
    code: status.status === 404 ? DIAGNOSTIC_CODES.PEER_ROUTE_NOT_FOUND : status.code || null,
    explanation: status.ok ? "The public peer status endpoint answered." : "The public peer status endpoint failed.",
    evidence: status,
    suggestedNextStep: status.ok ? null : "Confirm /api/peer/status is registered on the peer Nodevision server.",
    problemLocation: "remote",
    required: true,
  }));
  if (status.ok && !String(statusDevice.publicKey || "").trim()) {
    report.results.push(makeResult({
      stage: "discovery-logic",
      test: "http-status-public-key-for-direct-discovery",
      status: "warning",
      code: DIAGNOSTIC_CODES.PEER_IDENTITY_MISSING,
      explanation: "Direct HTTP discovery expects a publicKey in /api/peer/status, but this peer status response did not include one.",
      evidence: { route: "/api/peer/status", hasDeviceId: Boolean(statusDevice.deviceId), hasPublicKey: false },
      suggestedNextStep: "Use UDP discovery or update the peer to expose its public key in the public status/diagnostic identity response.",
      problemLocation: "remote",
      required: false,
    }));
  }

  const capabilities = await callEndpoint(parsed.href, "/api/sync/capabilities", { method: "GET", timeoutMs: options.timeoutMs || DEFAULT_HTTP_TIMEOUT_MS });
  report.results.push(makeResult({
    stage: "sync-capability",
    test: "capabilities-endpoint",
    status: capabilities.ok ? "pass" : capabilities.status === 404 ? "warning" : "fail",
    code: capabilities.status === 404 ? DIAGNOSTIC_CODES.PEER_ROUTE_NOT_FOUND : capabilities.code || null,
    explanation: capabilities.ok ? "The sync capabilities endpoint answered." : "The sync capabilities endpoint did not answer successfully.",
    evidence: capabilities,
    suggestedNextStep: capabilities.status === 404 ? "Older peers can still expose capabilities through /api/peer/status." : null,
    problemLocation: "remote",
    required: false,
  }));

  if (report.localIdentity?.canSign !== true) {
    report.results.push(makeResult({
      stage: "signed-peer-authentication",
      test: "local-signing-identity",
      status: "fail",
      code: DIAGNOSTIC_CODES.PEER_IDENTITY_MISSING,
      explanation: "Local device identity or private key is missing, so signed peer diagnostics cannot run.",
      evidence: report.localIdentity,
      suggestedNextStep: "Start Nodevision normally once to create local identity, then rerun diagnostics.",
      problemLocation: "local",
      required: true,
    }));
    return finalizeReport(report);
  }

  const signedHello = await createSignedHelloDiagnostic({ runtimeRoot: resolveRuntimeRoot(options) });
  const peerAuth = await callEndpoint(parsed.href, "/api/sync/diagnostics/peer-auth", {
    method: "POST",
    body: signedHello,
    timeoutMs: options.timeoutMs || DEFAULT_HTTP_TIMEOUT_MS,
  });
  report.results.push(makeResult({
    stage: "signed-peer-authentication",
    test: "diagnostic-peer-auth",
    status: peerAuth.ok ? "pass" : "fail",
    code: peerAuth.ok ? null : (peerAuth.status === 404 ? DIAGNOSTIC_CODES.PEER_ROUTE_NOT_FOUND : classifyPeerAuthBody(peerAuth.body)),
    explanation: peerAuth.ok
      ? "The peer accepted the signed diagnostic hello without modifying trust records."
      : "The peer rejected the signed diagnostic hello.",
    evidence: peerAuth,
    suggestedNextStep: peerAuth.ok ? null : "If TCP and public endpoints pass, compare TrustedPeers.json public key fingerprints on both devices.",
    problemLocation: peerAuth.ok ? "remote" : "directional",
    required: true,
  }));

  const signedCapabilities = await callEndpoint(parsed.href, "/api/sync/diagnostics/capabilities", {
    method: "POST",
    body: signedHello,
    timeoutMs: options.timeoutMs || DEFAULT_HTTP_TIMEOUT_MS,
  });
  report.results.push(makeResult({
    stage: "sync-capability",
    test: "signed-sync-capabilities",
    status: signedCapabilities.ok ? "pass" : "fail",
    code: signedCapabilities.ok ? null : (signedCapabilities.status === 404 ? DIAGNOSTIC_CODES.PEER_ROUTE_NOT_FOUND : classifyPeerAuthBody(signedCapabilities.body)),
    explanation: signedCapabilities.ok
      ? "The peer accepted a signed capability-only diagnostic request."
      : "The peer rejected or did not register the signed capability diagnostic request.",
    evidence: signedCapabilities,
    suggestedNextStep: signedCapabilities.ok ? null : "Check protocol version, diagnostic route registration, trust, and signed hello validation.",
    problemLocation: signedCapabilities.ok ? "remote" : "directional",
    required: false,
  }));

  const localDeviceId = String(report.localIdentity?.deviceId || "");
  const peerDeviceId = String(report.peerIdentity?.deviceId || "");
  if (localDeviceId && peerDeviceId && localDeviceId === peerDeviceId) {
    report.results.push(makeResult({
      stage: "trust-identity-validation",
      test: "duplicate-device-identity",
      status: "fail",
      code: DIAGNOSTIC_CODES.PEER_IDENTITY_DUPLICATE,
      explanation: "The local device and peer report the same device identity.",
      evidence: { localDeviceId: redactedId(localDeviceId), peerDeviceId: redactedId(peerDeviceId) },
      suggestedNextStep: "Regenerate one installation's device identity only after backing up ServerSettings and understanding trust impact.",
      problemLocation: "unknown",
      required: true,
    }));
  }

  const signedManifest = await createSignedScopeManifestDiagnostic({ scope: options.scope || DEFAULT_SCOPE }, { runtimeRoot: resolveRuntimeRoot(options) });
  const manifest = await callEndpoint(parsed.href, "/api/sync/diagnostics/scope-manifest-summary", {
    method: "POST",
    body: signedManifest,
    timeoutMs: options.timeoutMs || DEFAULT_HTTP_TIMEOUT_MS,
  });
  report.results.push(makeResult({
    stage: "sync-manifest-exchange",
    test: "manifest-summary",
    status: manifest.ok ? "pass" : "fail",
    code: manifest.ok ? null : (manifest.status === 403 ? DIAGNOSTIC_CODES.PEER_SCOPE_REJECTED : manifest.status === 401 ? classifyPeerAuthBody(manifest.body) : DIAGNOSTIC_CODES.MANIFEST_REQUEST_FAILED),
    explanation: manifest.ok
      ? "The peer authenticated a manifest-only diagnostic request and returned counts only."
      : "The peer did not complete the manifest-only diagnostic request.",
    evidence: manifest,
    suggestedNextStep: manifest.ok ? null : "Check trust, enabled sync scope, and protected-mode policy.",
    problemLocation: manifest.ok ? "remote" : "directional",
    required: false,
  }));

  const signedStream = await createSignedScopeFileRequestDiagnostic({ scope: options.scope || DEFAULT_SCOPE }, { runtimeRoot: resolveRuntimeRoot(options) });
  const streamValidation = await callEndpoint(parsed.href, "/api/sync/diagnostics/scope-file-stream-auth", {
    method: "POST",
    body: signedStream,
    timeoutMs: options.timeoutMs || DEFAULT_HTTP_TIMEOUT_MS,
  });
  report.results.push(makeResult({
    stage: "individual-transport-components",
    test: "file-stream-auth-validation-no-file-read",
    status: streamValidation.ok ? "pass" : "fail",
    code: streamValidation.ok ? null : classifyPeerAuthBody(streamValidation.body),
    explanation: streamValidation.ok
      ? "The peer validated file-stream authentication and path/scope checks without reading a Notebook file."
      : "The peer rejected diagnostic file-stream auth validation.",
    evidence: streamValidation,
    suggestedNextStep: streamValidation.ok ? null : "Use the safe details to distinguish trust, signature, timestamp, scope, and path validation failures.",
    problemLocation: streamValidation.ok ? "remote" : "directional",
    required: false,
  }));

  const signedStreamPush = await createSignedScopeFileStreamPushDiagnostic({ scope: options.scope || DEFAULT_SCOPE }, { runtimeRoot: resolveRuntimeRoot(options) });
  const streamPushValidation = await callEndpoint(parsed.href, "/api/sync/diagnostics/scope-file-stream-push-auth", {
    method: "POST",
    body: signedStreamPush,
    timeoutMs: options.timeoutMs || DEFAULT_HTTP_TIMEOUT_MS,
  });
  const streamPushProtected = streamPushValidation.status === 403 && String(streamPushValidation.body?.code || "") === "protected_mode_rejected";
  report.results.push(makeResult({
    stage: "individual-transport-components",
    test: "file-stream-push-auth-validation-no-file-write",
    status: streamPushValidation.ok || streamPushProtected ? "pass" : "fail",
    code: streamPushValidation.ok || streamPushProtected ? null : classifyPeerAuthBody(streamPushValidation.body),
    explanation: streamPushValidation.ok
      ? "The peer validated stream-push authentication and path/scope checks without writing a Notebook file."
      : streamPushProtected
        ? "The peer authenticated the diagnostic stream-push metadata and protected mode rejected incoming writes before any file write."
        : "The peer rejected diagnostic stream-push auth validation before protected-mode success could be determined.",
    evidence: streamPushValidation,
    suggestedNextStep: streamPushValidation.ok || streamPushProtected ? null : "Use the safe details to distinguish trust, signature, timestamp, scope, path, and protected-mode failures.",
    problemLocation: streamPushValidation.ok || streamPushProtected ? "remote" : "directional",
    required: false,
  }));

  if (tcp.ok && status.ok) {
    report.results.push(makeResult({
      stage: "discovery-logic",
      test: "explicit-url-reachability",
      status: "pass",
      code: DIAGNOSTIC_CODES.EXPLICIT_CONNECTION_SUCCEEDED,
      explanation: "The peer is reachable by explicit URL. Automatic discovery should now be diagnosed separately.",
      evidence: { peerUrl: parsed.href },
      suggestedNextStep: "Run `node scripts/diagnose-wired-sync.mjs discovery --duration-ms 7000` on both machines, or use the Sync Panel diagnostics.",
      problemLocation: "unknown",
      required: false,
    }));
  }

  return finalizeReport(report);
}

export async function runEndpointDiagnostics({ url, route, method = "GET" } = {}, options = {}) {
  const report = buildReportBase("endpoint", options);
  let parsed;
  try {
    parsed = parsePeerBaseUrl(url);
  } catch (err) {
    report.results.push(makeResult({
      stage: "peer-url",
      test: "parse-peer-url",
      status: "fail",
      code: "MALFORMED_PEER_URL",
      explanation: err?.message || "Malformed peer URL.",
      evidence: { url },
      problemLocation: "unknown",
      required: true,
    }));
    return finalizeReport(report);
  }
  const tcp = await tcpConnect({ host: parsed.hostname, port: parsed.port, timeoutMs: options.tcpTimeoutMs || DEFAULT_TCP_TIMEOUT_MS });
  report.results.push(makeResult({
    stage: "basic-tcp-http",
    test: "peer-tcp-connectivity",
    status: tcp.ok ? "pass" : "fail",
    code: tcp.ok ? null : tcp.code,
    explanation: tcp.ok ? "TCP connection succeeded." : "TCP connection failed.",
    evidence: tcp,
    problemLocation: tcp.ok ? "unknown" : "directional",
    required: true,
  }));
  if (tcp.ok) {
    const endpoint = await callEndpoint(parsed.href, route, { method, timeoutMs: options.timeoutMs || DEFAULT_HTTP_TIMEOUT_MS });
    report.results.push(makeResult({
      stage: "endpoint",
      test: `${method.toUpperCase()} ${route}`,
      status: endpoint.ok ? "pass" : "fail",
      code: endpoint.status === 404 ? DIAGNOSTIC_CODES.PEER_ROUTE_NOT_FOUND : endpoint.code || null,
      explanation: endpoint.ok ? "Endpoint returned a successful HTTP status." : "Endpoint did not return a successful HTTP status.",
      evidence: endpoint,
      problemLocation: "remote",
      required: true,
    }));
  }
  return finalizeReport(report);
}

export async function runFullDiagnostics(rawUrl, options = {}) {
  const local = await runLocalDiagnostics(options);
  const peer = rawUrl ? await runPeerDiagnostics(rawUrl, options) : null;
  const report = buildReportBase("full", options);
  report.local = local;
  report.peer = peer;
  report.localIdentity = local.localIdentity;
  report.peerIdentity = peer?.peerIdentity || null;
  report.peerUrl = peer?.peerUrl || rawUrl || null;
  report.network = local.network;
  report.serverBinding = local.serverBinding;
  report.results = [
    ...local.results.map((result) => ({ ...result, reportSection: "local" })),
    ...(peer ? peer.results.map((result) => ({ ...result, reportSection: "peer" })) : []),
  ];
  return finalizeReport(report);
}

function buildDiscoveryTargetAddresses(inventory) {
  const targets = [];
  const add = (value) => {
    const text = String(value || "").trim();
    if (!text || targets.includes(text)) return;
    if (net.isIP(text) === 4) targets.push(text);
  };
  for (const item of inventory.interfaces || []) {
    if (item.appearsWireless || item.appearsVirtual) continue;
    for (const addr of item.ipv4Addresses || []) {
      if (addr.broadcast && addr.broadcast !== "255.255.255.255") add(addr.broadcast);
      const parts = parseIpv4(addr.address);
      if (parts) {
        for (const suffix of [1, 2, 129, 254, parts[3] - 1, parts[3] + 1]) {
          if (suffix >= 1 && suffix <= 254) add([...parts.slice(0, 3), suffix].join("."));
        }
      }
    }
  }
  return targets.slice(0, 128);
}

export async function runDiscoveryDiagnostics(options = {}) {
  const durationMs = Math.max(1_000, Math.min(60_000, Number(options.durationMs) || DEFAULT_DISCOVERY_DIAGNOSTIC_DURATION_MS));
  const report = buildReportBase("discovery", options);
  const inventory = collectNetworkInterfaceInventory(options);
  const selected = options.interfaceName
    ? inventory.interfaces.find((item) => item.name === options.interfaceName) || null
    : selectLikelyWiredInterface(inventory.interfaces);
  const identity = await loadLocalIdentitySummary({ runtimeRoot: resolveRuntimeRoot(options) });
  const acceptedRejected = inventory.interfaces.map((item) => ({
    name: item.name,
    accepted: item.name === selected?.name,
    reasons: [
      item.appearsWireless ? "wireless" : "",
      item.appearsVirtual ? "virtual-or-loopback" : "",
      item.carrier === false ? "no-carrier" : "",
      item.ipv4Addresses?.length ? "has-ipv4" : "no-ipv4",
      item.appearsUsbEthernet ? "usb-ethernet" : "",
      item.hasDefaultRoute ? "default-route" : "no-default-route",
    ].filter(Boolean),
  }));
  report.network = { selectedInterfaceName: selected?.name || null, interfaces: inventory.interfaces, interfaceDecisions: acceptedRejected };
  report.localIdentity = identity;
  report.discovery = {
    durationMs,
    candidates: acceptedRejected,
    localAddressesConsidered: inventory.interfaces.flatMap((item) => [
      ...(item.ipv4Addresses || []).map((addr) => ({ interfaceName: item.name, family: "IPv4", address: addr.address, scope: addr.scope })),
      ...(item.ipv6Addresses || []).map((addr) => ({ interfaceName: item.name, family: "IPv6", address: addr.address, scope: addr.scope })),
    ]),
    advertisementsSent: [],
    advertisementsReceived: [],
    errors: [],
    finalPeers: [],
  };

  if (!identity.canSign) {
    report.results.push(makeResult({
      stage: "discovery-logic",
      test: "discovery-identity",
      status: "fail",
      code: DIAGNOSTIC_CODES.PEER_IDENTITY_MISSING,
      explanation: "Discovery beacons require an existing local signing identity, but diagnostics will not create one.",
      evidence: identity,
      suggestedNextStep: "Start Nodevision normally once so its identity exists, then rerun discovery diagnostics.",
      problemLocation: "local",
      required: true,
    }));
    return finalizeReport(report);
  }

  const extraTargetAddresses = buildDiscoveryTargetAddresses(inventory);
  let listener = null;
  let broadcaster = null;
  try {
    listener = startPeerDiscoveryListener({
      runtimeRoot: resolveRuntimeRoot(options),
      verifyOptions: { runtimeRoot: resolveRuntimeRoot(options) },
      onPeerDiscovered(event = {}) {
        const peer = event.peer || {};
        report.discovery.advertisementsReceived.push({
          deviceId: peer.deviceId || null,
          deviceIdRedacted: redactedId(peer.deviceId),
          deviceName: peer.deviceName || null,
          address: peer.address || null,
          port: peer.port || null,
          trusted: peer.trusted === true,
          publicKeyFingerprint: sha256Short(peer.publicKey || ""),
        });
      },
      onError(err) {
        report.discovery.errors.push({ source: "listener", code: err?.code || "", message: err?.message || String(err) });
      },
    });
    broadcaster = startPeerDiscoveryBroadcaster({
      runtimeRoot: resolveRuntimeRoot(options),
      extraTargetAddresses,
      intervalMs: Math.max(1_000, Math.min(durationMs, 2_000)),
      onError(err) {
        report.discovery.errors.push({ source: "broadcaster", code: err?.code || "", message: err?.message || String(err) });
      },
    });
    report.discovery.advertisementsSent.push({
      mode: "existing-peer-discovery-broadcaster",
      multicastGroup: "239.255.255.250",
      broadcastAddress: "255.255.255.255",
      extraTargetAddresses,
      udpPort: 39000,
    });
    await new Promise((resolve) => setTimeout(resolve, durationMs));
  } catch (err) {
    report.discovery.errors.push({ source: "setup", code: err?.code || "", message: err?.message || String(err) });
  } finally {
    await Promise.resolve(listener?.close?.()).catch(() => {});
    await Promise.resolve(broadcaster?.stop?.()).catch(() => {});
  }
  const dedupe = new Map();
  for (const peer of report.discovery.advertisementsReceived) {
    dedupe.set(`${peer.deviceId || "unknown"}|${peer.address || "unknown"}|${peer.port || "?"}`, peer);
  }
  report.discovery.finalPeers = [...dedupe.values()];
  report.results.push(makeResult({
    stage: "discovery-logic",
    test: "bounded-discovery-run",
    status: report.discovery.finalPeers.length ? "pass" : "warning",
    code: report.discovery.finalPeers.length ? null : DIAGNOSTIC_CODES.AUTOMATIC_DISCOVERY_FAILED,
    explanation: report.discovery.finalPeers.length
      ? `Discovery received ${report.discovery.finalPeers.length} unique peer advertisement(s).`
      : "No peer advertisements were received during the bounded discovery run.",
    evidence: report.discovery,
    suggestedNextStep: report.discovery.finalPeers.length ? null : "If explicit IP tests pass, inspect UDP port 39000, multicast/broadcast routing, and Fedora firewall zone rules.",
    problemLocation: report.discovery.finalPeers.length ? "unknown" : "unknown",
    required: false,
  }));
  return finalizeReport(report);
}

function tryParseJsonReport(text) {
  const raw = String(text || "").trim();
  if (!raw) throw new Error("empty report");
  try {
    return JSON.parse(raw);
  } catch {}
  const firstBrace = raw.indexOf("{");
  if (firstBrace < 0) throw new Error("report does not contain JSON");
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = firstBrace; i < raw.length; i += 1) {
    const ch = raw[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === "\"") inString = false;
      continue;
    }
    if (ch === "\"") inString = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return JSON.parse(raw.slice(firstBrace, i + 1));
    }
  }
  throw new Error("report JSON was incomplete");
}

function resultBy(report, test) {
  return (report?.results || []).find((item) => item?.test === test) || null;
}

function firstRequiredFailure(report) {
  return report?.firstFailure || (report?.results || []).find((item) => item.required && item.status === "fail") || null;
}

function selectedSubnet(report) {
  const selectedName = report?.network?.selectedInterfaceName;
  const selected = (report?.network?.interfaces || []).find((item) => item.name === selectedName);
  const addr = firstUsableIpv4(selected);
  return addr ? `${addr.network || ipv4Network(addr.address, addr.prefixLength)}/${addr.prefixLength}` : "";
}

export async function compareDiagnosticReports(reportPaths = []) {
  if (!Array.isArray(reportPaths) || reportPaths.length < 2) {
    throw new Error("compare requires two report paths");
  }
  const reports = [];
  for (const filePath of reportPaths.slice(0, 2)) {
    const raw = await fsp.readFile(filePath, "utf8");
    reports.push({ path: filePath, report: tryParseJsonReport(raw) });
  }
  const [a, b] = reports;
  const issues = [];
  const aTcp = resultBy(a.report.peer || a.report, "peer-tcp-connectivity");
  const bTcp = resultBy(b.report.peer || b.report, "peer-tcp-connectivity");
  if (aTcp?.status === "pass" && bTcp?.status === "fail") {
    issues.push({ code: DIAGNOSTIC_CODES.DIRECTIONAL_CONNECTIVITY_FAILURE, explanation: "First report can reach its peer, but the reciprocal report cannot.", evidence: { first: a.path, second: b.path, secondCode: bTcp.code } });
  }
  if (aTcp?.status === "fail" && bTcp?.status === "pass") {
    issues.push({ code: DIAGNOSTIC_CODES.DIRECTIONAL_CONNECTIVITY_FAILURE, explanation: "Second report can reach its peer, but the first report cannot.", evidence: { first: a.path, second: b.path, firstCode: aTcp.code } });
  }
  for (const item of reports) {
    const binding = item.report.serverBinding || item.report.local?.serverBinding;
    if (binding?.loopbackOnly) {
      issues.push({ code: DIAGNOSTIC_CODES.LOCAL_SERVER_LOOPBACK_ONLY, explanation: `${item.path} reports Nodevision is bound only to loopback.`, evidence: binding });
    }
  }
  const aAuth = resultBy(a.report.peer || a.report, "diagnostic-peer-auth");
  const bAuth = resultBy(b.report.peer || b.report, "diagnostic-peer-auth");
  if (aAuth?.status === "pass" && bAuth?.status === "fail") {
    issues.push({ code: "TRUST_ONE_DIRECTION_ONLY", explanation: "Authentication succeeds in the first direction and fails in the reciprocal direction.", evidence: { failedCode: bAuth.code } });
  }
  if (aAuth?.status === "fail" && bAuth?.status === "pass") {
    issues.push({ code: "TRUST_ONE_DIRECTION_ONLY", explanation: "Authentication succeeds in the second direction and fails in the first direction.", evidence: { failedCode: aAuth.code } });
  }
  const aLocalId = a.report.localIdentity?.deviceId || a.report.local?.localIdentity?.deviceId;
  const bLocalId = b.report.localIdentity?.deviceId || b.report.local?.localIdentity?.deviceId;
  if (aLocalId && bLocalId && aLocalId === bLocalId) {
    issues.push({ code: DIAGNOSTIC_CODES.PEER_IDENTITY_DUPLICATE, explanation: "Both reports show the same local device identity.", evidence: { deviceId: redactedId(aLocalId) } });
  }
  const aProto = a.report.peerIdentity?.protocolVersion || a.report.peer?.peerIdentity?.protocolVersion;
  const bProto = b.report.peerIdentity?.protocolVersion || b.report.peer?.peerIdentity?.protocolVersion;
  if (aProto && bProto && Number(aProto) !== Number(bProto)) {
    issues.push({ code: DIAGNOSTIC_CODES.PEER_PROTOCOL_MISMATCH, explanation: "The two peers report different diagnostics protocol versions.", evidence: { first: aProto, second: bProto } });
  }
  const subnetA = selectedSubnet(a.report.local || a.report);
  const subnetB = selectedSubnet(b.report.local || b.report);
  if (subnetA && subnetB && subnetA !== subnetB) {
    issues.push({ code: DIAGNOSTIC_CODES.WIRED_SUBNET_MISMATCH, explanation: "The selected wired IPv4 interfaces are not on the same subnet.", evidence: { firstSubnet: subnetA, secondSubnet: subnetB } });
  }
  for (const item of reports) {
    const explicit = resultBy(item.report.peer || item.report, "explicit-url-reachability");
    const discovery = resultBy(item.report, "bounded-discovery-run");
    if (explicit?.status === "pass" && discovery?.status === "warning") {
      issues.push({ code: DIAGNOSTIC_CODES.AUTOMATIC_DISCOVERY_FAILED, explanation: `${item.path} can reach the peer by explicit URL but automatic discovery found no peer.`, evidence: { explicit: explicit.evidence, discovery: discovery.evidence } });
    }
  }
  return {
    ok: issues.length === 0,
    generatedAt: nowIso(),
    reports: reports.map((item) => ({
      path: item.path,
      runId: item.report.runId,
      ok: item.report.ok,
      firstFailure: firstRequiredFailure(item.report),
      selectedSubnet: selectedSubnet(item.report.local || item.report),
    })),
    issues,
  };
}

export function summarizeReportForHumans(report) {
  const first = firstRequiredFailure(report);
  const lines = [];
  lines.push(`Wired sync diagnostics: ${report.ok ? "PASS" : "FAIL"} (${report.command || "report"} run ${report.runId || "unknown"})`);
  if (first) {
    lines.push(`First blocking layer: ${first.stage} / ${first.test}`);
    if (first.code) lines.push(`Code: ${first.code}`);
    if (first.explanation) lines.push(first.explanation);
    if (first.suggestedNextStep) lines.push(`Next: ${first.suggestedNextStep}`);
  } else {
    lines.push("No required diagnostic stage failed.");
  }
  const warnings = (report.results || []).filter((result) => result.status === "warning");
  if (warnings.length) {
    lines.push(`Warnings: ${warnings.map((item) => item.code || item.test).slice(0, 4).join(", ")}${warnings.length > 4 ? "..." : ""}`);
  }
  return lines.join("\n");
}
