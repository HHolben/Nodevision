<!-- Nodevision/ApplicationSystem/docs/native-cpp-handwriting-recognition.md -->
<!-- This document describes how the experimental C++ handwriting recognizer integrates with Nodevision without replacing existing handwriting recognition paths. -->
# Native C++ Handwriting Recognition

Nodevision's C++ handwriting recognizer is an experimental provider behind the existing handwriting panel. It is not part of the default automatic recognition chain, and it is disabled by default in `ApplicationSystem/config.json`.

## Integration Point

The current handwriting panel remains `ApplicationSystem/public/PanelInstances/InfoPanels/HandwritingOcrPanel.mjs`. The default `Automatic` method keeps the existing browser-native, Nodevision custom stroke, HenryScript-template, and Tesseract.js behavior. The explicit `C++ experimental` option sends the captured stroke glyph to `ApplicationSystem/public/HandwritingRecognition/NativeCppRecognizer.mjs`, which calls the authenticated local API:

```text
GET  /api/handwriting/native/status
POST /api/handwriting/native/recognize
```

Those routes use `ApplicationSystem/server/handwriting/NativeHandwritingService.mjs`, which starts `nodevision-handwriting --recognize` as a separate process. The server never passes request-controlled command-line arguments or filesystem paths to the executable.

## Enablement

Build the native component first:

```sh
cmake -S NativeComponents/HandwritingRecognizer -B NativeComponents/HandwritingRecognizer/build
cmake --build NativeComponents/HandwritingRecognizer/build
```

Then enable it locally:

```json
{
  "handwriting": {
    "nativeCpp": {
      "enabled": true,
      "executablePath": "",
      "timeoutMs": 1500,
      "candidateLimit": 5
    }
  }
}
```

With an empty `executablePath`, Nodevision checks controlled application locations such as `NativeComponents/HandwritingRecognizer/build/nodevision-handwriting` and `bin/nodevision-handwriting`. Browser status responses do not expose resolved filesystem paths.

## Fallback

When `C++ experimental` is selected, unavailable, disabled, timed-out, crashed, malformed, mismatched, or empty native responses fall back immediately to the existing Nodevision stroke recognizer. The panel keeps the captured strokes so the user can retry, accept an alternate, or type a correction.

## HenryScript

HenryScript remains part of the JavaScript recognition path. The native engine does not load a HenryScript font for each recognition request. Future tooling can export user-approved HenryScript-derived stroke or raster templates into the documented native template format through a controlled import/training action.

## Tests

Native:

```sh
ctest --test-dir NativeComponents/HandwritingRecognizer/build --output-on-failure
```

Node:

```sh
node ApplicationSystem/server/handwriting/NativeHandwritingService.test.mjs
node ApplicationSystem/public/HandwritingRecognition/NativeCppRecognizer.test.mjs
```

The Node tests use fixture executables and do not require the C++ binary.
