<!-- Nodevision/NativeComponents/HandwritingRecognizer/README.md -->
<!-- This document explains the experimental native C++ handwriting recognizer, its build process, protocol, security boundary, tests, benchmarks, and current limitations. -->
# Experimental C++ Handwriting Recognizer

`nodevision-handwriting` is an experimental local executable for isolated-character handwriting recognition. It runs beside Nodevision's existing browser-native, JavaScript stroke, HenryScript-template, and Tesseract.js paths. It is disabled by default and should be enabled only for local profiling or recognition-quality experiments.

## Build

```sh
cmake -S NativeComponents/HandwritingRecognizer -B NativeComponents/HandwritingRecognizer/build
cmake --build NativeComponents/HandwritingRecognizer/build
ctest --test-dir NativeComponents/HandwritingRecognizer/build --output-on-failure
```

The executable is expected at:

```text
NativeComponents/HandwritingRecognizer/build/nodevision-handwriting
```

Nodevision can also discover `bin/nodevision-handwriting`.

## Commands

```sh
nodevision-handwriting --version
nodevision-handwriting --capabilities
nodevision-handwriting --recognize < request.json
```

`--recognize` reads one JSON request from standard input and writes one JSON response to standard output. Diagnostics must go to standard error.

## Protocol

Protocol version: `1`

The request shape is:

```json
{
  "protocolVersion": 1,
  "requestId": "hw-1722864000000-001",
  "operation": "recognize",
  "mode": "single-character",
  "canvas": { "width": 600, "height": 240 },
  "strokes": [
    {
      "pointerType": "pen",
      "points": [
        { "x": 102.4, "y": 56.8, "time": 0, "pressure": 0.42 }
      ]
    }
  ],
  "options": {
    "candidateLimit": 5,
    "characterSet": "latin-alphanumeric",
    "preserveStrokeOrder": true,
    "usePressure": false
  }
}
```

Successful responses include `ok: true`, engine metadata, best text, confidence, ranked candidates, and normalized source bounds. Failure responses include `ok: false` and a stable error code such as `INVALID_JSON`, `UNSUPPORTED_PROTOCOL`, `INVALID_STROKES`, `TOO_MANY_POINTS`, `NO_TEMPLATES`, or `INTERNAL_ERROR`.

## Algorithm

The first version is deterministic and inspectable. It validates stroke data, removes duplicate nearby points, computes source bounds, translates strokes into an aspect-preserving unit square, resamples paths, extracts a 16x16 raster grid, projections, stroke count, aspect ratio, path, and endpoint features, then ranks bundled templates.

It intentionally does not include neural models, ONNX Runtime, TensorFlow Lite, HMMs, or cloud recognition.

## Template Format

The bundled templates are compiled into the binary for this first task, but the documented external shape is:

```json
{
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
}
```

Future Nodevision tooling can export HenryScript-derived or user-approved samples into this controlled format. This executable does not read HenryScript font files, does not load arbitrary request paths, and does not copy private user font data into application directories.

## Security Boundary

The Node.js service launches this executable without a shell, from controlled application locations only. It passes JSON through standard input, separates standard output from standard error, enforces timeouts, caps request and response sizes, validates protocol version and request ID, and treats native output as untrusted.

The native executable does not store handwriting samples. Training and sample capture should remain explicit user actions in future work.

## Benchmark

```sh
NativeComponents/HandwritingRecognizer/build/nodevision-handwriting-benchmark
```

The benchmark reports total samples, top-1 accuracy, top-3 accuracy, average/median/worst recognition time, and misclassified samples. These are development measurements, not formal model validation.

## Current Limitations

The recognizer handles a small isolated-character fixture set only: `A B C H I L O S T 0 1 2 5 8`. It does not segment words, recognize cursive, learn automatically, infer language context, or handle mathematical notation. A native recognizer should remain justified by profiling or recognition-quality experiments, not by assuming C++ is automatically better.

Recommended next work is a user-correction and sample-capture workflow that can build personalized templates and optionally export approved templates to this native format.
