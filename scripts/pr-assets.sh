#!/usr/bin/env bash
# Pushes a pull request's proof screenshots to the orphan branch pr-assets/<topic>, under <topic>/,
# and prints the markdown that embeds them: a Light | Dark table for each <name>-light / <name>-dark
# pair, one <img> line for any other file. Run it again with the same topic to add or replace files;
# the files already on the branch stay. The working tree, the index and the current branch are left
# alone: the commit is built with git plumbing in a temporary index.
#
# Usage: scripts/pr-assets.sh <topic> <file.png>...
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <topic> <file.png>..." >&2
  exit 1
fi

topic=$1
shift
branch="pr-assets/$topic"
repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner)

scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT
export GIT_INDEX_FILE="$scratch/index"

parent=""
if git fetch -q origin "refs/heads/$branch" 2>/dev/null; then
  parent=$(git rev-parse FETCH_HEAD)
  git read-tree "$parent"
else
  git read-tree --empty
fi

names=()
for file in "$@"; do
  name=$(basename "$file")
  names+=("$name")
  git update-index --add --cacheinfo "100644,$(git hash-object -w "$file"),$topic/$name"
done

tree=$(git write-tree)
if [ -n "$parent" ]; then
  commit=$(git commit-tree "$tree" -p "$parent" -m "PR assets: $topic")
else
  commit=$(git commit-tree "$tree" -m "PR assets: $topic")
fi
git push -q origin "$commit:refs/heads/$branch"

base="https://raw.githubusercontent.com/$repo/$branch/$topic"
has() {
  local name
  for name in "${names[@]}"; do
    [ "$name" = "$1" ] && return 0
  done
  return 1
}
img() { printf '<img src="%s/%s" width="380">' "$base" "$1"; }

header=0
for name in "${names[@]}"; do
  case "$name" in
    *-light.*)
      dark="${name/-light./-dark.}"
      if has "$dark"; then
        if [ "$header" -eq 0 ]; then
          printf '| Light | Dark |\n|---|---|\n'
          header=1
        fi
        printf '| %s | %s |\n' "$(img "$name")" "$(img "$dark")"
        continue
      fi
      ;;
    *-dark.*)
      has "${name/-dark./-light.}" && continue
      ;;
  esac
  img "$name"
  printf '\n'
done
