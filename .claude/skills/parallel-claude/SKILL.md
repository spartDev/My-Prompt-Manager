---
name: Parallel Claude Launcher
description: Launch multiple Claude Code instances in parallel using tmux and git worktrees to tackle beads tasks concurrently
---

# Parallel Claude Launcher

This skill launches N Claude Code instances in parallel using tmux and git worktrees, where each instance works on a different beads task.

## Quick Start

```bash
# Interactive mode - shows ready tasks, asks for selection
.claude/skills/parallel-claude/scripts/launch-parallel-claude.sh

# Direct mode - specify task IDs directly
.claude/skills/parallel-claude/scripts/launch-parallel-claude.sh ics gpy f8t

# List available tasks
.claude/skills/parallel-claude/scripts/launch-parallel-claude.sh --list

# Clean up worktrees when done
.claude/skills/parallel-claude/scripts/launch-parallel-claude.sh --cleanup
```

**Tip:** Add an alias to your shell for convenience:
```bash
alias parallel-claude='.claude/skills/parallel-claude/scripts/launch-parallel-claude.sh'
```

## When to Use This Skill

Use this skill when you want to:
- Work on multiple beads issues simultaneously
- Speed up batch processing of P0/P1/P2 bugs or tasks
- Parallelize independent work items

**Trigger phrases:**
- `/parallel-claude`
- "launch parallel claude"
- "run parallel instances"
- "tackle multiple issues"

## Prerequisites

- **tmux** must be installed (`brew install tmux`)
- **Git worktrees** support (built into git)
- **beads** initialized in the project (`bd init`)
- **Clean working tree** - No uncommitted changes in main repo
- **Main branch up to date** - Run `git pull` before starting

## Selecting Issues for Parallel Work

### Good Candidates
- Issues in different files/components (no merge conflicts)
- Same priority level (P0s together, P1s together)
- Independent work with no dependencies between them
- Issues you can verify independently

### Avoid Parallelizing
- Issues that touch the same files
- Issues with dependencies (`bd show <id>` shows "Blocked by")
- Large architectural changes
- Issues requiring shared state changes

### Check for Dependencies
```bash
# View what blocks an issue
bd show <id> | grep -A5 "Dependencies:"

# List all blocked issues
bd blocked
```

## AI Assistant Workflow

When the user invokes this skill (`/parallel-claude`), Claude should:

### Step 1: Show Ready Tasks

Run the helper script in list mode:

```bash
.claude/skills/parallel-claude/scripts/launch-parallel-claude.sh --list
```

### Step 2: Ask User for Selection

**CRITICAL**: Present the task list and ask the user which tasks they want to tackle in parallel.

Use `AskUserQuestion` or prompt:
```
Which tasks do you want to tackle in parallel?

Enter task IDs separated by spaces or commas (e.g., "ics gpy f8t")
```

### Step 2.5: Claim Selected Issues

Before launching, claim all selected issues to prevent conflicts:

```bash
bd update ics --status in_progress
bd update gpy --status in_progress
bd update f8t --status in_progress
```

### Step 3: Launch Parallel Instances

Once the user selects tasks, run the helper script with the selected IDs:

```bash
.claude/skills/parallel-claude/scripts/launch-parallel-claude.sh <selected-ids>
```

Example:
```bash
.claude/skills/parallel-claude/scripts/launch-parallel-claude.sh ics gpy f8t
```

The script will:
1. Create git worktrees for each task (branch: `fix-<id>`)
2. Set up tmux panes in a tiled layout
3. Launch Claude in each pane with task-specific prompts

**Worktree location:** `$HOME/.claude-worktrees/<repo-name>/fix-<issue-id>`

## Monitoring Parallel Progress

### tmux Navigation
- `Ctrl+B, arrow keys` - Switch between panes
- `Ctrl+B, z` - Zoom/unzoom current pane (full screen)
- `Ctrl+B, [` - Enter scroll mode (q to exit)
- `Ctrl+B, d` - Detach (instances keep running)

### Reattach to Session
```bash
tmux attach-session -t claude-parallel
```

### Check Status Without Attaching
```bash
# List all tmux sessions
tmux list-sessions

# Preview session content
tmux capture-pane -t claude-parallel:0.0 -p | tail -20
```

## Branch Naming Convention

The script uses `fix-<id>` by default. For more descriptive names:

| Issue Type | Branch Prefix | Example |
|------------|--------------|---------|
| bug        | `fix-`       | `fix-ics` |
| feature    | `feat-`      | `feat-ics` |
| task       | `task-`      | `task-ics` |
| refactor   | `refactor-`  | `refactor-ics` |

## Manual Workflow (without helper script)

Generate a script like this for the selected tasks:

```bash
#!/bin/bash
SESSION="claude-parallel"
BASE_DIR="$HOME/.claude-worktrees/My-Prompt-Manager"
REPO_DIR="/Users/e0538224/Developer/My-Prompt-Manager"

# Kill existing session if it exists
tmux kill-session -t "$SESSION" 2>/dev/null

# Create worktrees for each task (if they don't exist)
mkdir -p "$BASE_DIR"

# Task 1 worktree
BRANCH1="fix-ics"
if [ ! -d "$BASE_DIR/$BRANCH1" ]; then
  git -C "$REPO_DIR" worktree add "$BASE_DIR/$BRANCH1" -b "$BRANCH1"
fi

# Create tmux session with first pane
tmux new-session -d -s "$SESSION" -c "$BASE_DIR/$BRANCH1" \
  "claude --dangerously-skip-permissions 'Fix issue ics: <task description>. Run tests when done.'"

# Add more panes for additional tasks...
tmux split-window -h -t "$SESSION" -c "$BASE_DIR/$BRANCH2" \
  "claude --dangerously-skip-permissions 'Fix issue gpy: <task description>. Run tests when done.'"

# Attach to session
tmux attach-session -t "$SESSION"
```

## Script Generation Rules

### Worktree Branch Names

Convert issue ID to branch name:
- `My-Prompt-Manager-ics` → `fix-ics`
- `My-Prompt-Manager-gpy` → `fix-gpy`

### Claude Prompts

Each Claude instance should receive:
1. Issue ID
2. File location (if available from `bd show`)
3. Brief description of the fix
4. Instruction to run tests when done

Format:
```
Fix issue <id>: <file:lines if available> - <description>. Run tests when done.
```

### Tmux Layout

For N tasks:
- 1-2 tasks: Horizontal split
- 3-4 tasks: 2x2 grid
- 5+ tasks: Vertical splits with scrolling

Layout commands:
```bash
# 2 panes (horizontal)
tmux split-window -h

# 4 panes (2x2 grid)
tmux split-window -h
tmux split-window -v -t 0
tmux split-window -v -t 1

# Balance all panes
tmux select-layout tiled
```

## Complete Example

User selects tasks 1, 2, 3 (ics, gpy, f8t):

```bash
#!/bin/bash
SESSION="claude-parallel"
BASE_DIR="$HOME/.claude-worktrees/My-Prompt-Manager"
REPO_DIR="/Users/e0538224/Developer/My-Prompt-Manager"

# Kill existing session
tmux kill-session -t "$SESSION" 2>/dev/null

# Create base directory
mkdir -p "$BASE_DIR"

# Create worktrees
for branch in fix-ics fix-gpy fix-f8t; do
  if [ ! -d "$BASE_DIR/$branch" ]; then
    git -C "$REPO_DIR" worktree add "$BASE_DIR/$branch" -b "$branch" 2>/dev/null || \
    git -C "$REPO_DIR" worktree add "$BASE_DIR/$branch" "$branch"
  fi
done

# Create tmux session with first pane (P0: clipboard memory leak)
tmux new-session -d -s "$SESSION" -c "$BASE_DIR/fix-ics" \
  "echo 'P0: Fix memory leak in useClipboard (ics)'; claude --dangerously-skip-permissions 'Fix issue ics: useClipboard.ts - setTimeout not cleaned up on unmount. Store timeout IDs in refs and clear on cleanup. Run tests when done.'"

# Split horizontally for second pane (P1: clearSearch)
tmux split-window -h -t "$SESSION" -c "$BASE_DIR/fix-gpy" \
  "echo 'P1: Fix no-op clearSearch (gpy)'; claude --dangerously-skip-permissions 'Fix issue gpy: useSearch.ts - clearSearch does nothing. Remove it from the hook since parent handles clearing. Run tests when done.'"

# Split first pane vertically for third pane (P2: dependency arrays)
tmux split-window -v -t "$SESSION:0.0" -c "$BASE_DIR/fix-f8t" \
  "echo 'P2: Fix dependency arrays (f8t)'; claude --dangerously-skip-permissions 'Fix issue f8t: useCategories.ts vs usePrompts.ts - inconsistent dependency arrays. Align the patterns. Run tests when done.'"

# Attach to session
tmux attach-session -t "$SESSION"
```

## Post-Completion Workflow

After all Claude instances complete:

### 1. Review Each Branch
```bash
for branch in fix-ics fix-gpy fix-f8t; do
  echo "=== $branch ==="
  git log main..$branch --oneline
  git diff main..$branch --stat
done
```

### 2. Run Verification on Each Branch
```bash
cd "$HOME/.claude-worktrees/My-Prompt-Manager/fix-ics"
npm test && npm run lint && npm run typecheck
# Repeat for each branch
```

### 3. Create Pull Requests (NOT Direct Merge)

**IMPORTANT**: Never merge directly into main. Create PRs for code review.

For each completed branch:
```bash
cd "$HOME/.claude-worktrees/My-Prompt-Manager/fix-ics"
git push -u origin fix-ics

# Create PR with detailed description
gh pr create --title "fix(ics): <clear title>" --body "$(cat <<'EOF'
## Summary
- What the issue was
- How this PR fixes it

## Changes Made
- List specific code changes
- Explain WHY each change was made (not just what)

## Technical Details
- Any architectural decisions
- Why this approach over alternatives

## Testing
- [ ] Unit tests pass
- [ ] Lint passes
- [ ] TypeScript checks pass
- [ ] Manual testing done (describe)

## Related
- Fixes issue ics
- See `bd show ics` for full context

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### 4. Close Issues & Sync (MANDATORY)
```bash
# Close issues (PRs will merge later after review)
bd close ics gpy f8t
bd sync
git push  # Push beads changes
git status  # MUST show "up to date with origin"
```

**CRITICAL**: Work is NOT complete until all branches are pushed and PRs are created.

## Cleanup

After parallel work is complete:

```bash
# List worktrees
git worktree list

# Remove completed worktrees
git worktree remove "$HOME/.claude-worktrees/My-Prompt-Manager/fix-ics"

# Or prune all stale worktrees
git worktree prune
```

## Error Recovery

### If One Instance Fails

1. **Don't panic** - Other instances continue working
2. **Review the failure** in that pane
3. **Options**:
   - Fix manually in that worktree
   - Kill that pane and retry: `tmux kill-pane -t claude-parallel:0.1`
   - Start fresh for that issue:
     ```bash
     git worktree remove "$HOME/.claude-worktrees/My-Prompt-Manager/fix-ics" --force
     .claude/skills/parallel-claude/scripts/launch-parallel-claude.sh ics
     ```

### If tmux Session Dies

Worktrees persist. Resume with:
```bash
.claude/skills/parallel-claude/scripts/launch-parallel-claude.sh ics gpy f8t
```
The script detects existing worktrees and reuses them.

## Limitations

- **Max ~4 concurrent instances** - More than 4 becomes hard to monitor
- **No automatic conflict resolution** - Manual merge required
- **Shared npm/build cache** - May cause occasional conflicts
- **Each instance uses full context** - Consider API costs

## Troubleshooting

### Worktree already exists
```bash
# Remove and recreate
git worktree remove "$BASE_DIR/fix-ics" --force
git worktree add "$BASE_DIR/fix-ics" -b fix-ics
```

### Branch already exists
```bash
# Use existing branch instead of creating new
git worktree add "$BASE_DIR/fix-ics" fix-ics
```

### tmux session exists
```bash
# The script automatically kills existing session
tmux kill-session -t claude-parallel
```

---

**Last Updated:** 2026-01-21
**Skill Version:** 1.1.0
