#!/usr/bin/env bash
# Tests the ticket claims of the two parallel launchers (launch-claims.sh,
# launch.sh, dev-workflow.sh) against a stub bd and a stub tmux, in a scratch
# git repository. Nothing touches the real beads database or tmux.
#
#   .claude/skills/parallel-claude/scripts/test-launch-claims.sh
#
# Exit 0 when every case passes. Run by scripts/__tests__/launch-claims.test.ts.

set -u

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS="$(cd "$HERE/../.." && pwd)"
CLAIMS="$HERE/launch-claims.sh"
LAUNCHERS=("$HERE/launch.sh" "$SKILLS/dev-workflow/scripts/dev-workflow.sh")

# The scratch repository must not inherit the git of a hook or of CI
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR

ROOT="$(mktemp -d "${TMPDIR:-/tmp}/launch-claims-test.XXXXXX")"
trap 'rm -rf "$ROOT"' EXIT

PASSED=0
FAILED=0
CASE=""

pass() { PASSED=$((PASSED + 1)); }
fail() {
    FAILED=$((FAILED + 1))
    echo "  FAIL [$CASE] $1"
    if [ -f "$STATE/calls" ]; then sed 's/^/      | /' "$STATE/calls"; fi
}
expect_eq() { # <what> <expected> <actual>
    if [ "$2" = "$3" ]; then pass; else fail "$1: expected '$2', got '$3'"; fi
}
expect_owner() { # <id> <assignee|status>
    expect_eq "$1 owner" "$2" "$(cat "$STATE/issues/$1")"
}
expect_no_lock() {
    if [ -e "$LOCK" ]; then fail "the claim lock is still there"; else pass; fi
}
# No write to the ticket but claim attempts: no "update <id> --assignee/--status", no "unclaim <id>"
expect_untouched() { # <id>
    local writes
    writes=$(grep -E "^bd (update $1 --(assignee|status)|unclaim $1( |$))" "$STATE/calls")
    if [ -n "$writes" ]; then
        fail "$1 was written: $(echo "$writes" | tr '\n' ';')"
    else
        pass
    fi
}

# --- Stubs --------------------------------------------------------------------

BIN="$ROOT/bin"
mkdir -p "$BIN"

# bd: one file per ticket holding "assignee|status". The actor is "me"; a claim
# takes a ticket nobody holds, one of mine, or one of the pool alias "pool".
# Faults, one file each in $STATE: fail-claim-<id>, fail-read-after-claim-<id>,
# term-after-claim-<id> (sends TERM to the launcher once the claim is made).
cat > "$BIN/bd" <<'STUB'
#!/usr/bin/env bash
echo "bd $*" >> "$STATE/calls"
cmd="$1"; id="${2:-}"; shift 2 2>/dev/null || shift $#
file="$STATE/issues/$id"
case "$cmd" in
    show)
        [ -f "$file" ] || exit 1
        if [ "${1:-}" = "--json" ]; then
            [ -e "$STATE/claimed-$id" ] && [ -e "$STATE/fail-read-after-claim-$id" ] && exit 1
            IFS='|' read -r assignee status < "$file"
            jq -n --arg id "$id" --arg a "$assignee" --arg s "$status" \
                '[{id: $id, title: ("Ticket " + $id), assignee: (if $a == "" then null else $a end), status: $s}]'
        else
            printf 'Title: Ticket %s\nType: task\nPriority: P2\n' "$id"
        fi
        ;;
    update)
        [ -f "$file" ] || exit 1
        IFS='|' read -r assignee status < "$file"
        if [ "${1:-}" = "--claim" ]; then
            [ -e "$STATE/fail-claim-$id" ] && exit 1
            case "$assignee" in ""|me|pool) ;; *) exit 1 ;; esac
            echo "me|in_progress" > "$file"
            touch "$STATE/claimed-$id"
            [ -e "$STATE/term-after-claim-$id" ] && kill -TERM "$PPID"
            exit 0
        fi
        while [ $# -gt 0 ]; do
            case "$1" in
                --assignee) assignee="$2"; shift 2 ;;
                --status) status="$2"; shift 2 ;;
                *) shift ;;
            esac
        done
        echo "$assignee|$status" > "$file"
        ;;
    unclaim)
        [ -f "$file" ] || exit 1
        echo "|open" > "$file"
        ;;
esac
exit 0
STUB

# tmux: counts the panes of the one session. Faults: fail-new-session,
# fail-split-<n> (the n-th split fails), int-at-new-session (sends INT to the
# launcher). new-session records whether the claim lock is held at that point.
cat > "$BIN/tmux" <<'STUB'
#!/usr/bin/env bash
echo "tmux $1" >> "$STATE/calls"
case "$1" in
    new-session)
        if [ -d "$LOCK" ]; then echo held > "$STATE/lock-at-setup"; else echo free > "$STATE/lock-at-setup"; fi
        [ -e "$STATE/int-at-new-session" ] && kill -INT "$PPID"
        [ -e "$STATE/fail-new-session" ] && exit 1
        echo 1 > "$STATE/panes"
        ;;
    split-window)
        n=$(( $(cat "$STATE/splits" 2>/dev/null || echo 0) + 1 ))
        echo "$n" > "$STATE/splits"
        [ -e "$STATE/fail-split-$n" ] && exit 1
        echo $(( $(cat "$STATE/panes") + 1 )) > "$STATE/panes"
        ;;
    list-panes)
        for ((i = 0; i < $(cat "$STATE/panes" 2>/dev/null || echo 0); i++)); do echo "%$i"; done
        ;;
    kill-session)
        [ -f "$STATE/panes" ] || exit 1
        rm -f "$STATE/panes"
        ;;
    has-session) [ -f "$STATE/panes" ] ;;
esac
STUB

for tool in claude gh; do printf '#!/usr/bin/env bash\nexit 0\n' > "$BIN/$tool"; done
chmod +x "$BIN"/*
export PATH="$BIN:$PATH"

# --- Scratch repository and state, fresh for each case -------------------------

# setup <case name> <id=assignee|status>...
setup() {
    CASE="$1"; shift
    local dir="$ROOT/case-$((PASSED + FAILED))-$RANDOM"
    REPO="$dir/repo"
    STATE="$dir/state"
    export HOME="$dir/home"
    mkdir -p "$REPO/.claude/skills/parallel-claude" "$STATE/issues" "$HOME"
    cp "$SKILLS/parallel-claude/agent-brief.md" "$REPO/.claude/skills/parallel-claude/"
    git -C "$REPO" init -q
    git -C "$REPO" -c user.name=test -c user.email=test@example.invalid commit -q --allow-empty -m init
    LOCK="$(git -C "$REPO" rev-parse --path-format=absolute --git-common-dir)/claude-parallel-claim.lock"
    export STATE LOCK
    : > "$STATE/calls"
    local spec
    for spec in "$@"; do echo "${spec#*=}" > "$STATE/issues/${spec%%=*}"; done
}

# Run a snippet with launch-claims.sh sourced, as a launcher would
with_claims() {
    (cd "$REPO" && REPO_DIR="$REPO" bash -c '
        print_info() { echo "info: $1"; }
        print_warning() { echo "warning: $1"; }
        print_error() { echo "error: $1"; }
        source "$1"
        eval "$2"' _ "$CLAIMS" "$1") >> "$STATE/out" 2>&1
}

launch() { # <launcher> <ids...>
    local launcher="$1"; shift
    if [ "$(basename "$launcher")" = "dev-workflow.sh" ]; then
        (cd "$REPO" && "$launcher" select "$@") >> "$STATE/out" 2>&1 < /dev/null
    else
        (cd "$REPO" && "$launcher" "$@") >> "$STATE/out" 2>&1 < /dev/null
    fi
}

# --- The claim code alone ------------------------------------------------------

echo "launch-claims.sh"

setup "plain claim of A B C" A='|open' B='|open' C='|open'
with_claims '
    claim_issues A B C || exit 9
    [ -d "$LOCK" ] || exit 8             # held until setup ends
    [ ${#LAUNCH_CLAIMS[@]} -eq 3 ] || exit 7
    finish_launch
    [ ${#LAUNCH_CLAIMS[@]} -eq 0 ] || exit 6'
expect_eq "exit code" 0 $?
for id in A B C; do expect_owner $id 'me|in_progress'; done
expect_no_lock

setup "TERM right after claiming B" A='|open' B='|open' C='|open'
touch "$STATE/term-after-claim-B"
with_claims 'claim_issues A B C; echo "not stopped"'
expect_eq "exit code" 130 $?
expect_owner A '|open'
expect_owner B '|open'
expect_owner C '|open'
expect_untouched C
expect_no_lock

setup "pool alias whose read fails after the claim" A='|open' B='pool|blocked'
touch "$STATE/fail-read-after-claim-B"
with_claims 'claim_issues A B || exit 9; abort_launch'
expect_eq "exit code" 0 $?
expect_owner A '|open'
expect_owner B 'pool|blocked'
expect_no_lock

setup "failed claim" A='|open' B='|open' C='|open'
touch "$STATE/fail-claim-B"
with_claims 'claim_issues A B C'
expect_eq "exit code" 1 $?
expect_owner A '|open'
expect_owner B '|open'
expect_untouched B
expect_untouched C
expect_no_lock

setup "a second claim waits for the lock" A='|open' B='|open'
with_claims 'claim_issues A || exit 9; (claim_issues B) && exit 8; finish_launch'
expect_eq "exit code" 0 $?
expect_owner B '|open'
expect_untouched B
expect_no_lock

setup "ticket already mine but open goes back to open" A='me|open'
with_claims 'claim_issues A || exit 9; abort_launch'
expect_eq "exit code" 0 $?
expect_owner A 'me|open'

setup "ticket already mine and in progress is left alone" A='me|in_progress'
with_claims 'claim_issues A || exit 9; abort_launch'
expect_eq "exit code" 0 $?
expect_owner A 'me|in_progress'
expect_untouched A

setup "unassigned ticket in a custom status gets that status back" A='|claimable'
with_claims 'claim_issues A || exit 9; abort_launch'
expect_eq "exit code" 0 $?
expect_owner A '|claimable'

# --- Both launchers, setup included --------------------------------------------

for launcher in "${LAUNCHERS[@]}"; do
    name="$(basename "$launcher")"
    echo "$name"

    setup "$name: launch of A B" A='|open' B='|open'
    launch "$launcher" A B
    expect_eq "exit code" 0 $?
    expect_owner A 'me|in_progress'
    expect_owner B 'me|in_progress'
    expect_eq "lock during setup" held "$(cat "$STATE/lock-at-setup" 2>/dev/null)"
    expect_eq "panes" 2 "$(cat "$STATE/panes" 2>/dev/null)"
    expect_no_lock

    setup "$name: 2nd pane fails" A='|open' B='|open' C='pool|open'
    touch "$STATE/fail-split-2"
    launch "$launcher" A B C
    rc=$?
    if [ "$rc" -ne 0 ]; then pass; else fail "the launch succeeded"; fi
    for id in A B; do expect_owner $id '|open'; done
    expect_owner C 'pool|open'
    # The session is stopped before the first ticket is given back
    first_kill=$(grep -n '^tmux kill-session' "$STATE/calls" | tail -1 | cut -d: -f1)
    first_release=$(grep -nE '^bd (unclaim|update [A-C] --assignee)' "$STATE/calls" | head -1 | cut -d: -f1)
    if [ -n "$first_kill" ] && [ -n "$first_release" ] && [ "$first_kill" -lt "$first_release" ]; then
        pass
    else
        fail "tmux kill-session (line ${first_kill:-none}) must come before the first release (line ${first_release:-none})"
    fi
    if [ -f "$STATE/panes" ]; then fail "the session still runs"; else pass; fi
    expect_no_lock

    setup "$name: tmux session fails to start" A='|open' B='|open'
    touch "$STATE/fail-new-session"
    launch "$launcher" A B
    rc=$?
    if [ "$rc" -ne 0 ]; then pass; else fail "the launch succeeded"; fi
    expect_owner A '|open'
    expect_owner B '|open'
    expect_no_lock

    setup "$name: INT during setup" A='|open' B='me|open'
    touch "$STATE/int-at-new-session"
    launch "$launcher" A B
    expect_eq "exit code" 130 $?
    expect_owner A '|open'
    expect_owner B 'me|open'
    if [ -f "$STATE/panes" ]; then fail "the session still runs"; else pass; fi
    expect_no_lock

    setup "$name: a launch under way keeps the lock" A='|open'
    mkdir "$LOCK"
    launch "$launcher" A
    rc=$?
    if [ "$rc" -ne 0 ]; then pass; else fail "the launch succeeded"; fi
    expect_owner A '|open'
    expect_untouched A
    rmdir "$LOCK"
done

# --- One copy of the claim code ------------------------------------------------

CASE="one copy"
copies=$(grep -rlE '^(release_claims|claim_issues_locked|claim_issues|read_owner|drop_last_claim)\(\)' "$SKILLS")
expect_eq "files defining the claim functions" "$CLAIMS" "$copies"

if command -v shellcheck >/dev/null; then
    CASE="shellcheck"
    if out=$(cd "$HERE" && shellcheck -x -S warning "$CLAIMS" "${LAUNCHERS[@]}" "$HERE/$(basename "$0")" 2>&1); then pass; else fail "$out"; fi
fi

echo "$PASSED passed, $FAILED failed"
[ "$FAILED" -eq 0 ]
