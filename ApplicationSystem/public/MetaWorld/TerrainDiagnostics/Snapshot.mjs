// Nodevision/ApplicationSystem/public/MetaWorld/TerrainDiagnostics/Snapshot.mjs
// This module samples existing terrain managers and renderer counters on demand for the FPS overlay and machine-readable benchmarks. Geometry storage is estimated from typed arrays, while CPU durations and renderer counters remain explicitly distinguished from unavailable GPU timings.
export function terrainDiagnostics(context = globalThis.window?.VRWorldContext) {
  if (!context) return null;
  const renderer = context.renderer || context.panel?._vrRenderer;
  const THREE = context.THREE, camera = context.panel?._vrViewController?.getActiveCamera?.() || context.camera;
  let frustum = null;
  if (THREE && camera) {
    camera.updateMatrixWorld();
    frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  }
  const terrains = (context.objects || []).filter(o => o.userData?.terrainRuntime?.manager).map(root => {
    const r = root.userData.terrainRuntime, m = r.manager;
    let triangles = 0, geometryBytes = 0, occupancyBytes = 0, visibleChunks = 0, drawableChunks = 0, terrainDrawCalls = 0, awaitingFirstRender = 0;
    root.updateMatrixWorld(true);
    for (const entry of m.loaded.values()) {
      occupancyBytes += entry.data?.byteLength || 0;
      const mesh = entry.mesh, g = mesh?.geometry; if (!g) continue;
      drawableChunks++;if(mesh.userData.terrainSubmitted===false)awaitingFirstRender++;
      const visible = root.visible && mesh.visible && (!frustum || frustum.intersectsObject(mesh));
      if (visible) { visibleChunks++; terrainDrawCalls += g.groups.length || 1; }
      triangles += (g.index?.count || g.attributes.position.count) / 3;
      geometryBytes += g.index?.array.byteLength || 0;
      for (const attribute of Object.values(g.attributes)) geometryBytes += attribute.array.byteLength;
    }
    return { id: r.definition.id, source: r.definition.terrainSource || 'procedural', representation: r.representation,
      switch: r.representationProgress, renderDistanceMeters: r.renderDistance, radiusChunks: m.radius, chunkMeters: 8,
      activeChunks: m.loaded.size, drawableChunks, visibleChunks,
      requestedChunks: m.stats.requestedChunks ?? null, queuedChunks: m.queue.filter(c => c[1] !== null).length,
      queuedColumns: m.queue.filter(c => c[1] === null).length, generating: m.pending || r.representationProgress?.pending ? 1 : 0,
      awaitingInstall: 0, awaitingFirstRender, awaitingGpuUpload: null, preparedReplacements: r.representationProgress?.pending ? r.representationProgress.completed : 0,
      evictedChunks: m.stats.evicted ?? null, cancelled: m.stats.cancelled, generatedChunks: m.stats.generated,
      generationCpuMs: m.stats.generationMs, levelQueryCpuMs: m.stats.levelQueryMs ?? null, meshingCpuMs: m.stats.meshingMs,
      installationCpuMs: m.stats.installationMs ?? null, maxUpdateMs: m.stats.maxUpdateMs,
      switchMs: m.stats.switchMs || 0, occupancyReuseHits: m.stats.occupancyReuseHits || 0,
      residentHits: m.stats.residentHits ?? null, residentMisses: m.stats.residentMisses ?? null,
      triangles, estimatedGeometryBytes: geometryBytes, occupancyBytes, estimatedVisibleTerrainDrawCalls: terrainDrawCalls,
      sourceCache: r.generator.cacheStats?.() || {}, workerQueueLatencyMs: null, gpuUploadMs: null };
  });
  return { sampledAt: performance.now(), terrains, frame: context.terrainFrameStats || null,
    renderer: renderer ? { drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures } : null,
    notes: 'CPU timings are cumulative. Queued columns have not yet expanded into chunks. Geometry bytes estimate typed buffers, not driver allocations. First-render counts track CPU submissions, not GPU completion. Upload is deferred to render; GPU time is unavailable. Terrain generation runs on the main thread, without a worker queue.' };
}

// Keep the existing overlay compact; the full snapshot remains available to benchmarks.
export function terrainDiagnosticsText(snapshot) {
  if (!snapshot?.terrains.length) return '';
  return snapshot.terrains.map(t => `\nTerrain ${t.id}: ${t.representation}, ${t.renderDistanceMeters} m\nChunks: ${t.activeChunks} active / ${t.visibleChunks} visible; queue ${t.queuedChunks} + ${t.queuedColumns} columns; working ${t.generating}\nTriangles: ${t.triangles}; buffers ≈ ${(t.estimatedGeometryBytes / 1048576).toFixed(1)} MiB; evicted ${t.evictedChunks}\nCPU totals: generate ${t.generationCpuMs.toFixed(0)} / mesh ${t.meshingCpuMs.toFixed(0)} / install ${t.installationCpuMs?.toFixed(0) ?? 'n/a'} ms`).join('') +
    (snapshot.renderer ? `\nScene draw calls: ${snapshot.renderer.drawCalls}; GPU upload: unmeasured` : '');
}
