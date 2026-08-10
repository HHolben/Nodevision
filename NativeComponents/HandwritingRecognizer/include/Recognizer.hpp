// Nodevision/NativeComponents/HandwritingRecognizer/include/Recognizer.hpp
// This header declares the deterministic native handwriting recognizer that ranks bundled templates without requiring machine-learning dependencies.
#pragma once

#include "HandwritingProtocol.hpp"
#include "TemplateStore.hpp"

namespace nodevision::handwriting {

class Recognizer {
 public:
  Recognizer();
  RecognitionResponse recognize(const RecognitionRequest& request);

 private:
  std::vector<TemplateSample> templates_;
};

}  // namespace nodevision::handwriting
