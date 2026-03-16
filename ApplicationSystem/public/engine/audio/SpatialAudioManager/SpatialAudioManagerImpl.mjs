// Nodevision/ApplicationSystem/public/engine/audio/SpatialAudioManager/SpatialAudioManagerImpl.mjs
// This file defines the SpatialAudioManager implementation used by Nodevision. It manages sound sources and emitters and updates WebAudio nodes based on listener position.

import { vec3 } from "./math.mjs";

export class SpatialAudioManager {
  constructor({ audioContext = null, listenerPositionProvider = null } = {}) {
    this.audioContext =
      audioContext ||
      (typeof window !== "undefined"
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

