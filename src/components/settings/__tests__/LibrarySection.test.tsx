import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import LibrarySection from '../LibrarySection';

describe('LibrarySection', () => {
  it('offers the five sorts, each in one direction, with the saved one selected', () => {
    render(<LibrarySection sortOrder="lastUsedAt" onSortOrderChange={vi.fn()} />);

    const select = screen.getByLabelText('Sort prompts by');
    expect(select).toHaveValue('lastUsedAt');
    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual([
      'Recently Updated',
      'Recently Used',
      'Recently Created',
      'Number of Uses',
      'Alphabetical (A→Z)'
    ]);
  });

  it('reports the sort chosen', async () => {
    const user = userEvent.setup();
    const onSortOrderChange = vi.fn();
    render(<LibrarySection sortOrder="updatedAt" onSortOrderChange={onSortOrderChange} />);

    await user.selectOptions(screen.getByLabelText('Sort prompts by'), 'Alphabetical (A→Z)');

    expect(onSortOrderChange).toHaveBeenCalledWith('title');
  });

  it('cannot be changed while saving', () => {
    render(<LibrarySection sortOrder="updatedAt" onSortOrderChange={vi.fn()} disabled />);

    expect(screen.getByLabelText('Sort prompts by')).toBeDisabled();
  });
});
