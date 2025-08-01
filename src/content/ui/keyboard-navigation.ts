/**
 * Keyboard Navigation Manager module
 * Manages keyboard navigation within the prompt selector
 */

// import type { KeyboardNavigationState } from '../types/ui';
import type { EventManager } from './event-manager';
import { Logger } from '../utils/logger';

export class KeyboardNavigationManager {
  private selector: HTMLElement;
  private eventManager: EventManager;
  private selectedIndex: number;
  private items: HTMLElement[];
  private isActive: boolean;

  constructor(selectorElement: HTMLElement, eventManager: EventManager) {
    this.selector = selectorElement;
    this.eventManager = eventManager;
    this.selectedIndex = -1;
    this.items = [];
    this.isActive = false;
  }

  initialize(): void {
    this.updateItems();
    this.setupKeyboardHandlers();
    this.isActive = true;
    
    // Focus the search input initially
    const searchInput = this.selector.querySelector('.search-input') as HTMLInputElement;
    if (searchInput) {
      setTimeout(() => {
        searchInput.focus();
        Logger.info('Focused search input for keyboard navigation');
      }, 100);
    }
  }

  updateItems(): void {
    this.items = Array.from(this.selector.querySelectorAll('.prompt-item'));
    this.selectedIndex = -1;
    this.clearSelection();
  }

  private setupKeyboardHandlers(): void {
    const keyboardHandler = (e: KeyboardEvent) => {
      if (!this.isActive) {return;}
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          this.selectNext();
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.selectPrevious();
          break;
        case 'Enter':
          e.preventDefault();
          this.activateSelected();
          break;
        case 'Escape':
          e.preventDefault();
          this.close();
          break;
        case 'Tab':
          // Allow natural tab navigation within the modal
          break;
        default: {
          // For other keys, focus the search input if it's not already focused
          const searchInput = this.selector.querySelector('.search-input') as HTMLInputElement;
          if (searchInput && document.activeElement !== searchInput && 
              e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
            searchInput.focus();
          }
          break;
        }
      }
    };
    
    this.eventManager.addTrackedEventListener(document as any, 'keydown', keyboardHandler as EventListener);
    
    Logger.info('Keyboard navigation handlers setup');
  }

  private selectNext(): void {
    if (this.items.length === 0) {return;}
    
    this.selectedIndex = (this.selectedIndex + 1) % this.items.length;
    this.updateSelection();
    this.scrollToSelected();
  }

  private selectPrevious(): void {
    if (this.items.length === 0) {return;}
    
    this.selectedIndex = this.selectedIndex <= 0 ? this.items.length - 1 : this.selectedIndex - 1;
    this.updateSelection();
    this.scrollToSelected();
  }

  private updateSelection(): void {
    this.clearSelection();
    
    if (this.selectedIndex >= 0 && this.selectedIndex < this.items.length) {
      const selectedItem = this.items[this.selectedIndex];
      selectedItem.classList.add('keyboard-selected');
      selectedItem.setAttribute('aria-selected', 'true');
      
      Logger.info('Updated keyboard selection', { 
        index: this.selectedIndex, 
        itemId: selectedItem.dataset.promptId 
      });
    }
  }

  private clearSelection(): void {
    this.items.forEach(item => {
      item.classList.remove('keyboard-selected');
      item.removeAttribute('aria-selected');
    });
  }

  private scrollToSelected(): void {
    if (this.selectedIndex >= 0 && this.selectedIndex < this.items.length) {
      const selectedItem = this.items[this.selectedIndex];
      const container = this.selector.querySelector('.prompt-list');
      
      if (container) {
        const containerRect = container.getBoundingClientRect();
        const itemRect = selectedItem.getBoundingClientRect();
        
        if (itemRect.bottom > containerRect.bottom) {
          selectedItem.scrollIntoView({ block: 'end', behavior: 'smooth' });
        } else if (itemRect.top < containerRect.top) {
          selectedItem.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }
      }
    }
  }

  private activateSelected(): void {
    if (this.selectedIndex >= 0 && this.selectedIndex < this.items.length) {
      const selectedItem = this.items[this.selectedIndex];
      Logger.info('Activating selected item via keyboard', { 
        index: this.selectedIndex, 
        itemId: selectedItem.dataset.promptId 
      });
      selectedItem.click();
    }
  }

  private close(): void {
    const closeButton = this.selector.querySelector('.close-selector') as HTMLButtonElement;
    if (closeButton) {
      Logger.info('Closing prompt selector via keyboard');
      closeButton.click();
    }
  }

  destroy(): void {
    this.isActive = false;
    this.clearSelection();
    Logger.info('Keyboard navigation manager destroyed');
  }
}