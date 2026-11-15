# shellcheck shell=bash
# Ticket claims of a parallel launch, sourced by launch.sh and by
# .claude/skills/dev-workflow/scripts/dev-workflow.sh.
#
# A launch claims every ticket under a lock shared by every worktree of the
# repository, and holds that lock until its setup (worktrees, tmux panes)
# succeeds or its rollback ends. A launch that fails or is interrupted stops
# the tmux session it started, then puts every ticket back as it found it.
#
# The launcher defines print_info, print_warning, print_error and REPO_DIR, and:
#   claim_issues <ids...> || return 1   # takes the lock, claims, keeps the lock
#   trap abort_launch EXIT              # a failed setup rolls back
#   LAUNCH_SESSION=<session>            # just before tmux new-session
#   ...setup...
#   finish_launch                       # keeps the claims, frees the lock
#   trap - EXIT

# Tickets this launch took over, one "id|previous assignee|previous status"
# each, so a launch that fails puts every one back as it found it.
LAUNCH_CLAIMS=()
# The claim lock this launch takes or holds: a symlink whose target is the pid
# of its holder, so it is created with its holder in one step.
LAUNCH_LOCK=""
# The lock that guards the removal of a stale claim lock, a symlink to its
# holder's pid like the claim lock, while this launch takes or holds it.
LAUNCH_REAP=""
# The tmux session this launch started, stopped before its claims are given back.
LAUNCH_SESSION=""

# Give back what this launch claimed: unclaim the tickets nobody held, then set
# back a saved status other than open; hand a ticket taken from another
# assignee (a claim.pools alias, or this actor) back to it with its status.
release_claims() {
    local entry id before status
    for entry in ${LAUNCH_CLAIMS[@]+"${LAUNCH_CLAIMS[@]}"}; do
        IFS='|' read -r id before status <<< "$entry"
        if [ -z "$before" ]; then
            if ! bd unclaim "$id" >/dev/null; then
                print_warning "Could not release $id: run bd unclaim $id"
            elif [ -n "$status" ] && [ "$status" != "open" ] \
                && ! bd update "$id" --status "$status" >/dev/null; then
                print_warning "Released $id, but could not set it back to $status: run bd update $id --status $status"
            else
                print_info "Released $id"
            fi
        elif bd update "$id" --assignee "$before" --status "$status" >/dev/null; then
            print_info "Gave $id back to $before"
        else
            print_warning "Could not give $id back: run bd update $id --assignee $before --status $status"
        fi
    done
    LAUNCH_CLAIMS=()
}

# Read a ticket's assignee and status as "assignee|status"; fails when bd show
# fails or prints nothing.
read_owner() {
    local json
    json=$(bd show "$1" --json 2>/dev/null) && [ -n "$json" ] \
        && printf '%s' "$json" | jq -er 'if type == "array" then .[0] else . end | "\(.assignee // "")|\(.status // "")"'
}

drop_last_claim() {
    unset "LAUNCH_CLAIMS[$((${#LAUNCH_CLAIMS[@]} - 1))]"
}

# Claim every ticket, recording each one the claim changed. When a ticket
# cannot be read or claimed, give back what this run claimed and stop.
claim_issues_locked() {
    local issue before after
    LAUNCH_CLAIMS=()
    for issue in "$@"; do
        if ! before=$(read_owner "$issue"); then
            print_error "Could not read the assignee of $issue. Nothing was launched."
            release_claims
            return 1
        fi
        # Recorded before the claim, so an interruption mid-claim still gives it back
        LAUNCH_CLAIMS+=("$issue|$before")
        if ! bd update "$issue" --claim; then
            drop_last_claim
            print_error "Could not claim $issue: it may be claimed by someone else. Nothing was launched."
            release_claims
            return 1
        fi
        after=$(read_owner "$issue") || after=""
        # Dropped only when a read proves assignee and status unchanged; an unread one keeps the record
        if [ -n "$after" ] && [ "$after" = "$before" ]; then
            drop_last_claim
        fi
    done
}

# Free the claim lock if this launch holds it: only a lock whose holder is
# this shell is removed, so an interrupt before the lock is taken leaves the
# lock of another launch alone.
free_claim_lock() {
    if [ -n "$LAUNCH_LOCK" ] && [ "$(readlink "$LAUNCH_LOCK" 2>/dev/null)" = "$$" ]; then
        rm -f "$LAUNCH_LOCK"
    fi
    LAUNCH_LOCK=""
    free_reap_lock
}

# Free the removal lock if this launch holds it.
free_reap_lock() {
    if [ -n "$LAUNCH_REAP" ] && [ "$(readlink "$LAUNCH_REAP" 2>/dev/null)" = "$$" ]; then
        rm -f "$LAUNCH_REAP"
    fi
    LAUNCH_REAP=""
}

# Roll a launch back: stop the tmux session it started, so no pane keeps
# working on a ticket given back, then give the claims back and free the lock.
# Safe to run twice (an INT/TERM trap that exits runs the EXIT trap too).
abort_launch() {
    if [ -n "$LAUNCH_SESSION" ]; then
        tmux kill-session -t "$LAUNCH_SESSION" 2>/dev/null || true
        LAUNCH_SESSION=""
    fi
    release_claims
    free_claim_lock
}

# Setup succeeded: keep the claims, free the lock, drop the INT/TERM trap.
finish_launch() {
    trap - INT TERM
    LAUNCH_CLAIMS=()
    LAUNCH_SESSION=""
    free_claim_lock
}

# Whether a process runs; kill -0 fails on another user's process, ps does not.
# Only processes of this host and pid namespace are seen: a repository shared
# with a container or another machine must not run launches from both sides.
pid_alive() {
    kill -0 "$1" 2>/dev/null || ps -p "$1" >/dev/null 2>&1
}

# Create a lock for this shell. ln -s makes the link and its target, this
# pid, in one step; when the path is a directory (the lock of an older
# launcher), ln puts the link inside it instead, which is taken back.
link_lock() {
    if ln -s "$$" "$1" 2>/dev/null; then
        [ "$(readlink "$1" 2>/dev/null)" = "$$" ] && return 0
        rm -f "$1/$$"
    fi
    return 1
}

# The pid a lock names when that process no longer runs; fails otherwise.
dead_holder() {
    local holder
    holder=$(readlink "$1" 2>/dev/null) || return 1
    case "$holder" in ""|*[!0-9]*) return 1 ;; esac
    pid_alive "$holder" && return 1
    echo "$holder"
}

# Remove a lock still held by the dead pid read before, and say so.
remove_dead_lock() { # <lock> <pid> <what>
    if [ "$(readlink "$1" 2>/dev/null)" = "$2" ]; then
        rm -f "$1"
        print_warning "Removed the $3 of launch $2, which no longer runs"
    fi
}
# A pid reused by another process since its launch died reads as alive: the
# lock then stays, and the error names its holder so it can be removed by hand.

# Take the claim lock; a lock whose holder no longer runs (a launch killed
# with SIGKILL) is removed first. The removal happens under a second lock and
# only while the holder read is still the one in place, so two launches that
# find the same stale lock never remove the lock one of them has just taken.
# A removal lock left by a launch killed while removing is not removed: nothing
# would guard that removal, so the launch stops and names it.
take_claim_lock() {
    local holder
    link_lock "$LAUNCH_LOCK" && return 0
    holder=$(dead_holder "$LAUNCH_LOCK") || return 1
    # Named before it is taken, so an interrupt while it is taken still frees it
    LAUNCH_REAP="$LAUNCH_LOCK.reap"
    link_lock "$LAUNCH_REAP" || return 1
    remove_dead_lock "$LAUNCH_LOCK" "$holder" "claim lock"
    free_reap_lock
    link_lock "$LAUNCH_LOCK"
}

# Take the lock (flock is not on macOS) and claim the tickets. On success the
# lock stays held, so a second launch reads the assignees only once this one
# has set up or rolled back, and a rollback can never release a ticket another
# launch has just claimed. On failure nothing is held.
claim_issues() {
    local lock holder reaper
    lock="$(git -C "$REPO_DIR" rev-parse --path-format=absolute --git-common-dir)/claude-parallel-claim.lock"
    # Interrupted from here to finish_launch: roll back, then stop. Set before
    # the lock is taken, so no interrupt falls between the lock and its trap.
    LAUNCH_LOCK="$lock"
    trap 'abort_launch; exit 130' INT TERM
    if ! take_claim_lock; then
        trap - INT TERM
        LAUNCH_LOCK=""
        free_reap_lock
        holder=$(readlink "$lock" 2>/dev/null) || holder="unknown"
        if [ -L "$lock.reap" ] || [ -e "$lock.reap" ]; then
            if reaper=$(dead_holder "$lock.reap"); then
                print_error "The removal lock $lock.reap was left by launch $reaper, which no longer runs. Remove it, then launch again."
            else
                reaper=$(readlink "$lock.reap" 2>/dev/null) || reaper="unknown"
                print_error "Another launch is removing a stale claim lock ($lock.reap, held by $reaper). Wait for it, or remove $lock.reap if no launch is running."
            fi
        else
            print_error "Another launch is claiming tickets (lock $lock, held by $holder). Wait for it, or remove the lock if no launch is running."
        fi
        return 1
    fi
    if ! claim_issues_locked "$@"; then
        trap - INT TERM
        free_claim_lock
        return 1
    fi
}
