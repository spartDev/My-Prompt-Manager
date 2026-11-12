import type { FC, KeyboardEvent } from 'react';
import { Fragment, useRef } from 'react';

// PROTOTYPE: placements of the New button, see src/prototype
import { NewInTabBar, useNewButtonVariant } from '../prototype/newButtonPlacement.prototype';

import { AnalyticsTabIcon, CategoriesTabIcon, LibraryTabIcon, SettingsTabIcon } from './icons/TabBarIcons';

/** A top-level destination reachable from the tab bar (see CONTEXT.md). */
export type Section = 'library' | 'categories' | 'analytics' | 'settings';

const TABS: Array<{ section: Section; label: string; icon: FC<{ className?: string }> }> = [
  { section: 'library', label: 'Library', icon: LibraryTabIcon },
  { section: 'categories', label: 'Categories', icon: CategoriesTabIcon },
  { section: 'analytics', label: 'Analytics', icon: AnalyticsTabIcon },
  { section: 'settings', label: 'Settings', icon: SettingsTabIcon }
];

/** The Sections in the order of the tab bar, left to right */
export const SECTION_ORDER: readonly Section[] = TABS.map(({ section }) => section);

export interface TabBarProps {
  activeSection: Section;
  /** Fired on every tab press, including the already active tab (used for scroll-to-top). */
  onSelect: (section: Section) => void;
  /** Behind a modal sheet: out of reach, assistive technology included, until it closes */
  inert?: boolean;
  /** PROTOTYPE (variant D): opens the editor on a new Prompt */
  onNew?: () => void;
}

/**
 * iOS-style bottom tab bar switching between the four Sections.
 * Implements the WAI-ARIA tabs pattern: roving tabindex and arrow-key navigation.
 */
const TabBar: FC<TabBarProps> = ({ activeSection, onSelect, inert = false, onNew }) => {
  const newInBar = useNewButtonVariant() === 'D' && onNew !== undefined;
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
      className="shrink-0 bg-card border-t border-strong px-2 pt-2 pb-2"
      aria-label="Main navigation"
      inert={inert}
    >
      <div className={`grid gap-1 ${newInBar ? 'grid-cols-5' : 'grid-cols-4'}`} role="tablist" aria-label="Sections">
        {TABS.map(({ section, label, icon: Icon }, index) => {
          const isActive = section === activeSection;
          return (
            <Fragment key={section}>
            {newInBar && index === 2 && <NewInTabBar onClick={onNew} />}
            <button
              ref={(el) => { tabRefs.current[index] = el; }}
              type="button"
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              data-testid={`tab-${section}`}
              onClick={() => { onSelect(section); }}
              onKeyDown={(e) => { handleKeyDown(e, index); }}
              className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                isActive
                  ? 'bg-accent-selected text-accent-strong'
                  : 'text-tertiary hover:text-primary'
              }`}
            >
              <Icon className="w-6 h-6" />
              <span>{label}</span>
            </button>
            </Fragment>
          );
        })}
      </div>
    </nav>
  );
};

export default TabBar;
