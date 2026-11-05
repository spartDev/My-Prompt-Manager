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

## Review

Check every class of the component against the sections above, and report each one the guidelines do not prescribe, with the token or pattern that replaces it.

## Done

A component is done when:

- its file is listed in `src/theme/__tests__/rawColors.test.ts`, which keeps it on the tokens;
- it was checked in the real extension in light and dark, with a screenshot of each from an e2e spec.
