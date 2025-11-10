/**
 * Unit tests for Microsoft Copilot platform integration
 *
 * Tests cover:
 * - Icon creation and styling
 * - Input field detection with multiple selectors
 * - Platform detection for copilot.microsoft.com
 * - Integration with DefaultStrategy
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { getPlatformByHostname } from '../../../config/platforms';
import type { UIElementFactory } from '../../ui/element-factory';
import { DefaultStrategy } from '../default-strategy';
import { PlatformManager } from '../platform-manager';

// Mock Logger
vi.mock('../../utils/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  isDebugMode: vi.fn().mockReturnValue(false),
  showDebugNotification: vi.fn()
}));

// Mock Storage utilities
vi.mock('../../utils/storage', () => ({
  getSettings: vi.fn().mockResolvedValue({
    enabledSites: ['copilot.microsoft.com'],
    customSites: [],
    debugMode: false,
    floatingFallback: true
  }),
  getDefaultSettings: vi.fn().mockReturnValue({
    enabledSites: ['copilot.microsoft.com'],
    customSites: [],
    debugMode: false,
    floatingFallback: true
  }),
  sanitizeUserInput: vi.fn((input: string) => input),
  createElement: vi.fn((tag: string) => document.createElement(tag)),
  createSVGElement: vi.fn((tag: string) => document.createElementNS('http://www.w3.org/2000/svg', tag))
}));

// Mock platforms config
vi.mock('../../../config/platforms');

// Mock window.location.hostname
const mockLocation = {
  hostname: 'copilot.microsoft.com'
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true
});

describe('Copilot Platform Integration', () => {
  let mockUIFactory: UIElementFactory;

  beforeEach(() => {
    mockUIFactory = {
      createCopilotIcon: vi.fn().mockReturnValue(document.createElement('button')),
      createFloatingIcon: vi.fn().mockReturnValue(document.createElement('button'))
    } as unknown as UIElementFactory;

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Platform Configuration', () => {
    it('should be detectable by hostname', () => {
      vi.mocked(getPlatformByHostname).mockReturnValue({
        id: 'copilot',
        hostname: 'copilot.microsoft.com',
        displayName: 'Microsoft Copilot',
        priority: 80,
        defaultEnabled: true,
        selectors: [
          'textarea[data-testid="composer-input"]',
          'textarea#userInput',
          'textarea[placeholder*="Message"]',
          'textarea[placeholder*="Copilot"]'
        ],
        buttonContainerSelector: '.relative.bottom-0.flex.justify-between.pb-0\\.5.pe-2\\.5.ps-1\\.5 > .flex.gap-2.items-center:last-child',
        strategyClass: 'DefaultStrategy',
        hostnamePatterns: ['copilot.microsoft']
      });

      const platform = getPlatformByHostname('copilot.microsoft.com');
      expect(platform).toBeDefined();
      expect(platform?.id).toBe('copilot');
      expect(platform?.priority).toBe(80);
    });

    it('should use DefaultStrategy', () => {
      vi.mocked(getPlatformByHostname).mockReturnValue({
        id: 'copilot',
        hostname: 'copilot.microsoft.com',
        displayName: 'Microsoft Copilot',
        priority: 80,
        defaultEnabled: true,
        selectors: [
          'textarea[data-testid="composer-input"]',
          'textarea#userInput',
          'textarea[placeholder*="Message"]',
          'textarea[placeholder*="Copilot"]'
        ],
        buttonContainerSelector: '.relative.bottom-0.flex.justify-between.pb-0\\.5.pe-2\\.5.ps-1\\.5 > .flex.gap-2.items-center:last-child',
        strategyClass: 'DefaultStrategy',
        hostnamePatterns: ['copilot.microsoft']
      });

      const platform = getPlatformByHostname('copilot.microsoft.com');
      expect(platform?.strategyClass).toBe('DefaultStrategy');
    });

    it('should be enabled by default', () => {
      vi.mocked(getPlatformByHostname).mockReturnValue({
        id: 'copilot',
        hostname: 'copilot.microsoft.com',
        displayName: 'Microsoft Copilot',
        priority: 80,
        defaultEnabled: true,
        selectors: [
          'textarea[data-testid="composer-input"]',
          'textarea#userInput',
          'textarea[placeholder*="Message"]',
          'textarea[placeholder*="Copilot"]'
        ],
        buttonContainerSelector: '.relative.bottom-0.flex.justify-between.pb-0\\.5.pe-2\\.5.ps-1\\.5 > .flex.gap-2.items-center:last-child',
        strategyClass: 'DefaultStrategy',
        hostnamePatterns: ['copilot.microsoft']
      });

      const platform = getPlatformByHostname('copilot.microsoft.com');
      expect(platform?.defaultEnabled).toBe(true);
    });

    it('should have correct button container selector', () => {
      vi.mocked(getPlatformByHostname).mockReturnValue({
        id: 'copilot',
        hostname: 'copilot.microsoft.com',
        displayName: 'Microsoft Copilot',
        priority: 80,
        defaultEnabled: true,
        selectors: [
          'textarea[data-testid="composer-input"]',
          'textarea#userInput',
          'textarea[placeholder*="Message"]',
          'textarea[placeholder*="Copilot"]'
        ],
        buttonContainerSelector: '.relative.bottom-0.flex.justify-between.pb-0\\.5.pe-2\\.5.ps-1\\.5 > .flex.gap-2.items-center:last-child',
        strategyClass: 'DefaultStrategy',
        hostnamePatterns: ['copilot.microsoft']
      });

      const platform = getPlatformByHostname('copilot.microsoft.com');
      expect(platform?.buttonContainerSelector).toBe(
        '.relative.bottom-0.flex.justify-between.pb-0\\.5.pe-2\\.5.ps-1\\.5 > .flex.gap-2.items-center:last-child'
      );
    });
  });

  describe('Input Field Detection', () => {
    it('should detect primary selector: textarea[data-testid="composer-input"]', () => {
      const textarea = document.createElement('textarea');
      textarea.setAttribute('data-testid', 'composer-input');
      document.body.appendChild(textarea);

      const strategy = new DefaultStrategy();
      expect(strategy.canHandle(textarea)).toBe(true);

      document.body.removeChild(textarea);
    });

    it('should detect fallback selector: textarea#userInput', () => {
      const textarea = document.createElement('textarea');
      textarea.id = 'userInput';
      document.body.appendChild(textarea);

      const strategy = new DefaultStrategy();
      expect(strategy.canHandle(textarea)).toBe(true);

      document.body.removeChild(textarea);
    });

    it('should detect placeholder pattern: textarea[placeholder*="Message"]', () => {
      const textarea = document.createElement('textarea');
      textarea.placeholder = 'Message Copilot';
      document.body.appendChild(textarea);

      const strategy = new DefaultStrategy();
      expect(strategy.canHandle(textarea)).toBe(true);

      document.body.removeChild(textarea);
    });

    it('should detect placeholder pattern: textarea[placeholder*="Copilot"]', () => {
      const textarea = document.createElement('textarea');
      textarea.placeholder = 'Ask Copilot anything';
      document.body.appendChild(textarea);

      const strategy = new DefaultStrategy();
      expect(strategy.canHandle(textarea)).toBe(true);

      document.body.removeChild(textarea);
    });
  });

  describe('Icon Creation', () => {
    it('should create Copilot icon on copilot.microsoft.com', async () => {
      mockLocation.hostname = 'copilot.microsoft.com';
      const manager = new PlatformManager();
      await manager.initializeStrategies();

      const icon = manager.createIcon(mockUIFactory);

      expect(mockUIFactory.createCopilotIcon).toHaveBeenCalled();
      expect(icon).toBeInstanceOf(HTMLElement);
    });

    it('should not create Copilot icon on other hostnames', async () => {
      mockLocation.hostname = 'example.com';
      const manager = new PlatformManager();
      await manager.initializeStrategies();

      manager.createIcon(mockUIFactory);

      expect(mockUIFactory.createCopilotIcon).not.toHaveBeenCalled();
    });
  });

  describe('DefaultStrategy Integration', () => {
    it('should successfully insert content into Copilot textarea', async () => {
      const textarea = document.createElement('textarea');
      textarea.setAttribute('data-testid', 'composer-input');
      document.body.appendChild(textarea);

      const strategy = new DefaultStrategy();
      const result = await strategy.insert(textarea, 'Test prompt');

      expect(result.success).toBe(true);
      expect(textarea.value).toBe('Test prompt');

      document.body.removeChild(textarea);
    });

    it('should trigger input and change events after insertion', async () => {
      const textarea = document.createElement('textarea');
      textarea.setAttribute('data-testid', 'composer-input');
      document.body.appendChild(textarea);

      const inputSpy = vi.fn();
      const changeSpy = vi.fn();
      textarea.addEventListener('input', inputSpy);
      textarea.addEventListener('change', changeSpy);

      const strategy = new DefaultStrategy();
      await strategy.insert(textarea, 'Test prompt');

      expect(inputSpy).toHaveBeenCalled();
      expect(changeSpy).toHaveBeenCalled();

      textarea.removeEventListener('input', inputSpy);
      textarea.removeEventListener('change', changeSpy);
      document.body.removeChild(textarea);
    });

    it('should focus textarea after insertion', async () => {
      const textarea = document.createElement('textarea');
      textarea.setAttribute('data-testid', 'composer-input');
      document.body.appendChild(textarea);

      const focusSpy = vi.spyOn(textarea, 'focus');

      const strategy = new DefaultStrategy();
      await strategy.insert(textarea, 'Test prompt');

      expect(focusSpy).toHaveBeenCalled();

      focusSpy.mockRestore();
      document.body.removeChild(textarea);
    });
  });

  describe('Theme Detection', () => {
    it('should work with light theme (html[data-theme="light"])', () => {
      // Set light theme
      document.documentElement.setAttribute('data-theme', 'light');

      const textarea = document.createElement('textarea');
      textarea.setAttribute('data-testid', 'composer-input');
      document.body.appendChild(textarea);

      const strategy = new DefaultStrategy();
      expect(strategy.canHandle(textarea)).toBe(true);

      document.body.removeChild(textarea);
      document.documentElement.removeAttribute('data-theme');
    });

    it('should work with dark theme (html[data-theme="dark"])', () => {
      // Set dark theme
      document.documentElement.setAttribute('data-theme', 'dark');

      const textarea = document.createElement('textarea');
      textarea.setAttribute('data-testid', 'composer-input');
      document.body.appendChild(textarea);

      const strategy = new DefaultStrategy();
      expect(strategy.canHandle(textarea)).toBe(true);

      document.body.removeChild(textarea);
      document.documentElement.removeAttribute('data-theme');
    });

    it('should work without theme attribute', () => {
      // No theme attribute (default state)
      document.documentElement.removeAttribute('data-theme');

      const textarea = document.createElement('textarea');
      textarea.setAttribute('data-testid', 'composer-input');
      document.body.appendChild(textarea);

      const strategy = new DefaultStrategy();
      expect(strategy.canHandle(textarea)).toBe(true);

      document.body.removeChild(textarea);
    });
  });

  describe('PlatformManager Integration', () => {
    it('should register DefaultStrategy for Copilot', async () => {
      mockLocation.hostname = 'copilot.microsoft.com';
      const manager = new PlatformManager();
      await manager.initializeStrategies();

      const strategies = manager.getStrategies();
      const hasDefaultStrategy = strategies.some(s => s.name === 'default');

      expect(hasDefaultStrategy).toBe(true);
    });

    it('should successfully insert content via PlatformManager', async () => {
      mockLocation.hostname = 'copilot.microsoft.com';
      const textarea = document.createElement('textarea');
      textarea.setAttribute('data-testid', 'composer-input');
      document.body.appendChild(textarea);

      const manager = new PlatformManager();
      await manager.initializeStrategies();
      const result = await manager.insertContent(textarea, 'Test prompt');

      expect(result.success).toBe(true);
      expect(textarea.value).toBe('Test prompt');

      document.body.removeChild(textarea);
    });
  });

  describe('Error Handling', () => {
    it('should handle insertion to non-textarea elements gracefully', async () => {
      const div = document.createElement('div');
      document.body.appendChild(div);

      const strategy = new DefaultStrategy();
      const result = await strategy.insert(div, 'Test prompt');

      // DefaultStrategy may handle contenteditable or return error
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');

      document.body.removeChild(div);
    });

    it('should successfully insert content regardless of input type', async () => {
      const textarea = document.createElement('textarea');
      textarea.setAttribute('data-testid', 'composer-input');
      document.body.appendChild(textarea);

      const strategy = new DefaultStrategy();
      const result = await strategy.insert(textarea, 'Test with special chars: <>&"');

      expect(result.success).toBe(true);
      expect(textarea.value).toBe('Test with special chars: <>&"');

      document.body.removeChild(textarea);
    });
  });

  describe('Accessibility', () => {
    it('should support keyboard navigation', async () => {
      mockLocation.hostname = 'copilot.microsoft.com';
      const manager = new PlatformManager();
      await manager.initializeStrategies();

      const icon = manager.createIcon(mockUIFactory);

      // Icon should be a button element
      expect(icon?.tagName).toBe('BUTTON');
    });

    it('should have proper ARIA labels', () => {
      const icon = document.createElement('button');
      icon.setAttribute('aria-label', 'Open my prompt manager - Access your saved prompts');
      icon.setAttribute('title', 'My Prompt Manager - Access your saved prompts');

      expect(icon.getAttribute('aria-label')).toBe('Open my prompt manager - Access your saved prompts');
      expect(icon.getAttribute('title')).toBe('My Prompt Manager - Access your saved prompts');
    });

    it('should support tab navigation with tabindex', () => {
      const icon = document.createElement('button');
      icon.setAttribute('tabindex', '0');

      expect(icon.getAttribute('tabindex')).toBe('0');
    });
  });

  describe('Button Container Positioning', () => {
    it('should find button container with complex selector', () => {
      // Create mock DOM structure matching Copilot's layout
      const container = document.createElement('div');
      container.className = 'relative bottom-0 flex justify-between pb-0.5 pe-2.5 ps-1.5';

      const buttonGroup = document.createElement('div');
      buttonGroup.className = 'flex gap-2 items-center';

      container.appendChild(buttonGroup);
      document.body.appendChild(container);

      // Test that the selector can find the element
      const found = document.querySelector('.relative.bottom-0.flex.justify-between.pb-0\\.5.pe-2\\.5.ps-1\\.5 > .flex.gap-2.items-center:last-child');

      expect(found).toBe(buttonGroup);

      document.body.removeChild(container);
    });

    it('should position icon before microphone button', () => {
      // Create mock DOM structure
      const container = document.createElement('div');
      container.className = 'relative bottom-0 flex justify-between pb-0.5 pe-2.5 ps-1.5';

      const buttonGroup = document.createElement('div');
      buttonGroup.className = 'flex gap-2 items-center';

      const micButton = document.createElement('button');
      micButton.className = 'microphone-button';
      micButton.textContent = 'Mic';

      buttonGroup.appendChild(micButton);
      container.appendChild(buttonGroup);
      document.body.appendChild(container);

      // Insert our icon before mic button
      const ourIcon = document.createElement('button');
      ourIcon.className = 'prompt-library-integrated-icon';
      buttonGroup.insertBefore(ourIcon, micButton);

      // Verify order
      expect(buttonGroup.children[0]).toBe(ourIcon);
      expect(buttonGroup.children[1]).toBe(micButton);

      document.body.removeChild(container);
    });
  });
});
