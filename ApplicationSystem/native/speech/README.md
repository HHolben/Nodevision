# Nodevision eSpeak NG Bridge

This directory contains Nodevision's optional eSpeak NG companion bridge.

The bridge is intentionally narrow:

```text
Nodevision server -> fixed bridge executable -> libespeak-ng
```

It reads utterance text from stdin, speaks through libespeak-ng, and writes JSON Lines speech events to stdout. It does not read Notebook files, execute shell commands, load Session-selected libraries, or expose general native APIs.

Build requirements:

```text
Fedora runtime:         espeak-ng
Fedora source build:    espeak-ng espeak-ng-devel gcc-c++ make pkgconf-pkg-config
Debian/Ubuntu runtime: espeak-ng
Debian/Ubuntu build:   espeak-ng libespeak-ng-dev g++ make pkg-config
```

Build:

```bash
ApplicationSystem/native/speech/build-espeak-bridge.sh
```

The expected executable path is:

```text
ApplicationSystem/native/speech/build/nodevision-espeak-bridge
```

Protocol:

```text
stdout: JSON Lines only
stderr: diagnostics only
stdin: raw UTF-8 utterance text
```

Representative events:

```json
{"type":"started","utteranceId":"speech-123","sampleRate":22050}
{"type":"boundary","utteranceId":"speech-123","boundaryType":"word","nativeTextPosition":15,"nativeTextLength":4,"audioPositionMs":712}
{"type":"finished","utteranceId":"speech-123"}
```

Nodevision maps `nativeTextPosition` back to JavaScript UTF-16 source offsets in browser-side speech code before emitting application-level `speech.boundary`. When no explicit voice is requested, the bridge selects eSpeak voice `el` for Greek code points because the default voice can emit duplicate word events for Greek text.
