import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

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