// Nodevision/NativeComponents/HandwritingRecognizer/src/TemplateStore.cpp
// This file defines the bundled development templates used by the first native handwriting recognizer while documenting the external template shape.
#include "TemplateStore.hpp"

#include <algorithm>
#include <initializer_list>
#include <sstream>

namespace nodevision::handwriting {
namespace {

using StrokePoints = std::initializer_list<std::initializer_list<double>>;
using GlyphStrokes = std::initializer_list<StrokePoints>;

NormalizedStroke makeStroke(StrokePoints points) {
  NormalizedStroke stroke;
  for (auto pair : points) {
    auto it = pair.begin();
    const double x = it != pair.end() ? *it++ : 0.0;
    const double y = it != pair.end() ? *it : 0.0;
    stroke.points.push_back({x, y});
  }
  return stroke;
}

double templateAspectRatio(const std::vector<NormalizedStroke>& strokes) {
  double minX = 1.0;
  double minY = 1.0;
  double maxX = 0.0;
  double maxY = 0.0;
  bool any = false;
  for (const auto& stroke : strokes) {
    for (const auto& point : stroke.points) {
      any = true;
      minX = std::min(minX, point.x);
      minY = std::min(minY, point.y);
      maxX = std::max(maxX, point.x);
      maxY = std::max(maxY, point.y);
    }
  }
  if (!any) return 1.0;
  return std::max(0.05, maxX - minX) / std::max(0.05, maxY - minY);
}

TemplateSample makeTemplate(const std::string& label, const std::string& id, GlyphStrokes glyph) {
  TemplateSample sample;
  sample.id = id;
  sample.label = label;
  for (auto stroke : glyph) sample.strokes.push_back(makeStroke(stroke));
  NormalizedGlyph normalized;
  normalized.strokes = sample.strokes;
  normalized.aspectRatio = templateAspectRatio(sample.strokes);
  normalized.rawStrokeCount = static_cast<int>(sample.strokes.size());
  for (const auto& stroke : sample.strokes) normalized.filteredPointCount += static_cast<int>(stroke.points.size());
  sample.features = extractFeatures(normalized);
  return sample;
}

}  // namespace

std::vector<TemplateSample> loadBundledTemplates() {
  return {
    makeTemplate("A", "bundled-A-001", {
      {{0.12, 0.92}, {0.50, 0.08}, {0.88, 0.92}},
      {{0.30, 0.58}, {0.70, 0.58}},
    }),
    makeTemplate("B", "bundled-B-001", {
      {{0.18, 0.08}, {0.18, 0.92}},
      {{0.18, 0.08}, {0.72, 0.18}, {0.72, 0.42}, {0.18, 0.50}},
      {{0.18, 0.50}, {0.78, 0.60}, {0.74, 0.88}, {0.18, 0.92}},
    }),
    makeTemplate("C", "bundled-C-001", {
      {{0.82, 0.18}, {0.56, 0.08}, {0.22, 0.22}, {0.12, 0.50}, {0.24, 0.78}, {0.58, 0.92}, {0.84, 0.80}},
    }),
    makeTemplate("H", "bundled-H-001", {
      {{0.18, 0.10}, {0.18, 0.92}},
      {{0.82, 0.10}, {0.82, 0.92}},
      {{0.18, 0.52}, {0.82, 0.52}},
    }),
    makeTemplate("I", "bundled-I-001", {
      {{0.30, 0.10}, {0.70, 0.10}},
      {{0.50, 0.10}, {0.50, 0.92}},
      {{0.30, 0.92}, {0.70, 0.92}},
    }),
    makeTemplate("L", "bundled-L-001", {
      {{0.22, 0.10}, {0.22, 0.90}, {0.80, 0.90}},
    }),
    makeTemplate("O", "bundled-O-001", {
      {{0.50, 0.08}, {0.76, 0.18}, {0.90, 0.50}, {0.76, 0.82}, {0.50, 0.94}, {0.24, 0.82}, {0.10, 0.50}, {0.24, 0.18}, {0.50, 0.08}},
    }),
    makeTemplate("S", "bundled-S-001", {
      {{0.78, 0.16}, {0.42, 0.08}, {0.18, 0.24}, {0.24, 0.44}, {0.70, 0.54}, {0.82, 0.76}, {0.56, 0.92}, {0.20, 0.84}},
    }),
    makeTemplate("T", "bundled-T-001", {
      {{0.18, 0.10}, {0.82, 0.10}},
      {{0.50, 0.10}, {0.50, 0.92}},
    }),
    makeTemplate("0", "bundled-0-001", {
      {{0.50, 0.08}, {0.78, 0.18}, {0.90, 0.50}, {0.76, 0.84}, {0.50, 0.94}, {0.22, 0.82}, {0.10, 0.50}, {0.24, 0.16}, {0.50, 0.08}},
      {{0.30, 0.78}, {0.70, 0.22}},
    }),
    makeTemplate("1", "bundled-1-001", {
      {{0.42, 0.24}, {0.54, 0.10}, {0.54, 0.92}},
      {{0.38, 0.92}, {0.72, 0.92}},
    }),
    makeTemplate("2", "bundled-2-001", {
      {{0.20, 0.28}, {0.40, 0.10}, {0.76, 0.18}, {0.80, 0.42}, {0.20, 0.90}, {0.82, 0.90}},
    }),
    makeTemplate("5", "bundled-5-001", {
      {{0.78, 0.12}, {0.24, 0.12}, {0.20, 0.46}, {0.64, 0.46}, {0.82, 0.62}, {0.72, 0.86}, {0.34, 0.92}, {0.18, 0.78}},
    }),
    makeTemplate("8", "bundled-8-001", {
      {{0.50, 0.08}, {0.78, 0.20}, {0.70, 0.46}, {0.50, 0.52}, {0.28, 0.46}, {0.20, 0.20}, {0.50, 0.08}},
      {{0.50, 0.52}, {0.78, 0.62}, {0.74, 0.86}, {0.50, 0.94}, {0.24, 0.84}, {0.22, 0.62}, {0.50, 0.52}},
    }),
  };
}

std::string bundledTemplateFormatDescription() {
  return R"json({
  "templateVersion": 1,
  "label": "A",
  "characterSet": "latin-alphanumeric",
  "source": "bundled",
  "samples": [
    {
      "strokes": [
        { "points": [[0.1, 0.9], [0.5, 0.1], [0.9, 0.9]] }
      ]
    }
  ]
})json";
}

}  // namespace nodevision::handwriting
