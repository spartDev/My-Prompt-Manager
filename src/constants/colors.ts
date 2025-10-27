/**
 * Predefined color palettes for category management
 */

import * as Logger from '../utils/logger';

export interface ColorOption {
  name: string;
  value: string;
  textColor?: string; // For ensuring good contrast
}

// Modern, vibrant color palette optimized for both light and dark themes
export const PRESET_COLORS: ColorOption[] = [
  // Blues
  { name: 'Ocean Blue', value: '#3B82F6', textColor: '#FFFFFF' },
  { name: 'Sky Blue', value: '#0EA5E9', textColor: '#FFFFFF' },
  { name: 'Navy', value: '#1E40AF', textColor: '#FFFFFF' },
  
  // Purples & Pinks
  { name: 'Purple', value: '#9333EA', textColor: '#FFFFFF' },
  { name: 'Violet', value: '#8B5CF6', textColor: '#FFFFFF' },
  { name: 'Pink', value: '#EC4899', textColor: '#FFFFFF' },
  { name: 'Rose', value: '#F43F5E', textColor: '#FFFFFF' },
  
  // Greens
  { name: 'Emerald', value: '#10B981', textColor: '#FFFFFF' },
  { name: 'Green', value: '#22C55E', textColor: '#FFFFFF' },
  { name: 'Teal', value: '#14B8A6', textColor: '#FFFFFF' },
  
  // Warm colors
  { name: 'Orange', value: '#F97316', textColor: '#FFFFFF' },
  { name: 'Amber', value: '#F59E0B', textColor: '#000000' },
  { name: 'Yellow', value: '#EAB308', textColor: '#000000' },
  { name: 'Red', value: '#EF4444', textColor: '#FFFFFF' },
  
  // Neutrals
  { name: 'Gray', value: '#6B7280', textColor: '#FFFFFF' },
  { name: 'Slate', value: '#475569', textColor: '#FFFFFF' },
  { name: 'Stone', value: '#78716C', textColor: '#FFFFFF' },
  { name: 'Zinc', value: '#71717A', textColor: '#FFFFFF' },
];

// Default color for new categories
export const DEFAULT_CATEGORY_COLOR = '#3B82F6';

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

// Function to get contrasting text color (simple version)
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