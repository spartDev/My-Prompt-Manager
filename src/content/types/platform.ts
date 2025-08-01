/**
 * Platform-specific type definitions
 */

import type { InsertionResult } from './index';
import type { UIElementFactory } from '../ui/element-factory';

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
  [key: string]: any;
}

export interface InsertionManagerOptions {
  debug?: boolean;
  timeout?: number;
  retries?: number;
  [key: string]: any;
}

export type PlatformName = 'claude' | 'chatgpt' | 'perplexity' | 'default';

export interface PlatformDetectionResult {
  platform: PlatformName;
  confidence: number;
  element?: HTMLElement;
}

export interface StorageData {
  prompts: any[];
  categories?: string[];
}

export interface IconCreationResult {
  success: boolean;
  element?: HTMLElement;
  error?: string;
}