#!/usr/bin/env bash
set -euo pipefail

FILES=("$@")
if [[ ${#FILES[@]} -eq 0 ]]; then
  exit 0
fi

FAIL=0
EMAIL_PATTERN='[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
UUID_PATTERN='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

for file in "${FILES[@]}"; do
  [[ "$file" == supabase/migrations/* ]] && continue
  [[ "$file" == docs/* ]] && continue
  [[ "$file" == .env.example ]] && continue

  if perl -ne "print if /$EMAIL_PATTERN/" "$file" 2>/dev/null | grep -v '//.*example\|#.*example\|example\.com\|open-brain-cloud\.local'; then
    echo "FAIL: Possible hardcoded email in $file"
    FAIL=1
  fi

  if perl -ne "print if /['\"][[:space:]]*${UUID_PATTERN}[[:space:]]*['\"]/" "$file" 2>/dev/null; then
    echo "FAIL: Possible hardcoded UUID literal in $file — confirm this is intentional"
    FAIL=1
  fi
done

exit $FAIL
