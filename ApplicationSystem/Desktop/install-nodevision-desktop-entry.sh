#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${HOME}/.local/share/applications"
mkdir -p "${APP_DIR}"
chmod +x "${SCRIPT_DIR}/nodevision-open.sh"
cp "${SCRIPT_DIR}/nodevision.desktop" "${APP_DIR}/nodevision.desktop"
chmod +x "${APP_DIR}/nodevision.desktop"
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "${APP_DIR}"
fi
cat <<'MSG'
Installed Nodevision desktop entry.

To offer Nodevision as an additional handler without making it the default, use your file manager's Open With dialog.
If you later want to set defaults manually, examples include:
  xdg-mime default nodevision.desktop text/html
  xdg-mime default nodevision.desktop application/json
MSG
