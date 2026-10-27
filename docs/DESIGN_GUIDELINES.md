# Design Guidelines

**Version:** 2.4.0
**Last Updated:** 2026-10-23

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
| `bg-app` | `#F4F1FA` | `#120E1B` | Page, header and tab bar (seamless, no white band) |
| `bg-card` | `#FFFFFF` | `#231C34` | Cards, form sections, and the search field and pills that sit on `bg-app` |
| `bg-subtle` | `#F4F1FA` | `#2B2340` | Chips and fields **on a card**. Never directly on `bg-app`: same value in light |
| `bg-raised` | `#F8F6FC` | `#1B1528` | Light fills: empty states, nested panels |
| `bg-muted` | `#F1EDF8` | `#2E2645` | Hover of neutral elements (`hover:bg-muted`) |
| `bg-inverse` | `#1D1530` | `#4A3D6B` | Toasts |
| `bg-backdrop` | `#2A2140` at 45% | `#07050C` at 70% | Behind an open dialog or drawer, with `backdrop-blur-sm` |
| `bg-highlight` | `#FEF3C7` | `#33270F` | Search match in a Prompt title or preview (`<mark className="bg-highlight text-inherit">`) |

Surfaces are **opaque**. `bg-backdrop` is the only translucent one: no more `bg-white/70` + `backdrop-blur-sm` glass on headers or sections.

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

The brand gradient (`bg-brand`: `#6D28D9` to `#4C1D95`, the same in both modes) is reserved for the logo. Every other surface is flat, except the Analytics medals: `bg-medal-gold`, `bg-medal-silver` and `bg-medal-bronze` (the same in both modes, with a `text-on-accent` icon) mark the three most used Prompts.

Charts read the tokens as CSS variables (`src/theme/chartColors.ts`): the primary series and the peak bar take the accent, the other bars `border-accent`, and grid, axes and tooltip the neutral tokens, so they follow the mode without React. The categorical palettes (Categories, Platforms, times of day) are data, the same in both modes.

The Prompt selector and the Variable form injected on Platforms are plain CSS (`src/content/utils/styles.ts`), not Tailwind: they declare the same tokens, under the same names, as CSS variables on `.prompt-library-selector` (light) and `.prompt-library-selector.dark-theme` (dark), and read them through `var()`. `styles.test.ts` fails when a value drifts from `tokens.css` or a color is written outside those declarations. Category chips there follow the same chip rule (`src/theme/categoryChip.ts`).

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
| `text-inverse-success`, `-danger`, `-warning`, `-info` | `#6EE7B7`, `#FCA5A5`, `#FCD34D`, `#C4B5FD` | same | Status icons on `bg-inverse` (toasts), in both modes |

Information uses the accent family (`bg-accent-subtle`, `border-accent`, `text-accent`): there is no blue info color.

### Rules of use

- **Chosen vs on.** One item chosen among several: `bg-accent-selected border-accent text-accent-strong font-semibold`. A setting that is on: `bg-accent`.
- **Hover.** `hover:bg-accent-hover` on `bg-accent`, `hover:bg-danger-hover` on `bg-danger`, `hover:bg-muted` on neutral elements.
- **Fields.** On a card: `bg-subtle border-input`; on `bg-app`: `bg-card border-input`; add `focus-input`; in error: `border-error` and a `text-danger` message.

### Category Colors

Category colors are user data, not tokens: the preset palette, the chip (soft badge) rule and its contrast safety net live in `src/constants/colors.ts`, documented in [CATEGORY_COLOR_IMPLEMENTATION.md](./CATEGORY_COLOR_IMPLEMENTATION.md).

### Adding or changing a token

Declare it in both blocks of `src/theme/tokens.css` (`@theme static` and `.dark`), with the property namespace that gives the class you want (`--background-color-*`, `--text-color-*`, `--border-color-*`, `--ring-color-*`, `--outline-color-*`). A token that only reuses another one may be a `var()` reference in `@theme` alone. Add it to the class list of `tokens.test.ts`, and to a contrast pair when text or a control sits on it.

---

## Typography

### Font Family

```css
font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

**Tailwind:** No custom font classes needed; uses default system font stack.

### Font Sizes

```css
text-xs    /* 12px / 0.75rem  - Helper text, character counts */
text-sm    /* 14px / 0.875rem - Body text, form labels, buttons */
text-base  /* 16px / 1rem     - Default body text */
text-lg    /* 18px / 1.125rem - Emphasized text */
text-xl    /* 20px / 1.25rem  - Section headers */
text-2xl   /* 24px / 1.5rem   - Page titles (rare) */
```

### Font Weights

```css
font-medium   /* 500 - Secondary headings, emphasized text */
font-semibold /* 600 - Primary headings, button text */
font-bold     /* 700 - Major section titles */
```

### Line Heights

```css
leading-tight  /* 1.25 - Headings */
leading-normal /* 1.5 - Body text (default) */
leading-relaxed /* 1.625 - Comfortable reading */
```

### Typography Patterns

**Page Title:**
```tsx
<h1 className="text-xl font-bold text-primary">
  Add New Prompt
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
```

### Custom Shadows

The Prompt selector injected on Platforms is styled in `src/content/utils/styles.ts`, outside Tailwind; its shadows and colors are not on the palette yet.

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

A form (Add and Edit Prompt) is one card on `bg-app`: its sections are split by `border-divider`, its fields take `bg-subtle`. The button bar below it stays on `bg-app`, with a line only while fields remain below (`scroll-edge-bottom`, like the tab bar):

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

#### Settings Card

```tsx
<div className="
  bg-card
  border border-default
  rounded-xl
  p-5
  hover:shadow-md
  transition-all duration-200
">
  {/* Card content */}
</div>
```

### Badges & Pills

#### Category Badge

Category colors are user data, not tokens: use the component, which derives the chip colors of both modes from the Category's color (`getSoftBadgeColors` in `src/constants/colors.ts`):

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

A short choice among a few options (the theme) sits in a `bg-subtle` track. The chosen option takes the chosen-item colors; the others are transparent. It is a radio group:

```tsx
<div role="radiogroup" aria-labelledby={labelId} className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-subtle">
  {options.map(option => (
    <button
      key={option.value}
      type="button"
      role="radio"
      aria-checked={value === option.value}
      className={`
        h-9 rounded-lg border text-sm font-semibold transition-colors focus-interactive
        ${value === option.value
          ? 'bg-accent-selected border-accent text-accent-strong'
          : 'border-transparent text-secondary hover:text-primary hover:bg-muted'
        }
      `}
    >
      {option.label}
    </button>
  ))}
</div>
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

On: `bg-accent`. Off: the track is filled with the field-outline token (`border-input`, 3:1 on every surface). The knob is white in both modes, the `text-on-accent` color. Neither fill has a `bg-` class, so both read their token through an arbitrary value:

```tsx
<button
  type="button"
  role="switch"
  aria-checked={checked}
  onClick={() => onChange(!checked)}
  className={`
    w-11 h-6
    relative inline-flex items-center
    rounded-full
    transition-all duration-200
    focus-interactive
    ${checked ? 'bg-accent' : 'bg-(--border-color-input)'}
    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
  `}
>
  <span className={`
    h-5 w-5
    inline-block transform
    rounded-full bg-(--text-color-on-accent) shadow-sm
    transition-transform duration-200
    ${checked ? 'translate-x-6' : 'translate-x-[2px]'}
  `} />
</button>
```

### Toast Notifications

Toasts are dark in both modes (`bg-inverse`). The status icon takes its bright variant (`text-inverse-success`, `-danger`, `-warning`, `-info`), and the progress bar takes the icon color through `bg-current`:

```tsx
<div className="
  relative flex items-start p-4
  rounded-lg shadow-lg
  bg-inverse
  text-on-inverse
  overflow-hidden
">
  {/* Icon */}
  <div className="shrink-0 text-inverse-success">
    <svg className="h-5 w-5">{/* Icon */}</svg>
  </div>

  {/* Message */}
  <div className="ml-3 flex-1">
    <p className="text-sm font-medium">Message text</p>
  </div>

  {/* Dismiss */}
  <button className="ml-4 shrink-0">
    <svg className="h-4 w-4">{/* X icon */}</svg>
  </button>

  {/* Progress bar */}
  <div className="absolute bottom-0 left-0 h-1 bg-current text-inverse-success"
       style={{
         width: '100%',
         animation: 'shrink-width 3s linear'
       }}
  />
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

The header is seamless: it shares `bg-app` with the page, and its bottom line (`border-strong`) shows only once the content scrolls under it. The tab bar works the same way: its top line shows while content remains below. Both lines are drawn by CSS (`scroll-edge-top` and `scroll-edge-bottom` in `src/popup.css`), driven by the scroll of the view's `[data-scroll-container]` inside App's `section-scroll-scope`: no scroll state in React. `ViewHeader` and `TabBar` already carry them.

The icon square is `bg-accent-subtle` with a `text-accent` icon; the Library's logo takes `bg-brand` with a `text-on-accent` icon.

```tsx
<header className="
  shrink-0 p-6
  bg-app
  border-b border-transparent scroll-edge-top
">
  <div className="flex items-center justify-between">
    <div className="flex items-center space-x-3">
      {/* Icon */}
      <div className="
        w-10 h-10
        bg-accent-subtle
        rounded-xl
        flex items-center justify-center
      ">
        <svg className="w-6 h-6 text-accent">{/* Icon */}</svg>
      </div>

      {/* Text */}
      <div>
        <h2 className="text-xl font-bold text-primary">
          Section Title
        </h2>
        <p className="text-sm text-tertiary">
          Description text
        </p>
      </div>
    </div>

    {/* Action button */}
  </div>
</header>
```

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

### Keyframe Animations

#### Toast Progress Bar

```css
@keyframes shrink-width {
  from { width: 100%; }
  to { width: 0%; }
}

/* Usage */
animation: shrink-width 3s linear;
```

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

Content scripts detect dark mode from host page:

```javascript
// Light theme class
.prompt-library-selector.light-theme { ... }

// Dark theme class
.prompt-library-selector.dark-theme { ... }
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

/* Status, on bg-inverse (toasts) */
text-inverse-success  text-inverse-danger  text-inverse-warning  text-inverse-info

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
- Controls (`border-input`, the focus ring, `text-pin`, the toast icons, the scrollbar thumb): 3:1
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
shrink-0 p-6 bg-app
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

**Content Script Modal:**
- Width: 400px
- Max Height: 500px
- Mobile: calc(100vw - 40px)

### Z-Index Layers

```css
z-10         /* Relative positioned elements */
z-50         /* Modal overlays */
z-999999   /* Content script icon */
z-1000000  /* Content script modal */
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

---

## Version History

**v2.4.0** (2026-10-23)
- `bg-warning` for warning graphics (toast-type marks, the storage bar); segmented control pattern (the theme)

**v2.3.0** (2026-10-23)
- List card pattern (the Categories): rows split by `border-divider`, `hover:bg-muted`; the chosen swatch of a color picker takes an accent ring

**v2.2.0** (2026-10-23)
- Form card pattern: one card on `bg-app`, sections split by `border-divider`, button bar with the `scroll-edge-bottom` line

**v2.1.0** (2026-10-23)
- `bg-highlight` for search matches and `bg-brand` for the logo gradient
- Header and tab bar lines drawn by CSS from the view's scroll (`scroll-edge-top`, `scroll-edge-bottom`)

**v2.0.0** (2026-10-21)
- Semantic color tokens for light and dark (`src/theme/tokens.css`): one class per color, no `dark:` color variant
- Every pattern and example moved to the token classes: flat accent instead of the purple-indigo gradient, opaque surfaces instead of glass, dark toasts
- Focus rings drawn as a 2px accent outline with a transparent gap

**v1.0.0** (2025-10-06)
- Initial comprehensive design guidelines
- Documented all color, typography, and spacing systems
- Added complete component patterns
- Included dark mode implementation guide
- Added accessibility guidelines

---

## Contact

For questions or suggestions about these design guidelines, please open an issue on the project repository.

---

**Last Updated:** 2026-10-23
**Maintained By:** AI Development Team
