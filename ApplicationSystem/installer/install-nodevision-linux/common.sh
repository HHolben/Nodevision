# Nodevision/ApplicationSystem/installer/install-nodevision-linux/common.sh
# This file defines shared shell helpers for the Nodevision Linux installer so that prompts, validation, and path utilities are consistent across installer steps.

nv_say() { printf '%s\n' "$*"; }
nv_warn() { printf 'Warning: %s\n' "$*" >&2; }
nv_die() { printf 'Error: %s\n' "$*" >&2; exit 1; }

nv_have() { command -v "$1" >/dev/null 2>&1; }

nv_require_linux() {
  local os
  os="$(uname -s 2>/dev/null || echo unknown)"
  [[ "$os" == "Linux" ]] || nv_die "This installer targets Linux. Detected: $os"
}

nv_timestamp() { date -u +%Y%m%dT%H%M%SZ; }

nv_expand_path() {
  local p="$1"
  if [[ "$p" == "~/"* ]]; then
    printf '%s\n' "${HOME}/${p#~/}"
  elif [[ "$p" == "~" ]]; then
    printf '%s\n' "${HOME}"
  else
    printf '%s\n' "$p"
  fi
}

nv_prompt() {
  local question="$1"
  local default="${2-}"
  local answer=""
  if [[ -n "$default" ]]; then
    read -r -p "$question [$default]: " answer || true
    printf '%s\n' "${answer:-$default}"
  else
    read -r -p "$question: " answer || true
    printf '%s\n' "$answer"
  fi
}

nv_prompt_bool() {
  local question="$1"
  local default_bool="$2" # "true" or "false"
  local default_hint="y/N"
  [[ "$default_bool" == "true" ]] && default_hint="Y/n"
  local answer=""
  read -r -p "$question ($default_hint): " answer || true
  answer="$(printf '%s' "$answer" | tr '[:upper:]' '[:lower:]')"
  if [[ -z "$answer" ]]; then
    printf '%s\n' "$default_bool"
    return
  fi
  case "$answer" in
    y|yes|true|1) printf 'true\n' ;;
    n|no|false|0) printf 'false\n' ;;
    *) nv_warn "Unrecognized answer '$answer' (using default: $default_bool)"; printf '%s\n' "$default_bool" ;;
  esac
}

