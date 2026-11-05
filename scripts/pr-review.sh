#!/usr/bin/env bash
# Lists the unresolved review threads a bot (Codex, CodeQL) started on a pull request: the threads
# that block the merge, since main requires every conversation resolved. One line per thread,
# tab-separated: comment id, thread id, path:line, priority, title.
#   reply:   gh api repos/{owner}/{repo}/pulls/<PR>/comments/<comment id>/replies -f body='...'
#   resolve: gh api graphql -f query='mutation{resolveReviewThread(input:{threadId:"<thread id>"}){thread{isResolved}}}'
# A thread whose code has since moved shows its original line, marked "(outdated)". Prints nothing
# when every bot thread is resolved. Run from a checkout of the repository: gh fills {owner}/{repo}.
#
# Usage: scripts/pr-review.sh <PR number>
set -euo pipefail

if [ "$#" -ne 1 ] || ! [[ $1 =~ ^[0-9]+$ ]]; then
  echo "Usage: $0 <PR number>" >&2
  exit 2
fi

# --paginate follows pageInfo through $endCursor; --slurp gathers the pages into one array.
gh api graphql --paginate --slurp -F owner='{owner}' -F name='{repo}' -F number="$1" -f query='
  query($owner: String!, $name: String!, $number: Int!, $endCursor: String) {
    repository(owner: $owner, name: $name) {
      pullRequest(number: $number) {
        reviewThreads(first: 100, after: $endCursor) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id isResolved path line originalLine
            comments(first: 1) { nodes { databaseId author { __typename } body } }
          }
        }
      }
    }
  }' | jq -r '
  .[].data.repository.pullRequest.reviewThreads.nodes[]
  | select(.isResolved | not)
  | .comments.nodes[0] as $first
  | select($first.author.__typename == "Bot")
  | ($first.body | split("\n")[0]) as $head
  | [
      $first.databaseId,
      .id,
      "\(.path):\(.line // .originalLine)\(if .line == null then " (outdated)" else "" end)",
      ($head | capture("!\\[(?<p>P[0-9]) Badge\\]").p // "-"),
      ($head | gsub("<[^>]*>|!\\[[^]]*\\]\\([^)]*\\)|\\*\\*"; "") | gsub("^[#\\s]+|\\s+$"; ""))
    ]
  | @tsv'
