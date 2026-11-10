/**
 * Where the Prompt selector goes: above the input field, aligned on its left edge, 10px away.
 * Below when there is no room above; moved left when it would leave the window. Pure.
 */

export interface AnchorRect {
  top: number;
  bottom: number;
  left: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export type Side = 'above' | 'below';

export interface Placement {
  side: Side;
  left: number;
  width: number;
  /** Distance from the window's bottom edge when above, from its top edge when below. */
  offset: number;
  /** The height left on that side: the popover never grows past it. */
  maxHeight: number;
}

/** The popover's width; narrower only when the window is. */
export const POPOVER_WIDTH = 360;
/** The space between the input field and the popover. */
export const GAP = 10;
/** The space kept between the popover and the window's edges. */
export const MARGIN = 10;
/** The popover's height with a full list: what must fit above the input field for it to open there. */
export const NOMINAL_HEIGHT = 384;

/** Above when a full popover fits there, else the side with more room. */
export const chooseSide = (anchor: AnchorRect, viewport: Viewport): Side => {
  const above = anchor.top - GAP - MARGIN;
  const below = viewport.height - anchor.bottom - GAP - MARGIN;
  return above >= NOMINAL_HEIGHT || above >= below ? 'above' : 'below';
};

/** The placement on `side`, which is chosen once at opening so the popover does not jump while open. */
export const computePlacement = (anchor: AnchorRect, viewport: Viewport, side: Side): Placement => {
  const width = Math.max(0, Math.min(POPOVER_WIDTH, viewport.width - 2 * MARGIN));
  const left = Math.max(MARGIN, Math.min(anchor.left, viewport.width - MARGIN - width));

  if (side === 'above') {
    const offset = Math.max(MARGIN, viewport.height - anchor.top + GAP);
    return { side, left, width, offset, maxHeight: Math.max(0, viewport.height - offset - MARGIN) };
  }
  const offset = Math.max(MARGIN, anchor.bottom + GAP);
  return { side, left, width, offset, maxHeight: Math.max(0, viewport.height - offset - MARGIN) };
};
