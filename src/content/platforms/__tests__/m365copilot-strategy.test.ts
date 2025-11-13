/**
 * Unit tests for M365CopilotStrategy
 *
 * Tests the Microsoft 365 Copilot platform strategy implementation,
 * including Lexical editor support, textarea fallback, content sanitization,
 * and React-compatible event triggering.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { UIElementFactory } from '../../ui/element-factory';
import { M365CopilotStrategy } from '../m365copilot-strategy';

import {
  createM365CopilotElement,
  createM365CopilotElementWithConfig,
  createM365CopilotTextarea,
  createMockUIFactory,
  setMockHostname,
  resetMockHostname,
  setupDispatchEventMock,
  setupNativeValueSetterMock,
  setupExecCommandMock,
  setupGetSelectionMock,
  cleanupElement,
  M365_COPILOT_SELECTORS,
  M365_COPILOT_BUTTON_CONTAINER_SELECTOR,
  M365_COPILOT_CONFIG,
  M365_COPILOT_MAX_LENGTH
} from './fixtures/m365copilot-fixtures';

// Mock Logger
vi.mock('../../utils/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  isDebugMode: vi.fn().mockReturnValue(false),
  showDebugNotification: vi.fn()
}));

// Mock window.location.hostname
setMockHostname('m365.cloud.microsoft');

describe('M365CopilotStrategy', () => {
  let strategy: M365CopilotStrategy;
  let mockLexicalEditor: HTMLElement;
  let mockTextarea: HTMLTextAreaElement;
  let mockDiv: HTMLElement;
  let mockUIFactory: UIElementFactory;

  beforeEach(() => {
    strategy = new M365CopilotStrategy();
    mockLexicalEditor = createM365CopilotElement('lexical');
    mockTextarea = createM365CopilotTextarea();
    mockDiv = document.createElement('div');
    mockUIFactory = createMockUIFactory();

    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupElement(mockLexicalEditor);
    cleanupElement(mockTextarea);
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create M365 Copilot strategy with correct configuration', () => {
      expect(strategy.name).toBe(M365_COPILOT_CONFIG.name);
      expect(strategy.priority).toBe(M365_COPILOT_CONFIG.priority);
      expect(strategy.getSelectors()).toContain(M365_COPILOT_SELECTORS[0]);
    });

    it('should include all configured selectors', () => {
      const selectors = strategy.getSelectors();
      M365_COPILOT_SELECTORS.forEach((selector) => {
        expect(selectors).toContain(selector);
      });
    });

    it('should have correct button container selector', () => {
      const buttonSelector = strategy.getButtonContainerSelector();
      expect(buttonSelector).toBe(M365_COPILOT_BUTTON_CONTAINER_SELECTOR);
    });

    it('should initialize strategy with correct priority', () => {
      // Act
      const newStrategy = new M365CopilotStrategy();

      // Assert
      expect(newStrategy).toBeDefined();
      expect(newStrategy.priority).toBe(80);
      expect(newStrategy.name).toBe('m365copilot');
    });
  });

  describe('canHandle', () => {
    it('should return true for textarea elements on m365.cloud.microsoft', () => {
      expect(strategy.canHandle(mockTextarea)).toBe(true);
    });

    it('should return true for contenteditable elements on m365.cloud.microsoft', () => {
      expect(strategy.canHandle(mockLexicalEditor)).toBe(true);
    });

    it('should return false for non-textarea, non-contenteditable elements', () => {
      expect(strategy.canHandle(mockDiv)).toBe(false);
    });

    it('should return false for elements not on m365.cloud.microsoft', () => {
      // Arrange
      setMockHostname('example.com');
      const newStrategy = new M365CopilotStrategy();

      // Act & Assert
      expect(newStrategy.canHandle(mockTextarea)).toBe(false);
      expect(newStrategy.canHandle(mockLexicalEditor)).toBe(false);

      resetMockHostname();
    });

    it('should return true for Lexical editor with data-lexical-editor attribute', () => {
      // Arrange
      const lexicalEditor = createM365CopilotElement('lexical');

      // Act & Assert
      expect(strategy.canHandle(lexicalEditor)).toBe(true);

      cleanupElement(lexicalEditor);
    });

    it('should return true for combobox with contenteditable', () => {
      // Arrange
      const combobox = createM365CopilotElement('combobox');

      // Act & Assert
      expect(strategy.canHandle(combobox)).toBe(true);

      cleanupElement(combobox);
    });
  });

  describe('getSelectors', () => {
    it('should return M365 Copilot-specific selectors', () => {
      const selectors = strategy.getSelectors();
      M365_COPILOT_SELECTORS.forEach((selector) => {
        expect(selectors).toContain(selector);
      });
    });

    it('should include Lexical editor selector as primary', () => {
      const selectors = strategy.getSelectors();
      expect(selectors[0]).toBe('span[id="m365-chat-editor-target-element"]');
    });

    it('should include textarea fallback selector', () => {
      const selectors = strategy.getSelectors();
      expect(selectors).toContain('textarea[placeholder*="Message"]');
    });
  });

  describe('createIcon', () => {
    it('should create icon using UI factory', () => {
      // Act
      const icon = strategy.createIcon(mockUIFactory);

      // Assert
      expect(icon).toBeDefined();
      expect(mockUIFactory.createCopilotIcon).toHaveBeenCalled();
    });

    it('should reuse Copilot icon method for consistent branding', () => {
      // Act
      strategy.createIcon(mockUIFactory);

      // Assert - Should use createCopilotIcon, not a separate M365 method
      expect(mockUIFactory.createCopilotIcon).toHaveBeenCalledTimes(1);
    });
  });

  describe('insert - Textarea Elements', () => {
    it('should insert content into textarea and set value', async () => {
      // Arrange
      const content = 'Test prompt content';

      // Act
      const result = await strategy.insert(mockTextarea, content);

      // Assert
      expect(result.success).toBe(true);
      expect(result.method).toBe('m365copilot-textarea');
      expect(mockTextarea.value).toBe(content);
    });

    it('should focus textarea before inserting content', async () => {
      // Arrange
      const content = 'Test content';

      // Act
      await strategy.insert(mockTextarea, content);

      // Assert
      expect(mockTextarea.focus).toHaveBeenCalled();
    });

    it('should dispatch input and change events for React compatibility', async () => {
      // Arrange
      const content = 'Test content';
      const dispatchSpy = setupDispatchEventMock(mockTextarea);

      // Act
      await strategy.insert(mockTextarea, content);

      // Assert
      expect(dispatchSpy).toHaveBeenCalledTimes(2);
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'input', bubbles: true })
      );
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'change', bubbles: true })
      );
    });

    it('should successfully insert content even with React optimizations', async () => {
      // Arrange
      const content = 'Test content with React';

      // Act - Insert without mocking internals (test observable behavior)
      const result = await strategy.insert(mockTextarea, content);

      // Assert - Content should be inserted successfully
      expect(result.success).toBe(true);
      expect(mockTextarea.value).toBe(content);
    });

    it('should handle textarea insertion when native setter is unavailable', async () => {
      // Arrange
      const content = 'Test content';
      const { restore } = setupNativeValueSetterMock({ unavailable: true });
      const newStrategy = new M365CopilotStrategy();

      // Act
      const result = await newStrategy.insert(mockTextarea, content);

      // Assert - Should still succeed without native setter
      expect(result.success).toBe(true);
      expect(mockTextarea.value).toBe(content);

      restore();
    });
  });

  describe('insert - ContentEditable Elements (Lexical)', () => {
    it('should insert content into Lexical editor using execCommand', async () => {
      // Arrange
      const content = 'Test prompt content';
      setupExecCommandMock(true);
      setupGetSelectionMock(true);

      // Act
      const result = await strategy.insert(mockLexicalEditor, content);

      // Assert
      expect(result.success).toBe(true);
      expect(result.method).toBe('m365copilot-contenteditable-execCommand');
    });

    it('should focus editor before inserting content', async () => {
      // Arrange
      const content = 'Test content';
      setupExecCommandMock(true);
      setupGetSelectionMock(true);

      // Act
      await strategy.insert(mockLexicalEditor, content);

      // Assert
      expect(mockLexicalEditor.focus).toHaveBeenCalled();
    });

    it('should select all existing content before replacement', async () => {
      // Arrange
      const content = 'New content';
      setupExecCommandMock(true);
      const getSelectionSpy = setupGetSelectionMock(true);
      const mockSelection = window.getSelection();

      // Act
      await strategy.insert(mockLexicalEditor, content);

      // Assert
      expect(getSelectionSpy).toHaveBeenCalled();
      expect(mockSelection?.removeAllRanges).toHaveBeenCalled();
      expect(mockSelection?.addRange).toHaveBeenCalled();
    });

    it('should use execCommand insertText with content', async () => {
      // Arrange
      const content = 'Test prompt';
      const execCommandSpy = setupExecCommandMock(true);
      setupGetSelectionMock(true);

      // Act
      await strategy.insert(mockLexicalEditor, content);

      // Assert
      expect(execCommandSpy).toHaveBeenCalledWith('insertText', false, content);
    });

    it('should dispatch input and change events after execCommand insertion', async () => {
      // Arrange
      const content = 'Test content';
      setupExecCommandMock(true);
      setupGetSelectionMock(true);
      const dispatchSpy = setupDispatchEventMock(mockLexicalEditor);

      // Act
      await strategy.insert(mockLexicalEditor, content);

      // Assert
      expect(dispatchSpy).toHaveBeenCalledTimes(2);
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'input', bubbles: true })
      );
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'change', bubbles: true })
      );
    });

    it('should fallback to DOM manipulation when execCommand fails', async () => {
      // Arrange
      const content = 'Test content';
      setupExecCommandMock(false); // execCommand fails
      setupGetSelectionMock(true);

      // Act
      const result = await strategy.insert(mockLexicalEditor, content);

      // Assert
      expect(result.success).toBe(true);
      expect(result.method).toBe('m365copilot-contenteditable-dom');
    });

    it('should create text node and insert via DOM when execCommand fails', async () => {
      // Arrange
      const content = 'Fallback content';
      setupExecCommandMock(false);
      setupGetSelectionMock(true);
      const createTextNodeSpy = vi.spyOn(document, 'createTextNode');

      // Act
      await strategy.insert(mockLexicalEditor, content);

      // Assert
      expect(createTextNodeSpy).toHaveBeenCalledWith(content);
    });

    it('should return error when selection is unavailable', async () => {
      // Arrange
      const content = 'Test content';
      setupGetSelectionMock(false); // No selection available

      // Act
      const result = await strategy.insert(mockLexicalEditor, content);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Could not get selection');
    });
  });

  describe('insert - Content Validation', () => {
    it('should reject non-string content', async () => {
      // Act
      const result = await strategy.insert(mockTextarea, 123 as any);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid content type');
    });

    it('should reject content exceeding maximum length', async () => {
      // Arrange
      const longContent = 'a'.repeat(M365_COPILOT_MAX_LENGTH + 1);

      // Act
      const result = await strategy.insert(mockTextarea, longContent);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('maximum length');
      expect(result.error).toContain(String(M365_COPILOT_MAX_LENGTH));
    });

    it('should accept content at maximum length boundary', async () => {
      // Arrange
      const maxContent = 'a'.repeat(M365_COPILOT_MAX_LENGTH);

      // Act
      const result = await strategy.insert(mockTextarea, maxContent);

      // Assert
      expect(result.success).toBe(true);
    });

    it('should sanitize control characters from content', async () => {
      // Arrange
      const contentWithControlChars = 'Hello\x00\x01\x02World';
      const expectedSanitized = 'HelloWorld';

      // Act
      await strategy.insert(mockTextarea, contentWithControlChars);

      // Assert
      expect(mockTextarea.value).toBe(expectedSanitized);
    });

    it('should preserve newlines in content', async () => {
      // Arrange
      const contentWithNewlines = 'Line 1\nLine 2\nLine 3';

      // Act
      await strategy.insert(mockTextarea, contentWithNewlines);

      // Assert
      expect(mockTextarea.value).toBe(contentWithNewlines);
    });

    it('should preserve tabs in content', async () => {
      // Arrange
      const contentWithTabs = 'Column1\tColumn2\tColumn3';

      // Act
      await strategy.insert(mockTextarea, contentWithTabs);

      // Assert
      expect(mockTextarea.value).toBe(contentWithTabs);
    });

    it('should preserve carriage returns in content', async () => {
      // Arrange
      const contentWithCR = 'Text with\rcarriage return';

      // Act
      await strategy.insert(mockTextarea, contentWithCR);

      // Assert
      expect(mockTextarea.value).toBe(contentWithCR);
    });

    it('should handle empty string content', async () => {
      // Act
      const result = await strategy.insert(mockTextarea, '');

      // Assert
      expect(result.success).toBe(true);
      expect(mockTextarea.value).toBe('');
    });
  });

  describe('insert - Error Handling', () => {
    it('should return error when element is not textarea or contenteditable', async () => {
      // Arrange
      const regularDiv = document.createElement('div');

      // Act
      const result = await strategy.insert(regularDiv, 'content');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unsupported element type');
    });

    it('should handle exceptions during textarea insertion', async () => {
      // Arrange
      const content = 'Test content';
      vi.spyOn(mockTextarea, 'focus').mockImplementation(() => {
        throw new Error('Focus failed');
      });

      // Act
      const result = await strategy.insert(mockTextarea, content);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Focus failed');
    });

    it('should handle exceptions during contenteditable insertion', async () => {
      // Arrange
      const content = 'Test content';
      setupGetSelectionMock(true);
      vi.spyOn(window, 'getSelection').mockImplementation(() => {
        throw new Error('Selection failed');
      });

      // Act
      const result = await strategy.insert(mockLexicalEditor, content);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Selection failed');
    });
  });

  describe('insert - Edge Cases', () => {
    it('should handle Unicode characters correctly', async () => {
      // Arrange
      const unicodeContent = 'Hello 世界 🌍 émojis';

      // Act
      const result = await strategy.insert(mockTextarea, unicodeContent);

      // Assert
      expect(result.success).toBe(true);
      expect(mockTextarea.value).toBe(unicodeContent);
    });

    it('should handle multi-line content in Lexical editor', async () => {
      // Arrange
      const multiLineContent = 'Line 1\nLine 2\nLine 3';
      setupExecCommandMock(true);
      setupGetSelectionMock(true);

      // Act
      const result = await strategy.insert(mockLexicalEditor, multiLineContent);

      // Assert
      expect(result.success).toBe(true);
    });

    it('should handle special characters in content', async () => {
      // Arrange
      const specialContent = '<script>alert("XSS")</script>';

      // Act
      const result = await strategy.insert(mockTextarea, specialContent);

      // Assert
      expect(result.success).toBe(true);
      expect(mockTextarea.value).toBe(specialContent);
    });

    it('should handle content with only whitespace', async () => {
      // Arrange
      const whitespaceContent = '   \n\t   ';

      // Act
      const result = await strategy.insert(mockTextarea, whitespaceContent);

      // Assert
      expect(result.success).toBe(true);
      expect(mockTextarea.value).toBe(whitespaceContent);
    });
  });

  describe('Content Replacement Behavior', () => {
    it('should replace existing content in Lexical editor, not append', async () => {
      // Arrange
      const existingContent = 'Existing text';
      const newContent = 'New prompt';
      mockLexicalEditor.textContent = existingContent;

      // Setup mocks
      setupExecCommandMock(true);
      const mockRange = {
        selectNodeContents: vi.fn(),
        deleteContents: vi.fn(),
        insertNode: vi.fn(),
        setStartAfter: vi.fn(),
        setEndAfter: vi.fn()
      };
      const mockSelection = {
        removeAllRanges: vi.fn(),
        addRange: vi.fn(),
        getRangeAt: vi.fn().mockReturnValue(mockRange)
      };
      vi.spyOn(document, 'createRange').mockReturnValue(mockRange as any);
      vi.spyOn(window, 'getSelection').mockReturnValue(mockSelection as any);

      // Act
      await strategy.insert(mockLexicalEditor, newContent);

      // Assert - Should select all content before insertion (replacement behavior)
      expect(mockRange.selectNodeContents).toHaveBeenCalledWith(mockLexicalEditor);
      expect(mockSelection.removeAllRanges).toHaveBeenCalled();
      expect(mockSelection.addRange).toHaveBeenCalledWith(mockRange);
    });

    it('should replace content in textarea, not append', async () => {
      // Arrange
      const existingContent = 'Old content';
      const newContent = 'New content';
      mockTextarea.value = existingContent;

      // Act
      await strategy.insert(mockTextarea, newContent);

      // Assert
      expect(mockTextarea.value).toBe(newContent);
      expect(mockTextarea.value).not.toContain(existingContent);
    });
  });

  describe('Performance Optimizations', () => {
    it('should handle multiple insertions efficiently', async () => {
      // Arrange
      const newTextarea = createM365CopilotTextarea();

      // Act - Multiple insertions (test observable behavior, not caching)
      const result1 = await strategy.insert(newTextarea, 'First');
      const result2 = await strategy.insert(newTextarea, 'Second');
      const result3 = await strategy.insert(newTextarea, 'Third');

      // Assert - All insertions should succeed
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result3.success).toBe(true);
      expect(newTextarea.value).toBe('Third'); // Last value wins (replacement behavior)

      cleanupElement(newTextarea);
    });
  });

  describe('Integration with Different Element Types', () => {
    it('should handle primary Lexical editor element', async () => {
      // Arrange
      const editor = createM365CopilotElementWithConfig({
        type: 'lexical',
        attributes: { id: 'm365-chat-editor-target-element' }
      });
      setupExecCommandMock(true);
      setupGetSelectionMock(true);

      // Act
      const canHandle = strategy.canHandle(editor);
      const result = await strategy.insert(editor, 'Test content');

      // Assert
      expect(canHandle).toBe(true);
      expect(result.success).toBe(true);

      cleanupElement(editor);
    });

    it('should handle generic contenteditable div', async () => {
      // Arrange
      const editor = createM365CopilotElement('contenteditable');
      setupExecCommandMock(true);
      setupGetSelectionMock(true);

      // Act
      const canHandle = strategy.canHandle(editor);
      const result = await strategy.insert(editor, 'Test content');

      // Assert
      expect(canHandle).toBe(true);
      expect(result.success).toBe(true);

      cleanupElement(editor);
    });

    it('should handle textarea fallback element', async () => {
      // Arrange
      const textarea = createM365CopilotTextarea();

      // Act
      const canHandle = strategy.canHandle(textarea);
      const result = await strategy.insert(textarea, 'Test content');

      // Assert
      expect(canHandle).toBe(true);
      expect(result.success).toBe(true);
      expect(result.method).toBe('m365copilot-textarea');

      cleanupElement(textarea);
    });

    it('should handle combobox role with contenteditable', async () => {
      // Arrange
      const combobox = createM365CopilotElement('combobox');
      setupExecCommandMock(true);
      setupGetSelectionMock(true);

      // Act
      const canHandle = strategy.canHandle(combobox);
      const result = await strategy.insert(combobox, 'Test content');

      // Assert
      expect(canHandle).toBe(true);
      expect(result.success).toBe(true);

      cleanupElement(combobox);
    });
  });

  describe('Helper Methods - _dispatchInputEvents', () => {
    it('should dispatch both input and change events', () => {
      // Arrange
      const dispatchSpy = setupDispatchEventMock(mockLexicalEditor);

      // Act
      strategy['_dispatchInputEvents'](mockLexicalEditor);

      // Assert
      expect(dispatchSpy).toHaveBeenCalledTimes(2);
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'input', bubbles: true })
      );
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'change', bubbles: true })
      );
    });

    it('should dispatch events in correct order (input then change)', () => {
      // Arrange
      const events: string[] = [];
      mockLexicalEditor.addEventListener('input', () => events.push('input'));
      mockLexicalEditor.addEventListener('change', () => events.push('change'));

      // Act
      strategy['_dispatchInputEvents'](mockLexicalEditor);

      // Assert
      expect(events).toEqual(['input', 'change']);
    });
  });

  describe('Helper Methods - _prepareSelection', () => {
    it('should return selection object when available', () => {
      // Arrange
      setupGetSelectionMock(true);

      // Act
      const selection = strategy['_prepareSelection'](mockLexicalEditor);

      // Assert
      expect(selection).toBeDefined();
      expect(selection).not.toBeNull();
    });

    it('should return null when selection is unavailable', () => {
      // Arrange
      setupGetSelectionMock(false);

      // Act
      const selection = strategy['_prepareSelection'](mockLexicalEditor);

      // Assert
      expect(selection).toBeNull();
    });

    it('should select all content in the element', () => {
      // Arrange
      const getSelectionSpy = setupGetSelectionMock(true);
      const mockSelection = window.getSelection();

      // Act
      strategy['_prepareSelection'](mockLexicalEditor);

      // Assert
      expect(getSelectionSpy).toHaveBeenCalled();
      expect(mockSelection?.removeAllRanges).toHaveBeenCalled();
      expect(mockSelection?.addRange).toHaveBeenCalled();
    });
  });

  describe('Helper Methods - _tryExecCommandInsertion', () => {
    it('should return success when execCommand works', () => {
      // Arrange
      setupExecCommandMock(true);
      const selection = setupGetSelectionMock(true);
      const mockSelection = window.getSelection();
      expect(mockSelection).toBeDefined();

      // Act
      const result = strategy['_tryExecCommandInsertion'](mockLexicalEditor, 'test content', mockSelection as Selection);

      // Assert
      expect(result.success).toBe(true);
      expect(result.method).toBe('m365copilot-contenteditable-execCommand');
    });

    it('should return failure when execCommand fails', () => {
      // Arrange
      setupExecCommandMock(false);
      const selection = setupGetSelectionMock(true);
      const mockSelection = window.getSelection();
      expect(mockSelection).toBeDefined();

      // Act
      const result = strategy['_tryExecCommandInsertion'](mockLexicalEditor, 'test content', mockSelection as Selection);

      // Assert
      expect(result.success).toBe(false);
    });

    it('should call execCommand with correct parameters', () => {
      // Arrange
      const execCommandSpy = setupExecCommandMock(true);
      const selection = setupGetSelectionMock(true);
      const mockSelection = window.getSelection();
      expect(mockSelection).toBeDefined();
      const content = 'Test prompt content';

      // Act
      strategy['_tryExecCommandInsertion'](mockLexicalEditor, content, mockSelection as Selection);

      // Assert
      expect(execCommandSpy).toHaveBeenCalledWith('insertText', false, content);
    });

    it('should dispatch events when successful', () => {
      // Arrange
      setupExecCommandMock(true);
      const selection = setupGetSelectionMock(true);
      const mockSelection = window.getSelection();
      expect(mockSelection).toBeDefined();
      const dispatchSpy = setupDispatchEventMock(mockLexicalEditor);

      // Act
      strategy['_tryExecCommandInsertion'](mockLexicalEditor, 'test', mockSelection as Selection);

      // Assert
      expect(dispatchSpy).toHaveBeenCalledTimes(2);
    });

    it('should not dispatch events when execCommand fails', () => {
      // Arrange
      setupExecCommandMock(false);
      const selection = setupGetSelectionMock(true);
      const mockSelection = window.getSelection();
      expect(mockSelection).toBeDefined();
      const dispatchSpy = setupDispatchEventMock(mockLexicalEditor);

      // Act
      strategy['_tryExecCommandInsertion'](mockLexicalEditor, 'test', mockSelection as Selection);

      // Assert
      expect(dispatchSpy).not.toHaveBeenCalled();
    });
  });

  describe('Helper Methods - _tryDOMInsertion', () => {
    it('should successfully insert content using DOM manipulation', () => {
      // Arrange
      const selection = setupGetSelectionMock(true);
      const mockSelection = window.getSelection();
      expect(mockSelection).toBeDefined();
      const content = 'DOM inserted content';

      // Act
      const result = strategy['_tryDOMInsertion'](mockLexicalEditor, content, mockSelection as Selection);

      // Assert
      expect(result.success).toBe(true);
      expect(result.method).toBe('m365copilot-contenteditable-dom');
    });

    it('should create text node with correct content', () => {
      // Arrange
      const selection = setupGetSelectionMock(true);
      const mockSelection = window.getSelection();
      expect(mockSelection).toBeDefined();
      const content = 'Test content';
      const createTextNodeSpy = vi.spyOn(document, 'createTextNode');

      // Act
      strategy['_tryDOMInsertion'](mockLexicalEditor, content, mockSelection as Selection);

      // Assert
      expect(createTextNodeSpy).toHaveBeenCalledWith(content);
    });

    it('should dispatch events after DOM insertion', () => {
      // Arrange
      const selection = setupGetSelectionMock(true);
      const mockSelection = window.getSelection();
      expect(mockSelection).toBeDefined();
      const dispatchSpy = setupDispatchEventMock(mockLexicalEditor);

      // Act
      strategy['_tryDOMInsertion'](mockLexicalEditor, 'test', mockSelection as Selection);

      // Assert
      expect(dispatchSpy).toHaveBeenCalledTimes(2);
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'input', bubbles: true })
      );
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'change', bubbles: true })
      );
    });
  });
});
