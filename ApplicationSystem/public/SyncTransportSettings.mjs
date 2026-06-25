// Nodevision/ApplicationSystem/public/SyncTransportSettings.mjs
// Helpers for Sync Panel transport selection and backward-compatible peer URL resolution.

export function normalizeSyncTransport(value) {
  return String(value || "wireless").trim().toLowerCase() === "usb" ? "usb" : "wireless";
}

export function getActivePeerUrl(settings = {}) {
  if (normalizeSyncTransport(settings.syncTransport) === "usb") {
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
  const peerUrl = getPeerUrlFromDiscoveredPeer(peer);
  if (!peerUrl) return { settings: { ...settings }, peerUrl: "" };
  const syncTransport = normalizeSyncTransport(settings.syncTransport);
  const updated = { ...settings, syncTransport };
  if (syncTransport === "usb") updated.usbPeerUrl = peerUrl;
  else updated.wirelessPeerUrl = peerUrl;
  return { settings: updated, peerUrl };
}
