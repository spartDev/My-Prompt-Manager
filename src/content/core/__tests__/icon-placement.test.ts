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
});
