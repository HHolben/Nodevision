import { validateSoundUrl } from "./audioSecurity.mjs";

function vec3(value, fallback = [0, 0, 0]) {
  if (!Array.isArray(value) || value.length < 3) return [...fallback];
  return [Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0];
}

function distance(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.hypot(dx, dy, dz);
}

function computeInverseSquareGain(distanceMeters, maxDistance, rolloff = 1) {
  if (distanceMeters >= maxDistance) return 0;
  const d = Math.max(0.001, distanceMeters);
  const gain = 1 / (1 + rolloff * d * d);
  return Math.max(0, Math.min(1, gain));
}

class SpatialSoundBase {
  constructor({ id, url, maxDistance = 30, loop = false, volume = 1, parentEntityId = null, localOffset = [0, 0, 0] } = {}) {
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

export class SpatialAudioManager {
  constructor({ audioContext = null, listenerPositionProvider = null } = {}) {
    this.audioContext = audioContext || (typeof window !== "undefined"
      ? new (window.AudioContext || window.webkitAudioContext)()
      : null);

    this.listenerPositionProvider = listenerPositionProvider || (() => [0, 0, 0]);
    this.destination = this.audioContext ? this.audioContext.destination : null;

    this.soundSources = new Map();
    this.soundEmitters = new Map();
    this.entityMap = new Map();
  }

  setEntityMap(entityMap) {
    this.entityMap = entityMap;
  }

  addSoundSource(soundSource) {
    this.soundSources.set(soundSource.id, soundSource);
  }

  addSoundEmitter(soundEmitter) {
    this.soundEmitters.set(soundEmitter.id, soundEmitter);
  }

  async preloadAll() {
    if (!this.audioContext) return;
    const all = [...this.soundSources.values(), ...this.soundEmitters.values()];
    for (const sound of all) {
      await sound.ensureLoaded(this.audioContext);
    }
  }

  attachSoundPosition(sound) {
    if (!sound.parentEntityId) return;
    const parent = this.entityMap.get(sound.parentEntityId);
    if (!parent) return;

    sound.worldPosition[0] = parent.position[0] + sound.localOffset[0];
    sound.worldPosition[1] = parent.position[1] + sound.localOffset[1];
    sound.worldPosition[2] = parent.position[2] + sound.localOffset[2];
  }

  async trigger(event) {
    if (!this.audioContext || !event?.type) return;

    for (const emitter of this.soundEmitters.values()) {
      this.attachSoundPosition(emitter);
      if (!emitter.canEmitFor(event.type)) continue;
      await emitter.ensureLoaded(this.audioContext);
      emitter.play(this.audioContext, this.destination);
      emitter.updateNodes(this.listenerPositionProvider());
    }
  }

  async update() {
    if (!this.audioContext) return;

    const listenerPosition = vec3(this.listenerPositionProvider());

    for (const source of this.soundSources.values()) {
      this.attachSoundPosition(source);
      if (!source.loaded) {
        await source.ensureLoaded(this.audioContext);
      }

      if (source.shouldAutoPlay(listenerPosition) && !source.playing) {
        source.play(this.audioContext, this.destination);
      }
      if (!source.shouldAutoPlay(listenerPosition) && source.playing) {
        source.stop();
      }

      source.updateNodes(listenerPosition);
    }

    for (const emitter of this.soundEmitters.values()) {
      this.attachSoundPosition(emitter);
      emitter.updateNodes(listenerPosition);
    }
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
    localOffset: a.localOffset || [0, 0, 0]
  };

  if (prim.type === "NvSoundSource") {
    return new NvSoundSource({
      ...baseConfig,
      loop: a.loop,
      autoPlayRange: a.autoPlayRange
    });
  }

  if (prim.type === "NvSoundEmitter") {
    return new NvSoundEmitter({
      ...baseConfig,
      eventTypes: a.eventTypes || []
    });
  }

  return null;
}
