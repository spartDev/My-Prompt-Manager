/**
 * Event Manager module
 * Manages event listeners with proper cleanup tracking
 */

import type { EventListenerEntry } from '../types/index';
import { warn, debug } from '../utils/logger';

export class EventManager {
  private listeners: Map<HTMLElement, EventListenerEntry[]>;

  constructor() {
    this.listeners = new Map();
  }

  addTrackedEventListener(element: HTMLElement, event: string, handler: EventListener): void {
    element.addEventListener(event, handler);
    
    if (!this.listeners.has(element)) {
      this.listeners.set(element, []);
    }
    const elementListeners = this.listeners.get(element);
    if (elementListeners) {
      elementListeners.push({ event, handler });
    }
  }

  cleanup(): void {
    let removedCount = 0;
    let errorCount = 0;
    
    this.listeners.forEach((listeners, element) => {
      listeners.forEach(({ event, handler }) => {
        try {
          element.removeEventListener(event, handler);
          removedCount++;
        } catch (err) {
          errorCount++;
          warn('Failed to remove event listener', {
            error: err instanceof Error ? err.message : String(err),
            event,
            elementTag: element.tagName,
            elementId: element.id,
            elementClass: element.className
          });
        }
      });
    });
    
    this.listeners.clear();
    
    debug('EventManager cleanup completed', {
      removedListeners: removedCount,
      errors: errorCount
    });
  }
}