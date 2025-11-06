import { renderHook, waitFor, act } from '@testing-library/react';
import { expect, vi } from 'vitest';

import { useTheme } from '../../hooks/useTheme';
import { StorageManager } from '../../services/storage';
import type { StorageManagerMock } from '../../test/setup';
import { DEFAULT_SETTINGS } from '../../types';
import type { Settings } from '../../types';

/**
 * Test helper for setting up theme tests with consistent mock configuration
 *
 * Reduces duplication in useTheme tests by extracting the common pattern
 * of mocking storage, rendering the hook, and waiting for initialization.
 *
 * @param initialTheme - Initial theme value to mock
 * @returns Object containing the renderHook result and storage manager mock
 *
 * @example
 * ```typescript
 * import { setupThemeTest } from '@test/helpers';
 *
 * it('should toggle from light to dark', async () => {
 *   const { result, storageManager } = await setupThemeTest('light');
 *
 *   await act(async () => {
 *     await result.current.toggleTheme();
 *   });
 *
 *   expect(result.current.theme).toBe('dark');
 * });
 * ```
 */
export async function setupThemeTest(initialTheme: Settings['theme']) {
  const storageManager = StorageManager.getInstance() as StorageManagerMock;

  storageManager.getSettings.mockResolvedValue({
    theme: initialTheme,
    enableSync: false,
    customSites: []
  });

  vi.mocked(storageManager.updateSettings).mockResolvedValue(DEFAULT_SETTINGS);

  const hookResult = renderHook(() => useTheme());

  await waitFor(() => {
    expect(hookResult.result.current.theme).toBe(initialTheme);
  });

  return {
    result: hookResult.result,
    rerender: hookResult.rerender,
    unmount: hookResult.unmount,
    storageManager
  };
}

/**
 * Test helper for verifying theme toggle behavior
 *
 * Encapsulates the common pattern of toggling theme and verifying the result.
 *
 * @param currentTheme - Current theme before toggle
 * @param expectedTheme - Expected theme after toggle
 * @param storageManager - Storage manager mock instance
 *
 * @example
 * ```typescript
 * import { testThemeToggle } from '@test/helpers';
 *
 * it('should toggle from light to dark', async () => {
 *   await testThemeToggle('light', 'dark');
 * });
 * ```
 */
export async function testThemeToggle(
  currentTheme: Settings['theme'],
  expectedTheme: Settings['theme']
) {
  const { result, storageManager } = await setupThemeTest(currentTheme);

  await act(async () => {
    await result.current.toggleTheme();
  });

  expect(result.current.theme).toBe(expectedTheme);
  expect(storageManager.updateSettings).toHaveBeenCalledWith({ theme: expectedTheme });
}
