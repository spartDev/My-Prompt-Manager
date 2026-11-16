// @vitest-environment jsdom
// happy-dom keeps the result of editor.closest('div:has(…)') after a sibling of the editor changes,
// so a composer whose toolbar comes back would not be found again there

/**
 * The lifecycle of an icon placement override on a built-in Platform (design §6), from the content
 * script's side, on Claude's live composer fixture: the Platform renames its toolbar's test ids, so
 * the icon falls to the Anchored overlay and the fallback is reported; the user picks the send
 * button in Settings, so the icon is placed before it; a release (here, the Platform renaming them
 * back) makes the chain resolve again, so the override is dropped. The service worker's part is
 * played by the same storage change it makes, applyIconPlacementRepairChange under its lock.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { changeIconPlacementRepairs, type PlacementReport, readIconPlacementRepairs } from '../../../services/iconPlacementRepairs';
import { IconPlacementController } from '../icon-placement';
import { PromptLibraryInjector } from '../injector';
import { PLACEMENT_REPORT_MESSAGE } from '../placement-repair';

vi.mock('../insertion-manager', () => ({
  PlatformInsertionManager: vi.fn(function() {
    return {
      getAllSelectors: vi.fn().mockReturnValue(['div[contenteditable="true"]']),
      createIcon: vi.fn(() => document.createElement('button')),
      insertPrompt: vi.fn().mockResolvedValue({ success: true, method: 'direct' }),
      initializeStrategies: vi.fn(),
      cleanup: vi.fn(),
      getIconPlacement: vi.fn().mockReturnValue(undefined),
      getCustomSiteConfig: vi.fn().mockReturnValue(null)
    };
  })
}));

vi.mock('../anchored-overlay', () => ({
  INSIDE_CORNER_INSET: 8,
  AnchoredOverlay: vi.fn(function() {
    return {
      // As the overlay does, the icon goes into the page
      place: vi.fn(async (icon: HTMLElement) => {
        document.body.appendChild(icon);
        return 'floating-ui';
      }),
      release: vi.fn().mockReturnValue(false),
      placeWithCSSAnchor: vi.fn().mockReturnValue(false),
      placeWithFloatingUI: vi.fn().mockResolvedValue(false)
    };
  })
}));

vi.mock('../../ui/event-manager', () => ({
  EventManager: vi.fn(function() {
    return { addTrackedEventListener: vi.fn(), removeTrackedListeners: vi.fn(), cleanup: vi.fn() };
  })
}));

vi.mock('../../ui/element-factory', () => {
  const MockUIElementFactory = vi.fn(function() {
    return { createFloatingIcon: vi.fn().mockReturnValue(document.createElement('button')) };
  });
  (MockUIElementFactory as any).convertToAbsolutePositioning = vi.fn();
  (MockUIElementFactory as any).convertToRelativePositioning = vi.fn();
  return { UIElementFactory: MockUIElementFactory, fitPromptsPill: vi.fn(), syncPromptsPillTheme: vi.fn(), BAR_SEARCH_DEPTH: 6 };
});

vi.mock('../../selector/controller', () => ({
  PromptSelectorController: vi.fn(function() {
    return { toggle: vi.fn(), setTrigger: vi.fn(), close: vi.fn(), destroy: vi.fn(), isOpen: false };
  })
}));

vi.mock('../../selector/font', () => ({
  SELECTOR_FONT_FAMILY: 'MPM Schibsted Grotesk',
  loadSelectorFont: vi.fn().mockResolvedValue(true)
}));

vi.mock('../../utils/storage', () => ({
  getCategories: vi.fn().mockResolvedValue([]),
  getPrompts: vi.fn().mockResolvedValue([]),
  isSiteEnabled: vi.fn().mockResolvedValue(true),
  getSettings: vi.fn().mockResolvedValue({ platformChoices: { 'claude.ai': true }, customSites: [], debugMode: false })
}));

vi.mock('../../utils/styles', () => ({ injectCSS: vi.fn(), isInjected: vi.fn() }));

vi.mock('../../utils/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  isDebugMode: vi.fn().mockReturnValue(false),
  showDebugNotification: vi.fn(),
  refreshDebugMode: vi.fn()
}));

vi.mock('../../utils/element-fingerprint', () => ({
  getElementFingerprintGenerator: vi.fn().mockReturnValue({
    findElement: vi.fn().mockReturnValue(null),
    generateFingerprint: vi.fn()
  })
}));

Object.defineProperty(window, 'location', {
  value: { hostname: 'claude.ai', href: 'https://claude.ai/new' },
  writable: true
});

const CLAUDE_CHAIN = {
  composer: 'div:has([data-testid="chat-input-attach"], [data-testid="composer-dictate"])',
  anchors: [
    { find: '[data-testid="composer-dictate"]', relation: 'before' as const },
    { find: 'button[data-testid="chat-input-attach"]', relation: 'after' as const }
  ]
};

/** The element the user picks in the Element picker: Claude's send button */
const PICKED = '[data-testid="chat-input-send"]';

describe('icon placement override on a built-in Platform', () => {
  let injector: PromptLibraryInjector;
  let page: HTMLElement;
  let editor: HTMLElement;
  const reports: PlacementReport[] = [];

  const internals = (): any => injector as any;
  const icon = (): HTMLElement => internals().state.icon as HTMLElement;
  const stored = async () => (await readIconPlacementRepairs())['claude.ai'];
  /** Lets the storage write, its change event and the placement it starts run */
  const settle = () => new Promise((done) => setTimeout(done, 20));
  /** Lets a batch of DOM changes settle, and the toolbar it rendered be looked for */
  const toolbarLookedFor = () => new Promise((done) => setTimeout(done, IconPlacementController.REPLACE_DELAY_MS + 50));
  /** The time a Platform is given to render its toolbar after its editor: none, unless a test sets it */
  const grace = (ms: number) => {
    (IconPlacementController as unknown as { TOOLBAR_GRACE_MS: number }).TOOLBAR_GRACE_MS = ms;
  };
  const GRACE_MS = IconPlacementController.TOOLBAR_GRACE_MS;

  /** The Platform re-renders its toolbar with the test ids its chain anchors on renamed (or renamed back) */
  const renameToolbar = (from: string, to: string) => {
    for (const id of ['chat-input-attach', 'composer-dictate']) {
      const node = page.querySelector(`[data-testid="${from}${id}"]`);
      const rendered = node?.cloneNode(true) as HTMLElement | undefined;
      rendered?.setAttribute('data-testid', `${to}${id}`);
      if (node && rendered) {
        node.replaceWith(rendered);
      }
    }
  };

  /** The chain's second anchor shows, as a send button does once the field holds text */
  const showSecondAnchor = () => {
    const attach = page.querySelector('[data-testid="renamed-chat-input-attach"]') as HTMLElement;
    const rendered = attach.cloneNode(true) as HTMLElement;
    rendered.setAttribute('data-testid', 'chat-input-attach');
    attach.replaceWith(rendered);
  };

  beforeEach(async () => {
    reports.length = 0;
    grace(0);
    // The service worker: a placement report is applied to storage for the sender tab, tab 1, of its Platform
    vi.mocked(chrome.runtime.sendMessage).mockImplementation((async (message: { type: string; data: { placement: PlacementReport } }) => {
      if (message.type === PLACEMENT_REPORT_MESSAGE) {
        reports.push(message.data.placement);
        await changeIconPlacementRepairs({ type: 'reportPlacement', hostname: 'claude.ai', placement: message.data.placement, tabId: 1 });
      }
      return { success: true };
    }) as never);

    page = document.createElement('main');
    page.innerHTML = readFileSync(resolve(__dirname, '../../../../tests/fixtures/composers/claude.html'), 'utf8');
    document.body.appendChild(page);
    editor = page.querySelector<HTMLElement>('.ProseMirror[contenteditable="true"]') as HTMLElement;
    injector = new PromptLibraryInjector();
    internals().state.isSiteEnabled = true;
    internals().state.currentTextarea = editor;
    vi.mocked(internals().platformManager.getIconPlacement).mockReturnValue(CLAUDE_CHAIN);
    await internals().repair.load();
  });

  afterEach(() => {
    injector.cleanup();
    page.remove();
    grace(GRACE_MS);
  });

  it('gives a Platform five seconds to render its toolbar after its editor', () => {
    expect(GRACE_MS).toBe(5000);
  });

  it('puts the icon into a toolbar rendered after the editor, and reports nothing', async () => {
    grace(1000);
    // The editor is on the page, its toolbar buttons are not yet
    const buttons = Array.from(page.querySelectorAll('[data-testid="chat-input-attach"], [data-testid="composer-dictate"]'));
    const places = buttons.map((button) => ({ button, parent: button.parentElement, next: button.nextSibling }));
    for (const button of buttons) {
      button.remove();
    }

    await internals().injectIcon(editor);
    await settle();
    expect(icon().getAttribute('data-mpm-placement')).toBe('overlay');
    expect(reports).toEqual([]);

    // The Platform renders them
    for (const { button, parent, next } of places) {
      parent?.insertBefore(button, next);
    }
    await vi.waitFor(() => { expect(icon().getAttribute('data-mpm-placement')).toBe('toolbar'); }, { timeout: 1000 });

    expect(icon().getAttribute('data-mpm-anchor')).toBe('0');
    expect(icon().nextElementSibling?.getAttribute('data-testid')).toBe('composer-dictate');
    expect(reports).toEqual([]);
    expect(await stored()).toBeUndefined();
  });

  it('reports the overlay only once the toolbar is still missing after the grace period', async () => {
    grace(300);
    renameToolbar('', 'renamed-');

    await internals().injectIcon(editor);
    await toolbarLookedFor();
    expect(icon().getAttribute('data-mpm-placement')).toBe('overlay');
    expect(reports).toEqual([]);

    await vi.waitFor(() => { expect(reports).toEqual(['overlay']); }, { timeout: 1000 });
    expect(await stored()).toEqual({ status: 'overlay' });
  });

  it('moves the icon from the picked element into the toolbar once the Platform renders it, and drops the pick', async () => {
    grace(1000);
    renameToolbar('', 'renamed-');
    await changeIconPlacementRepairs({
      type: 'setOverride',
      hostname: 'claude.ai',
      positioning: { mode: 'custom', placement: 'before', selector: PICKED }
    });
    await internals().repair.load();
    await internals().injectIcon(editor);
    await settle();
    expect(icon().getAttribute('data-mpm-placement')).toBe('override');

    // Within the grace period: the Platform rendered its toolbar after its editor
    renameToolbar('renamed-', '');
    await vi.waitFor(() => { expect(icon().getAttribute('data-mpm-placement')).toBe('toolbar'); }, { timeout: 1000 });
    await settle();

    expect(icon().nextElementSibling?.getAttribute('data-testid')).toBe('composer-dictate');
    expect(await stored()).toBeUndefined();
  });

  it('keeps the icon at the picked element when only a later anchor of the chain shows within the grace period', async () => {
    grace(1000);
    renameToolbar('', 'renamed-');
    await changeIconPlacementRepairs({
      type: 'setOverride',
      hostname: 'claude.ai',
      positioning: { mode: 'custom', placement: 'before', selector: PICKED }
    });
    await internals().repair.load();
    await internals().injectIcon(editor);
    await settle();
    expect(icon().getAttribute('data-mpm-placement')).toBe('override');
    const placed = icon();

    // Within the grace period, the chain's second anchor shows; its first one, the toolbar the
    // chain was written for, does not
    showSecondAnchor();
    await new Promise((done) => setTimeout(done, 1000 + IconPlacementController.REPLACE_DELAY_MS + 50));

    expect(icon()).toBe(placed);
    expect(icon().getAttribute('data-mpm-placement')).toBe('override');
    expect(icon().nextElementSibling?.matches(PICKED)).toBe(true);
    expect(reports).not.toContain('toolbar');
    expect((await stored())?.status).toBe('override');
  });

  it('puts the icon at a later anchor of the chain while the picked element is missing, and back at it once it renders', async () => {
    grace(1000);
    renameToolbar('', 'renamed-');
    showSecondAnchor();
    const picked = page.querySelector(PICKED) as HTMLElement;
    const parent = picked.parentElement as HTMLElement;
    picked.remove();
    await changeIconPlacementRepairs({
      type: 'setOverride',
      hostname: 'claude.ai',
      positioning: { mode: 'custom', placement: 'before', selector: PICKED }
    });
    await internals().repair.load();
    reports.length = 0;
    await internals().injectIcon(editor);
    await settle();
    expect(icon().getAttribute('data-mpm-anchor')).toBe('1');
    expect(reports).toEqual([]);

    // The Platform renders the picked element after the rest of its composer
    parent.appendChild(picked);
    await vi.waitFor(() => { expect(icon().getAttribute('data-mpm-placement')).toBe('override'); }, { timeout: 1000 });

    expect(reports).not.toContain('toolbar');
    expect((await stored())?.override).toEqual({ mode: 'custom', placement: 'before', selector: PICKED });

    // A re-render takes the picked element and the icon out, and brings the element back late
    // again: the pick counts as it did the first time
    picked.remove();
    icon().remove();
    await vi.waitFor(() => { expect(icon().getAttribute('data-mpm-anchor')).toBe('1'); }, { timeout: 1000 });
    parent.appendChild(picked);
    await vi.waitFor(() => { expect(icon().getAttribute('data-mpm-placement')).toBe('override'); }, { timeout: 1000 });
    expect(reports).not.toContain('toolbar');
  });

  it('moves the icon from a later anchor into the chain\'s first one once it renders, and ends the pick', async () => {
    grace(1000);
    renameToolbar('', 'renamed-');
    showSecondAnchor();
    page.querySelector(PICKED)?.remove();
    await changeIconPlacementRepairs({
      type: 'setOverride',
      hostname: 'claude.ai',
      positioning: { mode: 'custom', placement: 'before', selector: PICKED }
    });
    await internals().repair.load();
    reports.length = 0;
    await internals().injectIcon(editor);
    await settle();
    expect(icon().getAttribute('data-mpm-anchor')).toBe('1');

    // Within the grace period, the toolbar the chain was written for renders
    const dictate = page.querySelector('[data-testid="renamed-composer-dictate"]') as HTMLElement;
    dictate.setAttribute('data-testid', 'composer-dictate');
    await toolbarLookedFor();

    expect(icon().getAttribute('data-mpm-anchor')).toBe('0');
    await vi.waitFor(() => { expect(reports).toEqual(['toolbar']); }, { timeout: 200 });
    expect(await stored()).toBeUndefined();
  });

  it('places the icon once more, not again and again, for a pick whose selector matches only while the icon is in the bar', async () => {
    grace(500);
    renameToolbar('', 'renamed-');
    showSecondAnchor();
    // A selector by position, as the Element picker writes when it has no better one: with the
    // icon after the attach button, it finds the next element; without it, nothing
    const byPosition = '[data-testid="chat-input-attach"] + button + div';
    await changeIconPlacementRepairs({
      type: 'setOverride',
      hostname: 'claude.ai',
      positioning: { mode: 'custom', placement: 'before', selector: byPosition }
    });
    await internals().repair.load();
    reports.length = 0;
    const placements = vi.spyOn(internals(), 'injectIcon');

    await internals().injectIcon(editor);
    await vi.waitFor(() => { expect(reports).toEqual(['toolbar']); }, { timeout: 1500 });

    expect(placements.mock.calls.length).toBeLessThanOrEqual(2);
    expect(icon().getAttribute('data-mpm-anchor')).toBe('1');
    expect(await stored()).toBeUndefined();
  });

  it('ends the pick once the grace period is over without the picked element, the icon at a later anchor of the chain', async () => {
    grace(300);
    renameToolbar('', 'renamed-');
    showSecondAnchor();
    page.querySelector(PICKED)?.remove();
    await changeIconPlacementRepairs({
      type: 'setOverride',
      hostname: 'claude.ai',
      positioning: { mode: 'custom', placement: 'before', selector: PICKED }
    });
    await internals().repair.load();
    reports.length = 0;
    await internals().injectIcon(editor);
    await settle();
    expect(reports).toEqual([]);

    await vi.waitFor(() => { expect(reports).toEqual(['toolbar']); }, { timeout: 1000 });
    expect(icon().getAttribute('data-mpm-anchor')).toBe('1');
    expect(await stored()).toBeUndefined();
  });

  it('reports nothing while the chain resolves: storage already says the icon is in the toolbar', async () => {
    await internals().injectIcon(editor);

    expect(icon().getAttribute('data-mpm-placement')).toBe('toolbar');
    expect(reports).toEqual([]);
  });

  it('reports the Anchored overlay when the Platform changed its toolbar', async () => {
    renameToolbar('', 'renamed-');

    await internals().injectIcon(editor);
    await settle();

    expect(icon().getAttribute('data-mpm-placement')).toBe('overlay');
    expect(reports).toEqual(['overlay']);
    expect(await stored()).toEqual({ status: 'overlay' });
  });

  it('places the icon before the element the user picked, then drops the pick once the chain resolves again', async () => {
    renameToolbar('', 'renamed-');
    await internals().injectIcon(editor);
    await settle();

    // Settings: "Place the icon", then a pick of the send button, stored by the service worker
    await changeIconPlacementRepairs({
      type: 'setOverride',
      hostname: 'claude.ai',
      positioning: { mode: 'custom', placement: 'before', selector: PICKED }
    });
    await settle();

    expect(icon().getAttribute('data-mpm-placement')).toBe('override');
    expect(icon().nextElementSibling?.matches(PICKED)).toBe(true);
    expect((await stored())?.status).toBe('override');

    // The next release finds the toolbar: the icon goes back to its anchor and the pick is dropped
    renameToolbar('renamed-', '');
    await internals().injectIcon(editor);
    await settle();

    expect(icon().getAttribute('data-mpm-placement')).toBe('toolbar');
    expect(icon().nextElementSibling?.getAttribute('data-testid')).toBe('composer-dictate');
    expect(reports).toEqual(['overlay', 'override', 'toolbar']);
    expect(await stored()).toBeUndefined();
    expect(internals().repair.positioning).toBeNull();
  });

  it('places the icon at the element the user picked once it renders after the editor, and reports no overlay', async () => {
    grace(1000);
    renameToolbar('', 'renamed-');
    const picked = page.querySelector(PICKED) as HTMLElement;
    const parent = picked.parentElement as HTMLElement;
    picked.remove();
    await changeIconPlacementRepairs({
      type: 'setOverride',
      hostname: 'claude.ai',
      positioning: { mode: 'custom', placement: 'before', selector: PICKED }
    });
    await internals().repair.load();
    reports.length = 0;

    await internals().injectIcon(editor);
    await settle();
    expect(icon().getAttribute('data-mpm-placement')).toBe('overlay');

    parent.appendChild(picked);
    await vi.waitFor(() => { expect(icon().getAttribute('data-mpm-placement')).toBe('override'); }, { timeout: 1000 });

    expect(icon().nextElementSibling).toBe(picked);
    expect(reports).not.toContain('overlay');
  });

  it('places the icon at the element the user picked, not at a later anchor of the chain, and keeps the pick', async () => {
    renameToolbar('', 'renamed-');
    showSecondAnchor();
    await changeIconPlacementRepairs({
      type: 'setOverride',
      hostname: 'claude.ai',
      positioning: { mode: 'custom', placement: 'before', selector: PICKED }
    });
    await internals().repair.load();
    await internals().injectIcon(editor);
    await settle();

    expect(icon().getAttribute('data-mpm-placement')).toBe('override');
    expect(icon().nextElementSibling?.matches(PICKED)).toBe(true);
    expect(reports).not.toContain('toolbar');
    expect((await stored())?.status).toBe('override');
  });

  it('puts the icon at a later anchor of the chain only once the grace period is over without the picked element', async () => {
    grace(500);
    renameToolbar('', 'renamed-');
    page.querySelector(PICKED)?.remove();
    await changeIconPlacementRepairs({
      type: 'setOverride',
      hostname: 'claude.ai',
      positioning: { mode: 'custom', placement: 'before', selector: PICKED }
    });
    await internals().repair.load();
    await internals().injectIcon(editor);
    await settle();
    expect(icon().getAttribute('data-mpm-placement')).toBe('overlay');

    // Within the grace period: the picked element may still render, and comes before it
    showSecondAnchor();
    await toolbarLookedFor();
    expect(icon().getAttribute('data-mpm-placement')).toBe('overlay');

    // The page settled without the picked element
    await vi.waitFor(() => { expect(icon().getAttribute('data-mpm-placement')).toBe('toolbar'); }, { timeout: 1000 });
    expect(icon().getAttribute('data-mpm-anchor')).toBe('1');
    expect(reports).not.toContain('overlay');
  });

  it('sends no placement for this tab while its icon waits on the overlay, when another tab stores a repair', async () => {
    grace(300);
    // The icon was in the toolbar, then the Platform re-rendered the composer without it
    await internals().injectIcon(editor);
    expect(icon().getAttribute('data-mpm-placement')).toBe('toolbar');
    renameToolbar('', 'renamed-');
    await internals().injectIcon(editor);
    expect(icon().getAttribute('data-mpm-placement')).toBe('overlay');

    // Another tab of the Platform reports the overlay: the Toolbar of before is no longer this tab's placement
    await changeIconPlacementRepairs({ type: 'reportPlacement', hostname: 'claude.ai', placement: 'overlay', tabId: 2 });
    await settle();
    expect(reports).toEqual([]);

    await vi.waitFor(() => { expect(reports).toEqual(['overlay']); }, { timeout: 1000 });
  });

  it('places the icon at an element picked while it waits at a later anchor of the chain', async () => {
    grace(1000);
    renameToolbar('', 'renamed-');
    showSecondAnchor();
    await changeIconPlacementRepairs({
      type: 'setOverride',
      hostname: 'claude.ai',
      positioning: { mode: 'custom', placement: 'before', selector: '[data-testid="not-rendered-yet"]' }
    });
    await internals().repair.load();
    await internals().injectIcon(editor);
    expect(icon().getAttribute('data-mpm-anchor')).toBe('1');

    // The user picks an element on the page, in this tab or another
    await changeIconPlacementRepairs({
      type: 'setOverride',
      hostname: 'claude.ai',
      positioning: { mode: 'custom', placement: 'before', selector: PICKED }
    });
    await settle();

    expect(icon().getAttribute('data-mpm-placement')).toBe('override');
    expect(icon().nextElementSibling?.getAttribute('data-testid')).toBe('chat-input-send');
  });

  it.each([
    ['once the grace period ended without the earlier pick', '[data-testid="not-rendered-yet"]'],
    ['when the user had no pick', null]
  ])('places the icon at an element picked after it settled at a later anchor of the chain, %s', async (_case, earlier) => {
    grace(50);
    renameToolbar('', 'renamed-');
    showSecondAnchor();
    if (earlier) {
      await changeIconPlacementRepairs({
        type: 'setOverride',
        hostname: 'claude.ai',
        positioning: { mode: 'custom', placement: 'before', selector: earlier }
      });
      await internals().repair.load();
    }
    await internals().injectIcon(editor);
    await vi.waitFor(() => { expect(internals().placement.current?.kind).toBe('toolbar'); });
    await new Promise((done) => setTimeout(done, 200));
    expect(icon().getAttribute('data-mpm-anchor')).toBe('1');

    // The user picks an element on the page: it comes before the chain's later anchors
    await changeIconPlacementRepairs({
      type: 'setOverride',
      hostname: 'claude.ai',
      positioning: { mode: 'custom', placement: 'before', selector: PICKED }
    });
    await settle();

    expect(icon().getAttribute('data-mpm-placement')).toBe('override');
    expect(icon().nextElementSibling?.getAttribute('data-testid')).toBe('chat-input-send');
  });

  it.each([
    ['keeps the icon at the chain\'s first anchor', false, true],
    ['places the icon again at a later anchor of the chain', true, false]
  ])('on a new pick, %s', async (_case, later, kept) => {
    if (later) {
      renameToolbar('', 'renamed-');
      showSecondAnchor();
    }
    await internals().injectIcon(editor);
    const placed = icon();
    expect(placed.getAttribute('data-mpm-anchor')).toBe(later ? '1' : '0');

    internals().handleOverrideChange();
    await settle();

    expect(icon() === placed).toBe(kept);
  });

  it('puts the icon at a later anchor of the chain rendered within the grace period when the user has no pick', async () => {
    grace(1000);
    renameToolbar('', 'renamed-');
    await internals().injectIcon(editor);
    await settle();
    expect(icon().getAttribute('data-mpm-placement')).toBe('overlay');

    showSecondAnchor();
    await toolbarLookedFor();

    expect(icon().getAttribute('data-mpm-placement')).toBe('toolbar');
    expect(icon().getAttribute('data-mpm-anchor')).toBe('1');
    expect(reports).toEqual([]);
  });

  it('does not take the icon itself for the element the user picked', async () => {
    grace(300);
    renameToolbar('', 'renamed-');
    await changeIconPlacementRepairs({
      type: 'setOverride',
      hostname: 'claude.ai',
      positioning: { mode: 'custom', placement: 'before', selector: 'button[data-prompt-library-icon]' }
    });
    await internals().repair.load();
    await internals().injectIcon(editor);
    const placed = icon();
    expect(placed.getAttribute('data-mpm-placement')).toBe('overlay');

    // On the overlay the icon is on the page, where the pick's selector now finds it
    await vi.waitFor(() => { expect(reports).toContain('overlay'); }, { timeout: 1000 });
    expect(icon()).toBe(placed);
    expect(placed.isConnected).toBe(true);
  });

  it('places the icon by the button whose inner icon the user clicked, not inside it', async () => {
    renameToolbar('', 'renamed-');
    page.querySelector(PICKED)?.insertAdjacentHTML('beforeend', '<svg><path id="picked-path"></path></svg>');

    await changeIconPlacementRepairs({
      type: 'setOverride',
      hostname: 'claude.ai',
      positioning: { mode: 'custom', placement: 'before', selector: '#picked-path' }
    });
    await internals().repair.load();
    await internals().injectIcon(editor);

    expect(icon().nextElementSibling?.matches(PICKED)).toBe(true);
  });

  it('keeps the icon on the overlay, and Settings offering to place it, when the picked element is gone', async () => {
    renameToolbar('', 'renamed-');
    page.querySelector(PICKED)?.remove();

    await changeIconPlacementRepairs({
      type: 'setOverride',
      hostname: 'claude.ai',
      positioning: { mode: 'custom', placement: 'before', selector: PICKED }
    });
    await internals().repair.load();
    await internals().injectIcon(editor);
    await settle();

    expect(icon().getAttribute('data-mpm-placement')).toBe('overlay');
    expect(await stored()).toEqual({
      status: 'overlay',
      override: { mode: 'custom', placement: 'before', selector: PICKED }
    });
  });

  it('keeps a pick made in another tab when its icon is in this tab\'s toolbar', async () => {
    // This tab finds the toolbar; another tab of the Platform, on another variant of its UI, does not
    await internals().injectIcon(editor);
    await changeIconPlacementRepairs({ type: 'reportPlacement', hostname: 'claude.ai', placement: 'overlay', tabId: 2 });
    await settle();

    // The user picks an element in that other tab, and the service worker stores it
    await changeIconPlacementRepairs({
      type: 'setOverride',
      hostname: 'claude.ai',
      positioning: { mode: 'custom', placement: 'before', selector: PICKED }
    });
    await settle();

    // This tab is counted with its Toolbar once the Platform has a repair, which keeps the pick
    expect(icon().getAttribute('data-mpm-placement')).toBe('toolbar');
    expect(reports).toEqual(['toolbar']);
    expect(await stored()).toEqual({
      status: 'overlay',
      override: { mode: 'custom', placement: 'before', selector: PICKED }
    });
  });
});
