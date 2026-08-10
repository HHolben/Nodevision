// Nodevision/NativeComponents/HandwritingRecognizer/src/StrokeNormalizer.cpp
// This file validates raw handwriting strokes and normalizes them into an aspect-preserving unit square for native recognition.
#include "StrokeNormalizer.hpp"

#include <algorithm>
#include <cmath>

namespace nodevision::handwriting {
namespace {

double distance(Point2 a, Point2 b) {
  const double dx = a.x - b.x;
  const double dy = a.y - b.y;
  return std::sqrt(dx * dx + dy * dy);
}

bool finitePoint(const Point& p) {
  return std::isfinite(p.x) && std::isfinite(p.y) && std::isfinite(p.time) && std::isfinite(p.pressure);
}

}  // namespace

double polylineLength(const std::vector<Point2>& points) {
  double length = 0.0;
  for (std::size_t i = 1; i < points.size(); ++i) length += distance(points[i - 1], points[i]);
  return length;
}

std::vector<Point2> resamplePoints(const std::vector<Point2>& points, int targetCount) {
  if (points.empty() || targetCount <= 0) return {};
  if (points.size() == 1 || targetCount == 1) return std::vector<Point2>(1, points.front());

  const double totalLength = polylineLength(points);
  if (totalLength <= 0.000001) return std::vector<Point2>(static_cast<std::size_t>(targetCount), points.front());

  std::vector<Point2> output;
  output.reserve(static_cast<std::size_t>(targetCount));
  output.push_back(points.front());
  double targetDistance = totalLength / static_cast<double>(targetCount - 1);
  double accumulated = 0.0;
  std::size_t segmentIndex = 1;
  Point2 previous = points.front();

  while (segmentIndex < points.size() && output.size() < static_cast<std::size_t>(targetCount - 1)) {
    Point2 current = points[segmentIndex];
    const double segmentLength = distance(previous, current);
    if (accumulated + segmentLength >= targetDistance && segmentLength > 0.000001) {
      const double ratio = (targetDistance - accumulated) / segmentLength;
      Point2 inserted{
        previous.x + (current.x - previous.x) * ratio,
        previous.y + (current.y - previous.y) * ratio,
      };
      output.push_back(inserted);
      previous = inserted;
      accumulated = 0.0;
    } else {
      accumulated += segmentLength;
      previous = current;
      segmentIndex += 1;
    }
  }

  while (output.size() < static_cast<std::size_t>(targetCount)) output.push_back(points.back());
  return output;
}

bool validateRequestShape(const RecognitionRequest& request, ProtocolError& error) {
  if (request.protocolVersion != kProtocolVersion) {
    error = {"UNSUPPORTED_PROTOCOL", "The handwriting request protocol version is not supported."};
    return false;
  }
  if (request.operation != "recognize") {
    error = {"UNSUPPORTED_OPERATION", "The native handwriting engine only supports recognize."};
    return false;
  }
  if (request.mode != "single-character") {
    error = {"UNSUPPORTED_OPERATION", "The native handwriting engine currently supports single-character recognition only."};
    return false;
  }
  if (!std::isfinite(request.canvas.width) || !std::isfinite(request.canvas.height) || request.canvas.width <= 0 || request.canvas.height <= 0) {
    error = {"INVALID_STROKES", "Canvas width and height must be positive numbers."};
    return false;
  }
  if (request.strokes.empty()) {
    error = {"INVALID_STROKES", "The request contains no usable stroke points."};
    return false;
  }
  if (request.strokes.size() > kMaxStrokes) {
    error = {"TOO_MANY_STROKES", "The request contains too many strokes."};
    return false;
  }

  int totalPoints = 0;
  for (const Stroke& stroke : request.strokes) {
    if (stroke.points.size() > kMaxPointsPerStroke) {
      error = {"TOO_MANY_POINTS", "A stroke contains too many points."};
      return false;
    }
    totalPoints += static_cast<int>(stroke.points.size());
    if (totalPoints > kMaxTotalPoints) {
      error = {"TOO_MANY_POINTS", "The request contains too many total points."};
      return false;
    }
    for (const Point& point : stroke.points) {
      if (!finitePoint(point) || point.time < 0.0 || point.pressure < 0.0 || point.pressure > 1.0) {
        error = {"INVALID_STROKES", "Stroke points must contain finite coordinates, time, and pressure values."};
        return false;
      }
    }
  }
  return true;
}

bool normalizeStrokes(const RecognitionRequest& request, NormalizedGlyph& glyph, ProtocolError& error) {
  if (!validateRequestShape(request, error)) return false;

  double minX = INFINITY;
  double minY = INFINITY;
  double maxX = -INFINITY;
  double maxY = -INFINITY;
  std::vector<std::vector<Point2>> filtered;
  filtered.reserve(request.strokes.size());

  for (const Stroke& stroke : request.strokes) {
    std::vector<Point2> clean;
    clean.reserve(stroke.points.size());
    for (const Point& point : stroke.points) {
      Point2 p{point.x, point.y};
      if (!clean.empty() && distance(clean.back(), p) < 0.75) continue;
      clean.push_back(p);
      minX = std::min(minX, p.x);
      minY = std::min(minY, p.y);
      maxX = std::max(maxX, p.x);
      maxY = std::max(maxY, p.y);
    }
    if (!clean.empty()) filtered.push_back(clean);
  }

  if (filtered.empty() || !std::isfinite(minX) || !std::isfinite(minY) || !std::isfinite(maxX) || !std::isfinite(maxY)) {
    error = {"INVALID_STROKES", "The request contains no usable stroke points."};
    return false;
  }

  const double width = std::max(0.000001, maxX - minX);
  const double height = std::max(0.000001, maxY - minY);
  const double scale = std::max(width, height);
  const double offsetX = (1.0 - (width / scale)) / 2.0;
  const double offsetY = (1.0 - (height / scale)) / 2.0;

  glyph.strokes.clear();
  glyph.rawStrokeCount = static_cast<int>(request.strokes.size());
  glyph.filteredPointCount = 0;
  glyph.aspectRatio = width / std::max(0.000001, height);
  glyph.sourceBounds = {
    std::max(0.0, std::min(1.0, minX / request.canvas.width)),
    std::max(0.0, std::min(1.0, minY / request.canvas.height)),
    std::max(0.0, std::min(1.0, width / request.canvas.width)),
    std::max(0.0, std::min(1.0, height / request.canvas.height)),
  };

  for (const auto& stroke : filtered) {
    NormalizedStroke normalized;
    normalized.points.reserve(stroke.size());
    for (Point2 point : stroke) {
      normalized.points.push_back({
        std::max(0.0, std::min(1.0, ((point.x - minX) / scale) + offsetX)),
        std::max(0.0, std::min(1.0, ((point.y - minY) / scale) + offsetY)),
      });
    }
    glyph.filteredPointCount += static_cast<int>(normalized.points.size());
    glyph.strokes.push_back(normalized);
  }

  return glyph.filteredPointCount > 0;
}

}  // namespace nodevision::handwriting
