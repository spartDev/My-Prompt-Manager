/**
 * The Category chip ("soft" badge) rule, shared by the popup (CategoryBadge) and the Prompt selector the
 * content script injects on Platforms. No logger and no other import, so the content bundle can take it.
 * The content chunk loads its shared chunks on every custom site: the chunk this module lands in must be
 * listed in manifest.json web_accessible_resources (guard: tests/e2e/content/custom-site-chunks.spec.ts).
 */

// Default color for new categories (WCAG AA compliant)
export const DEFAULT_CATEGORY_COLOR = '#2563EB';

const isHexColor = (color: string): boolean => /^#[0-9A-F]{6}$/i.test(color);

// The Library card the soft badge renders on (bg-card). The badge background is translucent, so the
// safety net must measure on this surface: change it with the card's background
const SOFT_BADGE_SURFACES = { light: '#FFFFFF', dark: '#231C34' } as const;
const SOFT_BADGE_ALPHA = 0.13;

const hexChannels = (hex: string): number[] =>
  [0, 2, 4].map(i => parseInt(hex.replace('#', '').substring(i, i + 2), 16));

const mixHexColors = (from: string, to: string, amount: number): string => {
  const [start, end] = [hexChannels(from), hexChannels(to)];
  const toHex = (value: number) => Math.round(value).toString(16).padStart(2, '0');
  return `#${start.map((channel, i) => toHex(channel + (end[i] - channel) * amount)).join('')}`.toUpperCase();
};

const scaleHexColor = (hexColor: string, factor: number): string =>
  mixHexColors('#000000', hexColor, factor);

/** WCAG 2.1 relative luminance of a valid #RRGGBB color */
const relativeLuminance = (hexColor: string): number => {
  const [r, g, b] = hexChannels(hexColor).map(channel => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG 2.1 contrast ratio of two valid #RRGGBB colors */
const contrastRatio = (first: string, second: string): number => {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
};

/**
 * Colors for the "soft" category badge: the category color at 13% opacity as background (the same
 * in both modes), and the category color as text: darkened in light mode (x 0.45 for a light color,
 * x 0.72 otherwise), mixed with 38% white in dark mode. A safety net keeps darkening (light) or
 * lightening (dark) in 5% steps while the text is under WCAG AA (4.5:1) on the tint over the card;
 * no preset color needs it.
 */
export const getSoftBadgeColors = (
  hexColor: string,
  mode: 'light' | 'dark'
): { background: string; text: string } => {
  const color = isHexColor(hexColor) ? hexColor : DEFAULT_CATEGORY_COLOR;
  const background = `rgba(${hexChannels(color).join(', ')}, ${String(SOFT_BADGE_ALPHA)})`;
  const backgroundOnCard = mixHexColors(SOFT_BADGE_SURFACES[mode], color, SOFT_BADGE_ALPHA);
  const target = mode === 'light' ? '#000000' : '#FFFFFF';

  let text = mode === 'light'
    ? scaleHexColor(color, relativeLuminance(color) > 0.3 ? 0.45 : 0.72)
    : mixHexColors(color, '#FFFFFF', 0.38);
  for (let step = 0; step < 60 && contrastRatio(text, backgroundOnCard) < 4.5; step++) {
    text = mixHexColors(text, target, 0.05);
  }
  return { background, text };
};
