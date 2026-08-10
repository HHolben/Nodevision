// Nodevision/NativeComponents/HandwritingRecognizer/src/main.cpp
// This file provides the nodevision-handwriting command-line boundary for version, capability, and stdin JSON recognition requests.
#include "HandwritingProtocol.hpp"
#include "Recognizer.hpp"
#include "StrokeNormalizer.hpp"

#include <iostream>
#include <exception>
#include <sstream>

using namespace nodevision::handwriting;

namespace {

constexpr std::size_t kMaxStdinBytes = 2 * 1024 * 1024;

std::string readStdinLimited() {
  std::ostringstream out;
  char buffer[4096];
  std::size_t total = 0;
  while (std::cin.good()) {
    std::cin.read(buffer, sizeof(buffer));
    const std::streamsize count = std::cin.gcount();
    if (count <= 0) break;
    total += static_cast<std::size_t>(count);
    if (total > kMaxStdinBytes) {
      throw ProtocolError{"REQUEST_TOO_LARGE", "The recognition request exceeds the native input size limit."};
    }
    out.write(buffer, count);
  }
  return out.str();
}

int recognize() {
  std::string requestId;
  try {
    RecognitionRequest request;
    ProtocolError error;
    const std::string input = readStdinLimited();
    if (!parseRecognitionRequest(input, request, error)) {
      std::cout << serializeFailure(request.requestId, error) << "\n";
      return 0;
    }
    requestId = request.requestId;
    Recognizer recognizer;
    RecognitionResponse response = recognizer.recognize(request);
    if (!response.ok) std::cout << serializeFailure(requestId, response.error) << "\n";
    else std::cout << serializeSuccess(response) << "\n";
    return 0;
  } catch (const ProtocolError& error) {
    std::cout << serializeFailure(requestId, error) << "\n";
    return 0;
  } catch (const std::exception& err) {
    std::cerr << "nodevision-handwriting internal error: " << err.what() << "\n";
    std::cout << serializeFailure(requestId, {"INTERNAL_ERROR", "The native handwriting engine failed internally."}) << "\n";
    return 0;
  }
}

}  // namespace

int main(int argc, char** argv) {
  const std::string command = argc > 1 ? argv[1] : "";
  if (command == "--version") {
    std::cout << serializeVersion() << "\n";
    return 0;
  }
  if (command == "--capabilities") {
    std::cout << serializeCapabilities() << "\n";
    return 0;
  }
  if (command == "--recognize") return recognize();

  std::cerr << "Usage: nodevision-handwriting --version | --capabilities | --recognize\n";
  return 2;
}
