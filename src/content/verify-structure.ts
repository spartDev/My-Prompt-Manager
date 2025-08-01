/**
 * Verification script to ensure all modules can be imported correctly
 * This file will be removed after verification
 */

// Test all type imports
import type {
  Prompt,
  InsertionResult,
  DebugInfo,
  StorageData,
  EventListenerEntry,
  PlatformConfig,
  PlatformStrategyInterface,
  PlatformManagerOptions,
  InsertionManagerOptions,
  PlatformName,
  PlatformDetectionResult,
  KeyboardNavigationOptions,
  UIElementFactoryOptions,
  IconCreationResult,
  KeyboardNavigationState,
  ToastNotification,
  PromptSelectorOptions,
  DOMElementAttributes,
  SVGElementAttributes
} from './types/index';

// Test all utility imports
import {
  Logger,
  StorageManager,
  StylesManager,
  DOMUtils
} from './utils/index';

// Test all UI imports
import {
  UIElementFactory,
  EventManager,
  KeyboardNavigationManager
} from './ui/index';

// Test all platform imports
import {
  PlatformStrategy,
  ClaudeStrategy,
  ChatGPTStrategy,
  PerplexityStrategy,
  DefaultStrategy,
  PlatformManager
} from './platforms/index';

// Test all core imports
import {
  PromptLibraryInjector,
  PlatformInsertionManager
} from './core/index';

console.log('All imports successful - module structure is correctly set up!');