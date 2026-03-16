#!/usr/bin/env bash
# Nodevision/ApplicationSystem/installer/install-nodevision-linux.sh
# This file downloads and installs a Nodevision Linux bundle and optionally writes a desktop entry so that end users can launch Nodevision from their system menu.
set -euo pipefail

APP_NAME_DEFAULT="Nodevision"
COMMENT_DEFAULT="Launch Nodevision Notebook Environment"
ICON_DEFAULT="utilities-terminal"
CATEGORIES_DEFAULT="Development;"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="${SCRIPT_DIR}/install-nodevision-linux"

# shellcheck source=/dev/null
source "${LIB_DIR}/usage.sh"
# shellcheck source=/dev/null
source "${LIB_DIR}/common.sh"
# shellcheck source=/dev/null
source "${LIB_DIR}/download.sh"
# shellcheck source=/dev/null
source "${LIB_DIR}/desktop.sh"
# shellcheck source=/dev/null
source "${LIB_DIR}/install.sh"

nv_require_linux
nv_have tar || nv_die "Need 'tar' to extract the bundle."

INSTALL_DIR="${HOME}/Nodevision"
URL=""
REPO="HHolben/Nodevision"
FORCE="false"
NON_INTERACTIVE="false"

WANT_DESKTOP="" # unset -> ask in interactive mode
DESKTOP_PATH="${HOME}/.local/share/applications/Nodevision.desktop"
WRAPPER_PATH="${HOME}/.local/bin/nodevision"
DESKTOP_EXEC="" # empty -> wrapper by default
DESKTOP_NAME="${APP_NAME_DEFAULT}"
DESKTOP_COMMENT="${COMMENT_DEFAULT}"
DESKTOP_ICON="${ICON_DEFAULT}"
DESKTOP_TERMINAL="false"
DESKTOP_CATEGORIES="${CATEGORIES_DEFAULT}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) nv_usage; exit 0 ;;
    --install-dir) INSTALL_DIR="$(nv_expand_path "${2-}")"; shift 2 ;;
    --url) URL="${2-}"; shift 2 ;;
    --repo) REPO="${2-}"; shift 2 ;;
    --force) FORCE="true"; shift ;;
    --non-interactive) NON_INTERACTIVE="true"; shift ;;
    --desktop) WANT_DESKTOP="true"; shift ;;
    --no-desktop) WANT_DESKTOP="false"; shift ;;
    --desktop-path) DESKTOP_PATH="$(nv_expand_path "${2-}")"; shift 2 ;;
    --exec) DESKTOP_EXEC="$(nv_expand_path "${2-}")"; shift 2 ;;
    --name) DESKTOP_NAME="${2-}"; shift 2 ;;
    --comment) DESKTOP_COMMENT="${2-}"; shift 2 ;;
    --icon) DESKTOP_ICON="${2-}"; shift 2 ;;
    --terminal) DESKTOP_TERMINAL="${2-}"; shift 2 ;;
    --categories) DESKTOP_CATEGORIES="${2-}"; shift 2 ;;
    *)
      nv_die "Unknown option: $1 (use --help)"
      ;;
  esac
done

INSTALL_DIR="$(nv_expand_path "$INSTALL_DIR")"
DESKTOP_PATH="$(nv_expand_path "$DESKTOP_PATH")"
WRAPPER_PATH="$(nv_expand_path "$WRAPPER_PATH")"

if [[ "$NON_INTERACTIVE" != "true" ]]; then
  nv_say "Nodevision installer (Linux)"
  INSTALL_DIR="$(nv_prompt "Install directory" "$INSTALL_DIR")"
  INSTALL_DIR="$(nv_expand_path "$INSTALL_DIR")"

  if [[ -z "$URL" ]]; then
    if [[ ! "$REPO" =~ ^[^/]+/[^/]+$ ]]; then
      nv_die "Invalid --repo format (expected OWNER/REPO): $REPO"
    fi
    local_asset="$(nv_detect_default_asset)"
    default_url="https://github.com/${REPO}/releases/latest/download/${local_asset}"
    URL="$(nv_prompt "Download URL" "$default_url")"
  fi

  if [[ -z "$WANT_DESKTOP" ]]; then
    WANT_DESKTOP="$(nv_prompt_bool "Create a desktop launcher (.desktop)?" "true")"
  fi
else
  if [[ -z "$URL" ]]; then
    local_asset="$(nv_detect_default_asset)"
    if [[ ! "$REPO" =~ ^[^/]+/[^/]+$ ]]; then
      nv_die "Invalid --repo format (expected OWNER/REPO): $REPO"
    fi
    URL="https://github.com/${REPO}/releases/latest/download/${local_asset}"
  fi
  if [[ -z "$WANT_DESKTOP" ]]; then
    WANT_DESKTOP="false"
  fi
fi

case "$DESKTOP_TERMINAL" in
  true|false) ;;
  *) nv_die "--terminal must be 'true' or 'false' (got: $DESKTOP_TERMINAL)" ;;
esac

tmp_dir="$(mktemp -d)"
cleanup() { rm -rf "$tmp_dir"; }
trap cleanup EXIT

bundle_path="${tmp_dir}/nodevision-bundle"
nv_say "Downloading bundle:"
nv_say "  $URL"
nv_download_file "$URL" "$bundle_path"

extract_dir="${tmp_dir}/extract"
nv_is_tar_url "$URL" || nv_die "Unsupported bundle URL (expected .tar.gz/.tgz/.tar): $URL"
nv_extract_tarball "$URL" "$bundle_path" "$extract_dir"
bundle_root="$(nv_find_bundle_root "$extract_dir")"

mkdir -p "$INSTALL_DIR"

nv_backup_existing_appsystem "$INSTALL_DIR" "$FORCE"

nv_say "Installing Nodevision to:"
nv_say "  $INSTALL_DIR"

nv_install_from_bundle_root "$bundle_root" "$INSTALL_DIR"

# Create wrapper script (convenient stable Exec= target)
nv_write_wrapper "$WRAPPER_PATH" "$INSTALL_DIR"

nv_say "Created wrapper:"
nv_say "  $WRAPPER_PATH"

if [[ "$WANT_DESKTOP" == "true" ]]; then
  if [[ "$NON_INTERACTIVE" != "true" ]]; then
    DESKTOP_PATH="$(nv_prompt "Desktop entry path" "$DESKTOP_PATH")"
    DESKTOP_PATH="$(nv_expand_path "$DESKTOP_PATH")"

    default_exec="$WRAPPER_PATH"
    if [[ -n "$DESKTOP_EXEC" ]]; then
      default_exec="$DESKTOP_EXEC"
    fi
    DESKTOP_EXEC="$(nv_prompt "Exec path for launcher" "$default_exec")"
    DESKTOP_EXEC="$(nv_expand_path "$DESKTOP_EXEC")"

    DESKTOP_NAME="$(nv_prompt "Launcher Name=" "$DESKTOP_NAME")"
    DESKTOP_COMMENT="$(nv_prompt "Launcher Comment=" "$DESKTOP_COMMENT")"
    DESKTOP_ICON="$(nv_prompt "Launcher Icon=" "$DESKTOP_ICON")"
    DESKTOP_TERMINAL="$(nv_prompt_bool "Launch in terminal?" "$DESKTOP_TERMINAL")"
    DESKTOP_CATEGORIES="$(nv_prompt "Launcher Categories=" "$DESKTOP_CATEGORIES")"
  else
    if [[ -z "$DESKTOP_EXEC" ]]; then
      DESKTOP_EXEC="$WRAPPER_PATH"
    fi
  fi

  nv_write_desktop_entry \
    "$DESKTOP_PATH" \
    "$DESKTOP_EXEC" \
    "$DESKTOP_NAME" \
    "$DESKTOP_COMMENT" \
    "$DESKTOP_ICON" \
    "$DESKTOP_TERMINAL" \
    "$DESKTOP_CATEGORIES"

  nv_say "Wrote desktop entry:"
  nv_say "  $DESKTOP_PATH"
fi

nv_say "Done."
nv_say "Run Nodevision:"
nv_say "  $WRAPPER_PATH"
