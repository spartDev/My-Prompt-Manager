---
name: triage-beads
description: Triage the beads backlog from a compact listing, opening only the tickets that need a decision. Use when asked to triage, rank or re-prioritise beads tickets.
---

# Triage beads

A triage reads the backlog from one compact listing and opens a ticket only to decide something about it. Notes and design fields are the bulk of a full `bd show`, and ranking needs none of them.

## 1. Pull the listing

```bash
bd list --status=open,in_progress,blocked,deferred --json --limit 0 \
  | jq -c '.[] | {id, p: .priority, t: .issue_type, s: .status, title, d: (.description // "" | .[0:200])}'
```

`--limit 0` lifts `bd list`'s default cap of 50 rows, which would drop tickets without saying so. The listing came to 3.9 KB for 11 tickets on 2026-11-05; when it passes 8 KB, cut `d` to 100 characters rather than paging through it.

Done when every live ticket is one line of that output, read once.

## 2. Rank and flag

Rank by priority, then by what each ticket unblocks. Flag a ticket for a decision when its line suggests one:

- its priority disagrees with its description (a user-facing bug at P4, a nice-to-have at P1);
- it is deferred, and the description names a condition that may now hold;
- it is in progress with no session working on it;
- it repeats another ticket.

Done when every line is ranked and every flag names the decision it needs.

## 3. Open the flagged tickets

Run `bd show <id>` on each flagged ticket, and on no other. Decide each flag from it.

## 4. Report

Give the ranked list as a table (id, priority, status, title) with each proposed change and its reason, and apply a change (`bd update <id> --priority …`, `bd update <id> --status …`) once the user agrees to it.
