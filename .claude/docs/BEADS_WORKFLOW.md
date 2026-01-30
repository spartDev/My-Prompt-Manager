# Beads Workflow

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

## Finding Work

```bash
bd ready                      # Issues ready to work (no blockers)
bd list --status=open         # All open issues
bd list --status=in_progress  # Your active work
bd show <id>                  # Detailed view with dependencies
```

## Creating & Updating

```bash
bd create --title="..." --type=task|bug|feature --priority=2
bd update <id> --status=in_progress   # Claim work
bd update <id> --assignee=username    # Assign
bd close <id>                         # Mark complete
bd close <id1> <id2> ...              # Close multiple at once
```

**Priority**: 0-4 or P0-P4 (0=critical, 2=medium, 4=backlog). NOT "high"/"medium"/"low".

**Warning**: Do NOT use `bd edit` - it opens $EDITOR which blocks agents.

## Dependencies

```bash
bd dep add <issue> <depends-on>  # Add dependency
bd blocked                       # Show blocked issues
```

## Sync

Daemon handles beads sync automatically. Use `bd sync --status` to check.
