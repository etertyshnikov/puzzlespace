#!/usr/bin/env bash
# Сборка React (production) -> frontend/dist
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/frontend"
if [ ! -d node_modules ]; then
  npm ci
fi
npm run build
echo "OK: $ROOT/frontend/dist"
