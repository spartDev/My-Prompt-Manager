/**
 * Unit tests for Logger utility module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import * as Logger from '../logger';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

// Mock console methods
const consoleMock = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

// Mock DOM methods
const documentMock = {
  createElement: vi.fn(),
  body: {
    appendChild: vi.fn(),
  },
};

describe('Logger', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup global mocks
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
    
    Object.defineProperty(window, 'location', {
      value: { hostname: 'example.com', href: 'https://example.com/test' },
      writable: true,
    });
    
    Object.defineProperty(window, 'navigator', {
      value: { userAgent: 'Test User Agent' },
      writable: true,
    });
    
    Object.defineProperty(global, 'console', {
      value: consoleMock,
      writable: true,
    });
    
    Object.defineProperty(global, 'document', {
      value: documentMock,
      writable: true,
    });
    
    // Mock setTimeout
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('isDebugMode', () => {
    it('should return true when localStorage flag is set', () => {
      localStorageMock.getItem.mockReturnValue('true');
      expect(Logger.isDebugMode()).toBe(true);
      expect(localStorageMock.getItem).toHaveBeenCalledWith('prompt-library-debug');
    });

    it('should return false when localStorage flag is not set', () => {
      localStorageMock.getItem.mockReturnValue(null);
      expect(Logger.isDebugMode()).toBe(false);
    });

    it('should return true when hostname is localhost', () => {
      localStorageMock.getItem.mockReturnValue(null);
      Object.defineProperty(window, 'location', {
        value: { hostname: 'localhost', href: 'http://localhost:3000' },
        writable: true,
      });
      expect(Logger.isDebugMode()).toBe(true);
    });

    it('should handle localStorage errors gracefully', () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('localStorage not available');
      });
      Object.defineProperty(window, 'location', {
        value: { hostname: 'localhost', href: 'http://localhost:3000' },
        writable: true,
      });
      expect(Logger.isDebugMode()).toBe(true);
    });
  });

  describe('error', () => {
    it('should log error with proper structure', () => {
      const message = 'Test error message';
      const error = new Error('Test error');
      const context = { testKey: 'testValue' };

      Logger.error(message, error, context);

      expect(consoleMock.error).toHaveBeenCalledWith(
        '[PromptLibrary]',
        message,
        expect.objectContaining({
          timestamp: expect.any(String),
          level: 'ERROR',
          message,
          context,
          url: 'https://example.com/test',
          userAgent: 'Test User Agent',
          error: {
            name: 'Error',
            message: 'Test error',
            stack: expect.any(String),
          },
        })
      );
    });

    it('should log error without error object', () => {
      const message = 'Test error message';
      const context = { testKey: 'testValue' };

      Logger.error(message, null, context);

      expect(consoleMock.error).toHaveBeenCalledWith(
        '[PromptLibrary]',
        message,
        expect.objectContaining({
          level: 'ERROR',
          message,
          context,
        })
      );
    });

    it('should show debug notification in debug mode', () => {
      localStorageMock.getItem.mockReturnValue('true');
      const mockElement = { style: {}, textContent: '' };
      documentMock.createElement.mockReturnValue(mockElement);

      Logger.error('Test error');

      expect(documentMock.createElement).toHaveBeenCalledWith('div');
      expect(documentMock.body.appendChild).toHaveBeenCalledWith(mockElement);
    });
  });

  describe('warn', () => {
    it('should log warning with proper structure', () => {
      const message = 'Test warning message';
      const context = { testKey: 'testValue' };

      Logger.warn(message, context);

      expect(consoleMock.warn).toHaveBeenCalledWith(
        '[PromptLibrary]',
        message,
        expect.objectContaining({
          timestamp: expect.any(String),
          level: 'WARN',
          message,
          context,
          url: 'https://example.com/test',
        })
      );
    });
  });

  describe('info', () => {
    it('should log info only in debug mode', () => {
      localStorageMock.getItem.mockReturnValue('true');
      const message = 'Test info message';
      const context = { testKey: 'testValue' };

      Logger.info(message, context);

      expect(consoleMock.info).toHaveBeenCalledWith(
        '[PromptLibrary]',
        message,
        expect.objectContaining({
          level: 'INFO',
          message,
          context,
        })
      );
    });

    it('should not log info when not in debug mode', () => {
      localStorageMock.getItem.mockReturnValue(null);
      Logger.info('Test info message');
      expect(consoleMock.info).not.toHaveBeenCalled();
    });
  });

  describe('debug', () => {
    it('should log debug only in debug mode', () => {
      localStorageMock.getItem.mockReturnValue('true');
      const message = 'Test debug message';
      const context = { testKey: 'testValue' };

      Logger.debug(message, context);

      expect(consoleMock.debug).toHaveBeenCalledWith(
        '[PromptLibrary]',
        message,
        expect.objectContaining({
          level: 'DEBUG',
          message,
          context,
        })
      );
    });

    it('should not log debug when not in debug mode', () => {
      localStorageMock.getItem.mockReturnValue(null);
      Logger.debug('Test debug message');
      expect(consoleMock.debug).not.toHaveBeenCalled();
    });
  });

  describe('showDebugNotification', () => {
    beforeEach(() => {
      // Reset the static property before each test
      (Logger as any)._lastNotification = null;
      
      const mockElement = { 
        style: { cssText: '' }, 
        textContent: '',
        parentNode: document.body,
        remove: vi.fn()
      };
      documentMock.createElement.mockReturnValue(mockElement);
    });

    it('should show notification in debug mode', () => {
      localStorageMock.getItem.mockReturnValue('true');
      const message = 'Test notification';

      Logger.showDebugNotification(message, 'info');

      expect(documentMock.createElement).toHaveBeenCalledWith('div');
      expect(documentMock.body.appendChild).toHaveBeenCalled();
    });

    it('should not show notification when not in debug mode', () => {
      localStorageMock.getItem.mockReturnValue(null);
      Logger.showDebugNotification('Test notification');
      expect(documentMock.createElement).not.toHaveBeenCalled();
    });

    it('should prevent spam notifications', () => {
      // Clear any previous calls and reset state
      vi.clearAllMocks();
      localStorageMock.getItem.mockReturnValue('true');
      
      // Use a unique message to avoid contamination from other tests
      const uniqueMessage = 'Unique spam test message ' + Date.now();

      Logger.showDebugNotification(uniqueMessage);
      Logger.showDebugNotification(uniqueMessage); // Second call should be ignored

      expect(documentMock.createElement).toHaveBeenCalledTimes(1);
    });

    it('should auto-remove notification after timeout', () => {
      // Clear any previous calls
      vi.clearAllMocks();
      localStorageMock.getItem.mockReturnValue('true');
      
      const mockElement = { 
        style: { cssText: '' }, 
        textContent: '',
        parentNode: document.body,
        remove: vi.fn()
      };
      documentMock.createElement.mockReturnValue(mockElement);

      Logger.showDebugNotification('Test notification');

      // Fast-forward time
      vi.advanceTimersByTime(5000);

      expect(mockElement.remove).toHaveBeenCalled();
    });

    it('should apply correct styles for different notification types', () => {
      localStorageMock.getItem.mockReturnValue('true');
      
      // Test error style
      const errorElement = { style: { cssText: '' }, textContent: '' };
      documentMock.createElement.mockReturnValue(errorElement);
      Logger.showDebugNotification('Error message', 'error');
      expect(errorElement.style.cssText).toContain('#fee');
      expect(errorElement.style.cssText).toContain('#f56565');

      // Reset for next test
      (Logger as any)._lastNotification = null;
      
      // Test warn style
      const warnElement = { style: { cssText: '' }, textContent: '' };
      documentMock.createElement.mockReturnValue(warnElement);
      Logger.showDebugNotification('Warning message', 'warn');
      expect(warnElement.style.cssText).toContain('#fef5e7');
      expect(warnElement.style.cssText).toContain('#ed8936');

      // Reset for next test
      (Logger as any)._lastNotification = null;
      
      // Test info style
      const infoElement = { style: { cssText: '' }, textContent: '' };
      documentMock.createElement.mockReturnValue(infoElement);
      Logger.showDebugNotification('Info message', 'info');
      expect(infoElement.style.cssText).toContain('#e6fffa');
      expect(infoElement.style.cssText).toContain('#38b2ac');
    });
  });
});