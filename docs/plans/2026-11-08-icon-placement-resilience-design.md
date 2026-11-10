# Icon placement that survives Platform UI changes

**Status:** Accepted; Phase 1 in progress (My-Prompt-Manager-tuh.1)
**Date:** 2026-11-08
**Author:** Thomas Roux (with Claude)

## Problem

The content script places the Library icon inside each Platform's composer toolbar. Every Platform has its own UI and changes it often. Two symptoms follow, reported on ChatGPT and Claude first but structural to all seven built-in Platforms:

1. **The icon is lost.** It shows after load, then disappears when the Platform re-renders its composer (typing the first character, attaching a file, opening a conversation, switching composer modes). Nothing brings it back until the URL changes.
2. **The icon is misplaced.** When the toolbar is not found, the icon lands at a fixed offset to the right of the editor, over the send button or outside the visible area, and does not follow scroll or resize.

## Causes, with evidence

### 1. Placement is keyed on the Platforms' styling, not on what elements mean

The toolbar is found with Tailwind utility chains, hashed framework classes and even SVG path data:

| Platform | What we match on | Where |
|---|---|---|
| Claude | `.relative.flex-1.flex.items-center.gap-2.shrink.min-w-0`, then a `<path d="M10.3857…">` to find the clock button | `claude-strategy.ts:49`, `injector.ts:905` |
| ChatGPT | `.ms-auto.flex.items-center.gap-1\.5` | `chatgpt-strategy.ts:34` |
| Perplexity | `.flex.items-center.justify-self-end.col-start-3.row-start-2` | `perplexity-strategy.ts:20` |
| Mistral | `.flex.w-full.max-w-full.items-center.justify-start.gap-3` then `.flex.ms-auto` | `mistral-strategy.ts:39`, `injector.ts:964` |
| M365 Copilot | `.fai-ChatInput__actions > span.___11i0s0y` | `platforms.ts` |
| Copilot | `.relative.bottom-0.flex.justify-between.pb-0\.5.pe-2\.5.ps-1\.5 > …` | `platforms.ts` |

A utility chain is rebuilt at every design pass; one class added or removed and the match is gone. These selectors are also global (`document.querySelector`), so they can match a message's action bar or a sidebar instead of the composer.

### 2. Two copies of each selector, and the undocumented one wins

`src/config/platforms.ts` presents itself as the single source of truth and `docs/PLATFORM_INTEGRATION.md` says to edit only that file. But `ClaudeStrategy`, `ChatGPTStrategy`, `PerplexityStrategy`, `MistralStrategy` and `GeminiStrategy` hard-code their own `buttonContainerSelector` in their constructor, and `PlatformManager.getButtonContainerSelector()` returns the strategy's copy. The copies have already drifted:

- ChatGPT: config says `div[data-testid="composer-trailing-actions"] .ms-auto.flex.items-center`; the strategy, which wins, says `.ms-auto.flex.items-center.gap-1\.5`.
- Perplexity: config says `.bg-background-50.dark\:bg-offsetDark.flex.items-center`; the strategy says `.flex.items-center.justify-self-end.col-start-3.row-start-2`.

A fix applied to the documented file changes nothing.

### 3. The injector never notices a lost icon

`detectAndInjectIcon()` re-injects only when the editor element changes identity (`textarea !== this.state.currentTextarea`, `injector.ts:547`). React and Angular reconcile the toolbar without touching the editor, so our node is removed while the editor stays, the guard short-circuits, and the icon is gone. The document-wide MutationObserver fires on every added node but reaches the same guard. The only recovery paths are a URL change (SPA monitor, 1 s poll) and the Settings toggle.

### 4. The last resort is a fixed offset in the body

When no container is found on a built-in Platform, `positionIcon()` (`injector.ts:1176`) appends the icon to `document.body` at `editor.right + 10px / editor.top + 10px`, with no update on scroll, resize or layout change, no viewport clamping, no hide when the editor hides. Custom sites get a far better fallback than built-in Platforms do: CSS Anchor Positioning, then Floating UI with `autoUpdate`, `flip`, `shift` and `hide` (`positionIconWithCSSAnchor`, `positionIconWithFloatingUI`), but that code only runs when a `CustomSite.positioning` exists.

### 5. The icon borrows each Platform's own class names for its look

`element-factory.ts` builds the Claude icon with `text-text-300 hover:text-text-200/90`, the Perplexity icon with `text-textOff hover:text-textMain`, the Mistral icon with `text-subtle hover:text-default`, the Copilot icon with thirty hashed Fluent classes (`r1alrhcs ffp7eso f1p3nwhy …`). When a Platform renames them the icon is still placed but comes out the wrong size or color, with no hover: the other half of "misplaced". The Copilot icon also carries its own MutationObserver and a `<style>` block to repair this at runtime.

### 6. No test can fail when a Platform changes

The e2e fixtures (`tests/e2e/fixtures/platform-pages.ts`, `tests/e2e/content/injection.spec.ts`) contain the editor alone: a `.ProseMirror` div or a React `<textarea>`, no toolbar. Every e2e run therefore exercises the floating fallback of cause 4 and never the integrated placement. Nothing in the repository mirrors a real composer, and `handleSelectorTest` exists only for custom sites. A Platform redesign is discovered by users.

Smaller contributors: the selector cache holds results for 2 s; initial detection retries 20 × 500 ms then relies on the observer alone; the per-hostname `if` ladder in `injectIcon()` (`injector.ts:839-990`) is the only place the Claude clock-button and Copilot microphone heuristics exist, so they cannot be unit-tested apart from the whole injector.

## Goals

- The icon sits in the composer toolbar on every built-in Platform and stays there across re-renders.
- When the toolbar cannot be found, the icon degrades to one predictable, anchored position on the editor that follows scroll and resize, never to a lost one.
- A Platform UI change is detected by us, in a test or a log, before users report it.
- A user can repair the placement on their side the same day, without waiting for a release.

Non-goals: adding Platforms, changing the Prompt selector, changing the Insertion strategies.

## Design

### 1. Placement as data: an ordered chain of semantic anchors per Platform

`buttonContainerSelector: string` is replaced in `platforms.ts` by:

```ts
interface IconPlacement {
  /** Nearest ancestor of the editor that bounds the composer. Found with editor.closest(), never a global query. */
  composer: string;
  /** Tried in order inside the composer; the first anchor found wins. */
  anchors: Array<{
    find: string;
    relation: 'before' | 'after' | 'inside-start' | 'inside-end';
  }>;
}
```

Anchors name what an element is for, not how it is styled: `button[aria-label*="attach" i]`, `button[data-testid="composer-speech-button"]`, `button[type="submit"]`, `[role="toolbar"]`. ARIA labels and test ids are contracts a Platform keeps for its own accessibility and its own tests; utility classes are an implementation detail. The chain is scoped to the composer found by walking up from the editor, so a selector that also matches elsewhere on the page cannot win.

Example shape for ChatGPT (the exact anchors are to be confirmed on the live site when implementing):

```ts
iconPlacement: {
  composer: 'form',
  anchors: [
    { find: '[data-testid="composer-trailing-actions"] button[aria-label*="dictate" i]', relation: 'before' },
    { find: '[data-testid="composer-trailing-actions"]', relation: 'inside-start' },
    { find: 'button[data-testid="send-button"], button[type="submit"]', relation: 'before' },
  ],
}
```

The last anchor of every chain is implicit: the editor itself, placed with the anchored overlay of §3.

The config lives in one place. Strategies stop carrying a copy; `getButtonContainerSelector()` is removed from the strategy interface; the hostname `if` ladder in `injectIcon()` (Copilot microphone, Claude clock path, Perplexity first child, ChatGPT first child, Mistral `ms-auto`) becomes data in the chains.

### 2. A controller that owns the icon's lifecycle

New module `src/content/core/icon-placement.ts`, one `IconPlacementController` per injector:

- `place(editor)` resolves the chain, inserts the icon and records `{ editor, anchorIndex, composer }`.
- A MutationObserver scoped to the composer's parent (`childList`, `subtree`) runs a cheap check per batch: `icon.isConnected` and non-zero `getBoundingClientRect()`. On failure it re-places, debounced to one animation frame then 100 ms. Re-placement is idempotent.
- `detectAndInjectIcon()` calls `controller.ensure(editor)` on every pass instead of guarding on editor identity; the controller decides whether anything changed.
- The resolved `anchorIndex` is written as `data-mpm-placement` on the icon and logged. Reaching the implicit editor overlay on a built-in Platform is logged as a warning: that log line is the "a Platform changed its UI" signal.

### 3. One anchored overlay as the universal fallback

`positionIcon()` is replaced by `placeOnEditor()`. The last resort for built-in Platforms is the machinery custom sites already have: `positionIconWithCSSAnchor` (Chrome 125+) then `positionIconWithFloatingUI` (`@floating-ui/dom` 1.8.0, already a lazy-loaded dependency) with `autoUpdate`, `flip`, `shift` and `hide`, anchored on the editor's inside bottom-right corner with a small inset. The icon then follows scroll and resize and hides with the editor.

Both functions move out of `injector.ts` (2353 lines today) into `src/content/core/anchored-overlay.ts`, shared by custom sites and the built-in fallback. When neither tier can run (no CSS Anchor support and Floating UI failed to load or to compute), a one-shot static placement at the same corner remains, with a warning, so the icon is never absent.

### 4. The icon owns its look

The icon stops copying Platform class names. The stylesheet injected by `styles.ts` defines one `.mpm-icon` class sized by CSS variables (`--mpm-icon-size`, `--mpm-icon-radius`) with `color: currentColor` and a hover background from `color-mix(in srgb, currentColor 10%, transparent)`. At placement, the controller samples the anchor button's computed `height`, `borderRadius` and `color` and sets them as those variables on the icon, so the icon is right-sized next to its neighbours whatever their class names are. The Copilot theme observer and its `<style>` block go away; the theme-manager's existing change hook triggers a re-sample. Pixel-exact mimicry of each Platform's hover is given up for a consistent, owned look; today's mimicry already breaks at each restyle.

The `design-system` skill applies when this part is built.

### 5. Tests that can fail when a Platform changes

- **Unit:** `IconPlacementController` runs against one HTML fixture per Platform in `tests/fixtures/composers/<platform>.html`, a sanitized copy of the live composer markup (toolbar and editor, text and values removed). Tests assert the chain resolves to anchor 0, that removing the toolbar node triggers re-placement, and that an editor-only DOM falls to the overlay.
- **e2e:** the fixtures in `platform-pages.ts` gain the composer skeleton (toolbar with its ARIA labels), and `injection.spec.ts` asserts the icon's parent is the toolbar, not `body`.
- **Drift capture:** `npm run composers:capture`, a Playwright script that opens each Platform in a persistent profile the developer has signed into, extracts the composer's sanitized `outerHTML` and rewrites the fixtures. `git diff` plus the unit tests then say whether each chain still resolves. Claude, Gemini and Mistral require sign-in, so an unattended CI job is not realistic; this is a documented chore run before each release, tracked in beads.

### 6. Repair without a release

When the controller reports the overlay fallback on a built-in Platform, the Platform's row in Settings shows that the icon was placed by fallback and offers "Place the icon", which opens the existing Pick Element flow (`element-picker.ts`, `element-fingerprint.ts`). The chosen fingerprint is stored as a per-Platform `positioning` override in settings, the same shape as `CustomSite.positioning`, and is consulted before the built-in chain. The user has the icon back the same day; the next release fixes the chain and the override is dropped once the chain resolves again.

A remotely updated chain list was considered and set aside: Web Store policy allows remote data, but a selector list fetched from the network is a new trust surface that `configurationSecurity.ts` would have to validate, and §6 covers the outage window at a fraction of the cost.

## Rollout

| Phase | Scope | What it fixes |
|---|---|---|
| 1 | §2 controller with the watchdog, §3 shared overlay fallback, remove the duplicate selector copies (keep today's selectors) | The icon is no longer lost, and no longer floats at a fixed offset |
| 2 | §1 semantic chains for the seven Platforms, delete the hostname `if` ladder, §4 owned look, §5 unit and e2e fixtures | Placement survives restyles; tests guard it |
| 3 | §5 capture script, §6 self-repair from Settings | We see a change before users do; users can repair meanwhile |

One pull request per phase, under one beads epic with one ticket per phase and acceptance criteria per ticket: light and dark screenshots on each Platform, the unit fixtures green, the e2e assertion on the icon's parent.

## Risks

- The semantic anchors must be confirmed on the live sites, three of which need sign-in. The capture script of Phase 3 is also the tool for Phase 2; capture by hand first.
- If the composer node itself is replaced, the scoped observer loses its target. The controller observes the composer's parent, and the existing document observer stays as the slow path, debounced.
- Chameleon sampling reads computed styles once; a theme switch after placement needs a re-sample, hooked on the theme-manager.
- `injector.ts` is the file every content change touches; splitting out the overlay and the controller in Phase 1 must keep the injector unit tests in `src/content/core/__tests__/` green, which today reach into the injector's private methods.
