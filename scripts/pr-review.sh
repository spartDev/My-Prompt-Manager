#!/usr/bin/env bash
# The review threads a bot (Codex, CodeRabbit, CodeQL) started on a pull request: the threads that
# block the merge, since main requires every conversation resolved.
#
#   scripts/pr-review.sh <PR number>
#     Lists the unresolved bot threads, one line per thread, tab-separated: comment id, thread id,
#     bot, path:line, priority, title. The priority is Codex's badge (P1) or CodeRabbit's severity
#     (Major), "-" when the bot gives none. A thread whose code has since moved shows its original
#     line, marked "(outdated)". Prints nothing when every bot thread is resolved.
#   scripts/pr-review.sh reply <comment id> <body>
#     Replies in the thread of that comment and prints the reply's link. A body of "-" is read from
#     stdin, for a reply that holds quotes or spans lines.
#   scripts/pr-review.sh resolve <thread id>
#     Resolves the thread and prints the link of its first comment.
#
# Run from a checkout of the repository: gh fills {owner}/{repo}.
set -euo pipefail

usage() {
  echo "Usage: $0 <PR number>" >&2
  echo "       $0 reply <comment id> <body, or - to read it from stdin>" >&2
  echo "       $0 resolve <thread id>" >&2
  exit 2
}

reply() {
  local body=$2 ids pr top
  if [ "$body" = - ]; then
    body=$(cat)
  fi
  [ -n "$body" ] || usage
  # The replies endpoint takes the pull request and the thread's first comment, since GitHub does not
  # support a reply to a reply: a reply's id is traced back to the comment it answers.
  ids=$(gh api "repos/{owner}/{repo}/pulls/comments/$1" \
    --jq '"\(.pull_request_url | split("/") | last) \(.in_reply_to_id // .id)"')
  read -r pr top <<<"$ids"
  gh api "repos/{owner}/{repo}/pulls/$pr/comments/$top/replies" -f body="$body" --jq .html_url
}

resolve() {
  local link
  link=$(gh api graphql -f thread="$1" -f query='
    mutation($thread: ID!) {
      resolveReviewThread(input: {threadId: $thread}) {
        thread { isResolved comments(first: 1) { nodes { url } } }
      }
    }' --jq '.data.resolveReviewThread.thread | select(.isResolved) | .comments.nodes[0].url')
  if [ -z "$link" ]; then
    echo "Thread $1 is still unresolved." >&2
    exit 1
  fi
  echo "$link"
}

list() {
  # --paginate follows pageInfo through $endCursor; --slurp gathers the pages into one array.
  gh api graphql --paginate --slurp -F owner='{owner}' -F name='{repo}' -F number="$1" -f query='
    query($owner: String!, $name: String!, $number: Int!, $endCursor: String) {
      repository(owner: $owner, name: $name) {
        pullRequest(number: $number) {
          reviewThreads(first: 100, after: $endCursor) {
            pageInfo { hasNextPage endCursor }
            nodes {
              id isResolved path line originalLine
              comments(first: 1) { nodes { databaseId author { __typename login } body } }
            }
          }
        }
      }
    }' | jq -r '
    # The lines a reader sees: no blank line, no HTML comment on a line of its own, nothing folded
    # in a <details> block (CodeRabbit folds its analysis and its prompt for agents there). As on
    # GitHub, a block opens with a tag at the start of a line; a tag named in backticks is text.
    def visible:
      split("\n")
      | reduce .[] as $line ({depth: 0, lines: []};
          ($line | gsub("`[^`]*`"; "")) as $tags
          | ([$tags | scan("^\\s*<details[\\s>]")] | length) as $open
          | (if .depth == 0 and $open == 0 then .lines += [$line] else . end)
          | .depth = ([.depth + $open - ([$tags | scan("</details>")] | length), 0] | max))
      | .lines
      | map(select(test("^\\s*(<!--.*-->\\s*)?$") | not));
    def plain: gsub("<[^>]*>|!\\[[^]]*\\]\\([^)]*\\)|\\*\\*"; "") | gsub("^[#\\s]+|\\s+$"; "");
    def bold_line: test("^\\*\\*([^*]|\\*(?!\\*))+\\*\\*\\s*$");

    .[].data.repository.pullRequest.reviewThreads.nodes[]
    | select(.isResolved | not)
    | .comments.nodes[0] as $first
    | select($first.author.__typename == "Bot")
    | ($first.body | visible) as $lines
    | ($lines[0] // "") as $head
    | (if $head | test("\\*\\* · \\*\\*") then
        # CodeRabbit: "**<icon> Minor** · **<category>** · **<effort>**", then the title, the last
        # bold line before the text: a security finding puts its category and metadata ahead of it.
        $lines[1:] as $rest
        | ([$rest | to_entries[] | select(.value | test("^(\\*\\*|\\[)") | not) | .key] | first) as $text
        | [($head | plain | split(" · ")[0]), (([$rest[:$text][] | select(bold_line)] | last) // $rest[0] // "" | plain)]
      else
        # Codex: "**<P2 badge> Title**". CodeQL: "## CodeQL / Title".
        [($head | capture("!\\[(?<p>P[0-9]) Badge\\]").p // "-"), ($head | plain)]
      end) as [$priority, $title]
    | [
        $first.databaseId,
        .id,
        $first.author.login,
        "\(.path):\(.line // .originalLine)\(if .line == null then " (outdated)" else "" end)",
        $priority,
        $title
      ]
    | @tsv'
}

case "${1:-}" in
  reply)
    { [ "$#" -eq 3 ] && [[ $2 =~ ^[0-9]+$ ]]; } || usage
    reply "$2" "$3"
    ;;
  resolve)
    { [ "$#" -eq 2 ] && [[ $2 =~ ^PRRT_ ]]; } || usage
    resolve "$2"
    ;;
  *)
    { [ "$#" -eq 1 ] && [[ $1 =~ ^[0-9]+$ ]]; } || usage
    list "$1"
    ;;
esac
