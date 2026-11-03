// Nodevision/ApplicationSystem/public/MetaWorld/Geographic/SourceStatus.mjs
// This module checks referenced geographic assets without reimporting or replacing a saved terrain snapshot. Missing files remain visible as recoverable diagnostics while existing worlds retain their authored geometry and cached elevations.

export function geographicSourceStatus(recipe) {
  const controller = new AbortController();
  const state = { message: 'Checking geographic source availability…', dispose: () => controller.abort() };
  const assets = [recipe.elevation?.asset, recipe.landcover?.asset ?? recipe.landcoverSource, recipe.kml].filter(Boolean);
  state.ready = Promise.all(assets.map(async asset => {
    const response = await fetch(asset.path, {
      headers: { Range: 'bytes=0-0' }, credentials: 'same-origin',
      cache: 'no-store', redirect: 'error', signal: controller.signal,
    });
    await response.body?.cancel();
    if (!response.ok) throw Error(`Geographic source unavailable (${response.status}): ${asset.path}`);
  })).then(() => {
    state.message = 'Geographic sources available. Saved crop elevations remain authoritative; use Import / Preview to adopt source changes.';
  }).catch(error => {
    if (!controller.signal.aborted) state.message = `${error.message}. Saved geographic crop remains active. Restore the source file or choose a replacement in Edit Generation Parameters; procedural terrain was not substituted.`;
  });
  return state;
}
