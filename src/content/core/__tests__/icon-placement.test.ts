/**
 * Unit tests for IconPlacementController: the icon placed for an editor is watched, and when the
 * Platform removes it, one re-placement is asked for.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IconPlacementController, PLACEMENT_ATTRIBUTE } from '../icon-placement';

vi.mock('../../utils/logger', () => ({
  debug: vi.fn(),
  info: vi.fn()
}));

/** Lets the MutationObserver deliver, then the re-placement delay elapse */
const afterReplaceDelay = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, IconPlacementController.REPLACE_DELAY_MS * 2));

describe('IconPlacementController', () => {
  let onLost: ReturnType<typeof vi.fn<(editor: HTMLElement) => void>>;
  let controller: IconPlacementController;
  let editor: HTMLElement;
  let toolbar: HTMLElement;
  let icon: HTMLElement;

  beforeEach(() => {
    onLost = vi.fn();
    controller = new IconPlacementController(onLost);
    editor = document.createElement('div');
    toolbar = document.createElement('div');
    icon = document.createElement('button');
    toolbar.appendChild(icon);
    document.body.append(editor, toolbar);
  });

  afterEach(() => {
    controller.reset();
    document.body.innerHTML = '';
  });

  it('marks the icon with how it was placed and remembers it for its editor', () => {
    controller.track(icon, editor, 'toolbar');

    expect(icon.getAttribute(PLACEMENT_ATTRIBUTE)).toBe('toolbar');
    expect(controller.current).toEqual({ icon, editor, kind: 'toolbar' });
    expect(controller.isLost(editor)).toBe(false);
  });

  it('asks for one re-placement when the Platform removes the icon while the editor stays', async () => {
    controller.track(icon, editor, 'toolbar');

    toolbar.remove();
    expect(controller.isLost(editor)).toBe(true);
    await afterReplaceDelay();

    expect(onLost).toHaveBeenCalledTimes(1);
    expect(onLost).toHaveBeenCalledWith(editor);
    expect(controller.current).toBeNull();
  });

  it('says a replacement is pending between the loss and the call', async () => {
    controller.track(icon, editor, 'toolbar');

    toolbar.remove();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(controller.isReplacementPending()).toBe(true);
    await afterReplaceDelay();
    expect(controller.isReplacementPending()).toBe(false);
  });

  it('does nothing while the icon stays, whatever else changes in the document', async () => {
    controller.track(icon, editor, 'toolbar');

    document.body.appendChild(document.createElement('p'));
    editor.appendChild(document.createElement('span'));
    await afterReplaceDelay();

    expect(onLost).not.toHaveBeenCalled();
    expect(controller.isLost(editor)).toBe(false);
  });

  it('asks only once: a placement that fails does not schedule another on the next change', async () => {
    controller.track(icon, editor, 'toolbar');

    toolbar.remove();
    await afterReplaceDelay();
    document.body.appendChild(document.createElement('p'));
    await afterReplaceDelay();

    expect(onLost).toHaveBeenCalledTimes(1);
  });

  it('stands down when a new icon is tracked before the delay elapses', async () => {
    controller.track(icon, editor, 'toolbar');
    toolbar.remove();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const replacement = document.createElement('button');
    document.body.appendChild(replacement);
    controller.track(replacement, editor, 'toolbar');
    await afterReplaceDelay();

    expect(onLost).not.toHaveBeenCalled();
    expect(controller.current?.icon).toBe(replacement);
  });

  it('stands down when the icon is back in the document before the delay elapses', async () => {
    controller.track(icon, editor, 'toolbar');
    toolbar.remove();
    await new Promise((resolve) => setTimeout(resolve, 0));

    document.body.appendChild(toolbar);
    await afterReplaceDelay();

    expect(onLost).not.toHaveBeenCalled();
    expect(controller.current?.icon).toBe(icon);
  });

  it('reset() forgets the icon and stops watching', async () => {
    controller.track(icon, editor, 'overlay');
    controller.reset();

    toolbar.remove();
    await afterReplaceDelay();

    expect(onLost).not.toHaveBeenCalled();
    expect(controller.current).toBeNull();
    expect(controller.isLost(editor)).toBe(false);
  });

  it('reports the editor that went with the icon as lost too, so the caller looks for a new one', async () => {
    controller.track(icon, editor, 'toolbar');

    editor.remove();
    toolbar.remove();
    await afterReplaceDelay();

    expect(onLost).toHaveBeenCalledWith(editor);
    expect(editor.isConnected).toBe(false);
  });

  describe('while the icon waits for its toolbar', () => {
    const GRACE = IconPlacementController.TOOLBAR_GRACE_MS;
    const DELAY = IconPlacementController.REPLACE_DELAY_MS;
    let found: boolean;
    let onKept: ReturnType<typeof vi.fn<() => void>>;

    /** Lets the MutationObserver deliver a change made just before (a microtask), then time pass */
    const elapse = async (ms: number) => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(ms);
    };
    const change = () => document.body.appendChild(document.createElement('div'));

    beforeEach(() => {
      vi.useFakeTimers();
      found = false;
      onKept = vi.fn();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('places the icon again once a change of the page brings the toolbar, and reports nothing', async () => {
      controller.track(icon, editor, 'overlay');
      controller.awaitToolbar(() => found, onKept);

      found = true;
      change();
      await elapse(DELAY);

      expect(onLost).toHaveBeenCalledWith(editor);
      expect(controller.current).toBeNull();
      await elapse(GRACE);
      expect(onKept).not.toHaveBeenCalled();
    });

    it('looks for the toolbar once when it starts waiting: the toolbar may have rendered while the icon was placed', async () => {
      found = true;
      controller.track(icon, editor, 'overlay');
      controller.awaitToolbar(() => found, onKept);

      await elapse(DELAY);

      expect(onLost).toHaveBeenCalledTimes(1);
    });

    it('says the toolbar is missing once the grace period is over, then stops looking for it', async () => {
      let checks = 0;
      controller.track(icon, editor, 'overlay');
      controller.awaitToolbar(() => { checks++; return found; }, onKept);
      await elapse(GRACE);
      expect(onKept).toHaveBeenCalledTimes(1);

      // A busy page: a later anchor that shows (a send button) moves nothing
      checks = 0;
      found = true;
      for (let index = 0; index < 10; index++) {
        change();
        await elapse(DELAY);
      }
      expect(checks).toBe(0);
      expect(onLost).not.toHaveBeenCalled();
    });

    it('with keepWatching, still places the icon again when the toolbar shows long after the grace period', async () => {
      controller.track(icon, editor, 'overlay');
      controller.awaitToolbar(() => found, onKept, { keepWatching: () => found });
      await elapse(GRACE);
      expect(onKept).toHaveBeenCalledTimes(1);

      // A composer without the toolbar, then the one with it 40 s later
      await elapse(40_000);
      found = true;
      change();
      await elapse(DELAY);
      expect(onLost).not.toHaveBeenCalled();
      await elapse(IconPlacementController.LATE_TOOLBAR_CHECK_MS);

      expect(onLost).toHaveBeenCalledWith(editor);
      expect(controller.current).toBeNull();
    });

    it('with keepWatching, looks at most once a second after the grace period on a page that keeps changing', async () => {
      let checks = 0;
      controller.track(icon, editor, 'overlay');
      controller.awaitToolbar(() => found, onKept, { keepWatching: () => { checks++; return found; } });
      await elapse(GRACE);
      checks = 0;

      for (let index = 0; index < 30; index++) {
        change();
        await elapse(DELAY);
      }

      expect(checks).toBeLessThanOrEqual(3);
      expect(checks).toBeGreaterThan(0);
    });

    it('with keepWatching, does not watch for an icon placed anew when the grace period ended', async () => {
      let checks = 0;
      controller.track(icon, editor, 'overlay');
      controller.awaitToolbar(() => found, () => { controller.track(icon, editor, 'toolbar', 0); }, { keepWatching: () => { checks++; return found; } });
      await elapse(GRACE);
      checks = 0;

      found = true;
      change();
      await elapse(IconPlacementController.LATE_TOOLBAR_CHECK_MS * 2);

      expect(checks).toBe(0);
      expect(onLost).not.toHaveBeenCalled();
    });

    it('with keepWatching, looks after the grace period for what keepWatching says, not for what the grace period looked for', async () => {
      let late = false;
      controller.track(icon, editor, 'overlay');
      controller.awaitToolbar(() => found, onKept, { keepWatching: () => late });
      await elapse(GRACE);

      found = true;
      change();
      await elapse(IconPlacementController.LATE_TOOLBAR_CHECK_MS);
      expect(onLost).not.toHaveBeenCalled();

      late = true;
      change();
      await elapse(IconPlacementController.LATE_TOOLBAR_CHECK_MS);
      expect(onLost).toHaveBeenCalledWith(editor);
    });

    it('with keepWatching, looks again for an editor out of the page for a moment once it is back', async () => {
      const parent = editor.parentElement as HTMLElement;
      controller.track(icon, editor, 'overlay');
      controller.awaitToolbar(() => found, onKept, { keepWatching: () => found });
      await elapse(GRACE);
      editor.remove();
      change();
      await elapse(IconPlacementController.LATE_TOOLBAR_CHECK_MS);

      parent.appendChild(editor);
      found = true;
      change();
      await elapse(IconPlacementController.LATE_TOOLBAR_CHECK_MS);

      expect(onLost).toHaveBeenCalledWith(editor);
    });

    it('with keepWatching, stops looking once the icon is placed anew', async () => {
      let checks = 0;
      controller.track(icon, editor, 'overlay');
      controller.awaitToolbar(() => found, onKept, { keepWatching: () => { checks++; return found; } });
      await elapse(GRACE);
      controller.track(icon, editor, 'toolbar', 0);
      checks = 0;

      change();
      await elapse(IconPlacementController.LATE_TOOLBAR_CHECK_MS * 2);

      expect(checks).toBe(0);

      // Its next wait looks at the pace of the grace period again
      controller.awaitToolbar(() => found, onKept);
      found = true;
      change();
      await elapse(DELAY);
      expect(onLost).toHaveBeenCalledWith(editor);
    });

    it('stops looking at the end of the grace period for an icon at a pick, which a later anchor no longer moves', async () => {
      controller.track(icon, editor, 'override');
      controller.awaitToolbar(() => found);
      await elapse(GRACE);

      found = true;
      change();
      await elapse(DELAY * 3);

      expect(onLost).not.toHaveBeenCalled();
      expect(controller.current?.kind).toBe('override');
    });

    it('moves the icon instead of reporting when the toolbar is there at the end of the grace period, with no change seen', async () => {
      controller.track(icon, editor, 'overlay');
      controller.awaitToolbar(() => found, onKept);
      await elapse(DELAY);

      found = true;
      await elapse(GRACE);

      expect(onKept).not.toHaveBeenCalled();
      expect(onLost).toHaveBeenCalledWith(editor);
    });

    it('reports nothing for an editor that left the page during the grace period', async () => {
      controller.track(icon, editor, 'overlay');
      controller.awaitToolbar(() => found, onKept);

      editor.remove();
      await elapse(GRACE);

      expect(onKept).not.toHaveBeenCalled();
    });

    it('goes on waiting when the icon is out of the page for a moment and back', async () => {
      controller.track(icon, editor, 'overlay');
      controller.awaitToolbar(() => found, onKept);

      icon.remove();
      await elapse(0);
      toolbar.appendChild(icon);
      await elapse(DELAY * 2);
      expect(onLost).not.toHaveBeenCalled();

      found = true;
      change();
      await elapse(DELAY);
      expect(onLost).toHaveBeenCalledWith(editor);
      expect(onKept).not.toHaveBeenCalled();
    });

    it('looks for the toolbar when the icon is back in the page, without a later change', async () => {
      controller.track(icon, editor, 'override');
      controller.awaitToolbar(() => found);
      // The look it starts with is over
      await elapse(DELAY * 2);

      // The Platform takes the icon's node out, renders its toolbar, and puts the node back
      icon.remove();
      await elapse(0);
      found = true;
      toolbar.appendChild(icon);
      await elapse(DELAY * 3);

      expect(onLost).toHaveBeenCalledWith(editor);
    });

    it('stops waiting when another icon is tracked: the toolbar found later does not move it', async () => {
      controller.track(icon, editor, 'overlay');
      controller.awaitToolbar(() => found, onKept);
      const placed = document.createElement('button');
      toolbar.appendChild(placed);
      controller.track(placed, editor, 'toolbar', 0);

      found = true;
      change();
      await elapse(GRACE);

      expect(onLost).not.toHaveBeenCalled();
      expect(onKept).not.toHaveBeenCalled();
    });

    it('ends the wait just after the grace period when the icon was out of the page at its end and is back', async () => {
      controller.track(icon, editor, 'overlay');
      controller.awaitToolbar(() => found, onKept);

      await elapse(GRACE - DELAY / 2);
      icon.remove();
      await elapse(0);
      await elapse(DELAY / 2 + 10);
      toolbar.appendChild(icon);
      await elapse(DELAY * 2);
      expect(onKept).toHaveBeenCalledTimes(1);

      // Ended: a later anchor that shows moves nothing
      found = true;
      change();
      await elapse(DELAY * 2);
      expect(onLost).not.toHaveBeenCalled();
    });

    it('does not move an icon the Platform took out while the toolbar was looked for: it is placed again as a lost one', async () => {
      controller.track(icon, editor, 'overlay');
      controller.awaitToolbar(() => found, onKept);
      await elapse(DELAY * 2);

      found = true;
      change();
      await elapse(DELAY / 2);
      icon.remove();
      // The look for the toolbar is over, the loss is not yet
      await elapse(DELAY / 2 + 10);
      expect(onLost).not.toHaveBeenCalled();

      await elapse(DELAY);
      expect(onLost).toHaveBeenCalledTimes(1);
    });

    it('does not move the icon of an editor that left the page while the toolbar was looked for', async () => {
      controller.track(icon, editor, 'overlay');
      controller.awaitToolbar(() => found, onKept);
      await elapse(DELAY * 2);

      found = true;
      change();
      await elapse(0);
      editor.remove();
      await elapse(DELAY * 2);

      expect(onLost).not.toHaveBeenCalled();
    });

    it('reports nothing when the grace period ends while the icon is out of the page', async () => {
      controller.track(icon, editor, 'overlay');
      controller.awaitToolbar(() => found, onKept);

      await elapse(GRACE - DELAY / 2);
      toolbar.remove();
      await elapse(DELAY * 3);

      expect(onKept).not.toHaveBeenCalled();
      expect(onLost).toHaveBeenCalledTimes(1);
    });

    it('stops waiting on reset: no report, no re-placement once the site is turned off', async () => {
      controller.track(icon, editor, 'overlay');
      controller.awaitToolbar(() => found, onKept);

      controller.reset();
      found = true;
      change();
      await elapse(GRACE);

      expect(onKept).not.toHaveBeenCalled();
      expect(onLost).not.toHaveBeenCalled();
    });

    it('drops the report when the icon is lost while it waits: the icon is placed again as a lost one', async () => {
      controller.track(icon, editor, 'overlay');
      controller.awaitToolbar(() => found, onKept);

      toolbar.remove();
      await elapse(GRACE);

      expect(onKept).not.toHaveBeenCalled();
      expect(onLost).toHaveBeenCalledTimes(1);
    });

    it('ends the wait when the icon is lost, even when nothing is placed again (the site turned off)', async () => {
      controller.track(icon, editor, 'overlay');
      controller.awaitToolbar(() => found, onKept);

      // onLost places nothing: no new record, no new wait
      toolbar.remove();
      await elapse(DELAY);
      expect(onLost).toHaveBeenCalledTimes(1);
      await elapse(GRACE * 2);

      expect(vi.getTimerCount()).toBe(0);
      expect(onKept).not.toHaveBeenCalled();
    });
  });
});
