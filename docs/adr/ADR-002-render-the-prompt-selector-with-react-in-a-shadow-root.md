# Render the Prompt selector with React inside one shadow root, loaded on first use

* Status: accepted
* Deciders: Maintainer of My Prompt Manager, in a design session (with Claude)
* Date: 2026-11-10

Technical Story: Redesign of the Prompt selector after the Atelier 1C mockup. No ticket yet.

## Context and Problem Statement

The Prompt selector is built by hand with DOM calls in `src/content/core/injector.ts`, appended to the Platform's `document.body`, and styled by a `<style>` element added to the Platform's `<head>`. Only prefixed class names keep the Platform's CSS out of it and its CSS out of the Platform. The content bundle holds no React and weighs about 134 KB.

The redesign adds tabs, a two-step flow with Variables filled in inside the text, enter and exit animations, a confirmation with Undo, and a state machine that must be testable without a DOM. It also requires that no style leaks either way and that the selector is never clipped by a Platform container. How should the selector be rendered and isolated?

## Decision Outcome

Chosen option: "React in one shadow root on `body`, loaded on first use", because it is the only option that gives real style isolation, lets the selector share the popup's component model and tokens, and keeps the cost off pages where the user never opens it.

What this means:

* **One shadow host.** A single element appended to `document.body` holds a shadow root. The selector, the insertion confirmation and the sweep over the input field render inside it, positioned from the input field's rectangle. Nothing of the selector is added to the Platform's own tree, so an `overflow: hidden` container cannot clip it.
* **Styles inside the shadow root only.** The selector's CSS and tokens live in the shadow root. The `<style>` in the Platform's `<head>` keeps only what the Prompts button needs, since the button stays in the Platform's action bar.
* **React on first use.** The React chunk is imported when the selector first opens (button or `//`), not when the content script starts. Detection, the button and the `//` listener stay plain TypeScript.
* **The font is loaded from the extension.** Schibsted Grotesk comes from the extension package, never from a CDN.
* **State outside React.** The selector's state machine and its keyboard handling are pure functions; React renders their state.

### Positive Consequences

* A Platform's CSS reset or a class-name collision can no longer restyle the selector, and the selector's rules can no longer reach the Platform.
* The selector is written in the same component model as the popup and side panel.
* The state machine and keyboard rules are unit-tested without a DOM.

### Negative Consequences

* The content script gains a React chunk of about 180 KB, paid on the first opening in each page.
* Every new shared chunk must be listed in `manifest.json` `web_accessible_resources` for custom sites, or the content script fails there silently (guarded by `check:custom-site-chunks` and `tests/e2e/content/custom-site-chunks.spec.ts`).
* Keyboard events are retargeted at the shadow host, and `document.activeElement` is the host: outside-click and focus logic must use `composedPath()` and the shadow root's `activeElement`.
* `@font-face` cannot be declared inside a shadow root, so the font is registered on the document; the family name is namespaced so it cannot collide with a Platform's own.
* Hard to reverse: once the components exist, going back to hand-built DOM means rewriting the selector.

## Considered Options

* **Keep hand-built DOM in the light DOM, restyled.** No new dependency, but no real isolation, and the two-step flow, animations and state machine would be written against raw DOM again.
* **Hand-built DOM inside a shadow root.** Isolation without React, but a second UI idiom to maintain beside the popup's, and no shared components.
* **An iframe served from the extension.** The strongest isolation, but it cannot be anchored and animated against the input field without message passing, and focus and keyboard handling across the frame boundary are fragile.
* **React in a shadow root, loaded with the content script.** Simpler loading, but every enabled page pays for React even when the selector is never opened.
