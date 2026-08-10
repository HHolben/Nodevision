// Nodevision/ApplicationSystem/public/HandwritingRecognition/HandwritingRecognizer.mjs
// This module defines a minimal browser-side recognizer interface so experimental handwriting providers can share availability and recognition semantics without replacing existing recognizers.

export class HandwritingRecognizer {
  get id() {
    throw new Error("Not implemented");
  }

  async isAvailable() {
    return false;
  }

  async recognize() {
    throw new Error("Not implemented");
  }
}

export function makeUnavailableRecognitionResult(engineId, code = "NATIVE_UNAVAILABLE", message = "Recognizer unavailable.") {
  return {
    ok: false,
    engineId,
    text: "",
    confidence: 0,
    candidates: [],
    warnings: [],
    error: { code, message },
    fallbackAllowed: true,
  };
}
