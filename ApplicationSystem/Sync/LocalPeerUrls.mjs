// Nodevision/ApplicationSystem/Sync/LocalPeerUrls.mjs
// This module ranks local IPv4 interface URLs that another Nodevision peer can use to reach this installation.

import net from "node:net";

import { buildPeerUrl, collectNetworkInterfaceInventory } from "./WiredSyncDiagnostics.mjs";

const DEFAULT_PORT = 3000;
const DEFAULT_MAX_URLS = 8;

function normalizePort(value, fallback = DEFAULT_PORT) {
  const port = Number(value);
  if (Number.isInteger(port) && port >= 1 && port <= 65535) return port;
  return fallback;
}

function normalizeTransport(value) {
  const text = String(value || "wireless").trim().toLowerCase();
  if (text === "usb" || text === "usb-network" || text === "usb network" || text === "usb-ethernet" || text === "usb ethernet" || text === "direct" || text === "direct-network" || text === "direct network" || text === "direct / usb ethernet") return "usb";
  if (text === "combined" || text === "wireless+direct" || text === "wireless + direct" || text === "wifi+ethernet" || text === "wifi + ethernet" || text === "lan+usb" || text === "lan + usb") return "combined";
  return "wireless";
}

function normalizeHost(value) {
  const raw = String(value || "").trim();
  if (!raw) return "0.0.0.0";
  return raw.startsWith("[") && raw.endsWith("]") ? raw.slice(1, -1) : raw;
}

function isAllInterfacesHost(host) {
  const text = normalizeHost(host).toLowerCase();
  return text === "0.0.0.0" || text === "::";
}

function isLoopbackHost(host) {
  const text = normalizeHost(host).toLowerCase();
  if (text === "localhost" || text === "::1" || text === "0:0:0:0:0:0:0:1") return true;
  const bare = text.split("%")[0];
  if (net.isIP(bare) === 4) {
    const first = Number(bare.split(".")[0]);
    return first === 127;
  }
  return false;
}

function interfaceNameLooksEthernet(name) {
  return /^(?:en|eth|eno|ens|enp|enx)/i.test(String(name || ""));
}

function usableIpv4Address(addressEntry) {
  const address = String(addressEntry?.address || "").trim();
  if (!address || net.isIP(address) !== 4) return false;
  if (addressEntry?.loopback === true || addressEntry?.usableForPeerUrl === false) return false;
  const parts = address.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  if (parts[0] === 127) return false;
  if (parts.every((part) => part === 0)) return false;
  if (parts[0] >= 224 && parts[0] <= 239) return false;
  return true;
}

function addressSortKey(address) {
  return String(address || "")
    .split(".")
    .map((part) => String(Number(part) || 0).padStart(3, "0"))
    .join(".");
}

function interfaceActive(item) {
  if (!item || item.name === "lo" || item.appearsVirtual === true) return false;
  if (item.carrier === false) return false;
  if (String(item.administrativeState || "").toLowerCase() === "down") return false;
  if (String(item.operstate || "").toLowerCase() === "down") return false;
  return true;
}

function candidateKind(item) {
  if (item?.appearsWireless) return "wireless";
  if (item?.appearsUsbEthernet) return "usb-ethernet";
  return "ethernet";
}

function collectCandidates(interfaces, port, protocol) {
  const candidates = [];
  for (const item of Array.isArray(interfaces) ? interfaces : []) {
    if (!interfaceActive(item)) continue;
    for (const addressEntry of Array.isArray(item.ipv4Addresses) ? item.ipv4Addresses : []) {
      if (!usableIpv4Address(addressEntry)) continue;
      let url;
      try {
        url = buildPeerUrl({ host: addressEntry.address, port, protocol });
      } catch {
        continue;
      }
      candidates.push({
        url,
        address: String(addressEntry.address || ""),
        interfaceName: String(item.name || ""),
        kind: candidateKind(item),
        scope: String(addressEntry.scope || ""),
        private: addressEntry.private === true,
        linkLocal: addressEntry.linkLocal === true,
        global: addressEntry.global === true,
        appearsWireless: item.appearsWireless === true,
        appearsUsbEthernet: item.appearsUsbEthernet === true,
        likelyDirectWired: item.likelyDirectWired === true,
        hasDefaultRoute: item.hasDefaultRoute === true,
        carrier: item.carrier,
        administrativeState: String(item.administrativeState || ""),
        operstate: String(item.operstate || ""),
      });
    }
  }
  return candidates;
}

function scoreWirelessCandidate(candidate) {
  let score = 0;
  if (candidate.appearsWireless) score += 120;
  else score += 55;
  if (candidate.hasDefaultRoute) score += candidate.appearsWireless ? 16 : 10;
  if (!candidate.appearsWireless && candidate.likelyDirectWired) score -= 8;
  if (!candidate.appearsWireless && candidate.appearsUsbEthernet) score -= 5;
  if (candidate.private) score += 12;
  if (candidate.global) score += 8;
  if (candidate.linkLocal) score += 3;
  if (candidate.carrier === true) score += 5;
  if (interfaceNameLooksEthernet(candidate.interfaceName)) score += candidate.appearsWireless ? 0 : 3;
  return score;
}

function scoreWiredCandidate(candidate) {
  let score = 0;
  if (!candidate.appearsWireless) score += 120;
  else score += 10;
  if (candidate.likelyDirectWired) score += 36;
  if (candidate.appearsUsbEthernet) score += 25;
  if (candidate.carrier === true) score += 15;
  if (candidate.private) score += 20;
  if (candidate.linkLocal) score += 20;
  if (candidate.global) score += 2;
  if (candidate.hasDefaultRoute) score -= candidate.appearsWireless ? 4 : 12;
  else score += 6;
  if (interfaceNameLooksEthernet(candidate.interfaceName)) score += 8;
  return score;
}

function scoreCandidate(candidate, transport) {
  return transport === "usb" || transport === "combined"
    ? scoreWiredCandidate(candidate)
    : scoreWirelessCandidate(candidate);
}

function sortCandidates(candidates, transport) {
  return candidates
    .map((candidate) => ({ ...candidate, score: scoreCandidate(candidate, transport) }))
    .sort((a, b) => b.score - a.score
      || a.interfaceName.localeCompare(b.interfaceName)
      || addressSortKey(a.address).localeCompare(addressSortKey(b.address)));
}

function dedupeUrls(candidates) {
  const seen = new Set();
  const deduped = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.url)) continue;
    seen.add(candidate.url);
    deduped.push(candidate);
  }
  return deduped;
}

function unavailable(reason, message, details = {}) {
  return {
    preferred: null,
    alternatives: [],
    unavailableReason: reason,
    unavailableMessage: message,
    candidates: [],
    ...details,
  };
}

function filterForSpecificBindHost(candidates, bindHost, port, protocol) {
  const host = normalizeHost(bindHost);
  const bare = host.split("%")[0];
  if (isAllInterfacesHost(host)) return candidates;
  if (net.isIP(bare) !== 4) {
    try {
      return [{
        url: buildPeerUrl({ host, port, protocol }),
        address: host,
        interfaceName: "configured host",
        kind: "configured-host",
        scope: "",
        private: false,
        linkLocal: false,
        global: false,
        appearsWireless: false,
        appearsUsbEthernet: false,
        likelyDirectWired: false,
        hasDefaultRoute: false,
      }];
    } catch {
      return [];
    }
  }
  return candidates.filter((candidate) => candidate.address === bare);
}

export function getPreferredLocalPeerUrls(options = {}) {
  const transport = normalizeTransport(options.transport);
  const port = normalizePort(options.port);
  const bindHost = normalizeHost(options.bindHost || options.host || "0.0.0.0");
  const protocol = String(options.protocol || "http").trim().toLowerCase() === "https" ? "https" : "http";
  const maxUrls = Math.max(1, Math.min(24, Number(options.maxUrls) || DEFAULT_MAX_URLS));

  if (isLoopbackHost(bindHost)) {
    return unavailable(
      "localhost-only",
      "Nodevision is currently listening only on localhost. Start Nodevision on 0.0.0.0 or another reachable interface to allow peer connections.",
      { bindHost, port, transport },
    );
  }

  const inventory = Array.isArray(options.interfaces)
    ? { interfaces: options.interfaces }
    : collectNetworkInterfaceInventory(options);
  const collected = collectCandidates(inventory.interfaces, port, protocol);
  const candidates = dedupeUrls(sortCandidates(filterForSpecificBindHost(collected, bindHost, port, protocol), transport));
  if (!candidates.length) {
    return unavailable(
      "no-usable-interface",
      "No active non-loopback IPv4 interface was detected for peer connections.",
      { bindHost, port, transport },
    );
  }

  const visible = candidates.slice(0, maxUrls);
  return {
    preferred: visible[0]?.url || null,
    alternatives: visible.slice(1).map((candidate) => candidate.url),
    unavailableReason: null,
    unavailableMessage: "",
    bindHost,
    port,
    transport,
    candidates: visible,
    omittedCount: Math.max(0, candidates.length - visible.length),
  };
}
