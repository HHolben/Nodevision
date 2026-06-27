// Nodevision/ApplicationSystem/Sync/SyncTransport.mjs
// This module defines the sync transport interface and the HTTP adapter used by the existing trusted peer sync routes.

import { Buffer } from "node:buffer";
import { normalizePeerUrl } from "./sync-sync-test-two-way.mjs";
import { createSignedScopeFilePush, createSignedScopeFileRequest, createSignedScopeManifestRequest } from "./ScopePeerSync.mjs";

export class SyncTransport {
  constructor(options = {}) {
    this.kind = String(options.kind || "unknown");
  }

  async status() {
    throw new Error("status() is not implemented for this sync transport");
  }

  async listFiles(_scope) {
    throw new Error("listFiles(scope) is not implemented for this sync transport");
  }

  async getFile(_scope, _relativePath) {
    throw new Error("getFile(scope, relativePath) is not implemented for this sync transport");
  }

  async putFile(_scope, _relativePath, _data, _metadata = {}) {
    throw new Error("putFile(scope, relativePath, data, metadata) is not implemented for this sync transport");
  }

  async deleteFile(_scope, _relativePath) {
    throw new Error("deleteFile(scope, relativePath) is not implemented for this sync transport");
  }

  async sendControlMessage(_message) {
    throw new Error("sendControlMessage(message) is not implemented for this sync transport");
  }
}

export function createPeerNetworkError({ peerUrl, endpointPath, cause }) {
  const err = new Error(`Unable to reach peer at ${peerUrl}: ${cause?.message || "network request failed"}`);
  err.name = "PeerSyncNetworkError";
  err.peerUrl = peerUrl;
  err.endpointPath = endpointPath;
  err.cause = cause;
  return err;
}

export function createPeerHttpError({ peerUrl, endpointPath, status, payload }) {
  const err = new Error(`${endpointPath} failed (${status}): ${payload?.error || "request failed"}`);
  err.name = "PeerSyncHttpError";
  err.status = status;
  err.peerUrl = peerUrl;
  err.endpointPath = endpointPath;
  err.responsePayload = payload;
  return err;
}

export class HttpSyncTransport extends SyncTransport {
  constructor({ peerUrl, runtimeRoot } = {}) {
    super({ kind: "http" });
    this.peerUrl = normalizePeerUrl(peerUrl);
    this.runtimeRoot = runtimeRoot;
  }

  async fetchJson(endpointPath, init = {}) {
    let response;
    try {
      response = await fetch(new URL(endpointPath, `${this.peerUrl}/`).toString(), init);
    } catch (cause) {
      throw createPeerNetworkError({ peerUrl: this.peerUrl, endpointPath, cause });
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw createPeerHttpError({
        peerUrl: this.peerUrl,
        endpointPath,
        status: response.status,
        payload,
      });
    }
    return payload;
  }

  async postJson(endpointPath, body) {
    return this.fetchJson(endpointPath, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async status() {
    return this.fetchJson("/api/peer/status", { method: "GET" });
  }

  async listFiles(scope) {
    const signed = await createSignedScopeManifestRequest({ scope }, { runtimeRoot: this.runtimeRoot });
    const body = await this.postJson("/api/peer/scope/manifest", signed);
    if (!body?.ok || !body?.manifest) throw new Error("missing manifest");
    return body.manifest;
  }

  async getFile(scope, relativePath) {
    const signed = await createSignedScopeFileRequest({ scope, relativePath }, { runtimeRoot: this.runtimeRoot });
    const body = await this.postJson("/api/peer/scope/file-get", signed);
    if (!body?.ok || !body?.file) throw new Error("missing file payload");
    return body.file;
  }

  async putFile(scope, relativePath, data, metadata = {}) {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data ?? "");
    const signed = await createSignedScopeFilePush({
      scope,
      relativePath,
      contentBase64: buffer.toString("base64"),
      contentType: String(metadata.contentType || "application/octet-stream"),
      mtimeMs: Number.isFinite(Number(metadata.mtimeMs)) ? Math.trunc(Number(metadata.mtimeMs)) : undefined,
    }, { runtimeRoot: this.runtimeRoot });
    const body = await this.postJson("/api/peer/scope/file-push", {
      ...signed,
      saveMode: metadata.saveMode || "auto",
      recoveryJobId: metadata.recoveryJobId || null,
    });
    return body;
  }

  async sendControlMessage(message = {}) {
    const endpointPath = String(message.endpointPath || "").trim();
    if (!endpointPath) throw new Error("HTTP sync control message requires endpointPath");
    const body = message.body && typeof message.body === "object" ? message.body : {};
    return this.postJson(endpointPath, body);
  }
}

export function createHttpSyncTransport(options = {}) {
  return new HttpSyncTransport(options);
}
