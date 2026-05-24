// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/MIDIeditorComponents/MelodyRecorder.mjs
// This file records microphone pitch frames for the MIDI melody sketch feature.

import { detectPitch } from "./PitchDetector.mjs";

export class MelodyRecorder {
  constructor({ onFrame, onStatus } = {}) {
    this.onFrame = onFrame;
    this.onStatus = onStatus;
    this.frames = [];
    this.stream = null;
    this.context = null;
    this.analyser = null;
    this.source = null;
    this.buffer = null;
    this.rafId = null;
    this.startedAt = 0;
  }

  get isRecording() {
    return Boolean(this.rafId);
  }

  async start() {
    if (this.isRecording) return;
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.getUserMedia) {
      throw new Error("Microphone capture is not available in this browser.");
    }

    try {
      this.stream = await mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch (err) {
      throw new Error(err?.name === "NotAllowedError" ? "Microphone permission was denied." : "Microphone access failed.");
    }

    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) throw new Error("Web Audio is not supported in this browser.");
    this.context = new Ctx();
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 2048;
    this.buffer = new Float32Array(this.analyser.fftSize);
    this.source = this.context.createMediaStreamSource(this.stream);
    this.source.connect(this.analyser);
    this.frames = [];
    this.startedAt = performance.now();
    this.onStatus?.("Recording. Hum, sing, or whistle one note at a time.");
    this.tick();
  }

  stop() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.stream?.getTracks?.().forEach((track) => track.stop());
    this.stream = null;
    this.source?.disconnect?.();
    this.analyser?.disconnect?.();
    this.source = null;
    this.analyser = null;
    this.context?.close?.().catch(() => {});
    this.context = null;
    this.onStatus?.("Recording stopped.");
    return this.frames.slice();
  }

  tick() {
    if (!this.analyser || !this.context) return;
    this.analyser.getFloatTimeDomainData(this.buffer);
    const detected = detectPitch(this.buffer, this.context.sampleRate);
    const frame = {
      time: (performance.now() - this.startedAt) / 1000,
      frequency: detected.frequency,
      clarity: detected.clarity,
      rms: detected.rms,
    };
    this.frames.push(frame);
    this.onFrame?.(frame);
    this.rafId = requestAnimationFrame(() => this.tick());
  }
}
