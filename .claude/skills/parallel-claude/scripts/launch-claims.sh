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
# The claim lock while this launch holds it.
LAUNCH_LOCK=""
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

# Free the claim lock if this launch holds it.
free_claim_lock() {
    if [ -n "$LAUNCH_LOCK" ]; then
        rmdir "$LAUNCH_LOCK" 2>/dev/null || true
        LAUNCH_LOCK=""
    fi
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

# Take the lock (mkdir: flock is not on macOS) and claim the tickets. On
# success the lock stays held, so a second launch reads the assignees only once
# this one has set up or rolled back, and a rollback can never release a ticket
# another launch has just claimed. On failure nothing is held.
claim_issues() {
    local lock
    lock="$(git -C "$REPO_DIR" rev-parse --path-format=absolute --git-common-dir)/claude-parallel-claim.lock"
    if ! mkdir "$lock" 2>/dev/null; then
        print_error "Another launch is claiming tickets (lock $lock). Wait for it, or remove the lock if no launch is running."
        return 1
    fi
    LAUNCH_LOCK="$lock"
    # Interrupted from here to finish_launch: roll back, then stop
    trap 'abort_launch; exit 130' INT TERM
    if ! claim_issues_locked "$@"; then
        trap - INT TERM
        free_claim_lock
        return 1
    fi
}
