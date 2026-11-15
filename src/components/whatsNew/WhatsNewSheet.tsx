import type { FC, ReactNode } from 'react';
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

import { useModalFocus } from '../../hooks/useModalFocus';
import { cn } from '../../utils';

/** How What's new was closed: Got it, a click on the backdrop, Escape, or Enter outside a tile */
export type WhatsNewCloseReason = 'got-it' | 'backdrop' | 'escape' | 'enter';

export interface WhatsNewSheetProps {
  /** The Release whose Release notes are shown, as in "New in 2.0.0" */
  version: string;
  /** The tile grid of the Release notes, rendered in the scrolling body under the title */
  children?: ReactNode;
  /**
   * False while the exit plays: the sheet no longer takes input, and gives the keyboard back to
   * its opener. Whoever renders it unmounts it after MOTION.whatsNewSheetOut (useAnimatedPresence)
   */
  open: boolean;
  /** Called once per close, with how it was closed. The sheet itself stores nothing */
  onClose: (reason: WhatsNewCloseReason) => void;
}

/**
 * A control that handles Enter itself: a tile of the grid opens its destination, so Enter on it
 * keeps its native activation. Got it is excluded by the caller: Enter on it closes, as anywhere else
 */
const OWN_ENTER = 'button, a[href], input, select, textarea, [role="button"], [contenteditable="true"]';

/** A key that presses the Feature tile of its number: 1 to 9, from the top row or the keypad */
const TILE_NUMBER = /^[1-9]$/;

/** Where a digit is typed, not a tile number. The sheet holds no field today; a future one keeps its digits */
const TEXT_FIELD = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

/**
 * What's new (Atelier 1C): the bottom sheet that rises over the Library and lists the Release notes
 * of a Release. A backdrop, the sheet with its handle, the pill "New in {version}", the title, a
 * scrolling body for the tile grid and a footer with Got it. It keeps the keyboard while open
 * (useModalFocus): the focus starts on Got it, Tab stays inside (the scrolling body, its Feature tiles,
 * Got it), and it returns to the opener on close.
 * Escape, Enter outside a tile, the backdrop and Got it close it; the digits 1 to 9 press the Feature
 * tile of that number, which closes it and opens the tile's destination. It knows nothing of Debug mode or
 * of storage: the caller decides what closing means.
 */
const WhatsNewSheet: FC<WhatsNewSheetProps> = ({ version, children, open, onClose }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const gotItRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Focus on Got it at open, Tab kept inside, Escape closes, focus back to the opener on close
  useModalFocus({
    isOpen: open,
    onClose: () => { onCloseRef.current('escape'); },
    containerRef: panelRef,
    initialFocusRef: gotItRef
  });

  // Enter closes, unless it lands on a control of its own (a tile button of the grid), whose
  // native activation it keeps. On Got it, Enter closes as 'enter', once: its click is prevented.
  // A digit from 1 to 9 presses the Feature tile of that number (data-whats-new-tile-index), as a
  // click would: the sheet does not know where a tile leads, the tile does
  useEffect(() => {
    if (!open) {return;}
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.isComposing || event.defaultPrevented) {return;}
      const target = event.target instanceof Element ? event.target : null;
      if (TILE_NUMBER.test(event.key)) {
        if (event.metaKey || event.ctrlKey || event.altKey || target?.closest(TEXT_FIELD)) {return;}
        const tile = panelRef.current?.querySelector(`[data-whats-new-tile-index="${event.key}"]`);
        if (!(tile instanceof HTMLElement)) {return;}
        event.preventDefault();
        tile.click();
        return;
      }
      if (event.key !== 'Enter') {return;}
      const control = target?.closest(OWN_ENTER);
      if (control && control !== gotItRef.current) {return;}
      event.preventDefault();
      onCloseRef.current('enter');
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => { document.removeEventListener('keydown', handleKeyDown); };
  }, [open]);

  const close = (reason: WhatsNewCloseReason) => {
    if (open) {
      onCloseRef.current(reason);
    }
  };

  return createPortal(
    // Inert while it leaves: the exit plays, nothing in it takes input any more
    <div className={cn('fixed inset-0 z-40', !open && 'pointer-events-none')} inert={!open}>
      <div
        aria-hidden="true"
        data-testid="whats-new-backdrop"
        className={cn('absolute inset-0 bg-backdrop', open ? 'animate-whats-new-backdrop-in' : 'animate-whats-new-backdrop-out')}
        onClick={() => { close('backdrop'); }}
      />
      <div
        // Leaving, the sheet stays in the document for its exit yet is closed: without the ref,
        // useModalFocus would take it for paused and keep the focus from the opener
        ref={open ? panelRef : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'absolute inset-x-0 bottom-0 flex max-h-[calc(100%-24px)] flex-col rounded-t-sheet bg-card shadow-sheet focus:outline-none',
          open ? 'animate-whats-new-sheet-in' : 'animate-whats-new-sheet-out'
        )}
      >
        {/* Handle: decoration only */}
        <span aria-hidden="true" className="mt-2 mb-0.5 h-[5px] w-[38px] flex-none self-center rounded-[3px] bg-handle" />

        {/* The scrolling body takes the keyboard itself, so notes with no tile to focus (only
            Critical fixes) still scroll with the arrow keys; named by the title, not an anonymous group */}
        <div
          role="region"
          aria-labelledby={titleId}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling region must take the keyboard to scroll when nothing inside it can (WCAG 2.1.1)
          tabIndex={0}
          data-testid="whats-new-body"
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pt-2 pb-3 focus:outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        >
          <div className="flex flex-col gap-1.5">
            {/* An information pill, not a chosen item: bg-accent-subtle, the dark mockup's own fill */}
            <span className="inline-flex h-6 items-center self-start rounded-full bg-accent-subtle px-2.5 text-xs font-bold text-accent">
              New in {version}
            </span>
            <h2 id={titleId} className="text-2xl leading-[1.1] font-extrabold tracking-[-0.03em] text-primary">
              What&rsquo;s new
            </h2>
          </div>
          {children}
        </div>

        <div className="flex flex-none flex-col border-t border-divider px-4 pt-2.5 pb-4">
          <button
            ref={gotItRef}
            type="button"
            onClick={() => { close('got-it'); }}
            className="h-[46px] flex-none rounded-[14px] bg-accent text-[14.5px] font-bold text-on-accent hover:bg-accent-hover transition-got-it active:scale-96 focus-primary"
          >
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default WhatsNewSheet;
