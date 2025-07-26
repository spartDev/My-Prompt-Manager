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
    lastError: null
  }
};

Object.defineProperty(global, 'chrome', {
  value: mockChrome,
  writable: true
});

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  mockChrome.runtime.lastError = null;
});