import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { testThemeToggle } from "../../test/helpers/theme-helpers";
import { DEFAULT_SETTINGS } from "../../types";
import type { Settings } from "../../types";
import type { GlobalWithMocks } from "../../types/test-helpers";
import { useTheme } from "../useTheme";

describe("useTheme", () => {
  let mockMatchMedia: {
    matches: boolean;
    media: string;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
    onchange: ((this: MediaQueryList, ev: MediaQueryListEvent) => void) | null;
    addListener: ReturnType<typeof vi.fn>;
    removeListener: ReturnType<typeof vi.fn>;
    dispatchEvent: ReturnType<typeof vi.fn>;
  };
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(async () => {
    // Save original window.matchMedia
    originalMatchMedia = window.matchMedia;
    // Reset localStorage
    localStorage.clear();

    // Reset document class
    document.documentElement.className = "";

    // Setup matchMedia mock
    mockMatchMedia = {
      matches: false,
      media: "(prefers-color-scheme: dark)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        ...mockMatchMedia,
        media: query,
      })),
    });

    // Reset chrome.tabs.query mock
    vi.mocked(chrome.tabs.query).mockImplementation(
      (
        _queryInfo: chrome.tabs.QueryInfo,
        callback?: (tabs: chrome.tabs.Tab[]) => void,
      ) => {
        const result: chrome.tabs.Tab[] = [];
        if (callback) {
          callback(result);
          return Promise.resolve(result);
        }
        return Promise.resolve(result);
      },
    );

    // Initialize storage with default data
    await chrome.storage.local.set({
      prompts: [],
      categories: [],
      settings: {
        ...DEFAULT_SETTINGS,
        theme: "system",
      },
    });
  });

  afterEach(() => {
    // 1. Restore window.matchMedia to original
    window.matchMedia = originalMatchMedia;

    // 2. Clean up localStorage
    localStorage.clear();

    // 3. Reset document class
    document.documentElement.className = "";

    // 4. Clear mock call history (but keep mock implementations from test setup)
    vi.clearAllMocks();
  });

  describe("Initialization", () => {
    it("should load theme from Chrome storage on mount", async () => {
      // Arrange - Seed storage with dark theme
      await chrome.storage.local.set({
        settings: {
          ...DEFAULT_SETTINGS,
          theme: "dark",
        },
      });

      // Act
      const { result } = renderHook(() => useTheme());

      // Assert - Initially system theme
      expect(result.current.theme).toBe("system");

      // Wait for initialization
      await waitFor(() => {
        expect(result.current.theme).toBe("dark");
      });
    });

    it("should migrate from localStorage if Chrome storage is empty", async () => {
      // Arrange
      localStorage.setItem("prompt-library-theme", "light");
      await chrome.storage.local.set({
        settings: {
          ...DEFAULT_SETTINGS,
          theme: "system",
        },
      });

      // Act
      const { result } = renderHook(() => useTheme());

      // Wait for migration
      await waitFor(() => {
        expect(result.current.theme).toBe("light");
      });

      // Assert - Verify through storage
      const data = await chrome.storage.local.get("settings");
      expect((data.settings as Settings).theme).toBe("light");
      expect(localStorage.getItem("prompt-library-theme")).toBeNull();
    });

    it("should only migrate valid theme values from localStorage", async () => {
      // Arrange
      localStorage.setItem("prompt-library-theme", "invalid-theme");
      await chrome.storage.local.set({
        settings: {
          ...DEFAULT_SETTINGS,
          theme: "system",
        },
      });

      // Act
      const { result } = renderHook(() => useTheme());

      // Wait for initialization
      await waitFor(() => {
        expect(result.current.theme).toBe("system");
      });

      // Assert - Should not migrate invalid theme
      const data = await chrome.storage.local.get("settings");
      expect((data.settings as Settings).theme).toBe("system");
    });

    it("should not migrate if Chrome storage already has non-system theme", async () => {
      // Arrange
      localStorage.setItem("prompt-library-theme", "light");
      await chrome.storage.local.set({
        settings: {
          ...DEFAULT_SETTINGS,
          theme: "dark",
        },
      });

      // Act
      const { result } = renderHook(() => useTheme());

      // Wait for initialization
      await waitFor(() => {
        expect(result.current.theme).toBe("dark");
      });

      // Assert - Should not migrate when Chrome storage has theme
      expect(localStorage.getItem("prompt-library-theme")).toBe("light");
    });

    it("should default to system theme if no saved preference", async () => {
      // Arrange
      await chrome.storage.local.set({
        settings: {
          ...DEFAULT_SETTINGS,
          theme: "system",
        },
      });

      // Act
      const { result } = renderHook(() => useTheme());

      // Wait for initialization
      await waitFor(() => {
        expect(result.current.theme).toBe("system");
      });
    });
  });

  describe("Theme Changes", () => {
    it("should update theme and save to storage", async () => {
      // Arrange
      await chrome.storage.local.set({
        settings: {
          ...DEFAULT_SETTINGS,
          theme: "system",
        },
      });

      const { result } = renderHook(() => useTheme());

      await waitFor(() => {
        expect(result.current.theme).toBe("system");
      });

      // Act
      await act(async () => {
        await result.current.setTheme("dark");
      });

      // Assert - Verify through storage
      const data = await chrome.storage.local.get("settings");
      expect((data.settings as Settings).theme).toBe("dark");
      expect(result.current.theme).toBe("dark");
    });

    it("should update document classList when theme changes to dark", async () => {
      // Arrange
      await chrome.storage.local.set({
        settings: {
          ...DEFAULT_SETTINGS,
          theme: "light",
        },
      });

      const { result } = renderHook(() => useTheme());

      await waitFor(() => {
        expect(result.current.theme).toBe("light");
      });

      // Act
      await act(async () => {
        await result.current.setTheme("dark");
      });

      // Assert
      await waitFor(() => {
        expect(document.documentElement.classList.contains("dark")).toBe(true);
      });
    });

    it("should remove dark class when theme changes to light", async () => {
      // Arrange
      document.documentElement.classList.add("dark");
      await chrome.storage.local.set({
        settings: {
          ...DEFAULT_SETTINGS,
          theme: "dark",
        },
      });

      const { result } = renderHook(() => useTheme());

      await waitFor(() => {
        expect(result.current.theme).toBe("dark");
      });

      // Act
      await act(async () => {
        await result.current.setTheme("light");
      });

      // Assert
      await waitFor(() => {
        expect(document.documentElement.classList.contains("dark")).toBe(false);
      });
    });

    it("should broadcast theme change to other tabs", async () => {
      // Arrange
      const mockTabs = [
        { id: 1, url: "https://example.com" },
        { id: 2, url: "https://example.org" },
      ] as chrome.tabs.Tab[];

      vi.mocked(chrome.tabs.query).mockImplementation(
        (
          _queryInfo: chrome.tabs.QueryInfo,
          callback?: (tabs: chrome.tabs.Tab[]) => void,
        ) => {
          if (callback) {
            callback(mockTabs);
            return Promise.resolve(mockTabs);
          }
          return Promise.resolve(mockTabs);
        },
      );

      await chrome.storage.local.set({
        settings: {
          ...DEFAULT_SETTINGS,
          theme: "light",
        },
      });

      const { result } = renderHook(() => useTheme());

      await waitFor(() => {
        expect(result.current.theme).toBe("light");
      });

      // Act
      await act(async () => {
        await result.current.setTheme("dark");
      });

      // Assert
      await waitFor(() => {
        expect(chrome.tabs.query).toHaveBeenCalled();
        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
          type: "themeChanged",
          theme: "dark",
        });
        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(2, {
          type: "themeChanged",
          theme: "dark",
        });
      });
    });

    it("should handle tabs without content script gracefully", async () => {
      // Arrange
      const mockTabs = [{ id: 1 }] as chrome.tabs.Tab[];

      vi.mocked(chrome.tabs.query).mockImplementation(
        (
          _queryInfo: chrome.tabs.QueryInfo,
          callback?: (tabs: chrome.tabs.Tab[]) => void,
        ) => {
          if (callback) {
            callback(mockTabs);
            return Promise.resolve(mockTabs);
          }
          return Promise.resolve(mockTabs);
        },
      );

      vi.mocked(chrome.tabs.sendMessage).mockRejectedValue(
        new Error("No content script"),
      );

      await chrome.storage.local.set({
        settings: {
          ...DEFAULT_SETTINGS,
          theme: "light",
        },
      });

      const { result } = renderHook(() => useTheme());

      await waitFor(() => {
        expect(result.current.theme).toBe("light");
      });

      // Act - Should not throw error
      await act(async () => {
        await result.current.setTheme("dark");
      });

      // Assert
      expect(result.current.theme).toBe("dark");
    });
  });

  describe("System Theme Detection", () => {
    it("should use light theme when system preference is light", async () => {
      // Arrange
      mockMatchMedia.matches = false; // Light mode
      await chrome.storage.local.set({
        settings: {
          ...DEFAULT_SETTINGS,
          theme: "system",
        },
      });

      // Act
      const { result } = renderHook(() => useTheme());

      await waitFor(() => {
        expect(result.current.theme).toBe("system");
      });

      // Assert
      expect(result.current.resolvedTheme).toBe("light");
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });

    it("should use dark theme when system preference is dark", async () => {
      // Arrange
      mockMatchMedia.matches = true; // Dark mode
      await chrome.storage.local.set({
        settings: {
          ...DEFAULT_SETTINGS,
          theme: "system",
        },
      });

      // Act
      const { result } = renderHook(() => useTheme());

      await waitFor(() => {
        expect(result.current.theme).toBe("system");
      });

      // Assert
      expect(result.current.resolvedTheme).toBe("dark");
      await waitFor(() => {
        expect(document.documentElement.classList.contains("dark")).toBe(true);
      });
    });

    it("should listen for system theme changes", async () => {
      // Arrange
      await chrome.storage.local.set({
        settings: {
          ...DEFAULT_SETTINGS,
          theme: "system",
        },
      });

      // Act
      const { result } = renderHook(() => useTheme());

      await waitFor(() => {
        expect(result.current.theme).toBe("system");
      });

      // Assert - Media query listener should be registered
      expect(window.matchMedia).toHaveBeenCalledWith(
        "(prefers-color-scheme: dark)",
      );
      expect(mockMatchMedia.addEventListener).toHaveBeenCalledWith(
        "change",
        expect.any(Function),
      );
    });

    it("should re-evaluate system theme when media query fires change event", async () => {
      // Arrange
      await chrome.storage.local.set({
        settings: {
          ...DEFAULT_SETTINGS,
          theme: "system",
        },
      });

      const { result } = renderHook(() => useTheme());

      await waitFor(() => {
        expect(result.current.theme).toBe("system");
      });

      const initialTheme = result.current.theme;

      // Act - Simulate media query change event
      const changeHandler = mockMatchMedia.addEventListener.mock.calls[0][1];

      await act(async () => {
        changeHandler();
      });

      // Assert - Theme should remain 'system' (handler triggers re-render to update resolvedTheme)
      expect(result.current.theme).toBe(initialTheme);
      expect(result.current.theme).toBe("system");
    });

    it("should not listen for system changes when theme is not system", async () => {
      // Arrange
      mockMatchMedia.matches = false; // System is light
      await chrome.storage.local.set({
        settings: {
          ...DEFAULT_SETTINGS,
          theme: "dark",
        },
      });

      // Act
      const { result } = renderHook(() => useTheme());

      await waitFor(() => {
        expect(result.current.theme).toBe("dark");
      });

      // Verify initial resolved theme is dark (regardless of system preference)
      expect(result.current.resolvedTheme).toBe("dark");

      // Act - Simulate system preference change
      mockMatchMedia.matches = true;
      vi.mocked(window.matchMedia).mockImplementation(
        (query: string): MediaQueryList =>
          ({
            ...mockMatchMedia,
            matches: true,
            media: query,
          }) as MediaQueryList,
      );

      const changeHandler = mockMatchMedia.addEventListener.mock.calls[0]?.[1];

      if (changeHandler) {
        await act(async () => {
          changeHandler();
        });
      }

      // Assert - Should still be dark (system change shouldn't affect explicit theme)
      expect(result.current.resolvedTheme).toBe("dark");
    });

    it("should cleanup media query listener on unmount", async () => {
      // Arrange
      await chrome.storage.local.set({
        settings: {
          ...DEFAULT_SETTINGS,
          theme: "system",
        },
      });

      // Act
      const { unmount } = renderHook(() => useTheme());

      await waitFor(() => {
        expect(mockMatchMedia.addEventListener).toHaveBeenCalled();
      });

      // Act - Unmount
      unmount();

      // Assert
      expect(mockMatchMedia.removeEventListener).toHaveBeenCalledWith(
        "change",
        expect.any(Function),
      );
    });
  });

  describe("Storage Listener", () => {
    it("should update theme when storage changes from another tab", async () => {
      // Arrange
      await chrome.storage.local.set({
        settings: {
          ...DEFAULT_SETTINGS,
          theme: "light",
        },
      });

      const { result } = renderHook(() => useTheme());

      await waitFor(() => {
        expect(result.current.theme).toBe("light");
      });

      // Act - Simulate storage change from another tab
      await act(async () => {
        const globalWithMocks = globalThis as GlobalWithMocks;
        globalWithMocks.__triggerChromeStorageChange__?.(
          {
            settings: {
              newValue: { ...DEFAULT_SETTINGS, theme: "dark" },
              oldValue: { ...DEFAULT_SETTINGS, theme: "light" },
            },
          },
          "local",
        );
      });

      // Assert
      await waitFor(() => {
        expect(result.current.theme).toBe("dark");
      });
    });

    it("should not update if theme is the same", async () => {
      // Arrange
      await chrome.storage.local.set({
        settings: {
          ...DEFAULT_SETTINGS,
          theme: "dark",
        },
      });

      const { result } = renderHook(() => useTheme());

      await waitFor(() => {
        expect(result.current.theme).toBe("dark");
      });

      const initialTheme = result.current.theme;

      // Act - Trigger storage change with same theme
      await act(async () => {
        const globalWithMocks = globalThis as GlobalWithMocks;
        globalWithMocks.__triggerChromeStorageChange__?.(
          {
            settings: {
              newValue: { ...DEFAULT_SETTINGS, theme: "dark" },
              oldValue: { ...DEFAULT_SETTINGS, theme: "dark" },
            },
          },
          "local",
        );
      });

      // Assert - Theme should remain unchanged
      expect(result.current.theme).toBe(initialTheme);
    });

    it("should ignore changes to non-settings keys", async () => {
      // Arrange
      await chrome.storage.local.set({
        settings: {
          ...DEFAULT_SETTINGS,
          theme: "light",
        },
      });

      const { result } = renderHook(() => useTheme());

      await waitFor(() => {
        expect(result.current.theme).toBe("light");
      });

      // Act - Trigger storage change for different key
      await act(async () => {
        const globalWithMocks = globalThis as GlobalWithMocks;
        globalWithMocks.__triggerChromeStorageChange__?.(
          {
            prompts: {
              newValue: [],
              oldValue: [],
            },
          },
          "local",
        );
      });

      // Assert - Theme should remain unchanged
      expect(result.current.theme).toBe("light");
    });

    it("should cleanup storage listener on unmount", async () => {
      // Arrange
      await chrome.storage.local.set({
        settings: {
          ...DEFAULT_SETTINGS,
          theme: "light",
        },
      });

      // Act
      const { unmount } = renderHook(() => useTheme());

      await waitFor(() => {
        expect(chrome.storage.onChanged.addListener).toHaveBeenCalled();
      });

      // Act - Unmount
      unmount();

      // Assert
      expect(chrome.storage.onChanged.removeListener).toHaveBeenCalled();
    });
  });

  describe("Toggle Theme", () => {
    // eslint-disable-next-line vitest/expect-expect -- Assertion is in testThemeToggle helper
    it("should toggle from light to dark", async () => {
      await testThemeToggle("light", "dark");
    });

    // eslint-disable-next-line vitest/expect-expect -- Assertion is in testThemeToggle helper
    it("should toggle from dark to light", async () => {
      await testThemeToggle("dark", "light");
    });

    it("should toggle from system to opposite of current system preference", async () => {
      // Arrange - System preference is light
      mockMatchMedia.matches = false;
      await chrome.storage.local.set({
        settings: {
          ...DEFAULT_SETTINGS,
          theme: "system",
        },
      });

      const { result } = renderHook(() => useTheme());

      await waitFor(() => {
        expect(result.current.theme).toBe("system");
        expect(result.current.resolvedTheme).toBe("light");
      });

      // Act
      await act(async () => {
        await result.current.toggleTheme();
      });

      // Assert - Should switch to explicit dark
      expect(result.current.theme).toBe("dark");
    });

    it("should toggle from system dark to light", async () => {
      // Arrange - System preference is dark
      mockMatchMedia.matches = true;
      await chrome.storage.local.set({
        settings: {
          ...DEFAULT_SETTINGS,
          theme: "system",
        },
      });

      const { result } = renderHook(() => useTheme());

      await waitFor(() => {
        expect(result.current.theme).toBe("system");
        expect(result.current.resolvedTheme).toBe("dark");
      });

      // Act
      await act(async () => {
        await result.current.toggleTheme();
      });

      // Assert - Should switch to explicit light
      expect(result.current.theme).toBe("light");
    });
  });

  describe("Error Handling", () => {
    it("should handle storage read errors gracefully", async () => {
      // Arrange
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const getSpy = vi.spyOn(chrome.storage.local, "get");
      getSpy.mockRejectedValueOnce(new Error("Storage read error"));

      // Act
      const { result } = renderHook(() => useTheme());

      // Wait for error to be handled
      await waitFor(() => {
        expect(getSpy).toHaveBeenCalled();
      });

      // Assert - Should default to system theme
      expect(result.current.theme).toBe("system");

      getSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it("should handle storage write errors gracefully", async () => {
      // Arrange
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      await chrome.storage.local.set({
        settings: {
          ...DEFAULT_SETTINGS,
          theme: "light",
        },
      });

      const { result } = renderHook(() => useTheme());

      await waitFor(() => {
        expect(result.current.theme).toBe("light");
      });

      const setSpy = vi.spyOn(chrome.storage.local, "set");
      setSpy.mockRejectedValueOnce(new Error("Storage write error"));

      // Act - Should not throw error
      await act(async () => {
        await result.current.setTheme("dark");
      });

      // Assert - Operation should complete without crashing
      expect(setSpy).toHaveBeenCalled();

      setSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it("should handle missing theme in storage change event", async () => {
      // Arrange
      await chrome.storage.local.set({
        settings: {
          ...DEFAULT_SETTINGS,
          theme: "light",
        },
      });

      const { result } = renderHook(() => useTheme());

      await waitFor(() => {
        expect(result.current.theme).toBe("light");
      });

      // Act - Trigger storage change without theme property (exclude theme from newValue)
      await act(async () => {
        const globalWithMocks = globalThis as GlobalWithMocks;
        const { theme: _removed, ...settingsWithoutTheme } = DEFAULT_SETTINGS;
        globalWithMocks.__triggerChromeStorageChange__?.(
          {
            settings: {
              newValue: { ...settingsWithoutTheme, enableSync: true },
              oldValue: {
                ...DEFAULT_SETTINGS,
                theme: "light",
                enableSync: false,
              },
            },
          },
          "local",
        );
      });

      // Assert - Should remain unchanged
      expect(result.current.theme).toBe("light");
    });
  });
});
