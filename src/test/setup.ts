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
const storageState: Record<string, unknown> = {};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const cloneDeep = <T>(value: T): T => {
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
};

const getSnapshot = (keys?: string | string[] | Record<string, unknown>): Record<string, unknown> => {
  if (keys === undefined) {
    return Object.fromEntries(
      Object.entries(storageState).map(([key, value]) => [key, cloneDeep(value)])
    );
  }

  if (typeof keys === 'string') {
    return { [keys]: cloneDeep(storageState[keys]) };
  }

  if (Array.isArray(keys)) {
    const result: Record<string, unknown> = {};
    keys.forEach((key) => {
      result[key] = cloneDeep(storageState[key]);
    });
    return result;
  }

  if (!isRecord(keys)) {
    return {};
  }
  const result: Record<string, unknown> = {};
  Object.entries(keys).forEach(([key, defaultValue]) => {
    if (key in storageState) {
      result[key] = cloneDeep(storageState[key]);
    } else {
      result[key] = cloneDeep(defaultValue);
    }
  });
  return result;
};

const calculateBytes = (keys?: string | string[] | Record<string, unknown>): number => {
  const keyList = keys === undefined
    ? Object.keys(storageState)
    : typeof keys === 'string'
      ? [keys]
      : Array.isArray(keys)
        ? keys
        : Object.keys(keys);

  const encoder = new TextEncoder();

  return keyList.reduce((total, key) => {
    if (!(key in storageState)) {
      return total;
    }
    try {
      const serialized = JSON.stringify(storageState[key]);
      if (typeof serialized !== 'string') {
        return total;
      }
      return total + encoder.encode(serialized).length;
    } catch {
      return total;
    }
  }, 0);
};

const storageLocalGet = vi.fn();
const storageLocalSet = vi.fn();
const storageLocalClear = vi.fn();
const storageLocalGetBytesInUse = vi.fn();

const applyStorageImplementations = (): void => {
  storageLocalGet.mockImplementation((keys?: string | string[] | Record<string, unknown>) =>
    Promise.resolve(getSnapshot(keys))
  );

  storageLocalSet.mockImplementation((items: Record<string, unknown>) => {
    const changes: Record<string, chrome.storage.StorageChange> = {};

    Object.entries(items).forEach(([key, value]) => {
      const oldValue = key in storageState ? cloneDeep(storageState[key]) : undefined;
      const newValue = cloneDeep(value);
      storageState[key] = newValue;
      changes[key] = { oldValue, newValue };
    });

    if (Object.keys(changes).length > 0) {
      storageChangeListeners.forEach((listener) => {
        listener(changes, 'local');
      });
    }

    return Promise.resolve();
  });

  storageLocalClear.mockImplementation(() => {
    if (Object.keys(storageState).length === 0) {
      return Promise.resolve();
    }

    const changes: Record<string, chrome.storage.StorageChange> = {};
    Object.keys(storageState).forEach((key) => {
      const oldValue = cloneDeep(storageState[key]);
      Reflect.deleteProperty(storageState, key);
      changes[key] = { oldValue, newValue: undefined };
    });

    storageChangeListeners.forEach((listener) => {
      listener(changes, 'local');
    });

    return Promise.resolve();
  });

  storageLocalGetBytesInUse.mockImplementation((keys?: string | string[] | Record<string, unknown>) =>
    Promise.resolve(calculateBytes(keys))
  );
};

applyStorageImplementations();

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
  Object.keys(storageState).forEach((key) => {
    Reflect.deleteProperty(storageState, key);
  });

  storageLocalGet.mockReset();
  storageLocalSet.mockReset();
  storageLocalClear.mockReset();
  storageLocalGetBytesInUse.mockReset();
  applyStorageImplementations();

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
