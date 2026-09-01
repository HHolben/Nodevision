// Nodevision/ApplicationSystem/public/Listen/RenderedPageReader.mjs
// This module coordinates Nodevision speech playback for rendered HTML and PDF panels while preserving local-first provider selection and reader state.

import { setStatus } from "/StatusBar.mjs";
import { getSpeechService } from "/Speech/SpeechService.mjs";
import { boundaryRangeForText, collectActiveRenderedTextSource } from "./ListenTextSources.mjs";
import { nextListenSpeechChunk } from "./ListenTextChunks.mjs";
import { clearHighlightRecord, clearRenderedPageListenHighlights, ensureListenStyles, highlightRenderedRange } from "./ListenHighlights.mjs";

function speechCapabilityError(err) {
  return String(err?.message || "Speech unavailable");
}

class RenderedPageReader {
  constructor() {
    this.service = null;
    this.active = null;
    this.highlight = null;
    this.bound = false;
    this.onStarted = (event) => this.handleSpeechEvent("started", event);
    this.onBoundary = (event) => this.handleSpeechEvent("boundary", event);
    this.onFinished = (event) => this.handleSpeechEvent("finished", event);
    this.onCancelled = (event) => this.handleSpeechEvent("cancelled", event);
    this.onError = (event) => this.handleSpeechEvent("error", event);
  }

  // Speech service and state events.
  speechService() {
    if (!this.service) this.service = getSpeechService();
    return this.service;
  }

  bindSpeechEvents() {
    if (this.bound) return;
    window.addEventListener("speech.started", this.onStarted);
    window.addEventListener("speech.boundary", this.onBoundary);
    window.addEventListener("speech.finished", this.onFinished);
    window.addEventListener("speech.cancelled", this.onCancelled);
    window.addEventListener("speech.error", this.onError);
    this.bound = true;
  }

  emitState(statePatch = {}) {
    const detail = { ...this.getState(), ...statePatch };
    window.dispatchEvent(new CustomEvent("nv-rendered-page-reader-state", { detail }));
    return detail;
  }

  getState() {
    return {
      active: Boolean(this.active),
      paused: Boolean(this.active?.paused),
      provider: this.active?.provider || "",
      sourceKind: this.active?.source?.kind || "",
      label: this.active?.source?.label || "",
      utteranceId: this.active?.utteranceId || "",
      pauseAvailable: Boolean(this.active?.capabilities?.pause || this.active?.paused),
    };
  }

  // Highlight lifecycle.
  refreshSourceAfterFallbackWrap() {
    if (this.active?.source?.refresh) this.active.source = this.active.source.refresh();
  }

  clearCurrentHighlight() {
    const result = clearHighlightRecord(this.highlight);
    this.highlight = null;
    if (result.hadWrappers) this.refreshSourceAfterFallbackWrap();
  }

  clearAllHighlights() {
    this.clearCurrentHighlight();
    clearRenderedPageListenHighlights(document);
  }

  highlightAbsoluteRange(range) {
    if (!range || !this.active?.source) return false;
    this.active.resumeCharIndex = range.start;
    this.highlight = highlightRenderedRange(this.active.source, range.start, range.end, this.highlight);
    return Boolean(this.highlight);
  }

  // Speech event mapping.
  handleSpeechEvent(kind, event) {
    const detail = event?.detail || {};
    if (!this.active) return;
    if (this.active.utteranceId && detail.utteranceId && this.active.utteranceId !== detail.utteranceId) return;

    if (kind === "cancelled" && detail.reason === "listen-paused") {
      this.active.paused = true;
      this.active.pauseMode = "restart";
      this.emitState({ active: true, paused: true });
      setStatus("Listen", "Reading paused");
      return;
    }

    if (kind === "boundary") {
      const relativeIndex = Number(detail.charIndex);
      if (!Number.isFinite(relativeIndex)) return;
      const absoluteIndex = (this.active.baseOffset || 0) + relativeIndex;
      const range = boundaryRangeForText(this.active.source?.text || "", absoluteIndex, detail.charLength);
      this.highlightAbsoluteRange(range);
      return;
    }

    if (kind === "started") {
      this.emitState({ active: true, paused: false });
      this.highlightAbsoluteRange(boundaryRangeForText(this.active.source?.text || "", this.active.baseOffset || 0, 0));
      return;
    }

    if (kind === "finished" && this.active.chunkEndOffset < (this.active.source?.text?.length || 0)) {
      const source = this.active.source;
      const nextOffset = this.active.chunkEndOffset;
      const utteranceId = this.active.utteranceId;
      this.clearCurrentHighlight();
      queueMicrotask(() => {
        if (this.active?.utteranceId !== utteranceId) return;
        this.startSource(source, nextOffset).catch((err) => { console.warn("Unable to continue rendered page reading:", err); this.stop("listen-continuation-error"); });
      });
      return;
    }

    if (kind === "finished" || kind === "cancelled" || kind === "error") {
      this.clearCurrentHighlight();
      this.active = null;
      this.emitState({ active: false, paused: false, error: kind === "error" ? detail.error || "Speech error" : "" });
      setStatus("Listen", kind === "finished" ? "Finished" : kind === "cancelled" ? "Stopped" : "Error");
    }
  }

  // Playback controls.
  async startSource(source, offset = 0) {
    const chunk = nextListenSpeechChunk(source.text, offset);
    const text = chunk.text;
    if (!text.trim()) throw new Error("No remaining readable text is available on this page.");
    ensureListenStyles(source.doc);
    this.bindSpeechEvents();
    this.active = { source, baseOffset: chunk.start, chunkEndOffset: chunk.end, resumeCharIndex: chunk.start, utteranceId: "", paused: false, pauseMode: "", provider: "", capabilities: {} };

    try {
      const result = await this.speechService().speak(text, { speechRequirements: { charIndex: true } });
      this.active.utteranceId = result.utteranceId || "";
      this.active.provider = result.provider || "";
      this.active.capabilities = result.capabilities || {};
      this.emitState({ active: true, paused: false, provider: this.active.provider });
      setStatus("Listen", "Reading " + source.label);
      return result;
    } catch (err) {
      this.clearCurrentHighlight();
      this.active = null;
      this.emitState({ active: false, paused: false, error: speechCapabilityError(err) });
      throw err;
    }
  }

  async play() {
    if (this.active?.paused) {
      if (this.active.pauseMode === "provider") {
        await this.speechService().resume();
        this.active.paused = false;
        this.emitState({ paused: false });
        setStatus("Listen", "Reading resumed");
        return { ok: true, resumed: true };
      }
      const source = this.active.source;
      const offset = this.active.resumeCharIndex || this.active.baseOffset || 0;
      return this.startSource(source, offset);
    }

    if (this.active) await this.speechService().cancelActive("listen-restart");
    this.clearAllHighlights();
    const source = collectActiveRenderedTextSource();
    if (!source || !String(source.text || "").trim()) {
      throw new Error("Open an HTML or PDF page with readable rendered text first.");
    }
    return this.startSource(source, 0);
  }

  async pause() {
    if (!this.active) return { ok: true, active: false };
    if (this.active.capabilities?.pause) {
      await this.speechService().pause();
      this.active.paused = true;
      this.active.pauseMode = "provider";
      this.emitState({ paused: true });
      setStatus("Listen", "Reading paused");
      return { ok: true, paused: true };
    }
    this.active.paused = true;
    this.active.pauseMode = "restart";
    await this.speechService().cancelActive("listen-paused");
    this.emitState({ active: true, paused: true });
    return { ok: true, paused: true, restartFromOffset: this.active.resumeCharIndex || 0 };
  }

  async stop(reason = "command") {
    if (!this.active) {
      this.clearAllHighlights();
      return { ok: true, active: false };
    }
    const result = await this.speechService().cancelActive(reason);
    this.clearAllHighlights();
    this.active = null;
    this.emitState({ active: false, paused: false });
    return result;
  }
}

let sharedReader = null;

export function getRenderedPageReader() {
  if (!sharedReader) sharedReader = new RenderedPageReader();
  window.NodevisionRenderedPageReader = sharedReader;
  return sharedReader;
}

export function resetRenderedPageReaderForTests(reader = null) {
  sharedReader = reader;
}

if (typeof window !== "undefined") {
  window.NodevisionRenderedPageReader = getRenderedPageReader();
  if (!window.__nvRenderedPageReaderCleanupBound) {
    window.addEventListener("activePanelChanged", () => {
      if (!window.NodevisionRenderedPageReader?.getState?.().active) window.NodevisionRenderedPageReader?.clearAllHighlights?.();
    });
    window.__nvRenderedPageReaderCleanupBound = true;
  }
}
