// Minimal deterministic server-style simulation loop example.
// This file demonstrates loading declarative world JSON and ticking AI/spawners.

import { WorldSimulation } from "../WorldSimulation.mjs";

export async function runMinimalSimulationExample({ tickRate = 20, runForSeconds = 10 } = {}) {
  const worldJson = await fetch("/engine/examples/nodevision-metaworld-example.json").then((r) => r.json());
  const simulation = new WorldSimulation({
    worldJson,
    enableAudio: false,
    seed: 424242
  });

  const dt = 1 / Math.max(1, Number(tickRate) || 20);
  const totalTicks = Math.floor((Number(runForSeconds) || 10) * tickRate);

  for (let i = 0; i < totalTicks; i += 1) {
    await simulation.update(dt);
  }

  return {
    ticks: totalTicks,
    entityCount: simulation.entities.size,
    aliveEntities: [...simulation.entities.values()].filter((e) => e.alive).length
  };
}
