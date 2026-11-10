// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { chooseSide, computePlacement, GAP, MARGIN, POPOVER_WIDTH } from '../position';

const viewport = { width: 1200, height: 800 };

describe('Prompt selector placement', () => {
  it('opens above the input field, on its left edge, 10px away', () => {
    const anchor = { top: 600, bottom: 660, left: 300 };

    expect(chooseSide(anchor, viewport)).toBe('above');
    expect(computePlacement(anchor, viewport, 'above')).toEqual({
      side: 'above',
      left: 300,
      width: POPOVER_WIDTH,
      offset: 800 - 600 + GAP,
      maxHeight: 600 - GAP - MARGIN
    });
  });

  it('opens below when there is no room above and more below', () => {
    const anchor = { top: 80, bottom: 140, left: 300 };

    expect(chooseSide(anchor, viewport)).toBe('below');
    expect(computePlacement(anchor, viewport, 'below')).toMatchObject({ side: 'below', offset: 140 + GAP, maxHeight: 800 - 150 - MARGIN });
  });

  it('stays above when neither side fits a full popover and above has more room', () => {
    expect(chooseSide({ top: 300, bottom: 360, left: 0 }, { width: 800, height: 500 })).toBe('above');
  });

  it('moves left when it would leave the window on the right', () => {
    expect(computePlacement({ top: 600, bottom: 660, left: 1000 }, viewport, 'above').left).toBe(1200 - MARGIN - POPOVER_WIDTH);
  });

  it('never leaves the window on the left', () => {
    expect(computePlacement({ top: 600, bottom: 660, left: -40 }, viewport, 'above').left).toBe(MARGIN);
  });

  it('is never wider than the window', () => {
    const narrow = computePlacement({ top: 500, bottom: 560, left: 4 }, { width: 320, height: 640 }, 'above');

    expect(narrow.width).toBe(300);
    expect(narrow.left).toBe(MARGIN);
  });
});
