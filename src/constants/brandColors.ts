/**
 * Platform Brand Colors Configuration
 * 
 * Centralized configuration for platform-specific brand colors used in UI components.
 * This provides type-safe, maintainable color schemes for each supported platform.
 * 
 * Brand colors are defined directly on PlatformDefinition.brandColors so that
 * each platform remains the single source of truth for its UI styling.
 */

import { getPlatformByHostname } from '../config/platforms';

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
  enabled: 'bg-linear-to-br from-green-500 to-emerald-600 text-white shadow-xs',
  disabled: DISABLED_STATE
};

/**
 * Get brand colors for a given hostname
 *
 * @param hostname - The platform hostname (e.g., 'claude.ai')
 * @returns Brand color scheme for the platform, or default colors for custom sites
 */
export const getBrandColors = (hostname: string): BrandColorScheme => {
  const platform = getPlatformByHostname(hostname);
  return platform?.brandColors ?? DEFAULT_BRAND_COLORS;
};

