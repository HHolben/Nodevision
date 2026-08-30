<!-- Nodevision/ApplicationSystem/installer/README.md -->
<!-- This file documents how to run the Nodevision Linux installer and how to build a compatible bundle so that releases can be distributed consistently. -->

# Nodevision Installer (Linux)

This folder contains a Linux installer script that:

- Downloads a Nodevision Linux bundle (a `.tar.gz`)
- Installs it to a chosen directory (default: `~/Nodevision`)
- Optionally creates a `Nodevision.desktop` launcher based on your selections

## Quick start

```sh
bash ApplicationSystem/installer/install-nodevision-linux.sh
```

## Non-interactive example

```sh
bash ApplicationSystem/installer/install-nodevision-linux.sh \
  --non-interactive \
  --install-dir "$HOME/Nodevision" \
  --desktop \
  --desktop-path "$HOME/.local/share/applications/Nodevision.desktop"
```

## Bundle format expected by the installer

The downloaded tarball must contain (at its root, or inside a single top-level directory):

- `nodevision-linux`
- `ApplicationSystem/`
- optionally `xdg-open`

The `.desktop` file defaults to using a wrapper script at `~/.local/bin/nodevision` which sets `NODEVISION_ROOT` and launches the installed binary.

## Creating a bundle (for maintainers)

From the repo root:

```sh
bash ApplicationSystem/scripts/build-linux-bundle.sh
```

This produces `dist/nodevision-linux-x64.tar.gz`, which matches the installer's default expected asset name.

## SCAD STL Export

SCAD preview and STL export use the OpenSCAD command-line renderer. Install `openscad` with your system package manager, or set `NODEVISION_OPENSCAD_BIN` to the full executable path before launching Nodevision. If Nodevision runs inside Flatpak, install OpenSCAD on the host system; Fedora users can run `sudo dnf install openscad`, and Nodevision will use `flatpak-spawn --host openscad` when available.

## Offline Native Speech

The installer tries to set up Nodevision offline native speech after application files are installed. If a compatible prebuilt bridge is already present, it installs or verifies only the eSpeak NG runtime package. If no bridge is present, it tries to install source-build dependencies and runs `ApplicationSystem/native/speech/build-espeak-bridge.sh`.

Package plan:

```text
Fedora runtime:        espeak-ng
Fedora source build:   espeak-ng espeak-ng-devel gcc-c++ make pkgconf-pkg-config
Debian/Ubuntu runtime: espeak-ng
Debian/Ubuntu build:   espeak-ng libespeak-ng-dev g++ make pkg-config
```

Offline speech is optional. If dependency installation, bridge compilation, or `--probe` verification fails, the installer reports native speech as unavailable and still completes the Nodevision installation. Use `--skip-speech` to skip this capability setup or `--skip-speech-deps` to avoid package installation while still probing/building when possible.

Release bundles should preferably include a prebuilt `ApplicationSystem/native/speech/build/nodevision-espeak-bridge` for the target Linux architecture so ordinary users need only the eSpeak NG runtime library. Source/development installs can build the bridge locally from eSpeak NG headers.

## Offline Dictation

The Linux installer prepares `UserData/Speech/Models` and reports whether `whisper-cli` is visible on `PATH`. It does not clone whisper.cpp or download model files.

For local dictation, install or build whisper.cpp separately, then place a GGML model at `UserData/Speech/Models/ggml-base.en.bin` or configure another executable/model path in Settings -> Dictation Settings. Browser SpeechRecognition remains an explicit fallback because some browser implementations use external recognition services.
