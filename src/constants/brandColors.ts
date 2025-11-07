/**
 * Platform Brand Colors Configuration
 * 
 * Centralized configuration for platform-specific brand colors used in UI components.
 * This provides type-safe, maintainable color schemes for each supported platform.
 */

/**
 * Brand color scheme for platform UI elements
 */
export interface BrandColorScheme {
  /** CSS classes for enabled state */
  enabled: string;
  /** CSS classes for disabled state */
  disabled: string;
}

/**
 * Common disabled state used across all platforms
 */
const DISABLED_STATE = 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400';

/**
 * Default brand colors for custom sites (fallback)
 * Uses the original green gradient for custom/unrecognized platforms
 */
const DEFAULT_BRAND_COLORS: BrandColorScheme = {
  enabled: 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-sm',
  disabled: DISABLED_STATE
};

/**
 * Platform-specific brand color configurations
 * Maps hostnames to their brand color schemes
 */
export const PLATFORM_BRAND_COLORS: Record<string, BrandColorScheme> = {
  'www.perplexity.ai': {
    enabled: 'bg-[#2d808c] text-white shadow-sm',
    disabled: DISABLED_STATE
  },
  'claude.ai': {
    enabled: 'bg-[#d37354] text-white shadow-sm',
    disabled: DISABLED_STATE
  },
  'chatgpt.com': {
    enabled: 'bg-white text-gray-800 shadow-sm border border-gray-200',
    disabled: DISABLED_STATE
  },
  'chat.mistral.ai': {
    enabled: 'bg-gray-700 text-white shadow-sm',
    disabled: DISABLED_STATE
  },
  'gemini.google.com': {
    enabled: 'bg-white text-gray-800 shadow-sm border border-gray-200',
    disabled: DISABLED_STATE
  },
  'copilot.microsoft.com': {
    enabled: 'bg-[#0e111b] text-white shadow-sm',
    disabled: DISABLED_STATE
  }
};

/**
 * Get brand colors for a given hostname
 * 
 * @param hostname - The platform hostname (e.g., 'claude.ai')
 * @returns Brand color scheme for the platform, or default colors for custom sites
 */
export const getBrandColors = (hostname: string): BrandColorScheme => {
  return PLATFORM_BRAND_COLORS[hostname] ?? DEFAULT_BRAND_COLORS;
};

