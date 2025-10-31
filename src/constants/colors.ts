/**
 * Predefined color palettes for category management
 */

import { Logger } from '../utils';

export interface ColorOption {
  name: string;
  value: string;
  textColor?: string; // For ensuring good contrast
}

// Modern, vibrant color palette optimized for both light and dark themes
// All colors meet WCAG AA contrast requirements (4.5:1 minimum) with specified text colors
export const PRESET_COLORS: ColorOption[] = [
  // Blues
  { name: 'Ocean Blue', value: '#2563EB', textColor: '#FFFFFF' }, // blue-600: 5.17:1
  { name: 'Sky Blue', value: '#0369A1', textColor: '#FFFFFF' }, // sky-700: 5.95:1
  { name: 'Navy', value: '#1E40AF', textColor: '#FFFFFF' }, // blue-800: 8.72:1

  // Purples & Pinks
  { name: 'Purple', value: '#9333EA', textColor: '#FFFFFF' }, // purple-600: 5.38:1
  { name: 'Violet', value: '#7C3AED', textColor: '#FFFFFF' }, // violet-600: 5.70:1
  { name: 'Pink', value: '#DB2777', textColor: '#FFFFFF' }, // pink-600: 4.60:1
  { name: 'Rose', value: '#E11D48', textColor: '#FFFFFF' }, // rose-600: 4.70:1

  // Greens
  { name: 'Emerald', value: '#047857', textColor: '#FFFFFF' }, // emerald-700: 5.44:1
  { name: 'Green', value: '#15803D', textColor: '#FFFFFF' }, // green-700: 4.74:1
  { name: 'Teal', value: '#0F766E', textColor: '#FFFFFF' }, // teal-700: 5.35:1

  // Warm colors
  { name: 'Orange', value: '#C2410C', textColor: '#FFFFFF' }, // orange-700: 5.67:1
  { name: 'Amber', value: '#F59E0B', textColor: '#000000' }, // amber-500: 9.78:1 with black
  { name: 'Yellow', value: '#EAB308', textColor: '#000000' }, // yellow-500: 10.95:1 with black
  { name: 'Red', value: '#DC2626', textColor: '#FFFFFF' }, // red-600: 4.83:1

  // Neutrals
  { name: 'Gray', value: '#6B7280', textColor: '#FFFFFF' }, // gray-500: 4.83:1
  { name: 'Slate', value: '#475569', textColor: '#FFFFFF' }, // slate-600: 7.58:1
  { name: 'Stone', value: '#78716C', textColor: '#FFFFFF' }, // stone-500: 4.80:1
  { name: 'Zinc', value: '#71717A', textColor: '#FFFFFF' }, // zinc-500: 4.83:1
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

// Get color name from preset or return "Custom"
export const getColorName = (hexColor: string): string => {
  const preset = PRESET_COLORS.find(c => c.value.toLowerCase() === hexColor.toLowerCase());
  return preset ? preset.name : 'Custom';
};