// Nodevision/NativeComponents/HandwritingRecognizer/include/FeatureExtractor.hpp
// This header defines inspectable stroke and raster features used by the deterministic native handwriting recognizer.
#pragma once

#include "StrokeNormalizer.hpp"

#include <array>
#include <vector>

namespace nodevision::handwriting {

constexpr int kRasterGridSize = 16;

struct FeatureVector {
  std::array<double, kRasterGridSize * kRasterGridSize> raster{};
  std::array<double, kRasterGridSize> horizontalProjection{};
  std::array<double, kRasterGridSize> verticalProjection{};
  std::vector<Point2> path;
  int strokeCount = 0;
  double aspectRatio = 1.0;
  double totalLength = 0.0;
  Point2 start;
  Point2 end;
};

FeatureVector extractFeatures(const NormalizedGlyph& glyph);
double featureSimilarity(const FeatureVector& a, const FeatureVector& b, bool preserveStrokeOrder);

}  // namespace nodevision::handwriting
