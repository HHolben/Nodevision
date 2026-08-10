// Nodevision/NativeComponents/HandwritingRecognizer/src/Recognizer.cpp
// This file ranks normalized handwriting strokes against bundled templates and returns deterministic recognition candidates.
#include "Recognizer.hpp"

#include "StrokeNormalizer.hpp"

#include <algorithm>
#include <cmath>

namespace nodevision::handwriting {
namespace {

double clamp01(double value) {
  if (!std::isfinite(value)) return 0.0;
  return std::max(0.0, std::min(1.0, value));
}

}  // namespace

Recognizer::Recognizer() : templates_(loadBundledTemplates()) {}

RecognitionResponse Recognizer::recognize(const RecognitionRequest& request) {
  RecognitionResponse response;
  response.requestId = request.requestId;

  ProtocolError error;
  NormalizedGlyph glyph;
  if (!normalizeStrokes(request, glyph, error)) {
    response.ok = false;
    response.error = error;
    return response;
  }

  if (templates_.empty()) {
    response.ok = false;
    response.error = {"NO_TEMPLATES", "No bundled handwriting templates are available."};
    return response;
  }

  const FeatureVector features = extractFeatures(glyph);
  std::vector<Candidate> candidates;
  candidates.reserve(templates_.size());
  for (const TemplateSample& sample : templates_) {
    const double score = clamp01(featureSimilarity(features, sample.features, request.options.preserveStrokeOrder));
    candidates.push_back({sample.label, score, sample.id});
  }

  std::stable_sort(candidates.begin(), candidates.end(), [](const Candidate& a, const Candidate& b) {
    if (std::abs(a.confidence - b.confidence) > 0.000001) return a.confidence > b.confidence;
    return a.text < b.text;
  });

  const int limit = std::max(1, std::min(20, request.options.candidateLimit));
  if (static_cast<int>(candidates.size()) > limit) candidates.resize(static_cast<std::size_t>(limit));

  response.ok = true;
  response.bounds = glyph.sourceBounds;
  response.candidates = candidates;
  if (!candidates.empty()) {
    response.text = candidates.front().text;
    response.confidence = candidates.front().confidence;
  }
  if (glyph.filteredPointCount < 3) response.warnings.push_back("Very few points were available for recognition.");
  return response;
}

}  // namespace nodevision::handwriting
