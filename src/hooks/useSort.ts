import { useState, useCallback } from 'react';

import { SortOrder, SortDirection } from '../types';

interface SortState {
  order: SortOrder;
  direction: SortDirection;
}

export interface UseSortReturn {
  sortOrder: SortOrder;
  sortDirection: SortDirection;
  setSortOrder: (order: SortOrder) => void;
  setSortDirection: (direction: SortDirection) => void;
  handleSortChange: (order: SortOrder, direction: SortDirection) => void;
}

/**
 * Custom hook for managing sort state
 * Provides sort order, direction, and change handlers
 *
 * @param initialOrder - Initial sort order (default: 'updatedAt')
 * @param initialDirection - Initial sort direction (default: 'desc')
 * @returns Sort state and handlers
 *
 * @example
 * ```tsx
 * const { sortOrder, sortDirection, handleSortChange } = useSort();
 *
 * // Use in FilterSortControls
 * <FilterSortControls
 *   sortOrder={sortOrder}
 *   sortDirection={sortDirection}
 *   onSortChange={handleSortChange}
 * />
 * ```
 */
export const useSort = (
  initialOrder: SortOrder = 'updatedAt',
  initialDirection: SortDirection = 'desc'
): UseSortReturn => {
  const [sortState, setSortState] = useState<SortState>({
    order: initialOrder,
    direction: initialDirection,
  });

  const setSortOrder = useCallback((order: SortOrder) => {
    setSortState((prev) => ({ ...prev, order }));
  }, []);

  const setSortDirection = useCallback((direction: SortDirection) => {
    setSortState((prev) => ({ ...prev, direction }));
  }, []);

  const handleSortChange = useCallback((order: SortOrder, direction: SortDirection) => {
    setSortState({ order, direction });
  }, []);

  return {
    sortOrder: sortState.order,
    sortDirection: sortState.direction,
    setSortOrder,
    setSortDirection,
    handleSortChange,
  };
};
