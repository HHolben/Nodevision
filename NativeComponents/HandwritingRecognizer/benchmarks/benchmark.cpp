// Nodevision/NativeComponents/HandwritingRecognizer/benchmarks/benchmark.cpp
// This file runs a small local development benchmark for the experimental native handwriting recognizer without claiming production accuracy.
#include "Recognizer.hpp"

#include <algorithm>
#include <chrono>
#include <iostream>
#include <string>
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
    time += 14.0;
  }
  return s;
}

RecognitionRequest requestFor(const std::string& label, std::vector<Stroke> strokes) {
  RecognitionRequest request;
  request.protocolVersion = kProtocolVersion;
  request.requestId = "bench-" + label;
  request.operation = "recognize";
  request.mode = "single-character";
  request.canvas = {600, 240};
  request.options.candidateLimit = 5;
  request.strokes = std::move(strokes);
  return request;
}

struct Fixture {
  std::string label;
  RecognitionRequest request;
};

std::vector<Fixture> fixtures() {
  return {
    {"A", requestFor("A", {stroke({{0.14, 0.90}, {0.48, 0.12}, {0.86, 0.90}}), stroke({{0.32, 0.58}, {0.68, 0.58}})})},
    {"B", requestFor("B", {stroke({{0.20, 0.10}, {0.20, 0.90}}), stroke({{0.20, 0.12}, {0.70, 0.20}, {0.20, 0.50}}), stroke({{0.20, 0.50}, {0.74, 0.62}, {0.20, 0.90}})})},
    {"C", requestFor("C", {stroke({{0.82, 0.20}, {0.54, 0.10}, {0.18, 0.30}, {0.16, 0.70}, {0.56, 0.90}, {0.82, 0.78}})})},
    {"H", requestFor("H", {stroke({{0.20, 0.12}, {0.20, 0.90}}), stroke({{0.80, 0.12}, {0.80, 0.90}}), stroke({{0.22, 0.52}, {0.78, 0.52}})})},
    {"I", requestFor("I", {stroke({{0.32, 0.10}, {0.68, 0.10}}), stroke({{0.50, 0.10}, {0.50, 0.90}}), stroke({{0.34, 0.90}, {0.68, 0.90}})})},
    {"L", requestFor("L", {stroke({{0.22, 0.12}, {0.22, 0.88}, {0.78, 0.88}})})},
    {"O", requestFor("O", {stroke({{0.52, 0.10}, {0.84, 0.32}, {0.78, 0.78}, {0.50, 0.92}, {0.18, 0.74}, {0.16, 0.28}, {0.52, 0.10}})})},
    {"S", requestFor("S", {stroke({{0.78, 0.18}, {0.34, 0.10}, {0.18, 0.36}, {0.70, 0.54}, {0.74, 0.84}, {0.24, 0.82}})})},
    {"T", requestFor("T", {stroke({{0.18, 0.12}, {0.82, 0.12}}), stroke({{0.50, 0.12}, {0.50, 0.90}})})},
    {"0", requestFor("0", {stroke({{0.48, 0.10}, {0.84, 0.30}, {0.76, 0.84}, {0.48, 0.92}, {0.16, 0.72}, {0.20, 0.20}, {0.48, 0.10}}), stroke({{0.32, 0.78}, {0.70, 0.24}})})},
    {"1", requestFor("1", {stroke({{0.42, 0.22}, {0.54, 0.10}, {0.54, 0.90}}), stroke({{0.40, 0.90}, {0.70, 0.90}})})},
    {"2", requestFor("2", {stroke({{0.22, 0.30}, {0.44, 0.12}, {0.78, 0.20}, {0.78, 0.42}, {0.22, 0.88}, {0.82, 0.88}})})},
    {"5", requestFor("5", {stroke({{0.76, 0.14}, {0.26, 0.14}, {0.24, 0.44}, {0.66, 0.48}, {0.78, 0.76}, {0.44, 0.92}, {0.20, 0.78}})})},
    {"8", requestFor("8", {stroke({{0.50, 0.10}, {0.76, 0.24}, {0.50, 0.52}, {0.24, 0.26}, {0.50, 0.10}}), stroke({{0.50, 0.52}, {0.78, 0.68}, {0.50, 0.94}, {0.22, 0.68}, {0.50, 0.52}})})},
  };
}

}  // namespace

int main() {
  Recognizer recognizer;
  std::vector<double> times;
  std::vector<std::string> misses;
  int top1 = 0;
  int top3 = 0;
  const auto samples = fixtures();
  for (const Fixture& fixture : samples) {
    const auto start = std::chrono::steady_clock::now();
    const RecognitionResponse response = recognizer.recognize(fixture.request);
    const auto end = std::chrono::steady_clock::now();
    times.push_back(std::chrono::duration<double, std::milli>(end - start).count());
    if (!response.candidates.empty() && response.candidates[0].text == fixture.label) top1 += 1;
    const auto topEnd = response.candidates.begin() + std::min<std::size_t>(3, response.candidates.size());
    if (std::any_of(response.candidates.begin(), topEnd, [&](const Candidate& c) { return c.text == fixture.label; })) top3 += 1;
    if (response.candidates.empty() || response.candidates[0].text != fixture.label) {
      misses.push_back(fixture.label + " -> " + (response.candidates.empty() ? "none" : response.candidates[0].text));
    }
  }

  std::sort(times.begin(), times.end());
  double total = 0.0;
  for (double t : times) total += t;
  std::cout << "Nodevision native handwriting development benchmark\n";
  std::cout << "total samples: " << samples.size() << "\n";
  std::cout << "top-1 accuracy: " << top1 << "/" << samples.size() << "\n";
  std::cout << "top-3 accuracy: " << top3 << "/" << samples.size() << "\n";
  std::cout << "average recognition time ms: " << (times.empty() ? 0.0 : total / times.size()) << "\n";
  std::cout << "median recognition time ms: " << (times.empty() ? 0.0 : times[times.size() / 2]) << "\n";
  std::cout << "worst recognition time ms: " << (times.empty() ? 0.0 : times.back()) << "\n";
  std::cout << "misclassified samples:";
  if (misses.empty()) std::cout << " none";
  for (const auto& miss : misses) std::cout << " " << miss;
  std::cout << "\n";
  return 0;
}
