// Nodevision/NativeComponents/HandwritingRecognizer/src/FeatureExtractor.cpp
// This file extracts stroke-aware path, projection, and raster features for deterministic native handwriting template matching.
#include "FeatureExtractor.hpp"

#include <algorithm>
#include <cmath>

namespace nodevision::handwriting {
namespace {

double clamp01(double value) {
  return std::max(0.0, std::min(1.0, value));
}

int gridIndex(double value) {
  return std::max(0, std::min(kRasterGridSize - 1, static_cast<int>(std::floor(clamp01(value) * kRasterGridSize))));
}

double distance(Point2 a, Point2 b) {
  const double dx = a.x - b.x;
  const double dy = a.y - b.y;
  return std::sqrt(dx * dx + dy * dy);
}

void rasterizeSegment(FeatureVector& features, Point2 a, Point2 b) {
  const int steps = std::max(1, static_cast<int>(std::ceil(distance(a, b) * kRasterGridSize * 2.0)));
  for (int i = 0; i <= steps; ++i) {
    const double t = static_cast<double>(i) / static_cast<double>(steps);
    const double x = a.x + (b.x - a.x) * t;
    const double y = a.y + (b.y - a.y) * t;
    const int gx = gridIndex(x);
    const int gy = gridIndex(y);
    features.raster[static_cast<std::size_t>(gy * kRasterGridSize + gx)] = 1.0;
    features.horizontalProjection[static_cast<std::size_t>(gy)] = 1.0;
    features.verticalProjection[static_cast<std::size_t>(gx)] = 1.0;
  }
}

std::vector<Point2> flattenResampledPath(const NormalizedGlyph& glyph) {
  std::vector<Point2> path;
  const int perStroke = std::max(8, 64 / std::max(1, static_cast<int>(glyph.strokes.size())));
  for (const NormalizedStroke& stroke : glyph.strokes) {
    std::vector<Point2> sampled = resamplePoints(stroke.points, perStroke);
    path.insert(path.end(), sampled.begin(), sampled.end());
  }
  return resamplePoints(path, 64);
}

double rasterSimilarity(const FeatureVector& a, const FeatureVector& b) {
  double intersection = 0.0;
  double unionCount = 0.0;
  for (std::size_t i = 0; i < a.raster.size(); ++i) {
    const bool av = a.raster[i] > 0.0;
    const bool bv = b.raster[i] > 0.0;
    if (av && bv) intersection += 1.0;
    if (av || bv) unionCount += 1.0;
  }
  return unionCount <= 0.0 ? 0.0 : intersection / unionCount;
}

double projectionSimilarity(const FeatureVector& a, const FeatureVector& b) {
  double diff = 0.0;
  for (std::size_t i = 0; i < a.horizontalProjection.size(); ++i) {
    diff += std::abs(a.horizontalProjection[i] - b.horizontalProjection[i]);
    diff += std::abs(a.verticalProjection[i] - b.verticalProjection[i]);
  }
  return clamp01(1.0 - diff / (kRasterGridSize * 2.0));
}

double pathSimilarity(const FeatureVector& a, const FeatureVector& b, bool preserveStrokeOrder) {
  if (a.path.empty() || b.path.empty()) return 0.0;
  const std::size_t count = std::min(a.path.size(), b.path.size());
  double forward = 0.0;
  double reverse = 0.0;
  for (std::size_t i = 0; i < count; ++i) {
    forward += distance(a.path[i], b.path[i]);
    reverse += distance(a.path[i], b.path[count - 1 - i]);
  }
  const double best = preserveStrokeOrder ? forward : std::min(forward, reverse);
  return clamp01(1.0 - (best / static_cast<double>(count)) / 0.55);
}

}  // namespace

FeatureVector extractFeatures(const NormalizedGlyph& glyph) {
  FeatureVector features;
  features.strokeCount = static_cast<int>(glyph.strokes.size());
  features.aspectRatio = glyph.aspectRatio;
  features.path = flattenResampledPath(glyph);
  if (!features.path.empty()) {
    features.start = features.path.front();
    features.end = features.path.back();
  }

  for (const NormalizedStroke& stroke : glyph.strokes) {
    features.totalLength += polylineLength(stroke.points);
    if (stroke.points.size() == 1) rasterizeSegment(features, stroke.points.front(), stroke.points.front());
    for (std::size_t i = 1; i < stroke.points.size(); ++i) rasterizeSegment(features, stroke.points[i - 1], stroke.points[i]);
  }
  return features;
}

double featureSimilarity(const FeatureVector& a, const FeatureVector& b, bool preserveStrokeOrder) {
  const double raster = rasterSimilarity(a, b);
  const double projection = projectionSimilarity(a, b);
  const double path = pathSimilarity(a, b, preserveStrokeOrder);
  const double stroke = clamp01(1.0 - std::abs(a.strokeCount - b.strokeCount) / 4.0);
  const double aspect = clamp01(1.0 - std::abs(std::log(std::max(0.1, a.aspectRatio)) - std::log(std::max(0.1, b.aspectRatio))) / 1.4);
  const double endpoint = clamp01(1.0 - (distance(a.start, b.start) + distance(a.end, b.end)) / 1.6);
  return clamp01(raster * 0.38 + path * 0.28 + projection * 0.14 + stroke * 0.10 + aspect * 0.06 + endpoint * 0.04);
}

}  // namespace nodevision::handwriting
