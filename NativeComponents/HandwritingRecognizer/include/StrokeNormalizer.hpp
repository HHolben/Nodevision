// Nodevision/NativeComponents/HandwritingRecognizer/include/StrokeNormalizer.hpp
// This header declares stroke validation, duplicate filtering, geometric normalization, and resampling for native handwriting requests.
#pragma once

#include "HandwritingProtocol.hpp"

#include <vector>

namespace nodevision::handwriting {

constexpr int kMaxStrokes = 128;
constexpr int kMaxPointsPerStroke = 4096;
constexpr int kMaxTotalPoints = 32768;

struct Point2 {
  double x = 0.0;
  double y = 0.0;
};

struct NormalizedStroke {
  std::vector<Point2> points;
};

struct NormalizedGlyph {
  std::vector<NormalizedStroke> strokes;
  NormalizedBounds sourceBounds;
  double aspectRatio = 1.0;
  int rawStrokeCount = 0;
  int filteredPointCount = 0;
};

bool validateRequestShape(const RecognitionRequest& request, ProtocolError& error);
bool normalizeStrokes(const RecognitionRequest& request, NormalizedGlyph& glyph, ProtocolError& error);
std::vector<Point2> resamplePoints(const std::vector<Point2>& points, int targetCount);
double polylineLength(const std::vector<Point2>& points);

}  // namespace nodevision::handwriting
