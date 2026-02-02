import type { FC } from 'react';

/**
 * Logo Icon - Chat bubble with dots
 * Used in LibraryView header
 */
export const LogoIcon: FC = () => (
  <svg className="w-6 h-6 text-white" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path fill="currentColor" d="M5.09 8.48a1 1 0 0 0 .64-.28 1 1 0 0 0 .25-.67 1 1 0 0 0-.25-.68 1 1 0 0 0-.65-.27 1 1 0 0 0-.64.27 1 1 0 0 0-.26.68q.01.41.26.67a1 1 0 0 0 .64.28m3.98 0a1 1 0 0 0 .64-.28 1 1 0 0 0 .26-.67 1 1 0 0 0-.26-.68 1 1 0 0 0-.64-.27 1 1 0 0 0-.64.27 1 1 0 0 0-.26.68q0 .41.26.67a1 1 0 0 0 .64.28m3.82 0a1 1 0 0 0 .64-.28 1 1 0 0 0 .26-.67 1 1 0 0 0-.26-.68 1 1 0 0 0-.64-.27 1 1 0 0 0-.64.27 1 1 0 0 0-.26.68q0 .41.26.67a1 1 0 0 0 .64.28M0 17.28V1.44q0-.55.4-1Q.83 0 1.36 0h15.3q.53 0 .93.44.42.44.42.99v12.34q0 .55-.42.99-.4.43-.93.43H3.6l-2.45 2.6q-.32.32-.73.15-.42-.18-.42-.66m1.35-1.73 1.69-1.78h13.61V1.43H1.35zm0-14.13v14.13z"/>
  </svg>
);

/**
 * Add Icon - Plus symbol
 * Used in AddPromptForm header
 */
export const AddIcon: FC = () => (
  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

/**
 * Edit Icon - Pencil
 * Used in EditPromptForm header
 */
export const EditIcon: FC = () => (
  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

/**
 * Settings Icon - Gear
 * Used in SettingsView header
 */
export const SettingsIcon: FC = () => (
  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

/**
 * Analytics Icon - Bar chart
 * Used in AnalyticsTab header and ViewHeader analytics button
 */
export const AnalyticsIcon: FC = () => (
  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);
