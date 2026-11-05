import type { FC } from 'react';

interface IconProps {
  className?: string;
}

/**
 * Library Icon - 2x2 grid of rounded squares
 * Used for the Library tab
 */
export const LibraryTabIcon: FC<IconProps> = ({ className = 'w-6 h-6' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
  </svg>
);

/**
 * Categories Icon - Price tag
 * Used for the Categories tab
 */
export const CategoriesTabIcon: FC<IconProps> = ({ className = 'w-6 h-6' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4v6.17a2 2 0 00.59 1.42l8.82 8.82a2 2 0 002.83 0l5.17-5.17a2 2 0 000-2.83L11.59 3.59A2 2 0 0010.17 3H4a1 1 0 00-1 1z" />
    <circle cx="7.5" cy="7.5" r="1.5" />
  </svg>
);

/**
 * Analytics Icon - Three vertical bars
 * Used for the Analytics tab
 */
export const AnalyticsTabIcon: FC<IconProps> = ({ className = 'w-6 h-6' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" d="M6 20v-6M12 20V4M18 20v-9" />
  </svg>
);

/**
 * Settings Icon - Two sliders
 * Used for the Settings tab
 */
export const SettingsTabIcon: FC<IconProps> = ({ className = 'w-6 h-6' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="8" cy="17" r="2" />
  </svg>
);
