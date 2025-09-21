import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Chrome API
const mockChrome = {
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      clear: vi.fn(),
      getBytesInUse: vi.fn(),
      QUOTA_BYTES: 5242880 // 5MB
    }
  },
  runtime: {
    lastError: null,
    sendMessage: vi.fn().mockResolvedValue(undefined),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  },
  permissions: {
    request: vi.fn().mockResolvedValue(false),
    contains: vi.fn().mockResolvedValue(false),
    remove: vi.fn().mockResolvedValue(undefined)
  },
  tabs: {
    query: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(undefined)
  }
};

Object.defineProperty(global, 'chrome', {
  value: mockChrome,
  writable: true
});

// Reset mocks before each test
// eslint-disable-next-line @typescript-eslint/no-unsafe-call
beforeEach(() => {
  vi.clearAllMocks();
  mockChrome.runtime.lastError = null;
});
