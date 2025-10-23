import { ReactNode, forwardRef } from 'react';

export interface LabelProps {
  /** Label text */
  children: ReactNode;
  /** CSS class name */
  className?: string;
}

/**
 * Label component for Dropdown
 * Non-interactive label for groups
 *
 * @example
 * ```tsx
 * <Dropdown.Group>
 *   <Dropdown.Label>Categories</Dropdown.Label>
 *   <Dropdown.Item>Work</Dropdown.Item>
 *   <Dropdown.Item>Personal</Dropdown.Item>
 * </Dropdown.Group>
 * ```
 */
export const Label = forwardRef<HTMLDivElement, LabelProps>(
  ({ children, className = '' }, ref) => {
    const labelClasses = `
      px-3 py-1.5 text-xs font-semibold
      text-gray-500 dark:text-gray-400
      ${className}
    `.trim();

    return (
      <div
        ref={ref}
        className={labelClasses}
      >
        {children}
      </div>
    );
  }
);

Label.displayName = 'Dropdown.Label';