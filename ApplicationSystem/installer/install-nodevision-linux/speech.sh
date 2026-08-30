# Nodevision/ApplicationSystem/installer/install-nodevision-linux/speech.sh
# This file adds optional offline speech dependency setup to the Linux installer while keeping native bridge and dictation setup non-fatal.

nv_speech_family_from_ids() {
  local id="$1"
  local like="$2"
  local combined=" $id $like "
  case "$combined" in
    *" fedora "*|*" rhel "*|*" centos "*) printf 'fedora\n' ;;
    *" debian "*|*" ubuntu "*) printf 'debian\n' ;;
    *) printf 'unknown\n' ;;
  esac
}

nv_speech_detect_family() {
  local id=""
  local like=""
  if [[ -r /etc/os-release ]]; then
    # shellcheck source=/dev/null
    . /etc/os-release
    id="${ID-}"
    like="${ID_LIKE-}"
  fi
  nv_speech_family_from_ids "$id" "$like"
}

nv_speech_packages_for_family() {
  local family="$1"
  local mode="${2:-build}"
  case "$family:$mode" in
    fedora:runtime) printf 'espeak-ng\n' ;;
    fedora:build) printf 'espeak-ng espeak-ng-devel gcc-c++ make pkgconf-pkg-config\n' ;;
    debian:runtime) printf 'espeak-ng\n' ;;
    debian:build) printf 'espeak-ng libespeak-ng-dev g++ make pkg-config\n' ;;
    *) return 1 ;;
  esac
}

nv_speech_bridge_path() {
  printf '%s\n' "$1/ApplicationSystem/native/speech/build/nodevision-espeak-bridge"
}

nv_speech_build_script() {
  printf '%s\n' "$1/ApplicationSystem/native/speech/build-espeak-bridge.sh"
}

nv_speech_install_packages() {
  local family="$1"
  shift
  [[ $# -gt 0 ]] || return 0
  if [[ "${DRY_RUN:-false}" == "true" ]]; then
    case "$family" in
      fedora) nv_say "[dry-run] sudo dnf install -y $*" ;;
      debian) nv_say "[dry-run] sudo apt-get update"; nv_say "[dry-run] sudo apt-get install -y $*" ;;
    esac
    return 0
  fi
  command -v sudo >/dev/null 2>&1 || return 1
  case "$family" in
    fedora)
      if command -v dnf >/dev/null 2>&1; then sudo dnf install -y "$@"
      elif command -v dnf5 >/dev/null 2>&1; then sudo dnf5 install -y "$@"
      else return 1
      fi
      ;;
    debian)
      command -v apt-get >/dev/null 2>&1 || return 1
      sudo apt-get update && sudo apt-get install -y "$@"
      ;;
    *) return 1 ;;
  esac
}

nv_speech_probe_bridge() {
  local bridge="$1"
  [[ -x "$bridge" ]] || return 1
  "$bridge" --probe >/dev/null 2>&1
}

nv_speech_build_bridge() {
  local install_dir="$1"
  local script
  script="$(nv_speech_build_script "$install_dir")"
  [[ -f "$script" ]] || return 1
  if [[ "${DRY_RUN:-false}" == "true" ]]; then
    nv_say "[dry-run] (cd \"$install_dir\" && ApplicationSystem/native/speech/build-espeak-bridge.sh)"
    return 0
  fi
  (cd "$install_dir" && ApplicationSystem/native/speech/build-espeak-bridge.sh >/dev/null)
}

nv_speech_whisper_model_dir() {
  printf '%s\n' "$1/UserData/Speech/Models"
}

nv_speech_prepare_whisper() {
  local install_dir="$1"
  local model_dir
  model_dir="$(nv_speech_whisper_model_dir "$install_dir")"
  if [[ "${DRY_RUN:-false}" == "true" ]]; then
    nv_say "[dry-run] mkdir -p \"$model_dir\""
  else
    mkdir -p "$model_dir" || true
  fi
  if command -v whisper-cli >/dev/null 2>&1; then
    nv_say "  whisper.cpp CLI available: $(command -v whisper-cli)"
  else
    nv_warn "Offline dictation needs whisper-cli on PATH or a configured executable path."
  fi
  nv_say "  Whisper model directory: $model_dir"
}

nv_setup_speech() {
  local install_dir="$1"
  local install_deps="${2:-true}"
  local bridge
  local family
  local mode
  local packages
  bridge="$(nv_speech_bridge_path "$install_dir")"
  family="$(nv_speech_detect_family)"
  mode="build"
  [[ -x "$bridge" ]] && mode="runtime"

  nv_say "Offline speech setup:"
  if [[ "$install_deps" == "true" ]]; then
    if packages="$(nv_speech_packages_for_family "$family" "$mode")"; then
      if nv_speech_install_packages "$family" $packages; then
        nv_say "  Dependencies checked for: $family ($mode)"
      else
        nv_warn "Offline speech dependencies could not be installed automatically."
      fi
    else
      nv_warn "Unsupported distribution family for automatic speech dependency installation."
    fi
  else
    nv_say "  Dependency installation skipped."
  fi

  if nv_speech_probe_bridge "$bridge"; then
    nv_say "  Native speech bridge available: $bridge"
    nv_speech_prepare_whisper "$install_dir"
    return 0
  fi

  if nv_speech_build_bridge "$install_dir" && nv_speech_probe_bridge "$bridge"; then
    nv_say "  Native speech bridge built: $bridge"
    nv_speech_prepare_whisper "$install_dir"
    return 0
  fi

  nv_warn "Offline native speech unavailable: eSpeak NG bridge could not be built or probed."
  nv_speech_prepare_whisper "$install_dir"
  return 0
}
