#!/usr/bin/env bash
# Lints the files this branch changes since it left origin/main, committed or not, new files
# included, and fails on any warning in them. 'npm run lint' passes with the warnings main
# already has; this keeps each changed file free of them. Biome's own --changed sees committed
# changes only, so it would miss the edits a session checks before it commits.
#
# Usage: npm run lint:changed
set -euo pipefail

base=$(git merge-base origin/main HEAD)

files=()
while IFS= read -r file; do
  files+=("$file")
done < <({ git diff --name-only --diff-filter=d "$base"; git ls-files --others --exclude-standard; } | sort -u)

if [ "${#files[@]}" -eq 0 ]; then
  echo "No changed files since origin/main."
  exit 0
fi

exec npx biome check --formatter-enabled=false --error-on-warnings --no-errors-on-unmatched "${files[@]}"
