/**
 * Platform-specific type definitions
 */

import type { UIElementFactory } from '../ui/element-factory';

import type { InsertionResult } from './index';

export interface PlatformConfig {
  selectors: string[];
  buttonContainerSelector?: string;
  priority: number;
}

export interface PlatformStrategyInterface {
  name: string;
  priority: number;
  canHandle(element: HTMLElement): boolean;
  insert(element: HTMLElement, content: string): Promise<InsertionResult>;
  getSelectors(): string[];
  getButtonContainerSelector(): string | null;
  createIcon?(uiFactory: UIElementFactory): HTMLElement | null;
  cleanup?(): void;
}

export interface PlatformManagerOptions {
  enableDebugLogging?: boolean;
  maxRetries?: number;
  timeout?: number;
  [key: string]: unknown;
}

export interface InsertionManagerOptions {
  debug?: boolean;
  timeout?: number;
  retries?: number;
  [key: string]: unknown;
}

export type PlatformName = 'claude' | 'chatgpt' | 'mistral' | 'perplexity' | 'default';

export interface PlatformDetectionResult {
  platform: PlatformName;
  confidence: number;
  element?: HTMLElement;
}

export interface StorageData {
  prompts: unknown[];
  categories?: string[];
}

export interface IconCreationResult {
  success: boolean;
  element?: HTMLElement;
  error?: string;
}

/**
 * Debug window interface for runtime strategy switching
 */
declare global {
  interface Window {
    __promptLibraryDebug?: {
      enabled: boolean;
      switchPlatform?: (hostname: string) => void;
    };
  }
}