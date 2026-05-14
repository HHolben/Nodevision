#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_PREFIX="$HOME/.local/share/nodevision"
PREFIX="$DEFAULT_PREFIX"
DRY_RUN="false"
SKIP_DEPS="false"
INSTALL_SERVICE="false"
ENABLE_SERVICE="false"

readonly APT_PACKAGES=(
  nodejs
  npm
  php-cli
  git
  curl
  build-essential
  python3
  ca-certificates
)

readonly USER_DATA_DIRS=(
  Notebook
  UserData
  UserSettings
  ServerData
  ServerSettings
)

usage() {
  cat <<'EOF'
Nodevision Ubuntu Installer

Usage:
  bash Installers/Linux/install-nodevision-ubuntu.sh [options]

Options:
  --help              Show this help message
  --dry-run           Print actions without making changes
  --prefix PATH       Install location (default: ~/.local/share/nodevision)
  --skip-deps         Skip apt dependency installation
  --install-service   Create a systemd user service file
  --enable-service    Create, enable, and start the systemd user service

Notes:
  - Do not run this installer with sudo.
  - sudo is used only for apt commands when dependencies are installed.
EOF
}

say() {
  printf '[nodevision-installer] %s\n' "$*"
}

warn() {
  printf '[nodevision-installer] WARNING: %s\n' "$*" >&2
}

die() {
  printf '[nodevision-installer] ERROR: %s\n' "$*" >&2
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

run_in_dir() {
  local target_dir="$1"
  shift
  if [[ "$DRY_RUN" == "true" ]]; then
    printf '[dry-run] (cd %q && ' "$target_dir"
    printf '%q ' "$@"
    printf ')\n'
    return 0
  fi
  (
    cd "$target_dir"
    "$@"
  )
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

is_nodevision_repo() {
  local candidate="$1"
  [[ -f "$candidate/package.json" && -d "$candidate/ApplicationSystem" ]]
}

find_repo_root_from() {
  local current="$1"
  while true; do
    if is_nodevision_repo "$current"; then
      printf '%s\n' "$current"
      return 0
    fi
    if [[ "$current" == "/" ]]; then
      return 1
    fi
    current="$(dirname "$current")"
  done
}

verify_dependencies() {
  local -a missing=()

  command -v node >/dev/null 2>&1 || missing+=("nodejs")
  command -v npm >/dev/null 2>&1 || missing+=("npm")
  command -v php >/dev/null 2>&1 || missing+=("php-cli")
  command -v git >/dev/null 2>&1 || missing+=("git")
  command -v curl >/dev/null 2>&1 || missing+=("curl")
  command -v python3 >/dev/null 2>&1 || missing+=("python3")
  if ! command -v gcc >/dev/null 2>&1 || ! command -v make >/dev/null 2>&1; then
    missing+=("build-essential")
  fi
  if [[ ! -e /etc/ssl/certs/ca-certificates.crt ]]; then
    missing+=("ca-certificates")
  fi

  if ((${#missing[@]} > 0)); then
    warn "Missing required dependencies: ${missing[*]}"
    if [[ "$DRY_RUN" == "true" ]]; then
      warn "Dependency verification warning is non-fatal in --dry-run mode."
      return 0
    fi
    return 1
  fi

  say "All required dependencies are available."
}

copy_project_tree() {
  local source_dir="$1"
  local install_dir="$2"
  local -a excludes=(
    --exclude=.git
    --exclude=.git/\*
    --exclude=node_modules
    --exclude=node_modules/\*
    --exclude=Logs
    --exclude=logs
    --exclude=\*.log
    --exclude=tmp
    --exclude=temp
    --exclude=\*.tmp
    --exclude=\*~
    --exclude=Notebook
    --exclude=UserData
    --exclude=UserSettings
    --exclude=ServerData
    --exclude=ServerSettings
  )

  if [[ "$DRY_RUN" == "true" ]]; then
    say "[dry-run] mkdir -p \"$install_dir\""
    say "[dry-run] copy Nodevision project from \"$source_dir\" to \"$install_dir\""
    say "[dry-run] excluded: .git, node_modules, logs, temp files, and user data folders"
    return 0
  fi

  mkdir -p "$install_dir"
  (
    cd "$source_dir"
    tar "${excludes[@]}" -cf - .
  ) | (
    cd "$install_dir"
    tar -xf -
  )
}

backup_user_data() {
  local install_dir="$1"
  local backup_root="$2"
  local found_existing="false"
  local rel

  for rel in "${USER_DATA_DIRS[@]}"; do
    if [[ -e "$install_dir/$rel" ]]; then
      found_existing="true"
      break
    fi
  done

  if [[ "$found_existing" != "true" ]]; then
    return 0
  fi

  say "Creating timestamped user-data backups in: $backup_root"

  if [[ "$DRY_RUN" != "true" ]]; then
    mkdir -p "$backup_root"
  else
    say "[dry-run] mkdir -p \"$backup_root\""
  fi

  for rel in "${USER_DATA_DIRS[@]}"; do
    if [[ -e "$install_dir/$rel" ]]; then
      local source_path="$install_dir/$rel"
      local backup_path="$backup_root/$rel"
      if [[ "$DRY_RUN" == "true" ]]; then
        say "[dry-run] cp -a \"$source_path\" \"$backup_path\""
      else
        mkdir -p "$(dirname "$backup_path")"
        cp -a "$source_path" "$backup_path"
      fi
    fi
  done
}

seed_user_data_on_fresh_install() {
  local source_dir="$1"
  local install_dir="$2"
  local rel

  for rel in "${USER_DATA_DIRS[@]}"; do
    if [[ -e "$install_dir/$rel" ]]; then
      say "Preserving existing user data: $rel"
      continue
    fi

    if [[ -e "$source_dir/$rel" ]]; then
      if [[ "$DRY_RUN" == "true" ]]; then
        say "[dry-run] cp -a \"$source_dir/$rel\" \"$install_dir/$rel\""
      else
        cp -a "$source_dir/$rel" "$install_dir/$rel"
      fi
      say "Seeded initial user data directory: $rel"
    fi
  done
}

write_launcher() {
  local install_dir="$1"
  local launcher_path="$2"

  if [[ "$DRY_RUN" != "true" ]]; then
    mkdir -p "$(dirname "$launcher_path")"
  else
    say "[dry-run] mkdir -p \"$(dirname "$launcher_path")\""
    say "[dry-run] write launcher \"$launcher_path\""
    return 0
  fi

  cat >"$launcher_path" <<EOF
#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="$install_dir"

if [[ ! -d "\$INSTALL_DIR" ]]; then
  echo "Nodevision install directory not found: \$INSTALL_DIR" >&2
  exit 1
fi

cd "\$INSTALL_DIR"

if command -v npm >/dev/null 2>&1 && command -v node >/dev/null 2>&1 && [[ -f package.json ]]; then
  if node -e "const fs=require('node:fs'); const p=JSON.parse(fs.readFileSync('package.json','utf8')); process.exit(p.scripts && p.scripts.start ? 0 : 1);" >/dev/null 2>&1; then
    exec npm start "\$@"
  fi
fi

if command -v node >/dev/null 2>&1 && [[ -f start-servers.js ]]; then
  exec node start-servers.js "\$@"
fi

if command -v node >/dev/null 2>&1 && [[ -f nodevision-cli.js ]]; then
  exec node nodevision-cli.js "\$@"
fi

if [[ -x ./nodevision-linux ]]; then
  exec ./nodevision-linux "\$@"
fi

echo "No start command found in \$INSTALL_DIR" >&2
exit 1
EOF

  chmod +x "$launcher_path"
}

write_desktop_file() {
  local desktop_path="$1"
  local icon_value="$2"

  if [[ "$DRY_RUN" != "true" ]]; then
    mkdir -p "$(dirname "$desktop_path")"
  else
    say "[dry-run] mkdir -p \"$(dirname "$desktop_path")\""
    say "[dry-run] write desktop entry \"$desktop_path\""
    return 0
  fi

  cat >"$desktop_path" <<EOF
[Desktop Entry]
Type=Application
Name=Nodevision
Comment=Nodevision Notebook Environment
Exec=nodevision
Icon=$icon_value
Terminal=false
Categories=Development;
EOF
}

write_systemd_user_service() {
  local service_path="$1"
  local install_dir="$2"

  if [[ "$DRY_RUN" != "true" ]]; then
    mkdir -p "$(dirname "$service_path")"
  else
    say "[dry-run] mkdir -p \"$(dirname "$service_path")\""
    say "[dry-run] write systemd user service \"$service_path\""
    return 0
  fi

  cat >"$service_path" <<EOF
[Unit]
Description=Nodevision
After=network.target

[Service]
Type=simple
WorkingDirectory=$install_dir
ExecStart=%h/.local/bin/nodevision
Restart=on-failure
RestartSec=2

[Install]
WantedBy=default.target
EOF
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
    --skip-deps)
      SKIP_DEPS="true"
      shift
      ;;
    --install-service)
      INSTALL_SERVICE="true"
      shift
      ;;
    --enable-service)
      INSTALL_SERVICE="true"
      ENABLE_SERVICE="true"
      shift
      ;;
    *)
      die "Unknown option: $1 (use --help)"
      ;;
  esac
done

if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
  die "Do not run this installer as root or with sudo."
fi

PREFIX="$(normalize_path "$PREFIX")"
INSTALL_DIR="$PREFIX"
LAUNCHER_PATH="$HOME/.local/bin/nodevision"
DESKTOP_PATH="$HOME/.local/share/applications/nodevision.desktop"
SERVICE_PATH="$HOME/.config/systemd/user/nodevision.service"
BACKUP_STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_ROOT="$INSTALL_DIR/.nodevision-userdata-backups/$BACKUP_STAMP"

say "Nodevision Ubuntu installer starting."
say "Install directory: $INSTALL_DIR"
if [[ "$DRY_RUN" == "true" ]]; then
  say "Dry run enabled: no changes will be made."
fi

SOURCE_REPO=""
if SOURCE_REPO="$(find_repo_root_from "$PWD")"; then
  :
else
  REPO_FROM_SCRIPT="$(normalize_path "$SCRIPT_DIR/../..")"
  if is_nodevision_repo "$REPO_FROM_SCRIPT"; then
    SOURCE_REPO="$REPO_FROM_SCRIPT"
  else
    die "Could not locate a Nodevision repository. Run from inside the Nodevision repo."
  fi
fi

say "Source repository: $SOURCE_REPO"

if [[ "$SKIP_DEPS" != "true" ]]; then
  command -v apt >/dev/null 2>&1 || die "apt not found. This installer targets Ubuntu-based systems."
  command -v sudo >/dev/null 2>&1 || die "sudo is required to install dependencies."

  say "Installing/refreshing dependencies with apt."
  run_cmd sudo apt update
  run_cmd sudo apt install -y "${APT_PACKAGES[@]}"
else
  say "--skip-deps set: skipping apt dependency installation."
fi

if ! verify_dependencies; then
  die "Dependency verification failed."
fi

if [[ "$SOURCE_REPO" == "$INSTALL_DIR" ]]; then
  warn "Install directory matches source repository; skipping project copy."
else
  backup_user_data "$INSTALL_DIR" "$BACKUP_ROOT"
  copy_project_tree "$SOURCE_REPO" "$INSTALL_DIR"
  seed_user_data_on_fresh_install "$SOURCE_REPO" "$INSTALL_DIR"
fi

if [[ "$DRY_RUN" == "true" ]]; then
  say "[dry-run] (cd \"$INSTALL_DIR\" && npm install)"
else
  say "Running npm install in: $INSTALL_DIR"
  run_in_dir "$INSTALL_DIR" npm install
fi

write_launcher "$INSTALL_DIR" "$LAUNCHER_PATH"
say "Launcher ready: $LAUNCHER_PATH"

if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
  warn "~/.local/bin is not in PATH. Add this to your shell profile:"
  warn "export PATH=\"\$HOME/.local/bin:\$PATH\""
fi

ICON_VALUE="application-x-executable"
if [[ -f "$INSTALL_DIR/ApplicationSystem/Favicon.png" ]]; then
  ICON_VALUE="$INSTALL_DIR/ApplicationSystem/Favicon.png"
fi

write_desktop_file "$DESKTOP_PATH" "$ICON_VALUE"
say "Desktop entry ready: $DESKTOP_PATH"

if command -v update-desktop-database >/dev/null 2>&1; then
  if ! run_cmd update-desktop-database "$HOME/.local/share/applications"; then
    warn "update-desktop-database returned a non-zero status."
  fi
else
  warn "update-desktop-database not found; skipping desktop database refresh."
fi

if [[ "$INSTALL_SERVICE" == "true" ]]; then
  write_systemd_user_service "$SERVICE_PATH" "$INSTALL_DIR"
  say "Systemd user service file ready: $SERVICE_PATH"

  if command -v systemctl >/dev/null 2>&1; then
    if ! run_cmd systemctl --user daemon-reload; then
      warn "Could not reload systemd user daemon."
    fi
    if [[ "$ENABLE_SERVICE" == "true" ]]; then
      if run_cmd systemctl --user enable --now nodevision.service; then
        say "Systemd user service enabled and started: nodevision.service"
      else
        warn "Failed to enable/start nodevision.service. You can retry manually."
      fi
    else
      say "Service file installed but not enabled."
      say "Enable later with: systemctl --user enable --now nodevision.service"
    fi
  else
    warn "systemctl is not available; service file was created but not loaded."
  fi
fi

say "Install complete."
say "Launch with: nodevision"
