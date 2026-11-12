---
name: parallel-claude
description: Launch multiple Claude Code instances in parallel using tmux and git worktrees to tackle beads tasks concurrently. Use when user mentions parallel execution, multi-agent, parallel claude, or wants to run multiple Claude instances simultaneously on different tasks.
disable-model-invocation: true
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

Group the ready tickets as step 4 of the `triage-beads` skill does: tickets that share a file or a dependency run one after another, and groups that share no file can run in parallel. Propose launch sets of at most 4 tickets, each taken from a different parallel group.

### Step 3: Present Options with AskUserQuestion

Present the launch sets you analyzed, not individual tasks.

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

## Coordinating

Each instance's brief ends with `agent-brief.md`, the rules for an agent working beside others: its own scratch directory, `${TMPDIR:-/tmp}/my-prompt-manager-scratch/<branch>/`, then push and one hand-back with the PR URL and head SHA. Append it, with `<branch>` filled in, to any brief you write yourself for a parallel subagent. CI is yours: one background `gh pr checks <number> --watch` per handed-back PR.

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
