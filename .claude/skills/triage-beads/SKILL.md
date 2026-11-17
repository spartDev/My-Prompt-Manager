---
name: triage-beads
description: Answer a question about the beads backlog from one compact listing, opening only the tickets that need a decision. Use when asked what is left, to list the tickets, to triage, rank or re-prioritise them, to group them, or which ones can run in parallel; in French "qu'est-ce qu'il reste", "liste les tickets", "ordre de priorité", "regrouper", "en parallèle".
---

# Triage beads

A triage reads the backlog from one compact listing and opens a ticket only to decide something about it. Notes and design fields are the bulk of a full `bd show`, and neither ranking nor grouping needs them: never loop `bd show` over the backlog.

"What is left?" is steps 1, 2 and 5. A triage adds step 3. "Group them" or "what can run in parallel?" adds step 4.

## 1. Pull the listing

Save the backlog once, in your scratch directory (`<scratch>` below, never the repository), and read it as one compact line per ticket:

```bash
bd list --status=open,in_progress,blocked,deferred --json --limit 0 > <scratch>/backlog.json
jq -c '.[] | {id, p: .priority, t: .issue_type, s: .status, title, d: (.description // "" | .[0:200])}' <scratch>/backlog.json
```

`--limit 0` lifts `bd list`'s default cap of 50 rows, which would drop tickets without saying so. When the listing passes 8 KB, cut `d` to 100 characters rather than paging through it. Every later step reads the saved snapshot, so the ranking and the groups describe the same backlog.

Done when every live ticket is one line of that output, read once.

## 2. Rank and flag

Jev (TypeSafe's System One model) makes the judgments; code makes the ranking. Run, from the repository root:

```bash
node .claude/skills/triage-beads/jev-rank.mjs <scratch>/backlog.json
```

For each ticket but the epics, one request asks Jev five atomic judgments over the ticket's title, description and acceptance criteria (the field, or an "Acceptance criteria" section of the description when the field is empty; a heading such as `## Acceptance Criteria` is dropped, not judged as an item): `user_visible`, `time_bound` and `ready` (Nouls), `severity` (Score 0-4), `effort` (Score 0-3). The same request asks, for each item of the acceptance criteria, whether someone could check it from a test, a command's output, a screenshot or a file to read, and, for step 4, which code areas the ticket would edit. More requests ask, for every pair of non-epic tickets whatever their type, whether they ask for the same change (an epic is not compared: its children are), 60 pairs per request (`--no-dups` skips them). The script combines the answers with the weights at its top, adds what the ticket unblocks (the live tickets that wait on it through a `blocks`, `conditional-blocks` or `waits-for` edge in the snapshot; `dependent_count` also counts edges that gate nothing, so it is not used), and prints one line per ticket, best first, then one line per epic (the best suggestion and the areas of its live children: the snapshot's tickets whose `parent`, or a parent-child dependency, names the epic, walking through a child epic so its own children roll up (`through <epic>`); an `--exclude`d child is listed after `excluded, place by hand`, and the epic is never `no files` without it), then the duplicates, then the areas step 4 reads:

```
<id> P<current>->P<suggested> v=<value> sev= eff= vis= time= ready= | <flags>
EPIC <id> P<current>->P<best child> children <ids> (through <child epics>) | areas <areas> (maybe <areas>) | no confirmed areas | no files
DUPLICATE? <id> ~ <id> p=<percent>
AREAS <id>: <area>, … (maybe <area>) | no files
```

Every payload and answer is kept in `<scratch>/jev.json`, so any line can be rerun: the duplicate requests too (`duplicate_requests`, with each pair's probability in `duplicate_pairs`, the ones at or below 0.3 included). Read the lines, not only the order. The script flags, and you open in step 3:

- `priority: P<x> but judged P<y>`: the ranking is two levels or more from the ticket's priority;
- `unsettled: …`: a Noul landed between 0.3 and 0.7, so the ticket text does not settle it;
- `not ready`: an open ticket that needs a decision or an outside event first;
- `<score> split between levels …`: a Score with two peaks, which its position hides;
- `acceptance: none` or `acceptance: item(s) <n> name(s) no check`: the ticket cannot be closed with proof as it stands (every ticket needs checkable acceptance criteria); propose the missing check;
- `DUPLICATE?` above 0.3, a possible repeat; above 0.7, a likely one.

Add the flags Jev cannot see from the ticket alone, from the step 1 lines:

- it is deferred: step 3 checks its condition against evidence;
- it is in progress with no session working on it. The listing does not say whether one is: look for the ticket's id in `git worktree list`, in `tmux list-windows -t claude-parallel` (the parallel-claude launchers), and in `gh pr list --search <id>`. When none names it, flag it "in progress, no session found" and ask the user before moving it back to open.

Jev's suggested priority is a proposal for the report, never applied on its own. Test and tooling tickets rank below user-facing bugs by design: users would not notice them. The script enforces it in its sort, not through the weights: every ticket whose `user_visible` does not read "no" comes first. When an answer looks wrong, fix the ticket's text or the question's wording in the script, not the weights for that one ticket.

The script sends each ticket's title, description and acceptance criteria to the TypeSafe API as they are, unfiltered, and needs `TYPESAFE_API_KEY`. No secret and no personal data of any kind may be sent. Before step 2, read every ticket's full title, description and acceptance criteria in `<scratch>/backlog.json` (the step 1 lines cut the description and leave out the criteria): `jq -r '.[] | "== \(.id)\n\(.title)\n\(.description // "")\n\(.acceptance_criteria // "")"' <scratch>/backlog.json`. For a ticket that holds one, either rewrite it, then pull the step 1 listing again over `<scratch>/backlog.json` so the old text is neither sent nor kept, or keep it out with `--exclude <id>,<id>`, which the script applies to whatever snapshot it reads, so a later re-pull cannot bring it back; rank it by hand. The script also refuses to send a ticket whose text matches a credential, e-mail or phone pattern: its line says `HELD`, and it is handled the same way. The patterns catch common shapes only, so the read stays required. A local mock (`TYPESAFE_API_URL=http://localhost:…`) gets a dummy key, never the real one. Without the key (exit 3), or for a ticket whose line says `ERROR`, rank by hand: by priority, then by what each ticket unblocks, and flag a priority that disagrees with the description (a user-facing bug at P4, a nice-to-have at P1) or a ticket that repeats another, or acceptance criteria that name no check. Say in the report which tickets were ranked by hand. A `DUPLICATES ERROR` line is followed by one `UNCHECKED <id> ~ <id>` line per pair its failed request held: check each by hand from the full description and acceptance criteria in `<scratch>/backlog.json` (the step 1 lines cut the description), opening a ticket with `bd show` when that is still not enough, and say so.

Done when every line is ranked and every flag names the decision it needs.

## 3. Open the flagged tickets

Run `bd show <id>` on each flagged ticket, and on no other. Decide each flag from it.

A deferred ticket waits on a condition outside the project: an upstream issue, a release, a pull request. For each one, fetch the evidence of that condition, one command for each issue, pull request or release the ticket names (`gh issue view <n> --repo <owner/repo> --json state,closedAt,title`, `npm view <package> versions --json | tail`, `gh pr view <n> --json state,mergedAt`), and keep the command and its output, under 2 KB, in `<scratch>/evidence.json` as `{"<id>": "$ <command>\n<output>\n$ <command>\n<output>"}`. Evidence that leaves out one of the things the ticket names (the fix PRs as well as the issue) comes back as not settled. The evidence is sent to the TypeSafe API unfiltered too, and `gh` reads private repositories with your credentials: remove every secret and every piece of personal data (names, e-mail addresses, phone numbers, credentials, customer text) from `evidence.json` first, or leave that ticket out of the deferred step and decide it by hand. The script holds back evidence that matches the same patterns as ticket text, and says so on the ticket's line. Then:

```bash
node .claude/skills/triage-beads/jev-rank.mjs deferred <scratch>/backlog.json <scratch>/evidence.json --exclude <the ids excluded in step 2>
```

Pass the same `--exclude` list as in step 2 (drop the flag when it is empty): an excluded ticket is never sent, and its line says to decide it by hand.

Jev judges whether the evidence is about the ticket's condition and whether the condition has happened; the script turns that into one of: condition met (propose reopening), still waiting (stays deferred), evidence does not settle it (fetch better evidence or read it yourself), unsettled (read it yourself). A ticket with no evidence fetched, no key, or an `ERROR` line is decided by hand from the evidence.

## 4. Group by the files each ticket would touch

Two tickets that would write the same file cannot run side by side. The files come from the step 1 snapshot, not from `bd show` or a second `bd list`: every path-like token in a ticket's description and design, kept when it exists in the checkout, so a root-level file (`package.json`, `manifest.json`, `vite.config.ts`) counts as much as one under `src/`. Run it from the repository root:

```bash
jq -r '.[] | .id as $id | ((.description // "") + " " + (.design // "")) | [match("\\.?[A-Za-z0-9_@-]+(?:\\.[A-Za-z0-9_@-]+)*(?:/\\.?[A-Za-z0-9_@-]+(?:\\.[A-Za-z0-9_@-]+)*)+/?|\\.?[A-Za-z0-9_@-]+/|\\.?[A-Za-z0-9_@-]+(?:\\.[A-Za-z0-9_@-]+)+"; "g").string] | unique[] | "\($id) \(.)"' <scratch>/backlog.json \
  | while read -r id path; do [ -e "$path" ] && echo "$id $path"; done
```

A file the ticket would create is not in the checkout yet: add it from the ticket's line. A ticket that cites no path is placed by its `AREAS` line from step 2: each area stands for the paths listed under `areas` in `<scratch>/jev.json` (and in `AREAS` at the top of the script), so it shares a file with any ticket that cites one of those paths or names the same area. `no files` means a manual check or a release: it can run beside anything. A `maybe` area, or a ticket without an `AREAS` line, is placed from its title (the component, service or doc it names, found with one `grep -rl` of the code when the name is not a path). Say which placements came from Jev's areas and which are guesses. Then:

- a ticket goes in the group of any ticket it shares a file with, and after any ticket it depends on (`dependencies` in the snapshot, `bd blocked`); the tickets of one group run one after another;
- groups that share no file can run in parallel, each in its own session on its own branch;
- an epic is placed by its children, not on its own: its `EPIC` line from step 2 names them and their areas. Without that line (no key, or a failed run), list its children from the snapshot (`jq -r '.[] | select(.parent == "<epic>") | .id' <scratch>/backlog.json`) and place the epic with them, from their own placements above.

Done when every live ticket is in exactly one group, each group lists its files, and the groups that can run at the same time are named.

## 5. Report

Give the ranked list as a table (id, priority, Jev's suggested priority, status, title) with each proposed change and its reason, citing the judgments behind it (severity, effort, user-visible, time-bound), and apply a change (`bd update <id> --priority …`, `bd update <id> --status …`) once the user agrees to it. When grouping was asked, add the groups: the tickets of each, the files they share, and which groups can run in parallel.
