<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Multi-viewport capture layout (optional)

Use this pattern when you need **several fixed widths on one page** — e.g. responsive UI documentation — and viewport `@media` queries alone would not show all states in a single Figma import.

## When to use

- One HTML file must show the same UI at multiple widths side-by-side (stacked vertically).
- Production CSS relies on **viewport** media queries but you need **container-width** fidelity per strip.

Skip this pattern for single-state captures — a plain HTML page with `capture.js` is enough.

## Strip structure

Each viewport is a **strip**:

1. **Layer A — Subject block** — Fixed-width **`.figma-capture-viewport`** containing the UI markup and production styles scoped for that width.
2. **Layer B — Presentation** (optional) — **`.figma-capture-strip-label`** above the viewport (name + px). Light separators and page background between strips.

Put all strips inside one root (e.g. `#figma-capture-root`) with `min-width` at least the widest viewport plus padding, `max-width: none`, `display: flex; flex-direction: column`.

## Viewport widths

**Do not assume fixed breakpoints.** Ask the user or read project docs (Storybook `preview.tsx`, design tokens, CSS breakpoints, Figma frames). Example widths teams often use:

| Label | Example width |
| ----- | ------------- |
| desktop-xl | 1920px |
| desktop | 1440px |
| laptop | 1280px |
| tablet | 768px |
| mobile | 415px |
| mobile-sm | 360px |

Order strips **largest → smallest**. Omit widths the user does not need.

## Strip-scoped CSS

Duplicate markup per strip or scope styles under a per-strip wrapper. **Do not** rely on browser viewport `@media` alone when every strip must appear at its intended width in one capture.

## CSS utilities

See the **Authoring reference** section in `code-to-figma` for the `.figma-capture-*` class block, or paste widths that match your project's breakpoints.

## Page frame wrappers

Some codebases wrap content in layout shells (max-width columns, page padding). Mirror those wrappers **inside** each viewport so the capture matches production — discover the pattern from the project's layout components or CSS, do not invent a generic frame.
