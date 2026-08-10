// Nodevision/ApplicationSystem/public/HandwritingRecognition/NativeCppRecognizer.test.mjs
// This file tests browser-side native C++ handwriting response normalization and safe fallback result shaping without contacting the server.

import assert from "node:assert/strict";
import {
  nativeCppRecognizerInternals,
} from "./NativeCppRecognizer.mjs";

const { makeNativeRequest, normalizeNativeCppApiResponse, nativeCppResultToStrokeResult } = nativeCppRecognizerInternals;

{
  const request = makeNativeRequest({
    canvas: { width: 600, height: 240 },
    pointerType: "pen",
    strokes: [{ points: [{ x: 1, y: 2, t: 3, pressure: 0.5 }] }],
  }, { requestId: "abc", candidateLimit: 3 });
  assert.equal(request.protocolVersion, 1);
  assert.equal(request.requestId, "abc");
  assert.equal(request.strokes[0].points[0].time, 3);
}

{
  const normalized = normalizeNativeCppApiResponse({
    ok: true,
    engine: { name: "fixture", version: "0.test" },
    result: {
      text: "A",
      confidence: 0.86,
      candidates: [{ text: "A", confidence: 0.86, templateId: "fixture-A" }],
      normalizedBounds: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
    },
    warnings: ["dev"],
  });
  assert.equal(normalized.ok, true);
  assert.equal(normalized.candidates[0].text, "A");
  const panelResult = nativeCppResultToStrokeResult(normalized);
  assert.equal(panelResult.status, "success");
  assert.equal(panelResult.candidates[0].character, "A");
}

{
  const normalized = normalizeNativeCppApiResponse({ ok: false, error: { code: "NATIVE_TIMEOUT", message: "Timed out" } });
  assert.equal(normalized.ok, false);
  assert.equal(normalized.fallbackAllowed, true);
  const panelResult = nativeCppResultToStrokeResult(normalized);
  assert.equal(panelResult.status, "unavailable");
  assert.equal(panelResult.candidates.length, 0);
}

console.log("Native C++ handwriting browser adapter tests passed");
