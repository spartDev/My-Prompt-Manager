<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Design Tokens Reference

> **Important**: This is a fallback reference. When `node_modules` is available, discover actual tokens by grepping `node_modules/@sanofi-accelerator/elements/dist/styles.css` for `--elements-` — token names and values may differ across versions.

All values are CSS custom properties. Use them in SCSS/CSS files.

## Spacing

| Token | Pixels |
|-------|--------|
| `--elements-spacing-none` | 0px |
| `--elements-spacing-3xs` | 2px |
| `--elements-spacing-2xs` | 4px |
| `--elements-spacing-xs` | 8px |
| `--elements-spacing-sm` | 12px |
| `--elements-spacing-md` | 16px |
| `--elements-spacing-lg` | 20px |
| `--elements-spacing-xl` | 24px |
| `--elements-spacing-2xl` | 32px |
| `--elements-spacing-3xl` | 40px |
| `--elements-spacing-4xl` | 48px |
| `--elements-spacing-5xl` | 64px |
| `--elements-spacing-6xl` | 128px |

## Colors

### Semantic Text
- `--elements-color-semantic-text-default` - Primary text
- `--elements-color-semantic-text-inverse` - Text on dark backgrounds
- `--elements-color-semantic-text-subtle` - Secondary/muted text
- `--elements-color-semantic-text-accent-default` - Accent text (links, highlights)
- `--elements-color-semantic-text-accent-hover` - Accent text hover
- `--elements-color-semantic-text-disabled` - Disabled text
- `--elements-color-semantic-text-error` - Error messages
- `--elements-color-semantic-text-success` - Success messages

### Semantic Background
- `--elements-color-semantic-background-default` - Page/card background
- `--elements-color-semantic-background-subtle` - Subtle/secondary background
- `--elements-color-semantic-background-brand` - Brand-colored background
- `--elements-color-semantic-background-inverse` - Dark background
- `--elements-color-semantic-background-disabled` - Disabled state
- `--elements-color-semantic-background-error` - Error background
- `--elements-color-semantic-background-success` - Success background

### Semantic Border
- `--elements-color-semantic-border-default` - Default borders
- `--elements-color-semantic-border-subtle` - Subtle borders
- `--elements-color-semantic-border-inverse` - Borders on dark
- `--elements-color-semantic-border-disabled` - Disabled borders
- `--elements-color-semantic-border-error` - Error borders
- `--elements-color-semantic-border-success` - Success borders

### Semantic Accent (interactive elements)
- `--elements-color-semantic-accent-default` - Default accent
- `--elements-color-semantic-accent-hover` - Hover state
- `--elements-color-semantic-accent-active` - Active/pressed state
- `--elements-color-semantic-accent-disabled` - Disabled accent
- `--elements-color-semantic-accent-focus` - Focus ring color

### Core Neutrals
`--elements-color-core-neutral-white`, `-black`, `-50` through `-950`

### Core Brand
`--elements-color-core-brand-lightest`, `-lighter`, `-light`, `-base`, `-dark`, `-darker`, `-darkest`

### Core Status
- Blue: `--elements-color-core-blue-50` through `-950`
- Green: `--elements-color-core-green-50` through `-950`
- Red: `--elements-color-core-red-50` through `-950`
- Yellow: `--elements-color-core-yellow-50` through `-950`
- Orange: `--elements-color-core-orange-50` through `-950`

### Data Visualization
12 palettes, each with `-50` through `-950` shades:
`data-blue`, `data-brown`, `data-cyan`, `data-green`, `data-indigo`, `data-mint`, `data-neutral`, `data-orange`, `data-pink`, `data-purple`, `data-red`, `data-teal`

```scss
.chart-1 { fill: var(--elements-color-core-data-blue-500); }
.chart-2 { fill: var(--elements-color-core-data-green-500); }
```

## Typography

### Font Families
- `--elements-font-family-sans` (Sanofi Sans)
- `--elements-font-family-serif` (Sanofi Serif)

### Font Sizes
| Token | Pixels |
|-------|--------|
| `--elements-font-size-100` | 12px |
| `--elements-font-size-200` | 14px |
| `--elements-font-size-300` | 16px |
| `--elements-font-size-400` | 18px |
| `--elements-font-size-500` | 20px |
| `--elements-font-size-600` | 24px |
| `--elements-font-size-700` | 28px |
| `--elements-font-size-800` | 32px |
| `--elements-font-size-900` | 36px |
| `--elements-font-size-1000` | 40px |
| `--elements-font-size-1100` | 48px |
| `--elements-font-size-1200` | 56px |
| `--elements-font-size-1300` | 64px |
| `--elements-font-size-1400` | 72px |
| `--elements-font-size-1500` | 80px |

### Font Weights
- `--elements-font-weight-light` (300)
- `--elements-font-weight-regular` (400)
- `--elements-font-weight-bold` (700)

### Line Heights
`--elements-font-lineheight-1` (1rem) through `--elements-font-lineheight-11` (5.5rem)

## Motion

### Durations
| Token | Value |
|-------|-------|
| `--elements-motion-duration-75` | 75ms |
| `--elements-motion-duration-150` | 150ms |
| `--elements-motion-duration-300` | 300ms |
| `--elements-motion-duration-500` | 500ms |

### Easing
| Token | Value |
|-------|-------|
| `--elements-motion-ease-linear` | linear |
| `--elements-motion-ease-in` | cubic-bezier(1, 0, 0.8, 1) |
| `--elements-motion-ease-out` | cubic-bezier(0.2, 0, 0, 1) |
| `--elements-motion-ease-in-out` | cubic-bezier(0.8, 0, 0.2, 1) |

```scss
transition: opacity var(--elements-motion-duration-150) var(--elements-motion-ease-out);
```

## Borders

### Widths
- `--elements-shape-borderwidth-fine` (0.5px)
- `--elements-shape-borderwidth-thin` (1px)
- `--elements-shape-borderwidth-regular` (1.5px)

### Radius
| Token | Value |
|-------|-------|
| `--elements-radius-none` | 0px |
| `--elements-radius-sm` | 4px |
| `--elements-radius-md` | 8px |
| `--elements-radius-lg` | 12px |
| `--elements-radius-xl` | 16px |
| `--elements-radius-rounded` | 9999px |

```scss
border: var(--elements-shape-borderwidth-thin) solid var(--elements-color-semantic-border-default);
border-radius: var(--elements-radius-md);
```

## SCSS Mixins

Import with: `@use "@sanofi-accelerator/elements/src/styles/mixins";`

### focus-ring
```scss
.element:focus-visible {
  @include mixins.focus-ring;
  // Optional params: @include mixins.focus-ring($width, $offset);
}
```

### breakpoint
```scss
@include breakpoints.breakpoint(md) { /* md and up */ }
@include breakpoints.breakpoint(mobile) { /* mobile */ }
@include breakpoints.breakpoint(tablet) { /* tablet */ }
@include breakpoints.breakpoint(desktop) { /* desktop */ }
```

## RTL (Logical Properties)

| Physical (never) | Logical (always) |
|-------------------|-------------------|
| `margin-left` | `margin-inline-start` |
| `margin-right` | `margin-inline-end` |
| `padding-left` | `padding-inline-start` |
| `padding-right` | `padding-inline-end` |
| `left` | `inset-inline-start` |
| `right` | `inset-inline-end` |
| `text-align: left` | `text-align: start` |
| `text-align: right` | `text-align: end` |

Shorthand: `padding-inline`, `margin-inline`, `padding-block`, `margin-block`.
