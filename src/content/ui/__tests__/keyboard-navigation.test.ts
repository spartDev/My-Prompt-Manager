/**
 * Unit tests for KeyboardNavigationManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import * as Logger from '../../utils/logger';
import { EventManager } from '../event-manager';
import { KeyboardNavigationManager } from '../keyboard-navigation';

// Mock Logger
vi.mock('../../utils/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  isDebugMode: vi.fn().mockReturnValue(false),
  showDebugNotification: vi.fn()
}));


// Mock EventManager
vi.mock('../event-manager', () => ({
  EventManager: vi.fn().mockImplementation(() => ({
    addTrackedEventListener: vi.fn()
  }))
}));

describe('KeyboardNavigationManager', () => {
  let keyboardNav: KeyboardNavigationManager;
  let mockSelector: HTMLElement;
  let mockEventManager: EventManager;
  let mockPromptItems: HTMLElement[];

  beforeEach(() => {
    // Create mock selector with search input and prompt items
    mockSelector = document.createElement('div');
    mockSelector.innerHTML = `
      <input class="search-input" type="text" />
      <div class="prompt-list">
        <div class="prompt-item" data-prompt-id="1">Item 1</div>
        <div class="prompt-item" data-prompt-id="2">Item 2</div>
        <div class="prompt-item" data-prompt-id="3">Item 3</div>
      </div>
      <button class="close-selector">Close</button>
    `;
    
    mockPromptItems = Array.from(mockSelector.querySelectorAll('.prompt-item'));
    mockEventManager = new EventManager();
    keyboardNav = new KeyboardNavigationManager(mockSelector, mockEventManager);
    
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create KeyboardNavigationManager instance', () => {
      expect(keyboardNav).toBeInstanceOf(KeyboardNavigationManager);
    });

    it('should initialize with inactive state', () => {
      // Access private properties through any for testing
      expect((keyboardNav as any).isActive).toBe(false);
      expect((keyboardNav as any).selectedIndex).toBe(-1);
      expect((keyboardNav as any).items).toEqual([]);
    });
  });

  describe('initialize', () => {
    it('should set up keyboard navigation', () => {
      keyboardNav.initialize();
      
      expect((keyboardNav as any).isActive).toBe(true);
      expect((keyboardNav as any).items).toHaveLength(3);
      expect(mockEventManager.addTrackedEventListener).toHaveBeenCalledWith(
        expect.any(Object), // Accept any document object
        'keydown',
        expect.any(Function)
      );
      expect(Logger.info).toHaveBeenCalledWith('Keyboard navigation handlers setup');
    });

    it('should focus search input after initialization', (done) => {
      const searchInput = mockSelector.querySelector('.search-input') as HTMLInputElement;
      const focusSpy = vi.spyOn(searchInput, 'focus');
      
      keyboardNav.initialize();
      
      // Wait for setTimeout to execute
      setTimeout(() => {
        expect(focusSpy).toHaveBeenCalled();
        expect(Logger.info).toHaveBeenCalledWith('Focused search input for keyboard navigation');
        done();
      }, 150);
    });
  });

  describe('updateItems', () => {
    beforeEach(() => {
      keyboardNav.initialize();
    });

    it('should update items list', () => {
      // Add a new item
      const newItem = document.createElement('div');
      newItem.className = 'prompt-item';
      newItem.dataset.promptId = '4';
      mockSelector.querySelector('.prompt-list')?.appendChild(newItem);
      
      keyboardNav.updateItems();
      
      expect((keyboardNav as any).items).toHaveLength(4);
      expect((keyboardNav as any).selectedIndex).toBe(-1);
    });

    it('should clear selection when updating items', () => {
      // Select an item first
      const firstItem = mockPromptItems[0];
      firstItem.classList.add('keyboard-selected');
      firstItem.setAttribute('aria-selected', 'true');
      
      keyboardNav.updateItems();
      
      expect(firstItem.classList.contains('keyboard-selected')).toBe(false);
      expect(firstItem.hasAttribute('aria-selected')).toBe(false);
    });
  });

  describe('keyboard event handling', () => {
    let keyboardHandler: (e: KeyboardEvent) => void;

    beforeEach(() => {
      keyboardNav.initialize();
      
      // Get the keyboard handler that was registered
      const addTrackedEventListenerCalls = (mockEventManager.addTrackedEventListener as any).mock.calls;
      const keydownCall = addTrackedEventListenerCalls.find((call: any) => call[1] === 'keydown');
      keyboardHandler = keydownCall[2];
    });

    describe('ArrowDown key', () => {
      it('should select next item', () => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
        const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
        
        keyboardHandler(event);
        
        expect(preventDefaultSpy).toHaveBeenCalled();
        expect(mockPromptItems[0].classList.contains('keyboard-selected')).toBe(true);
        expect(mockPromptItems[0].getAttribute('aria-selected')).toBe('true');
      });

      it('should wrap to first item when at end', () => {
        // Select last item first
        (keyboardNav as any).selectedIndex = 2;
        (keyboardNav as any).updateSelection();
        
        const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
        keyboardHandler(event);
        
        expect(mockPromptItems[0].classList.contains('keyboard-selected')).toBe(true);
        expect(mockPromptItems[2].classList.contains('keyboard-selected')).toBe(false);
      });
    });

    describe('ArrowUp key', () => {
      it('should select previous item', () => {
        // Start with second item selected
        (keyboardNav as any).selectedIndex = 1;
        (keyboardNav as any).updateSelection();
        
        const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
        const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
        
        keyboardHandler(event);
        
        expect(preventDefaultSpy).toHaveBeenCalled();
        expect(mockPromptItems[0].classList.contains('keyboard-selected')).toBe(true);
        expect(mockPromptItems[1].classList.contains('keyboard-selected')).toBe(false);
      });

      it('should wrap to last item when at beginning', () => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
        keyboardHandler(event);
        
        expect(mockPromptItems[2].classList.contains('keyboard-selected')).toBe(true);
      });
    });

    describe('Enter key', () => {
      it('should activate selected item', () => {
        // Select first item
        (keyboardNav as any).selectedIndex = 0;
        (keyboardNav as any).updateSelection();
        
        const clickSpy = vi.spyOn(mockPromptItems[0], 'click');
        const event = new KeyboardEvent('keydown', { key: 'Enter' });
        const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
        
        keyboardHandler(event);
        
        expect(preventDefaultSpy).toHaveBeenCalled();
        expect(clickSpy).toHaveBeenCalled();
        expect(Logger.info).toHaveBeenCalledWith('Activating selected item via keyboard', {
          index: 0,
          itemId: '1'
        });
      });

      it('should do nothing if no item is selected', () => {
        const event = new KeyboardEvent('keydown', { key: 'Enter' });
        keyboardHandler(event);
        
        // Should not throw or cause issues
        expect(true).toBe(true);
      });
    });

    describe('Escape key', () => {
      it('should close the selector', () => {
        const closeButton = mockSelector.querySelector('.close-selector') as HTMLButtonElement;
        const clickSpy = vi.spyOn(closeButton, 'click');
        const event = new KeyboardEvent('keydown', { key: 'Escape' });
        const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
        
        keyboardHandler(event);
        
        expect(preventDefaultSpy).toHaveBeenCalled();
        expect(clickSpy).toHaveBeenCalled();
        expect(Logger.info).toHaveBeenCalledWith('Closing prompt selector via keyboard');
      });
    });

    describe('Tab key', () => {
      it('should allow natural tab navigation', () => {
        const event = new KeyboardEvent('keydown', { key: 'Tab' });
        const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
        
        keyboardHandler(event);
        
        expect(preventDefaultSpy).not.toHaveBeenCalled();
      });
    });

    describe('other keys', () => {
      it('should focus search input for printable characters', () => {
        const searchInput = mockSelector.querySelector('.search-input') as HTMLInputElement;
        const focusSpy = vi.spyOn(searchInput, 'focus');
        
        // Simulate typing 'a'
        const event = new KeyboardEvent('keydown', { key: 'a' });
        keyboardHandler(event);
        
        expect(focusSpy).toHaveBeenCalled();
      });

      it('should not focus search input for modifier keys', () => {
        const searchInput = mockSelector.querySelector('.search-input') as HTMLInputElement;
        const focusSpy = vi.spyOn(searchInput, 'focus');
        
        // Simulate Ctrl+A
        const event = new KeyboardEvent('keydown', { key: 'a', ctrlKey: true });
        keyboardHandler(event);
        
        expect(focusSpy).not.toHaveBeenCalled();
      });

      it('should not focus search input if already focused', () => {
        const searchInput = mockSelector.querySelector('.search-input') as HTMLInputElement;
        const focusSpy = vi.spyOn(searchInput, 'focus');
        
        // Mock document.activeElement
        Object.defineProperty(document, 'activeElement', {
          value: searchInput,
          configurable: true
        });
        
        const event = new KeyboardEvent('keydown', { key: 'a' });
        keyboardHandler(event);
        
        expect(focusSpy).not.toHaveBeenCalled();
      });
    });

    it('should ignore events when inactive', () => {
      (keyboardNav as any).isActive = false;
      
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      
      keyboardHandler(event);
      
      expect(preventDefaultSpy).not.toHaveBeenCalled();
      expect(mockPromptItems[0].classList.contains('keyboard-selected')).toBe(false);
    });
  });

  describe('destroy', () => {
    beforeEach(() => {
      keyboardNav.initialize();
    });

    it('should deactivate keyboard navigation', () => {
      keyboardNav.destroy();
      
      expect((keyboardNav as any).isActive).toBe(false);
      expect(Logger.info).toHaveBeenCalledWith('Keyboard navigation manager destroyed');
    });

    it('should clear selection', () => {
      // Select an item first
      (keyboardNav as any).selectedIndex = 0;
      (keyboardNav as any).updateSelection();
      
      keyboardNav.destroy();
      
      expect(mockPromptItems[0].classList.contains('keyboard-selected')).toBe(false);
      expect(mockPromptItems[0].hasAttribute('aria-selected')).toBe(false);
    });
  });

  describe('scrolling behavior', () => {
    beforeEach(() => {
      keyboardNav.initialize();
      
      // Mock getBoundingClientRect for container and items
      const container = mockSelector.querySelector('.prompt-list') as HTMLElement;
      vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
        top: 100,
        bottom: 300,
        left: 0,
        right: 200,
        width: 200,
        height: 200,
        x: 0,
        y: 100
      } as DOMRect);
      
      mockPromptItems.forEach((item, index) => {
        vi.spyOn(item, 'getBoundingClientRect').mockReturnValue({
          top: 100 + (index * 50),
          bottom: 150 + (index * 50),
          left: 0,
          right: 200,
          width: 200,
          height: 50,
          x: 0,
          y: 100 + (index * 50)
        } as DOMRect);
        
        // Mock scrollIntoView method
        item.scrollIntoView = vi.fn();
      });
    });

    it('should scroll item into view when below container', () => {
      // Mock last item as being below container
      vi.spyOn(mockPromptItems[2], 'getBoundingClientRect').mockReturnValue({
        top: 350,
        bottom: 400,
        left: 0,
        right: 200,
        width: 200,
        height: 50,
        x: 0,
        y: 350
      } as DOMRect);
      
      mockPromptItems[2].scrollIntoView = vi.fn();
      
      (keyboardNav as any).selectedIndex = 2;
      (keyboardNav as any).scrollToSelected();
      
      expect(mockPromptItems[2].scrollIntoView).toHaveBeenCalledWith({ 
        block: 'end', 
        behavior: 'smooth' 
      });
    });

    it('should scroll item into view when above container', () => {
      // Mock first item as being above container
      vi.spyOn(mockPromptItems[0], 'getBoundingClientRect').mockReturnValue({
        top: 50,
        bottom: 100,
        left: 0,
        right: 200,
        width: 200,
        height: 50,
        x: 0,
        y: 50
      } as DOMRect);
      
      mockPromptItems[0].scrollIntoView = vi.fn();
      
      (keyboardNav as any).selectedIndex = 0;
      (keyboardNav as any).scrollToSelected();
      
      expect(mockPromptItems[0].scrollIntoView).toHaveBeenCalledWith({ 
        block: 'start', 
        behavior: 'smooth' 
      });
    });
  });
});