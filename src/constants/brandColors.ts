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
 * Disabled state shared by every site, Platform or custom: it is not brand data
 */
const DISABLED_STATE = 'bg-muted text-tertiary';

/**
 * Enabled colors of a custom or unrecognized site
 */
const DEFAULT_ENABLED = 'bg-accent-subtle text-accent';

/**
 * Get brand colors for a given hostname
 *
 * @param hostname - The platform hostname (e.g., 'claude.ai')
 * @returns The platform's brand color when enabled (the accent for custom sites), and the shared disabled state
 */
export const getBrandColors = (hostname: string): BrandColorScheme => {
  const platform = getPlatformByHostname(hostname);
  return {
    enabled: platform?.brandColors?.enabled ?? DEFAULT_ENABLED,
    disabled: DISABLED_STATE
  };
};

