export { WorldSimulation } from "./WorldSimulation.mjs";

export {
  NvEntity,
  NvPlayer,
  NvNPC,
  NvMob
} from "./entities/NvEntity.mjs";

export {
  NV_PRIM_TYPES,
  validatePrim,
  validateWorldPrims,
  assertUniquePrimIds,
  normalizePrim
} from "./entities/primSchema.mjs";

export {
  BTStatus,
  DeterministicRng,
  BehaviorTreeInterpreter,
  createBuiltinBehaviorLibrary,
  AiRuntime
} from "./ai/BehaviorTree.mjs";

export { NvFaction, FactionRegistry, factionFromPrim } from "./factions/NvFaction.mjs";
export { NvTemplate, TemplateRegistry } from "./spawn/NvTemplate.mjs";
export { NvSpawner, spawnerFromPrim } from "./spawn/NvSpawner.mjs";
export { validateSoundUrl } from "./audio/audioSecurity.mjs";
export {
  NvSoundSource,
  NvSoundEmitter,
  SpatialAudioManager,
  soundFromPrim
} from "./audio/SpatialAudioManager.mjs";
