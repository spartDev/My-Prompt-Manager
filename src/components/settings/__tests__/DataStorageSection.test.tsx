import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RETRY_FAILURE_HOLD_MS } from '../../../constants/ui';
import type { BusyResult } from '../../../hooks/useBusyButton';
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

// My-Prompt-Manager-tg6l: Import keeps the keyboard while it imports, so it follows the Loading State
// of docs/DESIGN_GUIDELINES.md: aria-disabled, never disabled, the spinner, full strength; a press
// meanwhile does nothing; a success ends it at once, a failure no sooner than RETRY_FAILURE_HOLD_MS
// after the file is chosen, shown with the idle button
describe('DataStorageSection Import busy', () => {
  afterEach(() => { vi.useRealTimers(); });

  const backupFile = (contents: string): File => {
    const file = new File([contents], 'backup.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: () => Promise.resolve(contents), configurable: true });
    return file;
  };
  const BACKUP = JSON.stringify({ prompts: [prompt('p1')], categories: [], version: '1.0' });

  const renderImport = (onImport: (data: { prompts: Prompt[]; categories: Category[] }) => Promise<BusyResult>) => {
    const onShowToast = vi.fn();
    render(
      <DataStorageSection
        prompts={[]}
        categories={[]}
        storageUsage={null}
        onImport={onImport}
        onClearData={vi.fn()}
        onShowToast={onShowToast}
      />
    );
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]') as HTMLInputElement;
    return { fileInput, onShowToast, importButton: screen.getByRole('button', { name: 'Import' }) };
  };

  /** Chooses `file` as the file chooser does */
  const choose = (fileInput: HTMLInputElement, file: File) => {
    act(() => { fireEvent.change(fileInput, { target: { files: [file] } }); });
  };

  it('while it imports: aria-disabled and still enabled, the spinner and "Importing...", no 50% dimming, the keyboard kept; a click or Enter opens no file chooser', async () => {
    let finish: () => void = () => undefined;
    const onImport = vi.fn(() => new Promise<BusyResult>((resolve) => { finish = () => { resolve(undefined); }; }));
    const { fileInput, importButton } = renderImport(onImport);
    const openFileChooser = vi.spyOn(fileInput, 'click');
    const user = userEvent.setup();
    act(() => { importButton.focus(); });

    choose(fileInput, backupFile(BACKUP));

    await waitFor(() => { expect(onImport).toHaveBeenCalledTimes(1); });
    expect(importButton).toHaveAccessibleName('Importing...');
    expect(importButton).toHaveAttribute('aria-disabled', 'true');
    expect(importButton).toBeEnabled();
    expect(importButton).toHaveFocus();
    expect(importButton.querySelector('.animate-spin')).toBeInTheDocument();
    // Its disabled:opacity-50, shared with Export, never applies: Import is never disabled
    expect(importButton.className).not.toMatch(/aria-disabled:opacity/);
    expect(importButton).toHaveClass('aria-disabled:cursor-wait');

    await user.click(importButton);
    await user.keyboard('{Enter}');
    expect(openFileChooser).not.toHaveBeenCalled();
    expect(importButton).toHaveFocus();

    act(() => { finish(); });
    await waitFor(() => { expect(importButton).toHaveAccessibleName('Import'); });
    expect(importButton).not.toHaveAttribute('aria-disabled');
    await user.click(importButton);
    expect(openFileChooser).toHaveBeenCalledTimes(1);
  });

  it(`an invalid file: "Importing..." held ${String(RETRY_FAILURE_HOLD_MS)} ms from the file chosen, nothing said; then "Import failed" with the idle button, the keyboard on it`, async () => {
    vi.useFakeTimers();
    const onImport = vi.fn(() => Promise.resolve<BusyResult>(undefined));
    const { fileInput, importButton, onShowToast } = renderImport(onImport);
    act(() => { importButton.focus(); });

    choose(fileInput, backupFile('not a backup'));
    await act(async () => { await vi.advanceTimersByTimeAsync(RETRY_FAILURE_HOLD_MS - 1); });

    expect(importButton).toHaveAccessibleName('Importing...');
    expect(importButton).toHaveAttribute('aria-disabled', 'true');
    expect(onShowToast).not.toHaveBeenCalled();

    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(onShowToast).toHaveBeenCalledWith('Import failed', 'error', { sub: 'Invalid JSON format. Please select a valid backup file.' });
    expect(importButton).toHaveAccessibleName('Import');
    expect(importButton).not.toHaveAttribute('aria-disabled');
    expect(importButton).toHaveFocus();
    expect(onImport).not.toHaveBeenCalled();
  });

  it(`a restore that fails: its outcome shown ${String(RETRY_FAILURE_HOLD_MS)} ms from the file chosen, in the task that ends the busy state`, async () => {
    vi.useFakeTimers();
    const busyWhenShown: (string | null)[] = [];
    const showFailure = vi.fn(() => { busyWhenShown.push(screen.getByRole('button', { name: /^Import/ }).getAttribute('aria-disabled')); });
    const { fileInput, importButton } = renderImport(() => Promise.resolve<BusyResult>(showFailure));

    choose(fileInput, backupFile(BACKUP));
    await act(async () => { await vi.advanceTimersByTimeAsync(RETRY_FAILURE_HOLD_MS - 1); });
    expect(showFailure).not.toHaveBeenCalled();
    expect(importButton).toHaveAttribute('aria-disabled', 'true');

    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    // Called while the busy state is still committed: the idle button commits with what it shows
    expect(showFailure).toHaveBeenCalledTimes(1);
    expect(busyWhenShown).toEqual(['true']);
    expect(importButton).not.toHaveAttribute('aria-disabled');
  });

  it('a restore that works: Import is idle as soon as it ends, not held', async () => {
    vi.useFakeTimers();
    const { fileInput, importButton } = renderImport(() => Promise.resolve<BusyResult>(undefined));

    choose(fileInput, backupFile(BACKUP));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(importButton).toHaveAccessibleName('Import');
    expect(importButton).not.toHaveAttribute('aria-disabled');
  });
});
