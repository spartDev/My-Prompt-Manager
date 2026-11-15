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
    const GRACE_MS = IconPlacementController.TOOLBAR_GRACE_MS;
    const setGrace = (ms: number) => {
      (IconPlacementController as unknown as { TOOLBAR_GRACE_MS: number }).TOOLBAR_GRACE_MS = ms;
    };
    let found: boolean;
    let onKept: ReturnType<typeof vi.fn<() => void>>;

    beforeEach(() => {
      found = false;
      onKept = vi.fn();
      setGrace(300);
    });

    afterEach(() => {
      setGrace(GRACE_MS);
    });

    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    it('places the icon again once a change of the page brings the toolbar, and keeps no report', async () => {
      controller.track(icon, editor, 'overlay');
      controller.awaitToolbar(() => found, onKept);

      found = true;
      document.body.appendChild(document.createElement('div'));
      await afterReplaceDelay();

      expect(onLost).toHaveBeenCalledWith(editor);
      expect(controller.current).toBeNull();
      await wait(400);
      expect(onKept).not.toHaveBeenCalled();
    });

    it('looks for the toolbar once when it starts waiting: the toolbar may have rendered while the icon was placed', async () => {
      found = true;
      controller.track(icon, editor, 'overlay');
      controller.awaitToolbar(() => found, onKept);

      await afterReplaceDelay();

      expect(onLost).toHaveBeenCalledTimes(1);
    });

    it('says the toolbar is kept missing once the grace period is over, and still moves the icon when it comes later', async () => {
      controller.track(icon, editor, 'overlay');
      controller.awaitToolbar(() => found, onKept);

      await wait(400);
      expect(onKept).toHaveBeenCalledTimes(1);
      expect(onLost).not.toHaveBeenCalled();

      found = true;
      document.body.appendChild(document.createElement('div'));
      await wait(IconPlacementController.SLOW_TOOLBAR_CHECK_MS + 100);
      expect(onLost).toHaveBeenCalledWith(editor);
    });

    it('moves the icon instead of reporting when the toolbar is there at the end of the grace period, with no change seen', async () => {
      controller.track(icon, editor, 'overlay');
      controller.awaitToolbar(() => found, onKept);
      await afterReplaceDelay();

      found = true;
      await wait(400);

      expect(onKept).not.toHaveBeenCalled();
      expect(onLost).toHaveBeenCalledWith(editor);
    });

    it('looks for the toolbar at most every SLOW_TOOLBAR_CHECK_MS once the grace period is over', async () => {
      let checks = 0;
      controller.track(icon, editor, 'overlay');
      controller.awaitToolbar(() => { checks++; return found; }, onKept);
      await wait(400);
      expect(onKept).toHaveBeenCalledTimes(1);
      checks = 0;

      // A busy page: a change every 20 ms, well within the slow period
      for (let index = 0; index < 10; index++) {
        document.body.appendChild(document.createElement('div'));
        await wait(20);
      }
      // At most the one check the first change of the burst armed, and only once its period is over
      expect(checks).toBeLessThanOrEqual(1);
      found = true;
      await wait(IconPlacementController.SLOW_TOOLBAR_CHECK_MS);
      expect(checks).toBe(1);
      expect(onLost).toHaveBeenCalledTimes(1);
    });

    it('reports nothing for an editor that left the page during the grace period', async () => {
      controller.track(icon, editor, 'overlay');
      controller.awaitToolbar(() => found, onKept);

      editor.remove();
      await wait(400);

      expect(onKept).not.toHaveBeenCalled();
    });

    it('goes on waiting when the icon is out of the page for a moment and back', async () => {
      controller.track(icon, editor, 'overlay');
      controller.awaitToolbar(() => found, onKept);

      icon.remove();
      document.body.appendChild(document.createElement('div'));
      await Promise.resolve();
      toolbar.appendChild(icon);
      await afterReplaceDelay();
      expect(onLost).not.toHaveBeenCalled();

      found = true;
      document.body.appendChild(document.createElement('div'));
      await afterReplaceDelay();
      expect(onLost).toHaveBeenCalledWith(editor);
      expect(onKept).not.toHaveBeenCalled();
    });

    it('looks for the toolbar when the icon is back in the page, without a later change', async () => {
      controller.track(icon, editor, 'override');
      controller.awaitToolbar(() => found);
      // The look it starts with is over
      await wait(IconPlacementController.SLOW_TOOLBAR_CHECK_MS + 100);

      // The Platform takes the icon's node out, renders its toolbar, and puts the node back
      icon.remove();
      await wait(0);
      found = true;
      toolbar.appendChild(icon);
      // At a pick, the toolbar is looked for at the slow pace
      await wait(IconPlacementController.REPLACE_DELAY_MS + IconPlacementController.SLOW_TOOLBAR_CHECK_MS + 100);

      expect(onLost).toHaveBeenCalledWith(editor);
    });

    it('reports nothing when the grace period ends while the icon is out of the page', async () => {
      controller.track(icon, editor, 'overlay');
      controller.awaitToolbar(() => found, onKept);

      await wait(250);
      toolbar.remove();
      await wait(400);

      expect(onKept).not.toHaveBeenCalled();
      expect(onLost).toHaveBeenCalledTimes(1);
    });

    it('stops waiting on reset: no report, no re-placement once the site is turned off', async () => {
      controller.track(icon, editor, 'overlay');
      controller.awaitToolbar(() => found, onKept);

      controller.reset();
      found = true;
      document.body.appendChild(document.createElement('div'));
      await wait(400);

      expect(onKept).not.toHaveBeenCalled();
      expect(onLost).not.toHaveBeenCalled();
    });

    it('drops the report when the icon is lost while it waits: the icon is placed again as a lost one', async () => {
      controller.track(icon, editor, 'overlay');
      controller.awaitToolbar(() => found, onKept);

      toolbar.remove();
      await wait(400);

      expect(onKept).not.toHaveBeenCalled();
      expect(onLost).toHaveBeenCalledTimes(1);
    });
  });
});
