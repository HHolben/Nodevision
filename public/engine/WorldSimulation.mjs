import { AiRuntime, BehaviorTreeInterpreter, DeterministicRng, createBuiltinBehaviorLibrary } from "./ai/BehaviorTree.mjs";
import { soundFromPrim, SpatialAudioManager } from "./audio/SpatialAudioManager.mjs";
import { FactionRegistry, factionFromPrim } from "./factions/NvFaction.mjs";
import { buildPrimIndex, entityFromPrim } from "./entities/entityFactory.mjs";
import { NV_PRIM_TYPES, assertUniquePrimIds, normalizePrim, validatePrim, validateWorldPrims } from "./entities/primSchema.mjs";
import { NvSpawner, spawnerFromPrim } from "./spawn/NvSpawner.mjs";
import { NvTemplate, TemplateRegistry } from "./spawn/NvTemplate.mjs";

function flattenPrims(prims, out = [], parentId = null) {
  for (const prim of prims) {
    validatePrim(prim);
    const normalized = normalizePrim(prim);

    if (parentId && !normalized.relationships.parentEntity) {
      normalized.relationships.parentEntity = parentId;
    }

    out.push(normalized);

    const childPrims = (normalized.children || []).filter((child) => child && typeof child === "object");
    if (childPrims.length > 0) {
      flattenPrims(childPrims, out, normalized.id);
    }
  }
  return out;
}

export class WorldSimulation {
  constructor({ worldJson, enableAudio = false, listenerPositionProvider = null, seed = 1234 } = {}) {
    this.worldJson = worldJson || { prims: [] };
    const topPrims = Array.isArray(this.worldJson.prims) ? this.worldJson.prims : [];

    validateWorldPrims(topPrims);
    this.prims = flattenPrims(topPrims);
    assertUniquePrimIds(this.prims);
    this.primIndex = buildPrimIndex(this.prims);

    this.entities = new Map();
    this.spawners = new Map();
    this.factions = new FactionRegistry();
    this.templates = new TemplateRegistry();
    this.behaviorTrees = new Map();

    this.rng = new DeterministicRng(seed);
    const builtins = createBuiltinBehaviorLibrary();
    this.aiRuntime = new AiRuntime({
      behaviorTrees: this.behaviorTrees,
      interpreter: new BehaviorTreeInterpreter(builtins),
      rng: this.rng
    });

    this.pendingEvents = [];

    this.audioManager = enableAudio
      ? new SpatialAudioManager({ listenerPositionProvider })
      : null;

    this.#buildFromPrims();
  }

  #buildFromPrims() {
    // 1) Factions/templates/AI trees first.
    for (const prim of this.prims) {
      if (prim.type === NV_PRIM_TYPES.NvFaction) {
        this.factions.addFaction(factionFromPrim(prim));
      }

      if (prim.type === NV_PRIM_TYPES.NvTemplate) {
        this.templates.addTemplate(new NvTemplate(prim));
      }

      if (prim.type === NV_PRIM_TYPES.NvAIController) {
        const tree = prim.attributes?.tree;
        if (tree && typeof tree === "object") {
          this.behaviorTrees.set(prim.id, tree);
        }
      }
    }

    // 2) Entities and spawners.
    for (const prim of this.prims) {
      const entity = entityFromPrim(prim);
      if (entity) {
        this.entities.set(entity.id, entity);
        continue;
      }

      if (prim.type === NV_PRIM_TYPES.NvSpawner) {
        const spawner = spawnerFromPrim(prim);
        this.spawners.set(spawner.id, spawner);
      }
    }

    // 3) Audio nodes.
    if (this.audioManager) {
      this.audioManager.setEntityMap(this.entities);

      for (const prim of this.prims) {
        const sound = soundFromPrim(prim);
        if (!sound) continue;

        if (!sound.parentEntityId && prim.relationships.parentEntity) {
          sound.parentEntityId = String(prim.relationships.parentEntity);
        }

        if (prim.type === NV_PRIM_TYPES.NvSoundSource) {
          this.audioManager.addSoundSource(sound);
        } else {
          this.audioManager.addSoundEmitter(sound);
        }
      }
    }
  }

  emitEvent(event) {
    this.pendingEvents.push(event);
  }

  async preloadAudio() {
    if (!this.audioManager) return;
    await this.audioManager.preloadAll();
  }

  async update(deltaTime) {
    // Server-side deterministic simulation path.
    const context = {
      entities: this.entities,
      factions: this.factions,
      aiRuntime: this.aiRuntime,
      deltaTime,
      rng: this.rng,
      emitEvent: (event) => this.emitEvent(event)
    };

    for (const entity of this.entities.values()) {
      entity.update(deltaTime, context);
    }

    // Spawner update can create new entities from templates.
    for (const spawner of this.spawners.values()) {
      const spawnedPrims = spawner.update(deltaTime, {
        entities: this.entities,
        templates: this.templates,
        rng: this.rng
      });

      for (const prim of spawnedPrims) {
        const spawnedEntity = entityFromPrim(prim);
        if (!spawnedEntity) continue;
        this.entities.set(spawnedEntity.id, spawnedEntity);
        if (spawner instanceof NvSpawner) {
          spawner.trackExisting(spawnedEntity.id);
        }
      }
    }

    if (this.audioManager) {
      for (const event of this.pendingEvents) {
        await this.audioManager.trigger(event);
      }
      this.pendingEvents.length = 0;
      await this.audioManager.update();
    }
  }
}
