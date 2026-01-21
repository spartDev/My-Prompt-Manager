#!/bin/bash
# Launch N Claude Code instances in parallel using tmux and git worktrees
# Usage: ./launch-parallel-claude.sh <issue-ids...>
# Example: ./launch-parallel-claude.sh ics gpy f8t

set -e

# Configuration
SESSION="claude-parallel"
REPO_NAME=$(basename "$(git rev-parse --show-toplevel)")
REPO_DIR=$(git rev-parse --show-toplevel)
BASE_DIR="$HOME/.claude-worktrees/$REPO_NAME"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  Parallel Claude Launcher${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
}

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Check dependencies
check_dependencies() {
    if ! command -v tmux &> /dev/null; then
        print_error "tmux is not installed. Install with: brew install tmux"
        exit 1
    fi

    if ! command -v claude &> /dev/null; then
        print_error "claude CLI is not installed"
        exit 1
    fi

    if ! command -v bd &> /dev/null; then
        print_error "beads (bd) is not installed"
        exit 1
    fi
}

# Get issue details from beads
get_issue_details() {
    local issue_id="$1"
    bd show "$issue_id" 2>/dev/null
}

# Extract issue title from bd show output
get_issue_title() {
    local issue_id="$1"
    bd show "$issue_id" 2>/dev/null | grep -E "^Title:" | sed 's/Title: //'
}

# Extract issue priority from bd show output
get_issue_priority() {
    local issue_id="$1"
    bd show "$issue_id" 2>/dev/null | grep -E "^Priority:" | sed 's/Priority: //'
}

# Create worktree for an issue
create_worktree() {
    local issue_id="$1"
    local branch_name="fix-$issue_id"
    local worktree_path="$BASE_DIR/$branch_name"

    if [ -d "$worktree_path" ]; then
        print_warning "Worktree already exists: $worktree_path"
        return 0
    fi

    mkdir -p "$BASE_DIR"

    # Try to create with new branch, fallback to existing branch
    if git -C "$REPO_DIR" worktree add "$worktree_path" -b "$branch_name" 2>/dev/null; then
        print_status "Created worktree: $branch_name (new branch)"
    elif git -C "$REPO_DIR" worktree add "$worktree_path" "$branch_name" 2>/dev/null; then
        print_status "Created worktree: $branch_name (existing branch)"
    else
        print_error "Failed to create worktree for $issue_id"
        return 1
    fi
}

# Generate Claude prompt for an issue
generate_prompt() {
    local issue_id="$1"
    local title=$(get_issue_title "$issue_id")

    # Get detailed description from bd show
    local description=$(bd show "$issue_id" 2>/dev/null | grep -A 50 "^Description:" | head -20)

    echo "Fix issue $issue_id: $title. Review the issue details with 'bd show $issue_id'. Implement the fix, run tests with 'npm test', and close the issue with 'bd close $issue_id' when done."
}

# Launch tmux session with panes
launch_tmux() {
    local -a issues=("$@")
    local count=${#issues[@]}

    if [ "$count" -eq 0 ]; then
        print_error "No issues provided"
        exit 1
    fi

    # Kill existing session
    tmux kill-session -t "$SESSION" 2>/dev/null || true

    print_status "Launching $count Claude instances in tmux session '$SESSION'"

    # Create first pane
    local first_issue="${issues[0]}"
    local first_branch="fix-$first_issue"
    local first_path="$BASE_DIR/$first_branch"
    local first_prompt=$(generate_prompt "$first_issue")
    local first_title=$(get_issue_title "$first_issue")
    local first_priority=$(get_issue_priority "$first_issue")

    tmux new-session -d -s "$SESSION" -c "$first_path" \
        "echo -e '${GREEN}[$first_priority]${NC} $first_title ($first_issue)'; echo ''; claude --dangerously-skip-permissions '$first_prompt'; exec bash"

    # Add additional panes
    for ((i=1; i<count; i++)); do
        local issue="${issues[$i]}"
        local branch="fix-$issue"
        local path="$BASE_DIR/$branch"
        local prompt=$(generate_prompt "$issue")
        local title=$(get_issue_title "$issue")
        local priority=$(get_issue_priority "$issue")

        # Determine split direction based on pane count
        if [ "$count" -le 2 ]; then
            # Horizontal split for 2 panes
            tmux split-window -h -t "$SESSION" -c "$path" \
                "echo -e '${GREEN}[$priority]${NC} $title ($issue)'; echo ''; claude --dangerously-skip-permissions '$prompt'; exec bash"
        elif [ "$count" -le 4 ]; then
            # Create 2x2 grid for 3-4 panes
            if [ "$i" -eq 1 ]; then
                tmux split-window -h -t "$SESSION" -c "$path" \
                    "echo -e '${GREEN}[$priority]${NC} $title ($issue)'; echo ''; claude --dangerously-skip-permissions '$prompt'; exec bash"
            elif [ "$i" -eq 2 ]; then
                tmux split-window -v -t "$SESSION:0.0" -c "$path" \
                    "echo -e '${GREEN}[$priority]${NC} $title ($issue)'; echo ''; claude --dangerously-skip-permissions '$prompt'; exec bash"
            elif [ "$i" -eq 3 ]; then
                tmux split-window -v -t "$SESSION:0.1" -c "$path" \
                    "echo -e '${GREEN}[$priority]${NC} $title ($issue)'; echo ''; claude --dangerously-skip-permissions '$prompt'; exec bash"
            fi
        else
            # For more than 4, just keep splitting
            tmux split-window -t "$SESSION" -c "$path" \
                "echo -e '${GREEN}[$priority]${NC} $title ($issue)'; echo ''; claude --dangerously-skip-permissions '$prompt'; exec bash"
        fi
    done

    # Balance the layout
    tmux select-layout -t "$SESSION" tiled

    print_status "tmux session created. Attaching..."
    echo ""

    # Attach to session
    tmux attach-session -t "$SESSION"
}

# Main interactive mode
interactive_mode() {
    print_header
    echo ""

    # Show ready tasks
    echo -e "${YELLOW}Available ready tasks (no blockers):${NC}"
    echo ""
    bd ready
    echo ""

    # Ask for selection
    echo -e "${BLUE}Enter task IDs to tackle in parallel (space or comma separated):${NC}"
    echo -e "${BLUE}Example: ics gpy f8t${NC}"
    echo ""
    read -p "> " input

    # Parse input (handle both comma and space separated)
    IFS=', ' read -ra issues <<< "$input"

    if [ ${#issues[@]} -eq 0 ]; then
        print_error "No tasks selected"
        exit 1
    fi

    echo ""
    print_status "Selected ${#issues[@]} tasks: ${issues[*]}"
    echo ""

    # Create worktrees
    echo -e "${YELLOW}Creating worktrees...${NC}"
    for issue in "${issues[@]}"; do
        create_worktree "$issue"
    done
    echo ""

    # Launch tmux
    launch_tmux "${issues[@]}"
}

# Direct mode with arguments
direct_mode() {
    local -a issues=("$@")

    print_header
    echo ""
    print_status "Selected ${#issues[@]} tasks: ${issues[*]}"
    echo ""

    # Create worktrees
    echo -e "${YELLOW}Creating worktrees...${NC}"
    for issue in "${issues[@]}"; do
        create_worktree "$issue"
    done
    echo ""

    # Launch tmux
    launch_tmux "${issues[@]}"
}

# Help message
show_help() {
    echo "Usage: $0 [options] [issue-ids...]"
    echo ""
    echo "Launch multiple Claude Code instances in parallel using tmux and git worktrees."
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  -l, --list     List ready tasks and exit"
    echo "  -c, --cleanup  Clean up all worktrees"
    echo ""
    echo "Examples:"
    echo "  $0              # Interactive mode - select tasks from list"
    echo "  $0 ics gpy f8t  # Direct mode - launch with specified task IDs"
    echo "  $0 --list       # Show available tasks"
    echo "  $0 --cleanup    # Remove all parallel worktrees"
}

# Cleanup worktrees
cleanup_worktrees() {
    print_header
    echo ""

    if [ ! -d "$BASE_DIR" ]; then
        print_status "No worktrees to clean up"
        exit 0
    fi

    echo -e "${YELLOW}Worktrees to remove:${NC}"
    ls -1 "$BASE_DIR"
    echo ""

    read -p "Remove all worktrees? (y/N) " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        for dir in "$BASE_DIR"/*; do
            if [ -d "$dir" ]; then
                local name=$(basename "$dir")
                git -C "$REPO_DIR" worktree remove "$dir" --force 2>/dev/null && \
                    print_status "Removed worktree: $name" || \
                    print_warning "Could not remove: $name"
            fi
        done

        # Prune stale worktrees
        git -C "$REPO_DIR" worktree prune
        print_status "Pruned stale worktree references"

        # Remove base directory if empty
        rmdir "$BASE_DIR" 2>/dev/null && print_status "Removed base directory"
    else
        print_warning "Cleanup cancelled"
    fi
}

# Main entry point
main() {
    check_dependencies

    case "${1:-}" in
        -h|--help)
            show_help
            exit 0
            ;;
        -l|--list)
            bd ready
            exit 0
            ;;
        -c|--cleanup)
            cleanup_worktrees
            exit 0
            ;;
        "")
            interactive_mode
            ;;
        *)
            direct_mode "$@"
            ;;
    esac
}

main "$@"
