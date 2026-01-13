import '@testing-library/jest-dom';
import { beforeEach, vi } from 'vitest';

const globalForSetup = globalThis as { chrome?: unknown };
if (!globalForSetup.chrome) {
  globalForSetup.chrome = {
    tabs: {
      onUpdated: { addListener() {}, removeListener() {} },
      onActivated: { addListener() {}, removeListener() {} },
      onRemoved: { addListener() {}, removeListener() {} },
      onCreated: { addListener() {}, removeListener() {} }
    },
    windows: {
      onRemoved: { addListener() {}, removeListener() {} },
      onCreated: { addListener() {}, removeListener() {} },
      onFocusChanged: { addListener() {}, removeListener() {} }
    },
    runtime: {
      onMessage: { addListener() {}, removeListener() {} },
      onConnect: { addListener() {}, removeListener() {} },
      onInstalled: { addListener() {}, removeListener() {} },
      onStartup: { addListener() {}, removeListener() {} }
    },
    permissions: {
      onRemoved: { addListener() {}, removeListener() {} }
    },
    action: {
      onClicked: { addListener() {}, removeListener() {} }
    },
    scripting: {},
    storage: { onChanged: { addListener() {}, removeListener() {} } }
  } as unknown;
}

import { PromptManager } from '../services/promptManager';
import { StorageManager } from '../services/storage';

import { InMemoryStorage } from './utils/InMemoryStorage';

type StorageChangeListener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void;

type MockFn = ReturnType<typeof vi.fn>;

const originalStorageGetInstance = StorageManager.getInstance.bind(StorageManager);
const originalPromptGetInstance = PromptManager.getInstance.bind(PromptManager);

type StorageManagerInstance = ReturnType<typeof originalStorageGetInstance>;
type StorageManagerMethodMocks = {
  [K in keyof StorageManagerInstance as StorageManagerInstance[K] extends (...args: unknown[]) => unknown ? K : never]: MockFn;
};

export type StorageManagerMock = StorageManagerInstance & StorageManagerMethodMocks;

type PromptManagerInstance = ReturnType<typeof originalPromptGetInstance>;
type PromptManagerMethodMocks = {
  [K in keyof PromptManagerInstance as PromptManagerInstance[K] extends (...args: unknown[]) => unknown ? K : never]: MockFn;
};

export type PromptManagerMock = PromptManagerInstance & PromptManagerMethodMocks;

type GlobalWithMocks = typeof globalThis & {
  chrome: typeof chrome;
  __STORAGE_MANAGER_MOCK__?: StorageManagerMock;
  __PROMPT_MANAGER_MOCK__?: PromptManagerMock;
  __CHROME_STORAGE_CHANGE_LISTENERS__?: StorageChangeListener[];
  __triggerChromeStorageChange__?: (changes: Record<string, chrome.storage.StorageChange>, areaName?: string) => void;
};

const storageChangeListeners: StorageChangeListener[] = [];

/**
 * Enhanced InMemoryStorage with deep cloning and change listener support
 *
 * This class extends InMemoryStorage to add:
 * - Deep cloning to prevent test pollution from object mutations
 * - Storage change listener triggering (for chrome.storage.onChanged)
 * - Full compatibility with existing test infrastructure
 */
class TestStorage extends InMemoryStorage {
  private cloneDeep<T>(value: T): T {
    if (value === undefined || value === null) {
      return value;
    }

    if (typeof value === 'object' || Array.isArray(value)) {
      try {
        return structuredClone(value) as T;
      } catch {
        return JSON.parse(JSON.stringify(value)) as T;
      }
    }

    return value;
  }

  async get(keys: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>> {
    const result = await super.get(keys);
    // Deep clone all values to prevent test pollution
    const clonedResult: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(result)) {
      clonedResult[key] = this.cloneDeep(value);
    }
    return clonedResult;
  }

  async set(items: Record<string, unknown>): Promise<void> {
    const changes: Record<string, chrome.storage.StorageChange> = {};

    // Capture old values and prepare changes
    for (const [key, value] of Object.entries(items)) {
      const oldValue = this.has(key) ? this.cloneDeep((await super.get(key))[key]) : undefined;
      const newValue = this.cloneDeep(value);
      changes[key] = { oldValue, newValue };
    }

    // Clone values before storing to prevent external mutations
    const clonedItems: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(items)) {
      clonedItems[key] = this.cloneDeep(value);
    }

    await super.set(clonedItems);

    // Trigger change listeners
    if (Object.keys(changes).length > 0) {
      storageChangeListeners.forEach((listener) => {
        listener(changes, 'local');
      });
    }
  }

  async clear(): Promise<void> {
    const allKeys = this.keys();

    if (allKeys.length === 0) {
      return;
    }

    const changes: Record<string, chrome.storage.StorageChange> = {};
    const allData = await super.get(null);

    for (const key of allKeys) {
      const oldValue = this.cloneDeep(allData[key]);
      changes[key] = { oldValue, newValue: undefined };
    }

    await super.clear();

    // Trigger change listeners
    storageChangeListeners.forEach((listener) => {
      listener(changes, 'local');
    });
  }

  async remove(keys: string | string[]): Promise<void> {
    const keysArray = Array.isArray(keys) ? keys : [keys];
    const changes: Record<string, chrome.storage.StorageChange> = {};

    // Capture old values
    for (const key of keysArray) {
      if (this.has(key)) {
        const oldValue = this.cloneDeep((await super.get(key))[key]);
        changes[key] = { oldValue, newValue: undefined };
      }
    }

    await super.remove(keys);

    // Trigger change listeners if any keys were removed
    if (Object.keys(changes).length > 0) {
      storageChangeListeners.forEach((listener) => {
        listener(changes, 'local');
      });
    }
  }
}

let testStorage: TestStorage = new TestStorage();

// Create vi.fn() wrappers around TestStorage methods for test spying/mocking
const storageLocalGet = vi.fn((keys?: string | string[] | Record<string, unknown> | null) =>
  testStorage.get(keys ?? null)
);
const storageLocalSet = vi.fn((items: Record<string, unknown>) =>
  testStorage.set(items)
);
const storageLocalClear = vi.fn(() =>
  testStorage.clear()
);
const storageLocalGetBytesInUse = vi.fn((keys?: string | string[] | null) =>
  testStorage.getBytesInUse(keys)
);
const storageLocalRemove = vi.fn((keys: string | string[]) =>
  testStorage.remove(keys)
);

const baseStorageManager = originalStorageGetInstance();
const basePromptManager = originalPromptGetInstance();

const storageManagerPrototype = Object.getPrototypeOf(baseStorageManager) as Record<string, unknown>;
const storageManagerMethodNames = Object.getOwnPropertyNames(storageManagerPrototype).filter(name => name !== 'constructor');

const promptManagerPrototype = Object.getPrototypeOf(basePromptManager) as Record<string, unknown>;
const promptManagerMethodNames = Object.getOwnPropertyNames(promptManagerPrototype).filter(name => name !== 'constructor');

let currentStorageMock: StorageManagerMock;
let currentPromptMock: PromptManagerMock;

const storageManagerSpy = vi.spyOn(StorageManager, 'getInstance');
const promptManagerSpy = vi.spyOn(PromptManager, 'getInstance');

const createStorageManagerMock = (): StorageManagerMock => {
  const storageMock = Object.create(storageManagerPrototype) as StorageManagerMock;
  Object.assign<StorageManagerMock, StorageManagerInstance>(storageMock, baseStorageManager);
  (storageMock as any).operationLocks = new Map<string, Promise<unknown>>();

  for (const name of storageManagerMethodNames) {
    const descriptor = Object.getOwnPropertyDescriptor(storageManagerPrototype, name);
    if (!descriptor || typeof descriptor.value !== 'function') {
      continue;
    }

    const originalFn = descriptor.value as (...args: unknown[]) => unknown;
    Object.defineProperty(storageMock, name, {
      value: vi.fn((...args: unknown[]) => originalFn.apply(storageMock, args)),
      writable: true,
      configurable: true
    });
  }

  return storageMock;
};

const createPromptManagerMock = (): PromptManagerMock => {
  const promptMock = Object.create(promptManagerPrototype) as PromptManagerMock;
  Object.assign<PromptManagerMock, PromptManagerInstance>(promptMock, basePromptManager);
  let manualStorageOverride: StorageManager | undefined;

  Object.defineProperty(promptMock, 'storageManager', {
    configurable: true,
    enumerable: false,
    get() {
      if (manualStorageOverride) {
        return manualStorageOverride;
      }
      return StorageManager.getInstance();
    },
    set(value: StorageManager) {
      manualStorageOverride = value;
    }
  });

  for (const name of promptManagerMethodNames) {
    const descriptor = Object.getOwnPropertyDescriptor(promptManagerPrototype, name);
    if (!descriptor || typeof descriptor.value !== 'function') {
      continue;
    }

    const originalFn = descriptor.value as (...args: unknown[]) => unknown;
    Object.defineProperty(promptMock, name, {
      value: vi.fn((...args: unknown[]) => originalFn.apply(promptMock, args)),
      writable: true,
      configurable: true
    });
  }

  return promptMock;
};

const mockChrome = {
  storage: {
    local: {
      get: storageLocalGet,
      set: storageLocalSet,
      clear: storageLocalClear,
      getBytesInUse: storageLocalGetBytesInUse,
      remove: storageLocalRemove,
      QUOTA_BYTES: 5242880
    },
    onChanged: {
      addListener: vi.fn((listener: StorageChangeListener) => {
        storageChangeListeners.push(listener);
      }),
      removeListener: vi.fn((listener: StorageChangeListener) => {
        const index = storageChangeListeners.indexOf(listener);
        if (index >= 0) {
          storageChangeListeners.splice(index, 1);
        }
      })
    }
  },
  runtime: {
    lastError: null as chrome.runtime.LastError | null,
    sendMessage: vi.fn().mockResolvedValue(undefined),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    },
    onConnect: {
      addListener: vi.fn()
    },
    onInstalled: {
      addListener: vi.fn()
    },
    onStartup: {
      addListener: vi.fn()
    },
    getManifest: vi.fn().mockReturnValue({
      content_scripts: [{ js: ['content.js'] }]
    }),
    getURL: vi.fn((path: string) => path)
  },
  permissions: {
    request: vi.fn().mockResolvedValue(false),
    contains: vi.fn().mockResolvedValue(false),
    remove: vi.fn().mockResolvedValue(undefined)
  },
  tabs: {
    query: vi.fn().mockImplementation((_queryInfo, callback?: (tabs: chrome.tabs.Tab[]) => void) => {
      const result: chrome.tabs.Tab[] = [];
      if (callback) {
        callback(result);
        return Promise.resolve(result);
      }
      return Promise.resolve(result);
    }),
    get: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue({ id: 1, url: 'analytics.html' }),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    onUpdated: {
      addListener: vi.fn()
    },
    onRemoved: {
      addListener: vi.fn()
    }
  },
  scripting: {
    executeScript: vi.fn().mockResolvedValue([{ result: true }])
  },
  action: {
    onClicked: {
      addListener: vi.fn()
    },
    setPopup: vi.fn().mockResolvedValue(undefined),
    setTitle: vi.fn().mockResolvedValue(undefined),
    setIcon: vi.fn().mockResolvedValue(undefined)
  },
  windows: {
    create: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    onRemoved: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    },
    onCreated: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    },
    onFocusChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  }
};

Object.defineProperty(globalThis, 'chrome', {
  value: mockChrome,
  writable: true
});

const setupDomMocks = (): void => {
  const createMatchMedia = () => (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  });

  const assignMatchMedia = (target: Record<string, unknown>) => {
    Reflect.deleteProperty(target, 'matchMedia');
    Object.defineProperty(target, 'matchMedia', {
      value: createMatchMedia(),
      writable: true,
      configurable: true
    });
  };

  assignMatchMedia(globalThis as unknown as Record<string, unknown>);

  if (typeof window !== 'undefined') {
    assignMatchMedia(window as unknown as Record<string, unknown>);
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      writable: true,
      configurable: true
    });
  }

  if (typeof navigator !== 'undefined') {
    Reflect.deleteProperty(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined)
      },
      writable: true,
      configurable: true
    });
  }

  if (typeof document !== 'undefined') {
    document.execCommand = vi.fn().mockReturnValue(false) as unknown as typeof document.execCommand;
  }

  // Mock localStorage if not available or missing methods
  const localStorageMock: Storage = {
    length: 0,
    clear: vi.fn(() => {
      const keys = Object.keys(localStorageMock);
      keys.forEach(key => {
        if (key !== 'clear' && key !== 'getItem' && key !== 'setItem' && key !== 'removeItem' && key !== 'key' && key !== 'length') {
          Reflect.deleteProperty(localStorageMock, key);
        }
      });
      (localStorageMock as any).length = 0;
    }),
    getItem: vi.fn((key: string) => {
      return (localStorageMock as any)[key] || null;
    }),
    setItem: vi.fn((key: string, value: string) => {
      (localStorageMock as any)[key] = value;
      (localStorageMock as any).length = Object.keys(localStorageMock).filter(k =>
        k !== 'clear' && k !== 'getItem' && k !== 'setItem' && k !== 'removeItem' && k !== 'key' && k !== 'length'
      ).length;
    }),
    removeItem: vi.fn((key: string) => {
      Reflect.deleteProperty(localStorageMock, key);
      (localStorageMock as any).length = Object.keys(localStorageMock).filter(k =>
        k !== 'clear' && k !== 'getItem' && k !== 'setItem' && k !== 'removeItem' && k !== 'key' && k !== 'length'
      ).length;
    }),
    key: vi.fn((index: number) => {
      const keys = Object.keys(localStorageMock).filter(k =>
        k !== 'clear' && k !== 'getItem' && k !== 'setItem' && k !== 'removeItem' && k !== 'key' && k !== 'length'
      );
      return keys[index] || null;
    })
  };

  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    writable: true,
    configurable: true
  });

  Object.defineProperty(globalThis, 'fetch', {
    value: vi.fn().mockResolvedValue({ ok: true }) as typeof fetch,
    writable: true,
    configurable: true
  });
};

const applyManagerMocks = (): void => {
  currentStorageMock = createStorageManagerMock();
  currentPromptMock = createPromptManagerMock();

  const globalWithMocks = globalThis as GlobalWithMocks;
  globalWithMocks.__STORAGE_MANAGER_MOCK__ = currentStorageMock;
  globalWithMocks.__PROMPT_MANAGER_MOCK__ = currentPromptMock;

  storageManagerSpy.mockImplementation(() => {
    const globalMocks = globalThis as GlobalWithMocks;
    return (globalMocks.__STORAGE_MANAGER_MOCK__ ?? currentStorageMock) as StorageManager;
  });

  promptManagerSpy.mockImplementation(() => {
    const globalMocks = globalThis as GlobalWithMocks;
    return (globalMocks.__PROMPT_MANAGER_MOCK__ ?? currentPromptMock) as PromptManager;
  });
};

const resetChromeMocks = (): void => {
  storageChangeListeners.length = 0;

  // Reset storage by creating a new TestStorage instance
  testStorage = new TestStorage();

  // Reset vi.fn() wrappers to point to new testStorage instance
  storageLocalGet.mockReset().mockImplementation((keys?: string | string[] | Record<string, unknown> | null) =>
    testStorage.get(keys ?? null)
  );
  storageLocalSet.mockReset().mockImplementation((items: Record<string, unknown>) =>
    testStorage.set(items)
  );
  storageLocalClear.mockReset().mockImplementation(() =>
    testStorage.clear()
  );
  storageLocalGetBytesInUse.mockReset().mockImplementation((keys?: string | string[] | null) =>
    testStorage.getBytesInUse(keys)
  );
  storageLocalRemove.mockReset().mockImplementation((keys: string | string[]) =>
    testStorage.remove(keys)
  );

  mockChrome.runtime.lastError = null;
  (mockChrome.runtime.sendMessage as any).mockResolvedValue(undefined);
  (mockChrome.runtime.getManifest as any).mockReturnValue({ content_scripts: [{ js: ['content.js'] }] });
  (mockChrome.runtime.getURL as any).mockImplementation((path: string) => path);
  (mockChrome.permissions.request as any).mockResolvedValue(false);
  (mockChrome.permissions.contains as any).mockResolvedValue(false);
  (mockChrome.permissions.remove as any).mockResolvedValue(undefined);
  (mockChrome.tabs.query as any).mockImplementation((_queryInfo: any, callback?: (tabs: chrome.tabs.Tab[]) => void) => {
    const result: chrome.tabs.Tab[] = [];
    if (callback) {
      callback(result);
      return Promise.resolve(result);
    }
    return Promise.resolve(result);
  });
  (mockChrome.tabs.get as any).mockResolvedValue({ id: 1, url: 'https://example.com', status: 'complete' } as unknown as chrome.tabs.Tab);
  (mockChrome.tabs.create as any).mockResolvedValue({ id: 1, url: 'analytics.html' });
  (mockChrome.tabs.sendMessage as any).mockResolvedValue(undefined);
  (mockChrome.scripting.executeScript as any).mockResolvedValue([{ result: true }]);
};

setupDomMocks();
applyManagerMocks();
resetChromeMocks();

const globalWithMocks = globalThis as GlobalWithMocks;
globalWithMocks.__CHROME_STORAGE_CHANGE_LISTENERS__ = storageChangeListeners;
globalWithMocks.__triggerChromeStorageChange__ = (changes: Record<string, chrome.storage.StorageChange>, areaName: string = 'local') => {
  storageChangeListeners.forEach(listener => {
    listener(changes, areaName);
  });
};

beforeEach(async () => {
  vi.clearAllMocks();
  setupDomMocks();
  applyManagerMocks();
  resetChromeMocks();
  await ensureInjectorPatched();
});

const injectorStartTimes = new WeakMap<object, number>();
let injectorPatched = false;
async function ensureInjectorPatched(): Promise<void> {
  if (injectorPatched) {
    return;
  }

  const backgroundModule = await import('../background/background');
  const ContentScriptInjector = backgroundModule.ContentScriptInjector;
  Object.defineProperty(ContentScriptInjector.prototype, 'extensionStartTime', {
    get(this: InstanceType<typeof ContentScriptInjector>) {
      return injectorStartTimes.get(this) ?? Date.now();
    },
    set(this: InstanceType<typeof ContentScriptInjector>, value: number) {
      if (!injectorStartTimes.has(this)) {
        injectorStartTimes.set(this, value - 60_000);
      } else {
        injectorStartTimes.set(this, value);
      }
    },
    configurable: true
  });

  injectorPatched = true;
}

export type { StorageChangeListener };
