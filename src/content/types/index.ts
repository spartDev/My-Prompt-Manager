/**
 * Core type definitions for the content script
 */

export interface Prompt {
  id: string;
  title: string;
  content: string;
  category: string;
  createdAt: number;
  updatedAt: number;
  usageCount?: number;
  lastUsedAt?: number;
  pinned?: boolean; // Pinned Prompts appear first in the prompt picker (absent = unpinned)
}

export interface InsertionResult {
  success: boolean;
  method?: string;
  error?: string;
}

export interface DebugInfo {
  timestamp: string;
  level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
  message: string;
  context: Record<string, unknown>;
  url: string;
  userAgent?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
export type NotificationType = 'error' | 'warn' | 'info';

export interface EventListenerEntry {
  event: string;
  handler: EventListener;
}

export interface InsertionManagerOptions {
  debug?: boolean;
  timeout?: number;
}

export interface PlatformManagerOptions {
  debug?: boolean;
  enableFallback?: boolean;
}

// Re-export types from other modules
export type {
  IconCreationResult as PlatformIconCreationResult, 
  PlatformConfig,
  PlatformDetectionResult,
  PlatformName,
  PlatformStrategyInterface,
  StorageData
} from './platform';

export type {
  DOMElementAttributes,
  IconCreationResult,
  KeyboardNavigationOptions,
  KeyboardNavigationState,
  PromptSelectorOptions,
  SVGElementAttributes, 
  ToastNotification,
  UIElementFactoryOptions
} from './ui';
