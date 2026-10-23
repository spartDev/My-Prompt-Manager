/**
 * End to end: a saved Prompt reaches the chat exactly as saved.
 *
 * Nothing under test is mocked. A Prompt is saved through StorageManager into the shared
 * in-memory chrome.storage, read back by the content script's own reader, listed by the
 * Prompt selector, chosen with a click, and inserted by a real Platform strategy (ChatGPT
 * and Claude here) into a real element. See CONTEXT.md (Verbatim) and ADR-001.
 *
 * Reproduces the reported bug: this text used to reach the chat as
 * "Summarize the meta use text tags; if count=5 and  true, return  JSON".
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_CATEGORY } from '../../constants';
import { StorageManager } from '../../services/storage';
import { PromptLibraryInjector } from '../core/injector';
import { createPromptListItem, getPrompts } from '../utils/storage';

vi.mock('../utils/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  isDebugMode: vi.fn().mockReturnValue(false),
  showDebugNotification: vi.fn()
}));

const FAMILY = '\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}';

const HEADLINE =
  '  Summarize the metadata: use <example>text</example> tags; if count=5 and onboarding = true, return data: JSON\n' +
  `<context>${FAMILY} kept together</context>\n\n  `;

function atHostname(hostname: string): void {
  Object.defineProperty(window, 'location', {
    value: { hostname, href: `https://${hostname}/` },
    writable: true,
    configurable: true
  });
}

describe('Prompt text reaches the chat exactly as saved', () => {
  let injector: PromptLibraryInjector | undefined;
  let input: HTMLElement | undefined;

  beforeEach(() => {
    document.execCommand = vi.fn().mockReturnValue(false);
  });

  afterEach(async () => {
    injector?.cleanup();
    input?.remove();
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    // Let the selector's delayed outside-click setup finish
    await new Promise((resolve) => setTimeout(resolve, 150));
  });

  const save = (content: string, title = 'Q&A / "FAQ"') =>
    StorageManager.getInstance().savePrompt({ title, content, category: DEFAULT_CATEGORY });

  const openSelector = async (target: HTMLElement): Promise<void> => {
    injector = new PromptLibraryInjector();
    await injector.initialize();
    await injector.showPromptSelector(target);
  };

  const itemFor = (promptId: string): HTMLElement | undefined =>
    Array.from(document.querySelectorAll<HTMLElement>('.prompt-item')).find(
      (candidate) => candidate.dataset.promptId === promptId
    );

  const openSelectorAndChoose = async (target: HTMLElement, promptId: string): Promise<void> => {
    await openSelector(target);
    expect(itemFor(promptId)).toBeDefined();
    itemFor(promptId)?.click();
  };

  it('is stored, read, listed and inserted into ChatGPT byte for byte', async () => {
    atHostname('chatgpt.com');
    const saved = await save(HEADLINE);

    // Stored exactly as written
    expect(((await chrome.storage.local.get('prompts')).prompts as Array<{ content: string }>)[0].content).toBe(HEADLINE);

    // Read by the content script's own reader
    const [read] = await getPrompts();
    expect(read).toMatchObject({ id: saved.id, title: 'Q&A / "FAQ"' });
    expect(read.content).toBe(HEADLINE);

    // Listed by the Prompt selector as saved
    const listed = createPromptListItem(read, 0);
    expect(listed.querySelector('.prompt-title')?.textContent).toBe('Q&A / "FAQ"');
    expect(listed.querySelector('.prompt-preview')?.textContent).toBe(HEADLINE.substring(0, 100) + '...');
    expect(listed.dataset.promptId).toBe(saved.id);

    // Chosen from the selector and inserted by the ChatGPT strategy
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    input = textarea;
    await openSelectorAndChoose(textarea, saved.id);

    await vi.waitFor(() => {
      expect(textarea.value).toBe(HEADLINE);
    });
  });

  it('is inserted into Claude byte for byte', async () => {
    atHostname('claude.ai');
    const saved = await save(HEADLINE);

    const editor = document.createElement('div');
    editor.className = 'ProseMirror';
    editor.contentEditable = 'true';
    editor.setAttribute('role', 'textbox');
    document.body.appendChild(editor);
    input = editor;
    await openSelectorAndChoose(editor, saved.id);

    await vi.waitFor(() => {
      expect(editor.textContent).toBe(HEADLINE);
    });
  });

  it('is inserted as text when the Prompt looks hostile', async () => {
    atHostname('chatgpt.com');
    const hostile = '<img src=x onerror=alert(1)> "><svg onload=alert(1)> javascript:alert(1)';
    const saved = await save(hostile, '<script>alert(1)</script>');

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    input = textarea;
    await openSelector(textarea);

    // The selector shows the title as text, and nothing was made from the text
    expect(itemFor(saved.id)?.querySelector('.prompt-title')?.textContent).toBe('<script>alert(1)</script>');
    expect(document.querySelectorAll('img, svg, script')).toHaveLength(0);

    itemFor(saved.id)?.click();

    await vi.waitFor(() => {
      expect(textarea.value).toBe(hostile);
    });
    expect(document.querySelectorAll('img, svg, script')).toHaveLength(0);
  });

  it('loses nothing but Hidden characters, and those only once, when it is saved', async () => {
    atHostname('chatgpt.com');
    const withHidden = 'Summarize\u{200B} the <example>metadata</example>\u{E0041}\u{202E} please\n';
    const saved = await save(withHidden);

    const expected = 'Summarize the <example>metadata</example> please\n';
    expect(saved.content).toBe(expected);
    expect((await getPrompts())[0].content).toBe(expected);

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    input = textarea;
    await openSelectorAndChoose(textarea, saved.id);

    await vi.waitFor(() => {
      expect(textarea.value).toBe(expected);
    });
  });
});
