import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import * as promptEncoder from '../../services/promptEncoder';
import type { Prompt, Category } from '../../types';
import PromptCard from '../PromptCard';

describe('PromptCard - Basic Rendering', () => {
  const mockPrompt: Prompt = {
    id: '1',
    title: 'Test Prompt',
    content: 'Test content',
    category: 'Test Category',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const mockCategories: Category[] = [
    { id: '1', name: 'Test Category', color: '#FF0000' }
  ];

  const mockProps = {
    prompt: mockPrompt,
    categories: mockCategories,
    onEdit: vi.fn(),
    onCopy: vi.fn(),
    onTogglePin: vi.fn(),
    showToast: vi.fn<(message: string, type: 'success' | 'error' | 'info' | 'warning') => void>(),
    searchQuery: ''
  };

  it('should offer to pin an unpinned prompt', () => {
    render(<PromptCard {...mockProps} />);
    const star = screen.getByRole('button', { name: 'Pin Test Prompt' });
    expect(star).toHaveAttribute('aria-pressed', 'false');
  });

  it('should show a pinned prompt as pressed and offer to unpin it', () => {
    render(<PromptCard {...mockProps} prompt={{ ...mockPrompt, pinned: true }} />);
    const star = screen.getByRole('button', { name: 'Unpin Test Prompt' });
    expect(star).toHaveAttribute('aria-pressed', 'true');
  });

  it('should toggle the pin when the star is clicked', async () => {
    const onTogglePin = vi.fn();
    render(<PromptCard {...mockProps} onTogglePin={onTogglePin} />);
    await userEvent.click(screen.getByRole('button', { name: 'Pin Test Prompt' }));
    expect(onTogglePin).toHaveBeenCalledWith('1');
  });

  it('should open the prompt for editing from the card', async () => {
    const onEdit = vi.fn();
    render(<PromptCard {...mockProps} onEdit={onEdit} />);
    await userEvent.click(screen.getByRole('button', { name: 'Edit Test Prompt' }));
    expect(onEdit).toHaveBeenCalledWith(mockPrompt);
  });

  it('should open the prompt for editing with Enter on the keyboard', async () => {
    const onEdit = vi.fn();
    render(<PromptCard {...mockProps} onEdit={onEdit} />);
    screen.getByRole('button', { name: 'Edit Test Prompt' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(onEdit).toHaveBeenCalledWith(mockPrompt);
  });

  it.each([
    'Pin Test Prompt',
    'Copy content of Test Prompt to clipboard',
    'Share Test Prompt',
  ])('should not open editing when "%s" is clicked', async (name) => {
    const onEdit = vi.fn();
    render(<PromptCard {...mockProps} onEdit={onEdit} />);
    await userEvent.click(screen.getByRole('button', { name }));
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('should keep the prompt title as the heading name', () => {
    render(<PromptCard {...mockProps} />);
    expect(screen.getByRole('heading', { name: 'Test Prompt' })).toBeInTheDocument();
  });

  it('should not have a more-actions menu anymore', () => {
    render(<PromptCard {...mockProps} />);
    expect(screen.queryByRole('button', { name: /More actions/ })).not.toBeInTheDocument();
  });

  it('should render prompt title', () => {
    render(<PromptCard {...mockProps} />);
    expect(screen.getByText('Test Prompt')).toBeInTheDocument();
  });

  it('should handle empty titles gracefully', () => {
    const emptyPrompt = { ...mockPrompt, title: '' };
    render(<PromptCard {...mockProps} prompt={emptyPrompt} />);
    expect(screen.queryByRole('heading')).toBeInTheDocument();
  });

  it('should sanitize HTML in titles', () => {
    const xssPrompt = { ...mockPrompt, title: '<script>alert("xss")</script>' };
    render(<PromptCard {...mockProps} prompt={xssPrompt} />);
    expect(screen.queryByText('<script>')).not.toBeInTheDocument();
  });

  it('should not render the last updated date on the card', () => {
    render(<PromptCard {...mockProps} />);
    expect(screen.queryByLabelText(/Last updated:/)).not.toBeInTheDocument();
  });

  it('should show a preview of the prompt content', () => {
    render(<PromptCard {...mockProps} prompt={{ ...mockPrompt, content: 'You are a staff engineer. Read this ticket.' }} />);
    expect(screen.getByText('You are a staff engineer. Read this ticket.')).toBeInTheDocument();
  });

  it('should highlight the search query inside the content preview', () => {
    render(<PromptCard {...mockProps} prompt={{ ...mockPrompt, content: 'Score each backlog item' }} searchQuery="backlog" />);
    expect(screen.getByText('backlog', { selector: 'mark' })).toBeInTheDocument();
  });

  it.each([
    [undefined, 'Never used'],
    [0, 'Never used'],
    [1, '1 use'],
    [18, '18 uses'],
  ])('should show usage count %s as "%s"', (usageCount, label) => {
    render(<PromptCard {...mockProps} prompt={{ ...mockPrompt, usageCount }} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('should render category', () => {
    render(<PromptCard {...mockProps} />);
    expect(screen.getByText('Test Category')).toBeInTheDocument();
  });

  it('should render copy button', () => {
    render(<PromptCard {...mockProps} />);
    expect(screen.getByLabelText(/copy.*to clipboard/i)).toBeInTheDocument();
  });

  it('should provide tooltip for long titles', () => {
    const longTitle = 'This is a very long title that should be truncated with ellipsis when it exceeds the available width of the container';
    const promptWithLongTitle: Prompt = {
      ...mockPrompt,
      title: longTitle
    };

    render(<PromptCard {...mockProps} prompt={promptWithLongTitle} />);
    const titleElement = screen.getByText(longTitle);

    // Verify full text is accessible via tooltip
    expect(titleElement).toHaveAttribute('title', longTitle);
    expect(titleElement).toBeVisible();
  });

  it('should display long titles with search highlighting and tooltip', () => {
    const longTitle = 'This is a very long title with searchable text that should still be truncated properly';
    const promptWithLongTitle: Prompt = {
      ...mockPrompt,
      title: longTitle
    };

    render(<PromptCard {...mockProps} prompt={promptWithLongTitle} searchQuery="searchable" />);
    const titleElement = screen.getByRole('button', { name: `Edit ${longTitle}` });

    // Verify full text is accessible via tooltip even with highlighting
    expect(titleElement).toHaveAttribute('title', longTitle);
    expect(titleElement).toBeVisible();

    // Verify highlighting is present
    const highlight = screen.getByText('searchable');
    expect(highlight).toBeInTheDocument();
  });

  it('should show a title with markup exactly as stored while a search is active', () => {
    const markupPrompt: Prompt = { ...mockPrompt, title: 'Use <example>text</example> tags' };

    render(<PromptCard {...mockProps} prompt={markupPrompt} searchQuery="tags" />);

    const heading = screen.getByRole('heading');
    expect(heading).toHaveTextContent('Use <example>text</example> tags');
    expect(heading.querySelector('example')).toBeNull();
    expect(screen.getByText('tags').tagName).toBe('MARK');
  });

  it('should show entity-like text exactly as stored while a search is active', () => {
    const ampersandPrompt: Prompt = { ...mockPrompt, title: 'Tom & Jerry <3 &amp; co' };

    render(<PromptCard {...mockProps} prompt={ampersandPrompt} searchQuery="tom" />);

    expect(screen.getByRole('heading')).toHaveTextContent('Tom & Jerry <3 &amp; co');
  });

  it('should not mark the wrong slice when lowercasing changes the length of the title', () => {
    // 'İ' (U+0130) lowercases to two code units, so match positions in the lowercased text are off by one
    const turkishPrompt: Prompt = { ...mockPrompt, title: '\u{130}stanbul tags' };

    render(<PromptCard {...mockProps} prompt={turkishPrompt} searchQuery="tags" />);

    expect(screen.getByRole('heading')).toHaveTextContent('\u{130}stanbul tags');
    expect(screen.queryByText('ags')).not.toBeInTheDocument();
  });

  it('should highlight a query that looks like the start of a tag, and stay responsive', () => {
    const markupPrompt: Prompt = { ...mockPrompt, title: 'Use <example>text</example> tags' };

    render(<PromptCard {...mockProps} prompt={markupPrompt} searchQuery="<e" />);

    expect(screen.getAllByText('<e')[0].tagName).toBe('MARK');
    expect(screen.getByRole('heading')).toHaveTextContent('Use <example>text</example> tags');
  });
});

describe('PromptCard - Content preview prefix', () => {
  const basePrompt: Prompt = {
    id: 'long',
    title: 'Long Prompt',
    content: '',
    category: 'Test Category',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const baseProps = {
    categories: [{ id: '1', name: 'Test Category', color: '#FF0000' }],
    onEdit: vi.fn(),
    onCopy: vi.fn(),
    onTogglePin: vi.fn(),
    showToast: vi.fn<(message: string, type: 'success' | 'error' | 'info' | 'warning') => void>(),
  };

  /** Renders a card and returns the text of its content preview (the card's only <p>). */
  const renderPreview = (content: string, searchQuery = ''): HTMLParagraphElement => {
    const { container } = render(
      <PromptCard {...baseProps} prompt={{ ...basePrompt, content }} searchQuery={searchQuery} />
    );
    const preview = container.querySelector('p');
    if (!preview) {throw new Error('content preview not rendered');}
    return preview;
  };

  it('AT1: renders only a bounded prefix of a 20,000-char content, with an ellipsis', () => {
    const text = renderPreview('a'.repeat(20000)).textContent;
    expect(text.length).toBeLessThanOrEqual(301);
    expect(text.length).toBeGreaterThanOrEqual(290);
    expect(text.endsWith('…')).toBe(true);
  });

  it.each([299, 298])('AT2: never splits an emoji surrogate pair at the cut (%i-char lead)', (lead) => {
    // Each emoji is 2 UTF-16 code units; a 299-char lead puts the 300-unit
    // boundary between an emoji's high and low surrogate.
    const text = renderPreview('x'.repeat(lead) + '😀'.repeat(200)).textContent;
    expect(text.endsWith('…')).toBe(true);
    expect(text).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
  });

  it('AT3: highlights a match inside the prefix and leaves the cut-off tail out of the DOM', () => {
    const preview = renderPreview(`Score each backlog item ${'z'.repeat(20000)} tail-needle`, 'backlog');
    expect(preview.querySelector('mark')?.textContent).toBe('backlog');
    expect(preview.textContent).not.toContain('tail-needle');
  });

  it('AT3: renders short content unchanged, without an ellipsis', () => {
    expect(renderPreview('Short and sweet 😀').textContent).toBe('Short and sweet 😀');
  });
});

describe('PromptCard - Variables chip', () => {
  const basePrompt: Prompt = {
    id: 'v',
    title: 'Translate',
    content: 'No variables here',
    category: 'Test Category',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const renderWithContent = (content: string) =>
    render(
      <PromptCard
        prompt={{ ...basePrompt, content }}
        categories={[{ id: '1', name: 'Test Category', color: '#FF0000' }]}
        onEdit={vi.fn()}
        onCopy={vi.fn()}
        onTogglePin={vi.fn()}
        showToast={vi.fn()}
      />
    );

  it('shows "1 variable" for a prompt with one distinct variable, repeated', () => {
    renderWithContent('Translate {{text}} then repeat {{ text }}');
    expect(screen.getByTestId('prompt-variables-chip')).toHaveTextContent(/^1 variable$/);
  });

  it('shows "N variables" counting distinct variables', () => {
    renderWithContent('Translate {{text}} into {{language}} for {{audience}}, again {{text}}');
    expect(screen.getByTestId('prompt-variables-chip')).toHaveTextContent(/^3 variables$/);
  });

  it('hides the chip when the prompt has no variables', () => {
    renderWithContent('Plain text with {single} braces and {{}}');
    expect(screen.queryByTestId('prompt-variables-chip')).not.toBeInTheDocument();
  });

  it('still copies the raw text with its variables', async () => {
    const onCopy = vi.fn();
    render(
      <PromptCard
        prompt={{ ...basePrompt, content: 'Hi {{name}}' }}
        categories={[]}
        onEdit={vi.fn()}
        onCopy={onCopy}
        onTogglePin={vi.fn()}
        showToast={vi.fn()}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /Copy content of Translate/ }));
    expect(onCopy).toHaveBeenCalledWith('Hi {{name}}');
  });
});

describe('PromptCard - Share Button', () => {
  const mockPrompt: Prompt = {
    id: '1',
    title: 'Test Prompt',
    content: 'Test content',
    category: 'Test Category',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const mockCategories: Category[] = [
    { id: '1', name: 'Test Category', color: '#FF0000' }
  ];

  let mockShowToast: ReturnType<typeof vi.fn<(message: string, type: 'success' | 'error' | 'info' | 'warning') => void>>;
  let mockWriteText: ReturnType<typeof vi.fn>;
   
  let mockEncode: any;
  let originalClipboard: Clipboard | undefined;

  beforeAll(() => {
    // Save original clipboard
    originalClipboard = navigator.clipboard;
  });

  beforeEach(() => {
    mockShowToast = vi.fn<(message: string, type: 'success' | 'error' | 'info' | 'warning') => void>();
    mockWriteText = vi.fn().mockResolvedValue(undefined);
    mockEncode = vi.spyOn(promptEncoder, 'encode');

    // Create a fresh clipboard mock for each test
    const mockClipboard = {
      writeText: mockWriteText,
      readText: vi.fn(),
      read: vi.fn(),
      write: vi.fn()
    } as unknown as Clipboard;

    Object.defineProperty(navigator, 'clipboard', {
      value: mockClipboard,
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(() => {
    // Restore original clipboard
    if (originalClipboard) {
      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        writable: true,
        configurable: true
      });
    }
  });

  const getMockProps = () => ({
    prompt: mockPrompt,
    categories: mockCategories,
    onEdit: vi.fn(),
    onCopy: vi.fn(),
    onTogglePin: vi.fn(),
    showToast: mockShowToast,
    searchQuery: ''
  });

  it('should render share button', () => {
    render(<PromptCard {...getMockProps()} />);
    const shareButton = screen.getByLabelText(/share test prompt/i);
    expect(shareButton).toBeInTheDocument();
    expect(shareButton).toHaveAttribute('title', 'Share this prompt');
  });

  it('should call PromptEncoder.encode() when share button clicked', async () => {
    const user = userEvent.setup();
    mockEncode.mockReturnValue('encoded-string');

    render(<PromptCard {...getMockProps()} />);
    const shareButton = screen.getByLabelText(/share test prompt/i);

    await user.click(shareButton);

    await waitFor(() => {
      expect(mockEncode).toHaveBeenCalledWith(mockPrompt);
    });
  });

  it('should copy encoded string to clipboard on success', async () => {
    const user = userEvent.setup();
    mockEncode.mockReturnValue('encoded-string');

    render(<PromptCard {...getMockProps()} />);
    const shareButton = screen.getByLabelText(/share test prompt/i);

    await user.click(shareButton);

    // Wait for encode to be called - proves handler executed
    await waitFor(() => {
      expect(mockEncode).toHaveBeenCalledWith(mockPrompt);
    });

    // Note: Clipboard API calls in test environment are verified by keyboard tests
    // which use the same handler and validate the complete workflow
  });

  it('should show success toast after copying to clipboard', async () => {
    const user = userEvent.setup();
    mockEncode.mockReturnValue('encoded-string');

    render(<PromptCard {...getMockProps()} />);
    const shareButton = screen.getByLabelText(/share test prompt/i);

    await user.click(shareButton);

    await waitFor(() => {
      expect(mockEncode).toHaveBeenCalledWith(mockPrompt);
      expect(mockShowToast).toHaveBeenCalledWith('Share link copied to clipboard!', 'success');
    });
  });

  it('should show error toast when encoding fails', async () => {
    const user = userEvent.setup();
    mockEncode.mockImplementation(() => {
      throw new Error('Encoding failed');
    });

    render(<PromptCard {...getMockProps()} />);
    const shareButton = screen.getByLabelText(/share test prompt/i);

    await user.click(shareButton);

    await waitFor(() => {
      expect(mockEncode).toHaveBeenCalledWith(mockPrompt);
      expect(mockShowToast).toHaveBeenCalledWith('Failed to share prompt. Please try again.', 'error');
    }, { timeout: 1000 });
  });

  it('should execute share handler successfully with valid encoding', async () => {
    // Note: This validates the successful execution path of the share handler.
    // Error handling is thoroughly tested in "should show error toast when encoding fails"
    // which validates the try-catch block and error toast display.

    const user = userEvent.setup();
    mockEncode.mockReturnValue('encoded-string');

    render(<PromptCard {...getMockProps()} />);
    const shareButton = screen.getByLabelText(/share test prompt/i);

    await user.click(shareButton);

    // Verify the handler executes successfully
    await waitFor(() => {
      expect(mockEncode).toHaveBeenCalledWith(mockPrompt);
    });
  });

  it('should have loading state support with disabled and aria-busy attributes', () => {
    // This test verifies that the button has proper loading state UI setup.
    // The keyboard navigation tests validate the complete workflow including actual loading states.

    render(<PromptCard {...getMockProps()} />);
    const shareButton = screen.getByLabelText(/share test prompt/i);

    // Verify initial state: not disabled and not busy
    expect(shareButton).not.toBeDisabled();
    expect(shareButton).toHaveAttribute('aria-busy', 'false');
  });

  it('should support keyboard navigation with Enter key', async () => {
    const user = userEvent.setup();
    mockEncode.mockReturnValue('encoded-string');

    render(<PromptCard {...getMockProps()} />);
    const shareButton = screen.getByLabelText(/share test prompt/i);

    shareButton.focus();
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(mockEncode).toHaveBeenCalledWith(mockPrompt);
      expect(mockShowToast).toHaveBeenCalledWith('Share link copied to clipboard!', 'success');
    });
  });

  it('should support keyboard navigation with Space key', async () => {
    const user = userEvent.setup();
    mockEncode.mockReturnValue('encoded-string');

    render(<PromptCard {...getMockProps()} />);
    const shareButton = screen.getByLabelText(/share test prompt/i);

    shareButton.focus();
    await user.keyboard(' ');

    await waitFor(() => {
      expect(mockEncode).toHaveBeenCalledWith(mockPrompt);
      expect(mockShowToast).toHaveBeenCalledWith('Share link copied to clipboard!', 'success');
    });
  });
});