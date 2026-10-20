---
name: presentation-html
description: >
  Build innovative, high-impact single-file HTML presentations using the Sanofi M&S brand system.
  Manages the presentation ENGINE (full-screen slides, auto-fit scaling, keyboard navigation,
  progress bar) and the Sanofi design tokens (DM Sans, Violet #7A00E6); slide layouts are fully
  free and creative. Use when asked for an HTML presentation, slide deck, slideshow, "presentation",
  "slides", "deck", "pitch", or any topic to be communicated in slide format. Produces one
  self-contained .html file. Do NOT use to export a deck to PowerPoint/.pptx, and do NOT use for
  building a live web application UI — use elements-design-system instead.
version: 1.1.0
level: recommended
tags: [presentation, html, slides, deck, sanofi, branding, design]
allowed-tools:
  - Read
  - Write
  - Glob
  - Bash
compatibility:
  cursor: true
  claude-code: true
---

<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Sanofi Presentation Builder

Produces single-file HTML presentations. The **engine** (keyboard nav, progress bar, fullscreen mechanics) and **brand tokens** (Sanofi Violet, DM Sans) are non-negotiable. The **slide layouts** are completely free - be creative, varied, and impactful.

## Philosophy

> Two things are fixed. Everything else is yours to invent.

- **Fixed**: HTML slide engine (nav, progress, transitions) + Sanofi brand tokens (colors, fonts)
- **Fully free to invent**: every slide layout, every composition, every visual idea - grids, SVG diagrams, split compositions, asymmetric layouts, overlapping layers, animated counters, anything

The catalog in `references/slide-patterns.md` is **inspiration only**, not a constraint. The agent is expected to design original layouts. Reusing a pattern is fine when it's the best tool; inventing a new one is equally valid. The only hard rule is that all colors come from the Sanofi token set.

Each deck is a unique design. Never repeat the same layout twice in a row. Think about visual rhythm - alternate dense and spacious slides, dark and light, text-heavy and visual.

## Files in this skill

| File | Read when |
|---|---|
| `SKILL.md` (this file) | Always |
| `assets/presentation.template.md` | Always - contains the engine boilerplate (copy as starting point) |
| `references/slide-patterns.md` | Always - contains the full slide pattern catalog with HTML snippets |
| `references/design-system.md` | When needing color token or typography reference |

## Workflow

### Step 1 - Brief

Confirm (ask only if missing):
- Topic + audience
- Approximate slide count (6-12 is the sweet spot)
- Narrative spine (problem -> solution -> proof -> call to action, or other)
- Target file path

Then resolve the **presenter identity** used by the metadata signature (Step 4). Resolve `author` in this order, stop at the first hit:

1. A name explicitly given by the user in the request.
2. The `author` value in `<project-root>/.presentation-author.json` (created on first run - see below).
3. Otherwise ASK once: "Quel nom doit signer ces présentations (auteur) ?" - the company defaults to `Sanofi M&S` unless the user overrides it. Persist the answer so you never ask again in this project:

```json
{ "author": "<full name>", "company": "Sanofi M&S" }
```

Write that file to `<project-root>/.presentation-author.json`. The first time you create it, also add `.presentation-author.json` to the host project's `.gitignore` (create the `.gitignore` if absent) so nobody commits a personal name by mistake. Never hardcode a personal name in this skill - it is shared across all teams.

### Step 2 - Engine boilerplate

Read `assets/presentation.template.md`. Extract the HTML inside the code fence. That is the starting file - it contains the CSS base, the nav, and two starter slides.

### Step 3 - Design the deck

Optionally read `references/slide-patterns.md` for inspiration. Then design each slide. Rules:
- **Invent freely** - new layouts, CSS compositions, SVG graphics, asymmetric structures are all welcome
- Never use the same layout twice in a row
- Always open with a **Hero** and close with a **Hero (closing)** variant
- Use a **Section Divider** to break the deck into chapters when it exceeds 8 slides
- Prefer visual slides (diagrams, big numbers, process flows) over repeated text grids

Build each slide's HTML:
1. Design the layout directly - or adapt/combine patterns from the catalog as a starting point
2. All content must be real (no `[PLACEHOLDER]` in the output)
3. Number `data-slide="N"` sequentially from 1

### Step 4 - Brand verification

Before writing the file:
- [ ] All `#` color values are from `references/design-system.md` tokens - nothing else
- [ ] Font is always `DM Sans` or `DM Mono` - never Inter, Roboto, etc.
- [ ] Every `<h2>` has exactly one `<span>` for the violet word-highlight
- [ ] Every content slide opens with `.section-tag` above the h2
- [ ] `data-slide` is sequential 1..N
- [ ] Slide counter initial value matches total N
- [ ] No `[PLACEHOLDER]` remaining in the output
- [ ] **Metadata signature** present (HTML comment block + `<meta>` tags) - see the `## Metadata signature` section below. Uses the resolved `author` / `company` (Step 1), ISO-8601 dates. On edit, preserve `dcterms.created` and refresh `dcterms.modified` only.

### Step 5 - Punctuation final pass (mandatory)

**No em-dashes (`—`) and no en-dashes (`–`) in the final HTML.** Replace every occurrence with a regular hyphen (`-`) before delivery, including in:

- Slide body text, headings, captions, lists
- HTML entities: `&mdash;` and `&ndash;` must become `-`
- Strings inside CSS `content:` declarations

Recommended final-pass command:

```bash
sed -i '' -e 's/—/-/g' -e 's/–/-/g' -e 's/&mdash;/-/g' -e 's/&ndash;/-/g' path/to/file.html
```

Verify with `rg -n '—|–|&mdash;|&ndash;' path/to/file.html` - the output must be empty.

### Step 6 - Deliver

Write the full HTML to the requested file path. The HTML must be self-contained - all CSS inline, no external dependencies except the Google Fonts `<link>`.

> Reminder: after writing, run the punctuation final-pass from Step 5 against the output file before considering it delivered.

## Metadata signature

Every delivered deck must carry a metadata signature, placed at the top of `<head>`. Use the `author` and `company` resolved in Step 1 - never a hardcoded personal name. Dates are ISO-8601 (`YYYY-MM-DD`).

```html
<!--
  Title:    {{deck title}}
  Author:   {{author}}
  Company:  {{company}}
  Created:  {{YYYY-MM-DD}}
  Modified: {{YYYY-MM-DD}}
-->
<meta name="author" content="{{author}}" />
<meta name="dcterms.created" content="{{YYYY-MM-DD}}" />
<meta name="dcterms.modified" content="{{YYYY-MM-DD}}" />
```

Rules:
- On a **new** deck, set both `dcterms.created` and `dcterms.modified` to today.
- On an **edit** of an existing deck, keep `dcterms.created` untouched and refresh `dcterms.modified` to today.
- Replace every `{{...}}` placeholder - no literal braces remain in the output.

## Brand non-negotiables

| Rule | Value |
|---|---|
| Primary color (comms) | `#7A00E6` - Sanofi Violet |
| Hero background | `#14002D` + radial violet glow |
| Font | `DM Sans` (body/headings) + `DM Mono` (numbers/mono) |
| H2 pattern | One word in `<span style="color:var(--violet)">` |
| Section tag | 11px 700 uppercase violet, with 16×2px violet bar before |
| Card border accent | `border-top: 3px solid var(--violet)` |
| Progress gradient | violet → violet-light → blue |
| Blue | Secondary only - for digital/product-specific content inside a slide |

## Engine behavior: full-screen + auto-fit (built into `assets/presentation.template.md`)

The engine now guarantees every slide fills the screen. Two mechanisms, both already in the boilerplate - do not remove them:

1. **Full-screen stage.** `.slide` spans `100vw / 100vh` with side gutters computed from `--stage` (default `1300px`). Content is centered and uses the full horizontal space, no more narrow column. Change `--stage` to widen/narrow the content band globally.
2. **Auto-fit scaling (on by default).** On load and on navigation, the engine wraps each slide's flow content in a `.fitbox` and scales it from `1x` up to `1.5x` to fill leftover space. It enlarges only, never shrinks, and re-fits on `resize`.

Authoring rules so auto-fit stays clean:

- **Positioned elements are safe.** Logos, `.pageno`, `.foot`, `.watermark`, and anything `position: absolute`/`fixed` are kept OUTSIDE the `.fitbox`, so the scale transform never displaces them. Use absolute positioning for any element that must stay pinned to a slide corner.
- **Full-bleed image slides:** add `class="fullbleed"` to the slide. The engine skips scaling and removes the gutters (`padding: 0`), so an edge-to-edge background `<img style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">` covers the whole viewport. Put the readable text in an absolutely positioned overlay.
- **Do not hardcode slide indices** for full-bleed detection - the class drives it.
- Keep per-slide copy modest: auto-fit enlarges sparse slides but will not rescue an overflowing one (it never shrinks below 1x).

## What makes a deck "innovative and impactful"

- **Vary the rhythm**: hero -> split -> quote -> KPI -> process -> hub -> closing. Avoid 3+ similar layouts.
- **The Flow pattern is the most persuasive**: dark header with a concrete scenario, then labeled steps. Use it for any "here's what it looks like in practice" moment.
- **Big numbers land**: one slide with a single `$1.2B` at 80px says more than 4 bullet points.
- **Quotes create emotional beats**: one `.slide-quote` mid-deck resets attention.
- **Hub & Wheel visualizes ecosystems**: when content has a central concept + radiating elements.
- **Never more than 60 words of body copy per slide** - if you're writing a document, split it.
- **Mono font on all numbers** - it looks precise and intentional.
- **Inline SVG welcome**: simple diagrams, arcs, connections - stay monochrome violet.
