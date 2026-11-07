// Nodevision/ApplicationSystem/public/MetaWorld/TerrainDiagnostics/Frames.mjs
// This module records bounded render-loop frame and CPU samples only when diagnostics are enabled. It exposes aggregate measurements without interpreting submission time as GPU execution time.
export function createTerrainFrameSampler() {
  let last = 0, frames = [], cpu = [], count = 0;
  return (context, timestamp, cpuMs, enabled) => {
    if (!enabled) { if (last || count) { last = 0; frames = []; cpu = []; count = 0; } return; }
    if (last) frames.push(timestamp - last);
    last = timestamp; cpu.push(cpuMs);
    if (frames.length > 180) frames.shift(); if (cpu.length > 180) cpu.shift();
    if (++count % 15 || !context) return;
    const sorted = [...frames].sort((a,b) => a-b), mean = list => list.reduce((a,b) => a+b,0) / (list.length || 1);
    context.terrainFrameStats = { samples: frames.length, averageMs: mean(frames), p95Ms: sorted[Math.floor(sorted.length * .95)] || 0,
      approximateFps: frames.length ? 1000 / mean(frames) : 0, averageCpuMs: mean(cpu) };
  };
}
