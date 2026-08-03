// Nodevision/ApplicationSystem/public/SyncTransportSettings.mjs
// This module provides Sync Panel transport selection helpers and backward-compatible peer URL resolution for combined Wi-Fi and Ethernet sync behavior.

export function normalizeSyncTransport(value) {
  const text = String(value || "wireless").trim().toLowerCase();
  if (text === "usb" || text === "usb-cable" || text === "usb cable" || text === "usb-network" || text === "usb network" || text === "usb-ethernet" || text === "usb ethernet" || text === "direct" || text === "direct-network" || text === "direct network" || text === "direct / usb ethernet") return "usb";
  if (text === "combined" || text === "hybrid" || text === "wifi+ethernet" || text === "wifi + ethernet" || text === "wireless+direct" || text === "wireless + direct" || text === "wireless + usb" || text === "wireless+usb" || text === "lan+usb" || text === "lan + usb") return "combined";
  if (text === "offline" || text === "offline-package" || text === "offline package" || text === "package") return "offline-package";
  return "wireless";
}

function addPeerUrl(urls, value) {
  const text = String(value || "").trim();
  if (text && !urls.includes(text)) urls.push(text);
}

export function getActivePeerUrls(settings = {}) {
  const transport = normalizeSyncTransport(settings.syncTransport);
  const urls = [];
  if (transport === "offline-package") return urls;
  if (transport === "combined") {
    addPeerUrl(urls, settings.wirelessPeerUrl || settings.peerUrl);
    addPeerUrl(urls, settings.usbPeerUrl);
    return urls;
  }
  if (transport === "usb") {
    addPeerUrl(urls, settings.usbPeerUrl);
    return urls;
  }
  addPeerUrl(urls, settings.wirelessPeerUrl || settings.peerUrl);
  return urls;
}

export function getActivePeerUrl(settings = {}) {
  return getActivePeerUrls(settings)[0] || "";
}

export function getPeerUrlFromDiscoveredPeer(peer) {
  const address = String(peer?.address || "").trim();
  const port = Number(peer?.port);
  if (!address || !Number.isInteger(port) || port < 1 || port > 65535) return "";
  try {
    const host = address.includes(":") && !address.startsWith("[") ? "[" + address + "]" : address;
    const parsed = new URL("http://" + host + ":" + port);
    return parsed.protocol + "//" + parsed.host;
  } catch {
    return "";
  }
}

export function withActivePeerUrlFromDiscoveredPeer(settings = {}, peer = null) {
  const syncTransport = normalizeSyncTransport(settings.syncTransport);
  const updated = { ...settings, syncTransport };
  if (syncTransport === "offline-package") return { settings: updated, peerUrl: "" };
  const peerUrl = getPeerUrlFromDiscoveredPeer(peer);
  if (!peerUrl) return { settings: updated, peerUrl: "" };
  if (syncTransport === "usb") updated.usbPeerUrl = peerUrl;
  else if (syncTransport === "combined") {
    const currentWireless = String(updated.wirelessPeerUrl || updated.peerUrl || "").trim();
    if (!currentWireless) updated.wirelessPeerUrl = peerUrl;
    else if (!String(updated.usbPeerUrl || "").trim() && currentWireless !== peerUrl) updated.usbPeerUrl = peerUrl;
  } else updated.wirelessPeerUrl = peerUrl;
  return { settings: updated, peerUrl };
}
