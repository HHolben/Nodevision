// Nodevision/NativeComponents/HandwritingRecognizer/tests/test_protocol.cpp
// This file verifies native handwriting protocol parsing, protocol rejection, malformed JSON handling, and stable JSON serialization.
#include "HandwritingProtocol.hpp"
#include "StrokeNormalizer.hpp"

#include <cassert>
#include <string>

using namespace nodevision::handwriting;

namespace {

std::string validRequestJson() {
  return R"json({
    "protocolVersion": 1,
    "requestId": "hw-test-001",
    "operation": "recognize",
    "mode": "single-character",
    "canvas": { "width": 600, "height": 240 },
    "strokes": [
      { "pointerType": "pen", "points": [
        { "x": 100, "y": 200, "time": 0, "pressure": 0.4 },
        { "x": 300, "y": 20, "time": 12, "pressure": 0.5 }
      ] }
    ],
    "options": { "candidateLimit": 5, "characterSet": "latin-alphanumeric" }
  })json";
}

}  // namespace

void runProtocolTests() {
  RecognitionRequest request;
  ProtocolError error;
  assert(parseRecognitionRequest(validRequestJson(), request, error));
  assert(request.protocolVersion == 1);
  assert(request.requestId == "hw-test-001");
  assert(request.strokes.size() == 1);
  assert(request.strokes[0].points.size() == 2);

  RecognitionRequest malformed;
  assert(!parseRecognitionRequest("{bad json", malformed, error));
  assert(error.code == "INVALID_JSON");

  RecognitionRequest unsupported;
  assert(parseRecognitionRequest(validRequestJson(), unsupported, error));
  unsupported.protocolVersion = 99;
  assert(!validateRequestShape(unsupported, error));
  assert(error.code == "UNSUPPORTED_PROTOCOL");

  RecognitionRequest empty;
  assert(parseRecognitionRequest(validRequestJson(), empty, error));
  empty.strokes.clear();
  assert(!validateRequestShape(empty, error));
  assert(error.code == "INVALID_STROKES");

  const std::string failure = serializeFailure("abc", {"INVALID_JSON", "bad"});
  assert(failure.find("\"ok\":false") != std::string::npos);
  assert(failure.find("INVALID_JSON") != std::string::npos);
}
