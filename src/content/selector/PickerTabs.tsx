import { type FC, useEffect, useRef } from 'react';

import type { SelectorTab, TabKey } from './selectorData';

interface PickerTabsProps {
  tabs: readonly SelectorTab[];
  /** The tab whose Prompts are listed; none while a search lists the whole Library. */
  active: TabKey | null;
  /** Id of the list the tabs control. */
  listId: string;
  onSelect: (tab: TabKey) => void;
}

/** The dot of All, Pinned and Recent is a token; a Category's is its own color. */
const dotOf = (tab: SelectorTab): 'all' | 'pinned' | 'recent' | 'category' =>
  tab.key === 'all' || tab.key === 'pinned' || tab.key === 'recent' ? tab.key : 'category';

/**
 * The tabs of the Prompt selector: All, Pinned, Recent, then every Category. The arrows change
 * tab from anywhere in the list step, so the tabs themselves stay out of the Tab order.
 */
export const PickerTabs: FC<PickerTabsProps> = ({ tabs, active, listId, onSelect }) => {
  const activeRef = useRef<HTMLButtonElement | null>(null);

  // Keep the active tab in view when the arrows move past the edge of the row
  useEffect(() => {
    if (active !== null) {
      activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [active]);

  return (
    <div className="mpm-tabs" role="tablist" aria-label="Prompt groups" data-dimmed={active === null}>
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <button
            key={tab.key}
            ref={selected ? activeRef : undefined}
            type="button"
            role="tab"
            className="mpm-tab"
            aria-selected={selected}
            aria-controls={listId}
            tabIndex={-1}
            onClick={() => { onSelect(tab.key); }}
          >
            <span className="mpm-dot" data-dot={dotOf(tab)} style={tab.color === undefined ? undefined : { background: tab.color }} aria-hidden="true" />
            <span className="mpm-tab-label">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};
