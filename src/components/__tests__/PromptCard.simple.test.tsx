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
    expect(screen.getByText('Copy')).toBeInTheDocument();
  });
});