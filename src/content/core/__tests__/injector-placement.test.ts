/**
 * The injector places the Library icon at the anchor its Platform's chain names in the composer,
 * and places it again when the Platform removes the toolbar node the icon sat by. Run on Claude's
 * live composer fixture (tests/fixtures/composers/claude.html). A file of its own: an injector
 * left over by another test would adopt this editor and take the icon away.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IconPlacementController } from '../icon-placement';
import { PromptLibraryInjector } from '../injector';

vi.mock('../insertion-manager', () => ({
  PlatformInsertionManager: vi.fn(function() {
    return {
      getAllSelectors: vi.fn().mockReturnValue(['textarea', 'div[contenteditable="true"]']),
      createIcon: vi.fn(() => document.createElement('button')),
      insertPrompt: vi.fn().mockResolvedValue({ success: true, method: 'direct' }),
      initializeStrategies: vi.fn(),
      cleanup: vi.fn(),
      getIconPlacement: vi.fn().mockReturnValue(undefined),
      getCustomSiteConfig: vi.fn().mockReturnValue(null)
    };
  })
}));

vi.mock('../../ui/event-manager', () => ({
  EventManager: vi.fn(function() {
    return {
      addTrackedEventListener: vi.fn(),
      removeTrackedListeners: vi.fn(),
      cleanup: vi.fn()
    };
  })
}));

vi.mock('../../ui/element-factory', () => {
  const MockUIElementFactory = vi.fn(function() {
    return {
      createFloatingIcon: vi.fn().mockReturnValue(document.createElement('button'))
    };
  });
  // Add static methods
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
  isSiteEnabled: vi.fn().mockImplementation((hostname) => {
    // Make sure localhost is enabled for tests
    return Promise.resolve(hostname === 'localhost' || hostname === 'test.com');
  }),
  getSettings: vi.fn().mockResolvedValue({
    enabledSites: ['test.com', 'localhost'],
    customSites: [],
    debugMode: false,
    floatingFallback: true
  }),
  getDefaultSettings: vi.fn().mockReturnValue({
    enabledSites: ['test.com', 'localhost'],
    customSites: [],
    debugMode: false,
    floatingFallback: true
  })
}));

vi.mock('../../utils/styles', () => ({
  injectCSS: vi.fn(),
  isInjected: vi.fn()
}));

vi.mock('../../utils/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  isDebugMode: vi.fn().mockReturnValue(false),
  showDebugNotification: vi.fn(),
  refreshDebugMode: vi.fn()
}));

vi.mock('../../utils/dom', () => ({
  DOMUtils: {
    supportsCSSAnchorPositioning: vi.fn().mockReturnValue(false),
    insertBefore: vi.fn().mockReturnValue(true),
    insertAfter: vi.fn().mockReturnValue(true),
    prependChild: vi.fn().mockReturnValue(true),
    appendChild: vi.fn().mockReturnValue(true)
  }
}));

vi.mock('../../utils/element-fingerprint', () => ({
  getElementFingerprintGenerator: vi.fn().mockReturnValue({
    findElement: vi.fn().mockReturnValue(null),
    generateFingerprint: vi.fn()
  })
}));

vi.mock('../../../config/platforms', () => ({
  getPlatformByHostname: vi.fn().mockReturnValue(null)
}));

// Mock DOM methods
Object.defineProperty(window, 'location', {
  value: {
    hostname: 'test.example.com',
    href: 'https://test.example.com/test'
  },
  writable: true
});

Object.defineProperty(document, 'readyState', {
  value: 'complete',
  writable: true
});

// Mock hostname to match enabled sites
Object.defineProperty(window, 'location', {
  value: {
    hostname: 'localhost',
    href: 'http://localhost:3000'
  },
  writable: true
});

// Mock chrome runtime for message handling
Object.defineProperty(global, 'chrome', {
  value: {
    ...global.chrome,
    runtime: {
      ...global.chrome?.runtime,
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
        hasListener: vi.fn()
      }
    }
  },
  writable: true
});

// Mock matchMedia for theme manager
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});


const CLAUDE_CHAIN = {
  composer: 'div:has([data-testid="chat-input-attach"], [data-testid="composer-dictate"])',
  anchors: [
    { find: '[data-testid="composer-dictate"]', relation: 'before' as const },
    { find: 'button[data-testid="chat-input-attach"]', relation: 'after' as const }
  ]
};

describe('icon placement in the composer', () => {
  let injector: PromptLibraryInjector;
  let page: HTMLElement;
  let editor: HTMLElement;

  /** The injector's private state and collaborators, which only these tests set up by hand */
  const internals = (): any => injector as any;

  beforeEach(() => {
    page = document.createElement('main');
    page.innerHTML = readFileSync(resolve(__dirname, '../../../../tests/fixtures/composers/claude.html'), 'utf8');
    document.body.appendChild(page);
    editor = page.querySelector<HTMLElement>('[data-testid="chat-input"]') as HTMLElement;
    injector = new PromptLibraryInjector();
    internals().state.isSiteEnabled = true;
    internals().state.currentTextarea = editor;
    vi.mocked(internals().platformManager.getIconPlacement).mockReturnValue(CLAUDE_CHAIN);
  });

  afterEach(() => {
    injector.cleanup();
    page.remove();
  });

  it('places the icon at the first anchor of the Platform chain', async () => {
    await internals().injectIcon(editor);

    const icon = internals().state.icon as HTMLElement;
    expect(icon.nextElementSibling?.getAttribute('data-testid')).toBe('composer-dictate');
    expect(icon.getAttribute('data-mpm-anchor')).toBe('0');
  });

  it('places the icon again when the Platform removes the toolbar node it sat by', async () => {
    await internals().injectIcon(editor);
    const dictate = page.querySelector('[data-testid="composer-dictate"]') as HTMLElement;

    dictate.parentElement?.remove();
    await new Promise((done) => setTimeout(done, IconPlacementController.REPLACE_DELAY_MS * 3));

    const icon = internals().state.icon as HTMLElement;
    expect(icon.isConnected).toBe(true);
    expect(icon.previousElementSibling?.getAttribute('data-testid')).toBe('chat-input-attach');
    expect(icon.getAttribute('data-mpm-anchor')).toBe('1');
  });
});
