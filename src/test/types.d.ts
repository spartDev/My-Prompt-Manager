import 'vitest';
import { vi } from 'vitest';

declare global {
  // Node.js globals for test environment
  var global: typeof globalThis;

  namespace NodeJS {
    interface Global {
      // Extending globalThis with additional properties if needed
      [key: string]: unknown;
    }
  }
}

// Mock function type for Vitest
type MockedFunction<T = any> = ReturnType<typeof vi.fn<any, T>>;

// Augment Chrome API types with mock properties
declare namespace chrome {
  namespace storage {
    interface StorageArea {
      get: MockedFunction<Promise<any>>;
      set: MockedFunction<Promise<void>>;
      clear: MockedFunction<Promise<void>>;
      getBytesInUse: MockedFunction<Promise<number>>;
    }
  }

  namespace runtime {
    interface RuntimeSendMessage {
      mockResolvedValue: (value: any) => MockedFunction;
      mockRejectedValue: (error: any) => MockedFunction;
      mockImplementation: (fn: any) => MockedFunction;
    }

    interface Runtime {
      sendMessage: SendMessageFunction;
      getManifest: MockedFunction;
      getURL: MockedFunction;
    }
  }

  namespace permissions {
    interface Permissions {
      request: MockedFunction<Promise<boolean>>;
      contains: MockedFunction<Promise<boolean>>;
      remove: MockedFunction<Promise<void>>;
    }
  }

  namespace tabs {
    interface Tabs {
      query: MockedFunction<Promise<chrome.tabs.Tab[]>>;
      get: MockedFunction<Promise<chrome.tabs.Tab>>;
      sendMessage: MockedFunction<Promise<unknown>>;
    }
  }

  namespace scripting {
    interface Scripting {
      executeScript: MockedFunction<Promise<chrome.scripting.InjectionResult[]>>;
    }
  }

  namespace action {
    interface Action {
      setPopup: MockedFunction<Promise<void>>;
      setTitle: MockedFunction<Promise<void>>;
      setIcon: MockedFunction<Promise<void>>;
    }
  }

  namespace windows {
    interface Windows {
      create: MockedFunction<Promise<chrome.windows.Window>>;
      remove: MockedFunction<Promise<void>>;
      update: MockedFunction<Promise<chrome.windows.Window>>;
    }
  }
}
export {};
