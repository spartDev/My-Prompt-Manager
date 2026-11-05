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

    expect(screen.getByText(promptText)).toBeInTheDocument();
    expect(screen.getByText(categoryText)).toBeInTheDocument();
  });
});
