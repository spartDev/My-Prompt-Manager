import { getSoftBadgeColors, SOFT_BADGE_ALPHA } from '../theme/categoryChip';

/** A Pack's colors in one theme */
export interface PackShade {
  /** The name and the number of Prompts of a selected Pack, on its tint */
  readonly text: string;
  /** Its dot, and the border and the check round of a selected Pack */
  readonly mark: string;
}

export interface PackColors {
  /** The fill of a selected Pack, a CSS color: the Category chip's tint, opaque over bg-card in both themes */
  readonly tint: string;
  readonly light: PackShade;
  readonly dark: PackShade;
}

/**
 * A Pack's colors, derived from its color, user data: a Pack becomes a Category of that color, so
 * it is drawn by the Category chip rule (src/theme/categoryChip.ts). The tint is the chip's, the
 * color at 13%, mixed over bg-card so that it is opaque and fades in like a color; the text is the
 * chip's text, which the rule keeps at 4.5:1 on that tint. The mark is the color itself in light; in
 * dark, the color lifted toward white as the chip's text is, as the dark mockup lifts it, so that it
 * stands out from the dark frame and the tint and bears a dark check glyph (text-on-pack-check).
 */
export const packColors = (color: string): PackColors => {
  const light = getSoftBadgeColors(color, 'light');
  const dark = getSoftBadgeColors(color, 'dark');
  return {
    tint: `color-mix(in srgb, ${color} ${String(Math.round(SOFT_BADGE_ALPHA * 100))}%, var(--background-color-card))`,
    light: { text: light.text, mark: color },
    dark: { text: dark.text, mark: dark.text }
  };
};
