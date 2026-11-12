/**
 * PROTOTYPE, throwaway. Not production code.
 *
 * Question: where does the "New" button of the Library go, now that sitting next to the close
 * button of the side panel is wrong and squeezes the title?
 *
 * Five placements on the real Library, switchable with `?variant=` and the bar at the bottom of
 * the prototype page (`npm run prototype:new-button`). A production build always gets variant A.
 */
import type { FC } from 'react';
import { useEffect, useSyncExternalStore } from 'react';

export const NEW_BUTTON_VARIANTS = [
  { key: 'A', name: 'Today: header, next to close' },
  { key: 'B', name: 'Beside the search' },
  { key: 'C', name: 'Floating button' },
  { key: 'D', name: 'Centre of the tab bar' },
  { key: 'E', name: 'First row of the list' }
] as const;

export type NewButtonVariant = (typeof NEW_BUTTON_VARIANTS)[number]['key'];

const count = NEW_BUTTON_VARIANTS.length;
const listeners = new Set<() => void>();

const read = (): NewButtonVariant => {
  if (!import.meta.env.DEV) { return 'A'; }
  const asked = new URLSearchParams(window.location.search).get('variant');
  return NEW_BUTTON_VARIANTS.find(variant => variant.key === asked)?.key ?? 'A';
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

const setVariant = (key: NewButtonVariant) => {
  const url = new URL(window.location.href);
  url.searchParams.set('variant', key);
  window.history.replaceState(null, '', url);
  listeners.forEach(listener => { listener(); });
};

export const useNewButtonVariant = (): NewButtonVariant => useSyncExternalStore(subscribe, read, () => 'A');

const PlusIcon: FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7H5" />
  </svg>
);

interface NewProps { onClick: () => void; disabled?: boolean }

/** B: a round accent button at the end of the search row */
export const NewBesideSearch: FC<NewProps> = ({ onClick, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="h-11 w-11 flex-none grid place-items-center rounded-full text-on-accent bg-accent hover:bg-accent-hover shadow-sm transition-colors focus-primary disabled:opacity-50"
    title="Add new prompt"
    aria-label="Add new prompt"
    data-testid="new-prompt-button"
  >
    <PlusIcon />
  </button>
);

/** C: a floating pill above the tab bar, bottom right of the list */
export const NewFloating: FC<NewProps> = ({ onClick, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 h-12 pl-4 pr-5 rounded-full text-sm font-semibold text-on-accent bg-accent hover:bg-accent-hover shadow-xl transition-colors focus-primary disabled:opacity-50"
    title="Add new prompt"
    aria-label="Add new prompt"
    data-testid="new-prompt-button"
  >
    <PlusIcon />
    <span>New prompt</span>
  </button>
);

/** D: a raised round button in the middle of the tab bar */
export const NewInTabBar: FC<NewProps> = ({ onClick }) => (
  <div className="flex items-center justify-center">
    <button
      type="button"
      onClick={onClick}
      className="h-12 w-12 -mt-5 grid place-items-center rounded-full text-on-accent bg-accent hover:bg-accent-hover shadow-lg ring-4 ring-(--background-color-card) transition-colors focus-primary"
      title="Add new prompt"
      aria-label="Add new prompt"
      data-testid="new-prompt-button"
    >
      <PlusIcon className="w-6 h-6" />
    </button>
  </div>
);

/** E: a dashed row that opens the list, where the next Prompt will land */
export const NewAsFirstRow: FC<NewProps> = ({ onClick, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border-[1.5px] border-dashed border-accent text-left text-accent bg-accent-subtle hover:bg-accent-selected transition-colors focus-interactive disabled:opacity-50"
    data-testid="new-prompt-button"
  >
    <span className="h-8 w-8 flex-none grid place-items-center rounded-full bg-accent text-on-accent" aria-hidden="true">
      <PlusIcon className="w-4 h-4" />
    </span>
    <span className="text-sm font-semibold">New prompt</span>
  </button>
);

/** The bar that flips between the variants. Rendered by the prototype page only. */
export const NewButtonVariantSwitcher: FC = () => {
  const current = useNewButtonVariant();
  const index = NEW_BUTTON_VARIANTS.findIndex(variant => variant.key === current);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') { return; }
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable], [role="tab"], [role="radio"]')) { return; }
      const step = event.key === 'ArrowRight' ? 1 : -1;
      setVariant(NEW_BUTTON_VARIANTS[(index + step + count) % count].key);
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); };
  }, [index]);

  const arrow = 'h-8 w-8 grid place-items-center rounded-full hover:bg-white/20 text-lg';
  return (
    <div
      style={{ position: 'fixed', bottom: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: '#111', color: '#fff', fontFamily: 'ui-monospace, monospace' }}
      className="flex items-center gap-2 px-2 py-1.5 rounded-full shadow-2xl text-xs whitespace-nowrap"
    >
      <button type="button" className={arrow} aria-label="Previous variant" onClick={() => { setVariant(NEW_BUTTON_VARIANTS[(index - 1 + count) % count].key); }}>←</button>
      <span className="px-1">{current} ({NEW_BUTTON_VARIANTS[index].name}) · {index + 1}/{count}</span>
      <button type="button" className={arrow} aria-label="Next variant" onClick={() => { setVariant(NEW_BUTTON_VARIANTS[(index + 1) % count].key); }}>→</button>
    </div>
  );
};
