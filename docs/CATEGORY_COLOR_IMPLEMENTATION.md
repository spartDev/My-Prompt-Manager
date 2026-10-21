# Category Colors

How a Category's color is offered, stored and drawn. Code: `src/constants/colors.ts`. Visual reference (light and dark side by side): the palette canvas linked from beads epic `My-Prompt-Manager-el4`.

Category colors are **user data, not tokens**: each Category stores one hex color, the same in both modes. The UI tokens of `src/theme/tokens.css` never depend on it (see [DESIGN_GUIDELINES.md](./DESIGN_GUIDELINES.md#color-system)).

---

## Preset palette

`PRESET_COLORS` offers 12 colors, in this order. No two of them look alike as chips, in light or dark, and none looks like the accent (`#6D28D9` / `#844BF2`).

| Name | Color | Name | Color |
|---|---|---|---|
| Ocean Blue | `#2563EB` | Amber | `#D97706` |
| Sky Blue | `#0369A1` | Lime | `#4D7C0F` |
| Indigo | `#4F46E5` | Teal | `#0F766E` |
| Purple | `#9333EA` | Orange | `#C2410C` |
| Pink | `#DB2777` | Yellow | `#EAB308` |
| Rose | `#E11D48` | Slate | `#475569` |

`textColor` is the checkmark drawn on a chosen swatch: white, or black on Amber and Yellow (4.5:1 or more on the swatch). `DEFAULT_CATEGORY_COLOR` is Ocean Blue.

**Stored colors are never migrated.** Nine colors left the presets in 2026-10 (Navy `#1E40AF`, Amber `#F59E0B`, Red `#DC2626`, Gray `#6B7280`, Stone `#78716C`, Zinc `#71717A`, Violet `#7C3AED`, Green `#15803D`, Emerald `#047857`): Violet looked like the accent, and Violet/Purple, Emerald/Teal and Emerald/Green were nearly indistinguishable as chips. A Category that uses one of them, or any custom color, keeps it: `getColorName` returns `Custom` and the color goes through the same chip rule.

---

## Chip rule

`getSoftBadgeColors(color, mode)` gives the colors of the soft chip (`<CategoryBadge variant="soft" />`, on Library cards). It works for any color, preset or custom.

| | Light | Dark |
|---|---|---|
| Background | the color at 13% opacity: `rgba(r, g, b, 0.13)` | same |
| Text | each channel × 0.45 when the color's relative luminance is over 0.3 (Yellow), × 0.72 otherwise | 62% color + 38% white |

**Safety net.** While the text is under 4.5:1 against the background composited over `bg-card` (`#FFFFFF` / `#231C34`, kept in `SOFT_BADGE_SURFACES`), the text keeps moving 5% toward black (light) or white (dark). None of the 12 presets triggers it: the lowest is Amber in light at 4.87:1. It corrects extreme custom colors, for example `#000000` in dark (`#616161`, 2.77:1, becomes `#858585`, 4.65:1).

`CategoryBadge` passes both modes' colors as CSS variables (`--badge-bg`, `--badge-fg`, `--badge-bg-dark`, `--badge-fg-dark`), so a chip switches theme with the `.dark` class like everything else.

---

## Tests

- `src/constants/__tests__/categoryPalette.test.ts`: the 12 presets in order; the expected chip text of each preset in both modes (the reference canvas's output); 4.5:1 on `bg-card` for the presets and the nine former presets; the safety net on `#000000` and `#1A1A2E`; `Custom` for a former preset.
- `tests/e2e/theme/category-chips.spec.ts`: the computed background and text of a chip on a Library card, light and dark, and proof screenshots of the Library chips and the color picker.

When `bg-card` changes in `src/theme/tokens.css`, update `SOFT_BADGE_SURFACES` and the `CARD` constant of `categoryPalette.test.ts`.
