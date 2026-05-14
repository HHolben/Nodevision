#!/usr/bin/env bash
set -euo pipefail

DEFAULT_PREFIX="$HOME/.local/share/nodevision"
PREFIX="$DEFAULT_PREFIX"
DRY_RUN="false"
PURGE_USER_DATA="false"

readonly USER_DATA_DIRS=(
  Notebook
  UserData
  UserSettings
  ServerData
  ServerSettings
)

usage() {
  cat <<'EOF'
Nodevision Ubuntu Uninstaller

Usage:
  bash Installers/Linux/uninstall-nodevision-ubuntu.sh [options]

Options:
  --help               Show this help message
  --dry-run            Print actions without making changes
  --prefix PATH        Install location (default: ~/.local/share/nodevision)
  --purge-user-data    Also delete Notebook/UserData/UserSettings/ServerData/ServerSettings

Notes:
  - By default, user data directories are preserved.
  - You will be asked before deleting installed app files.
EOF
}

say() {
  printf '[nodevision-uninstall] %s\n' "$*"
}

warn() {
  printf '[nodevision-uninstall] WARNING: %s\n' "$*" >&2
}

die() {
  printf '[nodevision-uninstall] ERROR: %s\n' "$*" >&2
  exit 1
}

run_cmd() {
  if [[ "$DRY_RUN" == "true" ]]; then
    printf '[dry-run] '
    printf '%q ' "$@"
    printf '\n'
    return 0
  fi
  "$@"
}

normalize_path() {
  local raw="$1"
  local expanded="$raw"
  case "$expanded" in
    "~")
      expanded="$HOME"
      ;;
    "~/"*)
      expanded="$HOME/${expanded#~/}"
      ;;
  esac

  if [[ "$expanded" != /* ]]; then
    expanded="$PWD/$expanded"
  fi

  if command -v realpath >/dev/null 2>&1; then
    realpath -m "$expanded"
  else
    printf '%s\n' "$expanded"
  fi
}

remove_file_if_present() {
  local target="$1"
  if [[ -e "$target" ]]; then
    run_cmd rm -f "$target"
    say "Removed: $target"
  else
    say "Not present, skipped: $target"
  fi
}

confirm_delete_install_dir() {
  if [[ "$DRY_RUN" == "true" ]]; then
    say "[dry-run] Would prompt before deleting app files in: $INSTALL_DIR"
    return 1
  fi

  local response=""
  printf 'Delete installed app files in "%s"? [y/N]: ' "$INSTALL_DIR"
  read -r response
  case "$response" in
    y|Y|yes|YES)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

remove_install_dir_preserving_user_data() {
  local entry=""
  shopt -s dotglob nullglob
  for entry in "$INSTALL_DIR"/*; do
    local base
    base="$(basename "$entry")"
    case "$base" in
      Notebook|UserData|UserSettings|ServerData|ServerSettings)
        say "Preserving user data directory: $entry"
        continue
        ;;
    esac
    run_cmd rm -rf "$entry"
  done
  shopt -u dotglob nullglob
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --help)
      usage
      exit 0
      ;;
    --dry-run)
      DRY_RUN="true"
      shift
      ;;
    --prefix)
      [[ $# -ge 2 ]] || die "--prefix requires a path argument."
      PREFIX="$2"
      shift 2
      ;;
    --purge-user-data)
      PURGE_USER_DATA="true"
      shift
      ;;
    *)
      die "Unknown option: $1 (use --help)"
      ;;
  esac
done

if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
  die "Do not run this uninstaller as root or with sudo."
fi

INSTALL_DIR="$(normalize_path "$PREFIX")"
LAUNCHER_PATH="$HOME/.local/bin/nodevision"
DESKTOP_PATH="$HOME/.local/share/applications/nodevision.desktop"
SERVICE_PATH="$HOME/.config/systemd/user/nodevision.service"

say "Nodevision uninstaller starting."
say "Install directory: $INSTALL_DIR"
if [[ "$DRY_RUN" == "true" ]]; then
  say "Dry run enabled: no changes will be made."
fi

if command -v systemctl >/dev/null 2>&1; then
  if [[ "$DRY_RUN" == "true" ]]; then
    run_cmd systemctl --user disable --now nodevision.service
  else
    if ! systemctl --user disable --now nodevision.service >/dev/null 2>&1; then
      say "Systemd service not running or already disabled."
    fi
  fi
fi

if [[ -e "$SERVICE_PATH" ]]; then
  remove_file_if_present "$SERVICE_PATH"
  if command -v systemctl >/dev/null 2>&1; then
    if ! run_cmd systemctl --user daemon-reload; then
      warn "Could not reload systemd user daemon."
    fi
  fi
else
  say "No user service file to remove at: $SERVICE_PATH"
fi

remove_file_if_present "$LAUNCHER_PATH"
remove_file_if_present "$DESKTOP_PATH"

if command -v update-desktop-database >/dev/null 2>&1; then
  if ! run_cmd update-desktop-database "$HOME/.local/share/applications"; then
    warn "update-desktop-database returned a non-zero status."
  fi
fi

if [[ ! -d "$INSTALL_DIR" ]]; then
  say "Install directory not present, nothing else to remove."
  exit 0
fi

if confirm_delete_install_dir; then
  if [[ "$PURGE_USER_DATA" == "true" ]]; then
    run_cmd rm -rf "$INSTALL_DIR"
    say "Removed install directory including user data: $INSTALL_DIR"
  else
    remove_install_dir_preserving_user_data
    say "Removed app files and preserved user data directories in: $INSTALL_DIR"
    say "Preserved directories:"
    dir_name=""
    for dir_name in "${USER_DATA_DIRS[@]}"; do
      if [[ -e "$INSTALL_DIR/$dir_name" ]]; then
        say "  - $INSTALL_DIR/$dir_name"
      fi
    done
  fi
else
  say "Skipped app directory deletion."
fi

say "Uninstall complete."
