/**
 * Category colors (My-Prompt-Manager-el4.2): the preset palette and the soft chip rule.
 * Expected chip colors are the output of the reference canvas of epic My-Prompt-Manager-el4 (run as is).
 */

import { describe, expect, it } from 'vitest';

import { getColorName, getContrastRatio, getSoftBadgeColors, PRESET_COLORS } from '../colors';

// The Library card the chips render on: bg-card
const CARD = { light: '#FFFFFF', dark: '#231C34' } as const;

/** The chip background as it renders: its translucent color composited over the card */
const onCard = (background: string, mode: 'light' | 'dark'): string => {
  const [r, g, b, alpha] = (/^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/.exec(background) ?? []).slice(1).map(Number);
  const card = [1, 3, 5].map(i => parseInt(CARD[mode].substring(i, i + 2), 16));
  return `#${[r, g, b].map((channel, i) => Math.round(card[i] + (channel - card[i]) * alpha).toString(16).padStart(2, '0')).join('')}`;
};

// Chip text of each preset, from the reference canvas: light = channels x 0.72 (x 0.45 when the
// color's luminance is over 0.3, Yellow only), dark = 62% color + 38% white. No preset needs the safety net.
const PRESET_CHIP_TEXT: Array<[name: string, color: string, light: string, dark: string]> = [
  ['Blue', '#2563EB', '#1B47A9', '#789EF3'],
  ['Sky', '#0369A1', '#024C74', '#63A2C5'],
  ['Indigo', '#4F46E5', '#3932A5', '#928CEF'],
  ['Purple', '#9333EA', '#6A25A8', '#BC81F2'],
  ['Pink', '#DB2777', '#9E1C56', '#E979AB'],
  ['Rose', '#E11D48', '#A21534', '#EC738E'],
  ['Amber', '#D97706', '#9C5604', '#E7AB65'],
  ['Lime', '#4D7C0F', '#37590B', '#91AE6A'],
  ['Teal', '#0F766E', '#0B554F', '#6AAAA5'],
  ['Orange', '#C2410C', '#8C2F09', '#D98968'],
  ['Yellow', '#EAB308', '#695104', '#F2D066'],
  ['Slate', '#475569', '#333D4C', '#8D96A2']
];

describe('Category chip', () => {
  it.each(PRESET_CHIP_TEXT)('%s (%s) takes the formula text in both modes', (_name, color, light, dark) => {
    expect(getSoftBadgeColors(color, 'light').text).toBe(light);
    expect(getSoftBadgeColors(color, 'dark').text).toBe(dark);
  });

  it('has the Category color at 13% as background, the same in both modes', () => {
    expect(getSoftBadgeColors('#2563EB', 'light').background).toBe('rgba(37, 99, 235, 0.13)');
    expect(getSoftBadgeColors('#2563EB', 'dark').background).toBe('rgba(37, 99, 235, 0.13)');
  });

  describe.each(['light', 'dark'] as const)('on the Library card, %s mode', (mode) => {
    it.each(PRESET_CHIP_TEXT)('%s (%s) reads at 4.5:1 or more', (_name, color) => {
      const { background, text } = getSoftBadgeColors(color, mode);
      expect(getContrastRatio(text, onCard(background, mode))).toBeGreaterThanOrEqual(4.5);
    });

    // Colors that left the palette, still stored by existing Categories, go through the same rule
    it.each(['#1E40AF', '#F59E0B', '#DC2626', '#6B7280', '#78716C', '#71717A', '#7C3AED', '#15803D', '#047857'])(
      'former preset %s reads at 4.5:1 or more',
      (color) => {
        const { background, text } = getSoftBadgeColors(color, mode);
        expect(getContrastRatio(text, onCard(background, mode))).toBeGreaterThanOrEqual(4.5);
      }
    );
  });

  // Navy (#1E40AF), a former preset, reads at 4.53:1 on bg-card without the net
  it.each([
    ['#000000', '#858585'],
    ['#1A1A2E', '#8B8B96']
  ])('lightens the dark-mode text of %s until it reads at 4.5:1', (color, corrected) => {
    const { background, text } = getSoftBadgeColors(color, 'dark');
    expect(text).toBe(corrected);
    expect(getContrastRatio(text, onCard(background, 'dark'))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('Category palette', () => {
  it('offers the 12 colors of the palette, in order', () => {
    expect(PRESET_COLORS.map(color => color.value)).toEqual([
      '#2563EB', // Blue
      '#0369A1', // Sky
      '#4F46E5', // Indigo
      '#9333EA', // Purple
      '#DB2777', // Pink
      '#E11D48', // Rose
      '#D97706', // Amber
      '#4D7C0F', // Lime
      '#0F766E', // Teal
      '#C2410C', // Orange
      '#EAB308', // Yellow
      '#475569' // Slate
    ]);
  });

  it('names a color that left the palette Custom, so a Category keeps its stored color', () => {
    for (const color of ['#1E40AF', '#F59E0B', '#DC2626', '#6B7280', '#78716C', '#71717A', '#7C3AED', '#15803D', '#047857']) {
      expect(getColorName(color), color).toBe('Custom');
    }
    expect(getColorName('#D97706')).toBe('Amber');
  });
});
