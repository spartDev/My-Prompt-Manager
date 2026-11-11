import { type CSSProperties, type FC, useCallback, useLayoutEffect, useRef } from 'react';

/** Where the input field is in the window, and how round its corners are. */
export interface FieldBox {
  top: number;
  left: number;
  width: number;
  height: number;
  /** The field's own `border-radius`, so the sweep keeps inside its corners. */
  radius: string;
}

export interface InsertionFeedbackProps {
  /** Changes with each Insertion, so a new confirmation animates in again. */
  id: number;
  /**
   * `inserted`: the Prompt arrived. `failed`: it did not, and there is nothing to undo.
   * `undoFailed`: Undo could not put the earlier text back, so the Prompt is still in the field.
   */
  kind: 'inserted' | 'failed' | 'undoFailed';
  /** The title of the Prompt. */
  title: string;
  field: FieldBox;
  viewport: { width: number; height: number };
  /** Whether the sweep is drawn over the field: after a successful Insertion, unless motion is reduced. */
  sweep: boolean;
  /** The confirmation is fading out. */
  leaving: boolean;
  /** Puts back the text the field held before the Insertion. */
  onUndo: () => void;
  /** The pointer or the focus is on the confirmation, or has left it: it stays while held. */
  onHold: (held: boolean) => void;
}

const MESSAGE: Record<InsertionFeedbackProps['kind'], (title: string) => string> = {
  inserted: (title) => `Inserted “${title}”`,
  failed: (title) => `Couldn't insert “${title}”`,
  undoFailed: (title) => `Couldn't undo “${title}”`
};

/** Space between the input field and the confirmation, and the least room it needs above the field. */
const GAP = 10;
const ROOM = 48;
/** The pill's widest, the space kept between it and the window's edge, and the room below which it leaves the field's right edge. */
const WIDEST = 420;
const MARGIN = 8;
const NARROW = 240;

/**
 * What the user sees right after an Insertion, drawn in the selector's shadow root over the page:
 * a violet sweep across the input field, and above its right corner a pill that names the Prompt
 * and offers Undo. When the Insertion failed the pill says so, with no sweep and no Undo.
 */
export const InsertionFeedback: FC<InsertionFeedbackProps> = ({ id, kind, title, field, viewport, sweep, leaving, onUndo, onHold }) => {
  // Its right edge on the field's, as wide as the window leaves room for on that side. A field
  // that ends near the left of the window leaves too little: the pill then starts at the left
  // margin, so it is never cut off by the edge of the window
  const right = Math.max(MARGIN, viewport.width - (field.left + field.width));
  const room = viewport.width - right - MARGIN;
  const across: CSSProperties = room >= NARROW
    ? { right, maxWidth: Math.min(WIDEST, room) }
    : { left: MARGIN, maxWidth: Math.max(0, Math.min(WIDEST, viewport.width - 2 * MARGIN)) };
  // Above the field; below it when the field is at the top of the window
  const place: CSSProperties = field.top >= ROOM
    ? { ...across, bottom: viewport.height - field.top + GAP }
    : { ...across, top: field.top + field.height + GAP };
  const inserted = kind === 'inserted';

  // The pill is a status, not a control: it hears the pointer and the focus through its element.
  // A ref callback, so each new pill (one per Insertion) gets the listeners and gives them back
  const hold = useRef(onHold);
  useLayoutEffect(() => {
    hold.current = onHold;
  });
  const pillRef = useCallback((pill: HTMLDivElement | null) => {
    if (!pill) {
      return;
    }
    // Held by the pointer, by the focus, or by both: it is released once neither is on it
    let hovered = false;
    let focused = false;
    const tell = (): void => { hold.current(hovered || focused); };
    const onEnter = (): void => { hovered = true; tell(); };
    const onLeave = (): void => { hovered = false; tell(); };
    const onFocusIn = (): void => { focused = true; tell(); };
    const onFocusOut = (): void => { focused = false; tell(); };
    pill.addEventListener('mouseenter', onEnter);
    pill.addEventListener('mouseleave', onLeave);
    pill.addEventListener('focusin', onFocusIn);
    pill.addEventListener('focusout', onFocusOut);
    return () => {
      pill.removeEventListener('mouseenter', onEnter);
      pill.removeEventListener('mouseleave', onLeave);
      pill.removeEventListener('focusin', onFocusIn);
      pill.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  return (
    <>
      {sweep && (
        <span
          key={`sweep-${String(id)}`}
          className="mpm-sweep"
          aria-hidden="true"
          style={{ top: field.top, left: field.left, width: field.width, height: field.height, borderRadius: field.radius }}
        />
      )}
      <div
        key={`pill-${String(id)}`}
        className="mpm-inserted"
        role="status"
        data-kind={kind}
        data-undo={inserted ? 'true' : undefined}
        data-leaving={leaving ? 'true' : undefined}
        ref={pillRef}
        style={place}
      >
        <span className="mpm-inserted-text">{MESSAGE[kind](title)}</span>
        {inserted && (
          <button type="button" className="mpm-inserted-undo" onClick={onUndo}>Undo</button>
        )}
      </div>
    </>
  );
};
