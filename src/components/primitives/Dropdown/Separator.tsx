import { forwardRef } from 'react';

export interface SeparatorProps {
  /** CSS class name */
  className?: string;
}

/**
 * Separator component for Dropdown
 * Visual divider between menu items
 *
 * @example
 * ```tsx
 * <Dropdown.Item>Edit</Dropdown.Item>
 * <Dropdown.Separator />
 * <Dropdown.Item>Delete</Dropdown.Item>
 * ```
 */
export const Separator = forwardRef<HTMLDivElement, SeparatorProps>(
  ({ className = '' }, ref) => {
    const separatorClasses = `
      -mx-1 my-1 h-px
      bg-gray-200 dark:bg-gray-700
      ${className}
    `.trim();

    return (
      <div
        ref={ref}
        role="separator"
        aria-orientation="horizontal"
        className={separatorClasses}
      />
    );
  }
);

Separator.displayName = 'Dropdown.Separator';