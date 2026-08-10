// Nodevision/NativeComponents/HandwritingRecognizer/include/TemplateStore.hpp
// This header declares the bundled, externally representable template set used by the first native handwriting recognizer.
#pragma once

#include "FeatureExtractor.hpp"

#include <string>
#include <vector>

namespace nodevision::handwriting {

struct TemplateSample {
  std::string id;
  std::string label;
  std::vector<NormalizedStroke> strokes;
  FeatureVector features;
};

std::vector<TemplateSample> loadBundledTemplates();
std::string bundledTemplateFormatDescription();

}  // namespace nodevision::handwriting
