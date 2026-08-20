# Nodevision Speech Service

Nodevision speech commands are provider-independent. A Session calls the shared command registry:

```text
.NodevisionSession -> speech.* command -> SpeechService -> selected provider
```

Sessions continue to use `speech.speak`, `speech.stop`, `speech.pause`, `speech.resume`, and `speech.setRate`. They must not call provider-specific commands such as `espeak.speak` or wait for provider-specific event names.

## Architecture

`ApplicationSystem/public/Speech/SpeechService.mjs` owns utterance state, provider selection, text segmentation, normalized event emission, and Session cleanup. Providers register through `SpeechProviderRegistry.mjs` and are selected in this order:

1. Explicit provider preference from `localStorage["nodevision.speech.provider"]`, when set.
2. Available native/offline providers in registration order.
3. Browser Web Speech, only when it has usable voices.
4. A clear unavailable error.

Normal registration order is:

```text
espeak-native
linux-native
browser
```

`SpeechProviderRegistry` also supports focused internal capability requirements such as `{ wordBoundary: true }`. This is for Nodevision features such as a future Focus Session; Session scripts still use the shared `speech.*` command surface.

## Providers

`espeak-native` uses the optional Nodevision companion executable at `ApplicationSystem/native/speech/build/nodevision-espeak-bridge`. The server probes that fixed executable with `--probe`, starts it with `spawn(executable, args, { shell: false })`, sends utterance text through stdin, and reads JSON Lines events from stdout. This provider is the synchronization-capable provider when built and when libespeak-ng initializes successfully.

`linux-native` is the eSpeak/eSpeak NG CLI fallback. It discovers fixed executable names `espeak-ng` or `espeak` from `PATH`, starts them without a shell, and sends text through stdin with `--stdin`. It can speak and cancel, but it does not provide native word boundaries.

`browser` wraps `speechSynthesis` and `SpeechSynthesisUtterance`. It is not considered healthy merely because those objects exist; it requires at least one loaded voice because Electron on Linux can expose Web Speech while returning `voices=[]` and failing every utterance with `synthesis-failed`.

## Native Bridge

The native bridge source is `ApplicationSystem/native/speech/espeak_bridge.cpp`. It uses the eSpeak NG C library functions and structures documented in `speak_lib.h`:

```text
espeak_Initialize
espeak_SetSynthCallback
espeak_SetParameter(espeakRATE, ...)
espeak_SetVoiceByName, when a voice is supplied
espeak_Synth
espeak_Synchronize
espeak_Terminate
espeak_EVENT_WORD
espeak_EVENT_MSG_TERMINATED
```

eSpeak `WORD` events provide native text position, native text length, audio position in milliseconds, and the native message identifier. In playback mode the official header describes callbacks as occurring when events happen during playback; Nodevision preserves `audioPositionMs` separately and does not replace it with wall-clock estimates.

The bridge stdout is machine-readable JSONL only. Diagnostic text belongs on stderr. Example event fields:

```json
{"type":"boundary","utteranceId":"speech-123","boundaryType":"word","nativeTextPosition":15,"nativeTextLength":4,"audioPositionMs":712}
```

## Build Requirements

The native bridge is optional at runtime. Nodevision must still start when the bridge, compiler, headers, or library are missing.

Typical Linux development packages are:

```text
Fedora runtime:        espeak-ng
Fedora source build:   espeak-ng espeak-ng-devel gcc-c++ make pkgconf-pkg-config
Debian/Ubuntu runtime: espeak-ng
Debian/Ubuntu build:   espeak-ng libespeak-ng-dev g++ make pkg-config
```

Build the bridge with:

```bash
ApplicationSystem/native/speech/build-espeak-bridge.sh
```

The script uses `pkg-config espeak-ng` when available and otherwise falls back to `-lespeak-ng`. It does not install packages and does not vendor eSpeak binaries.

The Linux installers treat offline native speech as optional. They try to install the appropriate eSpeak NG runtime/development packages and build or probe the bridge, then report speech availability without aborting the whole Nodevision installation when optional speech setup fails.

## Events

Providers report through normalized Nodevision events:

```text
speech.started
speech.boundary
speech.paused
speech.resumed
speech.finished
speech.cancelled
speech.error
```

Events include `provider` and `utteranceId` where practical. `SpeechService` ignores stale provider events whose utterance ID no longer matches the active utterance, protecting sequential speech, cancellation, and Session restart paths.

Boundary payloads use JavaScript UTF-16 code-unit offsets, matching ordinary JavaScript string indexing and browser event conventions. `charIndex` is not fabricated. Raw eSpeak fields are preserved as diagnostics:

```text
nativeTextPosition
nativeTextLength
audioPositionMs
nativeUniqueIdentifier
nativeWordNumber
positionSource
```

`EspeakBoundaryMapper.mjs` maps native positions back to `SpeechTextSegments.mjs` tokens. It tries documented character positions first and can also test UTF-8 byte and Unicode code-point interpretations. If a native position cannot be aligned to a source token, the boundary remains `position-unknown` rather than pretending to know the source index.

## Capabilities

Provider capabilities are internal metadata. Current expected values are:

```text
espeak-native: speech=true, cancel=true, pause=false, resume=false, rate=true, wordBoundary=true, charIndex=true, audioPosition=true, offline=true
linux-native:  speech=true, cancel=true, pause=false, resume=false, rate=true, wordBoundary=false, charIndex=false, audioPosition=false, offline=true
browser:       depends on browser implementation and loaded voices
```

Pause/resume are false for the native eSpeak bridge until a deterministic library-supported behavior is verified. Do not fake pause by restarting from an estimated word.

## Cancellation

Session cleanup calls `SpeechService.cancelActive("session-cleanup")`. The service emits `speech.cancelled`, stops the provider, clears active state, and unregisters cleanup. The server kills the fixed native bridge process for the active utterance. Late events from the old utterance ID are ignored by `SpeechService`.

## Security Boundary

Sessions cannot select arbitrary executable paths, dynamic library paths, or shell commands. Browser code talks only to authenticated `/api/speech/*` routes. The server starts fixed Nodevision-owned or fixed PATH-discovered speech providers with `shell: false`. Utterance text is sent as stdin data, not command-line syntax.

## Testing Native Synchronization

After installing the eSpeak NG development package and building the bridge, use the speech provider diagnostics or a small Session that speaks:

```text
One two three four five.
Hello, world. This is Nodevision.
First line.\nSecond line.
Ἐν ἀρχῇ ἦν ὁ λόγος.
```

For acceptance, verify actual `speech.boundary` events from `espeak-native` include source-mapped `charIndex`, `charLength`, `word`, and provider `audioPositionMs`, and that the displayed current word corresponds to audible progression. Mock tests validate protocol and mapping, but they are not a substitute for live bridge evidence.

## Native Synchronization Evidence

On Fedora 44 with eSpeak NG 1.52.0, the bridge links against `/lib64/libespeak-ng.so.1` and reports `sampleRate=22050`. For `One two three four five.`, three real runs produced stable native word positions `1, 5, 9, 15, 20`, lengths `3, 3, 5, 4, 4`, and audio positions `0, 226, 443, 669, 907` ms. Nodevision maps those to UTF-16 `charIndex` values `0, 4, 8, 14, 19` using the `espeak-character-1-based` interpretation.

Punctuation and newlines also map to the original source string. `Hello, world. This is Nodevision.` maps to `Hello@0`, `world@7`, `This@14`, `is@19`, `Nodevision@22`. `First line.\nSecond line.` maps to `First@0`, `line@6`, `Second@12`, `line@19`.

The installed `speak_lib.h` describes `text_position` as the number of characters from the start of the text, `length` as word length in characters, and `audio_position` as milliseconds within generated speech output. Runtime timestamping showed English boundary callbacks arriving close to the corresponding audio positions instead of arriving in one early burst.

Greek text requires an appropriate eSpeak voice for reliable word events. With `--voice el`, `Ἐν ἀρχῇ ἦν ὁ λόγος.` maps cleanly to `Ἐν@0`, `ἀρχῇ@3`, `ἦν@8`, `ὁ@11`, `λόγος@13`. With the default voice, eSpeak NG emitted repeated native word events for `ἀρχῇ`; the bridge now selects eSpeak voice `el` when Greek code points are present and no explicit voice was requested.

## Packaging Notes

Source/development installs may build `ApplicationSystem/native/speech/build/nodevision-espeak-bridge` locally from eSpeak NG headers. Release bundles should preferably ship a compatible prebuilt bridge for each supported Linux architecture so ordinary users only need the eSpeak NG runtime library. The bridge and eSpeak NG dependency remain open source and transparent; do not hide or replace them with a cloud speech service.

This repository is normally installed as a host Linux application. When running inside a Flatpak/container, host `espeak-ng` binaries and libraries may not be visible inside the sandbox. Synchronization-capable speech requires the Nodevision bridge process to execute in an environment where `libespeak-ng` is loadable; `flatpak-spawn --host espeak-ng` is only a speech-only CLI fallback and cannot provide word callbacks.
