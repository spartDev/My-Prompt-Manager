/**
 * Unit tests for M365CopilotStrategy
 *
 * Tests the Microsoft 365 Copilot platform strategy implementation,
 * including Lexical editor support, textarea fallback, verbatim delivery of content,
 * and React-compatible event triggering.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { editorCommand } from '../../../test/helpers/editor-command';
import { expectNoMarkupIn, HOSTILE_TEXTS } from '../../../test/helpers/hostile-text';
import { readInputText } from '../../selector/inputText';
import type { UIElementFactory } from '../../ui/element-factory';
import { M365CopilotStrategy } from '../m365copilot-strategy';

import {
  cleanupElement,
  createM365CopilotElement,
  createM365CopilotElementWithConfig,
  createM365CopilotTextarea,
  createMockUIFactory,
  M365_COPILOT_CONFIG, 
  M365_COPILOT_SELECTORS,
  resetMockHostname,
  setMockHostname,
  setupDispatchEventMock,
  setupExecCommandMock,
  setupGetSelectionMock,
  setupNativeValueSetterMock
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
      const heard: string[] = [];
      mockTextarea.addEventListener('input', (event) => heard.push(`input bubbles=${String(event.bubbles)}`));
      mockTextarea.addEventListener('change', (event) => heard.push(`change bubbles=${String(event.bubbles)}`));

      // Act
      await strategy.insert(mockTextarea, 'Test content');

      // Assert
      expect(heard).toEqual(['input bubbles=true', 'change bubbles=true']);
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
    beforeEach(() => {
      document.body.appendChild(mockLexicalEditor);
      document.getSelection()?.removeAllRanges();
    });

    it('should insert content into Lexical editor using execCommand', async () => {
      // Arrange
      const execCommand = editorCommand(mockLexicalEditor);
      document.execCommand = execCommand;

      // Act
      const result = await strategy.insert(mockLexicalEditor, 'Test prompt content');

      // Assert
      expect(result.success).toBe(true);
      expect(result.method).toBe('m365copilot-contenteditable-execCommand');
      expect(execCommand).toHaveBeenCalledWith('insertText', false, 'Test prompt content');
      expect(readInputText(mockLexicalEditor)).toBe('Test prompt content');
    });

    it('should focus editor before inserting content', async () => {
      // Arrange
      document.execCommand = editorCommand(mockLexicalEditor);

      // Act
      await strategy.insert(mockLexicalEditor, 'Test content');

      // Assert
      expect(mockLexicalEditor.focus).toHaveBeenCalled();
    });

    it('should dispatch input and change events after execCommand insertion', async () => {
      // Arrange
      document.execCommand = editorCommand(mockLexicalEditor);
      const heard: string[] = [];
      mockLexicalEditor.addEventListener('input', () => heard.push('input'));
      mockLexicalEditor.addEventListener('change', () => heard.push('change'));

      // Act
      await strategy.insert(mockLexicalEditor, 'Test content');

      // Assert
      expect(heard).toEqual(['input', 'change']);
    });

    it('should write the text itself when execCommand fails', async () => {
      // Arrange
      document.execCommand = vi.fn().mockReturnValue(false);

      // Act
      const result = await strategy.insert(mockLexicalEditor, 'Fallback content');

      // Assert
      expect(result.success).toBe(true);
      expect(result.method).toBe('m365copilot-contenteditable-dom');
      expect(readInputText(mockLexicalEditor)).toBe('Fallback content');
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

    it('should not reject long content', async () => {
      // Arrange
      const longContent = 'a'.repeat(60000);

      // Act
      const result = await strategy.insert(mockTextarea, longContent);

      // Assert
      expect(result.success).toBe(true);
      expect(mockTextarea.value).toBe(longContent);
    });

    it('should leave control and invisible characters as given', async () => {
      // Arrange
      const content = 'Hello\u{0}\u{1}\u{2}World\u{200B}\u{200D}';

      // Act
      await strategy.insert(mockTextarea, content);

      // Assert
      expect(mockTextarea.value).toBe(content);
    });

    it('should insert content exactly as given', async () => {
      // Arrange
      const content = '  Summarize the metadata: use <example>text</example> tags; if count=5 and onboarding = true, return data: JSON\n\n';

      // Act
      await strategy.insert(mockTextarea, content);

      // Assert
      expect(mockTextarea.value).toBe(content);
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
      document.execCommand = vi.fn(() => {
        throw new Error('Editing command failed');
      });

      // Act
      const result = await strategy.insert(mockLexicalEditor, 'Test content');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Editing command failed');
    });
  });

  describe.each(HOSTILE_TEXTS)('hostile-looking text %j', (text) => {
    it('is set as the value of a textarea', async () => {
      // Arrange
      document.body.appendChild(mockTextarea);

      // Act
      const result = await strategy.insert(mockTextarea, text);

      // Assert
      expect(result.method).toBe('m365copilot-textarea');
      expect(mockTextarea.value).toBe(text);
      expectNoMarkupIn(document.body, ['textarea']);
    });

    it('goes to execCommand as the same text', async () => {
      // Arrange
      document.body.appendChild(mockLexicalEditor);
      document.getSelection()?.removeAllRanges();
      const execCommand = editorCommand(mockLexicalEditor);
      document.execCommand = execCommand;

      // Act
      const result = await strategy.insert(mockLexicalEditor, text);

      // Assert
      expect(result.method).toBe('m365copilot-contenteditable-execCommand');
      expect(execCommand).toHaveBeenCalledWith('insertText', false, text);
      expect(readInputText(mockLexicalEditor)).toBe(text);
      // The paragraph is the stand-in editor's own structure
      expectNoMarkupIn(mockLexicalEditor, ['p']);
    });

    it('is written as text when execCommand fails', async () => {
      // Arrange
      document.body.appendChild(mockLexicalEditor);
      document.getSelection()?.removeAllRanges();
      document.execCommand = vi.fn().mockReturnValue(false);

      // Act
      const result = await strategy.insert(mockLexicalEditor, text);

      // Assert
      expect(result.method).toBe('m365copilot-contenteditable-dom');
      expect(mockLexicalEditor.textContent).toBe(text);
      expectNoMarkupIn(mockLexicalEditor);
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
});
