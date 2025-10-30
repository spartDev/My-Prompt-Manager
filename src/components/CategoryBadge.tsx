/**
 * CategoryBadge Component
 *
 * Renders category colors with WCAG AA compliant text contrast.
 * Automatically selects black or white text based on background luminance.
 *
 * Usage:
 *   <CategoryBadge category={category} variant="pill" size="sm" />
 */

import { type FC } from 'react';

import { getAccessibleTextColor, DEFAULT_CATEGORY_COLOR } from '../constants/colors';
import { type Category } from '../types';

interface CategoryBadgeProps {
  /** Category object with name and optional color */
  category: Category;
  /** Visual variant of the badge */
  variant?: 'pill' | 'dot' | 'inline';
  /** Size of the badge */
  size?: 'sm' | 'md';
  /** Additional CSS classes */
  className?: string;
  /** Optional click handler */
  onClick?: () => void;
}

/**
 * CategoryBadge component that ensures accessible color contrast
 */
export const CategoryBadge: FC<CategoryBadgeProps> = ({
  category,
  variant = 'pill',
  size = 'sm',
  className = '',
  onClick
}) => {
  // Use category color or default fallback
  const backgroundColor = category.color || DEFAULT_CATEGORY_COLOR;

  // Get WCAG AA compliant text color (white or black)
  const textColor = getAccessibleTextColor(backgroundColor);

  // Render color dot only (for compact displays)
  if (variant === 'dot') {
    return (
      <span
        className={`w-3 h-3 rounded-full flex-shrink-0 ${className}`}
        style={{ backgroundColor }}
        aria-label={`Category: ${category.name}`}
        title={category.name}
      />
    );
  }

  // Common badge styles
  const badgeBaseClasses = 'inline-flex items-center rounded-full font-medium transition-all duration-200';

  // Size-specific styles
  const sizeClasses = size === 'sm'
    ? 'px-2 py-0.5 text-xs'
    : 'px-3 py-1 text-sm';

  // Interactive styles if onClick is provided
  const interactiveClasses = onClick
    ? 'cursor-pointer hover:shadow-md active:scale-95'
    : '';

  return (
    <span
      className={`${badgeBaseClasses} ${sizeClasses} ${interactiveClasses} ${className}`}
      style={{
        backgroundColor,
        color: textColor
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      } : undefined}
      aria-label={`Category: ${category.name}`}
    >
      {category.name}
    </span>
  );
};

export default CategoryBadge;
