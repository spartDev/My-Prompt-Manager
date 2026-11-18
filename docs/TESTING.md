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

- **A fake `chrome`**: `chrome.storage.local` is an in-memory store (`src/test/utils/InMemoryStorage.ts`) that answers like Chrome, callbacks and promises, `getBytesInUse` included; `chrome.storage.session` is a second in-memory store (promises only), emptied before each test as a browser restart empties it; `runtime`, `tabs`, `permissions` and `scripting` are `vi.fn()` with neutral defaults (`tabs.getCurrent` resolves to undefined, as in the action popup and the side panel). A test sets `chrome.runtime.lastError` or overrides a mock for its own case.
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
- Content tests run on stand-in pages served on each Platform's own host (`tests/e2e/fixtures/platform-pages.ts`). The Perplexity and copilot.cloud.microsoft stand-ins mount a real Lexical editor: the `lexical` and `@lexical/plain-text` packages, pinned in `package.json` at the version perplexity.ai serves (0.41.0), are served from `node_modules` in their production CommonJS build and loaded through a minimal `require()` (`moduleScripts`), as the ChatGPT stand-in loads React. Plain text, because the live editors lay pasted lines out in one paragraph with a `<br>` between two. Only what is the Platform's own is written by hand: Copilot's `/` menu (`COPILOT_SLASH_MENU`: its hidden zero-width marks, and the `//` it puts back after the editing command deletes it while the menu is open) and its late toolbar (`LATE_TOOLBAR`). When the live site moves to a newer Lexical, bump both pins together, then check `LEXICAL_SCRIPTS` in that file against the new packages: the path of each production CommonJS file, and the modules they `require()` (a module missing from the list fails the page on load). Update `package-lock.json` and run `tests/e2e/content/perplexity-insertion.spec.ts` and `tests/e2e/content/m365copilot-insertion.spec.ts`.
- Locally the browser is headed; CI runs headless with one retry.
- A hover a test asserts on goes through `readWhileHovering` or `holdHover` (`tests/e2e/utils/hover.ts`), not a bare `locator.hover()`. A headed run opens one window per test, over one another; when one opens over the window under the real pointer, Chrome gives that page a real mouse event at the pointer's position and the hover Playwright set ends, which a bare `hover()` never takes back. CI, headless, has no real pointer.
- `tests/e2e/` has its own `tsconfig.json`, which `npm run typecheck` checks.
- Linux CI renders wider fonts than the Mac (DejaVu Sans): a layout assertion that passes locally can fail there. `npm run test:e2e:linux -- <spec>` runs a spec the way CI renders it, in Docker; `tests/e2e/README.md` says how.
- A locator assertion (`toHaveAttribute`, `toHaveText`, `toHaveClass`…) takes a string or a RegExp. An asymmetric matcher such as `expect.stringContaining(...)` makes it pass whatever the value, and `npm run lint` rejects it in `tests/e2e/` (the GritQL plugin in `biome-plugins/`).

## On the live Platforms: `npm run live:check`

The e2e suite runs the content script on stand-in pages. A change to `src/content` can still pass there and fail on a live Platform, as the `//` of PR #576 did on Copilot's Lexical editor. `npm run live:check` (`scripts/live-check.ts`) runs the hand checks for you. It builds `dist/`, loads it into Chromium with a persistent profile, opens each Platform, and prints one PASS or FAIL line per case:

| Case | Passes when |
|------|-------------|
| `//` in an empty field | the Prompt selector is open and the field is empty |
| `//` with a pause (Copilot's `/` menu open) | the same, with the second slash typed after the first one has opened Copilot's menu at copilot.cloud.microsoft |
| `'Hi //there'` | the selector is open and the field reads `Hi there` |
| icon on the toolbar after a late composer | `button.prompt-library-integrated-icon` ends with `data-mpm-placement="toolbar"`, or on the Anchored overlay where that is the designed fallback: a chain read by English ARIA labels (ChatGPT, Mistral, Perplexity) on a page whose `lang` is another language, where the chain finds its composer but none of its anchors. The line then says so |
| icon not moving while typing | the button keeps its placement, its `data-mpm-anchor` and its position (within 1 px) while `Hello world` is typed. On the toolbar, the element of the chain the button stands against is held from before typing, in the composer of the field typed in (the match the button stands against, else the first): after it, the button must still be in that field's composer and stand against that same element (right before or after it, or its first or last child, as the chain says) at the same distance from it. A button against no match before typing fails, and the line says so. Gemini, Mistral and Microsoft 365 Copilot show a send button once the field has text, which pushes their controls and the button with them about 40 px left, so the line gives the move on the page too, but only a move from the anchor fails. A button now beside another element the anchor selector also finds fails. Mistral turns its voice control into the send button and renders a new voice control between it and the Prompts button: when the held element no longer matches the selector, the button is judged against the element the selector finds now, and the line says "its anchor re-rendered". On the Anchored overlay, the position on the page; on the toolbar with no anchor found before or after typing, too, and the line says "anchor not found, measured on the page", with "before typing" or "after typing" when it was found on one side only |

Each line also says what was read: whether the selector was open, the field's text, any insertion feedback, and the placement and anchor. The script types only its own text. It reads the field line by line: a textarea's value, or all of a rich-text editor's text in document order, each paragraph a line. So an empty editor's lone empty paragraph reads empty, while blank lines and text outside the paragraphs do not. A case starts only in an empty field; icon-steady reads it again after it reads where the button is, just before its first key. The field is found again just before the click that puts the caret in it, and once more each time the Platform replaced it before that click, 3 editors at most: Gemini mounts its editor, then replaces it about 200 ms later. A field that holds a draft (one the Platform restored, spaces, line breaks or a slash alone included) is left as it was, and its case fails as not run. After each case, the script empties the field only when it holds nothing, or exactly what the case can leave there: its text with or without its `//`, or what it typed before it was cut short. A finished `//` case owns `//`, but not a lone `/` or more slashes, except the `/` menu case, where Copilot's menu may take one. The field is read after the click that puts the caret in it and again after Select All, just before the Backspace. Two drafts can still be erased with no note: one restored in the one round trip between that last read and the Backspace, and one that is exactly a text the case owns, such as a lone `/` restored during the `/` menu case. A draft the Platform restores during the case is not deleted, but the keys the case typed after the restore stay in the field with it (for example "Mon brouillon //"). The line then ends with "field holds text the case did not type, left as it was". If the field cannot be emptied, the line ends with "field NOT emptied after". Either way, check that Platform for a leftover draft. The two icon cases first wait for the settled placement: the toolbar, or the Anchored overlay once the extension's 5 s grace for a late toolbar has passed. It exits 1 if any case fails.

- Most Platforms need sign-in. Sign in once with `npm run live:check -- --login`, then close the browser. The profile is `~/.my-prompt-manager/live-check-profile`; `--profile` or `LIVE_CHECK_PROFILE` changes it. The script runs bundled Chromium (`--channel` changes it) because branded Chrome no longer loads an unpacked extension from the command line. That is also why this profile is separate from the one `composers:capture` signs into with Chrome.
- `--only copilot,perplexity` checks some of the Platforms. `copilot` reaches Copilot's Lexical editor and its `/` menu at copilot.cloud.microsoft only when the profile is signed in with a work account, which redirects there. `m365copilot` opens m365.cloud.microsoft/chat, which redirects a work account to copilot.cloud.microsoft too, so it needs the same work-account sign-in. `--dist <dir>` checks another build without building, for example an older commit built in a separate checkout.
- Expected, not yet seen live: against a build from before 15eed47, the `//` cases on copilot.cloud.microsoft print FAIL, and at `main` they print PASS. Offline, on the stand-ins, the build from before 15eed47 fails the three `//` cases of `m365copilot` and two of `perplexity`; `copilot`'s textarea stand-in passes at both builds. The live run is still to do.
- `--stand-in --headless` runs the same cases on the e2e stand-in pages. It checks the script itself, with no sign-in needed. Any profile works, the signed-in one included: each page bypasses the service workers the profile holds, since a worker answers a navigation before the stand-in's route (chat.mistral.ai registers one for a signed-in user). `tests/e2e/scripts/live-check.spec.ts` checks in the e2e suite that the cleanup empties the Lexical editors of the Perplexity and copilot.cloud.microsoft stand-ins and leaves a draft as it was, and that the Mistral stand-in opens past such a worker.
- A maintainer chore like `composers:capture`, not a CI job: CI has no signed-in profile.

## CI

`.github/workflows/pr-checks.yml` runs on every pull request: type check, lint, `npm run test:coverage` (the coverage threshold is in `vitest.config.ts`), build, the Playwright suite and a security audit. The end-to-end job takes about ten minutes.
