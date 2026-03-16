#!/usr/bin/env bash
# Nodevision/ApplicationSystem/scripts/build-linux-bundle.sh
# This file creates a Linux release tarball that bundles Nodevision runtime assets so that the installer can deploy a self-contained environment.
set -euo pipefail

usage() {
  cat <<'EOF'
Build a Linux release bundle for the Nodevision installer.

Usage:
  ApplicationSystem/scripts/build-linux-bundle.sh [--out PATH]

Default output:
  dist/nodevision-linux-x64.tar.gz

Bundle contents (relative to repo root):
  - nodevision-linux
  - ApplicationSystem/
  - optional xdg-open

Notes:
  - This script does not run npm installs; it bundles whatever is present on disk.
  - The runtime expects ApplicationSystem/core/runtime.js and related files to exist in the install directory.
EOF
}

OUT="dist/nodevision-linux-x64.tar.gz"
while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --out) OUT="${2-}"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

[[ -f "nodevision-linux" ]] || { echo "Missing nodevision-linux in repo root." >&2; exit 1; }
[[ -d "ApplicationSystem" ]] || { echo "Missing ApplicationSystem/ in repo root." >&2; exit 1; }

mkdir -p "$(dirname "$OUT")"

EXCLUDES=(
  --exclude='./ApplicationSystem/temp'
  --exclude='./ApplicationSystem/build'
  --exclude='./ApplicationSystem/bin'
  --exclude='./ApplicationSystem/.qmake.stash'
  --exclude='./ApplicationSystem/*.o'
  --exclude='./ApplicationSystem/*.a'
)

FILES=( "nodevision-linux" "ApplicationSystem" )
if [[ -f "xdg-open" ]]; then
  FILES+=( "xdg-open" )
fi

echo "Creating bundle:"
echo "  $OUT"
tar -czf "$OUT" "${EXCLUDES[@]}" "${FILES[@]}"
echo "Done."
