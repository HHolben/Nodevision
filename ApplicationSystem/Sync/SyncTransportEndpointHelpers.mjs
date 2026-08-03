// Nodevision/ApplicationSystem/Sync/SyncTransportEndpointHelpers.mjs
// This module normalizes peer endpoint lists and creates aggregated sync transport errors.

import { normalizePeerUrl } from "./sync-sync-test-two-way.mjs";

export function normalizePeerUrlList(peerUrls) {
  const raw = Array.isArray(peerUrls) ? peerUrls : [peerUrls];
  const urls = [];
  for (const value of raw) {
    try {
      const peerUrl = normalizePeerUrl(value);
      if (peerUrl && !urls.includes(peerUrl)) urls.push(peerUrl);
    } catch {
      // Ignore malformed optional peer URLs.
    }
  }
  return urls;
}

export function createMultiEndpointError({ peerUrls, operation, errors }) {
  const first = Array.isArray(errors) && errors.length ? errors[0] : null;
  const err = new Error(`Unable to complete ${operation} using any configured sync endpoint`);
  err.name = first?.name || "PeerSyncNetworkError";
  err.peerUrls = [...peerUrls];
  err.peerUrl = first?.peerUrl || peerUrls[0] || "";
  err.endpointPath = first?.endpointPath || operation;
  err.errors = Array.isArray(errors) ? errors : [];
  err.cause = first || undefined;
  return err;
}
