#!/usr/bin/env bash
# The one verification command for this repo.
#
#   bash scripts/verify.sh           full run: doc links, type check (npm run check), build (npm run build)
#   bash scripts/verify.sh --quick   SessionStart subset: doc links + type check, silent when clean
#
# Exit 0 when everything passes, non-zero otherwise. Needs node_modules (npm ci).

set -u
cd "$(dirname "$0")/.."

quick=0
[ "${1:-}" = "--quick" ] && quick=1
fail=0

say() { [ "$quick" = 1 ] || echo "$@"; }

# 1. Relative links in tracked Markdown files must point at files that exist.
broken=$(git ls-files '*.md' | while read -r md; do
  dir=$(dirname "$md")
  grep -oE '\]\([^)#[:space:]]+' "$md" | sed 's/^](//' | while read -r link; do
    case "$link" in http*|mailto:*) continue ;; esac
    [ -e "$dir/$link" ] || echo "  $md -> $link"
  done
done)
if [ -n "$broken" ]; then echo "FAIL doc links:"; echo "$broken"; fail=1; else say "ok   doc links"; fi

if [ ! -d node_modules ]; then
  echo "FAIL node_modules missing; run: npm ci"; exit 1
fi

# 2. Type check.
if out=$(npx tsc 2>&1); then say "ok   type check"; else echo "FAIL type check:"; echo "$out" | tail -30; fail=1; fi

# 3. Production build (full run only).
if [ "$quick" = 0 ]; then
  if out=$(npm run build 2>&1); then say "ok   build"; else echo "FAIL build:"; echo "$out" | tail -30; fail=1; fi
fi

exit $fail
