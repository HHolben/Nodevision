#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
NODEVISION_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
cd "${NODEVISION_ROOT}"
HOST="${HOST:-0.0.0.0}" PORT="${PORT:-3000}" npm run desktop -- "$@"
