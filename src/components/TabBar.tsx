import type { FC, KeyboardEvent } from 'react';
import { useRef } from 'react';

import { AnalyticsTabIcon, CategoriesTabIcon, LibraryTabIcon, SettingsTabIcon } from './icons/TabBarIcons';

/** A top-level destination reachable from the tab bar (see CONTEXT.md). */
export type Section = 'library' | 'categories' | 'analytics' | 'settings';

const TABS: Array<{ section: Section; label: string; icon: FC<{ className?: string }> }> = [
  { section: 'library', label: 'Library', icon: LibraryTabIcon },
  { section: 'categories', label: 'Categories', icon: CategoriesTabIcon },
  { section: 'analytics', label: 'Analytics', icon: AnalyticsTabIcon },
  { section: 'settings', label: 'Settings', icon: SettingsTabIcon }
];

export interface TabBarProps {
  activeSection: Section;
  /** Fired on every tab press, including the already active tab (used for scroll-to-top). */
  onSelect: (section: Section) => void;
}

/**
 * iOS-style bottom tab bar switching between the four Sections.
 * Implements the WAI-ARIA tabs pattern: roving tabindex and arrow-key navigation.
 */
const TabBar: FC<TabBarProps> = ({ activeSection, onSelect }) => {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (e.key === 'ArrowRight') { nextIndex = (index + 1) % TABS.length; }
    if (e.key === 'ArrowLeft') { nextIndex = (index - 1 + TABS.length) % TABS.length; }
    if (e.key === 'Home') { nextIndex = 0; }
    if (e.key === 'End') { nextIndex = TABS.length - 1; }
    if (nextIndex === null) { return; }

    e.preventDefault();
    tabRefs.current[nextIndex]?.focus();
    onSelect(TABS[nextIndex].section);
  };

  return (
    <nav
      className="shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-2 pt-2 pb-2"
      aria-label="Main navigation"
    >
      <div className="grid grid-cols-4 gap-1" role="tablist" aria-label="Sections">
        {TABS.map(({ section, label, icon: Icon }, index) => {
          const isActive = section === activeSection;
          return (
            <button
              key={section}
              ref={(el) => { tabRefs.current[index] = el; }}
              type="button"
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              data-testid={`tab-${section}`}
              onClick={() => { onSelect(section); }}
              onKeyDown={(e) => { handleKeyDown(e, index); }}
              className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:focus-visible:ring-purple-400 ${
                isActive
                  ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <Icon className="w-6 h-6" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default TabBar;
