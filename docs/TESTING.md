# Testing Guide

How the tests are set up and run, and the gotchas the config files do not explain. For how to write a good test (behavior over implementation, accessible queries, mocked time), read [TESTING_BEST_PRACTICES.md](./TESTING_BEST_PRACTICES.md).

---

## Two suites

| Suite | Runner | Where | Command |
|-------|--------|-------|---------|
| Unit and component | Vitest + React Testing Library | `__tests__/` folders next to the code under `src/`, plus `src/test/` | `npm test` |
| End-to-end | Playwright, Chromium with the built extension loaded | `tests/e2e/` | `npm run test:e2e` |

Other commands: `npm run test:coverage` (what CI runs, with the coverage threshold), `npm run test:ui`, `npx vitest <path>` for one file. "Done means green" in `AGENTS.md` lists the checks a change must pass.

## Vitest

The config is `vitest.config.ts`; read it for the exact settings. What matters when you write a test:

### Environment: happy-dom by default

Every test file runs in **happy-dom** unless it says otherwise in a comment at its top:

- `@vitest-environment jsdom` for a test whose assertions depend on how a real browser parses HTML. happy-dom keeps `<script>` text where DOMPurify strips the tag, so XSS assertions fail under happy-dom although real browsers pass. Examples: `src/services/__tests__/promptEncoder.test.ts`, `src/components/__tests__/PromptEditor.integration.test.tsx`.
- `@vitest-environment node` for a test that touches no DOM, such as a test that reads source files. Examples: `src/theme/__tests__/rawColors.test.ts`, `src/test/guardrails/admission-guardrails.test.ts`.

`globals: true` is on, but import `describe`, `it`, `expect` and `vi` from `vitest` explicitly, as the existing tests do.

### What `src/test/setup.ts` gives every test

It runs before each test file and resets before each test:

- **A fake `chrome`**: `chrome.storage.local` is an in-memory store (`src/test/utils/InMemoryStorage.ts`) that answers like Chrome, callbacks and promises, `getBytesInUse` included; `runtime`, `tabs`, `permissions` and `scripting` are `vi.fn()` with neutral defaults. A test sets `chrome.runtime.lastError` or overrides a mock for its own case.
- **Spied singletons**: `StorageManager.getInstance()` and `PromptManager.getInstance()` return an instance whose methods are `vi.fn()` wrapping the real ones. Tests run the real storage logic on the fake storage, and can still assert calls or force a failure with `mockRejectedValueOnce`.
- **DOM stubs**: `matchMedia`, the clipboard and the other browser APIs happy-dom lacks.
- `@testing-library/jest-dom` matchers.

Storage starts empty in every test: seed it through `StorageManager` or `chrome.storage.local.set`.

### Helpers

| File | Use |
|------|-----|
| `src/test/builders/index.ts` | `buildPrompt()` and `buildCategory()`: test data with defaults |
| `src/test/helpers/hostile-text.ts` | `HOSTILE_TEXTS` and `expectNoMarkupIn`: prove Prompt text stays text wherever it is shown or inserted (Verbatim, ADR-001) |
| `src/test/utils/FakeLockManager.ts` | A fake `navigator.locks`; two `AsyncMutex` given the same fake stand for two contexts of the extension |
| `src/test/utils/InMemoryStorage.ts` | The storage fake, for a test that needs its own instance |
| `src/test/helpers/theme-helpers.ts` | Theme setup and toggle checks |

`src/test/utils/README.md` describes the storage fake further.

### Guardrail tests

Some tests check the source rather than behavior, and fail the build when a rule of `CODING_STANDARDS.md` is broken:

- `src/test/guardrails/admission-guardrails.test.ts`: no route skips Admission.
- `src/theme/__tests__/rawColors.test.ts`: components on the color tokens, and the guidance docs that prescribe classes, use no raw palette class and no `dark:` color variant. Counter-examples (a `// Before` example, a code block under **DON'T:**) are exempt.
- `src/test/guardrails/docPaths.test.ts`: every `src/` and `tests/` path cited by `CODING_STANDARDS.md`, the docs it routes to (this page, [ARCHITECTURE.md](./ARCHITECTURE.md), [COMPONENTS.md](./COMPONENTS.md), [DESIGN_GUIDELINES.md](./DESIGN_GUIDELINES.md), [ELEMENT_FINGERPRINTING_DESIGN.md](./ELEMENT_FINGERPRINTING_DESIGN.md), [SERVICES_AND_HOOKS.md](./SERVICES_AND_HOOKS.md), the ADRs) and the repo skills (`.claude/skills/*/SKILL.md`) exists. A worked example's placeholder Platform (`newplatform-`, `yourplatform-`…) and a path with a `<placeholder>` segment are skipped.
- `src/test/guardrails/readmeChromeVersion.test.ts`: every Chrome version in `README.md`, badge and text, equals `manifest.json` `minimum_chrome_version`.
- `src/test/guardrails/viewScrollContainer.test.ts`: every view that renders `<ViewHeader` puts `data-scroll-container` on its scrolling element, which the scroll lines of `src/popup.css` follow.
- `src/components/__tests__/modalDialogs.test.ts`: every `aria-modal` dialog of `src/components` takes its keyboard behavior from `useModalFocus`. `HAND_WRITTEN`, the dialogs that still carry their own handlers, is empty since the last two were migrated (My-Prompt-Manager-xaz) and only shrinks.

## Playwright

The config is `playwright.config.ts`. Its global setup (`tests/e2e/global-setup.ts`) runs `npm run build`, and the fixture of `tests/e2e/fixtures/extension.ts` loads `dist/` into Chromium, so an end-to-end run always tests the current code.

- Page objects are in `tests/e2e/pages/`, workflows and assertions in `tests/e2e/utils/`, seeded data in `tests/e2e/fixtures/`. `tests/e2e/README.md` describes them.
- Locally the browser is headed; CI runs headless with one retry.
- A hover a test asserts on goes through `readWhileHovering` or `holdHover` (`tests/e2e/utils/hover.ts`), not a bare `locator.hover()`. A headed run opens one window per test, over one another; when one opens over the window under the real pointer, Chrome gives that page a real mouse event at the pointer's position and the hover Playwright set ends, which a bare `hover()` never takes back. CI, headless, has no real pointer.
- `tests/e2e/` has its own `tsconfig.json`, which `npm run typecheck` checks.
- Linux CI renders wider fonts than the Mac (DejaVu Sans): a layout assertion that passes locally can fail there. `npm run test:e2e:linux -- <spec>` runs a spec the way CI renders it, in Docker; `tests/e2e/README.md` says how.
- A locator assertion (`toHaveAttribute`, `toHaveText`, `toHaveClass`…) takes a string or a RegExp. An asymmetric matcher such as `expect.stringContaining(...)` makes it pass whatever the value, and `npm run lint` rejects it in `tests/e2e/` (the GritQL plugin in `biome-plugins/`).

## CI

`.github/workflows/pr-checks.yml` runs on every pull request: type check, lint, `npm run test:coverage` (the coverage threshold is in `vitest.config.ts`), build, the Playwright suite and a security audit. The end-to-end job takes about ten minutes.
