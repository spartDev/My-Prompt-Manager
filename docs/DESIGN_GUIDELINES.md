# Design Guidelines

This document provides comprehensive visual design guidelines for the Prompt Library Chrome Extension. All AI agents and developers working on this project **MUST** follow these guidelines to maintain visual consistency.

---

## Table of Contents

1. [Color System](#color-system)
2. [Typography](#typography)
3. [Spacing & Layout](#spacing--layout)
4. [Border Radius](#border-radius)
5. [Shadows & Effects](#shadows--effects)
6. [Component Patterns](#component-patterns)
7. [Animations & Transitions](#animations--transitions)
8. [Dark Mode Implementation](#dark-mode-implementation)
9. [Icons & Graphics](#icons--graphics)
10. [Accessibility](#accessibility)

---

## Color System

Every color in the popup, side panel and Analytics page comes from a **semantic token** defined once in `src/theme/tokens.css`. Each token is a Tailwind color for one CSS property, so its class carries its name: `--background-color-card` is `bg-card`, `--text-color-secondary` is `text-secondary`, `--border-color-input` is `border-input`.

- Light values live in `@theme static`; the `.dark` class that `useTheme` puts on `<html>` overrides every one of them. A token class therefore switches theme by itself: **never pair it with a `dark:` variant**.
- Components use token classes only, never raw palette classes (`gray-*`, `purple-*`, `indigo-*`, `red-*`, `white`...). Category colors are the one exception (see [Category Colors](#category-colors)).
- `src/theme/__tests__/tokens.test.ts` reads the compiled CSS and fails when a token loses its dark value, a class stops existing, or a contrast drops under its threshold.

Visual reference (both modes side by side): the palette canvas linked from beads epic `My-Prompt-Manager-el4`.

### Surfaces

| Class | Light | Dark | Use |
|---|---|---|---|
| `bg-app` | `#F4F1FA` | `#120E1B` | Page and header (seamless, no white band) |
| `bg-card` | `#FFFFFF` | `#231C34` | Cards, form sections, and the search field and pills that sit on `bg-app` |
| `bg-subtle` | `#F4F1FA` | `#2B2340` | Chips and fields **on a card**. Never directly on `bg-app`: same value in light |
| `bg-raised` | `#F8F6FC` | `#1B1528` | Light fills: empty states, nested panels |
| `bg-muted` | `#F1EDF8` | `#2E2645` | Hover of neutral elements (`hover:bg-muted`) |
| `bg-inverse` | `#1D1530` | `#4A3D6B` | Notification pill, tooltips (the chart tooltip included), the Analytics hero |
| `bg-callout` | `#FFF8E6` | `#2B210E` | The Tidy up callout of Analytics, with `border-warning` and `text-callout` |
| `bg-backdrop` | `#2A2140` at 45% | `#07050C` at 70% | Behind an open dialog or drawer, with `backdrop-blur-sm` |
| `bg-highlight` | `#FEF3C7` | `#33270F` | Search match in a Prompt title or preview (`<mark className="bg-highlight text-inherit">`) |

Surfaces are **opaque**. `bg-backdrop` is the only translucent one: no translucent white + `backdrop-blur-sm` glass on headers or sections.

### Borders

| Class | Light | Dark | Use |
|---|---|---|---|
| `border-default` | `#ECE6F5` | `#352C4C` | Cards, unselected pills. Also the color of a bare `border` |
| `border-divider` | `#F0EBF8` | `#2F2744` | Dividers inside a card |
| `border-strong` | `#DCD4EA` | `#41375A` | Secondary button; the line under the header, shown only once the list scrolls |
| `border-input` | `#8F87A5` | `#766C8E` | Field outlines, off track of a switch, unpinned star (3:1 on every surface) |
| `border-focus` | accent | accent | A focused field (`focus-input` applies it) |
| `border-error` | danger | danger | A field in error |

### Text

| Class | Light | Dark | Use |
|---|---|---|---|
| `text-primary` | `#1D1530` | `#F1EDF9` | Titles, main text |
| `text-secondary` | `#5C5370` | `#BCB3D0` | Labels, body text |
| `text-tertiary` | `#6F6787` | `#A39ABB` | Previews, metadata, placeholders (`placeholder:text-tertiary`) |
| `text-faint` | `#B5ADC8` | `#7D7495` | Disabled and decorative only (2.15:1 in light: never for information) |
| `text-on-inverse` | `#C9BFE6` | `#C9BFE6` | Message on `bg-inverse` |
| `text-on-inverse-muted` | `#A99CC9` | `#C9BFE6` | Day labels under the Analytics bars, on `bg-inverse` (the mockup's dark `#A99CC9` is 3.8:1, so dark takes `on-inverse`) |
| `text-callout` | `#78350F` | `#FDE68A` | Text of the Tidy up callout, on `bg-callout` |
| `text-on-accent` | `#FFFFFF` | `#FFFFFF` | Text on `bg-accent` and `bg-danger` |

### Accent (violet)

| Class | Light | Dark | Use |
|---|---|---|---|
| `bg-accent` | `#6D28D9` | `#844BF2` | Primary buttons; settings that are on (switch, checkbox, radio) |
| `bg-accent-hover` | `#5B21B6` | `#7A40E3` | Hover of `bg-accent`: hover darkens in both modes |
| `bg-accent-selected` | `#EDE5FF` | `#38296A` | A chosen item among several (Library filter pill, active Section, chosen mode) |
| `bg-accent-subtle` | `#F1EBFD` | `#2F2350` | Info boxes, icon squares |
| `text-accent` | `#5B21B6` | `#C4B5FD` | Links, accent icons |
| `text-accent-strong` | `#4C1D95` | `#DDD3FE` | Text of a chosen item |
| `border-accent` | `#C4B5FD` | `#6D4FC4` | Accent borders |
| `outline-accent`, `ring-accent` | accent | accent | Focus rings |
| `--scrollbar-color-thumb` (variable, no class) | `#8B5CF6` | `#8B5CF6` | Scrollbar thumb, read by `popup.css` (at least 3:1 on every surface) |

The brand gradient (`bg-brand`: `#6D28D9` to `#4C1D95`, the same in both modes) is reserved for the logo. Every other surface is flat.

The charts of the full-page Analytics view take token classes like every other component (`src/components/analytics/charts/PillBarChart.tsx`): every bar takes the accent (`bg-accent`), the hovered band `bg-muted` and the axis labels `text-tertiary`, so they follow the mode on their own. No chart has a palette of its own. A Category keeps its own color, as a dot before its name in the Categories card; one stored without a color, or no longer stored, takes the default Category color, as in the Library.

The Prompt selector shown on Platforms is plain CSS, not Tailwind, inside its own shadow root (`src/content/selector/selectorStyles.ts`, ADR-002): it declares the same tokens, under the same names, as CSS variables on `:host` (light) and `:host([data-theme="dark"])` (dark), and reads them through `var()`. The Prompts button, which sits in the Platform's own page, does the same on `.prompt-library-pill` and `.prompt-library-pill.dark-theme` (`src/content/utils/styles.ts`). Both follow the extension's theme, not the Platform's. `selectorStyles.test.ts` and `styles.test.ts` fail when a value drifts from `tokens.css` or a color is written outside those declarations. A Category shows there as a dot of its own color, before its name.

### States

| Class | Light | Dark | Use |
|---|---|---|---|
| `bg-success` | `#10B981` | `#10B981` | Dots and badges only (2.54:1 on white: never text) |
| `bg-success-subtle` / `text-success` | `#E7F8EF` / `#065F46` | `#0F2D22` / `#6EE7B7` | Success message |
| `bg-warning` | `#D97706` | `#FBBF24` | Graphics only: bars and marks (3:1 on `bg-card`, never text) |
| `bg-warning-subtle` / `border-warning` / `text-warning` | `#FEF3C7` / `#F5DFA6` / `#92400E` | `#33270F` / `#5A4515` / `#FCD34D` | Warning banner |
| `bg-danger` / `bg-danger-hover` | `#DC2626` / `#B91C1C` | `#DC2626` / `#B91C1C` | Destructive button |
| `bg-danger-subtle` / `border-danger` / `text-danger` | `#FDECEC` / `#F6CFCF` / `#991B1B` | `#3A1518` / `#5E2228` / `#FCA5A5` | Error banner and message |
| `text-pin` | `#D97706` | `#FBBF24` | Filled star of a Pinned Prompt |
| `text-on-inverse-strong` / `text-on-inverse-mark` | `#FFFFFF` / `#1D1530` | same | Notification message / glyph on the Notification's round |
| `bg-inverse-mark` / `bg-inverse-alert` | `#A78BFA` / `#FCA5A5` | same | Notification round: a confirmation's check / a failure's ! |
| `bg-inverse-action` | `rgba(255, 255, 255, 0.14)` | same | Action button of a Notification |
| `bg-inverse-bar` / `bg-inverse-bar-hover` | `rgba(255, 255, 255, 0.22)` / `#FFFFFF` | same / `#231C34` | Analytics weekday bar at rest / hovered; the busiest takes `bg-inverse-mark` |

Information uses the accent family (`bg-accent-subtle`, `border-accent`, `text-accent`): there is no blue info color.

### Rules of use

- **Chosen vs on.** One item chosen among several: `bg-accent-selected border-accent text-accent-strong font-semibold`. A setting that is on: `bg-accent`. The one exception is a [Segmented Control](#segmented-control), whose chosen option sits on a `bg-card` puck with a `border-input` outline.
- **Hover.** `hover:bg-accent-hover` on `bg-accent`, `hover:bg-danger-hover` on `bg-danger`, `hover:bg-muted` on neutral elements.
- **Fields.** On a card: `bg-subtle border-input`; on `bg-app`: `bg-card border-input`; add `focus-input`; in error: `border-error` and a `text-danger` message.

### Category Colors

Category colors are user data, not tokens: the chip (soft badge) rule and its contrast safety net live in `src/theme/categoryChip.ts`, the preset palette in `src/constants/colors.ts`, documented in [CATEGORY_COLOR_IMPLEMENTATION.md](./CATEGORY_COLOR_IMPLEMENTATION.md).

### Adding or changing a token

Declare it in both blocks of `src/theme/tokens.css` (`@theme static` and `.dark`), with the property namespace that gives the class you want (`--background-color-*`, `--text-color-*`, `--border-color-*`, `--ring-color-*`, `--outline-color-*`). A token that only reuses another one may be a `var()` reference in `@theme` alone. Add it to the class list of `tokens.test.ts`, and to a contrast pair when text or a control sits on it.

---

## Typography

### Font Family

```css
font-family: 'Schibsted Grotesk', ui-sans-serif, system-ui, sans-serif;
```

The popup, side panel and Analytics page set in **Schibsted Grotesk** (Atelier 1C), set once on `body` in `src/popup.css`. Buttons and fields inherit it through Tailwind's preflight, so no component sets a font class.

- **Self-hosted.** One variable woff2 (`wght` 400 to 900, Latin subset) lives in `public/fonts/` with its SIL OFL licence `OFL.txt`, and Vite copies both to `dist/fonts/`. `public/fonts/README.md` gives its source commit in google/fonts and the subset command. The `@font-face` uses `font-display: swap`. Never load a font from Google Fonts or any other host: the extension makes no network request when it opens.
- **Fallback.** Characters outside the Latin subset (Cyrillic, Greek, CJK, emoji) and the instant before the font loads use the system font of the stack.
- **Content scripts load the same file another way.** The Prompt selector and the Prompts button that `src/content/` draws on Platforms are set in Schibsted Grotesk too. A Platform's Content Security Policy may refuse an extension font URL, and `@font-face` cannot be declared in a shadow root, so `src/content/selector/font.ts` reads the woff2 from the package and registers it on the document with the FontFace API, under the family name `MPM Schibsted Grotesk`, which no Platform font can collide with. When that fails, the stack falls back to the system font.
- `tests/e2e/theme/typography.spec.ts` checks the computed stack and `document.fonts` on all three surfaces, and that none requests a remote host.

### Font Sizes

```css
text-xs    /* 12px / 0.75rem  - Helper text, character counts */
text-sm    /* 14px / 0.875rem - Body text, form labels, buttons */
text-base  /* 16px / 1rem     - Default body text */
text-lg    /* 18px / 1.125rem - Emphasized text */
text-xl    /* 20px / 1.25rem  - The Library header title */
text-2xl   /* 24px / 1.5rem   - Page titles (rare); a Section header title is text-[27px] */
```

### Font Weights

```css
font-normal    /* 400 - Body text */
font-medium    /* 500 - Secondary headings, emphasized text */
font-semibold  /* 600 - Primary headings, button text */
font-bold      /* 700 - Major section titles */
font-extrabold /* 800 - Section title, Category sheet title */
```

### Line Heights

```css
leading-tight  /* 1.25 - Headings */
leading-normal /* 1.5 - Body text (default) */
leading-relaxed /* 1.625 - Comfortable reading */
```

### Typography Patterns

**Section title and Eyebrow (Section header):**
```tsx
<p className="text-[12.5px] font-semibold text-tertiary">3 categories</p>
<h1 className="text-[27px] font-extrabold leading-[1.05] tracking-[-0.035em] text-primary">
  Categories
</h1>
```

**Section Header:**
```tsx
<h2 className="text-sm font-semibold text-secondary mb-3">
  Category
</h2>
```

**Body Text:**
```tsx
<p className="text-sm text-secondary">
  Description text
</p>
```

**Helper Text:**
```tsx
<p className="text-xs text-tertiary font-medium">
  100/10000 characters
</p>
```

**Prompt Card Title:**
```tsx
<h3 className="font-semibold text-primary text-sm leading-tight truncate">
  Prompt Title
</h3>
```

---

## Spacing & Layout

### Padding Scale

```css
p-1   /* 4px  - Tight spacing */
p-2   /* 8px  - Icon buttons */
p-3   /* 12px - Compact components */
p-4   /* 16px - Standard padding */
p-5   /* 20px - Form sections */
p-6   /* 24px - Page containers */
```

### Common Spacing Patterns

**Header/Footer Containers:**
```tsx
<div className="p-6">
  {/* 24px padding for main containers */}
</div>
```

**Form Sections:**
```tsx
<div className="p-5">
  {/* 20px padding for form sections */}
</div>
```

**Card Padding:**
```tsx
<article className="p-5">
  {/* 20px padding for cards */}
</article>
```

### Gaps & Spacing

```css
space-x-1  /* 4px  - Tight horizontal spacing */
space-x-2  /* 8px  - Button groups */
space-x-3  /* 12px - Header elements */

gap-2      /* 8px  - Flexbox/Grid gap */
gap-3      /* 12px - Form field gaps */
```

### Margin Utilities

```css
mb-1  /* 4px  - Tight bottom margin */
mb-2  /* 8px  - Between related elements */
mb-3  /* 12px - Between form elements */
mt-1, mt-2, mt-3  /* Same as mb */
```

### Layout Patterns

**Full Height Container:**
```tsx
<div className="h-full flex flex-col">
  <header className="shrink-0">Header</header>
  <main className="flex-1 overflow-auto">Content</main>
  <footer className="shrink-0">Footer</footer>
</div>
```

**Flex Row with Space Between:**
```tsx
<div className="flex items-center justify-between">
  <div>Left content</div>
  <div>Right content</div>
</div>
```

**Flex Column Stack:**
```tsx
<div className="flex flex-col space-y-3">
  <div>Item 1</div>
  <div>Item 2</div>
</div>
```

---

## Border Radius

### Standard Radii

```css
rounded-md   /* 6px / 0.375rem  - Small elements */
rounded-lg   /* 8px / 0.5rem    - Buttons, icons */
rounded-xl   /* 12px / 0.75rem  - Cards, inputs, modals */
rounded-full /* 9999px          - Pills, badges, toggle knobs */
rounded-group /* 20px (--radius-group) - the card of a Settings group, the Analytics cards */
rounded-hero  /* 24px (--radius-hero) - the Analytics hero, with shadow-hero */
```

### Usage Patterns

**Primary Buttons:**
```tsx
<button className="rounded-xl">
  {/* 12px radius for all main buttons */}
</button>
```

**Input Fields:**
```tsx
<input className="rounded-xl" />
{/* 12px radius for all inputs and textareas */}
```

**Cards & Containers:**
```tsx
<div className="rounded-xl">
  {/* 12px radius for cards and panels */}
</div>
```

**Pills & Badges:**
```tsx
<span className="rounded-full">
  {/* Full rounding for category badges */}
</span>
```

**Icon Buttons:**
```tsx
<button className="rounded-lg">
  {/* 8px radius for icon-only buttons */}
</button>
```

---

## Shadows & Effects

### Shadow Scale

Tailwind's shapes and alphas, tinted violet in light (`rgba(45, 25, 90, α)`) and black at α × 1.6 in dark, through `--shadow-tint-5`, `-10` and `-25` in `src/theme/tokens.css`:

```css
shadow-xs   /* 0 1px 2px 0, tint 5           */
shadow-sm   /* 0 1px 3px 0, tint 10 - cards  */
shadow-md   /* 0 4px 6px -1px, tint 10       */
shadow-lg   /* 0 10px 15px -3px, tint 10     */
shadow-xl   /* 0 20px 25px -5px, tint 10     */
shadow-2xl  /* 0 25px 50px -12px, tint 25 - dialogs */
shadow-puck /* 0 2px 6px -2px, tint 25 - the puck of a segmented control */
shadow-knob /* 0 2px 4px, tint 25 - the knob of a switch */
```

### Custom Shadows

The Prompt selector shown on Platforms is styled outside Tailwind (`src/content/selector/selectorStyles.ts`); its shadows are the tokens `--shadow-selector` (the popover) and `--shadow-toast` (the confirmation of an Insertion), declared in `tokens.css` in light and dark.

**Icon Shadow (Legacy):**
```css
box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
```

**Prompt Selector Shadow:**
```css
box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1), 0 8px 16px rgba(0, 0, 0, 0.08);
```

**Focus Shadow:**
```css
box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);  /* Indigo */
box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.4); /* Blue */
```

### Backdrop Effects

```tsx
<div className="bg-backdrop backdrop-blur-sm" />  /* Behind an open dialog or drawer only */
```

### Usage Patterns

**Primary Button:**
```tsx
<button className="shadow-lg hover:shadow-xl transition-all duration-200">
  Save Prompt
</button>
```

**Card Hover:**
```tsx
<article className="hover:shadow-md transition-shadow duration-200">
  {/* Card content */}
</article>
```

**Modal/Dialog:**
```tsx
<div className="bg-card shadow-2xl">
  {/* Modal content: the panel itself is opaque */}
</div>
```

---

## Component Patterns

### Buttons

#### Primary Button

Flat accent: the brand gradient belongs to the logo only.

```tsx
<button className="
  px-6 py-3
  text-sm font-semibold text-on-accent
  bg-accent hover:bg-accent-hover
  rounded-xl
  transition-all duration-200
  shadow-lg hover:shadow-xl
  disabled:opacity-50
  focus-primary
">
  Save Prompt
</button>
```

#### Secondary Button

```tsx
<button className="
  px-6 py-3
  text-sm font-semibold text-secondary
  bg-card hover:bg-muted
  border border-strong
  rounded-xl
  transition-all duration-200
  focus-secondary
">
  Cancel
</button>
```

#### Danger Button

```tsx
<button className="
  px-3 py-1.5
  text-xs font-semibold text-on-accent
  bg-danger hover:bg-danger-hover
  rounded-lg
  shadow-sm
  transition-colors
  focus-danger
">
  Delete
</button>
```

#### Small Action Button (Copy)

```tsx
<button className="
  inline-flex items-center
  px-2 py-1
  bg-accent hover:bg-accent-hover
  text-on-accent
  rounded-md
  transition-colors duration-200
  text-xs font-medium
  focus-primary
">
  <svg className="h-3 w-3 mr-1">{/* Icon */}</svg>
  Copy
</button>
```

#### Icon Button

```tsx
<button className="
  p-2
  text-tertiary hover:text-accent
  rounded-lg
  hover:bg-muted
  transition-colors
  focus-interactive
">
  <svg className="h-5 w-5">{/* Icon */}</svg>
</button>
```

An icon that is the only content of a button takes `text-tertiary` or stronger: `text-faint` is under 3:1.

#### Focus Classes

Defined in `tailwind.config.js` (see [Focus States](#focus-states)):

```css
.focus-primary     { @apply focus:outline-2 focus:outline-offset-2 focus:outline-accent; }
.focus-secondary   { @apply focus:outline-2 focus:outline-offset-1 focus:outline-accent; }
.focus-danger      { @apply focus:outline-2 focus:outline-offset-2 focus:outline-danger; }
.focus-input       { @apply focus:outline-none focus:ring-2 focus:ring-accent focus:border-focus; }
.focus-interactive { @apply focus:outline-2 focus:outline-offset-1 focus:outline-accent; }
```

#### Loading State

The spinner takes the text color of its button, so it works on any button:

```tsx
<button disabled className="disabled:opacity-50">
  <div className="flex items-center justify-center space-x-2">
    <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
    <span>Saving...</span>
  </div>
</button>
```

### Input Fields

A field on a card takes `bg-subtle`; a field placed directly on `bg-app` (the Library search) takes `bg-card`. Both take `border-input` (3:1 on every surface), `focus-input` and `placeholder:text-tertiary`.

#### Text Input

```tsx
<input
  type="text"
  className="
    w-full px-4 py-3
    border border-input
    rounded-xl
    focus-input
    bg-subtle
    transition-all duration-200
    text-primary
    placeholder:text-tertiary
  "
  placeholder="Enter text..."
/>
```

#### Text Input with Error

```tsx
<input
  className="
    w-full px-4 py-3
    border rounded-xl focus-input
    bg-subtle
    transition-all duration-200
    text-primary
    border-error
  "
/>
{errors.field && (
  <p className="mt-2 text-sm text-danger font-medium">
    {errors.field}
  </p>
)}
```

#### Textarea

```tsx
<textarea
  rows={8}
  className="
    w-full px-4 py-3
    border border-input
    rounded-xl
    focus-input
    resize-none
    bg-subtle
    transition-all duration-200
    text-primary
    placeholder:text-tertiary
  "
  placeholder="Enter your prompt content..."
/>
```

#### Select Dropdown

```tsx
<div className="relative">
  <select className="
    w-full px-4 py-3 pr-10
    border border-input
    rounded-xl
    focus-input
    bg-subtle
    transition-all duration-200
    font-medium
    appearance-none
    cursor-pointer
    text-primary
  ">
    <option>Option 1</option>
  </select>
  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
    <svg className="w-4 h-4 text-tertiary">
      {/* Chevron down icon */}
    </svg>
  </div>
</div>
```

#### Search Input

The Library search sits on `bg-app`, so it takes `bg-card`, like the cards:

```tsx
<div className="relative">
  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
    <svg className="h-5 w-5 text-tertiary">
      {/* Search icon */}
    </svg>
  </div>
  <input
    type="text"
    className="
      w-full pl-12 pr-12 py-3
      bg-card
      border border-input
      rounded-xl
      focus-input
      text-sm
      text-primary
      placeholder:text-tertiary
      shadow-sm
      transition-all duration-200
    "
    placeholder="Search prompts"
  />
  {/* Clear button on right if needed */}
</div>
```

### Cards

Cards are opaque `bg-card` with a `border-default` border, floating on `bg-app`. Dividers inside a card take `border-divider` (`divide-y divide-divider`).

#### Prompt Card

```tsx
<article className="
  bg-card
  border border-default
  rounded-2xl p-4
  shadow-sm hover:shadow-md
  transition-shadow duration-200
  relative group
">
  {/* Card content */}
</article>
```

#### Form Card

A form (Add and Edit Prompt) is one card on `bg-app`: its sections are split by `border-divider`, its fields take `bg-subtle`. The button bar below it stays on `bg-app`, with a line only while fields remain below (`scroll-edge-bottom`):

```tsx
<div className="flex-1 overflow-auto p-4" data-scroll-container>
  <form className="bg-card border border-default rounded-2xl shadow-sm overflow-hidden divide-y divide-divider">
    <div className="p-5">{/* Label and field */}</div>
    <div className="p-5">{/* Label and field */}</div>
  </form>
</div>
<div className="shrink-0 p-6 bg-app border-t border-transparent scroll-edge-bottom">
  {/* Cancel and Save */}
</div>
```

#### List Card

A list of items (the Categories) is one card on `bg-app`: its title and rows are split by `border-divider`, and a row hovers to `bg-muted` while it can be acted on. A row being edited in place stays on the card, with `bg-subtle` fields:

```tsx
<section aria-labelledby={titleId} className="bg-card border border-default rounded-2xl shadow-sm overflow-hidden divide-y divide-divider">
  <h3 id={titleId} className="p-5 text-sm font-bold text-primary">Your Categories</h3>
  {items.map(item => (
    <div key={item.id} className="p-5 transition-colors duration-200 hover:bg-muted">{/* Item */}</div>
  ))}
</section>
```

A color swatch is user data: it keeps its own color. In a picker, the chosen swatch takes an accent ring with a gap in the card's color (`ring-2 ring-accent ring-offset-2 ring-offset-(--background-color-card)`).

#### Settings Group

Settings is a column of Settings groups (`src/components/settings/SettingsGroup.tsx`), 18px apart inside a 16px margin. A group is a label over one card; the card holds one row per setting (`SettingsRow.tsx`), with a `border-divider` line between rows and none above the first:

```tsx
<section aria-labelledby={labelId} className="flex flex-col gap-2">
  <h2 id={labelId} className="pl-1 text-[12.5px] font-bold text-secondary">Appearance</h2>
  <div className="bg-card border border-default rounded-group overflow-hidden divide-y divide-(--border-color-divider)">
    {/* A row: label at the left (text-sm font-semibold text-primary, an optional
        text-[11.5px] text-tertiary detail under it), control at the right */}
    <div className="py-2.5 pr-2.5 pl-3.5">…</div>
  </div>
</section>
```

A row's action is a small secondary pill (`ROW_BUTTON_CLASSES` in `src/components/settings/rowStyles.ts`, 34px high, as tall as a segmented control). A destructive action keeps its confirmation inside its row.

#### Analytics cards

The Analytics tab and the full-page Analytics view (`src/analytics.html`) are one design (Atelier 1C). The mockups draw the tab only; the full-page view extends it to a page and adds no pattern of its own. Both are built from the same components in `src/components/analytics/`:

| Piece | Classes | Component |
|---|---|---|
| Hero | `bg-inverse rounded-hero shadow-hero`, the total in `text-on-inverse-strong`, weekday pill bars | `StatsHero` (`wide` in the full-page view: from `md` up the total at the left, 64px, and taller bars at the right) |
| Stat card | `p-3.5 rounded-group bg-card border border-default animate-card-rise` | `StatCard` |
| Ranked rows | a `w-7 h-7 rounded-full` rank round (`bg-accent-selected` for the first, `bg-subtle` after), the label over a `h-1.5 rounded-full bg-accent-subtle` track with a `bg-accent animate-rank-fill` bar, the count in `text-secondary` | `RankRowContent` in `RankedRows.tsx`, used by `MostUsedCard` and by the Platforms and Categories cards (`RankedRows`) |
| Tidy up | `bg-callout border-[1.5px] border-warning rounded-group`, Review as a `bg-card text-warning rounded-full` pill | `TidyUpCard` |
| Chart card | the stat card's surface, a `text-sm font-extrabold` title, a `text-xs text-secondary` line that says what the chart shows, then the chart | `ChartCard` in `AnalyticsDashboard.tsx` |
| Chart tooltip | `px-3 py-1.5 rounded-full bg-inverse text-on-inverse-strong text-[11.5px] font-bold`, the label in `text-on-inverse` | `ChartTooltip` |

A row is a button only where pressing it does something: Most used rows open their Prompt in the tab, and are plain rows (`readOnly`) in the full-page view, which has no editor. The count a bar draws is always in the text too: a row carries an `sr-only` "4 uses", and each chart is a `role="img"` whose `aria-label` gives its counts or its total and busiest entry.

The full-page view keeps its content to a 1100px column (`lg:px-[max(2rem,calc(50vw-550px))]` on the header and on the scroll container). Under `lg` it is one column in the tab's order; from `lg` up Most used sits at the left of Top platform, Top category and Tidy up, and from `md` up the last four cards pair up. Cards are 10px apart (`mt-2.5`, `gap-x-2.5`).

### Badges & Pills

#### Category Badge

Category colors are user data, not tokens: use the component, which derives the chip colors of both modes from the Category's color (`getSoftBadgeColors` in `src/theme/categoryChip.ts`):

```tsx
<CategoryBadge category={category} variant="soft" />
```

#### Status Badge

```tsx
<span className="
  inline-flex items-center
  px-2 py-1
  rounded-full
  text-xs font-medium
  bg-success-subtle
  text-success
">
  Active
</span>
```

#### Chosen Pill

One item chosen among several (Library filter pill, active Section):

```tsx
<button className={`
  px-3 py-1.5 rounded-full border text-sm
  ${chosen
    ? 'bg-accent-selected border-accent text-accent-strong font-semibold'
    : 'bg-card border-default text-secondary hover:bg-muted'
  }
`}>
  Pinned
</button>
```

#### Segmented Control

A choice among two or three options (the theme, popup or side panel): `src/components/settings/SegmentedControl.tsx`. A 186×34px `bg-subtle` track holds the options; a `bg-card` puck slides under the chosen one with the spring (`duration-(--duration-spring) ease-spring`). The puck carries a 1.5px `border-input` outline: card on subtle is about 1.1:1 in both modes, so the outline is what gives the chosen option 3:1 (WCAG 1.4.11). Labels are `text-[12.5px] font-bold`, `text-primary` when chosen, `text-tertiary` otherwise. It is a radio group, with the keyboard of `useRadioGroup`:

```tsx
<SegmentedControl options={THEME_OPTIONS} value={theme} onChange={setTheme} labelledBy={themeLabelId} />
```

### Modals & Dialogs

#### Modal Container

```tsx
<div className="
  fixed inset-0 z-50
  flex items-center justify-center p-3
">
  {/* Backdrop: the only translucent surface */}
  <div
    className="
      absolute inset-0
      bg-backdrop backdrop-blur-sm
      transition-opacity
    "
    onClick={onClose}
  />

  {/* Modal Panel: opaque */}
  <div className="
    relative
    bg-card
    rounded-xl p-3
    shadow-2xl
    transform transition-all
    max-w-xs w-full mx-2
    border border-default
  ">
    {/* Modal content */}
  </div>
</div>
```

#### Confirm Dialog

```tsx
<div className="flex items-start">
  {/* Icon */}
  <div className="
    shrink-0 flex items-center justify-center
    h-8 w-8
    rounded-full
    bg-danger-subtle
  ">
    <svg className="w-6 h-6 text-danger">{/* Icon */}</svg>
  </div>

  {/* Content */}
  <div className="ml-3 flex-1">
    <h3 className="text-sm leading-5 font-bold text-primary">
      Delete Prompt
    </h3>
    <p className="mt-1 text-xs text-secondary leading-tight">
      Are you sure? This action cannot be undone.
    </p>
  </div>
</div>

{/* Actions */}
<div className="mt-3 flex flex-row-reverse gap-2">
  <button className="bg-danger hover:bg-danger-hover text-on-accent focus-danger ...">Delete</button>
  <button className="border border-strong bg-card hover:bg-muted text-secondary focus-secondary ...">Cancel</button>
</div>
```

### Toggle Switch

`src/components/settings/Switch.tsx`: a 42×24px track, `bg-accent` when on and filled with the field-outline token when off (`border-input`, 3:1 on every surface; Atelier 1C's paler `#DCD4EA` is 1.4:1, so it is not used). The 18px knob is white in both modes (`text-on-accent`), with `shadow-knob`, and slides 18px with the spring. A switch is named by its row's label through `aria-labelledby`:

```tsx
<Switch checked={enabled} onChange={setEnabled} labelledBy={labelId} />
```

### Notification

A Notification (Atelier 1C) is a 40px pill at the top center of the popup or side panel, on
`bg-inverse` in both modes (`#1D1530` in light, `#4A3D6B` in dark). Only one shows at a time: a new
one replaces it. A confirmation (success, info) has a violet check round (`bg-inverse-mark`) and
leaves after 2.7s; a failure (error, warning) has a red ! round (`bg-inverse-alert`), is a
`role="alert"`, and leaves after 6s. There is no close button and no progress bar: Escape closes it.
Its time stops while the pointer or the focus is on it, so its action (the 6s Undo of a deleted
Category) can be reached and read; it runs out the rest once neither is.
Settings has one switch for all of them.

The bold message stays whole; the optional sub (the object's name, or the reason) is cut with an
ellipsis when the pill runs out of room. Write the message short (`Prompt saved`, `Couldn't delete
Prompt`) and put the name in the sub.

```tsx
<div role="status" className="
  animate-toast-in fixed top-3 left-1/2 [transform:translateX(-50%)] z-50
  flex items-center gap-[9px] h-10 max-w-[calc(100%-32px)] pl-3.5 pr-1.5
  rounded-full bg-inverse text-on-inverse-strong shadow-toast
">
  <span className="animate-toast-mark grid place-items-center size-5 rounded-full bg-inverse-mark text-on-inverse-mark">
    {/* check, or ! for a failure */}
  </span>
  {/* Only the text gives way; inside it, the message only once it alone is too long */}
  <span className="flex min-w-0 items-center gap-[9px]">
    <span className="shrink-0 max-w-full truncate text-[13px] font-semibold">Prompt saved</span>
    <span className="min-w-0 truncate text-[12.5px] text-on-inverse">Weekly status update</span>
  </span>
  {/* An action, as a pill button, or an 8px spacer */}
  <button className="h-7 px-[11px] rounded-full bg-inverse-action text-[12.5px] font-semibold">Undo</button>
</div>
```

### Dropdown Menu

```tsx
<div className="relative">
  <button onClick={toggleMenu} className="p-1 rounded-md focus-interactive">
    <svg className="h-4 w-4">{/* Menu icon */}</svg>
  </button>

  {showMenu && (
    <>
      {/* Backdrop */}
      <button
        className="fixed inset-0 z-10 bg-transparent"
        onClick={closeMenu}
      />

      {/* Menu */}
      <div className="
        absolute right-0 top-full mt-1
        w-28
        bg-card
        rounded-xl
        shadow-xl
        border border-default
        overflow-hidden
        z-1001
      ">
        <button className="
          block w-full text-left
          px-4 py-3
          text-sm
          text-secondary
          hover:bg-muted
          hover:text-primary
          font-medium
          transition-colors
          focus-secondary
        ">
          Edit
        </button>
        <button className="
          block w-full text-left
          px-4 py-3
          text-sm
          text-danger
          hover:bg-danger-subtle
          font-medium
          transition-colors
          focus-danger
        ">
          Delete
        </button>
      </div>
    </>
  )}
</div>
```

### Section Headers

Every Section but the Library has the same Section header, `SectionHeader` (`src/components/SectionHeader.tsx`): an Eyebrow over the Section's title, the Section's actions on the right, no icon square. Settings, Categories, the Analytics tab and the full-page Analytics view use it. The Library keeps `ViewHeader`, with its logo, until its own redesign.

The Eyebrow is the Section's context: the version in Settings, the number of Categories in Categories (announced with `eyebrowLive`), the period counted in Analytics.

The header is seamless: it shares `bg-app` with the page, and its bottom line (`border-strong`) shows only once the content scrolls under it. The tab bar is the exception: it sits on `bg-card` (white in light) with a permanent `border-t border-strong`, which stays once the scroll reaches the end. The header line (`scroll-edge-top`) and the button bar line (`scroll-edge-bottom`) are drawn by CSS in `src/popup.css`, driven by the scroll of the view's `[data-scroll-container]` inside App's `section-scroll-scope`: no scroll state in React. `SectionHeader` and `ViewHeader` already carry `scroll-edge-top`.

```tsx
<header className="shrink-0 bg-app flex items-start justify-between gap-3 px-5 pt-4 pb-2 border-b border-transparent scroll-edge-top">
  <div>
    <p className="text-[12.5px] font-semibold text-tertiary">Last 30 days</p>
    <h1 className="text-[27px] font-extrabold leading-[1.05] tracking-[-0.035em] text-primary">Analytics</h1>
  </div>
  {/* Actions: the side panel's close button, a primary pill such as Full Dashboard */}
</header>
```

Write it as `<SectionHeader title="Analytics" eyebrow="Last 30 days">{actions}</SectionHeader>`, never by hand. A primary action in it is a pill: `h-9 px-4 rounded-full bg-accent text-on-accent font-bold`.

---

## Animations & Transitions

### Standard Transitions

```css
/* Default transition for most elements */
transition-all duration-200

/* Color-only transitions (more performant) */
transition-colors duration-200

/* Shadow transitions */
transition-shadow duration-200

/* Transform transitions */
transition-transform duration-200
```

### Motion tokens (Atelier 1C)

The curves, keyframes and animations of the Atelier 1C design are tokens in `src/theme/tokens.css`,
and their durations are mirrored in `src/theme/motion.ts` (`MOTION`, `EASE`) for the timers of the
components; `src/theme/__tests__/motion.test.ts` keeps the two in step. A component never writes a
duration or a curve: it uses a class, and a timer reads `MOTION`.

| Token | Value | Use |
|-------|-------|-----|
| `--ease-sheet` (`ease-sheet`) | `cubic-bezier(0.25, 0.8, 0.3, 1)` | a panel entering: a gentle ease-out, not front-loaded, so it glides in rather than lands |
| `--ease-sheet-out` (`ease-sheet-out`) | `cubic-bezier(0.5, 0, 0.75, 0)` | a panel leaving: an ease-in, it gathers speed as it goes |
| `--ease-spring` (`ease-spring`) | `cubic-bezier(0.34, 1.56, 0.64, 1)` | pops, bounces, presses |
| `animate-sheet-in` | `sheet-in` 400ms, ease-sheet | a full-screen panel rising from the bottom (the editor) |
| `animate-sheet-out` | `sheet-out` 340ms, ease-sheet-out | the panel leaving; it unmounts after (`useAnimatedPresence`) |
| `animate-recede-in` / `animate-recede-out` | `recede-in` 400ms ease-sheet / `recede-out` 340ms ease-sheet-out | what lies beneath the panel (the Section and the tab bar) shrinks to `scale(0.96)` from its top as the panel rises, and comes back as it leaves |
| `animate-scrim-in` / `animate-scrim-out` | `scrim-in` 400ms ease-sheet / `scrim-out` 340ms ease-sheet-out | a `bg-backdrop backdrop-blur-sm` scrim between the two, from 0 to 0.6 opacity and back |
| `animate-pop` | `pop` 450ms, ease-spring | a new chip (a Variable) |
| `animate-pop-check` | `pop` 400ms, ease-spring | a check mark appearing, the inline "New category" row |
| `animate-category-sheet-in` / `animate-category-sheet-out` (`MOTION.categorySheetIn` / `categorySheetOut`) | `sheet-in` 500ms / `sheet-out` 280ms, both ease-sheet | the Category sheet, which rises slower and leaves faster than the editor; it unmounts after (`useCategorySheet`) |
| `animate-backdrop-in` / `animate-backdrop-out` (`MOTION.backdropIn` / `backdropOut`) | `backdrop-in` 300ms / `backdrop-out` 280ms, ease | the backdrop of the Category sheet, from 0 to full opacity and back |
| `animate-category-pop` (`MOTION.categoryPop`) | `pop` 500ms, ease-spring | a Category appearing in the list (created, or back from Undo) |
| `animate-toast-in` | `toast-in` 450ms, ease-spring | the Notification pill, from 14px above the top center |
| `animate-bar-grow` (`MOTION.barGrow`) | `bar-grow` 800ms, ease-spring | an Analytics bar growing from the bottom: the hero's weekday bars set `animationDelay` to `MOTION.barDelay` + index × `MOTION.barStagger` (200ms, then 60ms apart); the Daily use and Time of day pills spread the same stagger over as long as seven bars take |
| `animate-card-rise` (`MOTION.cardRise`) | `card-rise` 500ms, ease-spring | the Top platform and Top category cards rising 12px, at 100ms and 180ms (`cardDelay`, `cardStagger`), and the Tidy up callout; in the full-page view the Platforms, Categories, Daily use and Time of day cards follow, each `cardStagger` later |
| `animate-rank-fill` (`MOTION.rankFill`) | `fill-grow` 1000ms, ease-spring | a Most used bar filling from the left, 300ms then 90ms apart (`rankDelay`, `rankStagger`); the rows of the Platforms and Categories cards too |
| `MOTION.countUp` (a timer, `useCountUp`) | 800ms, ease-out | the Analytics total counting up from 0 with the bars |
| `animate-toast-mark` | `pop` 450ms, ease-spring, 80ms delay | the round of the Notification |
| `transition-save` (`src/popup.css`) | background and color 300ms, scale 250ms ease-spring | the Save button, which slides to the success color on "Saved" |
| `transition-chip` (`src/popup.css`) | background, border and color 250ms, scale 250ms ease-spring | the Category chips and "New category" |

Presses are `active:scale-92` on a chip and `active:scale-94` on Save, carried by the spring of their
transition. Only a new element pops: a list keyed by a stable value (the name of a Variable) keeps
the elements already there, so their entrance does not replay.

**Save sequence:** Save shows "Saved" at once (`transition-save` slides its background), then after
`MOTION.savedPause` (620ms) the editor closes with `animate-sheet-out` and the Notification appears
with it. The Notification has no exit animation: it leaves at once.

**Focus while a sheet rises:** a panel that takes the keyboard as it mounts (the editor's Title) does it
with `focus({ preventScroll: true })`. The sheet starts a full panel height below the surface, and a
plain `focus()` scrolls the nearest scroll container to reach the field: the side panel's `#root`
(`overflow: hidden`) scrolls the whole app up at the first frame, so the sheet seems already risen
and the Library never recedes in place. `tests/e2e/sidepanel/editor-motion.spec.ts` guards it.

**Reduced motion:** under `prefers-reduced-motion`, `src/popup.css` makes every animation and
transition above last 1ms with no delay (an inline stagger delay included), and `motionDuration()` of `src/theme/motion.ts` makes the timers wait
for nothing: the Save sequence keeps its order without its pause, a panel unmounts at once, and the
Analytics total shows its value at once.

#### Animated presence

`src/hooks/useAnimatedPresence.ts` keeps a panel in the document for the length of its exit
animation: pass the open value (null when closed) and `MOTION.sheetOut`, render `shown`, and switch
to the exit animation while `exiting`. Opening again while leaving cancels the unmount; the timer is
cleared on unmount. The editor sheet of `App` uses it, with its scrim and the recede of the Section
beneath.

#### Settings controls

The Settings controls read their durations from tokens, `duration-(--duration-*)` and `delay-(--delay-*)`, on `ease-spring`. Under `prefers-reduced-motion`, `src/theme/tokens.css` drops every one of them to 1ms (0 for the delay), so a component needs no rule of its own.

| Token | Value | Use |
|---|---|---|
| `--duration-color` | 200ms | Label color of a segmented control |
| `--duration-dim` | 250ms | A site's logo greying when it is turned off |
| `--duration-track` | 300ms | Switch track color |
| `--duration-spring` | 450ms | Switch knob, segmented control puck |
| `--duration-fill`, `--delay-fill` | 1100ms, 200ms | `animate-fill-grow`: the storage bar grows from the left on arrival |

#### Section transition

Arriving on a Section from the tab bar slides it 26px in from the side of its tab while it fades in: a tab further right enters from the right (`animate-section-forward`, keyframes `section-from-right`), one further left from the left (`animate-section-back`, `section-from-left`), by the tab order, as in the mockup. The popup opens on its first Section at once, and pressing the active tab plays nothing (it scrolls the Section to the top). The Section left behind has no animation: it is gone at once.

| Token | Value | Use |
|---|---|---|
| `--ease-section` (`EASE.section`) | `cubic-bezier(0.32, 0.72, 0, 1)` | The slide: most of the way in its first half, then a long settle |
| `--duration-section` (`MOTION.sectionIn`) | 450ms | Its length; 1ms under `prefers-reduced-motion` |

The slide moves the Section with `left`, relatively positioned for the length of the animation only, never with `transform`: a transformed Section would become the containing block of any fixed element inside it. The fade would still dim one, so every sheet and dialog opened from a Section portals to `document.body` (Clear history in Analytics included), out of reach of the slide and the fade. The wrapper around the Section (`editor-beneath` in `App`) clips horizontal overflow (`overflow-x-clip`), so the 26px of the slide never make the popup scroll sideways; a clip, unlike a transform, leaves those fixed dialogs on the viewport.

### Keyframe Animations

#### Category Sheet

Its animations are the motion tokens of `src/theme/tokens.css` (see Motion tokens above). The sheet
rises from the bottom (`animate-category-sheet-in`, `translateY(100%)` to rest, 500ms ease-sheet) and
leaves faster than the editor (`animate-category-sheet-out`, 280ms): `useCategorySheet` takes it off
the page only once the exit has ended, after `motionDuration(MOTION.categorySheetOut)`, so under
`prefers-reduced-motion` at once. The backdrop fades in over 300ms and out over 280ms
(`animate-backdrop-in` / `animate-backdrop-out`). Its transitions are in `src/popup.css`: while it is
open, the screen behind steps back (`.sheet-behind[data-stepped-back]`: `scale(.93) translateY(10px)`,
22px corners, `brightness(.96)`, 0.5s ease-sheet), and swatches move on `transform` over 0.35s
ease-spring (`.swatch-spring`). A Category that appears in the list pops in (`animate-category-pop`:
the shared `pop` keyframes, scale .3, 1.2, then 1, 500ms ease-spring). Under `prefers-reduced-motion`,
all of them last 1ms. Only one dialog is reachable at a time, by assistive
technology too: while the sheet is open, the screen behind and the tab bar are `inert`, and the sheet
is `inert` while it leaves or while the delete confirmation is on top of it. While a create, save or
delete runs, Escape, the backdrop, Close and Cancel wait for it to end, and a save and a deletion never
run together. While a create, save or deletion runs, the name is read-only and the swatches and Save are
`aria-disabled`. A refused name has `border-error`, with the reason under it.

```tsx
<div className="fixed inset-0 z-40">
  <div className="absolute inset-0 bg-backdrop animate-backdrop-in" onClick={onClose} />
  <div role="dialog" aria-modal="true" aria-label={title} className="
    absolute inset-x-0 bottom-0
    rounded-t-3xl bg-card shadow-2xl
    animate-category-sheet-in
  ">
    {/* handle, header, name, palette, footer */}
  </div>
</div>
```

The sheet sits at `z-40`, under the Notification (`z-50`), so a Notification's Undo stays within
reach; its backdrop has no blur, so what is behind it (the edited row's border) stays sharp.

#### Modal Fade In

```css
@keyframes promptSelectorFadeIn {
  from {
    opacity: 0;
    transform: translateY(-8px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Usage */
animation: promptSelectorFadeIn 0.2s ease-out;
```

#### Loading Spinner

```tsx
<div className="
  w-4 h-4
  border-2 border-current/30 border-t-current
  rounded-full
  animate-spin
" />
```

### Hover States

**General Pattern:**
```tsx
<element className="
  hover:bg-muted
  hover:text-accent
  hover:shadow-md
  transition-all duration-200
">
```

**Button Hover:** hover darkens, in both modes
```tsx
<button className="
  bg-accent hover:bg-accent-hover
  shadow-lg hover:shadow-xl
  transition-all duration-200
">
```

**Card Hover:** the surface stays opaque; the shadow rises
```tsx
<div className="
  bg-card
  hover:shadow-md
  transition-shadow duration-200
">
```

### Focus States

Use the predefined Tailwind plugin classes (`tailwind.config.js`). Buttons get a 2px `outline-accent` separated from them by a transparent gap that shows the surface behind; fields get a 2px `ring-accent` and a `border-focus` border:
- `.focus-primary` - Primary buttons (2px gap)
- `.focus-secondary` - Secondary buttons, menu items (1px gap)
- `.focus-danger` - Danger buttons (`outline-danger`)
- `.focus-input` - Input fields
- `.focus-interactive` - Icon buttons, interactive elements (1px gap)

### Active States

```css
active:scale-95         /* Button press effect */
active:opacity-80       /* Alternative press effect */
```

---

## Dark Mode Implementation

### Strategy

The extension uses **class-based dark mode**: `useTheme` puts the `.dark` class on `<html>`, and `src/theme/tokens.css` overrides every color token under `.dark`. Token classes (`bg-card`, `text-secondary`, `border-input`...) therefore switch theme by themselves.

### Dark Mode Patterns

Write one token class, never a light class plus a `dark:` variant:

```tsx
// Before
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-purple-100 dark:border-gray-700">

// After
<div className="bg-card text-primary border-default">
```

`dark:` remains useful for what is not a color token (an icon swapped by theme, for example).

### Content Script Dark Mode

Content scripts follow the extension's theme (`ThemeManager`), not the Platform's:

```css
/* The Prompt selector's shadow host */
:host { ... }
:host([data-theme="dark"]) { ... }

/* The Prompts button, in the Platform's page */
.prompt-library-pill { ... }
.prompt-library-pill.dark-theme { ... }
```

### Testing Dark Mode

All components MUST be tested in both light and dark modes to ensure:
- Sufficient color contrast (WCAG AA standard)
- Readable text on all backgrounds
- Visible borders and dividers
- Consistent hover/focus states
- A visible backdrop behind dialogs

---

## Icons & Graphics

### Icon System

**Source:** Inline SVG elements (no icon library dependency)

### Icon Sizes

```css
h-3 w-3  /* 12px - Small inline icons */
h-4 w-4  /* 16px - Buttons, menu items */
h-5 w-5  /* 20px - Input fields, headers */
h-6 w-6  /* 24px - Page headers, dialogs */
```

### Icon Colors

```css
/* Neutral */
text-tertiary    /* Default icon color (3:1 and more on every surface) */
text-secondary   /* Stronger neutral icons */
text-faint       /* Decorative icons only: under 3:1 */

/* Brand */
text-accent      /* Accent icons, and icons in a bg-accent-subtle square */

/* Status, on a surface */
text-success     /* Success */
text-danger      /* Error */
text-warning     /* Warning */
text-accent      /* Info: there is no blue */

/* Notification, on bg-inverse */
text-on-inverse-strong  text-on-inverse  bg-inverse-mark  bg-inverse-alert  text-on-inverse-mark

/* Pinned Prompt */
text-pin         /* Filled star */
```

### Platform Icons

From `src/components/icons/SiteIcons.tsx`:

- **Claude Icon:** Full SVG path
- **ChatGPT Icon:** Full SVG path
- **Perplexity Icon:** Outlined design
- **Mistral Icon:** Gradient rectangles (colored when enabled, `currentColor` when disabled)
- **Custom Site Icon:** First letter in a styled div

**Usage:**
```tsx
import { ClaudeIcon, ChatGPTIcon } from './components/icons/SiteIcons';

<ClaudeIcon className="h-6 w-6" />
<MistralIcon className="h-6 w-6" disabled={false} />
```

### Icon Button Pattern

```tsx
<button className="
  p-2
  text-tertiary hover:text-accent
  rounded-lg
  hover:bg-muted
  transition-colors
  focus-interactive
">
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="..." />
  </svg>
</button>
```

### Icon Square

The brand gradient (`#6D28D9` to `#4C1D95`) stays on the logo. Other icon squares (Settings, Analytics) are flat:

```tsx
<div className="
  w-10 h-10
  bg-accent-subtle
  rounded-xl
  flex items-center justify-center
">
  <svg className="w-6 h-6 text-accent">{/* Icon */}</svg>
</div>
```

---

## Accessibility

### Focus Management

**CRITICAL:** All interactive elements MUST have visible focus states.

Use the predefined focus classes:
```css
.focus-primary
.focus-secondary
.focus-danger
.focus-input
.focus-interactive
```

### ARIA Labels

All interactive elements MUST have appropriate ARIA labels:

```tsx
<button aria-label="Copy prompt to clipboard">
  <svg aria-hidden="true">{/* Icon */}</svg>
</button>

<input
  type="text"
  aria-label="Search prompts"
  role="searchbox"
/>

<article aria-labelledby="prompt-title-123">
  <h3 id="prompt-title-123">Prompt Title</h3>
</article>
```

### Keyboard Navigation

- **Tab:** Navigate between interactive elements
- **Enter/Space:** Activate buttons and toggles
- **Escape:** Close modals and dropdowns
- **Arrow keys:** Navigate within menus and lists

**Example:**
```tsx
<button
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }}
>
```

### Color Contrast

**WCAG AA Standards:**
- Normal text: 4.5:1 contrast ratio
- Large text (18px+): 3:1 contrast ratio
- Interactive elements: 3:1 contrast ratio

**Verified by `src/theme/__tests__/tokens.test.ts`, in light and dark:**
- `text-primary`, `text-secondary` and `text-tertiary` on `bg-app`, `bg-card` and `bg-subtle`: 4.5:1
- Text on fills and tints (`text-on-accent` on `bg-accent` and `bg-danger`, each state text on its `-subtle` background, `text-on-inverse` on `bg-inverse`): 4.5:1
- Controls (`border-input`, the focus ring, `text-pin`, the Notification rounds, the scrollbar thumb): 3:1
- `text-faint` is under 3:1: decorative and disabled content only

### Screen Reader Support

```tsx
{/* Screen reader only content */}
<span className="sr-only">
  Additional context for screen readers
</span>
```

**CSS:**
```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

---

## Do's and Don'ts

### ✅ DO

- **Use the predefined focus classes** (`.focus-primary`, `.focus-input`, etc.)
- **Use token classes for every color** (`bg-card`, `text-secondary`, `border-input`...): they switch theme by themselves
- **Use the flat accent** (`bg-accent hover:bg-accent-hover`) for primary actions
- **Keep surfaces opaque**: `bg-backdrop` with `backdrop-blur-sm` goes behind dialogs and drawers only
- **Check every component in light and dark**
- **Test keyboard navigation** on all interactive elements
- **Add ARIA labels** to all buttons without visible text
- **Use rounded-xl (12px)** for cards, inputs, and buttons
- **Apply transition-all duration-200** for smooth interactions
- **Use the color palette** from `src/constants/colors.ts` for categories
- **Follow the spacing scale** (p-3, p-5, p-6) consistently

### ❌ DON'T

- **Don't use raw palette classes or arbitrary colors** (`gray-*`, `purple-*`, `white`, `text-[#...]`): add a token instead
- **Don't pair a token class with a `dark:` color variant**
- **Don't use the brand gradient outside the logo**
- **Don't use `text-faint` for information**, placeholders included (`placeholder:text-tertiary`)
- **Don't put `bg-subtle` directly on `bg-app`**: same value in light
- **Don't mix border radius values** - use the standard scale
- **Don't forget hover states** on interactive elements
- **Don't use multiple transition durations** - stick to 200ms
- **Don't create custom focus styles** - use the predefined classes
- **Don't forget ARIA labels** on icon-only buttons
- **Don't use box-shadow directly** - use Tailwind shadow utilities
- **Don't skip the loading state** for async operations

### 🎨 Color Usage

**DO:**
```tsx
// Use the state tokens
<span className="text-success">Saved</span>
<p className="text-danger">Title is required</p>

// Use the flat accent for primary actions
<button className="bg-accent hover:bg-accent-hover text-on-accent">Save</button>
```

**DON'T:**
```tsx
// Don't use raw palette classes or arbitrary values
<span className="text-green-500">Saved</span>
<span className="text-[#00ff00]">Saved</span>

// Don't use a gradient outside the logo
<button className="bg-linear-to-r from-purple-600 to-indigo-600">Save</button>
```

### 📐 Spacing

**DO:**
```tsx
// Use standard spacing scale
<div className="p-5">
  <div className="space-x-3">
```

**DON'T:**
```tsx
// Don't use arbitrary spacing
<div className="p-[17px]">
  <div className="space-x-[13px]">
```

### 🌓 Dark Mode

**DO:**
```tsx
// One token class: it switches theme by itself
<div className="bg-card">
  <p className="text-primary">
```

**DON'T:**
```tsx
// Don't pair a raw class with a dark: variant
<div className="bg-white dark:bg-gray-800">
  <p className="text-gray-900 dark:text-gray-100">
```

---

## Quick Reference

### Common Class Combinations

**Primary Button:**
```
px-6 py-3 text-sm font-semibold text-on-accent
bg-accent hover:bg-accent-hover
rounded-xl transition-all duration-200
shadow-lg hover:shadow-xl
disabled:opacity-50 focus-primary
```

**Text Input (on a card; on bg-app use bg-card):**
```
w-full px-4 py-3
border border-input
rounded-xl focus-input
bg-subtle
transition-all duration-200
text-primary placeholder:text-tertiary
```

**Card Container:**
```
bg-card border border-default
rounded-2xl p-4
shadow-sm hover:shadow-md
transition-shadow duration-200
```

**Section Header (line shown once the content scrolls under it):**
```
shrink-0 bg-app px-5 pt-4 pb-2
border-b border-transparent / border-strong
```

**Chosen Item:**
```
bg-accent-selected border border-accent
text-accent-strong font-semibold
```

**Icon Button:**
```
p-2 text-tertiary hover:text-accent
rounded-lg hover:bg-muted
transition-colors focus-interactive
```

### Dimensions Reference

**Popup:**
- Width: 400px
- Height: 500px

**Side Panel:**
- Min Width: 320px
- Width: 100%
- Height: 100vh

**Prompt selector on a Platform** (`src/content/selector/position.ts`):
- Width: 360px, never wider than the window minus 10px on each side
- Placed 10px above the input field, below when a full popover (384px) does not fit above
- Max height: the room left on that side; the list inside is at most 230px, the variables text 220px

**Confirmation of an Insertion** (`src/content/selector/InsertionFeedback.tsx`):
- Pill: 34px high, on `bg-inverse`, its right edge on the input field's, 10px above the field (below when the field is less than 48px from the top of the window), at most 420px wide and never past the window: when the field leaves less than 240px on its left, the pill starts 8px from the left of the window instead; `role="status"`; `Inserted “title”` and an Undo button (26px high), or `Couldn't insert “title”` alone (`Couldn't undo “title”` when Undo could not put the earlier text back)
- It stays 2.8s, and while it is hovered or focused; it leaves when the user types in the field or sends
- Keyboard: while the pill offers Undo, Tab in the input field moves the focus to Undo (the pill is last in the page's tab order, 96 Tab presses away on Gemini), Enter or Space presses it, and Shift+Tab on Undo returns to the field; neither Tab reaches the page. Tab with Ctrl, Alt or Cmd, Shift+Tab in the field, and Tab once the pill is leaving are the page's own
- Sweep: a violet band (`bg-inverse-mark` at 32%) across the field, once, 1.1s on the sheet curve, inside the field's own corner radius; not drawn under reduced motion

**Prompts button** (`src/content/utils/styles.ts`):
- Height: 32px, badge 22px; the badge alone (32px wide) when its bar has no room or it is laid over the page

### Z-Index Layers

```css
z-10         /* Relative positioned elements */
z-50         /* Modal overlays */
z-999999     /* Content script: Prompts button laid over a custom site */
z-2147483647 /* Content script: shadow host of the Prompt selector */
z-1000001  /* Content script feedback */
z-1000002  /* Content script debug */
```

---

## Examples

### Complete Form Section

```tsx
<div className="bg-card border-b border-divider p-5">
  <label
    htmlFor="title"
    className="block text-sm font-semibold text-secondary mb-3"
  >
    Title (optional)
  </label>
  <input
    type="text"
    id="title"
    value={formData.title}
    onChange={(e) => handleChange('title', e.target.value)}
    placeholder="Enter a descriptive title"
    className="w-full px-4 py-3 border border-input rounded-xl focus-input bg-subtle transition-all duration-200 text-primary placeholder:text-tertiary"
  />
  <p className="mt-2 text-xs text-tertiary font-medium">
    {formData.title.length}/100 characters
  </p>
</div>
```

### Complete Action Buttons

```tsx
<div className="shrink-0 p-6 bg-app border-t border-strong">
  <div className="flex space-x-3">
    <button
      type="button"
      onClick={onCancel}
      className="flex-1 px-6 py-3 text-sm font-semibold text-secondary bg-card border border-strong rounded-xl hover:bg-muted transition-all duration-200 focus-secondary"
    >
      Cancel
    </button>
    <button
      type="submit"
      className="flex-1 px-6 py-3 text-sm font-semibold text-on-accent bg-accent rounded-xl hover:bg-accent-hover transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 focus-primary"
      disabled={isLoading}
    >
      {isLoading ? 'Saving...' : 'Save Prompt'}
    </button>
  </div>
</div>
```
