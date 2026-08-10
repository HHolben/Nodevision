cmake_minimum_required(VERSION 3.16)
project(NodevisionHandwritingRecognizer VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_library(nodevision_handwriting_core
  src/FeatureExtractor.cpp
  src/HandwritingProtocol.cpp
  src/Recognizer.cpp
  src/StrokeNormalizer.cpp
  src/TemplateStore.cpp
)

target_include_directories(nodevision_handwriting_core PUBLIC include)

if(MSVC)
  target_compile_options(nodevision_handwriting_core PRIVATE /W4)
else()
  target_compile_options(nodevision_handwriting_core PRIVATE -Wall -Wextra -pedantic)
endif()

add_executable(nodevision-handwriting src/main.cpp)
target_link_libraries(nodevision-handwriting PRIVATE nodevision_handwriting_core)

add_executable(nodevision_handwriting_tests
  tests/test_main.cpp
  tests/test_normalization.cpp
  tests/test_protocol.cpp
  tests/test_recognizer.cpp
)
target_link_libraries(nodevision_handwriting_tests PRIVATE nodevision_handwriting_core)

add_executable(nodevision-handwriting-benchmark benchmarks/benchmark.cpp)
target_link_libraries(nodevision-handwriting-benchmark PRIVATE nodevision_handwriting_core)

enable_testing()
add_test(NAME native_handwriting_tests COMMAND nodevision_handwriting_tests)
