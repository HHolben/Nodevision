// Nodevision/NativeComponents/HandwritingRecognizer/tests/test_recognizer.cpp
// This file verifies deterministic candidate ordering, confidence bounds, and recognition of bundled development fixtures.
#include "Recognizer.hpp"

#include <cassert>
#include <set>
#include <utility>
#include <vector>

using namespace nodevision::handwriting;

namespace {

Stroke stroke(std::initializer_list<std::initializer_list<double>> points) {
  Stroke s;
  s.pointerType = "pen";
  double time = 0.0;
  for (auto pair : points) {
    auto it = pair.begin();
    const double x = it != pair.end() ? *it++ : 0.0;
    const double y = it != pair.end() ? *it : 0.0;
    s.points.push_back({x * 600.0, y * 240.0, time, 0.5});
    time += 16.0;
  }
  return s;
}

RecognitionRequest requestFor(const std::string& id, std::vector<Stroke> strokes) {
  RecognitionRequest request;
  request.protocolVersion = kProtocolVersion;
  request.requestId = id;
  request.operation = "recognize";
  request.mode = "single-character";
  request.canvas = {600, 240};
  request.strokes = std::move(strokes);
  request.options.candidateLimit = 5;
  return request;
}

}  // namespace

void runRecognizerTests() {
  Recognizer recognizer;
  const auto a = recognizer.recognize(requestFor("A", {
    stroke({{0.10, 0.92}, {0.50, 0.08}, {0.90, 0.92}}),
    stroke({{0.30, 0.58}, {0.70, 0.58}}),
  }));
  assert(a.ok);
  assert(!a.candidates.empty());
  assert(a.candidates.front().text == "A");
  for (const Candidate& candidate : a.candidates) {
    assert(candidate.confidence >= 0.0);
    assert(candidate.confidence <= 1.0);
  }

  const auto one = recognizer.recognize(requestFor("one", {
    stroke({{0.45, 0.22}, {0.55, 0.10}, {0.55, 0.92}}),
    stroke({{0.38, 0.92}, {0.72, 0.92}}),
  }));
  assert(one.ok);
  assert(one.candidates.front().text == "1");

  const auto again = recognizer.recognize(requestFor("A-again", {
    stroke({{0.10, 0.92}, {0.50, 0.08}, {0.90, 0.92}}),
    stroke({{0.30, 0.58}, {0.70, 0.58}}),
  }));
  assert(again.candidates.size() == a.candidates.size());
  for (std::size_t i = 0; i < a.candidates.size(); ++i) assert(again.candidates[i].text == a.candidates[i].text);

  std::set<std::string> seen;
  for (const Candidate& candidate : a.candidates) seen.insert(candidate.text);
  assert(seen.size() == a.candidates.size());
}
