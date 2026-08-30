// Nodevision/ApplicationSystem/public/Speech/BrowserMicrophoneWavCapture.mjs
// This module captures user-initiated microphone audio in the browser and encodes it as mono 16-bit PCM WAV.

function audioContextCtor(target = globalThis.window || globalThis) {
  return target.AudioContext || target.webkitAudioContext || null;
}

function flattenChunks(chunks) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const samples = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    samples.set(chunk, offset);
    offset += chunk.length;
  }
  return samples;
}

function writeAscii(view, offset, text) {
  for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
}

export function encodePcm16Wav(samples, sampleRate) {
  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataBytes, true);
  let offset = 44;
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export class BrowserMicrophoneWavCapture {
  constructor(target = globalThis.window || globalThis) {
    this.target = target;
    this.stream = null;
    this.context = null;
    this.source = null;
    this.processor = null;
    this.chunks = [];
    this.startedAt = 0;
    this.snapshotStartedAt = 0;
  }

  async start() {
    const AudioContextCtor = audioContextCtor(this.target);
    const mediaDevices = this.target.navigator?.mediaDevices;
    if (!AudioContextCtor || !mediaDevices?.getUserMedia) throw new Error("Microphone capture is not available in this browser.");
    this.stopTracks();
    this.chunks = [];
    this.stream = await mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
    this.context = new AudioContextCtor();
    await this.context.resume?.();
    this.source = this.context.createMediaStreamSource(this.stream);
    this.processor = this.context.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      this.chunks.push(new Float32Array(input));
    };
    this.source.connect(this.processor);
    this.processor.connect(this.context.destination);
    this.startedAt = Date.now();
    this.snapshotStartedAt = this.startedAt;
    return { ok: true, sampleRate: this.context.sampleRate };
  }

  snapshot({ clear = false } = {}) {
    const chunks = this.chunks.slice();
    const sampleRate = this.context?.sampleRate || 16000;
    const durationMs = this.snapshotStartedAt ? Date.now() - this.snapshotStartedAt : 0;
    if (clear) {
      this.chunks = [];
      this.snapshotStartedAt = Date.now();
    }
    return { blob: encodePcm16Wav(flattenChunks(chunks), sampleRate), durationMs, sampleRate };
  }

  async stop() {
    const result = this.snapshot();
    this.disconnect();
    const closePromise = this.context?.close?.();
    if (closePromise?.catch) await closePromise.catch(() => {});
    this.stopTracks();
    this.context = null;
    this.stream = null;
    this.chunks = [];
    this.startedAt = 0;
    this.snapshotStartedAt = 0;
    return result;
  }

  disconnect() {
    this.processor?.disconnect?.();
    this.source?.disconnect?.();
    if (this.processor) this.processor.onaudioprocess = null;
    this.processor = null;
    this.source = null;
  }

  stopTracks() {
    this.stream?.getTracks?.().forEach((track) => track.stop?.());
  }
}
