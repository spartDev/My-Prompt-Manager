/**
 * UI-related type definitions
 */

import type { EventManager } from '../ui/event-manager';

export interface KeyboardNavigationOptions {
  selector: HTMLElement;
  eventManager: EventManager;
}

export interface UIElementFactoryOptions {
  instanceId: string;
}

export interface IconCreationResult {
  container: HTMLElement;
  icon: HTMLElement;
}

export interface KeyboardNavigationState {
  currentIndex: number;
  items: HTMLElement[];
  isActive: boolean;
}

export interface ToastNotification {
  message: string;
  type: 'info' | 'warn' | 'error' | 'success';
  duration?: number;
}

export interface PromptSelectorOptions {
  targetElement: HTMLElement;
  position?: {
    x: number;
    y: number;
  };
  maxHeight?: number;
  maxWidth?: number;
}

export interface DOMElementAttributes {
  [key: string]: string | number | boolean;
}

export interface SVGElementAttributes {
  [key: string]: string | number | boolean | undefined;
  viewBox?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: string | number;
}