// Nodevision/NativeComponents/HandwritingRecognizer/tests/test_normalization.cpp
// This file verifies stroke normalization, aspect-ratio preservation, duplicate filtering, resampling, and stroke-count features.
#include "FeatureExtractor.hpp"
#include "StrokeNormalizer.hpp"

#include <cassert>
#include <cmath>

using namespace nodevision::handwriting;

namespace {

RecognitionRequest makeRequest() {
  RecognitionRequest request;
  request.protocolVersion = kProtocolVersion;
  request.requestId = "norm";
  request.operation = "recognize";
  request.mode = "single-character";
  request.canvas = {600, 240};
  request.strokes = {
    {"pen", {{100, 200, 0, 0.5}, {100.1, 200.1, 1, 0.5}, {300, 20, 2, 0.5}, {500, 200, 3, 0.5}}},
    {"pen", {{220, 130, 4, 0.5}, {380, 130, 5, 0.5}}},
  };
  return request;
}

}  // namespace

void runNormalizationTests() {
  ProtocolError error;
  NormalizedGlyph glyph;
  assert(normalizeStrokes(makeRequest(), glyph, error));
  assert(glyph.strokes.size() == 2);
  assert(glyph.filteredPointCount == 5);
  assert(glyph.sourceBounds.width > 0.6 && glyph.sourceBounds.width < 0.7);
  assert(glyph.sourceBounds.height > 0.7 && glyph.sourceBounds.height < 0.8);
  assert(glyph.aspectRatio > 2.1 && glyph.aspectRatio < 2.3);

  const auto sampled = resamplePoints(glyph.strokes[0].points, 12);
  assert(sampled.size() == 12);
  assert(std::abs(sampled.front().x - glyph.strokes[0].points.front().x) < 0.0001);
  assert(std::abs(sampled.back().y - glyph.strokes[0].points.back().y) < 0.0001);

  const FeatureVector features = extractFeatures(glyph);
  assert(features.strokeCount == 2);
  assert(features.path.size() == 64);
  assert(features.totalLength > 1.0);

  RecognitionRequest badTime = makeRequest();
  badTime.strokes[0].points[0].time = -1;
  assert(!normalizeStrokes(badTime, glyph, error));
  assert(error.code == "INVALID_STROKES");
}
