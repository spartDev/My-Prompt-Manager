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
# The locks are symlinks to a pid, which -e alone does not see
expect_no_lock() {
    if [ -L "$LOCK" ] || [ -e "$LOCK" ]; then fail "the claim lock is still there"; else pass; fi
    if [ -L "$LOCK.reap" ] || [ -e "$LOCK.reap" ]; then fail "the removal lock is still there"; else pass; fi
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
# term-after-claim-<id> and int-after-claim-<id> (send TERM or INT to the
# launcher once the claim is made).
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
            [ -e "$STATE/int-after-claim-$id" ] && kill -INT "$PPID"
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

# tmux: counts the panes of the one session, numbered %1, %2... and printed by
# -P. A pane opens only in a directory that exists, taken from -c or from the
# "cd '<dir>'" its command starts with; each one is appended to $STATE/pane-dirs.
# A -t target must be the session or a pane already open. Faults:
# fail-new-session, fail-split-<n> (the n-th split fails), noop-split-<n> (the
# n-th split succeeds without opening a pane), int-at-new-session (sends INT to
# the launcher). new-session records whether the claim lock is held at that
# point.
cat > "$BIN/tmux" <<'STUB'
#!/usr/bin/env bash
echo "tmux $1" >> "$STATE/calls"
sub="$1"; shift
dir=""; target=""; print=""; last=""
while [ $# -gt 0 ]; do
    case "$1" in
        -c) dir="$2"; shift 2 ;;
        -t|-s|-F) [ "$1" = "-t" ] && target="$2"; shift 2 ;;
        -P) print=1; shift ;;
        -*) shift ;;
        *) last="$1"; shift ;;
    esac
done
open_pane() {
    if [ -z "$dir" ]; then
        case "$last" in "cd '"*) dir="${last#cd \'}"; dir="${dir%%\'*}" ;; esac
    fi
    if [ -z "$dir" ] || [ ! -d "$dir" ]; then
        echo "tmux: no such directory: '$dir'" >> "$STATE/calls"
        exit 1
    fi
    echo "$dir" >> "$STATE/pane-dirs"
    n=$(( $(cat "$STATE/panes" 2>/dev/null || echo 0) + 1 ))
    echo "$n" > "$STATE/panes"
    [ -n "$print" ] && echo "%$n"
    exit 0
}
case "$sub" in
    new-session)
        if [ -L "$LOCK" ]; then echo held > "$STATE/lock-at-setup"; else echo free > "$STATE/lock-at-setup"; fi
        [ -e "$STATE/int-at-new-session" ] && kill -INT "$PPID"
        [ -e "$STATE/fail-new-session" ] && exit 1
        open_pane
        ;;
    split-window)
        n=$(( $(cat "$STATE/splits" 2>/dev/null || echo 0) + 1 ))
        echo "$n" > "$STATE/splits"
        [ -e "$STATE/fail-split-$n" ] && exit 1
        [ -e "$STATE/noop-split-$n" ] && exit 0
        case "$target" in
            claude-parallel) ;;
            %*) [ "${target#%}" -le "$(cat "$STATE/panes")" ] || { echo "tmux: no pane $target" >> "$STATE/calls"; exit 1; } ;;
            *) echo "tmux: bad target '$target'" >> "$STATE/calls"; exit 1 ;;
        esac
        open_pane
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

# perl, ln and mkdir: the real commands, but with the fault term-at-lock (or
# term-at-reap), the one that creates the claim lock (or the removal lock)
# sends TERM to the launcher once it is created; with term-at-lock-refused,
# the one refused the claim lock sends TERM. With dir-at-lock, an older
# launcher takes its directory lock just before the claim lock is made and
# frees it (rmdir, which fails on a directory not empty) just after. With
# alive-at-reap, the one that creates the removal lock makes the ps stub
# report every process alive from then on, as when a dead pid is reused.
REAL_MKDIR=$(command -v mkdir)
for tool in perl ln mkdir; do
    real=$(command -v "$tool")
    cat > "$BIN/$tool" <<STUB
#!/bin/sh
for last in "\$@"; do :; done
older=""
if [ "$tool" != mkdir ] && [ -n "\${LOCK:-}" ] && [ "\$last" = "\$LOCK" ] && [ -e "\$STATE/dir-at-lock" ]; then
    older=1
    $REAL_MKDIR "\$LOCK" 2>/dev/null || older=""
fi
$real "\$@"
rc=\$?
[ -n "\$older" ] && rmdir "\$LOCK" 2>/dev/null
if [ "\$rc" -eq 0 ] && [ -n "\${LOCK:-}" ] && [ "\$last" = "\$LOCK.reap" ] && [ -e "\$STATE/alive-at-reap" ]; then
    touch "\$STATE/all-alive"
fi
if [ "\$rc" -ne 0 ] && [ -n "\${LOCK:-}" ] && [ "\$last" = "\$LOCK" ] && [ -e "\$STATE/term-at-lock-refused" ]; then
    kill -TERM "\$PPID"
fi
if [ "\$rc" -eq 0 ] && [ -n "\${LOCK:-}" ]; then
    if { [ "\$last" = "\$LOCK" ] && [ -e "\$STATE/term-at-lock" ]; } \\
        || { [ "\$last" = "\$LOCK.reap" ] && [ -e "\$STATE/term-at-reap" ]; }; then
        kill -TERM "\$PPID"
    fi
fi
exit "\$rc"
STUB
done
# ps: the real one, unless the fault alive-at-reap has fired
cat > "$BIN/ps" <<STUB
#!/bin/sh
[ -n "\${STATE:-}" ] && [ -e "\$STATE/all-alive" ] && exit 0
exec $(command -v ps) "\$@"
STUB
chmod +x "$BIN/ps"

# The launchers run under the bash that runs this test: /bin/bash 3.2 on macOS
# when started as /bin/bash test-launch-claims.sh
ln -s "$BASH" "$BIN/bash"
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

# The pid of a process that has just ended, fresh for each case
dead_pid() {
    local pid
    sleep 0 &
    pid=$!
    wait "$pid"
    echo "$pid"
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
    [ -L "$LOCK" ] || exit 8             # held until setup ends
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
# The second claim runs in its own process, with its own pid, as a launcher does
with_claims 'claim_issues A || exit 9
    REPO_DIR="$REPO_DIR" bash -c "print_info() { :; }; print_warning() { :; }; print_error() { :; }
        source \"\$1\"; claim_issues B" _ "$1" && exit 8
    finish_launch'
expect_eq "exit code" 0 $?
expect_owner B '|open'
expect_untouched B
expect_no_lock

setup "TERM as the lock is taken" A='|open'
touch "$STATE/term-at-lock"
with_claims 'claim_issues A; echo "not stopped"'
expect_eq "exit code" 130 $?
expect_owner A '|open'
expect_untouched A
expect_no_lock

setup "the lock of a launch that no longer runs is removed" A='|open'
dead=$(dead_pid)
ln -s "$dead" "$LOCK"
with_claims 'claim_issues A || exit 9; finish_launch'
expect_eq "exit code" 0 $?
expect_owner A 'me|in_progress'
if grep -q "Removed the claim lock of launch $dead" "$STATE/out"; then pass; else fail "no warning about the stale lock"; fi
expect_no_lock

setup "a lock naming this launch's own pid is stale" A='|open'
with_claims 'ln -s "$$" "$LOCK"; claim_issues A || exit 9; finish_launch'
expect_eq "exit code" 0 $?
expect_owner A 'me|in_progress'
expect_no_lock

setup "a stale lock whose pid runs again by the removal is kept" A='|open'
dead=$(dead_pid)
ln -s "$dead" "$LOCK"
touch "$STATE/alive-at-reap"
with_claims 'claim_issues A'
expect_eq "exit code" 1 $?
expect_owner A '|open'
expect_untouched A
expect_eq "lock holder" "$dead" "$(readlink "$LOCK")"
if [ -L "$LOCK.reap" ] || [ -e "$LOCK.reap" ]; then fail "the removal lock is still there"; else pass; fi
rm -f "$LOCK"

setup "a lock that cannot be created is said so" A='|open'
chmod a-w "$(dirname "$LOCK")"
with_claims 'claim_issues A'
rc=$?
chmod u+w "$(dirname "$LOCK")"
expect_eq "exit code" 1 "$rc"
expect_owner A '|open'
if grep -q "Could not create the claim lock $LOCK" "$STATE/out"; then pass; else fail "the error does not say the lock could not be created"; fi

setup "the lock of a launch that runs is kept" A='|open'
ln -s "$$" "$LOCK"
with_claims 'claim_issues A'
expect_eq "exit code" 1 $?
expect_owner A '|open'
expect_untouched A
expect_eq "lock holder" "$$" "$(readlink "$LOCK")"
rm -f "$LOCK"

setup "a stale lock another launch is removing is left to it" A='|open'
dead=$(dead_pid)
ln -s "$dead" "$LOCK"
ln -s "$$" "$LOCK.reap"
with_claims 'claim_issues A'
expect_eq "exit code" 1 $?
expect_owner A '|open'
expect_eq "lock holder" "$dead" "$(readlink "$LOCK")"
expect_eq "removal lock holder" "$$" "$(readlink "$LOCK.reap")"
rm -f "$LOCK" "$LOCK.reap"

setup "a removal lock of a launch that no longer runs stops the launch" A='|open'
dead=$(dead_pid)
ln -s "$dead" "$LOCK"
ln -s "$dead" "$LOCK.reap"
with_claims 'claim_issues A'
expect_eq "exit code" 1 $?
expect_owner A '|open'
expect_untouched A
expect_eq "lock holder" "$dead" "$(readlink "$LOCK")"
expect_eq "removal lock holder" "$dead" "$(readlink "$LOCK.reap")"
if grep -q "removal lock $LOCK.reap was left by launch $dead, which no longer runs" "$STATE/out"; then pass; else fail "the error does not name the dead removal lock"; fi
rm -f "$LOCK" "$LOCK.reap"

setup "TERM as the removal lock is taken" A='|open'
dead=$(dead_pid)
ln -s "$dead" "$LOCK"
touch "$STATE/term-at-reap"
with_claims 'claim_issues A; echo "not stopped"'
expect_eq "exit code" 130 $?
expect_owner A '|open'
expect_untouched A
if [ -L "$LOCK.reap" ] || [ -e "$LOCK.reap" ]; then fail "the removal lock is still there"; else pass; fi
expect_eq "lock holder" "$dead" "$(readlink "$LOCK")"
rm -f "$LOCK"

setup "TERM while another launch holds the lock leaves its lock" A='|open'
ln -s "$$" "$LOCK"
touch "$STATE/term-at-lock-refused"
with_claims 'claim_issues A; echo "not stopped"'
expect_eq "exit code" 130 $?
expect_owner A '|open'
expect_untouched A
expect_eq "lock holder" "$$" "$(readlink "$LOCK")"
rm -f "$LOCK"

setup "a live lock is named before a stale removal lock" A='|open'
ln -s "$$" "$LOCK"
ln -s "$(dead_pid)" "$LOCK.reap"
with_claims 'claim_issues A'
expect_eq "exit code" 1 $?
if grep -q "Another launch is claiming tickets (lock $LOCK, held by $$)" "$STATE/out"; then pass; else fail "the error does not name the live holder"; fi
rm -f "$LOCK" "$LOCK.reap"

setup "an older launcher's lock taken and freed while the lock is made" A='|open'
touch "$STATE/dir-at-lock"
with_claims 'claim_issues A'
expect_eq "exit code" 1 $?
expect_owner A '|open'
expect_untouched A
expect_no_lock

setup "the lock directory of an older launcher is kept" A='|open'
mkdir "$LOCK"
with_claims 'claim_issues A'
expect_eq "exit code" 1 $?
expect_owner A '|open'
expect_eq "lock directory content" "" "$(ls -A "$LOCK")"
rmdir "$LOCK"

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
    expect_eq "pane directories" "$HOME/.claude-worktrees/repo/task-A $HOME/.claude-worktrees/repo/task-B" \
        "$(tr '\n' ' ' < "$STATE/pane-dirs" 2>/dev/null | sed 's/ $//')"
    expect_no_lock

    setup "$name: launch of four tickets" A='|open' B='|open' C='|open' D='|open'
    launch "$launcher" A B C D
    expect_eq "exit code" 0 $?
    expect_eq "panes" 4 "$(cat "$STATE/panes" 2>/dev/null)"
    expect_eq "pane directories" "$(for id in A B C D; do printf '%s ' "$HOME/.claude-worktrees/repo/task-$id"; done | sed 's/ $//')" \
        "$(tr '\n' ' ' < "$STATE/pane-dirs" 2>/dev/null | sed 's/ $//')"
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

    # Before the launcher sets its EXIT trap: only the INT trap of claim_issues rolls back
    setup "$name: INT right after claiming A" A='|open' B='|open'
    touch "$STATE/int-after-claim-A"
    launch "$launcher" A B
    expect_eq "exit code" 130 $?
    expect_owner A '|open'
    expect_owner B '|open'
    expect_untouched B
    if [ -f "$STATE/panes" ]; then fail "the session still runs"; else pass; fi
    expect_no_lock

    setup "$name: a split returns without a pane" A='|open' B='|open'
    touch "$STATE/noop-split-1"
    launch "$launcher" A B
    rc=$?
    if [ "$rc" -ne 0 ]; then pass; else fail "the launch succeeded"; fi
    expect_owner A '|open'
    expect_owner B '|open'
    if grep -q "The session has 1 panes for 2 tickets" "$STATE/out"; then pass; else fail "the pane count was not checked"; fi
    if [ -f "$STATE/panes" ]; then fail "the session still runs"; else pass; fi
    expect_no_lock

    # dev-workflow.sh dies on this INT and its EXIT trap rolls back, with or
    # without the INT trap; the case above is the one that needs it
    setup "$name: INT during setup" A='|open' B='me|open'
    touch "$STATE/int-at-new-session"
    launch "$launcher" A B
    expect_eq "exit code" 130 $?
    expect_owner A '|open'
    expect_owner B 'me|open'
    if [ -f "$STATE/panes" ]; then fail "the session still runs"; else pass; fi
    expect_no_lock

    setup "$name: a launch under way keeps the lock" A='|open'
    ln -s "$$" "$LOCK"
    launch "$launcher" A
    rc=$?
    if [ "$rc" -ne 0 ]; then pass; else fail "the launch succeeded"; fi
    expect_owner A '|open'
    expect_untouched A
    expect_eq "lock holder" "$$" "$(readlink "$LOCK")"
    rm -f "$LOCK"
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
