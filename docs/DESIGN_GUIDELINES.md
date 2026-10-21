# Design Guidelines

**Version:** 2.0.0
**Last Updated:** 2026-10-21

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

The brand gradient (`#6D28D9` to `#4C1D95`) is reserved for the logo. Every other surface is flat.

### States

| Class | Light | Dark | Use |
|---|---|---|---|
| `bg-success` | `#10B981` | `#10B981` | Dots and badges only (2.54:1 on white: never text) |
| `bg-success-subtle` / `text-success` | `#E7F8EF` / `#065F46` | `#0F2D22` / `#6EE7B7` | Success message |
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
<h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
  Add New Prompt
</h1>
```

**Section Header:**
```tsx
<h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
  Category
</h2>
```

**Body Text:**
```tsx
<p className="text-sm text-gray-600 dark:text-gray-400">
  Description text
</p>
```

**Helper Text:**
```tsx
<p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
  100/10000 characters
</p>
```

**Prompt Card Title:**
```tsx
<h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-tight truncate">
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
<div className="shadow-xl backdrop-blur-sm">
  {/* Modal content */}
</div>
```

---

## Component Patterns

### Buttons

#### Primary Button (Gradient)

```tsx
<button className="
  px-6 py-3
  text-sm font-semibold text-white
  bg-linear-to-r from-purple-600 to-indigo-600
  rounded-xl
  hover:from-purple-700 hover:to-indigo-700
  transition-all duration-200
  shadow-lg hover:shadow-xl
  disabled:opacity-50
  focus-primary
">
  Save Prompt
</button>
```

**Focus Class:**
```css
.focus-primary {
  @apply focus:outline-none focus:ring-2 focus:ring-purple-500
         focus:ring-offset-2 focus:ring-offset-white
         dark:focus:ring-offset-gray-900;
}
```

#### Secondary Button

```tsx
<button className="
  px-6 py-3
  text-sm font-semibold
  text-gray-700 dark:text-gray-300
  bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm
  border border-purple-200 dark:border-gray-600
  rounded-xl
  hover:bg-white/80 dark:hover:bg-gray-700/80
  transition-all duration-200
  focus-secondary
">
  Cancel
</button>
```

**Focus Class:**
```css
.focus-secondary {
  @apply focus:outline-none focus:ring-2 focus:ring-purple-500
         focus:ring-offset-1 focus:ring-offset-white
         dark:focus:ring-offset-gray-800;
}
```

#### Danger Button

```tsx
<button className="
  px-3 py-1.5
  text-xs font-semibold text-white
  bg-red-600 hover:bg-red-700
  rounded-lg
  shadow-sm
  transition-colors
  focus-danger
">
  Delete
</button>
```

**Focus Class:**
```css
.focus-danger {
  @apply focus:outline-none focus:ring-2 focus:ring-red-500
         focus:ring-offset-2 focus:ring-offset-white
         dark:focus:ring-offset-gray-900;
}
```

#### Small Action Button (Copy)

```tsx
<button className="
  inline-flex items-center
  px-2 py-1
  bg-linear-to-r from-purple-500 to-indigo-500
  text-white
  rounded-md
  hover:from-purple-600 hover:to-indigo-600
  transition-all duration-200
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
  text-gray-400 dark:text-gray-500
  hover:text-purple-600 dark:hover:text-purple-400
  rounded-lg
  hover:bg-purple-50 dark:hover:bg-purple-900/20
  transition-colors
  focus-interactive
">
  <svg className="h-5 w-5">{/* Icon */}</svg>
</button>
```

**Focus Class:**
```css
.focus-interactive {
  @apply focus:outline-none focus:ring-2 focus:ring-purple-500
         focus:ring-offset-1 focus:ring-offset-white
         dark:focus:ring-offset-gray-800 dark:focus:ring-purple-400;
}
```

#### Loading State

```tsx
<button disabled className="disabled:opacity-50">
  <div className="flex items-center justify-center space-x-2">
    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
    <span>Saving...</span>
  </div>
</button>
```

### Input Fields

#### Text Input

```tsx
<input
  type="text"
  className="
    w-full px-4 py-3
    border border-purple-200 dark:border-gray-600
    rounded-xl
    focus-input
    bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm
    transition-all duration-200
    text-gray-900 dark:text-gray-100
    placeholder-gray-500 dark:placeholder-gray-400
  "
  placeholder="Enter text..."
/>
```

**Focus Class:**
```css
.focus-input {
  @apply focus:outline-none focus:ring-2 focus:ring-purple-500
         focus:border-purple-500 dark:focus:ring-purple-400
         dark:focus:border-purple-400;
}
```

#### Text Input with Error

```tsx
<input
  className="
    w-full px-4 py-3
    border rounded-xl focus-input
    bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm
    transition-all duration-200
    text-gray-900 dark:text-gray-100
    border-red-300 dark:border-red-500
  "
/>
{errors.field && (
  <p className="mt-2 text-sm text-red-600 dark:text-red-400 font-medium">
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
    border border-purple-200 dark:border-gray-600
    rounded-xl
    focus-input
    resize-none
    bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm
    transition-all duration-200
    text-gray-900 dark:text-gray-100
  "
  placeholder="Enter your prompt content..."
/>
```

#### Select Dropdown

```tsx
<div className="relative">
  <select className="
    w-full px-4 py-3 pr-10
    border border-purple-200 dark:border-gray-600
    rounded-xl
    focus-input
    bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm
    transition-all duration-200
    font-medium
    appearance-none
    cursor-pointer
    text-gray-900 dark:text-gray-100
  ">
    <option>Option 1</option>
  </select>
  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
    <svg className="w-4 h-4 text-purple-400 dark:text-purple-300">
      {/* Chevron down icon */}
    </svg>
  </div>
</div>
```

#### Search Input

```tsx
<div className="relative">
  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
    <svg className="h-5 w-5 text-purple-400 dark:text-purple-300">
      {/* Search icon */}
    </svg>
  </div>
  <input
    type="text"
    className="
      w-full pl-12 pr-12 py-3
      bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm
      border border-purple-200 dark:border-gray-600
      rounded-xl
      focus-input
      text-sm
      text-gray-900 dark:text-gray-100
      placeholder-gray-500 dark:placeholder-gray-400
      shadow-sm
      hover:bg-white/80 dark:hover:bg-gray-700/80
      transition-all duration-200
    "
    placeholder="Search prompts"
  />
  {/* Clear button on right if needed */}
</div>
```

### Cards

#### Prompt Card

```tsx
<article className="
  bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm
  border-b border-purple-100 dark:border-gray-700
  p-5
  hover:bg-white/90 dark:hover:bg-gray-800/90
  transition-all duration-200
  relative group
">
  {/* Card content */}
</article>
```

#### Settings Card

```tsx
<div className="
  bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm
  border border-purple-100 dark:border-gray-700
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

```tsx
<span
  className="
    inline-flex items-center
    px-2 py-0.5
    rounded-full
    text-xs font-medium text-white
  "
  style={{ backgroundColor: categoryColor }}
>
  Category Name
</span>
```

#### Status Badge

```tsx
<span className="
  inline-flex items-center
  px-2 py-1
  rounded-full
  text-xs font-medium
  bg-green-100 dark:bg-green-900/20
  text-green-700 dark:text-green-400
">
  Active
</span>
```

### Modals & Dialogs

#### Modal Container

```tsx
<div className="
  fixed inset-0 z-50
  flex items-center justify-center p-3
">
  {/* Backdrop */}
  <div
    className="
      absolute inset-0
      bg-black bg-opacity-50
      transition-opacity
    "
    onClick={onClose}
  />

  {/* Modal Panel */}
  <div className="
    relative
    bg-white dark:bg-gray-800
    rounded-xl p-3
    shadow-xl
    transform transition-all
    max-w-xs w-full mx-2
    backdrop-blur-sm
    border border-purple-100 dark:border-gray-700
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
    bg-red-100 dark:bg-red-900/20
  ">
    <svg className="w-6 h-6 text-red-600">{/* Icon */}</svg>
  </div>

  {/* Content */}
  <div className="ml-3 flex-1">
    <h3 className="text-sm leading-5 font-bold text-gray-900 dark:text-gray-100">
      Delete Prompt
    </h3>
    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 leading-tight">
      Are you sure? This action cannot be undone.
    </p>
  </div>
</div>

{/* Actions */}
<div className="mt-3 flex flex-row-reverse gap-2">
  <button className="bg-red-600 hover:bg-red-700 ...">Delete</button>
  <button className="border bg-white dark:bg-gray-700 ...">Cancel</button>
</div>
```

### Toggle Switch

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
    focus:outline-none focus:ring-4 focus:ring-purple-300 dark:focus:ring-purple-800
    ${checked
      ? 'bg-linear-to-r from-purple-600 to-indigo-600 shadow-sm'
      : 'bg-gray-200 dark:bg-gray-700'
    }
    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
  `}
>
  <span className={`
    h-5 w-5
    inline-block transform
    rounded-full bg-white shadow-sm
    transition-transform duration-200
    border border-gray-300 dark:border-gray-600
    ${checked ? 'translate-x-6' : 'translate-x-[2px]'}
  `} />
</button>
```

### Toast Notifications

```tsx
<div className="
  flex items-start p-4
  rounded-lg shadow-lg
  bg-white dark:bg-gray-800
  text-gray-900 dark:text-white
  border border-l-4
  border-l-purple-500
  border-t border-r border-b
  border-purple-200 dark:border-purple-800
">
  {/* Icon */}
  <div className="shrink-0">
    <svg className="h-5 w-5 text-purple-500">{/* Icon */}</svg>
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
  <div className="absolute bottom-0 left-0 h-1 bg-purple-500"
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
        bg-white dark:bg-gray-800 backdrop-blur-sm
        rounded-xl
        shadow-xl
        border border-purple-200 dark:border-gray-700
        overflow-hidden
        z-1001
      ">
        <button className="
          block w-full text-left
          px-4 py-3
          text-sm
          text-gray-700 dark:text-gray-300
          hover:bg-purple-50 dark:hover:bg-purple-900/20
          hover:text-purple-700 dark:hover:text-purple-400
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
          text-red-600 dark:text-red-400
          hover:bg-red-50 dark:hover:bg-red-900/20
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

```tsx
<div className="
  shrink-0 p-6
  bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm
  border-b border-purple-100 dark:border-gray-700
">
  <div className="flex items-center justify-between">
    <div className="flex items-center space-x-3">
      {/* Icon */}
      <div className="
        w-10 h-10
        bg-linear-to-br from-purple-600 to-indigo-600
        rounded-xl
        flex items-center justify-center
      ">
        <svg className="w-6 h-6 text-white">{/* Icon */}</svg>
      </div>

      {/* Text */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Section Title
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Description text
        </p>
      </div>
    </div>

    {/* Action button */}
  </div>
</div>
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
  border-2 border-white/30 border-t-white
  rounded-full
  animate-spin
" />
```

### Hover States

**General Pattern:**
```tsx
<element className="
  hover:bg-purple-50 dark:hover:bg-purple-900/20
  hover:text-purple-600 dark:hover:text-purple-400
  hover:shadow-md
  transition-all duration-200
">
```

**Button Hover:**
```tsx
<button className="
  bg-linear-to-r from-purple-600 to-indigo-600
  hover:from-purple-700 hover:to-indigo-700
  shadow-lg hover:shadow-xl
  transition-all duration-200
">
```

**Card Hover:**
```tsx
<div className="
  bg-white/70 dark:bg-gray-800/70
  hover:bg-white/90 dark:hover:bg-gray-800/90
  transition-all duration-200
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
- Proper backdrop-blur-sm rendering

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
text-gray-400 dark:text-gray-500      /* Default icon color */
text-gray-500 dark:text-gray-400      /* Secondary icons */

/* Brand */
text-purple-400 dark:text-purple-300  /* Primary icons */
text-purple-500 dark:text-purple-400  /* Accent icons */

/* Status */
text-green-500  /* Success */
text-red-500    /* Error */
text-yellow-500 /* Warning */
text-blue-500   /* Info */
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
  text-gray-400 dark:text-gray-500
  hover:text-purple-600 dark:hover:text-purple-400
  rounded-lg
  hover:bg-purple-50 dark:hover:bg-purple-900/20
  transition-colors
  focus-interactive
">
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="..." />
  </svg>
</button>
```

### Gradient Icon Background

```tsx
<div className="
  w-10 h-10
  bg-linear-to-br from-purple-600 to-indigo-600
  rounded-xl
  flex items-center justify-center
">
  <svg className="w-6 h-6 text-white">{/* Icon */}</svg>
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

**Verified Combinations:**
- White background + gray-900 text: ✓
- Gray-800 background + gray-100 text: ✓
- Purple-600 background + white text: ✓
- Status colors + white text: ✓

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
- **Apply backdrop-blur-sm** with semi-transparent backgrounds for glassmorphism
- **Use purple-indigo gradient** for primary actions
- **Include both light and dark mode styles** for all components
- **Test keyboard navigation** on all interactive elements
- **Add ARIA labels** to all buttons without visible text
- **Use rounded-xl (12px)** for cards, inputs, and buttons
- **Apply transition-all duration-200** for smooth interactions
- **Use the color palette** from `src/constants/colors.ts` for categories
- **Follow the spacing scale** (p-3, p-5, p-6) consistently

### ❌ DON'T

- **Don't use arbitrary color values** - stick to the defined palette
- **Don't mix border radius values** - use the standard scale
- **Don't skip dark mode styles** - every component needs both
- **Don't forget hover states** on interactive elements
- **Don't use multiple transition durations** - stick to 200ms
- **Don't create custom focus styles** - use the predefined classes
- **Don't use opacity without backdrop-blur** for glassmorphism
- **Don't forget ARIA labels** on icon-only buttons
- **Don't use box-shadow directly** - use Tailwind shadow utilities
- **Don't skip the loading state** for async operations

### 🎨 Color Usage

**DO:**
```tsx
// Use defined status colors
<span className="text-green-500">Success</span>
<span className="text-red-500">Error</span>

// Use the purple-indigo gradient for primary actions
<button className="bg-linear-to-r from-purple-600 to-indigo-600">
```

**DON'T:**
```tsx
// Don't use arbitrary color values
<span className="text-[#00ff00]">Success</span>

// Don't use single-color gradients
<button className="bg-purple-600">Primary</button>
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
// Include dark mode variant for every style
<div className="bg-white dark:bg-gray-800">
  <p className="text-gray-900 dark:text-gray-100">
```

**DON'T:**
```tsx
// Don't omit dark mode styles
<div className="bg-white">
  <p className="text-gray-900">
```

---

## Quick Reference

### Common Class Combinations

**Primary Button:**
```
px-6 py-3 text-sm font-semibold text-white
bg-linear-to-r from-purple-600 to-indigo-600
rounded-xl hover:from-purple-700 hover:to-indigo-700
transition-all duration-200 shadow-lg hover:shadow-xl
disabled:opacity-50 focus-primary
```

**Text Input:**
```
w-full px-4 py-3
border border-purple-200 dark:border-gray-600
rounded-xl focus-input
bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm
transition-all duration-200
text-gray-900 dark:text-gray-100
```

**Card Container:**
```
bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm
border-b border-purple-100 dark:border-gray-700
p-5 hover:bg-white/90 dark:hover:bg-gray-800/90
transition-all duration-200
```

**Section Header:**
```
shrink-0 p-6
bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm
border-b border-purple-100 dark:border-gray-700
```

**Icon Button:**
```
p-2 text-gray-400 dark:text-gray-500
hover:text-purple-600 dark:hover:text-purple-400
rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20
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
<div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border-b border-purple-100 dark:border-gray-700 p-5">
  <label
    htmlFor="title"
    className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3"
  >
    Title (optional)
  </label>
  <input
    type="text"
    id="title"
    value={formData.title}
    onChange={(e) => handleChange('title', e.target.value)}
    placeholder="Enter a descriptive title"
    className="w-full px-4 py-3 border rounded-xl focus-input bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm transition-all duration-200 text-gray-900 dark:text-gray-100 border-purple-200 dark:border-gray-600"
  />
  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 font-medium">
    {formData.title.length}/100 characters
  </p>
</div>
```

### Complete Action Buttons

```tsx
<div className="shrink-0 p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-t border-purple-100 dark:border-gray-700">
  <div className="flex space-x-3">
    <button
      type="button"
      onClick={onCancel}
      className="flex-1 px-6 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm border border-purple-200 dark:border-gray-600 rounded-xl hover:bg-white/80 dark:hover:bg-gray-700/80 transition-all duration-200 focus-secondary"
    >
      Cancel
    </button>
    <button
      type="submit"
      className="flex-1 px-6 py-3 text-sm font-semibold text-white bg-linear-to-r from-purple-600 to-indigo-600 rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 focus-primary"
      disabled={isLoading}
    >
      {isLoading ? 'Saving...' : 'Save Prompt'}
    </button>
  </div>
</div>
```

---

## Version History

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

**Last Updated:** 2025-10-06
**Maintained By:** AI Development Team
