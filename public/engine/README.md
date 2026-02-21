# Nodevision MetaWorld Engine Modules

This directory provides a minimal, extensible runtime for declarative MetaWorld prims.

## Security model

- Prims are validated before use.
- Only known prim types are accepted.
- Function values and forbidden script-like keys are rejected.
- Behavior trees are interpreted from JSON; no `eval` and no code execution from world files.
- Audio URLs are validated and restricted to approved local prefixes/extensions.

## Modules

- `entities/`: `NvEntity`, `NvPlayer`, `NvNPC`, `NvMob`, prim schema and factory.
- `ai/`: deterministic behavior tree interpreter + built-in condition/action library.
- `factions/`: hostility matrix and faction registry.
- `spawn/`: templates and deterministic spawners with cooldown/max-count/region-bounds.
- `audio/`: WebAudio spatial sound sources and event emitters.
- `WorldSimulation.mjs`: composition root for server-authoritative update loops.

## Update ownership

- Server simulation: entities (AI), spawners, factions.
- Client rendering: visuals and optional WebAudio playback.

## Example assets

- World JSON: `/engine/examples/nodevision-metaworld-example.json`
- Loop sample: `/engine/examples/minimalUpdateLoop.mjs`
