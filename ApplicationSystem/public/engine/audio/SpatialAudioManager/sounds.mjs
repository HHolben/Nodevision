// Nodevision/ApplicationSystem/public/engine/audio/SpatialAudioManager/sounds.mjs
// This file defines spatial sound primitives used by the Nodevision SpatialAudioManager. It loads audio buffers, builds WebAudio graphs, and maps prim definitions into sound objects.

import { validateSoundUrl } from "../audioSecurity.mjs";
import { computeInverseSquareGain, distance, vec3 } from "./math.mjs";

class SpatialSoundBase {
  constructor({
    id,
    url,
    maxDistance = 30,
    loop = false,
    volume = 1,
    parentEntityId = null,
    localOffset = [0, 0, 0],
  } = {}) {
    validateSoundUrl(url);

    this.id = String(id || "");
    this.url = url;
    this.loop = Boolean(loop);
    this.volume = Math.max(0, Math.min(1, Number(volume) || 1));
    this.maxDistance = Math.max(0.1, Number(maxDistance) || 30);
    this.parentEntityId = parentEntityId ? String(parentEntityId) : null;
    this.localOffset = vec3(localOffset);

    this.worldPosition = [0, 0, 0];
    this.loaded = false;
    this.playing = false;

    this._decodedBuffer = null;
    this._sourceNode = null;
    this._gainNode = null;
    this._pannerNode = null;
  }

  async ensureLoaded(audioContext) {
    if (this.loaded) return;

    const res = await fetch(this.url, { cache: "force-cache" });
    if (!res.ok) {
      throw new Error(`Failed to load sound ${this.url}: ${res.status}`);
    }

    const bytes = await res.arrayBuffer();
    this._decodedBuffer = await audioContext.decodeAudioData(bytes);
    this.loaded = true;
  }

  #buildAudioGraph(audioContext, destination) {
    const source = audioContext.createBufferSource();
    source.loop = this.loop;
    source.buffer = this._decodedBuffer;

    const gain = audioContext.createGain();
    const panner = audioContext.createPanner();
    panner.distanceModel = "inverse";
    panner.refDistance = 1;
    panner.maxDistance = this.maxDistance;
    panner.rolloffFactor = 1;

    source.connect(gain);
    gain.connect(panner);
    panner.connect(destination);

    this._sourceNode = source;
    this._gainNode = gain;
    this._pannerNode = panner;
  }

  play(audioContext, destination) {
    if (!this.loaded || this.playing) return;
    this.#buildAudioGraph(audioContext, destination);
    this._sourceNode.start();
    this.playing = true;
    this._sourceNode.onended = () => {
      this.playing = false;
      this._sourceNode = null;
    };
  }

  stop() {
    if (!this.playing || !this._sourceNode) return;
    this._sourceNode.stop();
    this.playing = false;
  }

  updateNodes(listenerPosition) {
    if (!this._gainNode || !this._pannerNode) return;
    const d = distance(this.worldPosition, listenerPosition);
    const computed = computeInverseSquareGain(d, this.maxDistance) * this.volume;
    this._gainNode.gain.value = computed;
    this._pannerNode.positionX.value = this.worldPosition[0];
    this._pannerNode.positionY.value = this.worldPosition[1];
    this._pannerNode.positionZ.value = this.worldPosition[2];
  }
}

export class NvSoundSource extends SpatialSoundBase {
  constructor(config = {}) {
    super({ ...config, loop: config.loop !== false });
    this.autoPlayRange = Math.max(0.1, Number(config.autoPlayRange || this.maxDistance));
  }

  shouldAutoPlay(listenerPosition) {
    return distance(this.worldPosition, listenerPosition) <= this.autoPlayRange;
  }
}

export class NvSoundEmitter extends SpatialSoundBase {
  constructor(config = {}) {
    super({ ...config, loop: false });
    this.eventTypes = Array.isArray(config.eventTypes) ? [...config.eventTypes] : [];
  }

  canEmitFor(eventType) {
    return this.eventTypes.includes(eventType);
  }
}

export function soundFromPrim(prim) {
  const a = prim.attributes || {};
  const rel = prim.relationships || {};

  const baseConfig = {
    id: prim.id,
    url: a.url,
    maxDistance: a.maxDistance,
    volume: a.volume,
    parentEntityId: rel.parentEntity || null,
    localOffset: a.localOffset || [0, 0, 0],
  };

  if (prim.type === "NvSoundSource") {
    return new NvSoundSource({
      ...baseConfig,
      loop: a.loop,
      autoPlayRange: a.autoPlayRange,
    });
  }

  if (prim.type === "NvSoundEmitter") {
    return new NvSoundEmitter({
      ...baseConfig,
      eventTypes: a.eventTypes || [],
    });
  }

  return null;
}

