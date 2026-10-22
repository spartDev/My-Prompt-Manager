/**
 * Predefined color palettes for category management
 */

import * as Logger from '../utils/logger';

export interface ColorOption {
  name: string;
  value: string;
  textColor?: string; // For ensuring good contrast
}

// The 12 Category colors (epic My-Prompt-Manager-el4), the same in light and dark: no two of them
// look alike as chips, and none looks like the accent. textColor is the checkmark drawn on the swatch.
// Colors removed from this list stay valid: a Category keeps its stored color and shows it as Custom.
export const PRESET_COLORS: ColorOption[] = [
  { name: 'Ocean Blue', value: '#2563EB', textColor: '#FFFFFF' }, // blue-600: 5.17:1
  { name: 'Sky Blue', value: '#0369A1', textColor: '#FFFFFF' }, // sky-700: 5.93:1
  { name: 'Indigo', value: '#4F46E5', textColor: '#FFFFFF' }, // indigo-600: 6.29:1
  { name: 'Purple', value: '#9333EA', textColor: '#FFFFFF' }, // purple-600: 5.38:1
  { name: 'Pink', value: '#DB2777', textColor: '#FFFFFF' }, // pink-600: 4.60:1
  { name: 'Rose', value: '#E11D48', textColor: '#FFFFFF' }, // rose-600: 4.70:1
  { name: 'Amber', value: '#D97706', textColor: '#000000' }, // amber-600: 6.59:1 with black
  { name: 'Lime', value: '#4D7C0F', textColor: '#FFFFFF' }, // lime-700: 4.99:1
  { name: 'Teal', value: '#0F766E', textColor: '#FFFFFF' }, // teal-700: 5.47:1
  { name: 'Orange', value: '#C2410C', textColor: '#FFFFFF' }, // orange-700: 5.18:1
  { name: 'Yellow', value: '#EAB308', textColor: '#000000' }, // yellow-500: 10.95:1 with black
  { name: 'Slate', value: '#475569', textColor: '#FFFFFF' }, // slate-600: 7.58:1
];

// Default color for new categories (WCAG AA compliant)
export const DEFAULT_CATEGORY_COLOR = '#2563EB';

// Function to get a random color from the palette
export const getRandomPresetColor = (): string => {
  const randomIndex = Math.floor(Math.random() * PRESET_COLORS.length);
  return PRESET_COLORS[randomIndex].value;
};

// Function to validate hex color
export const isValidHexColor = (color: string): boolean => {
  const hexColorRegex = /^#[0-9A-F]{6}$/i;
  return hexColorRegex.test(color);
};

/**
 * Calculate relative luminance per WCAG 2.1 specification
 * https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
 */
export const getRelativeLuminance = (hexColor: string): number => {
  // GUARD: Validate input hex color format
  if (!isValidHexColor(hexColor)) {
    Logger.warn('Invalid hex color provided to getRelativeLuminance', {
      component: 'colors',
      value: hexColor
    });
    return 0.5; // Safe fallback: mid-range luminance
  }

  // Remove # if present
  const hex = hexColor.replace('#', '');

  // Convert to RGB using .substring() (not deprecated .substr())
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  // GUARD: Validate parsed RGB values
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    Logger.error('Failed to parse hex color to RGB', new Error('Invalid RGB values'), {
      component: 'colors',
      hex: hexColor,
      rgb: { r, g, b }
    });
    return 0.5; // Safe fallback
  }

  // Apply gamma correction per WCAG formula
  const [rLinear, gLinear, bLinear] = [r, g, b].map(component =>
    component <= 0.03928
      ? component / 12.92
      : Math.pow((component + 0.055) / 1.055, 2.4)
  );

  // Calculate relative luminance
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
};

/**
 * Calculate contrast ratio between two colors per WCAG 2.1
 * Formula: (L1 + 0.05) / (L2 + 0.05) where L1 is lighter and L2 is darker
 * Returns value between 1 (no contrast) and 21 (maximum contrast)
 */
export const getContrastRatio = (color1: string, color2: string): number => {
  const lum1 = getRelativeLuminance(color1);
  const lum2 = getRelativeLuminance(color2);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
};

/**
 * Check if color combination meets WCAG standards
 * @param foreground - Foreground (text) color
 * @param background - Background color
 * @param level - 'AA' or 'AAA' compliance level (default: 'AA')
 * @param largeText - Whether text is large (18pt+ or 14pt+ bold) (default: false)
 * @returns true if combination meets the specified standard
 */
export const meetsWCAGStandard = (
  foreground: string,
  background: string,
  level: 'AA' | 'AAA' = 'AA',
  largeText: boolean = false
): boolean => {
  const ratio = getContrastRatio(foreground, background);

  if (level === 'AAA') {
    return largeText ? ratio >= 4.5 : ratio >= 7;
  } else {
    // AA standard
    return largeText ? ratio >= 3 : ratio >= 4.5;
  }
};

/**
 * Get accessible text color for a given background with WCAG AA compliance
 * @param backgroundColor - Background color in hex format
 * @param lightText - Light text color option (default: white)
 * @param darkText - Dark text color option (default: black)
 * @returns The text color that provides better contrast (prioritizes meeting WCAG AA)
 */
export const getAccessibleTextColor = (
  backgroundColor: string,
  lightText: string = '#FFFFFF',
  darkText: string = '#000000'
): string => {
  // GUARD: Validate input hex color format
  if (!isValidHexColor(backgroundColor)) {
    Logger.warn('Invalid hex color provided to getAccessibleTextColor', {
      component: 'colors',
      value: backgroundColor
    });
    return darkText; // Safe default: black text
  }

  // Calculate contrast for both options
  const contrastLight = getContrastRatio(lightText, backgroundColor);
  const contrastDark = getContrastRatio(darkText, backgroundColor);

  // Prefer the option that provides better contrast
  // This ensures maximum readability
  return contrastLight >= contrastDark ? lightText : darkText;
};

/**
 * Get contrasting text color (simple version - backward compatibility)
 * @deprecated Use getAccessibleTextColor() for WCAG-compliant results
 */
export const getContrastingTextColor = (hexColor: string): string => {
  // GUARD: Validate input hex color format
  if (!isValidHexColor(hexColor)) {
    Logger.warn('Invalid hex color provided to getContrastingTextColor', {
      component: 'colors',
      value: hexColor
    });
    return '#000000'; // Safe default: black text
  }

  // Remove # if present
  const hex = hexColor.replace('#', '');

  // Convert to RGB using .substring() (not deprecated .substr())
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // GUARD: Validate parsed RGB values
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    Logger.error('Failed to parse hex color to RGB', new Error('Invalid RGB values'), {
      component: 'colors',
      hex: hexColor,
      rgb: { r, g, b }
    });
    return '#000000'; // Safe default
  }

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return white for dark colors, black for light colors
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
};

// Function to lighten or darken a color
export const adjustColorBrightness = (hexColor: string, percent: number): string => {
  // GUARD: Validate input hex color format
  if (!isValidHexColor(hexColor)) {
    Logger.warn('Invalid hex color provided to adjustColorBrightness', {
      component: 'colors',
      value: hexColor,
      percent
    });
    return hexColor; // Return as-is, don't attempt adjustment
  }

  // Remove # if present
  const hex = hexColor.replace('#', '');

  // Convert to RGB using .substring() (not deprecated .substr())
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // GUARD: Validate parsed RGB values
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    Logger.error('Failed to parse hex color for brightness adjustment', new Error('Invalid RGB values'), {
      component: 'colors',
      hex: hexColor,
      rgb: { r, g, b }
    });
    return hexColor; // Safe fallback: return original
  }

  // Adjust brightness
  const adjust = (value: number) => {
    const adjusted = value + (value * percent / 100);
    return Math.min(255, Math.max(0, Math.round(adjusted)));
  };

  const newR = adjust(r);
  const newG = adjust(g);
  const newB = adjust(b);

  // Convert back to hex
  const toHex = (value: number) => value.toString(16).padStart(2, '0');

  return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`.toUpperCase();
};

// The Library card the soft badge renders on (white / gray-800). The badge background is translucent,
// so the safety net must measure on this surface; switch dark to bg-card (#231C34) with the card itself
const SOFT_BADGE_SURFACES = { light: '#FFFFFF', dark: '#1E2939' } as const;
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
  const color = isValidHexColor(hexColor) ? hexColor : DEFAULT_CATEGORY_COLOR;
  const background = `rgba(${hexChannels(color).join(', ')}, ${String(SOFT_BADGE_ALPHA)})`;
  const backgroundOnCard = mixHexColors(SOFT_BADGE_SURFACES[mode], color, SOFT_BADGE_ALPHA);
  const target = mode === 'light' ? '#000000' : '#FFFFFF';

  let text = mode === 'light'
    ? scaleHexColor(color, getRelativeLuminance(color) > 0.3 ? 0.45 : 0.72)
    : mixHexColors(color, '#FFFFFF', 0.38);
  for (let step = 0; step < 60 && getContrastRatio(text, backgroundOnCard) < 4.5; step++) {
    text = mixHexColors(text, target, 0.05);
  }
  return { background, text };
};

// Get color name from preset or return "Custom"
export const getColorName = (hexColor: string): string => {
  const preset = PRESET_COLORS.find(c => c.value.toLowerCase() === hexColor.toLowerCase());
  return preset ? preset.name : 'Custom';
};