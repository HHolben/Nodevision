// Nodevision/ApplicationSystem/public/RasterAnalysis/ImageAnalysisWorkerClient.mjs
// This client reads decoded source pixels once per image revision and coalesces analysis updates behind one worker request. Stale results are suppressed, and caches are released on pixel invalidation or viewer disposal.
export function createImageAnalysisWorkerClient(image, size, receive, fail) {
  let worker = null, frame = 0, busy = false, revision = 0, sent = 0, pending, redraw = false;
  function reset() { revision++; worker?.terminate(); worker = null; busy = false; cancelAnimationFrame(frame); frame = 0; }
  function pump() {
    frame = 0; if (busy || !pending) return;
    try {
      const { width, height } = size(); if (!width || !height) return;
      if (!worker) {
        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
        const context = canvas.getContext('2d', { willReadFrequently: true, colorSpace: 'srgb' }); context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, width, height);
        worker = new Worker(new URL('./PolygonStatisticsWorker.mjs', import.meta.url), { type: 'module' });
        worker.onmessage = ({ data }) => {
          busy = false;
          // A discarded reply may contain the only transferred copy of a changed overlay.
          redraw = data.id !== revision || Boolean(data.error);
          if (data.id === revision) { if (data.error) fail(data.error); else receive(data); }
          if (sent !== revision) pump();
        };
        worker.onerror = () => { reset(); fail('Image analysis failed. Adjust a control to retry.'); };
        worker.postMessage({ pixels }, [pixels.data.buffer]); canvas.width = canvas.height = 0;
      }
      busy = true; sent = revision; worker.postMessage({ ...pending, id: sent, redraw });
    } catch (error) { busy = false; fail(`Cannot read image pixels: ${error.message}`); }
  }
  return {
    request(regions, layers) { pending = { regions, layers }; revision++; if (!frame) frame = requestAnimationFrame(pump); },
    invalidate() { reset(); }, dispose() { reset(); pending = null; }
  };
}
