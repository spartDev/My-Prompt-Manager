import { type CSSProperties, type FC, useCallback, useRef } from 'react';

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
  /** `inserted`: the Prompt arrived. `failed`: it did not, and there is nothing to undo. */
  kind: 'inserted' | 'failed';
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

/** Space between the input field and the confirmation, and the least room it needs above the field. */
const GAP = 10;
const ROOM = 48;

/**
 * What the user sees right after an Insertion, drawn in the selector's shadow root over the page:
 * a violet sweep across the input field, and above its right corner a pill that names the Prompt
 * and offers Undo. When the Insertion failed the pill says so, with no sweep and no Undo.
 */
export const InsertionFeedback: FC<InsertionFeedbackProps> = ({ id, kind, title, field, viewport, sweep, leaving, onUndo, onHold }) => {
  const right = Math.max(8, viewport.width - (field.left + field.width));
  // Above the field; below it when the field is at the top of the window
  const place: CSSProperties = field.top >= ROOM
    ? { right, bottom: viewport.height - field.top + GAP }
    : { right, top: field.top + field.height + GAP };
  const inserted = kind === 'inserted';

  // The pill is a status, not a control: it hears the pointer and the focus through its element.
  // A ref callback, so each new pill (one per Insertion) gets the listeners and gives them back
  const hold = useRef(onHold);
  hold.current = onHold;
  const pillRef = useCallback((pill: HTMLDivElement | null) => {
    if (!pill) {
      return;
    }
    const held = (): void => { hold.current(true); };
    const released = (): void => { hold.current(false); };
    pill.addEventListener('mouseenter', held);
    pill.addEventListener('mouseleave', released);
    pill.addEventListener('focusin', held);
    pill.addEventListener('focusout', released);
    return () => {
      pill.removeEventListener('mouseenter', held);
      pill.removeEventListener('mouseleave', released);
      pill.removeEventListener('focusin', held);
      pill.removeEventListener('focusout', released);
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
        <span className="mpm-inserted-text">{inserted ? `Inserted “${title}”` : `Couldn't insert “${title}”`}</span>
        {inserted && (
          <button type="button" className="mpm-inserted-undo" onClick={onUndo}>Undo</button>
        )}
      </div>
    </>
  );
};
