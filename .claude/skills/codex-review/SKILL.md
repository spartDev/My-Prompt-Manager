---
name: codex-review
description: Answer the Codex review comments of a pull request, from reproducing each finding to the reply that resolves its thread.
argument-hint: "<PR number>"
disable-model-invocation: true
---

# Codex review

Codex reviews every pull request, and `main` requires every conversation resolved, so each unanswered Codex thread blocks the merge. Take each finding through five steps. Step 3 is a hand-off: the user decides what gets fixed.

## 1. Fetch the open findings

```bash
scripts/pr-review.sh <PR>
```

One line per bot comment nobody has replied to: `id`, `path:line`, priority, title. `(outdated)` after the line means the code moved since; the line is the one Codex read. Read each comment's full body:

```bash
gh api repos/{owner}/{repo}/pulls/comments/<id> --jq .body
```

Done when: you hold the full body of every listed comment. An empty list means nothing is open: say so and stop.

## 2. Reproduce

Reproduce each finding before judging it. A finding about the extension's behaviour gets a temporary Playwright spec, `tests/e2e/codex-repro-<id>.spec.ts`, built on the fixture of `tests/e2e/fixtures/extension.ts` (page objects and seeded data: `tests/e2e/README.md`), that does what the comment describes in the real extension and asserts the behaviour Codex expects:

```bash
npx playwright test tests/e2e/codex-repro-<id>.spec.ts
```

Global setup rebuilds `dist/`, so the run tests the branch as it is. A finding about a script, a doc or the CI reproduces with the command or the `grep` that shows the case Codex names.

Then delete every `codex-repro-*` spec: it is evidence for step 3, and the fix of step 4 brings its own test.

Done when: each finding has a verdict, **reproduced** or **not reproduced**, with the evidence (the failing assertion, the command output), and `git status --porcelain` lists no `codex-repro-` file.

## 3. Report, then wait

For each finding, tell the user:

- the verdict and its evidence;
- whether it is relevant to this PR, or a real issue outside its scope (a beads ticket, `bd create`);
- the fix you propose and the test that will go **red** on the bug, or the reply you propose when it is not reproduced.

**Stop here.** Done when: the user has said yes, finding by finding, to a fix or a reply. Their answer can change the proposal; carry their version into step 4.

## 4. Fix and answer

For each finding the user approved, in turn:

1. Write the test first and watch it go **red** on the bug: a unit test, or an e2e spec that stays in the suite.
2. Fix it, and the test goes green. Commit, citing the finding.
3. Run `npm test && npm run lint && npm run lint:changed && npm run typecheck`, then push.
4. Reply in the thread, following the replies already on this repository's PRs: what reproduced and how, the commit that fixes it, the test that failed before it.

   ```bash
   gh api repos/{owner}/{repo}/pulls/<PR>/comments/<id>/replies -f body='Confirmed: … Fixed in <sha>: … <test> fails without the change.'
   ```

   A finding not reproduced or out of scope gets the reply the user approved: the evidence, or the ticket it went to.
5. Resolve the thread, which is what unblocks the merge:

   ```bash
   gh api graphql -f query='{repository(owner:"spartDev",name:"My-Prompt-Manager"){pullRequest(number:<PR>){reviewThreads(first:100){nodes{id isResolved comments(first:1){nodes{databaseId}}}}}}}' \
     --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.comments.nodes[0].databaseId == <id>) | .id'
   gh api graphql -f query='mutation{resolveReviewThread(input:{threadId:"<thread id>"}){thread{isResolved}}}'
   ```

Done when: `scripts/pr-review.sh <PR>` prints nothing, and the first query shows `isResolved: true` on every Codex thread.

## 5. Record

Add a round to the `## Review rounds` section of the PR body (`.github/PULL_REQUEST_TEMPLATE.md`): `### Codex, round <n> (<commit Codex reviewed>)`, one bullet per finding, `what it found → the commit that answers it`. Edit with `gh pr edit <PR> --body-file`, after reading the current body with `gh pr view <PR> --json body -q .body`. Then append the same round to the ticket:

```bash
bd update <id> --append-notes "PR #<PR>, Codex round <n>: …"
```

Codex reviews the new push too. A new comment starts a new round at step 1.

Done when: the PR body and the ticket's notes both carry the round.
