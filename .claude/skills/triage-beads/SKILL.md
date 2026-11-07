---
name: triage-beads
description: Answer a question about the beads backlog from one compact listing, opening only the tickets that need a decision. Use when asked what is left, to list the tickets, to triage, rank or re-prioritise them, to group them, or which ones can run in parallel; in French "qu'est-ce qu'il reste", "liste les tickets", "ordre de priorité", "regrouper", "en parallèle".
---

# Triage beads

A triage reads the backlog from one compact listing and opens a ticket only to decide something about it. Notes and design fields are the bulk of a full `bd show`, and neither ranking nor grouping needs them: never loop `bd show` over the backlog.

"What is left?" is steps 1, 2 and 5. A triage adds step 3. "Group them" or "what can run in parallel?" adds step 4.

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

## 4. Group by the files each ticket would touch

Two tickets that would write the same file cannot run side by side. The files come from a second compact listing, the repository paths each ticket's description and design cite, not from `bd show`:

```bash
bd list --status=open,in_progress,blocked,deferred --json --limit 0 \
  | jq -c '.[] | {id, files: ([((.description // "") + " " + (.design // "")) | match("(?:src|tests|scripts|docs|\\.claude|\\.github|\\.beads)/[\\w./-]*\\w"; "g").string] | unique)}'
```

A ticket that cites no path is placed from its title: the component, service or doc it names, found with one `grep -rl` of the code when the name is not a path. Say which placements are guesses. Then:

- a ticket goes in the group of any ticket it shares a file with, and after any ticket it depends on (`dependencies` in the listing, `bd blocked`); the tickets of one group run one after another;
- groups that share no file can run in parallel, each in its own session on its own branch;
- an epic is placed by its children, not on its own.

Done when every live ticket is in exactly one group, each group lists its files, and the groups that can run at the same time are named.

## 5. Report

Give the ranked list as a table (id, priority, status, title) with each proposed change and its reason, and apply a change (`bd update <id> --priority …`, `bd update <id> --status …`) once the user agrees to it. When grouping was asked, add the groups: the tickets of each, the files they share, and which groups can run in parallel.
