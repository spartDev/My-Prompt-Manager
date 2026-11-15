import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WHATS_NEW_KEY } from '../../whatsNew/storage';
import ErrorBoundary from '../ErrorBoundary';


// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // Mock console.error to avoid error output in tests
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render children when there is no error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('should render error UI when there is an error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it('should display error message', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText(/test error/i)).toBeInTheDocument();
  });

  it('should have a retry button', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  describe('Reset Data', () => {
    const RECORD = { installedVersion: '1.9.0', lastSeenVersion: '2.0.0' };

    it("clears storage but leaves the What's new record", async () => {
      await chrome.storage.local.set({
        prompts: [{ id: 'p1' }],
        categories: [],
        promptLibrarySettings: { debugMode: true },
        [WHATS_NEW_KEY]: RECORD
      });
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      fireEvent.click(screen.getByRole('button', { name: /reset data/i }));

      await waitFor(async () => {
        expect(await chrome.storage.local.get(null)).toEqual({ [WHATS_NEW_KEY]: RECORD });
      });
    });

    it("still clears storage when the What's new record cannot be read", async () => {
      await chrome.storage.local.set({ prompts: [{ id: 'p1' }], [WHATS_NEW_KEY]: RECORD });
      vi.mocked(chrome.storage.local.get).mockRejectedValueOnce(new Error('storage unavailable'));
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      fireEvent.click(screen.getByRole('button', { name: /reset data/i }));

      await waitFor(async () => {
        expect(chrome.storage.local.clear).toHaveBeenCalled();
        expect(await chrome.storage.local.get(null)).toEqual({});
      });
    });
  });
});