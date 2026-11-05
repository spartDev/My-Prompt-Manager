#!/usr/bin/env bash
# Lints the files this branch changes since it left origin/main, committed or not, new files
# included, and fails on any warning in them. 'npm run lint' passes with the warnings main
# already has; this keeps each changed file free of them. Biome's own --changed sees committed
# changes only, so it would miss the edits a session checks before it commits.
#
# The base is origin/main, else a local main; LINT_CHANGED_BASE=<ref> sets another.
#
# Usage: npm run lint:changed
set -euo pipefail

base_ref=${LINT_CHANGED_BASE:-}
if [ -z "$base_ref" ]; then
  for ref in origin/main main; do
    if git rev-parse --verify --quiet "$ref^{commit}" >/dev/null; then
      base_ref=$ref
      break
    fi
  done
fi
if [ -z "$base_ref" ]; then
  echo "lint:changed: no origin/main or main to compare with; set LINT_CHANGED_BASE=<ref>." >&2
  exit 2
fi

base=$(git merge-base "$base_ref" HEAD)

files=()
while IFS= read -r file; do
  files+=("$file")
done < <({ git diff --name-only --diff-filter=d "$base"; git ls-files --others --exclude-standard; } | sort -u)

if [ "${#files[@]}" -eq 0 ]; then
  echo "No changed files since $base_ref."
  exit 0
fi

exec npx biome check --formatter-enabled=false --error-on-warnings --no-errors-on-unmatched "${files[@]}"
