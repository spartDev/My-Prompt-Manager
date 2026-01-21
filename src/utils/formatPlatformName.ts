/**
 * Known platform display names mapping
 */
const PLATFORM_DISPLAY_NAMES: Record<string, string> = {
  claude: 'Claude',
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  perplexity: 'Perplexity',
  copilot: 'Copilot',
  mistral: 'Mistral',
  m365copilot: 'M365 Copilot',
  custom: 'Custom Site'
};

/**
 * Maximum length for platform display names before truncation
 */
const MAX_PLATFORM_NAME_LENGTH = 12;

/**
 * Extracts the subdomain from a hostname
 * e.g., "concierge.sanofi.com" -> "concierge"
 * e.g., "claude.ai" -> "claude"
 */
function extractSubdomain(hostname: string): string {
  const parts = hostname.split('.');
  return parts[0] || hostname;
}

/**
 * Capitalizes the first letter of a string
 */
function capitalizeFirst(str: string): string {
  if (!str) {
    return str;
  }
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Truncates a string to the maximum length with ellipsis
 */
function truncateWithEllipsis(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 1) + '…';
}

/**
 * Formats a platform name for display in the UI
 *
 * - Known platforms (claude, chatgpt, etc.) return their display name
 * - Unknown hostnames extract the subdomain and capitalize it
 * - Long names are truncated with ellipsis
 *
 * @example
 * formatPlatformName('claude') // 'Claude'
 * formatPlatformName('concierge.sanofi.com') // 'Concierge'
 * formatPlatformName('verylongsubdomain.example.com') // 'Verylongsub…'
 */
export function formatPlatformName(name: string): string {
  // Check for known platform first
  const knownName = PLATFORM_DISPLAY_NAMES[name.toLowerCase()];
  if (knownName) {
    return knownName;
  }

  // Extract subdomain if it looks like a hostname
  const displayName = name.includes('.')
    ? capitalizeFirst(extractSubdomain(name))
    : capitalizeFirst(name);

  // Truncate if too long
  return truncateWithEllipsis(displayName, MAX_PLATFORM_NAME_LENGTH);
}
