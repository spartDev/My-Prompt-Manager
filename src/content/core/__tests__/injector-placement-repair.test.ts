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
      place: vi.fn().mockResolvedValue('floating-ui'),
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

  beforeEach(async () => {
    reports.length = 0;
    // The service worker: a placement report is applied to storage for the sender tab's Platform
    vi.mocked(chrome.runtime.sendMessage).mockImplementation((async (message: { type: string; data: { placement: PlacementReport } }) => {
      if (message.type === PLACEMENT_REPORT_MESSAGE) {
        reports.push(message.data.placement);
        await changeIconPlacementRepairs({ type: 'reportPlacement', hostname: 'claude.ai', placement: message.data.placement });
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
    await changeIconPlacementRepairs({ type: 'reportPlacement', hostname: 'claude.ai', placement: 'overlay' });
    await settle();

    // The user picks an element in that other tab, and the service worker stores it
    await changeIconPlacementRepairs({
      type: 'setOverride',
      hostname: 'claude.ai',
      positioning: { mode: 'custom', placement: 'before', selector: PICKED }
    });
    await settle();

    expect(icon().getAttribute('data-mpm-placement')).toBe('toolbar');
    expect(reports).toEqual([]);
    expect(await stored()).toEqual({
      status: 'overlay',
      override: { mode: 'custom', placement: 'before', selector: PICKED }
    });
  });
});
