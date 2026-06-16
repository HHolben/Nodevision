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
