---
name: Dev Workflow Orchestrator
description: |
  Full development workflow from idea to parallel execution. Use when planning features/bugfixes/refactors,
  breaking work into beads tasks, selecting tasks to parallelize (max 4), launching Claude instances in
  tmux worktrees, and cleaning up after completion. Triggers: "plan feature", "plan refactor", "plan bugfix",
  "start parallel work", "launch parallel", "cleanup worktrees", "kill parallel", or /dev-workflow.
disable-model-invocation: true
---

# Dev Workflow Orchestrator

Orchestrates the full development cycle: Plan → Create Tasks → Select → Execute in Parallel → PR → Cleanup.

## Workflow Overview

```
┌─────────────┐    ┌──────────────┐    ┌────────────────┐    ┌──────────────┐    ┌─────────┐
│ 1. PLAN     │ → │ 2. CREATE    │ → │ 3. SELECT      │ → │ 4. EXECUTE   │ → │ 5. DONE │
│ Idea/scope  │    │ Beads tasks  │    │ N tasks (≤4)   │    │ Parallel PRs │    │ Cleanup │
└─────────────┘    └──────────────┘    └────────────────┘    └──────────────┘    └─────────┘
```

## Quick Commands

```bash
# Full workflow (interactive)
.claude/skills/dev-workflow/scripts/dev-workflow.sh

# Individual steps
.claude/skills/dev-workflow/scripts/dev-workflow.sh plan      # Plan & create tasks
.claude/skills/dev-workflow/scripts/dev-workflow.sh select    # Select & launch parallel
.claude/skills/dev-workflow/scripts/dev-workflow.sh cleanup   # Kill tmux & clear worktrees
.claude/skills/dev-workflow/scripts/dev-workflow.sh status    # Check parallel session status
```

## Phase 1: Planning

When user describes a feature, bugfix, or refactor:

### Step 1.1: Understand the Scope

Ask clarifying questions:
- What is the goal?
- What files/components are involved?
- Any constraints or dependencies?

### Step 1.2: Break Down into Tasks

Create beads tasks for each discrete piece of work:

```bash
# Every ticket carries its acceptance criteria
bd create --title="Implement X component" --description="why it exists, what to do" --acceptance="how to prove it" --type=feature --priority=2
bd create --title="Update documentation for X" --description="…" --acceptance="…" --type=task --priority=3
```

**Task creation guidelines:**
- Each task should be independently completable
- Tasks touching different files are ideal for parallelization
- Use appropriate types: `feature`, `task`, `bug`, `chore`
- Priority: 0=critical, 1=high, 2=medium, 3=low, 4=backlog

### Step 1.3: Set Dependencies (if any)

```bash
bd dep add <tests-id> <implementation-id>  # Tests depend on implementation
```

## Phase 2: Task Selection

### Step 2.1: Show Available Tasks

```bash
bd ready  # Shows tasks with no blockers
```

### Step 2.2: Ask User for Selection

Use `AskUserQuestion` to present ready tasks:

```
Which tasks do you want to tackle in parallel? (Maximum 4)

Ready tasks:
1. [P2] beads-abc: Implement X component
2. [P2] beads-def: Add Y validation
3. [P2] beads-ghi: Refactor Z service
4. [P3] beads-jkl: Update docs

Enter task IDs (e.g., "abc def ghi"):
```

**Selection criteria for parallelization:**
- Tasks should touch different files (avoid merge conflicts)
- No dependencies between selected tasks
- Same priority level preferred
- Maximum 4 concurrent instances

### Step 2.3: Validate Selection

Check for conflicts:
```bash
# Verify no dependencies between selected tasks
bd show abc | grep -A5 "Dependencies"
bd show def | grep -A5 "Dependencies"
```

## Phase 3: Parallel Execution

### Step 3.1: Launch Parallel Instances

```bash
.claude/skills/dev-workflow/scripts/dev-workflow.sh select abc def ghi
```

This will:
1. Claim each ticket, and create git worktrees (`~/.claude-worktrees/<repo>/fix-<id>`)
2. Launch tmux session `claude-parallel`
3. Start Claude in each pane with task-specific prompts

### The brief each instance receives

`generate_prompt` in `scripts/dev-workflow.sh` writes it: the ticket's `bd show`, the steps to implement, commit and push, then `.claude/skills/parallel-claude/agent-brief.md` with the instance's branch filled in. That file is the single source of the rules for any agent working beside others, a tmux instance or a subagent you brief yourself: its own scratch directory named after its branch, one hand-back with the PR URL and head SHA, CI left to the coordinator.

## Phase 4: Monitoring

You are the coordinator: watch CI on each pull request an instance hands back, one background `gh pr checks <number> --watch` per PR, and send a red check to the instance that owns the branch.

### tmux Navigation

```
Ctrl+B, arrow keys  → Switch between panes
Ctrl+B, z           → Zoom/unzoom current pane
Ctrl+B, [           → Enter scroll mode (q to exit)
Ctrl+B, d           → Detach (instances keep running)
```

### Check Status

```bash
# Reattach to session
tmux attach-session -t claude-parallel

# Check without attaching
.claude/skills/dev-workflow/scripts/dev-workflow.sh status

# Preview pane content
tmux capture-pane -t claude-parallel:0.0 -p | tail -20
```

## Phase 5: Cleanup

After all PRs are created and merged:

```bash
.claude/skills/dev-workflow/scripts/dev-workflow.sh cleanup
```

This will:
1. Kill the tmux session
2. Remove all worktrees
3. Prune git worktree references
4. Sync beads: `bd sync && git push`

### Manual Cleanup

```bash
# Kill tmux session only
tmux kill-session -t claude-parallel

# List worktrees
git worktree list

# Remove specific worktree
git worktree remove ~/.claude-worktrees/<repo>/fix-<id> --force

# Prune all stale worktrees
git worktree prune
```

## AI Assistant Behavior

When `/dev-workflow` is invoked:

### If user has an idea/plan to discuss:
1. Help break it down into discrete tasks
2. Create beads issues with appropriate types and priorities
3. Set up any dependencies
4. Proceed to selection phase

### If user wants to start parallel work:
1. Run `bd ready` to show available tasks
2. Ask which tasks to parallelize (max 4)
3. Validate no conflicts
4. Launch parallel instances

### If user wants to cleanup:
1. Run the cleanup script
2. Confirm all worktrees removed
3. Ensure beads synced

## Error Recovery

### If one instance fails:
- Other instances continue
- Fix manually in that worktree, or
- Kill pane and retry: `tmux kill-pane -t claude-parallel:0.1`

### If tmux session dies:
- Worktrees persist
- Relaunch: `.claude/skills/dev-workflow/scripts/dev-workflow.sh select <ids>`

### If merge conflicts occur:
- This shouldn't happen if tasks touch different files
- Resolve manually in the conflicting worktree
- Consider sequential execution for tightly coupled changes

## After the run

Review each PR yourself rather than auto-merging, and clean up the worktrees once they are merged.
