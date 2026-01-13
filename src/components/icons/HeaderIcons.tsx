import type { FC } from 'react';

/**
 * Logo Icon - Chat bubble with dots
 * Used in LibraryView header
 */
export const LogoIcon: FC = () => (
  <svg className="w-6 h-6 text-white" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path fill="currentColor" d="M5.085 8.476a.848.848 0 0 0 .641-.273.946.946 0 0 0 .259-.676.946.946 0 0 0-.259-.677.848.848 0 0 0-.641-.273.848.848 0 0 0-.641.273.946.946 0 0 0-.259.677c0 .269.086.494.259.676a.848.848 0 0 0 .641.273Zm3.983 0a.848.848 0 0 0 .64-.273.946.946 0 0 0 .26-.676.946.946 0 0 0-.26-.677.848.848 0 0 0-.64-.273.848.848 0 0 0-.642.273.946.946 0 0 0-.258.677c0 .269.086.494.258.676a.848.848 0 0 0 .642.273Zm3.825 0a.848.848 0 0 0 .64-.273.945.945 0 0 0 .26-.676.945.945 0 0 0-.26-.677.848.848 0 0 0-.64-.273.848.848 0 0 0-.642.273.945.945 0 0 0-.258.677c0 .269.086.494.258.676a.848.848 0 0 0 .642.273ZM0 17.285V1.425C0 1.06.135.732.405.439.675.146.99 0 1.35 0h15.3c.345 0 .656.146.934.44.277.292.416.62.416.985V13.77c0 .364-.139.692-.416.985-.278.293-.589.44-.934.44H3.6l-2.453 2.588c-.21.221-.453.273-.73.154-.278-.119-.417-.336-.417-.653Zm1.35-1.733 1.688-1.781H16.65V1.425H1.35v14.127Zm0-14.127V15.55 1.426Z"/>
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
