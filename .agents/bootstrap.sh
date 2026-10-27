#!/usr/bin/env bash
# Installs what scripts/verify.sh needs on a fresh clone. Cloud sessions run it at start.
set -eu
cd "$(dirname "$0")/.."
[ -d node_modules ] || npm ci --no-audit --no-fund
