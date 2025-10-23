import { ReactNode, forwardRef } from 'react';

export interface GroupProps {
  /** Children items in the group */
  children: ReactNode;
  /** CSS class name */
  className?: string;
}

/**
 * Group component for Dropdown
 * Logical grouping of related menu items
 *
 * @example
 * ```tsx
 * <Dropdown.Group>
 *   <Dropdown.Label>Edit</Dropdown.Label>
 *   <Dropdown.Item>Cut</Dropdown.Item>
 *   <Dropdown.Item>Copy</Dropdown.Item>
 *   <Dropdown.Item>Paste</Dropdown.Item>
 * </Dropdown.Group>
 * ```
 */
export const Group = forwardRef<HTMLDivElement, GroupProps>(
  ({ children, className = '' }, ref) => {
    return (
      <div
        ref={ref}
        role="group"
        className={className}
      >
        {children}
      </div>
    );
  }
);

Group.displayName = 'Dropdown.Group';