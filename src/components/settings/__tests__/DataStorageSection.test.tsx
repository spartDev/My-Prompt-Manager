import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Category, Prompt } from '../../../types';
import DataStorageSection from '../DataStorageSection';

const prompt = (id: string): Prompt => ({ id, title: `Prompt ${id}`, content: 'Hello', category: 'Uncategorized', createdAt: 1, updatedAt: 1 });
const category = (id: string): Category => ({ id, name: `Category ${id}` });

const renderSection = (prompts: Prompt[], categories: Category[]) =>
  render(
    <DataStorageSection
      prompts={prompts}
      categories={categories}
      storageUsage={null}
      onImport={vi.fn()}
      onClearData={vi.fn()}
      onShowToast={vi.fn()}
    />
  );

// My-Prompt-Manager-lqu: one Prompt and one Category read in the singular, any other count in the plural
describe('DataStorageSection counts', () => {
  it.each([
    [0, '0 prompts', '0 categories'],
    [1, '1 prompt', '1 category'],
    [2, '2 prompts', '2 categories']
  ])('shows %i Prompts and Categories as "%s" and "%s"', (count, promptText, categoryText) => {
    const ids = Array.from({ length: count }, (_, i) => String(i));
    renderSection(ids.map(prompt), ids.map(category));

    expect(screen.getByText(`${promptText} · ${categoryText}`)).toBeInTheDocument();
  });
});

describe('DataStorageSection storage', () => {
  it('states what this device stores, each amount with its unit, and fills the bar as much', () => {
    render(
      <DataStorageSection
        prompts={[]}
        categories={[]}
        storageUsage={{ used: 300 * 1024, total: 10 * 1024 * 1024 }}
        onImport={vi.fn()}
        onClearData={vi.fn()}
        onShowToast={vi.fn()}
      />
    );

    expect(screen.getByRole('region', { name: 'Your data' })).toBeInTheDocument();
    expect(screen.getByText('Stored on this device')).toBeInTheDocument();
    expect(screen.getByText('300 KB of 10 MB')).toBeInTheDocument();
    const bar = screen.getByRole('progressbar', { name: 'Storage usage' });
    expect(bar).toHaveAttribute('aria-valuenow', '3');
    expect(bar.firstElementChild).toHaveClass('animate-fill-grow', 'origin-left');
  });
});
