import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { buildPrompt } from '../../test/builders';
import type { AppError, Category } from '../../types';
import CategoryManager from '../CategoryManager';

const baseCategories: Category[] = [
  { id: 'uncat', name: 'Uncategorized' },
  { id: 'ideas', name: 'Ideas', color: '#2563EB' },
  { id: 'email', name: 'Email', color: '#DB2777' }
];

type Props = React.ComponentProps<typeof CategoryManager>;

const renderManager = (overrides: Partial<Props> = {}) => {
  const props: Props = {
    categories: [...baseCategories],
    prompts: [],
    onCreateCategory: vi.fn((category: { name: string; color: string }) => Promise.resolve({ id: 'new', ...category })),
    onUpdateCategory: vi.fn().mockResolvedValue(undefined),
    onDeleteCategory: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };

  const utils = render(<CategoryManager {...props} />);
  return { props, user: userEvent.setup(), ...utils };
};

const sheetGone = async () => {
  await waitFor(() => { expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); });
};

describe('CategoryManager', () => {
  it('is titled "Categories" with the category count as subtitle and no Back button', () => {
    renderManager();

    expect(screen.getByRole('heading', { name: 'Categories' })).toBeInTheDocument();
    expect(screen.getByText('3 categories')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /go back/i })).not.toBeInTheDocument();
  });

  it('uses the singular for a single category', () => {
    renderManager({ categories: [baseCategories[0]] });

    expect(screen.getByText('1 category')).toBeInTheDocument();
  });

  it('shows a Close button only in the side panel', () => {
    const { unmount } = renderManager({ context: 'popup' });
    expect(screen.queryByRole('button', { name: /close side panel/i })).not.toBeInTheDocument();
    unmount();

    renderManager({ context: 'sidepanel' });
    expect(screen.getByRole('button', { name: /close side panel/i })).toBeInTheDocument();
  });

  it('has no form on the screen: Categories are created and edited only in the sheet', () => {
    renderManager();

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add category' })).toBeInTheDocument();
  });

  it('leaves the default Category out of editing: its row opens nothing', () => {
    renderManager();

    const row = screen.getAllByTestId('category-row').find(r => r.dataset.categoryName === 'Uncategorized');
    expect(row?.tagName).toBe('DIV');
    expect(screen.queryByRole('button', { name: /Uncategorized/ })).not.toBeInTheDocument();
  });

  describe('creating', () => {
    it('opens an empty sheet with the focus in the name and the first color no Category uses', async () => {
      const { user } = renderManager();

      await user.click(screen.getByRole('button', { name: 'Add category' }));

      const sheet = screen.getByRole('dialog', { name: 'New category' });
      expect(within(sheet).getByText('Add prompts to it from the editor.')).toBeInTheDocument();
      const name = within(sheet).getByRole('textbox', { name: 'Category name' });
      expect(name).toHaveValue('');
      expect(name).toHaveFocus();
      expect(within(sheet).getByTestId('category-sheet-preview')).toHaveTextContent('?');
      // Ocean Blue and Pink are taken: Sky Blue is the first free one
      expect(within(sheet).getByRole('button', { name: 'Sky Blue' })).toHaveAttribute('aria-pressed', 'true');
      expect(within(sheet).getAllByRole('button', { pressed: false })).toHaveLength(11);
    });

    it('shows the whole first character in the preview: an emoji, a flag or an accented letter', async () => {
      const { user } = renderManager();
      await user.click(screen.getByRole('button', { name: 'Add category' }));
      const sheet = screen.getByRole('dialog', { name: 'New category' });
      const name = within(sheet).getByRole('textbox', { name: 'Category name' });
      const preview = within(sheet).getByTestId('category-sheet-preview');

      const family = '\u{1F469}\u200D\u{1F469}\u200D\u{1F467}';
      await user.paste(`${family} Family`);
      expect(preview.textContent).toBe(family);

      await user.clear(name);
      await user.paste('\u{1F1EB}\u{1F1F7} France');
      expect(preview.textContent).toBe('\u{1F1EB}\u{1F1F7}');

      await user.clear(name);
      await user.paste('e\u0301cole');
      expect(preview.textContent).toBe('E\u0301');
    });

    it('creates the Category with Create, closes the sheet and gives the keyboard back to Add category', async () => {
      const { user, props } = renderManager();

      await user.click(screen.getByRole('button', { name: 'Add category' }));
      const sheet = screen.getByRole('dialog', { name: 'New category' });
      await user.type(within(sheet).getByRole('textbox', { name: 'Category name' }), 'research');
      expect(within(sheet).getByTestId('category-sheet-preview')).toHaveTextContent('R');
      await user.click(within(sheet).getByRole('button', { name: 'Teal' }));
      expect(within(sheet).getByRole('button', { name: 'Teal' })).toHaveAttribute('aria-pressed', 'true');
      await user.click(within(sheet).getByRole('button', { name: 'Create' }));

      expect(props.onCreateCategory).toHaveBeenCalledWith({ name: 'research', color: '#0F766E' }, screen.getByRole('button', { name: 'Add category' }));
      await sheetGone();
      expect(screen.getByRole('button', { name: 'Add category' })).toHaveFocus();
    });

    it('stays open while the Category is being created: Escape, Cancel, Close and the backdrop wait for it', async () => {
      const resolvers: Array<() => void> = [];
      const slowCreate = vi.fn((category: { name: string; color: string }) =>
        new Promise<Category>(resolve => { resolvers.push(() => { resolve({ id: 'new', ...category }); }); }));
      const { user } = renderManager({ onCreateCategory: slowCreate });

      await user.click(screen.getByRole('button', { name: 'Add category' }));
      const sheet = screen.getByRole('dialog', { name: 'New category' });
      await user.type(within(sheet).getByRole('textbox', { name: 'Category name' }), 'Research');
      await user.click(within(sheet).getByRole('button', { name: 'Create' }));
      await user.keyboard('{Escape}');
      await user.click(within(sheet).getByRole('button', { name: 'Cancel' }));
      await user.click(within(sheet).getByRole('button', { name: 'Close' }));
      await user.click(screen.getByTestId('category-sheet-backdrop'));
      // Closing now would look like cancelling a Category that is created anyway
      expect(sheet).toHaveClass('sheet-in');

      resolvers.forEach(resolve => { resolve(); });
      await sheetGone();
      expect(slowCreate).toHaveBeenCalledTimes(1);
    });

    it('creates with Enter in the name', async () => {
      const { user, props } = renderManager();

      await user.click(screen.getByRole('button', { name: 'Add category' }));
      await user.keyboard('Research{Enter}');

      await waitFor(() => { expect(props.onCreateCategory).toHaveBeenCalledTimes(1); });
      await sheetGone();
    });

    it.each([
      ['empty', ''],
      ['only spaces', '   ']
    ])('does nothing while the name is %s', async (_label, typed) => {
      const { user, props } = renderManager();

      await user.click(screen.getByRole('button', { name: 'Add category' }));
      if (typed) {await user.keyboard(typed);}
      const create = screen.getByRole('button', { name: 'Create' });
      expect(create).toHaveAttribute('aria-disabled', 'true');
      expect(create).toHaveClass('opacity-45');

      await user.click(create);
      await user.keyboard('{Enter}');

      expect(props.onCreateCategory).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog', { name: 'New category' })).toBeInTheDocument();
    });

    it('keeps the sheet open with the reason under the name when the name is taken, until it changes', async () => {
      const refused: AppError = { type: 'VALIDATION_ERROR', message: 'Category with name "Ideas" already exists' };
      const { user } = renderManager({ onCreateCategory: vi.fn().mockRejectedValue(refused) });

      await user.click(screen.getByRole('button', { name: 'Add category' }));
      await user.keyboard('ideas{Enter}');

      const sheet = screen.getByRole('dialog', { name: 'New category' });
      expect(await within(sheet).findByRole('alert')).toHaveTextContent('Category with name "Ideas" already exists');
      const name = within(sheet).getByRole('textbox', { name: 'Category name' });
      expect(name).toHaveValue('ideas');
      expect(name).toHaveAccessibleDescription('Category with name "Ideas" already exists');

      await user.type(name, '2');
      expect(within(sheet).queryByRole('alert')).not.toBeInTheDocument();
    });

    it('closes the sheet when the storage is full, for the storage warning to take its place', async () => {
      const full: AppError = { type: 'STORAGE_QUOTA_EXCEEDED', message: 'Quota reached' };
      const { user } = renderManager({ onCreateCategory: vi.fn().mockRejectedValue(full) });

      await user.click(screen.getByRole('button', { name: 'Add category' }));
      await user.keyboard('Research{Enter}');

      await sheetGone();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('pops the new Category in once the sheet has gone', async () => {
      const { user, props, rerender } = renderManager();

      await user.click(screen.getByRole('button', { name: 'Add category' }));
      await user.keyboard('Research{Enter}');
      rerender(<CategoryManager {...props} categories={[...baseCategories, { id: 'new', name: 'Research', color: '#0369A1' }]} />);

      const row = () => screen.getAllByTestId('category-row').find(r => r.dataset.categoryName === 'Research');
      expect(row()).toHaveClass('opacity-0');
      await sheetGone();
      expect(row()).toHaveClass('category-pop');
    });
  });

  describe('editing', () => {
    it('opens the sheet on the Category, filled in, with how many Prompts use it', async () => {
      const prompts = [buildPrompt({ category: 'Email' }), buildPrompt({ category: 'Email' }), buildPrompt({ category: 'Ideas' })];
      const { user } = renderManager({ prompts });

      await user.click(screen.getByRole('button', { name: 'Edit category Email' }));

      const sheet = screen.getByRole('dialog', { name: 'Edit category' });
      expect(within(sheet).getByText('Used by 2 prompts')).toBeInTheDocument();
      expect(within(sheet).getByRole('textbox', { name: 'Category name' })).toHaveValue('Email');
      expect(within(sheet).getByRole('textbox', { name: 'Category name' })).toHaveFocus();
      expect(within(sheet).getByRole('button', { name: 'Pink' })).toHaveAttribute('aria-pressed', 'true');
      expect(within(sheet).getByTestId('category-sheet-preview')).toHaveTextContent('E');
      // The edited Category keeps a border of its color behind the backdrop
      expect(screen.getByRole('button', { name: 'Edit category Email' })).toHaveStyle({ boxShadow: 'inset 0 0 0 2px #DB2777' });
    });

    it('says "Not used yet" for a Category no Prompt uses', async () => {
      const { user } = renderManager();

      await user.click(screen.getByRole('button', { name: 'Edit category Ideas' }));

      expect(within(screen.getByRole('dialog')).getByText('Not used yet')).toBeInTheDocument();
    });

    it('saves the new name and color, closes and gives the keyboard back to the row', async () => {
      const { user, props } = renderManager();

      await user.click(screen.getByRole('button', { name: 'Edit category Ideas' }));
      const sheet = screen.getByRole('dialog', { name: 'Edit category' });
      const name = within(sheet).getByRole('textbox', { name: 'Category name' });
      await user.clear(name);
      await user.type(name, 'Ideas 2');
      await user.click(within(sheet).getByRole('button', { name: 'Rose' }));
      await user.click(within(sheet).getByRole('button', { name: 'Save' }));

      expect(props.onUpdateCategory).toHaveBeenCalledWith('ideas', { name: 'Ideas 2', color: '#E11D48' });
      await sheetGone();
      expect(screen.getByRole('button', { name: 'Edit category Ideas' })).toHaveFocus();
    });

    it('closes without saving when nothing changed', async () => {
      const { user, props } = renderManager();

      await user.click(screen.getByRole('button', { name: 'Edit category Ideas' }));
      await user.keyboard('{Enter}');

      await sheetGone();
      expect(props.onUpdateCategory).not.toHaveBeenCalled();
    });

    it('keeps a custom color: no swatch is chosen and Save does not change it', async () => {
      const { user, props } = renderManager({ categories: [{ id: 'odd', name: 'Odd', color: '#123456' }] });

      await user.click(screen.getByRole('button', { name: 'Edit category Odd' }));
      expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0);
      await user.keyboard(' 2{Enter}');

      await waitFor(() => { expect(props.onUpdateCategory).toHaveBeenCalledWith('odd', { name: 'Odd 2' }); });
    });
  });

  describe('deleting', () => {
    it('deletes from the sheet, closes it and moves the keyboard to the next row', async () => {
      const { user, props, rerender } = renderManager();

      await user.click(screen.getByRole('button', { name: 'Edit category Ideas' }));
      vi.mocked(props.onDeleteCategory).mockImplementation(() => {
        rerender(<CategoryManager {...props} categories={baseCategories.filter(c => c.id !== 'ideas')} />);
        return Promise.resolve();
      });
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));

      expect(props.onDeleteCategory).toHaveBeenCalledWith(baseCategories[1]);
      await sheetGone();
      expect(screen.getByRole('button', { name: 'Edit category Email' })).toHaveFocus();
    });

    it('deletes once on a double click, so the Notification with Undo is not replaced by a failure', async () => {
      const resolvers: Array<() => void> = [];
      const finish = () => { resolvers.forEach(resolve => { resolve(); }); };
      const slowDelete = vi.fn(() => new Promise<void>(resolve => { resolvers.push(resolve); }));
      const { user } = renderManager({ onDeleteCategory: slowDelete });

      await user.click(screen.getByRole('button', { name: 'Edit category Ideas' }));
      await user.dblClick(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
      finish();

      expect(slowDelete).toHaveBeenCalledTimes(1);
      await sheetGone();
    });

    it('stays open while the deletion runs: Escape, Cancel and the backdrop wait for it to end', async () => {
      const resolvers: Array<() => void> = [];
      const slowDelete = vi.fn(() => new Promise<void>(resolve => { resolvers.push(resolve); }));
      const { user } = renderManager({ onDeleteCategory: slowDelete });

      await user.click(screen.getByRole('button', { name: 'Edit category Ideas' }));
      const sheet = screen.getByRole('dialog', { name: 'Edit category' });
      await user.click(within(sheet).getByRole('button', { name: 'Delete' }));
      await user.keyboard('{Escape}');
      await user.click(within(sheet).getByRole('button', { name: 'Cancel' }));
      await user.click(screen.getByTestId('category-sheet-backdrop'));
      // Still the sheet that started the deletion, so its end applies to it and to nothing else
      expect(sheet).toHaveClass('sheet-in');

      resolvers.forEach(resolve => { resolve(); });
      await sheetGone();
    });

    it('starts no deletion while a save runs: whichever ended first would close the sheet', async () => {
      const resolvers: Array<() => void> = [];
      const slowUpdate = vi.fn(() => new Promise<void>(resolve => { resolvers.push(resolve); }));
      const { user, props } = renderManager({ onUpdateCategory: slowUpdate });

      await user.click(screen.getByRole('button', { name: 'Edit category Ideas' }));
      const sheet = screen.getByRole('dialog', { name: 'Edit category' });
      await user.type(within(sheet).getByRole('textbox', { name: 'Category name' }), ' 2');
      await user.click(within(sheet).getByRole('button', { name: 'Save' }));
      const remove = within(sheet).getByRole('button', { name: 'Delete' });
      expect(remove).toHaveAttribute('aria-disabled', 'true');
      await user.click(remove);
      expect(props.onDeleteCategory).not.toHaveBeenCalled();

      resolvers.forEach(resolve => { resolve(); });
      await sheetGone();
      expect(slowUpdate).toHaveBeenCalledTimes(1);
    });

    it('saves nothing while a deletion runs', async () => {
      const resolvers: Array<() => void> = [];
      const slowDelete = vi.fn(() => new Promise<void>(resolve => { resolvers.push(resolve); }));
      const { user, props } = renderManager({ onDeleteCategory: slowDelete });

      await user.click(screen.getByRole('button', { name: 'Edit category Ideas' }));
      const sheet = screen.getByRole('dialog', { name: 'Edit category' });
      await user.click(within(sheet).getByRole('button', { name: 'Pink' }));
      await user.click(within(sheet).getByRole('button', { name: 'Delete' }));
      await user.click(within(sheet).getByRole('button', { name: 'Save' }));
      expect(props.onUpdateCategory).not.toHaveBeenCalled();
      expect(sheet).toHaveClass('sheet-in');

      resolvers.forEach(resolve => { resolve(); });
      await sheetGone();
    });

    it('has no Delete when creating', async () => {
      const { user } = renderManager();

      await user.click(screen.getByRole('button', { name: 'Add category' }));

      expect(within(screen.getByRole('dialog')).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    });

    it('asks first when the Notifications are off, as there is no Undo', async () => {
      const { user, props } = renderManager({ confirmDelete: true });

      await user.click(screen.getByRole('button', { name: 'Edit category Ideas' }));
      await user.click(within(screen.getByRole('dialog', { name: 'Edit category' })).getByRole('button', { name: 'Delete' }));

      const confirm = screen.getByRole('dialog', { name: 'Delete Category' });
      expect(props.onDeleteCategory).not.toHaveBeenCalled();
      // One modal dialog at a time: the sheet behind is out of reach, assistive technology included
      expect(screen.getByRole('dialog', { name: 'Edit category', hidden: true }).closest('[inert]')).not.toBeNull();
      await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));
      // Back in the sheet, which has the keyboard again, on the Delete that opened the confirmation
      const sheetAgain = screen.getByRole('dialog', { name: 'Edit category' });
      await waitFor(() => { expect(within(sheetAgain).getByRole('button', { name: 'Delete' })).toHaveFocus(); });
      expect(screen.getByRole('dialog', { name: 'Edit category' }).closest('[inert]')).toBeNull();

      await user.click(within(screen.getByRole('dialog', { name: 'Edit category' })).getByRole('button', { name: 'Delete' }));
      await user.click(within(screen.getByRole('dialog', { name: 'Delete Category' })).getByRole('button', { name: 'Delete' }));
      expect(props.onDeleteCategory).toHaveBeenCalledWith(baseCategories[1]);
    });
  });

  describe('closing', () => {
    it.each([
      ['Escape', async (user: ReturnType<typeof userEvent.setup>) => { await user.keyboard('{Escape}'); }],
      ['the backdrop', async (user: ReturnType<typeof userEvent.setup>) => { await user.click(screen.getByTestId('category-sheet-backdrop')); }],
      ['the close button', async (user: ReturnType<typeof userEvent.setup>) => { await user.click(screen.getByRole('button', { name: 'Close' })); }],
      ['Cancel', async (user: ReturnType<typeof userEvent.setup>) => { await user.click(screen.getByRole('button', { name: 'Cancel' })); }]
    ])('closes without saving with %s', async (_label, closeWith) => {
      const { user, props } = renderManager();

      await user.click(screen.getByRole('button', { name: 'Edit category Ideas' }));
      await user.keyboard('{End} 2');
      await closeWith(user);

      await sheetGone();
      expect(props.onUpdateCategory).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Edit category Ideas' })).toHaveFocus();
    });

    it('plays the exit before leaving the page, without taking input', async () => {
      const { user } = renderManager();

      await user.click(screen.getByRole('button', { name: 'Add category' }));
      expect(screen.getByRole('dialog')).toHaveClass('sheet-in');
      await user.keyboard('{Escape}');

      const leaving = screen.getByRole('dialog', { hidden: true });
      expect(leaving).toHaveClass('sheet-out');
      expect(screen.getByTestId('category-sheet-backdrop')).toHaveClass('backdrop-out');
      await sheetGone();
    });

    it('opens again as one fresh sheet when reopened during its exit', async () => {
      const { user } = renderManager();

      await user.click(screen.getByRole('button', { name: 'Add category' }));
      await user.keyboard('Draft{Escape}');
      await user.click(screen.getByRole('button', { name: 'Add category' }));

      // Past the exit: the closing that was cancelled does not take the new sheet away
      await new Promise(resolve => { setTimeout(resolve, 400); });
      expect(screen.getAllByRole('dialog')).toHaveLength(1);
      expect(screen.getByRole('textbox', { name: 'Category name' })).toHaveValue('');
    });

    it('steps the screen back while the sheet is open, out of reach of assistive technology', async () => {
      const { user, container } = renderManager();
      const screenBehind = container.firstElementChild;

      expect(screenBehind).not.toHaveAttribute('data-stepped-back');
      expect(screenBehind).not.toHaveAttribute('inert');
      await user.click(screen.getByRole('button', { name: 'Add category' }));
      expect(screenBehind).toHaveAttribute('data-stepped-back');
      expect(screenBehind).toHaveAttribute('inert');
      await user.keyboard('{Escape}');
      expect(screenBehind).not.toHaveAttribute('data-stepped-back');
      // Not during the exit: the keyboard goes back to what opened the sheet
      expect(screenBehind).not.toHaveAttribute('inert');
    });
  });
});
