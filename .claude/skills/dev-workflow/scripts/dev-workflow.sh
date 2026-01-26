#!/bin/bash
# Dev Workflow Orchestrator
# Full development cycle: Plan → Create Tasks → Select → Execute in Parallel → PR → Cleanup
#
# Usage:
#   ./dev-workflow.sh              # Interactive mode
#   ./dev-workflow.sh plan         # Plan & create tasks (interactive)
#   ./dev-workflow.sh select       # Select tasks and launch parallel (interactive)
#   ./dev-workflow.sh select <ids> # Launch with specific task IDs
#   ./dev-workflow.sh cleanup      # Kill tmux & clear worktrees
#   ./dev-workflow.sh status       # Check parallel session status
#   ./dev-workflow.sh kill         # Kill tmux session only (keep worktrees)

set -e

# Configuration
SESSION="claude-parallel"
REPO_NAME=$(basename "$(git rev-parse --show-toplevel)")
REPO_DIR=$(git rev-parse --show-toplevel)
BASE_DIR="$HOME/.claude-worktrees/$REPO_NAME"
MAX_PARALLEL=4

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

print_header() {
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}  ${BOLD}Dev Workflow Orchestrator${NC}                                  ${BLUE}║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_phase() {
    echo -e "${CYAN}━━━ $1 ━━━${NC}"
}

print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}!${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}→${NC} $1"
}

# Check dependencies
check_dependencies() {
    local missing=()

    command -v tmux &> /dev/null || missing+=("tmux")
    command -v claude &> /dev/null || missing+=("claude")
    command -v bd &> /dev/null || missing+=("bd (beads)")
    command -v gh &> /dev/null || missing+=("gh (GitHub CLI)")

    if [ ${#missing[@]} -gt 0 ]; then
        print_error "Missing dependencies: ${missing[*]}"
        exit 1
    fi
}

# Get issue details
get_issue_title() {
    bd show "$1" 2>/dev/null | grep -E "^Title:" | sed 's/Title: //'
}

get_issue_priority() {
    bd show "$1" 2>/dev/null | grep -E "^Priority:" | sed 's/Priority: //'
}

get_issue_type() {
    bd show "$1" 2>/dev/null | grep -E "^Type:" | sed 's/Type: //'
}

get_issue_details() {
    bd show "$1" 2>/dev/null
}

# Determine branch prefix based on issue type
get_branch_prefix() {
    local issue_type="$1"
    case "$issue_type" in
        bug) echo "fix" ;;
        feature) echo "feat" ;;
        refactor) echo "refactor" ;;
        task) echo "task" ;;
        *) echo "fix" ;;
    esac
}

# Create worktree
create_worktree() {
    local issue_id="$1"
    local issue_type=$(get_issue_type "$issue_id")
    local prefix=$(get_branch_prefix "$issue_type")
    local branch_name="$prefix-$issue_id"
    local worktree_path="$BASE_DIR/$branch_name"

    if [ -d "$worktree_path" ]; then
        print_warning "Worktree exists: $branch_name"
        echo "$branch_name"
        return 0
    fi

    mkdir -p "$BASE_DIR"

    if git -C "$REPO_DIR" worktree add "$worktree_path" -b "$branch_name" 2>/dev/null; then
        print_status "Created worktree: $branch_name (new branch)"
    elif git -C "$REPO_DIR" worktree add "$worktree_path" "$branch_name" 2>/dev/null; then
        print_status "Created worktree: $branch_name (existing branch)"
    else
        print_error "Failed to create worktree for $issue_id"
        return 1
    fi

    echo "$branch_name"
}

# Generate comprehensive prompt for Claude instance
generate_prompt() {
    local issue_id="$1"
    local title=$(get_issue_title "$issue_id")
    local issue_type=$(get_issue_type "$issue_id")
    local prefix=$(get_branch_prefix "$issue_type")
    local branch_name="$prefix-$issue_id"
    local details=$(get_issue_details "$issue_id")

    cat <<PROMPT
You are working on issue $issue_id: $title

## Task Details
$details

## Your Mission

1. **Implement**: Make the necessary code changes
2. **Verify**: Run npm test && npm run lint && npm run typecheck
3. **Commit**: Use a conventional commit message
4. **Push**: git push -u origin $branch_name
5. **Create PR**: Use gh pr create (see command below)
6. **Close issue**: bd close $issue_id

## MANDATORY: Create Pull Request

After pushing, you MUST create a PR. Use this command:

gh pr create --title "$prefix($issue_id): $title" --body "## Summary
<describe what was fixed/added>

## Changes
<list changes with reasoning>

## Testing
- [x] npm test passes
- [x] npm run lint passes
- [x] npm run typecheck passes

Fixes issue $issue_id

Generated with Claude Code"

## Rules
- Work ONLY in this worktree
- Do NOT merge to main - create PR only
- Do NOT close issue until PR is created

## CRITICAL: Completion Checklist

Your work is NOT complete until ALL of these are done:
[ ] Code changes committed
[ ] Branch pushed to origin
[ ] Pull request created (you should see a PR URL)
[ ] Issue closed with bd close $issue_id

DO NOT stop or say you are done until you have created the PR and see the PR URL.
PROMPT
}

# Launch tmux session with parallel Claude instances
launch_parallel() {
    local -a issues=("$@")
    local count=${#issues[@]}

    if [ "$count" -eq 0 ]; then
        print_error "No issues provided"
        return 1
    fi

    if [ "$count" -gt "$MAX_PARALLEL" ]; then
        print_warning "Maximum $MAX_PARALLEL parallel instances allowed"
        print_info "Using first $MAX_PARALLEL issues"
        issues=("${issues[@]:0:$MAX_PARALLEL}")
        count=$MAX_PARALLEL
    fi

    # Kill existing session
    tmux kill-session -t "$SESSION" 2>/dev/null || true

    print_phase "Launching $count parallel Claude instances"
    echo ""

    # Claim all issues first
    print_info "Claiming issues..."
    for issue in "${issues[@]}"; do
        bd update "$issue" --status in_progress 2>/dev/null || true
    done
    echo ""

    # Create worktrees
    print_info "Creating worktrees..."
    local -a branches=()
    for issue in "${issues[@]}"; do
        local branch=$(create_worktree "$issue")
        branches+=("$branch")
    done
    echo ""

    # Create first pane
    local first_issue="${issues[0]}"
    local first_branch="${branches[0]}"
    local first_path="$BASE_DIR/$first_branch"
    local first_prompt=$(generate_prompt "$first_issue")
    local first_title=$(get_issue_title "$first_issue")
    local first_priority=$(get_issue_priority "$first_issue")

    # Escape single quotes in prompt for shell
    first_prompt="${first_prompt//\'/\'\\\'\'}"

    tmux new-session -d -s "$SESSION" -c "$first_path" \
        "echo -e '${GREEN}[$first_priority]${NC} $first_title ($first_issue)'; echo ''; echo 'Starting Claude...'; sleep 1; claude --dangerously-skip-permissions '$first_prompt'; exec bash"

    # Add additional panes
    for ((i=1; i<count; i++)); do
        local issue="${issues[$i]}"
        local branch="${branches[$i]}"
        local path="$BASE_DIR/$branch"
        local prompt=$(generate_prompt "$issue")
        local title=$(get_issue_title "$issue")
        local priority=$(get_issue_priority "$issue")

        # Escape single quotes
        prompt="${prompt//\'/\'\\\'\'}"

        # Layout logic
        if [ "$count" -le 2 ]; then
            tmux split-window -h -t "$SESSION" -c "$path" \
                "echo -e '${GREEN}[$priority]${NC} $title ($issue)'; echo ''; echo 'Starting Claude...'; sleep 1; claude --dangerously-skip-permissions '$prompt'; exec bash"
        elif [ "$count" -le 4 ]; then
            if [ "$i" -eq 1 ]; then
                tmux split-window -h -t "$SESSION" -c "$path" \
                    "echo -e '${GREEN}[$priority]${NC} $title ($issue)'; echo ''; echo 'Starting Claude...'; sleep 1; claude --dangerously-skip-permissions '$prompt'; exec bash"
            elif [ "$i" -eq 2 ]; then
                tmux split-window -v -t "$SESSION:0.0" -c "$path" \
                    "echo -e '${GREEN}[$priority]${NC} $title ($issue)'; echo ''; echo 'Starting Claude...'; sleep 1; claude --dangerously-skip-permissions '$prompt'; exec bash"
            elif [ "$i" -eq 3 ]; then
                tmux split-window -v -t "$SESSION:0.1" -c "$path" \
                    "echo -e '${GREEN}[$priority]${NC} $title ($issue)'; echo ''; echo 'Starting Claude...'; sleep 1; claude --dangerously-skip-permissions '$prompt'; exec bash"
            fi
        fi
    done

    # Balance layout
    tmux select-layout -t "$SESSION" tiled

    print_status "Launched $count Claude instances"
    echo ""
    print_info "tmux commands:"
    echo "  Ctrl+B, arrows  - Switch panes"
    echo "  Ctrl+B, z       - Zoom pane"
    echo "  Ctrl+B, d       - Detach"
    echo ""
    print_info "Attaching to session..."
    sleep 1

    tmux attach-session -t "$SESSION"
}

# Interactive task selection
select_tasks() {
    print_phase "Select Tasks for Parallel Execution"
    echo ""

    echo -e "${YELLOW}Available ready tasks (no blockers):${NC}"
    echo ""
    bd ready
    echo ""

    echo -e "${BLUE}Enter task IDs to tackle in parallel (max $MAX_PARALLEL):${NC}"
    echo -e "${BLUE}Example: abc def ghi${NC}"
    echo ""
    read -p "> " input

    # Parse input
    IFS=', ' read -ra issues <<< "$input"

    if [ ${#issues[@]} -eq 0 ]; then
        print_error "No tasks selected"
        exit 1
    fi

    echo ""
    print_status "Selected ${#issues[@]} tasks: ${issues[*]}"
    echo ""

    launch_parallel "${issues[@]}"
}

# Check session status
check_status() {
    print_phase "Parallel Session Status"
    echo ""

    if tmux has-session -t "$SESSION" 2>/dev/null; then
        print_status "Session '$SESSION' is running"
        echo ""

        # Get pane count
        local panes=$(tmux list-panes -t "$SESSION" 2>/dev/null | wc -l)
        print_info "$panes active panes"
        echo ""

        # Show worktrees
        if [ -d "$BASE_DIR" ]; then
            print_info "Active worktrees:"
            for dir in "$BASE_DIR"/*; do
                if [ -d "$dir" ]; then
                    local name=$(basename "$dir")
                    local branch=$(git -C "$dir" branch --show-current 2>/dev/null || echo "unknown")
                    echo "    $name ($branch)"
                fi
            done
        fi

        echo ""
        print_info "To attach: tmux attach-session -t $SESSION"
    else
        print_warning "No active parallel session"

        # Check for orphaned worktrees
        if [ -d "$BASE_DIR" ] && [ "$(ls -A "$BASE_DIR" 2>/dev/null)" ]; then
            echo ""
            print_warning "Orphaned worktrees found:"
            for dir in "$BASE_DIR"/*; do
                if [ -d "$dir" ]; then
                    echo "    $(basename "$dir")"
                fi
            done
            echo ""
            print_info "Run './dev-workflow.sh cleanup' to remove them"
        fi
    fi
}

# Kill tmux session only
kill_session() {
    print_phase "Killing tmux Session"
    echo ""

    if tmux has-session -t "$SESSION" 2>/dev/null; then
        tmux kill-session -t "$SESSION"
        print_status "Killed session '$SESSION'"
    else
        print_warning "No active session to kill"
    fi
}

# Full cleanup
cleanup() {
    print_phase "Cleanup"
    echo ""

    # Kill tmux session
    if tmux has-session -t "$SESSION" 2>/dev/null; then
        print_info "Killing tmux session..."
        tmux kill-session -t "$SESSION"
        print_status "Killed session '$SESSION'"
    else
        print_info "No active tmux session"
    fi

    echo ""

    # Clean up worktrees
    if [ ! -d "$BASE_DIR" ] || [ -z "$(ls -A "$BASE_DIR" 2>/dev/null)" ]; then
        print_info "No worktrees to clean up"
    else
        echo -e "${YELLOW}Worktrees to remove:${NC}"
        for dir in "$BASE_DIR"/*; do
            if [ -d "$dir" ]; then
                echo "    $(basename "$dir")"
            fi
        done
        echo ""

        read -p "Remove all worktrees? (y/N) " confirm
        if [[ "$confirm" =~ ^[Yy]$ ]]; then
            for dir in "$BASE_DIR"/*; do
                if [ -d "$dir" ]; then
                    local name=$(basename "$dir")
                    if git -C "$REPO_DIR" worktree remove "$dir" --force 2>/dev/null; then
                        print_status "Removed: $name"
                    else
                        print_warning "Could not remove: $name"
                    fi
                fi
            done

            # Prune stale references
            git -C "$REPO_DIR" worktree prune
            print_status "Pruned stale worktree references"

            # Remove base directory
            rmdir "$BASE_DIR" 2>/dev/null && print_status "Removed base directory" || true
        else
            print_warning "Cleanup cancelled"
        fi
    fi

    echo ""

    # Sync beads
    print_info "Syncing beads..."
    bd sync 2>/dev/null && print_status "Beads synced" || print_warning "Beads sync skipped"
}

# Show help
show_help() {
    echo "Dev Workflow Orchestrator"
    echo ""
    echo "Usage: $0 [command] [args]"
    echo ""
    echo "Commands:"
    echo "  (none)          Interactive mode - full workflow"
    echo "  plan            Plan and create beads tasks (opens Claude)"
    echo "  select          Select tasks and launch parallel instances"
    echo "  select <ids>    Launch parallel with specific task IDs"
    echo "  status          Check parallel session status"
    echo "  kill            Kill tmux session (keep worktrees)"
    echo "  cleanup         Kill session and remove all worktrees"
    echo "  help            Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                    # Interactive mode"
    echo "  $0 select abc def     # Launch parallel with tasks abc and def"
    echo "  $0 cleanup            # Clean up everything"
    echo ""
    echo "tmux Navigation:"
    echo "  Ctrl+B, arrows    Switch between panes"
    echo "  Ctrl+B, z         Zoom/unzoom current pane"
    echo "  Ctrl+B, d         Detach (instances keep running)"
    echo ""
}

# Interactive mode
interactive_mode() {
    print_header

    echo "What would you like to do?"
    echo ""
    echo "  1) Plan a feature/bugfix/refactor (create beads tasks)"
    echo "  2) Select tasks and launch parallel Claude instances"
    echo "  3) Check parallel session status"
    echo "  4) Cleanup (kill session & remove worktrees)"
    echo "  5) Exit"
    echo ""
    read -p "Choice [1-5]: " choice

    case "$choice" in
        1)
            echo ""
            print_phase "Planning Mode"
            echo ""
            print_info "Starting Claude to help plan your work..."
            print_info "Describe your feature/bugfix/refactor and Claude will create beads tasks."
            echo ""
            claude "Help me plan and break down my work into beads tasks. Ask me what I want to build or fix, then create appropriate beads issues with 'bd create'. Use types: feature, task, bug, or refactor. Set appropriate priorities (0=critical, 2=medium, 4=backlog)."
            ;;
        2)
            echo ""
            select_tasks
            ;;
        3)
            echo ""
            check_status
            ;;
        4)
            echo ""
            cleanup
            ;;
        5)
            echo "Goodbye!"
            exit 0
            ;;
        *)
            print_error "Invalid choice"
            exit 1
            ;;
    esac
}

# Main
main() {
    check_dependencies

    case "${1:-}" in
        -h|--help|help)
            show_help
            ;;
        plan)
            print_header
            print_phase "Planning Mode"
            echo ""
            print_info "Starting Claude to help plan your work..."
            claude "Help me plan and break down my work into beads tasks. Ask me what I want to build or fix, then create appropriate beads issues with 'bd create'. Use types: feature, task, bug, or refactor."
            ;;
        select)
            print_header
            if [ $# -gt 1 ]; then
                shift
                launch_parallel "$@"
            else
                select_tasks
            fi
            ;;
        status)
            print_header
            check_status
            ;;
        kill)
            print_header
            kill_session
            ;;
        cleanup)
            print_header
            cleanup
            ;;
        "")
            interactive_mode
            ;;
        *)
            # Assume arguments are task IDs
            print_header
            launch_parallel "$@"
            ;;
    esac
}

main "$@"
