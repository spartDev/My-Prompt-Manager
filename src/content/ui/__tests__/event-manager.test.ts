/**
 * Unit tests for EventManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import * as Logger from '../../utils/logger';
import { EventManager } from '../event-manager';

// Mock Logger
vi.mock('../../utils/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  isDebugMode: vi.fn().mockReturnValue(false),
  showDebugNotification: vi.fn()
}));


describe('EventManager', () => {
  let eventManager: EventManager;
  let mockElement: HTMLElement;
  let mockHandler: EventListener;

  beforeEach(() => {
    eventManager = new EventManager();
    mockElement = document.createElement('div');
    mockHandler = vi.fn();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create EventManager instance', () => {
      expect(eventManager).toBeInstanceOf(EventManager);
    });
  });

  describe('addTrackedEventListener', () => {
    it('should add event listener to element', () => {
      const addEventListenerSpy = vi.spyOn(mockElement, 'addEventListener');
      
      eventManager.addTrackedEventListener(mockElement, 'click', mockHandler);
      
      expect(addEventListenerSpy).toHaveBeenCalledWith('click', mockHandler);
    });

    it('should track multiple event listeners on same element', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const addEventListenerSpy = vi.spyOn(mockElement, 'addEventListener');
      
      eventManager.addTrackedEventListener(mockElement, 'click', handler1);
      eventManager.addTrackedEventListener(mockElement, 'mouseover', handler2);
      
      expect(addEventListenerSpy).toHaveBeenCalledTimes(2);
      expect(addEventListenerSpy).toHaveBeenCalledWith('click', handler1);
      expect(addEventListenerSpy).toHaveBeenCalledWith('mouseover', handler2);
    });

    it('should track event listeners on multiple elements', () => {
      const element2 = document.createElement('span');
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const addEventListenerSpy1 = vi.spyOn(mockElement, 'addEventListener');
      const addEventListenerSpy2 = vi.spyOn(element2, 'addEventListener');
      
      eventManager.addTrackedEventListener(mockElement, 'click', handler1);
      eventManager.addTrackedEventListener(element2, 'click', handler2);
      
      expect(addEventListenerSpy1).toHaveBeenCalledWith('click', handler1);
      expect(addEventListenerSpy2).toHaveBeenCalledWith('click', handler2);
    });
  });

  describe('cleanup', () => {
    it('should remove all tracked event listeners', () => {
      const removeEventListenerSpy = vi.spyOn(mockElement, 'removeEventListener');
      
      eventManager.addTrackedEventListener(mockElement, 'click', mockHandler);
      eventManager.cleanup();
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('click', mockHandler);
    });

    it('should remove multiple event listeners from same element', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const removeEventListenerSpy = vi.spyOn(mockElement, 'removeEventListener');
      
      eventManager.addTrackedEventListener(mockElement, 'click', handler1);
      eventManager.addTrackedEventListener(mockElement, 'mouseover', handler2);
      eventManager.cleanup();
      
      expect(removeEventListenerSpy).toHaveBeenCalledTimes(2);
      expect(removeEventListenerSpy).toHaveBeenCalledWith('click', handler1);
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseover', handler2);
    });

    it('should remove event listeners from multiple elements', () => {
      const element2 = document.createElement('span');
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const removeEventListenerSpy1 = vi.spyOn(mockElement, 'removeEventListener');
      const removeEventListenerSpy2 = vi.spyOn(element2, 'removeEventListener');
      
      eventManager.addTrackedEventListener(mockElement, 'click', handler1);
      eventManager.addTrackedEventListener(element2, 'click', handler2);
      eventManager.cleanup();
      
      expect(removeEventListenerSpy1).toHaveBeenCalledWith('click', handler1);
      expect(removeEventListenerSpy2).toHaveBeenCalledWith('click', handler2);
    });

    it('should log successful cleanup', () => {
      eventManager.addTrackedEventListener(mockElement, 'click', mockHandler);
      eventManager.cleanup();
      
      expect(Logger.info).toHaveBeenCalledWith('EventManager cleanup completed', {
        removedListeners: 1,
        errors: 0
      });
    });

    it('should handle errors during cleanup gracefully', () => {
      const removeEventListenerSpy = vi.spyOn(mockElement, 'removeEventListener');
      removeEventListenerSpy.mockImplementation(() => {
        throw new Error('Test error');
      });
      
      // Set element properties for error logging
      mockElement.id = 'test-id';
      mockElement.className = 'test-class';
      
      eventManager.addTrackedEventListener(mockElement, 'click', mockHandler);
      eventManager.cleanup();
      
      expect(Logger.warn).toHaveBeenCalledWith('Failed to remove event listener', {
        error: 'Test error',
        event: 'click',
        elementTag: 'DIV',
        elementId: 'test-id',
        elementClass: 'test-class'
      });
      
      expect(Logger.info).toHaveBeenCalledWith('EventManager cleanup completed', {
        removedListeners: 0,
        errors: 1
      });
    });

    it('should clear internal listeners map after cleanup', () => {
      eventManager.addTrackedEventListener(mockElement, 'click', mockHandler);
      eventManager.cleanup();
      
      // Add another listener after cleanup to verify map was cleared
      const newHandler = vi.fn();
      const addEventListenerSpy = vi.spyOn(mockElement, 'addEventListener');
      
      eventManager.addTrackedEventListener(mockElement, 'click', newHandler);
      
      expect(addEventListenerSpy).toHaveBeenCalledWith('click', newHandler);
    });

    it('should handle cleanup when no listeners are tracked', () => {
      eventManager.cleanup();
      
      expect(Logger.info).toHaveBeenCalledWith('EventManager cleanup completed', {
        removedListeners: 0,
        errors: 0
      });
    });
  });

  describe('error handling', () => {
    it('should handle non-Error objects in cleanup', () => {
      const removeEventListenerSpy = vi.spyOn(mockElement, 'removeEventListener');
      removeEventListenerSpy.mockImplementation(() => {
        throw new Error('String error');
      });
      
      mockElement.id = 'test-id';
      mockElement.className = 'test-class';
      
      eventManager.addTrackedEventListener(mockElement, 'click', mockHandler);
      eventManager.cleanup();
      
      expect(Logger.warn).toHaveBeenCalledWith('Failed to remove event listener', {
        error: 'String error',
        event: 'click',
        elementTag: 'DIV',
        elementId: 'test-id',
        elementClass: 'test-class'
      });
    });
  });
});