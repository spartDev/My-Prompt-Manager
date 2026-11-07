---
name: design-system
description: Visual design of the popup, side panel and Analytics page: color tokens, component patterns, focus and accessibility, in light and dark. Use when building, restyling or reviewing a UI component.
---

# Design system

`docs/DESIGN_GUIDELINES.md` is the design system. This skill routes into it: read the sections your change touches before you write or judge a class.

| The change touches | Read in `docs/DESIGN_GUIDELINES.md` |
|---|---|
| any color | Color System, with its Rules of use |
| a button, field, card, badge, dialog or switch | Component Patterns |
| spacing, radius, shadow or type | Spacing & Layout, Border Radius, Shadows & Effects, Typography |
| focus, keyboard or labels | Accessibility, and Focus Classes under Component Patterns |
| a Category's color | Category Colors: user data, not tokens |

## Color

Color with the token classes of `src/theme/tokens.css`: surfaces `bg-app`, `bg-card`, `bg-subtle`; text `text-primary`, `text-secondary`, `text-tertiary`; fields `border-input` with `focus-input`; actions `bg-accent hover:bg-accent-hover` and `bg-danger hover:bg-danger-hover`. A token class follows the theme on its own, so one class covers light and dark. When no token fits, add one as "Adding or changing a token" describes.

Check a contrast with `npx tsx scripts/contrast.ts <fg> <bg>`: it prints the ratio of the app's own `getContrastRatio`, the one the unit tests use.

## Atelier 1C mockups

Kept while the Atelier 1C redesign lasts: drop this section when its last screen has shipped.

The mockups are the artifact <https://claude.ai/code/artifact/cbc1341a-bc8d-4568-af95-49c3fd7477a2>, private to its owner. Read it with the Artifact tool (`action: "read"` with `paths`, or `action: "list"` with `scope: "files"`), never with WebFetch or curl, and never through `claude_design`, which is not authorised here; there is no copy in the repository. Its `project/` folder holds one page per set of screens (`Atelier 1C - Nouveau prompt.dc.html`, `Atelier 1C - Collections.dc.html`, under 5 KB each; `compat.json` lists the pages) and the component files that draw the screens: `MPM-C-Atelier.dc.html` (about 125 KB) and `MPM-C-Atelier-Sombre.dc.html`, its dark variant. A page shows a screen with `<dc-import name="MPM-C-Atelier" screen="editor-new">`, which `support.js` fetches and renders, so serve the folder rather than opening the page from `file://`, and do not grep the component for a screen name: that finds its markup, not the screen.

To see one screen, as PR #518 did: read the page, `support.js`, `compat.json` and the component into the scratchpad with one Artifact read, serve that `project/` folder on a free port, in the background (`python3 -m http.server <port> --bind 127.0.0.1 --directory <folder>`), and open `http://127.0.0.1:<port>/<page>` in the browser pane. Every `screen` the page names is one you can screenshot there.

## Review

Check every class of the component against the sections above, and report each one the guidelines do not prescribe, with the token or pattern that replaces it.

## Done

A component is done when:

- its file is listed in `src/theme/__tests__/rawColors.test.ts`, which keeps it on the tokens;
- it was checked in the real extension in light and dark, with a screenshot of each from an e2e spec.
