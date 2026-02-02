---
name: parallel-claude
description: Launch multiple Claude Code instances in parallel using tmux and git worktrees to tackle beads tasks concurrently. Use when user mentions parallel execution, multi-agent, parallel claude, or wants to run multiple Claude instances simultaneously on different tasks.
---

# Parallel Claude Launcher

Launch N Claude instances in parallel using tmux + git worktrees to tackle beads tasks concurrently.

## Workflow

### Step 1: Show Available Tasks

```bash
bd ready
```

Format output as table:

| ID | Pri | Type | Title |
|----|-----|------|-------|
| abc | P1 | bug | Fix memory leak |
| def | P2 | task | Add validation |

### Step 2: Analyze & Recommend Groupings

Evaluate tasks for parallelization:

**Good candidates:**
- Different files/modules (no merge conflicts)
- No dependencies between them
- Similar priority

**Bad candidates:**
- Same files (merge conflicts!)
- One depends on another
- Integration + unit tests on same code

**Hard limit:** Max 4 tasks per group

### Step 3: Present Options with AskUserQuestion

**CRITICAL**: Present pre-analyzed groupings, not individual tasks.

```json
{
  "questions": [{
    "question": "Which parallel grouping would you like to run?",
    "header": "Parallel",
    "multiSelect": false,
    "options": [
      {
        "label": "Auth + UI bugs (Recommended)",
        "description": "abc, def | Different modules, no overlap"
      },
      {
        "label": "All 3 independent tasks",
        "description": "abc, def, ghi | Touch separate dirs"
      },
      {
        "label": "Single task: abc",
        "description": "Safe if unsure about conflicts"
      }
    ]
  }]
}
```

### Step 4: Launch

Once user selects, launch directly (script claims issues automatically):

```bash
.claude/skills/parallel-claude/scripts/launch.sh abc def
```

## Monitoring (tell user)

```
tmux Navigation:
  Ctrl+B, arrows  - Switch panes
  Ctrl+B, z       - Zoom/unzoom pane
  Ctrl+B, d       - Detach (instances keep running)

Reattach:
  tmux attach-session -t claude-parallel
```

## Cleanup (tell user)

```bash
# Check status
.claude/skills/parallel-claude/scripts/launch.sh --status

# Kill tmux only
.claude/skills/parallel-claude/scripts/launch.sh --kill

# Full cleanup (tmux + worktrees)
.claude/skills/parallel-claude/scripts/launch.sh --cleanup
```
