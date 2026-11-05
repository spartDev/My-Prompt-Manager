#!/usr/bin/env bash
# Lists the review comments a bot (Codex) left on a pull request that nobody has replied to yet:
# one line per comment, tab-separated: id, path:line, priority, title. The id is the one to reply to:
#   gh api repos/{owner}/{repo}/pulls/<PR>/comments/<id>/replies -f body='...'
# A comment whose code has since moved shows its original line, marked "(outdated)". Prints nothing
# when every bot comment has a reply. Run from a checkout of the repository: gh fills {owner}/{repo}.
#
# Usage: scripts/pr-review.sh <PR number>
set -euo pipefail

if [ "$#" -ne 1 ] || ! [[ $1 =~ ^[0-9]+$ ]]; then
  echo "Usage: $0 <PR number>" >&2
  exit 2
fi

# --slurp gathers every page into one array of pages, so a reply on a later page still counts.
gh api --paginate --slurp "repos/{owner}/{repo}/pulls/$1/comments" | jq -r '
  add // []
  | [.[].in_reply_to_id | select(. != null)] as $answered
  | .[]
  | select(.user.type == "Bot" and .in_reply_to_id == null)
  | select(.id as $id | $answered | index($id) | not)
  | (.body | split("\n")[0]) as $head
  | [
      .id,
      "\(.path):\(.line // .original_line)\(if .line == null then " (outdated)" else "" end)",
      ($head | capture("!\\[(?<p>P[0-9]) Badge\\]").p // "-"),
      ($head | gsub("<[^>]*>|!\\[[^]]*\\]\\([^)]*\\)|\\*\\*"; "") | gsub("^\\s+|\\s+$"; ""))
    ]
  | @tsv'
