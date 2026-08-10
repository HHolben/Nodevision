// Nodevision/NativeComponents/HandwritingRecognizer/include/HandwritingProtocol.hpp
// This header defines the versioned JSON protocol structures and serialization helpers used by the experimental native handwriting executable.
#pragma once

#include <string>
#include <vector>

namespace nodevision::handwriting {

constexpr int kProtocolVersion = 1;
constexpr const char* kEngineName = "nodevision-cpp-handwriting";
constexpr const char* kEngineVersion = "0.1.0";

struct ProtocolError {
  std::string code;
  std::string message;
};

struct Point {
  double x = 0.0;
  double y = 0.0;
  double time = 0.0;
  double pressure = 0.5;
};

struct Stroke {
  std::string pointerType = "unknown";
  std::vector<Point> points;
};

struct Canvas {
  double width = 0.0;
  double height = 0.0;
};

struct RecognitionOptions {
  int candidateLimit = 5;
  std::string characterSet = "latin-alphanumeric";
  bool preserveStrokeOrder = true;
  bool usePressure = false;
};

struct RecognitionRequest {
  int protocolVersion = 0;
  std::string requestId;
  std::string operation;
  std::string mode;
  Canvas canvas;
  std::vector<Stroke> strokes;
  RecognitionOptions options;
};

struct Candidate {
  std::string text;
  double confidence = 0.0;
  std::string templateId;
};

struct NormalizedBounds {
  double x = 0.0;
  double y = 0.0;
  double width = 0.0;
  double height = 0.0;
};

struct RecognitionResponse {
  std::string requestId;
  bool ok = false;
  std::string text;
  double confidence = 0.0;
  std::vector<Candidate> candidates;
  NormalizedBounds bounds;
  std::vector<std::string> warnings;
  ProtocolError error;
};

bool parseRecognitionRequest(const std::string& input, RecognitionRequest& request, ProtocolError& error);
std::string serializeSuccess(const RecognitionResponse& response);
std::string serializeFailure(const std::string& requestId, const ProtocolError& error);
std::string serializeCapabilities();
std::string serializeVersion();
std::string escapeJsonString(const std::string& value);

}  // namespace nodevision::handwriting
