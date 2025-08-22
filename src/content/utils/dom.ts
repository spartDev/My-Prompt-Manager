/**
 * DOM utility module for the content script
 * Provides safe DOM element creation and manipulation utilities
 */

import { warn, error as logError } from './logger';

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class DOMUtils {
  /**
   * Helper function to safely create DOM elements with text content
   */
  static createElement(
    tag: string, 
    attributes: Record<string, string | number> = {}, 
    textContent: string = ''
  ): HTMLElement {
    try {
      const element = document.createElement(tag);

      // Set attributes safely
      Object.entries(attributes).forEach(([key, value]) => {
        if (typeof value === 'string' || typeof value === 'number') {
          element.setAttribute(key, String(value));
        }
      });

      // Set text content safely (never innerHTML)
      if (textContent) {
        element.textContent = textContent;
      }

      return element;
    } catch (err) {
      logError('Failed to create DOM element', err as Error, { tag, attributes, textContent });
      return document.createElement('div'); // Safe fallback
    }
  }

  /**
   * Helper function to create SVG elements with proper namespace
   */
  static createSVGElement(tag: string, attributes: Record<string, string | number> = {}): SVGElement {
    try {
      const element = document.createElementNS('http://www.w3.org/2000/svg', tag);

      // Set attributes safely for SVG
      Object.entries(attributes).forEach(([key, value]) => {
        if (typeof value === 'string' || typeof value === 'number') {
          element.setAttribute(key, String(value));
        }
      });

      return element;
    } catch (err) {
      logError('Failed to create SVG element', err as Error, { tag, attributes });
      return document.createElementNS('http://www.w3.org/2000/svg', 'g'); // Safe fallback
    }
  }

  /**
   * Safely query for a single element
   */
  static querySelector(selector: string, context: Document | Element = document): Element | null {
    try {
      return context.querySelector(selector);
    } catch (err) {
      logError('Failed to query selector', err as Error, { selector });
      return null;
    }
  }

  /**
   * Safely query for multiple elements
   */
  static querySelectorAll(selector: string, context: Document | Element = document): Element[] {
    try {
      return Array.from(context.querySelectorAll(selector));
    } catch (err) {
      logError('Failed to query selector all', err as Error, { selector });
      return [];
    }
  }

  /**
   * Safely get element by ID
   */
  static getElementById(id: string): HTMLElement | null {
    try {
      return document.getElementById(id);
    } catch (err) {
      logError('Failed to get element by ID', err as Error, { id });
      return null;
    }
  }

  /**
   * Safely add event listener with error handling
   */
  static addEventListener(
    element: Element | Window | Document,
    event: string,
    handler: EventListener,
    options?: boolean | AddEventListenerOptions
  ): boolean {
    try {
      element.addEventListener(event, handler, options);
      return true;
    } catch (err) {
      logError('Failed to add event listener', err as Error, { event });
      return false;
    }
  }

  /**
   * Safely remove event listener with error handling
   */
  static removeEventListener(
    element: Element | Window | Document,
    event: string,
    handler: EventListener,
    options?: boolean | EventListenerOptions
  ): boolean {
    try {
      element.removeEventListener(event, handler, options);
      return true;
    } catch (err) {
      logError('Failed to remove event listener', err as Error, { event });
      return false;
    }
  }

  /**
   * Safely append child element
   */
  static appendChild(parent: Element, child: Element): boolean {
    try {
      parent.appendChild(child);
      return true;
    } catch (err) {
      logError('Failed to append child', err as Error, {
        parentTag: parent.tagName,
        childTag: child.tagName
      });
      return false;
    }
  }

  /**
   * Safely insert element before reference element
   */
  static insertBefore(newElement: Element, referenceElement: Element): boolean {
    try {
      if (!referenceElement.parentNode) {
        logError('Cannot insert before element without parent', new Error('No parent node'), {
          referenceTag: referenceElement.tagName,
          referenceId: referenceElement.id
        });
        return false;
      }

      referenceElement.parentNode.insertBefore(newElement, referenceElement);
      return true;
    } catch (err) {
      logError('Failed to insert element before reference', err as Error, {
        newElementTag: newElement.tagName,
        referenceTag: referenceElement.tagName
      });
      return false;
    }
  }

  /**
   * Safely insert element after reference element
   */
  static insertAfter(newElement: Element, referenceElement: Element): boolean {
    try {
      if (!referenceElement.parentNode) {
        logError('Cannot insert after element without parent', new Error('No parent node'), {
          referenceTag: referenceElement.tagName,
          referenceId: referenceElement.id
        });
        return false;
      }

      referenceElement.parentNode.insertBefore(newElement, referenceElement.nextSibling);
      return true;
    } catch (err) {
      logError('Failed to insert element after reference', err as Error, {
        newElementTag: newElement.tagName,
        referenceTag: referenceElement.tagName
      });
      return false;
    }
  }

  /**
   * Safely prepend child element to parent (insert at beginning)
   */
  static prependChild(parent: Element, child: Element): boolean {
    try {
      if (parent.firstChild) {
        parent.insertBefore(child, parent.firstChild);
      } else {
        parent.appendChild(child);
      }
      return true;
    } catch (err) {
      logError('Failed to prepend child', err as Error, {
        parentTag: parent.tagName,
        childTag: child.tagName
      });
      return false;
    }
  }

  /**
   * Safely remove element from DOM
   */
  static removeElement(element: Element): boolean {
    try {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      } else {
        element.remove();
      }
      return true;
    } catch (err) {
      logError('Failed to remove element', err as Error, {
        elementTag: element.tagName,
        elementId: element.id,
        elementClass: element.className
      });
      return false;
    }
  }

  /**
   * Check if element is visible in viewport
   */
  static isElementVisible(element: Element): boolean {
    try {
      const rect = element.getBoundingClientRect();
      const windowHeight = window.innerHeight || document.documentElement.clientHeight;
      const windowWidth = window.innerWidth || document.documentElement.clientWidth;

      return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= windowHeight &&
        rect.right <= windowWidth
      );
    } catch (err) {
      logError('Failed to check element visibility', err as Error);
      return false;
    }
  }

  /**
   * Get element's computed style property safely
   */
  static getComputedStyleProperty(element: Element, property: string): string | null {
    try {
      const computedStyle = window.getComputedStyle(element);
      return computedStyle.getPropertyValue(property);
    } catch (err) {
      logError('Failed to get computed style', err as Error, { property });
      return null;
    }
  }

  /**
   * Safely set element attributes
   */
  static setAttributes(element: Element, attributes: Record<string, string | number>): boolean {
    try {
      Object.entries(attributes).forEach(([key, value]) => {
        if (typeof value === 'string' || typeof value === 'number') {
          element.setAttribute(key, String(value));
        }
      });
      return true;
    } catch (err) {
      logError('Failed to set attributes', err as Error, { attributes });
      return false;
    }
  }

  /**
   * Escape HTML to ensure user-generated content is displayed safely
   */
  static escapeHtml(text: string): string {
    try {
      if (typeof text !== 'string') {
        warn('escapeHtml received non-string input', {
          type: typeof text,
          value: text
        });
        return String(text);
      }

      // Use explicit character replacement for safety
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    } catch (err) {
      logError('Failed to escape HTML', err as Error, { text });
      return ''; // Safe fallback
    }
  }
}