import { useState, useCallback } from 'react';

import { SortOrder, SortDirection } from '../types';

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
  const [sortOrder, setSortOrder] = useState<SortOrder>(initialOrder);
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialDirection);

  const handleSortChange = useCallback((order: SortOrder, direction: SortDirection) => {
    setSortOrder(order);
    setSortDirection(direction);
  }, []);

  return {
    sortOrder,
    sortDirection,
    setSortOrder,
    setSortDirection,
    handleSortChange,
  };
};
