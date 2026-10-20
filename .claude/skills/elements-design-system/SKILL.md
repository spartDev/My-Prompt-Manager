---
name: elements-design-system
description: >
  Build apps and websites using Sanofi's Elements Design System (@sanofi-accelerator/elements).
  Use this skill when the user asks to create a web application, website, landing page,
  dashboard, form page, or any UI using the Elements Design System. Triggers on "build an app",
  "create a page", "make a website", "landing page", "dashboard", "form page", "use Elements",
  "Elements Design System", or when the project imports from @sanofi-accelerator/elements.
  Key capabilities: runtime component discovery from node_modules (adapts to any installed
  version), design token enforcement, responsive layout, and page pattern scaffolding.
  Do NOT use for general frontend work without the Elements package.
---

<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Elements App Builder

Build production-grade apps and websites with the Elements Design System.

## Critical Rules

| Never | Always |
|-------|--------|
| Assume component availability | Run `scripts/discover-elements.sh` first — prefer the introspect CLI when it reports available |
| `<h1>`-`<h6>`, `<p>`, `<span>` | `<Title>`, `<Typography>` with variant enums |
| `color: #000`, `padding: 16px` | `var(--elements-color-semantic-*)`, `var(--elements-spacing-*)` |
| `font-weight: 600`, `font-size: 14px` | `var(--elements-font-weight-bold)`, `var(--elements-font-size-200)` |
| `border-radius: 4px` | `var(--elements-radius-sm)` |
| `border: 1px solid` | `var(--elements-shape-borderwidth-thin) solid` |
| `transition: 0.3s ease` | `var(--elements-motion-duration-300) var(--elements-motion-ease-out)` |
| `box-shadow` with `rgba()` or hex | `border` with semantic tokens (no shadow tokens exist) |
| `margin-left`, `padding-right` | `margin-inline-start`, `padding-inline-end` |
| Import from subpaths | Import from package root only |

## Gotchas

These are the most common failure points. Internalize before writing Elements code.

1. **Enum values, not strings**: Elements uses TypeScript enums. Write `ButtonVariant.PRIMARY` not `"primary"`, `TitleVariant.TITLE_1` not `"h1"`. When the introspect CLI is available, `enum <EnumName>` gives the exact members for the installed version; otherwise read the type definitions.

2. **Title renders as `<span>` by default**: Use the `as` prop for semantic HTML: `<Title as="h2" variant={TitleVariant.TITLE_2}>`. Without `as`, screen readers miss heading structure.

3. **ThemeProvider is not optional**: Every component requires `<ThemeProvider appTheme={AppTheme.SANOFI}>` as ancestor. In v3.50.0+, styles are auto-injected via `vite-plugin-lib-inject-css` and the `dist/styles.css` import is no longer needed (the file itself says it can safely be removed). On older versions, `import "@sanofi-accelerator/elements/dist/styles.css"` in the app entry was required; missing it produced unstyled components with no error.

4. **Components vary by version**: Never assume a component exists. A team on v1.x may not have `ProgressStepper`. Always discover from `node_modules` first — `components` via the introspect CLI is definitive. If missing, recommend installing or upgrading before suggesting alternatives.

5. **Zero hardcoded CSS values**: Never use inline `style={}` or raw numbers in `.module.scss`. Use `.module.scss` files with `var(--elements-*)` tokens for ALL values — spacing, colors, font sizes, font weights, border widths, radii, and motion. Common violations: `font-weight: 600` (use `var(--elements-font-weight-bold)`), `max-width: 1200px` (use `Container` component instead), `border: 1px solid` (use `var(--elements-shape-borderwidth-thin) solid`), `box-shadow` with `rgba()` (use `border` with semantic border tokens instead — Elements has no shadow tokens). If you need a CSS value, it MUST exist in the token reference. Never invent token names — only these token prefixes exist: `--elements-spacing-`, `--elements-color-`, `--elements-font-`, `--elements-radius-`, `--elements-shape-`, `--elements-motion-`. Token suffixes are documented in [references/design-tokens.md](references/design-tokens.md).

6. **Elements over third-party**: Before reaching for `@mui/material`, `chakra-ui`, or any third-party UI library, check if Elements has the component. The ecosystem spans 4 packages — core, charts, table, editor.

7. **Logical properties for RTL**: All positional CSS must use logical properties (`margin-inline-start` not `margin-left`). Elements supports RTL layouts.

## Workflow

### 1. Discover (MANDATORY)

Always start with the discovery script — it reports the installed packages and
which discovery tier is available:

```bash
bash '${CLAUDE_SKILL_DIR}'/scripts/discover-elements.sh [project-root]
```

Then take the highest tier it reports.

**Tier 1 — Introspection manifest (preferred).** The script prints
`Introspection manifest: AVAILABLE` plus the resolved
`elements-introspect` path. Resolve every component, prop, enum value, hook,
token and icon question with targeted CLI queries — compiler-resolved and exact
for the installed version. Procedure, commands and safety rules:
[references/introspect-cli.md](references/introspect-cli.md). Never `npx`.

**Tier 2 — Barrel exports.** The script prints
`Introspection manifest: NOT AVAILABLE` (version predates v3.50.0, or the bin is
missing). Use the categorized export lists it printed for availability, and read
the barrel files it reports (`node_modules/@sanofi-accelerator/{pkg}/dist/src/index.d.ts`)
for props and enum members. For tokens, grep `dist/assets/css/styles/theme-*.css`
for `--elements-` (since v3, `dist/styles.css` is a backward-compat stub with no
token definitions; the tokens live in the theme CSS files).
Mention once that upgrading unlocks typed introspection; do not block on it.

**Tier 3 — Static references.** No `node_modules` at all (script warns, or
cannot run): fall back to [references/components.md](references/components.md),
[references/design-tokens.md](references/design-tokens.md) and
[references/page-patterns.md](references/page-patterns.md) — and warn the user
that availability may differ from the installed version.

If the script itself cannot run, do Tier 2 by hand: find `package.json` (check
root, `frontend/`, `app/`, `src/`), read it for `@sanofi-accelerator/elements*`
dependencies and versions, then read each package's barrel `index.d.ts`.

The complete Elements ecosystem has exactly four packages:
- `@sanofi-accelerator/elements` — core UI components (the only one shipping the introspect CLI)
- `@sanofi-accelerator/elements-charts` — chart components
- `@sanofi-accelerator/elements-table` — table components
- `@sanofi-accelerator/elements-editor` — rich text editor components

If a needed package isn't installed, recommend `npm install @sanofi-accelerator/{pkg}` before third-party alternatives.

### 2. Build

Import only from packages confirmed in discovery. Use Elements design tokens for all styling. Follow existing project patterns.

Component selection priority: core package first → additional Elements packages (recommend installing if absent) → third-party as last resort (must still use Elements tokens for consistency).

For verified snippets when Tier 1 is available: `elements-introspect examples <Component>`
For component API patterns: [references/components.md](references/components.md)
For page composition examples: [references/page-patterns.md](references/page-patterns.md)
For token values when `node_modules` unavailable: [references/design-tokens.md](references/design-tokens.md)

### 3. Validate

1. All imports resolve to discovered packages.
2. No hardcoded styling values — only `--elements-*` CSS custom properties.
3. Semantic HTML, ARIA labels, keyboard support.
4. `npx tsc --noEmit` passes.

## Setup

```tsx
import { ThemeProvider, AppTheme } from "@sanofi-accelerator/elements";
// dist/styles.css auto-injected in v3.50.0+; safe to omit.
// On older versions, add: import "@sanofi-accelerator/elements/dist/styles.css";

const App = () => (
  <ThemeProvider appTheme={AppTheme.SANOFI}>
    {/* App content */}
  </ThemeProvider>
);
```

**Themes**: SANOFI, DUPIXENT, BEYFORTUS, ALTUVIIIO, VAXSERVE, VACCINESHOP, INTERNAL_TOOLS, and more.
**Dark mode**: `mode="dark"` or `mode="auto"` on ThemeProvider.
**Component branding**: `<Button brandTheme={BrandTheme.secondary} label="Action" />`

## Import Pattern

Always from package root — never from subpaths:

```tsx
import { Button, ButtonVariant, Title, TitleVariant } from "@sanofi-accelerator/elements";
// WRONG: from "@sanofi-accelerator/elements/dist/components/Button"
```

## CSS Modules

```scss
@use "@sanofi-accelerator/elements/src/styles/mixins";

.section {
  padding: var(--elements-spacing-xl);
  background-color: var(--elements-color-semantic-background-default);
  border-radius: var(--elements-radius-md);

  &:focus-visible {
    @include mixins.focus-ring;
  }
}
```

```tsx
import styles from "./my-section.module.scss";
import cn from "classnames";

<div className={cn(styles.section, styles[variant], className)}>
```

## Responsive Design

Elements breakpoints (use `useBreakpoint()` hook and `Grid.Item` breakpoint props):

| Size | Range |
|------|-------|
| xs | 0-414px |
| sm | 415-767px |
| md | 768-1279px |
| lg | 1280-1439px |
| xl | 1440-1919px |
| xxl | 1920-3839px |
| xxxl | 3840px+ |

## References

- **Introspection CLI procedure**: [references/introspect-cli.md](references/introspect-cli.md) — Tier 1; ground truth for the installed version
- **Component API patterns**: [references/components.md](references/components.md) — usage examples (verify availability via discovery)
- **Design token values**: [references/design-tokens.md](references/design-tokens.md) — fallback when `node_modules` unavailable
- **Page layout patterns**: [references/page-patterns.md](references/page-patterns.md) — landing page, dashboard, form, etc.
