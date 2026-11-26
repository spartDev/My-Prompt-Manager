/**
 * CategoryBadge Component
 *
 * Renders category colors with WCAG AA compliant text contrast.
 * Automatically selects black or white text based on background luminance.
 *
 * Usage:
 *   <CategoryBadge category={category} variant="pill" size="sm" />
 *   <CategoryBadge category={category} variant="soft" />  // pale tint + colored text (Library card)
 */

import type { CSSProperties, FC } from 'react';

import { DEFAULT_CATEGORY_COLOR, getAccessibleTextColor, getSoftBadgeColors } from '../constants/colors';
import type { Category } from '../types';
import { cn } from '../utils/cn';

interface CategoryBadgeProps {
  /** Category object with name and optional color */
  category: Category;
  /** Visual variant of the badge */
  variant?: 'pill' | 'soft' | 'dot' | 'inline';
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
        role="img"
        className={cn('w-3 h-3 rounded-full shrink-0', className)}
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

  // Soft: pale tint background with colored text, AA-compliant in light and dark mode.
  // A block container (inline-block), not a flex one: a flex container never draws the ellipsis of
  // `truncate`, so a long name was cut mid-letter (My-Prompt-Manager-n4bu)
  if (variant === 'soft') {
    const light = getSoftBadgeColors(backgroundColor, 'light');
    const dark = getSoftBadgeColors(backgroundColor, 'dark');
    const softStyle = {
      '--badge-bg': light.background,
      '--badge-fg': light.text,
      '--badge-bg-dark': dark.background,
      '--badge-fg-dark': dark.text
    } as CSSProperties;

    return (
      <span
        className={cn(
          'inline-block max-w-full truncate align-middle rounded-full font-semibold transition-all duration-200',
          size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1 text-sm',
          'bg-[var(--badge-bg)] text-[var(--badge-fg)] dark:bg-[var(--badge-bg-dark)] dark:text-[var(--badge-fg-dark)]',
          className
        )}
        style={softStyle}
        title={`Category: ${category.name}`}
      >
        {category.name}
      </span>
    );
  }

  const badgeClasses = cn(badgeBaseClasses, sizeClasses, interactiveClasses, className);
  const badgeStyle = { backgroundColor, color: textColor };

  if (onClick) {
    return (
      <span
        role="button"
        tabIndex={0}
        className={badgeClasses}
        style={badgeStyle}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        aria-label={`Category: ${category.name}`}
      >
        {category.name}
      </span>
    );
  }

  // Read by its text: ARIA 1.2 prohibits aria-label on a plain span, which screen readers ignore
  return (
    <span className={badgeClasses} style={badgeStyle}>
      {category.name}
    </span>
  );
};

export default CategoryBadge;
