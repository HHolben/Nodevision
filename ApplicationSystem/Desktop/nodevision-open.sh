#!/usr/bin/env bash
# Nodevision/ApplicationSystem/Desktop/nodevision-open.sh
# This shell script launches Nodevision from the desktop entry with default host and port values suitable for local browser access.
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
NODEVISION_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
cd "${NODEVISION_ROOT}"
HOST="${HOST:-0.0.0.0}" PORT="${PORT:-3000}" npm run desktop -- "$@"
