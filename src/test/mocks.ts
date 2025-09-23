import type { StorageManagerMock, PromptManagerMock } from './setup';

type GlobalWithMocks = typeof globalThis & {
  chrome: typeof chrome;
  __STORAGE_MANAGER_MOCK__?: StorageManagerMock;
  __PROMPT_MANAGER_MOCK__?: PromptManagerMock;
  __triggerChromeStorageChange__?: (changes: Record<string, unknown>, areaName?: string) => void;
};

const getGlobal = (): GlobalWithMocks => globalThis as GlobalWithMocks;

export const getMockStorageManager = (): StorageManagerMock => {
  const storageMock = getGlobal().__STORAGE_MANAGER_MOCK__;
  if (!storageMock) {
    throw new Error('StorageManager mock is not initialized. Ensure setup.ts has been executed.');
  }
  return storageMock;
};

export const getMockPromptManager = (): PromptManagerMock => {
  const promptMock = getGlobal().__PROMPT_MANAGER_MOCK__;
  if (!promptMock) {
    throw new Error('PromptManager mock is not initialized. Ensure setup.ts has been executed.');
  }
  return promptMock;
};

export const getChromeMock = (): typeof chrome => getGlobal().chrome;

// Export proper mock functions for direct use in tests
export const getChromeMockFunctions = () => {
  const chromeApi = getGlobal().chrome;
  return {
    storage: {
      local: {
        get: chromeApi.storage.local.get,
        set: chromeApi.storage.local.set,
        clear: chromeApi.storage.local.clear,
        getBytesInUse: chromeApi.storage.local.getBytesInUse,
      }
    },
    tabs: {
      query: chromeApi.tabs.query,
      get: chromeApi.tabs.get,
      sendMessage: chromeApi.tabs.sendMessage,
    },
    runtime: {
      sendMessage: chromeApi.runtime.sendMessage,
      getManifest: chromeApi.runtime.getManifest,
      getURL: chromeApi.runtime.getURL,
    },
    permissions: {
      request: chromeApi.permissions.request,
      contains: chromeApi.permissions.contains,
      remove: chromeApi.permissions.remove,
    },
    scripting: {
      executeScript: chromeApi.scripting.executeScript,
    }
  };
};

export const triggerChromeStorageChange = (changes: Record<string, unknown>, areaName: string = 'local'): void => {
  const trigger = getGlobal().__triggerChromeStorageChange__;
  if (trigger) {
    trigger(changes, areaName);
  }
};

export type { StorageManagerMock, PromptManagerMock };
