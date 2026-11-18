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
- `src/test/guardrails/launch-state-guardrails.test.ts`: only `writeLaunchState` of `src/launch/write.ts` writes the steps and the end of the Welcome and the Last seen Release; no other module of `src/`, the service worker included, names their low-level writers, so the writer's Debug check is the only one they need, and only the service worker names the writers of the install.
- `src/test/guardrails/docPaths.test.ts`: every `src/` and `tests/` path cited by `CODING_STANDARDS.md`, the docs it routes to (this page, [ARCHITECTURE.md](./ARCHITECTURE.md), [COMPONENTS.md](./COMPONENTS.md), [DESIGN_GUIDELINES.md](./DESIGN_GUIDELINES.md), [ELEMENT_FINGERPRINTING_DESIGN.md](./ELEMENT_FINGERPRINTING_DESIGN.md), [SERVICES_AND_HOOKS.md](./SERVICES_AND_HOOKS.md), the ADRs) and the repo skills (`.claude/skills/*/SKILL.md`) exists. A worked example's placeholder Platform (`newplatform-`, `yourplatform-`…) and a path with a `<placeholder>` segment are skipped.
- `src/test/guardrails/readmeChromeVersion.test.ts`: every Chrome version in `README.md`, badge and text, equals `manifest.json` `minimum_chrome_version`.
- `src/test/guardrails/viewScrollContainer.test.ts`: every view that renders `<ViewHeader` puts `data-scroll-container` on its scrolling element, which the scroll lines of `src/popup.css` follow.
- `src/components/__tests__/modalDialogs.test.ts`: every `aria-modal` dialog of `src/components` takes its keyboard behavior from `useModalFocus`. `HAND_WRITTEN`, the dialogs that still carry their own handlers, is empty since the last two were migrated (My-Prompt-Manager-xaz) and only shrinks.

## Playwright

The config is `playwright.config.ts`. Its global setup (`tests/e2e/global-setup.ts`) runs `npm run build`, and the fixture of `tests/e2e/fixtures/extension.ts` loads `dist/` into Chromium, so an end-to-end run always tests the current code.

- Every test starts on a fresh profile, that is a first install: the service worker writes the What's new record and the Welcome record (pending) as the extension loads. The `storage` fixture waits for both (`waitForFirstInstallRecords`) before its reset, so no install write lands over a test's seed and a spec sees a Welcome record only if it seeds one. A spec that opens the popup or side panel without the `storage` fixture runs on the first install's store, a pending Welcome over an empty Library, so it opens on the Welcome, not the Library.
- A relaunch of the persistent context on the same profile (`launchExtensionContext` of `tests/e2e/fixtures/extension.ts`, as a restart of Chrome) fires `onInstalled` with reason 'install' again, store kept: Chromium installs an extension loaded with `--load-extension` afresh at every launch, even after a build at a higher version was copied over its folder. A real 'update', with the previous version, is `updateExtensionInPlace` of `tests/e2e/fixtures/extension-update.ts`: it copies the build at a higher version over the loaded folder and reloads the extension from chrome://extensions with developer mode on (off, that reload disables it). `tests/e2e/welcome/welcome-record.spec.ts` uses both. The extension's own logs of those events are Logger.info, silent in a production build: to read which event fired and from which version, copy the build with `copyBuildAt(path, version, { onInstalledProbe: true })` (and pass the same option to `updateExtensionInPlace`), which adds the observer of `tests/e2e/fixtures/oninstalled-probe.ts`; it records each `onInstalled` event in `chrome.storage.session` and writes nothing to `chrome.storage.local`. The probe refuses `dist/` and any folder inside it, links followed, so it only ever changes a copy (`tests/e2e/welcome/oninstalled-probe.spec.ts`). `tests/e2e/welcome/scenarios.spec.ts` reads it: it holds the Welcome's twelve acceptance scenarios S1 to S12, four tests of the ways out of the Welcome (Skip then no Pack, a refused add then the retry by the primary button, a refused add then Try again in its Notification, a refused add then Start empty from the step), and two update cases ("Pending through an update…" and S7 with no Prompt).
- A first install with a tab already open: `--load-extension` installs the extension before any tab exists, so `tests/e2e/welcome/chat-open-before-install.spec.ts` launches Chromium without it (`ignoreDefaultArgs: ['--disable-extensions']`, `--enable-unsafe-extension-debugging`), opens a Platform stand-in, then installs `dist/` into the running browser over CDP (`Extensions.loadUnpacked` on `context.browser().newBrowserCDPSession()`). `onInstalled` fires 'install' as for a Web Store install, and the open tab must answer `//` with no reload.
- Page objects are in `tests/e2e/pages/`, workflows and assertions in `tests/e2e/utils/`, seeded data in `tests/e2e/fixtures/`. `tests/e2e/README.md` describes them.
- Content tests run on stand-in pages served on each Platform's own host (`tests/e2e/fixtures/platform-pages.ts`). The Perplexity and copilot.cloud.microsoft stand-ins mount a real Lexical editor: the `lexical` and `@lexical/plain-text` packages, pinned in `package.json` at the version perplexity.ai serves (0.41.0), are served from `node_modules` in their production CommonJS build and loaded through a minimal `require()` (`moduleScripts`), as the ChatGPT stand-in loads React. Plain text, because the live editors lay pasted lines out in one paragraph with a `<br>` between two. Only what is the Platform's own is written by hand: Copilot's `/` menu (`COPILOT_SLASH_MENU`: its hidden zero-width marks, and the `//` it puts back after the editing command deletes it while the menu is open) and its late toolbar (`LATE_TOOLBAR`). When the live site moves to a newer Lexical, bump both pins together, then check `LEXICAL_SCRIPTS` in that file against the new packages: the path of each production CommonJS file, and the modules they `require()` (a module missing from the list fails the page on load). Update `package-lock.json` and run `tests/e2e/content/perplexity-insertion.spec.ts` and `tests/e2e/content/m365copilot-insertion.spec.ts`.
- Locally the browser is headed; CI runs headless with one retry.
- A hover a test asserts on goes through `readWhileHovering` or `holdHover` (`tests/e2e/utils/hover.ts`), not a bare `locator.hover()`. A headed run opens one window per test, over one another; when one opens over the window under the real pointer, Chrome gives that page a real mouse event at the pointer's position and the hover Playwright set ends, which a bare `hover()` never takes back. CI, headless, has no real pointer.
- `tests/e2e/` has its own `tsconfig.json`, which `npm run typecheck` checks.
- Linux CI renders wider fonts than the Mac (DejaVu Sans): a layout assertion that passes locally can fail there. `npm run test:e2e:linux -- <spec>` runs a spec the way CI renders it, in Docker; `tests/e2e/README.md` says how.
- Accessibility: `tests/e2e/welcome/welcome-a11y.spec.ts` audits the Welcome and the Library it leaves for with `@axe-core/playwright` (tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`), walks the Welcome with the keyboard alone, and reads names and states from Chrome's own accessibility tree over CDP (`Accessibility.getFullAXTree`). axe reads colors as drawn: let the page's finite animations end before it runs.
- A focus ring as drawn: `focusRingOf` and `ringSides` of `tests/e2e/utils/focusRing.ts` give an element's ring box from its computed outline and read its four sides back from a screenshot's pixels, the ring's full width on each, so a ring cut by a fade or a scroll box (even by one of its 2 pixels), or not drawn after a click (`:focus-visible`), fails where its computed style alone would pass.
- The Welcome's motion and its failure Notification (My-Prompt-Manager-ojz.20). `tests/e2e/welcome/welcome-motion.spec.ts`: 5s after each step shows, in the popup and a side panel, nothing runs on time (`document.getAnimations()`), step 2 holds the whole name with a still caret, and it logs when each step's last animation ends; step 3's four scroll-driven edges of the Packs grid, which Chromium lists as running while the grid shows, are read apart and proven still with no input. `tests/e2e/welcome/welcome-add-failure.spec.ts`: the add refused for real (`tests/e2e/utils/storageFiller.ts`), the Notification whole and clear of the close button and of the step's controls at 400 x 500, 320 x 500 and 360 x 600, light and dark, still there 10s later; it writes six screenshots to `WELCOME_FAILURE_SCREENSHOTS` (`test-results/welcome-add-failure` when unset).
- `page.screenshot({ animations: 'disabled' })` cancels scroll-driven animations too, such as the scroll cue of the Welcome's Packs: leave the option out of a screenshot that must show one.
- The Welcome beside its mockup: `tests/e2e/welcome/welcome.visual.spec.ts` shoots the three steps in light and dark, in the popup (400 x 500) and a side panel of the mockup's side format (400 x 860), and the Library at the exit with its Notification in the popup, each at a fixed moment (animations ended, step 2's blank holding the whole name, no hover, no keyboard focus). Set `WELCOME_VISUAL_DIR` to a folder outside `test-results/`, which Playwright empties at each run. The mockup (Atelier 1C, `MPM-C-Atelier` and `MPM-C-Atelier-Sombre`, screen `empty`) is not in the repository: read its files as the `design-system` skill says, then `node scripts/welcome-mockup-shots.mjs <its project folder> <out>` shoots the same screens at the same sizes, and `node scripts/welcome-side-by-side.mjs <ours> <mockup> <out>` sets each pair side by side with a caption. The mockup's Library is the Atelier 1C redesign, not shipped, so the exit pair compares the Notification only; the script also writes `notification-popup-<theme>.png`, the top 90 px of both halves. `scripts/pr-assets.sh <topic> <files>` publishes them, named `<screen>-<surface>-light.png` and `-dark.png`, as Light | Dark tables.
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

## The Welcome by hand

How to check each of the Welcome's twelve acceptance scenarios yourself, in Chrome. Each one also runs as an automated test, named `S1 …` to `S12 …` in `tests/e2e/welcome/scenarios.spec.ts`: `npx playwright test tests/e2e/welcome/scenarios.spec.ts -g "S6 "` replays one. What the automated tests cannot do, a person does here: click the toolbar icon, and close the popup by clicking outside it.

"Open the extension" means click its toolbar icon; "close" means click outside the popup, or close the side panel. "The Welcome" is the full-screen three-step screen; "the Library" is the list of Prompts with the tab bar at the bottom (Library, Categories, Analytics, Settings). A Notification shows at the top for about three seconds; with the pointer on it, it stays. The failure of the Welcome's add stays until you act.

### A test install

1. In this repository, run `npm run build`. Then copy the build to a folder of its own, the test folder: `rsync -a --delete dist/ ~/mpm-test/`. You load this copy, not `dist/`, so you can change its version, and the next build does not change the installed extension under you.
2. Set the version of the test folder: in `~/mpm-test/manifest.json`, `"version": "2.0.0"`. It is the Release that brings the Welcome, and the only one with Release notes in `src/whatsNew/releaseNotes.ts`, so a What's new that must not show could show; `package.json` and `manifest.json` still say 1.9.0. The procedures below rely on that registry: notes for 2.0.0 and none for 1.9.1 or 1.9.2. If the Welcome ships under another number, three things change together: the Release notes registry, the version in `package.json` and `manifest.json`, and the versions written in these procedures (here, S5, S7 and the two update cases).
3. Use a Chrome profile of its own (Chrome menu, Profiles, Add), so your own Library is never touched. In it, open `chrome://extensions`, turn on Developer mode (top right), click Load unpacked and choose `~/mpm-test`. This is a first install. Pin the extension (puzzle icon in the toolbar, pin). Leave Developer mode on for as long as you test: turning it off disables an extension loaded unpacked.
4. The toolbar icon opens the side panel: Settings, Appearance, Open in is Side panel by default. To see the popup while the Welcome is not finished, open `chrome-extension://<ID>/src/popup.html` in a tab: it is the popup's page, and `<ID>` is on the extension's card in `chrome://extensions`. Once the Welcome is finished, Settings, Appearance, Open in, Popup makes the icon open the popup.
5. To start again from a first install: on the extension's card, click Remove, then Load unpacked the test folder again. Removing the extension deletes all it stored. Clear All Data does not do that for the Welcome: a Welcome once finished stays finished after it.

### An update by hand

Chrome updates an extension loaded unpacked when its version grows and you click its Reload. It fires the same update event, with the previous version, as an update from the Chrome Web Store.

1. Optional, for new code: copy the new build over the test folder, `rsync -a --delete dist/ ~/mpm-test/`.
2. In `~/mpm-test/manifest.json`, raise `"version"` (for example from `1.9.1` to `1.9.2`).
3. At once, in `chrome://extensions` with Developer mode on, click the circular arrow (Reload) on the extension's card. Do not restart Chrome between steps 2 and 3: the new version must be first seen by that Reload.

The card now shows the new version. What you cannot check this way is the Web Store's own download; the event the extension receives is the same.

### Replay the Welcome (Debug mode)

Debug mode shows the Welcome from step 1 at each opening, then What's new once you finish it, and records nothing about either: not the step reached, not the Welcome finished, not the Last seen Release. The Packs you add do stay in your Library, without duplicates.

1. Start where the Library shows (the Welcome finished). Open the Settings tab, go down to Advanced and turn Debug mode on. You must see under it: "Debug logging is now active. Each time you open the extension, the Welcome shows from its first step, then What's new…". Close the extension.
2. Open the extension: you must see the Welcome at step 1 ("Your best prompts, one tap away", the first of the three dots long, no Back button). Click Next: step 2. Close.
3. Open again: you must see step 1 again, not step 2. Click Skip: step 3 ("Start with a pack"). Click Writing to unselect it. Close.
4. Open a third time: step 1 again. Click Skip: Product and Writing are selected again, as by default; your choice of step 3 was not kept.
5. Click Add 9 prompts. You must see the Library and, at the top, the Notification "9 prompts added · Open your AI chat and type //" (or "Your library is ready · Open your AI chat and type //" if those Prompts were already there). Then What's new rises over the Library: Debug mode shows it after the Welcome. Click Got it.
6. Do step 5 again: open, Skip, Add 9 prompts. You must see "Your library is ready · Open your AI chat and type //", then What's new; Got it. The Library holds as many Prompts as after step 5: none was added twice.
7. Turn Debug mode off. At every opening the Welcome covers the tab bar, so you reach Settings only by finishing the Welcome, then closing What's new. To finish without adding Prompts: Skip, unselect every Pack, click Start empty; What's new rises over the Library with the editor "New prompt" under it; click Got it, then Cancel in the editor. Then Settings, Advanced, Debug mode off.
8. Close and open: you must see what you saw before step 1, the Library, with no Welcome and no What's new. Only the Pack Prompts of step 5 are new in it.

### The twelve scenarios

#### S1 I install the extension and open it

Do: make a test install (above). Open the extension (the side panel). Then open the popup's page in a tab (step 4 of "A test install").

You must see, in both: the Welcome at step 1. At the top, the logo and "My Prompt Manager", Skip and a round close button. The title "Your best prompts, one tap away" and under it "Save the prompts you reuse and find them in a second, here or right inside your AI chat.", the first of three dots long, a Next button and no Back button. No tab bar, no Library, no What's new, even after a few seconds.

Automated: `S1 I install the extension and open it: I see the Welcome, step 1`.

#### S2 I go to the end choosing Packs

Do: on a first install, open the extension. Click Next, then Next. On step 3, under the Packs, read the row "Type // in the chat on Claude ChatGPT Mistral Gemini Perplexity Copilot", the Platforms as pills. Product and Writing are selected; click Engineering to select it too. The button reads Add 15 prompts: click it.

You must see: the Library with 15 Prompts, those of Product, Engineering and Writing, the filter All selected; at the top, the Notification "15 prompts added" with, on a line of its own under it, "Open your AI chat and type //", whole with its `//`. No What's new. The Categories tab shows Product, Engineering and Writing. Do it again in the side panel made 320px wide (a new profile): the same two lines, neither cut, the Notification above the search field.

Automated: `S2 I go to the end choosing Packs: …`, and `the exit Notification shows whole, …` in `tests/e2e/welcome/welcome-exit.spec.ts` (popup 400 x 500, side panel 360 x 600 and 320 x 500, light and dark).

#### S3 I go to the end choosing no Pack

Do: on a first install, open the extension. Click Next, then Next. On step 3, click Product and Writing to unselect them. The button reads Start empty: click it.

You must see: the empty Library ("Your library is empty"), then, a quarter of a second later, the editor "New prompt" with the cursor in its title. No Prompt added, no What's new.

Automated: `S3 I go to the end choosing no Pack: …`.

#### S4 I close and reopen the extension after finishing

Do: finish the Welcome as in S2, or as in S3 and click Cancel in the editor. Close the extension and open it again. Quit Chrome, start it again and open the extension once more.

You must see, each time: the Library as you left it. No Welcome, no What's new.

Automated: `S4 I close and reopen the extension after finishing: …`.

#### S5 I restart Chrome, then update the extension

Do: make a test install at version `1.9.1` instead of `2.0.0` (step 2 of "A test install"). Open it, click Skip, then Add 9 prompts. Quit Chrome and start it again; open the extension. Update by hand to `1.9.2` and open it. Then update by hand to `2.0.0` and open it. Click Got it, close, open again.

You must see:
- after the restart: the Library of 9 Prompts, no Welcome, no What's new;
- after the update to 1.9.2, a Release without Release notes: the Library alone;
- after the update to 2.0.0, which has Release notes: What's new over the Library, its pill reading "New in 2.0.0", and no Welcome;
- after Got it, and at the next opening: the Library alone.

Automated: `S5 I restart Chrome, then update the extension: …`.

#### S6 I close the popup at step 2, then reopen it

Do: on a first install, open the extension and click Next: step 2 ("Leave blanks, fill them later"). Close the extension (click outside the popup, or close the side panel). Open it again. Then click Back, Next, and close with the Welcome's own round close button (top right). Open it again.

You must see, each time you open it: the Welcome at step 2, the second dot long, with a Back button. The other surface (popup's page or side panel) opens at step 2 too.

Close at any speed a person can. In the page, the step is written 3 to 10 ms after the click; seen from the service worker, it is stored at a median of 15 to 31 ms, 44 ms at the slowest. `tests/e2e/welcome/welcome-frame.spec.ts` asserts a median under 50 ms and every run under 100 ms, and that a popup closed 100 ms after the click opens again at step 2. Only a close in the few milliseconds before the step is stored could lose that one step and resume at step 1, never the Welcome (a decision of the epic My-Prompt-Manager-ojz).

Automated: `S6 I close the popup at step 2, then reopen it: …`.

#### S7 I start from an earlier Release with Prompts, and update

Do: build Release 1.9.0, which has no Welcome, in a checkout of its own: `git worktree add ../mpm-1.9.0 v1.9.0`, then `npm ci && npm run build` in `../mpm-1.9.0`, and `rsync -a --delete ../mpm-1.9.0/dist/ ~/mpm-test/`. Load it unpacked in a new test profile, not the profile of the earlier scenarios, whose store already holds this Release's records. Add two Prompts of your own. Then copy the current build over the test folder, set its version to `2.0.0` and click Reload (an update by hand). Open the extension; click Got it. Open again. Delete both Prompts, close, open again. When you are done with Release 1.9.0, remove its checkout: `git worktree remove ../mpm-1.9.0`.

You must see: after the update, What's new over your Library with your two Prompts, never the Welcome; after Got it and at the next opening, your Library alone; with both Prompts deleted, the empty Library, still no Welcome.

Automated: `S7 I start from an earlier Release with Prompts, and update: …`.

#### S8 I turn Debug mode on and open the extension three times

Do: steps 1 to 4 of "Replay the Welcome".

You must see: the Welcome at step 1 at each of the three openings, whatever step you had reached before, and the default Packs selected on step 3.

Automated: `S8 I turn Debug mode on and open the extension three times: …`.

#### S9 In Debug mode, I finish the Welcome with the same Packs twice

Do: steps 5 and 6 of "Replay the Welcome". Then open the Categories tab.

You must see: the first time "9 prompts added · Open your AI chat and type //" (or "Your library is ready" if they were there already), the second time "Your library is ready · Open your AI chat and type //"; the same number of Prompts after both; no Prompt twice; Product and Writing once each in the Categories tab. What's new after each finish.

Automated: `S9 In Debug mode, I finish the Welcome with the same Packs twice: …`.

#### S10 I turn Debug mode off

Do: before turning Debug mode on, open the extension and note what you see: the Library, its Prompts, its Categories, the Settings. Then run "Replay the Welcome" to the end (step 8).

You must see: the same opening as before, the Library with no Welcome and no What's new, the same Settings. The only change is the Pack Prompts you added in Debug mode (the epic's decision Q1: Packs added in Debug mode stay). In storage, which nothing on screen shows, the Debug mode switch leaves its Site settings key, `promptLibrarySettings`, written with its defaults where it had none: the epic counts that as the state from before.

Automated: `S10 I turn Debug mode off: …`.

#### S11 I time the whole journey reading each screen

Do: on a first install, start a stopwatch as you click the toolbar icon. Read every word of step 1, click Next. Read step 2 and watch the name type itself into the blank until it stops (twice, within 5 seconds), click Next. Read step 3, click Add 9 prompts. Stop when the Library shows with its Notification, once you have read it.

You must see: under 45 seconds.

Automated: `S11 I time the whole journey reading each screen: under 45s` (a reading model at 238 words a minute plus the measured machine time).

#### S12 I leave the Welcome with a Pack and copy a Prompt

Do: on a first install, start a stopwatch as you click the toolbar icon. Click Skip, then Add 9 prompts. Click the copy button (two squares) of the first Prompt card. Stop the stopwatch. Paste into any text field, for example a chat on claude.ai.

You must see: two clicks from the opening to a Library with Prompts (Skip, Add 9 prompts), one click from there to the copy; the pasted text is that Prompt's whole text, as shown in the card; under 60 seconds.

Automated: `S12 I leave the Welcome with a Pack and copy a Prompt: …`.

### Two update cases beyond the twelve

#### A Welcome left pending through an update

Do: make a test install at version `1.9.1` (step 2 of "A test install"). Open the extension; click Next (step 2, "Leave blanks, fill them later"); close. Update by hand to `2.0.0` (copy the build over the test folder again, set the version, Reload). Open the extension; click Next. Click Add 9 prompts. Close; open the side panel, then the popup's page.

You must see: at the first opening, the Welcome at step 1 and no What's new; after the update, the Welcome at step 2, alone, no What's new, though 2.0.0 has Release notes; step 3 with no What's new; after Add 9 prompts, the Library of 9 with "9 prompts added", and no What's new in that opening; at the next openings, the Library alone.

Automated: `Pending through an update: the Welcome resumes, What's new never follows`.

#### S7 with no Prompt

Do: as in S7, build Release 1.9.0 and load it unpacked in a new test profile. Open it once and add no Prompt. Copy the current build over the test folder, set its version to `2.0.0` and click Reload. Open the extension; click Got it. Open the side panel, then the popup's page.

You must see: after the update, What's new of 2.0.0 over the empty Library, never the Welcome; after Got it, "Your library is empty"; at the next openings, the empty Library alone.

Automated: `S7 I start from an earlier Release with no Prompt, and update: I see my empty Library, never the Welcome`.

### A chat open before the install

The Welcome tells a new user to type `//` in their AI chat; a chat they had open while installing must answer it too.

Do: in a new Chrome profile, open https://claude.ai (or another Platform) in a tab and sign in. In another tab, make a test install (above): Load unpacked the test folder. Open the extension and leave the Welcome with Skip, then Add 9 prompts. Go back to the chat tab, without reloading it, and type `//` in its message field.

You must see: the Prompts button beside the field, and `//` opens the Prompt selector with the Prompts of the Packs. No reload needed.

Automated: `AC5: a Platform tab open before the install gets the content script at the install: …` in `tests/e2e/welcome/chat-open-before-install.spec.ts`, on the Claude stand-in.

### Two checks of My-Prompt-Manager-ojz.20

#### A refused add, then Try again

Do: on a first install, open the extension; click Next, then Next. On chrome://extensions, click "service worker" under the extension and, in its console, fill the store: `const q = chrome.storage.local.QUOTA_BYTES; const used = await chrome.storage.local.getBytesInUse(); await chrome.storage.local.set({ filler: 'x'.repeat(Math.floor(q * 0.985) - used - 8) })`. Click Add 9 prompts. Wait 10 seconds without touching anything. In the console, `await chrome.storage.local.remove('filler')`; click Try again. Do it again in a side panel made 320px wide.

You must see: "Couldn't add the prompts" whole at the top, with Try again, never over the close button (in the 320px side panel, on two lines); the keyboard still on Add 9 prompts; after 10 seconds, still there; after Try again, the Library of 9 with "9 prompts added", once each.

Automated: `tests/e2e/welcome/welcome-add-failure.spec.ts`, and `a refused add, then Try again in the failure Notification…` in `scenarios.spec.ts`.

#### The motion stops by itself

Do: on a first install, open the extension and watch step 1 for 5 seconds. Click Next and watch step 2 for 5 seconds. Then turn on Reduce motion (macOS: System Settings, Accessibility, Display) and replay the Welcome (Debug mode).

You must see: step 1's three cards float once and stand still before 5 seconds; on step 2, the name types itself twice, then stays whole with a caret that no longer blinks, before 5 seconds. Under Reduce motion, nothing moves: the cards stand still, and the whole name shows at once with no caret.

Automated: `tests/e2e/welcome/welcome-motion.spec.ts`.

### Known case: Debug mode set by hand

Debug mode turned on by writing it into the extension's storage from DevTools, not through Settings, on a profile whose Welcome is still pending over an empty Library: finishing the Welcome with Packs adds them, and after Debug mode is off that profile has Prompts and a pending Welcome, which counts as finished. You see the Library, not the Welcome. It cannot happen through the interface, where Settings is behind the Welcome until the Welcome is finished; the epic accepts it (decision of 2026-11-18, My-Prompt-Manager-ojz).

## CI

`.github/workflows/pr-checks.yml` runs on every pull request: type check, lint, `npm run test:coverage` (the coverage threshold is in `vitest.config.ts`), build, the Playwright suite and a security audit. The end-to-end job takes about ten minutes.
