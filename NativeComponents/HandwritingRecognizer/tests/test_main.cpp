// Nodevision/NativeComponents/HandwritingRecognizer/tests/test_main.cpp
// This file runs the focused native handwriting test groups from one CTest-friendly executable.
#include <iostream>

void runProtocolTests();
void runNormalizationTests();
void runRecognizerTests();

int main() {
  runProtocolTests();
  runNormalizationTests();
  runRecognizerTests();
  std::cout << "Native handwriting tests passed\n";
  return 0;
}
