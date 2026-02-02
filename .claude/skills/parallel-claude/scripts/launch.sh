#!/usr/bin/env bash
# shellcheck disable=SC2155  # Allow declare and assign on same line
# Parallel Claude Launcher
# Launch N Claude instances in tmux with git worktrees
#
# Usage:
#   ./launch.sh <id1> <id2> ...   Launch with specific task IDs
#   ./launch.sh --list            Show ready tasks
#   ./launch.sh --status          Check session status
#   ./launch.sh --kill            Kill tmux session only
#   ./launch.sh --cleanup         Kill session + remove worktrees

set -e

# Configuration
SESSION="claude-parallel"
REPO_NAME=$(basename "$(git rev-parse --show-toplevel)")
REPO_DIR=$(git rev-parse --show-toplevel)
BASE_DIR="$HOME/.claude-worktrees/$REPO_NAME"
MAX_PARALLEL=4
CACHE_DIR="${TMPDIR:-/tmp}/parallel-claude-cache-$$"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

print_header() {
    echo -e "${BLUE}══════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  ${BOLD}Parallel Claude Launcher${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════${NC}"
    echo ""
}

print_status() { echo -e "${GREEN}[✓]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
print_error() { echo -e "${RED}[✗]${NC} $1"; }
print_info() { echo -e "${BLUE}[→]${NC} $1"; }

check_dependencies() {
    local missing=()
    command -v tmux &>/dev/null || missing+=("tmux")
    command -v claude &>/dev/null || missing+=("claude")
    command -v bd &>/dev/null || missing+=("bd (beads)")

    if [ ${#missing[@]} -gt 0 ]; then
        print_error "Missing: ${missing[*]}"
        echo "  Install tmux: brew install tmux"
        exit 1
    fi
}

cleanup_cache() {
    rm -rf "$CACHE_DIR" 2>/dev/null || true
}
trap cleanup_cache EXIT

# Get issue metadata (file-based cache for bash 3 compatibility)
get_issue_data() {
    local id="$1"
    local cache_file="$CACHE_DIR/$(echo "$id" | tr '/' '_')"

    mkdir -p "$CACHE_DIR"
    if [ ! -f "$cache_file" ]; then
        bd show "$id" 2>/dev/null > "$cache_file" || true
    fi
    cat "$cache_file"
}
get_title() { get_issue_data "$1" | grep -E "^Title:" | sed 's/Title: //'; }
get_priority() { get_issue_data "$1" | grep -E "^Priority:" | sed 's/Priority: //'; }
get_type() { get_issue_data "$1" | grep -E "^Type:" | sed 's/Type: //'; }
get_details() { get_issue_data "$1"; }

get_branch_prefix() {
    case "$1" in
        bug) echo "fix" ;;
        feature) echo "feat" ;;
        refactor) echo "refactor" ;;
        *) echo "task" ;;
    esac
}

create_worktree() {
    local issue_id="$1"
    local issue_type=$(get_type "$issue_id")
    local prefix=$(get_branch_prefix "$issue_type")
    local branch="$prefix-$issue_id"
    local path="$BASE_DIR/$branch"

    if [ -d "$path" ]; then
        print_warning "Worktree exists: $branch"
        echo "$branch"
        return 0
    fi

    mkdir -p "$BASE_DIR"

    if git -C "$REPO_DIR" worktree add "$path" -b "$branch" 2>/dev/null; then
        print_status "Created: $branch (new)"
    elif git -C "$REPO_DIR" worktree add "$path" "$branch" 2>/dev/null; then
        print_status "Created: $branch (existing)"
    else
        print_error "Failed to create worktree: $issue_id"
        return 1
    fi

    echo "$branch"
}

generate_prompt() {
    local issue_id="$1"
    local title=$(get_title "$issue_id")
    local issue_type=$(get_type "$issue_id")
    local prefix=$(get_branch_prefix "$issue_type")
    local branch="$prefix-$issue_id"
    local details=$(get_details "$issue_id")

    cat <<PROMPT
Working on issue $issue_id: $title
Branch: $branch

## Task Details
$details

## Mission
1. Read issue details above
2. Find relevant files before changes
3. Implement minimal focused changes
4. Verify: npm test && npm run lint && npm run typecheck
5. Commit: $prefix($issue_id): description
6. Push: git push -u origin $branch
7. Load /git-pr skill and create PR
8. Close: bd close $issue_id

## Rules
- Work ONLY in this worktree
- Minimal changes only
- Do NOT merge to main
- Do NOT stop until PR URL visible

STOP when you see: https://github.com/...
PROMPT
}

launch_parallel() {
    local -a issues=("$@")
    local count=${#issues[@]}

    if [ "$count" -eq 0 ]; then
        print_error "No issues provided"
        echo ""
        echo "Usage: $0 <id1> <id2> ..."
        echo "       $0 --list"
        exit 1
    fi

    if [ "$count" -gt "$MAX_PARALLEL" ]; then
        print_warning "Max $MAX_PARALLEL instances. Using first $MAX_PARALLEL."
        issues=("${issues[@]:0:$MAX_PARALLEL}")
        count=$MAX_PARALLEL
    fi

    # Kill existing session
    tmux kill-session -t "$SESSION" 2>/dev/null || true

    print_info "Launching $count parallel instances..."
    echo ""

    # Claim issues
    print_info "Claiming issues..."
    for issue in "${issues[@]}"; do
        if ! bd update "$issue" --status in_progress 2>/dev/null; then
            print_warning "Could not claim $issue (may already be in progress)"
        fi
    done

    # Create worktrees
    echo ""
    print_info "Creating worktrees..."
    local -a branches=()
    for issue in "${issues[@]}"; do
        local branch=$(create_worktree "$issue")
        branches+=("$branch")
    done

    # Create first pane
    local first_issue="${issues[0]}"
    local first_branch="${branches[0]}"
    local first_path="$BASE_DIR/$first_branch"
    local first_prompt=$(generate_prompt "$first_issue")
    local first_title=$(get_title "$first_issue")
    local first_priority=$(get_priority "$first_issue")

    first_prompt="${first_prompt//\'/\'\\\'\'}"

    # NOTE: --dangerously-skip-permissions allows automated execution
    # Only use in trusted environments with reviewed task prompts
    # Explicitly cd to worktree path - tmux -c is unreliable with shell commands
    tmux new-session -d -s "$SESSION" \
        "cd '$first_path' && echo -e '${GREEN}[$first_priority]${NC} $first_title ($first_issue)'; echo ''; claude --dangerously-skip-permissions '$first_prompt'; exec bash"

    # Add more panes
    for ((i=1; i<count; i++)); do
        local issue="${issues[$i]}"
        local branch="${branches[$i]}"
        local path="$BASE_DIR/$branch"
        local prompt=$(generate_prompt "$issue")
        local title=$(get_title "$issue")
        local priority=$(get_priority "$issue")

        prompt="${prompt//\'/\'\\\'\'}"

        # Explicitly cd to worktree path - tmux -c is unreliable with shell commands
        tmux split-window -t "$SESSION" \
            "cd '$path' && echo -e '${GREEN}[$priority]${NC} $title ($issue)'; echo ''; claude --dangerously-skip-permissions '$prompt'; exec bash" 2>/dev/null || true

        tmux select-layout -t "$SESSION" tiled
        sleep 0.2
    done

    tmux select-layout -t "$SESSION" tiled

    echo ""
    print_status "Launched $count instances"
    echo ""
    echo -e "${CYAN}━━━ tmux Navigation ━━━${NC}"
    echo "  Ctrl+B, arrows  Switch panes"
    echo "  Ctrl+B, z       Zoom/unzoom"
    echo "  Ctrl+B, d       Detach"
    echo ""
    print_info "Attaching..."
    sleep 1

    tmux attach-session -t "$SESSION"
}

show_status() {
    print_header

    if tmux has-session -t "$SESSION" 2>/dev/null; then
        print_status "Session '$SESSION' is running"
        echo ""

        local panes=$(tmux list-panes -t "$SESSION" 2>/dev/null | wc -l)
        print_info "$panes active panes"

        if [ -d "$BASE_DIR" ]; then
            echo ""
            print_info "Worktrees:"
            for dir in "$BASE_DIR"/*; do
                [ -d "$dir" ] && echo "    $(basename "$dir")"
            done
        fi

        echo ""
        echo "Attach: tmux attach-session -t $SESSION"
    else
        print_warning "No active session"

        if [ -d "$BASE_DIR" ] && [ "$(ls -A "$BASE_DIR" 2>/dev/null)" ]; then
            echo ""
            print_warning "Orphaned worktrees:"
            for dir in "$BASE_DIR"/*; do
                [ -d "$dir" ] && echo "    $(basename "$dir")"
            done
            echo ""
            echo "Run: $0 --cleanup"
        fi
    fi
}

kill_session() {
    print_header
    if tmux has-session -t "$SESSION" 2>/dev/null; then
        tmux kill-session -t "$SESSION"
        print_status "Killed session"
    else
        print_warning "No session to kill"
    fi
}

cleanup() {
    local force="${1:-}"
    print_header

    # Kill tmux
    if tmux has-session -t "$SESSION" 2>/dev/null; then
        tmux kill-session -t "$SESSION"
        print_status "Killed tmux session"
    fi

    # Remove worktrees
    if [ ! -d "$BASE_DIR" ] || [ -z "$(ls -A "$BASE_DIR" 2>/dev/null)" ]; then
        print_info "No worktrees to clean"
        return 0
    fi

    echo ""
    echo -e "${YELLOW}Worktrees to remove:${NC}"
    for dir in "$BASE_DIR"/*; do
        [ -d "$dir" ] && echo "    $(basename "$dir")"
    done
    echo ""

    # Auto-confirm if --force or non-interactive (no tty)
    local confirm="n"
    if [ "$force" = "--force" ] || [ "$force" = "-f" ]; then
        confirm="y"
        print_info "Force mode: skipping confirmation"
    elif [ ! -t 0 ]; then
        # Non-interactive (e.g., running from Claude Code)
        confirm="y"
        print_info "Non-interactive mode: auto-confirming cleanup"
    else
        read -rp "Remove all? (y/N) " confirm
    fi

    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        for dir in "$BASE_DIR"/*; do
            if [ -d "$dir" ]; then
                local name=$(basename "$dir")
                git -C "$REPO_DIR" worktree remove "$dir" --force 2>/dev/null && \
                    print_status "Removed: $name" || \
                    print_warning "Could not remove: $name"
            fi
        done

        git -C "$REPO_DIR" worktree prune
        print_status "Pruned references"
        rmdir "$BASE_DIR" 2>/dev/null || true
    else
        print_warning "Cancelled"
    fi
}

show_list() {
    print_header
    print_info "Ready tasks (no blockers):"
    echo ""
    bd ready
}

show_help() {
    echo "Parallel Claude Launcher"
    echo ""
    echo "Usage: $0 [options] [task-ids...]"
    echo ""
    echo "Options:"
    echo "  --list           Show ready tasks"
    echo "  --status         Check session status"
    echo "  --kill           Kill tmux session only"
    echo "  --cleanup [-f]   Kill + remove worktrees (auto-confirms in non-interactive mode)"
    echo "  -h, --help       Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 abc def           Launch with tasks abc, def"
    echo "  $0 --list            Show available tasks"
    echo "  $0 --cleanup         Clean everything (prompts in terminal)"
    echo "  $0 --cleanup -f      Clean everything (force, no prompt)"
}

# Main
main() {
    check_dependencies

    case "${1:-}" in
        -h|--help) show_help ;;
        --list|-l) show_list ;;
        --status|-s) show_status ;;
        --kill|-k) kill_session ;;
        --cleanup|-c) cleanup "${2:-}" ;;
        "") show_help ;;
        *) print_header; launch_parallel "$@" ;;
    esac
}

main "$@"
