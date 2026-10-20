<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Conventions — e2e tests (playwright-bdd)

The non-negotiable rules for generated e2e tests. They mirror the patterns already in the project's `e2e/` tree.

## Architecture

- **playwright-bdd**: `.feature` (Gherkin) + `*.steps.ts` (step defs) + Page Objects, wired through `e2e/fixtures/index.ts` and compiled by `bddgen` into `e2e/.specs-gen/`.
- Layout:
  - `e2e/features/*.feature` — scenarios
  - `e2e/steps/*.steps.ts` — step definitions
  - `e2e/pages/*.ts` — Page Objects (POM)
  - `e2e/fixtures/index.ts` — registers POMs as fixtures, exports `Given/When/Then/Step` via `createBdd(test)`

## Gherkin

- `Feature` = one user-facing capability; lead with a short why-oriented description.
- `Background` for preconditions shared by every scenario (usually navigation).
- One `Scenario` per behavior / acceptance criterion.
- `Scenario Outline` + `Examples` for the same flow across multiple inputs.
- Steps read as business language, parameterized with `{string}` / `{int}`.
- Reuse existing step phrasings so step defs are shared (e.g. "at least {int} ... is displayed").

## Page Objects

- Extend `BasePage` from `@sanofi-accelerator/platform-e2e-utils`.
- Declare `readonly path`; rely on the inherited `goto()`.
- Expose intent-revealing methods: `select*`, `expect*`, `goto`. The Page Object owns **all** Playwright calls and assertions.
- Locator priority: `getByTestId` > `getByRole` / `getByPlaceholder` / `getByText` > (last resort) CSS. Never XPath.
- Poll async UI: `await expect.poll(async () => locator.count(), { timeout: 10_000 }).toBeGreaterThanOrEqual(n)`. Always set an explicit timeout.
- For "every row" assertions, iterate `await locator.all()` and assert per element (e.g. `toHaveAttribute('data-status', slug)`).

## Step definitions

- Import `Given/When/Then` from `../fixtures` (never from `playwright-bdd` directly — fixtures inject the Page Objects).
- Keep them one-liners delegating to a Page Object method. No assertions, no locators, no branching in steps.

## Fixtures

- Register every new Page Object in the `Pages` type **and** the `test.extend({...})` block. A POM that is not in `test.extend` is unreachable from steps.

## Data & labels

- **Never hallucinate data.** Use values present in the codebase/fixtures, or assert on shape (e.g. batch number `^[A-Z0-9]{4,}$`). When a brand label maps to longer backend strings, assert *contains*, not *equals*.
- Assert on **user-visible labels** (i18n text, chip labels, headings), never internal enum values. When the UI exposes a canonical key via `data-*`, map the label to it in a small private helper.

## Style

- Functional, `const`, arrow functions, named exports (route files excepted) — same as app code.
- Comments explain **why** a non-obvious choice was made (e.g. why a viewport is bumped, why a filter must be expanded first), never restate what the line does.
- Match Prettier/ESLint config already in the repo.

## Auth (if the app is authenticated)

- A `setup` project authenticates once (e.g. Azure AD) and persists `storageState`; authenticated tests depend on it. Do not re-implement login per test — reuse the existing fixture/`storageState` wiring.

## Running

- `npm run test:e2e` → `bddgen && playwright test`. Confirm the exact script in `package.json`.
- `bddgen` fails fast on undefined/ambiguous steps; align `.feature` text with step defs first.
- Debug with `npm run test:e2e:ui` / `:headed` and the Playwright HTML report + trace.
