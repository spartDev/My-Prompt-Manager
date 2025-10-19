import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { SortOrder, SortDirection } from '../../types';
import { useSort } from '../useSort';

describe('useSort', () => {
  describe('Initialization', () => {
    it('should initialize with default values (updatedAt, desc)', () => {
      const { result } = renderHook(() => useSort());

      expect(result.current.sortOrder).toBe('updatedAt');
      expect(result.current.sortDirection).toBe('desc');
    });

    it('should initialize with custom values', () => {
      const { result } = renderHook(() => useSort('title', 'asc'));

      expect(result.current.sortOrder).toBe('title');
      expect(result.current.sortDirection).toBe('asc');
    });

    it('should initialize createdAt with desc direction', () => {
      const { result } = renderHook(() => useSort('createdAt', 'desc'));

      expect(result.current.sortOrder).toBe('createdAt');
      expect(result.current.sortDirection).toBe('desc');
    });
  });

  describe('State Updates', () => {
    it('should update sort order using setSortOrder', () => {
      const { result } = renderHook(() => useSort());

      act(() => {
        result.current.setSortOrder('title');
      });

      expect(result.current.sortOrder).toBe('title');
      expect(result.current.sortDirection).toBe('desc'); // Direction unchanged
    });

    it('should update sort direction using setSortDirection', () => {
      const { result } = renderHook(() => useSort());

      act(() => {
        result.current.setSortDirection('asc');
      });

      expect(result.current.sortOrder).toBe('updatedAt'); // Order unchanged
      expect(result.current.sortDirection).toBe('asc');
    });

    it('should update both order and direction using handleSortChange', () => {
      const { result } = renderHook(() => useSort());

      act(() => {
        result.current.handleSortChange('title', 'asc');
      });

      expect(result.current.sortOrder).toBe('title');
      expect(result.current.sortDirection).toBe('asc');
    });

    it('should handle multiple sequential updates', () => {
      const { result } = renderHook(() => useSort());

      // First update
      act(() => {
        result.current.handleSortChange('title', 'asc');
      });
      expect(result.current.sortOrder).toBe('title');
      expect(result.current.sortDirection).toBe('asc');

      // Second update
      act(() => {
        result.current.handleSortChange('createdAt', 'desc');
      });
      expect(result.current.sortOrder).toBe('createdAt');
      expect(result.current.sortDirection).toBe('desc');

      // Third update
      act(() => {
        result.current.handleSortChange('updatedAt', 'asc');
      });
      expect(result.current.sortOrder).toBe('updatedAt');
      expect(result.current.sortDirection).toBe('asc');
    });
  });

  describe('Type Safety', () => {
    it('should accept all valid SortOrder values', () => {
      const { result } = renderHook(() => useSort());

      const validOrders: SortOrder[] = ['title', 'createdAt', 'updatedAt'];

      validOrders.forEach((order) => {
        act(() => {
          result.current.setSortOrder(order);
        });
        expect(result.current.sortOrder).toBe(order);
      });
    });

    it('should accept all valid SortDirection values', () => {
      const { result } = renderHook(() => useSort());

      const validDirections: SortDirection[] = ['asc', 'desc'];

      validDirections.forEach((direction) => {
        act(() => {
          result.current.setSortDirection(direction);
        });
        expect(result.current.sortDirection).toBe(direction);
      });
    });
  });

  describe('Callback Stability', () => {
    it('should maintain stable handleSortChange reference across renders', () => {
      const { result, rerender } = renderHook(() => useSort());

      const firstCallback = result.current.handleSortChange;

      // Trigger state change
      act(() => {
        result.current.handleSortChange('title', 'asc');
      });

      rerender();

      const secondCallback = result.current.handleSortChange;

      // Callback reference should remain the same (useCallback)
      expect(firstCallback).toBe(secondCallback);
    });

    it('should not recreate setSortOrder on state changes', () => {
      const { result } = renderHook(() => useSort());

      const firstSetter = result.current.setSortOrder;

      act(() => {
        result.current.setSortOrder('title');
      });

      const secondSetter = result.current.setSortOrder;

      // useState setters are stable
      expect(firstSetter).toBe(secondSetter);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle typical user workflow: toggle sort direction', () => {
      const { result } = renderHook(() => useSort('updatedAt', 'desc'));

      // User clicks "Recently Updated" (already selected)
      // Expected: Toggle direction
      expect(result.current.sortOrder).toBe('updatedAt');
      expect(result.current.sortDirection).toBe('desc');

      // Toggle to ascending
      act(() => {
        result.current.handleSortChange('updatedAt', 'asc');
      });

      expect(result.current.sortOrder).toBe('updatedAt');
      expect(result.current.sortDirection).toBe('asc');

      // Toggle back to descending
      act(() => {
        result.current.handleSortChange('updatedAt', 'desc');
      });

      expect(result.current.sortOrder).toBe('updatedAt');
      expect(result.current.sortDirection).toBe('desc');
    });

    it('should handle switching between different sort orders', () => {
      const { result } = renderHook(() => useSort());

      // Start with default: Recently Updated (desc)
      expect(result.current.sortOrder).toBe('updatedAt');
      expect(result.current.sortDirection).toBe('desc');

      // Switch to Alphabetical (asc)
      act(() => {
        result.current.handleSortChange('title', 'asc');
      });
      expect(result.current.sortOrder).toBe('title');
      expect(result.current.sortDirection).toBe('asc');

      // Switch to Recently Created (desc)
      act(() => {
        result.current.handleSortChange('createdAt', 'desc');
      });
      expect(result.current.sortOrder).toBe('createdAt');
      expect(result.current.sortDirection).toBe('desc');
    });

    it('should maintain state persistence across component lifecycle', () => {
      const { result, unmount, rerender } = renderHook(() => useSort());

      // Set custom sort
      act(() => {
        result.current.handleSortChange('title', 'asc');
      });

      const order = result.current.sortOrder;
      const direction = result.current.sortDirection;

      // Rerender (simulates parent component update)
      rerender();

      // State should persist
      expect(result.current.sortOrder).toBe(order);
      expect(result.current.sortDirection).toBe(direction);

      // Note: Unmounting would reset state in a new hook instance
      unmount();
    });
  });

  describe('Edge Cases', () => {
    it('should handle same value updates gracefully', () => {
      const { result } = renderHook(() => useSort('title', 'asc'));

      // Set to same values
      act(() => {
        result.current.handleSortChange('title', 'asc');
      });

      expect(result.current.sortOrder).toBe('title');
      expect(result.current.sortDirection).toBe('asc');
    });

    it('should handle rapid successive updates', () => {
      const { result } = renderHook(() => useSort());

      act(() => {
        result.current.handleSortChange('title', 'asc');
        result.current.handleSortChange('createdAt', 'desc');
        result.current.handleSortChange('updatedAt', 'asc');
      });

      // Should reflect last update
      expect(result.current.sortOrder).toBe('updatedAt');
      expect(result.current.sortDirection).toBe('asc');
    });
  });

  describe('Return Value Structure', () => {
    it('should return all expected properties', () => {
      const { result } = renderHook(() => useSort());

      expect(result.current).toHaveProperty('sortOrder');
      expect(result.current).toHaveProperty('sortDirection');
      expect(result.current).toHaveProperty('setSortOrder');
      expect(result.current).toHaveProperty('setSortDirection');
      expect(result.current).toHaveProperty('handleSortChange');
    });

    it('should have correct types for all properties', () => {
      const { result } = renderHook(() => useSort());

      expect(typeof result.current.sortOrder).toBe('string');
      expect(typeof result.current.sortDirection).toBe('string');
      expect(typeof result.current.setSortOrder).toBe('function');
      expect(typeof result.current.setSortDirection).toBe('function');
      expect(typeof result.current.handleSortChange).toBe('function');
    });
  });
});
