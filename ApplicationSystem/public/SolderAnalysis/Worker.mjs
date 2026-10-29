// Pixel buffers and measurement caches live off the editor thread.
import { createMeasurementEngine } from './Measurement.mjs';
let engine;
self.onmessage = async ({ data: message }) => {
  try {
    if (message.image) {
      const bitmap = await createImageBitmap(message.image, { imageOrientation: 'from-image' });
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height), context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(bitmap, 0, 0); bitmap.close();
      engine = createMeasurementEngine(context.getImageData(0, 0, canvas.width, canvas.height));
      self.postMessage({ id: message.id, width: canvas.width, height: canvas.height });
    } else self.postMessage({ id: message.id, result: engine.analyze(message.regions) });
  } catch (error) { self.postMessage({ id: message.id, error: error.message }); }
};
