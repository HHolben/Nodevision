#!/usr/bin/env sh
# Nodevision/ApplicationSystem/native/speech/build-espeak-bridge.sh
# This script builds Nodevision's optional eSpeak NG companion bridge when the local Linux system provides libespeak-ng development files.

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
BUILD_DIR="$SCRIPT_DIR/build"
OUT="$BUILD_DIR/nodevision-espeak-bridge"
SRC="$SCRIPT_DIR/espeak_bridge.cpp"

mkdir -p "$BUILD_DIR"

if pkg-config --exists espeak-ng; then
  CFLAGS=$(pkg-config --cflags espeak-ng)
  LIBS=$(pkg-config --libs espeak-ng)
else
  if [ ! -f /usr/include/espeak-ng/speak_lib.h ] && [ ! -f /usr/include/espeak/speak_lib.h ]; then
    printf "%s\n" "Missing eSpeak NG development headers. Install espeak-ng-devel or libespeak-ng-dev." >&2
    exit 1
  fi
  CFLAGS=""
  LIBS="-lespeak-ng"
fi

g++ -std=c++17 -O2 -Wall -Wextra $CFLAGS "$SRC" -o "$OUT" $LIBS
printf '%s\n' "$OUT"
