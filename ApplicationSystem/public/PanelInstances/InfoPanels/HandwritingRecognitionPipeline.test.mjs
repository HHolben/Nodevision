// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/HandwritingRecognitionPipeline.test.mjs
// Focused tests for candidate scoring, context, confusion learning, and coordination.

import assert from "node:assert/strict";
import { combineHandwritingCandidateEvidence } from "./HandwritingCandidateScoring.mjs";
import { rerankCandidatesWithContext } from "./HandwritingRecognitionContext.mjs";
import {
  confusionAdjustment,
  recordDirectionalConfusion,
  rerankCandidatesWithConfusions,
  validateConfusions,
} from "./HandwritingConfusions.mjs";
import {
  coordinateHandwritingRecognition,
  createRecognitionRequestTracker,
} from "./HandwritingRecognitionCoordinator.mjs";

{
  const rasterOnly = combineHandwritingCandidateEvidence({
    rasterScore: 0.8,
    trajectoryScore: null,
    inkDensityScore: 0.7,
    strokeCountScore: 1,
    aspectRatioScore: 1,
  });
  assert.ok(rasterOnly.score > 0.7, "raster-only generated templates remain usable");
  assert.equal(rasterOnly.evidence.trajectoryAware, false);
}

{
  const v2 = combineHandwritingCandidateEvidence({
    rasterScore: 0.76,
    trajectoryScore: 0.96,
    inkDensityScore: 0.7,
    strokeCountScore: 1,
    aspectRatioScore: 0.9,
    personalSampleBonus: 0.08,
  });
  assert.ok(v2.score > 0.8, "trajectory-aware personal samples use trajectory score");
  assert.equal(v2.evidence.trajectoryAware, true);
}

{
  const poorPersonal = combineHandwritingCandidateEvidence({
    rasterScore: 0.05,
    trajectoryScore: 0.1,
    inkDensityScore: 0.5,
    strokeCountScore: 1,
    aspectRatioScore: 1,
    personalSampleBonus: 0.08,
  });
  assert.equal(poorPersonal.evidence.personalSampleBonus, 0, "personal bonus is bounded by shape quality");
}

{
  const ranked = rerankCandidatesWithContext([
    { text: "a", score: 0.5 },
    { text: "A", score: 0.49 },
  ], { before: "Hello. " });
  assert.equal(ranked[0].text, "A");
  assert.ok(ranked[0].evidence.contextAdjustment <= 0.06);
}

{
  const ranked = rerankCandidatesWithContext([
    { text: "O", score: 0.52 },
    { text: "0", score: 0.51 },
  ], { before: "123" });
  assert.equal(ranked[0].text, "0");
}

{
  let stats = validateConfusions(null);
  for (let i = 0; i < 4; i += 1) stats = recordDirectionalConfusion(stats, "O", "0").confusions;
  stats = recordDirectionalConfusion(stats, "0", "O").confusions;
  assert.ok(confusionAdjustment(stats, "O", "0") > 0);
  assert.equal(confusionAdjustment(stats, "0", "O"), 0, "directional pair with too few observations should not adjust");
  assert.equal(recordDirectionalConfusion(stats, "S", "S").recorded, false);
  const ranked = rerankCandidatesWithConfusions([
    { text: "O", score: 0.5 },
    { text: "0", score: 0.49 },
  ], stats);
  assert.equal(ranked[0].text, "0");
}

{
  assert.deepEqual(validateConfusions({ schema: "wrong", pairs: { "O>0": { count: 9 } } }).pairs, {});
}

{
  const result = await coordinateHandwritingRecognition({
    engines: [
      { name: "browser-native", available: false, run: async () => ({ text: "N" }) },
      { name: "nodevision-custom", run: async () => ({ candidates: [{ text: "H", score: 0.8 }] }) },
      { name: "tesseract", run: async () => ({ candidates: [{ text: "A", score: 0.9 }] }) },
    ],
  });
  assert.equal(result.text, "H");
  assert.equal(result.selectedEngine, "nodevision-custom");
  assert.equal(result.engineResults[0].status, "skipped");
}

{
  const result = await coordinateHandwritingRecognition({
    engines: [
      { name: "browser-native", run: async () => { throw new Error("native failed"); } },
      { name: "nodevision-custom", run: async () => ({ candidates: [] }) },
      { name: "tesseract", run: async () => ({ candidates: [{ text: "T", score: 0.6 }] }) },
    ],
  });
  assert.equal(result.text, "T");
  assert.equal(result.engineResults[0].status, "failed");
}

{
  const tracker = createRecognitionRequestTracker();
  const first = tracker.begin();
  const second = tracker.begin();
  assert.equal(tracker.isActive(first), false);
  assert.equal(tracker.isActive(second), true);
  tracker.invalidate();
  assert.equal(tracker.isActive(second), false);
}

{
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    () => coordinateHandwritingRecognition({
      signal: controller.signal,
      engines: [{ name: "nodevision-custom", run: async () => ({ candidates: [{ text: "X", score: 1 }] }) }],
    }),
    /cancelled/
  );
}

console.log("Handwriting recognition pipeline tests passed");
