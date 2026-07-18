// Nodevision/ApplicationSystem/public/SyncTransportSettings.mjs
// Helpers for Sync Panel transport selection and backward-compatible peer URL resolution.

export function normalizeSyncTransport(value) {
  const text = String(value || "wireless").trim().toLowerCase();
  if (text === "usb" || text === "usb-cable" || text === "usb cable" || text === "usb-network" || text === "usb network" || text === "usb-ethernet" || text === "usb ethernet" || text === "direct" || text === "direct-network" || text === "direct network" || text === "direct / usb ethernet") return "usb";
  if (text === "offline" || text === "offline-package" || text === "offline package" || text === "package") return "offline-package";
  return "wireless";
}

export function getActivePeerUrl(settings = {}) {
  const transport = normalizeSyncTransport(settings.syncTransport);
  if (transport === "offline-package") return "";
  if (transport === "usb") {
    return String(settings.usbPeerUrl || "").trim();
  }
  return String(settings.wirelessPeerUrl || settings.peerUrl || "").trim();
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
  else updated.wirelessPeerUrl = peerUrl;
  return { settings: updated, peerUrl };
}
