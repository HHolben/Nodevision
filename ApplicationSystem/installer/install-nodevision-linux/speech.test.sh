#!/usr/bin/env bash
# Nodevision/ApplicationSystem/installer/install-nodevision-linux/speech.test.sh
# This test verifies offline speech installer package planning without modifying the host package database.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
nv_say() { :; }
nv_warn() { :; }

# shellcheck source=/dev/null
source "${SCRIPT_DIR}/speech.sh"

assert_eq() {
  local actual="$1"
  local expected="$2"
  local label="$3"
  if [[ "$actual" != "$expected" ]]; then
    printf 'FAIL %s\nexpected: %s\nactual:   %s\n' "$label" "$expected" "$actual" >&2
    exit 1
  fi
}

assert_eq "$(nv_speech_family_from_ids fedora "")" "fedora" "fedora family"
assert_eq "$(nv_speech_family_from_ids ubuntu debian)" "debian" "ubuntu family"
assert_eq "$(nv_speech_family_from_ids linux "rhel fedora")" "fedora" "id_like family"
assert_eq "$(nv_speech_packages_for_family fedora runtime)" "espeak-ng" "fedora runtime packages"
assert_eq "$(nv_speech_packages_for_family fedora build)" "espeak-ng espeak-ng-devel gcc-c++ make pkgconf-pkg-config" "fedora build packages"
assert_eq "$(nv_speech_packages_for_family debian runtime)" "espeak-ng" "debian runtime packages"
assert_eq "$(nv_speech_packages_for_family debian build)" "espeak-ng libespeak-ng-dev g++ make pkg-config" "debian build packages"
assert_eq "$(nv_speech_bridge_path /tmp/nodevision-test)" "/tmp/nodevision-test/ApplicationSystem/native/speech/build/nodevision-espeak-bridge" "bridge path"

printf 'speech installer tests passed.\n'
