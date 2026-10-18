---
name: e2e-test-generation
description: >
  Scaffold Gherkin + Playwright e2e tests (playwright-bdd) from a Jira ticket or PR and iterate until green.
  Use when asked to write e2e/BDD tests from a ticket or PR.
  Do NOT use for unit tests (vitest), manual Xray steps (use xray-test-steps), or runner config.
argument-hint: PROJ-123 | PR url/number
metadata:
  author: sanofi-accelerator
  version: "1.0.0"
allowed-tools: Read Write Edit Grep Glob Bash
---

<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# E2E Test Generation (Gherkin + Playwright)

**Goal:** Turn a Jira ticket or a pull request into runnable end-to-end tests using **playwright-bdd** (Gherkin `.feature` files driven by Playwright), following the project's existing e2e conventions, and iterate until they pass.

**Your Role:** You are a QA automation engineer. You write **executable** Gherkin scenarios backed by Page Objects and step definitions — not manual test steps (that is `xray-test-steps`).

## Prerequisites

- Confirm the project uses **playwright-bdd**: look for `defineBddConfig` in `playwright.config.ts` and a `e2e/` tree with `features/`, `steps/`, `pages/`, `fixtures/`. If it is plain Playwright (no `.feature` files), generate plain `*.spec.ts` instead and skip the Gherkin steps.
- **Jira input** requires the Atlassian MCP. If an MCP call fails, **STOP** and ask the user to reconnect. Read `.claude/config/project.yaml` (if present) and use `atlassian.url` to pick the right resource.
- **PR input** requires the `gh` CLI authenticated, or a checked-out branch to diff.

## Workflow Checklist

```
- [ ] Step 1: Identify the input (Jira key or PR)
- [ ] Step 2: Gather context (acceptance criteria or diff)
- [ ] Step 3: Cross-check the ticket against the current branch (Jira input)
- [ ] Step 4: Explore the codebase (routes, testids, labels, existing POMs)
- [ ] Step 5: Derive scenarios (Gherkin if playwright-bdd, plain specs otherwise)
- [ ] Step 6: Scaffold artifacts (.feature + POM + steps + fixtures, or *.spec.ts for plain Playwright)
- [ ] Step 7: Run and iterate until green
- [ ] Step 8: Report locally (and post Gherkin to Jira if Jira input)
```

### Step 1: Identify the Input

- **Jira key** — matches `[A-Z][A-Z0-9]+-\d+` (e.g. `OCTT-872`). → go to Step 2a.
- **PR** — a number, URL, or "this PR / current branch". → go to Step 2b.

If neither is clear, ask the user which ticket or PR to use.

### Step 2a: Gather Context — Jira

Mirror the fetch flow of `xray-test-steps`:

1. `getAccessibleAtlassianResources` → `cloudId` (disambiguate via project config or ask).
2. `getJiraIssue` with `{ cloudId, issueIdOrKey, responseContentFormat: "markdown" }`.
3. Extract `summary`, `description`, **acceptance criteria**, `issuetype.name`, and `issuelinks`.
4. If a linked Story exists, fetch it for richer context.

Each acceptance criterion is a candidate scenario.

### Step 2b: Gather Context — Pull Request

If the user gave a PR number or URL, pass it explicitly to `gh pr view` and `gh pr diff`. If they said "this PR" or "current branch", omit the identifier to use the current checkout.

```bash
BASE=$(git branch -r | grep -q 'origin/develop' && echo develop || echo main)
# Replace <PR> with the number/URL when one was given; omit for "this PR / current branch"
gh pr view <PR> --json title,body,headRefName 2>/dev/null
gh pr diff <PR>                                         # the PR's actual diff
```

Map **user-facing** changes (new routes, components, flows, labels) to scenarios. Ignore pure refactors and internal-only changes — e2e covers what the user sees and does. If the branch name carries a Jira key, also run Step 2a for the acceptance criteria.

### Step 3: Cross-check the Ticket Against the Current Branch (Jira input)

When the input is a Jira ticket, compare its scope against what the current branch actually changes, so scenarios are grounded in the real implementation and gaps are surfaced.

```bash
BASE=$(git branch -r | grep -q 'origin/develop' && echo develop || echo main)
git rev-parse --abbrev-ref HEAD        # current branch (often carries the Jira key)
git diff "$BASE"...HEAD --stat         # files touched by the branch
git diff "$BASE"...HEAD                # the actual changes
```

Reconcile the two sides:

- **AC covered by the diff** → write a scenario for it.
- **AC with no matching code** → flag it; the work may be incomplete or the test cannot pass yet. Tell the user; do NOT invent the missing behavior.
- **Code change with no AC** → note it; propose a scenario or ask whether it is in scope.

If the branch has no changes vs base, say so and proceed from the ticket + codebase exploration only.

### Step 4: Explore the Codebase

Understand the feature **from the user's perspective** and find what to reuse:

1. **Routes** — locate the page/route under test (`src/routes/**`) to derive the POM `path`.
2. **`data-testid`s** — grep the feature components for `data-testid` / `getByTestId` anchors; prefer these over CSS selectors.
3. **User-facing labels** — read the i18n catalogs for the exact on-screen text (button labels, chips, headers). NEVER assert on internal enum values.
4. **Existing e2e assets** — check `e2e/pages/` and `e2e/steps/` first. Extend an existing Page Object / step file before creating new ones; reuse shared steps (counts, visibility) verbatim.

### Step 5: Derive Gherkin Scenarios

- One `Feature` per user-facing capability; a `Background` for shared preconditions.
- One `Scenario` per acceptance criterion / behavior. Use `Scenario Outline` + `Examples` for the same flow over multiple inputs (see `batch-details.feature`).
- Phrase steps in **business language** (`When the user selects the status "At risk"`), not implementation detail.
- Keep scenarios focused; do not over-test trivial variations.
- **NEVER hallucinate data.** Use values that exist in the codebase/fixtures or describe the kind of input. Use the exact labels users see.

### Step 6: Scaffold the Four Artifacts

Follow the project layout exactly. See **[references/templates.md](references/templates.md)** for ready-to-fill skeletons and **[references/conventions.md](references/conventions.md)** for the full rule set.

| Artifact | Location | Purpose |
| --- | --- | --- |
| Feature | `e2e/features/<feature>.feature` | Gherkin scenarios |
| Page Object | `e2e/pages/<Name>Page.ts` | extends `BasePage`; `readonly path` + `expect*` / `select*` / `goto` methods |
| Step definitions | `e2e/steps/<feature>.steps.ts` | thin wrappers importing `Given/When/Then` from `../fixtures`, delegating to the POM |
| Fixture wiring | `e2e/fixtures/index.ts` | register the new POM in the `Pages` type **and** `test.extend` |

Hard rules (full list in `references/conventions.md`):

- Page Objects extend `BasePage` from `@sanofi-accelerator/platform-e2e-utils` and expose a `readonly path`; `goto()` is inherited.
- Locators use `getByTestId` / `getByRole` — never brittle CSS/XPath.
- Step files contain **no Playwright assertions**; all logic lives in the POM. Steps just call POM methods.
- Use `expect.poll(...)` with an explicit `timeout` for lists that load asynchronously.
- A new Page Object is unused until it is added to **both** the `Pages` type and the `test.extend` block in `e2e/fixtures/index.ts`.
- Comments explain **why**, never restate **what** (see project code-style rule).

### Step 7: Run and Iterate

```bash
npm run test:e2e            # = bddgen && playwright test  (check package.json for the exact script)
```

`bddgen` regenerates specs from `.feature` + steps into `e2e/.specs-gen/`. If it reports **undefined/ambiguous steps**, fix the wording or step defs before running Playwright. Loop until green; on failure inspect the Playwright HTML report / trace, adjust locators or labels, and re-run. Use `npm run test:e2e:ui` or `:headed` for debugging.

### Step 8: Report and Post to Jira

**Locally**, print: the files created/modified, the scenarios added, the test result (pass/fail), and any assumptions or gaps (missing acceptance criteria, AC with no matching implementation, data that needs a real fixture).

**Back to Jira** (Jira input only): post the generated Gherkin as a comment on the ticket so QA/PO can review coverage, using `addCommentToJiraIssue`:

- `cloudId`: from Step 2a
- `issueIdOrKey`: the ticket key
- `contentFormat`: `"markdown"`
- `commentBody`: the `.feature` scenarios inside a fenced ` ```gherkin ` block, prefixed with a one-line summary (which branch/PR they were generated from) and a short note on any acceptance criteria left uncovered (from Step 3).

Confirm with the user before posting unless they already asked for it. To refresh a prior comment instead of stacking new ones, pass its `commentId`.

## Important

- Produce **executable** tests, not manual steps. For manual Xray steps use `xray-test-steps`.
- Do NOT edit the Jira ticket's fields, status, or the PR. The only allowed remote write is posting the Gherkin review comment in Step 8.
- Match the project's existing e2e style; reuse before creating.
- If context is insufficient (vague AC, no testids, unclear flow), ask the user rather than inventing behavior.

## Error Handling

| Situation | Action |
| --- | --- |
| Project is not playwright-bdd | Generate plain `*.spec.ts`, skip Gherkin |
| Atlassian MCP not connected | Stop, ask user to reconnect |
| Jira issue / PR not found | Report the identifier, ask user to verify |
| `gh` not authenticated | Tell user to run `gh auth login`, or diff the branch manually |
| `bddgen` undefined step | Align step text in `.feature` and `*.steps.ts`, re-run |
| No `data-testid` anchors | Fall back to `getByRole`/text; suggest adding testids to the source |
| Acceptance criteria missing/vague | Generate from description + diff, flag the assumption |
| Branch has no diff vs base | Note it, proceed from ticket + codebase exploration |
| Posting the Jira comment fails | Report the error, output the Gherkin locally for manual paste |
