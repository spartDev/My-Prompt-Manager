<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Sanofi M&S Design System - Tokens & Rules

Source of truth: `sanofi-brand-reference.html` (confirmed Sanofi Communication team).

---

## 1. Brand rule (non-negotiable)

Presentations = **communication material** → **primary color Violet `#7A00E6`**.
Blue `#0047BB` is allowed as a secondary accent only (e.g. for a digital-product-specific element within a slide).

---

## 2. CSS token reference

> The canonical `:root` token block lives in `assets/presentation.template.md` — copy it from there. The table below documents what each token is for (the role descriptions the template doesn't carry). Do not re-paste the values here: the template is the single source of truth.

| Token | Role |
|---|---|
| `--violet` | primary brand color - all comms |
| `--violet-light` | hero highlights, em text |
| `--violet-dark` | hover states |
| `--violet-hero` | hero/closing bg only |
| `--violet-bg` | card backgrounds, tinted sections |
| `--violet-border` | borders on tinted bg |
| `--violet-mid` | eyebrow on dark bg |
| `--blue` | digital/web secondary |
| `--blue-light` | interactive on dark bg |
| `--blue-bg` | tinted blue surface |
| `--blue-border` | borders on blue bg |
| `--black` | headings, hero bg |
| `--text` | body text |
| `--text-2` | secondary body |
| `--muted` | captions, disabled |
| `--border` | borders |
| `--surface` | slide bg |
| `--tint` | tinted slide bg |
| `--white` | white |
| `--stage` | centered-stage max content width (full-screen engine) |
| `--success` / `--success-bg` | success state + background |
| `--warning` / `--warning-bg` | warning state + background |
| `--danger` / `--danger-bg` | danger state + background |
| `--font` | DM Sans body/headings stack |
| `--mono` | DM Mono numbers/dates stack |

---

## 3. Typography

| Role | Size | Weight | Spacing |
|---|---|---|---|
| Hero h1 | `clamp(44px, 6vw, 80px)` | 800 | −2px |
| Divider h2 | `clamp(38px, 5vw, 68px)` | 800 | −2px |
| Slide h2 | `clamp(30px, 3.4vw, 46px)` | 800 | −1px |
| Eyebrow | 11px | 700 | +2px uppercase |
| Card title | 16px | 700 | −0.2px |
| Body | 14-16px | 400 | - |
| Caption | 12-13px | 400 | - |
| Mono / numbers | 12-28px | 500-800 | varies |

**H2 rule**: always one word in `<span style="color:var(--violet)">` for visual rhythm.
**Eyebrow rule**: always precedes H2 on content slides, with its 16×2px violet bar.

---

## 4. Do / Don't

**Always**
- `#7A00E6` as primary accent on all comms
- `DM Sans` body/headings + `DM Mono` numbers/dates
- One violet-highlighted word in every h2
- `#14002D` only for hero/closing/dark scenario headers
- Mono font for all numbers, stats, KPIs, dates
- Vary slide patterns - never 3+ of the same type in a row
- Max 60 words of body copy per slide

**Never**
- Any hex color outside the token list above
- Inter, Roboto, or any non-DM Sans/DM Mono font
- Blue as primary deck color
- Pure `#000000` or `#ffffff` as background
- Gradients using colors outside the token palette
- Underline for emphasis (use bold or violet color)
- Tables wider than 4 columns on a slide
