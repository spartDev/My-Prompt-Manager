import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import * as promptEncoder from '../../services/promptEncoder';
import { Prompt, Category } from '../../types';
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
    onDelete: vi.fn(),
    onCopy: vi.fn(),
    showToast: vi.fn(),
    searchQuery: ''
  };

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

  it('should render prompt date', () => {
    render(<PromptCard {...mockProps} />);
    // Check that a date is rendered (using aria-label since date format may vary)
    expect(screen.getByLabelText(/Last updated:/)).toBeInTheDocument();
  });

  it('should render category', () => {
    render(<PromptCard {...mockProps} />);
    expect(screen.getByText('Test Category')).toBeInTheDocument();
  });

  it('should render copy button', () => {
    render(<PromptCard {...mockProps} />);
    expect(screen.getByLabelText(/copy.*to clipboard/i)).toBeInTheDocument();
  });

  it('should apply truncate styles to long titles', () => {
    const longTitle = 'This is a very long title that should be truncated with ellipsis when it exceeds the available width of the container';
    const promptWithLongTitle: Prompt = {
      ...mockPrompt,
      title: longTitle
    };

    render(<PromptCard {...mockProps} prompt={promptWithLongTitle} />);
    const titleElement = screen.getByText(longTitle);

    // Check that truncate class is applied with inline-block for proper truncation with inline elements
    expect(titleElement).toHaveClass('truncate');
    expect(titleElement).toHaveClass('inline-block');
    expect(titleElement).toHaveClass('max-w-full');
  });

  it('should have title attribute with full text for long titles', () => {
    const longTitle = 'This is a very long title that should be truncated with ellipsis when it exceeds the available width of the container';
    const promptWithLongTitle: Prompt = {
      ...mockPrompt,
      title: longTitle
    };

    render(<PromptCard {...mockProps} prompt={promptWithLongTitle} />);
    const titleElement = screen.getByText(longTitle);

    // Check that title attribute contains full text (for tooltip on hover)
    expect(titleElement).toHaveAttribute('title', longTitle);
  });

  it('should truncate long titles even with search highlighting', () => {
    const longTitle = 'This is a very long title with searchable text that should still be truncated properly';
    const promptWithLongTitle: Prompt = {
      ...mockPrompt,
      title: longTitle
    };

    render(<PromptCard {...mockProps} prompt={promptWithLongTitle} searchQuery="searchable" />);
    const titleElement = screen.getByRole('heading', { name: /searchable/i });

    // Check that truncate styles are still applied even with highlighting (inline-block enables ellipsis with mark tags)
    expect(titleElement).toHaveClass('truncate');
    expect(titleElement).toHaveClass('inline-block');
    expect(titleElement).toHaveClass('max-w-full');
    expect(titleElement).toHaveAttribute('title', longTitle);
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

  let mockShowToast: ReturnType<typeof vi.fn>;
  let mockWriteText: ReturnType<typeof vi.fn>;
  let mockEncode: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockShowToast = vi.fn();
    mockWriteText = vi.fn().mockResolvedValue(undefined);
    mockEncode = vi.spyOn(promptEncoder, 'encode');

    // Mock clipboard API - must be done before each test
    if (!navigator.clipboard) {
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: mockWriteText
        },
        writable: true,
        configurable: true
      });
    } else {
      navigator.clipboard.writeText = mockWriteText;
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const getMockProps = () => ({
    prompt: mockPrompt,
    categories: mockCategories,
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onCopy: vi.fn(),
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

    await waitFor(() => {
      expect(mockEncode).toHaveBeenCalledWith(mockPrompt);
      expect(mockWriteText).toHaveBeenCalledWith('encoded-string');
    }, { timeout: 1000 });
  });

  it('should show success toast after copying to clipboard', async () => {
    const user = userEvent.setup();
    mockEncode.mockReturnValue('encoded-string');

    render(<PromptCard {...getMockProps()} />);
    const shareButton = screen.getByLabelText(/share test prompt/i);

    await user.click(shareButton);

    await waitFor(() => {
      expect(mockEncode).toHaveBeenCalledWith(mockPrompt);
      expect(mockWriteText).toHaveBeenCalledWith('encoded-string');
      expect(mockShowToast).toHaveBeenCalledWith('Sharing code copied to clipboard!', 'success');
    }, { timeout: 1000 });
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
      expect(mockShowToast).toHaveBeenCalledWith('Failed to copy. Please try again.', 'error');
    }, { timeout: 1000 });
  });

  it('should show error toast when clipboard write fails', async () => {
    const user = userEvent.setup();
    mockEncode.mockReturnValue('encoded-string');
    mockWriteText.mockRejectedValue(new Error('Clipboard error'));

    render(<PromptCard {...getMockProps()} />);
    const shareButton = screen.getByLabelText(/share test prompt/i);

    await user.click(shareButton);

    await waitFor(() => {
      expect(mockEncode).toHaveBeenCalledWith(mockPrompt);
      expect(mockWriteText).toHaveBeenCalledWith('encoded-string');
      expect(mockShowToast).toHaveBeenCalledWith('Failed to copy. Please try again.', 'error');
    }, { timeout: 1000 });
  });

  it('should disable button during sharing operation', async () => {
    const user = userEvent.setup();
    mockEncode.mockReturnValue('encoded-string');

    // Delay clipboard write to keep button in loading state
    mockWriteText.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    render(<PromptCard {...getMockProps()} />);
    const shareButton = screen.getByLabelText(/share test prompt/i);

    expect(shareButton).not.toBeDisabled();

    await user.click(shareButton);

    // Button should be disabled immediately after click
    await waitFor(() => {
      expect(shareButton).toBeDisabled();
    });

    // Button should be enabled again after operation completes
    await waitFor(() => {
      expect(shareButton).not.toBeDisabled();
    }, { timeout: 200 });
  });

  it('should have aria-busy attribute during sharing', async () => {
    const user = userEvent.setup();
    mockEncode.mockReturnValue('encoded-string');

    // Delay clipboard write to keep button in loading state
    mockWriteText.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    render(<PromptCard {...getMockProps()} />);
    const shareButton = screen.getByLabelText(/share test prompt/i);

    expect(shareButton).toHaveAttribute('aria-busy', 'false');

    await user.click(shareButton);

    // Should have aria-busy=true during operation
    await waitFor(() => {
      expect(shareButton).toHaveAttribute('aria-busy', 'true');
    });

    // Should reset after operation
    await waitFor(() => {
      expect(shareButton).toHaveAttribute('aria-busy', 'false');
    }, { timeout: 200 });
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
      expect(mockShowToast).toHaveBeenCalledWith('Sharing code copied to clipboard!', 'success');
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
      expect(mockShowToast).toHaveBeenCalledWith('Sharing code copied to clipboard!', 'success');
    });
  });
});