// Nodevision/ApplicationSystem/PreviewRuntime/previewRuntimeServer.js
// CommonJS entrypoint for the Preview Runtime (packaged builds may load this via `require()`).
//
// The actual implementation lives in `previewRuntimeServer.mjs` (ESM).

(async () => {
  try {
    const mod = await import('./previewRuntimeServer.mjs');
    if (typeof mod?.startPreviewRuntimeServer !== 'function') {
      throw new Error('startPreviewRuntimeServer export not found');
    }
    await mod.startPreviewRuntimeServer();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[PreviewRuntime] failed to start:', err);
    process.exitCode = 1;
  }
})();

