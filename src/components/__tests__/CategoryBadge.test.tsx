/**
 * CategoryBadge Component Tests
 *
 * Tests that CategoryBadge properly applies accessible text colors
 * for all category color combinations.
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { PRESET_COLORS, getAccessibleTextColor } from '../../constants/colors';
import type { Category } from '../../types';
import { CategoryBadge } from '../CategoryBadge';

describe('CategoryBadge', () => {
  describe('Rendering', () => {
    it('should render category name in pill variant', () => {
      const category: Category = {
        id: '1',
        name: 'Test Category',
        color: '#3B82F6'
      };

      render(<CategoryBadge category={category} variant="pill" />);

      expect(screen.getByText('Test Category')).toBeInTheDocument();
    });

    it('should render aria-label for dot variant', () => {
      const category: Category = {
        id: '1',
        name: 'Test Category',
        color: '#3B82F6'
      };

      render(<CategoryBadge category={category} variant="dot" />);

      const dot = screen.getByLabelText('Category: Test Category');
      expect(dot).toBeInTheDocument();
    });

    it('should use default color when category has no color', () => {
      const category: Category = {
        id: '1',
        name: 'Test Category'
      };

      render(<CategoryBadge category={category} variant="pill" />);

      const badge = screen.getByText('Test Category');
      const style = window.getComputedStyle(badge);

      // Should have a background color set (either from default or category)
      expect(style.backgroundColor).toBeTruthy();
    });
  });

  describe('Accessible Text Colors', () => {
    it('should apply accessible text color for each preset color', () => {
      PRESET_COLORS.forEach(presetColor => {
        const category: Category = {
          id: '1',
          name: presetColor.name,
          color: presetColor.value
        };

        const { container } = render(<CategoryBadge category={category} variant="pill" />);
        const badge = container.querySelector('span');

        expect(badge).toBeTruthy();

        if (badge) {
          const style = badge.style;
          const backgroundColor = style.backgroundColor;
          const textColor = style.color;

          // Should have both colors set
          expect(backgroundColor).toBeTruthy();
          expect(textColor).toBeTruthy();

          // Text color should be either white or black for accessibility
          // We check the RGB values since styles might be in rgb() format
          const rgbMatch = textColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
          if (rgbMatch) {
            const [, r, g, b] = rgbMatch.map(Number);

            // Should be white (255,255,255) or black (0,0,0)
            const isWhite = r === 255 && g === 255 && b === 255;
            const isBlack = r === 0 && g === 0 && b === 0;

            expect(isWhite || isBlack).toBe(true);
          }
        }
      });
    });

    it('should use white text for dark blue background', () => {
      const category: Category = {
        id: '1',
        name: 'Navy',
        color: '#1E40AF'
      };

      render(<CategoryBadge category={category} variant="pill" />);

      const badge = screen.getByText('Navy');
      const expectedTextColor = getAccessibleTextColor('#1E40AF');

      // Convert hex to rgb for comparison
      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : null;
      };

      const expected = hexToRgb(expectedTextColor);
      expect(expected).toBeTruthy();

      if (expected) {
        const style = window.getComputedStyle(badge);
        const rgbMatch = style.color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);

        if (rgbMatch) {
          const [, r, g, b] = rgbMatch.map(Number);
          expect(r).toBe(expected.r);
          expect(g).toBe(expected.g);
          expect(b).toBe(expected.b);
        }
      }
    });

    it('should use black text for yellow background', () => {
      const category: Category = {
        id: '1',
        name: 'Yellow',
        color: '#EAB308'
      };

      const { container } = render(<CategoryBadge category={category} variant="pill" />);
      const badge = container.querySelector('span');

      expect(badge).toBeTruthy();

      if (badge) {
        // Should use black text for yellow
        const expectedTextColor = getAccessibleTextColor('#EAB308');
        expect(expectedTextColor).toBe('#000000');
      }
    });

    it('should use black text for amber background', () => {
      const category: Category = {
        id: '1',
        name: 'Amber',
        color: '#F59E0B'
      };

      const { container } = render(<CategoryBadge category={category} variant="pill" />);
      const badge = container.querySelector('span');

      expect(badge).toBeTruthy();

      if (badge) {
        const expectedTextColor = getAccessibleTextColor('#F59E0B');
        expect(expectedTextColor).toBe('#000000');
      }
    });
  });

  describe('Variants', () => {
    const category: Category = {
      id: '1',
      name: 'Test',
      color: '#3B82F6'
    };

    it('should render pill variant with text', () => {
      render(<CategoryBadge category={category} variant="pill" />);

      const badge = screen.getByText('Test');
      expect(badge).toHaveClass('rounded-full');
    });

    it('should render dot variant without text', () => {
      const { container } = render(<CategoryBadge category={category} variant="dot" />);

      expect(screen.queryByText('Test')).not.toBeInTheDocument();

      const dot = container.querySelector('.w-3.h-3.rounded-full');
      expect(dot).toBeInTheDocument();
    });

    it('should render inline variant with text', () => {
      render(<CategoryBadge category={category} variant="inline" />);

      const badge = screen.getByText('Test');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('rounded-full');
    });
  });

  describe('Sizes', () => {
    const category: Category = {
      id: '1',
      name: 'Test',
      color: '#3B82F6'
    };

    it('should apply small size classes', () => {
      render(<CategoryBadge category={category} size="sm" />);

      const badge = screen.getByText('Test');
      expect(badge).toHaveClass('text-xs');
    });

    it('should apply medium size classes', () => {
      render(<CategoryBadge category={category} size="md" />);

      const badge = screen.getByText('Test');
      expect(badge).toHaveClass('text-sm');
    });
  });

  describe('Interactive Behavior', () => {
    it('should be clickable when onClick is provided', () => {
      const category: Category = {
        id: '1',
        name: 'Test',
        color: '#3B82F6'
      };

      let clicked = false;
      const handleClick = () => { clicked = true; };

      render(<CategoryBadge category={category} onClick={handleClick} />);

      const badge = screen.getByText('Test');
      badge.click();

      expect(clicked).toBe(true);
    });

    it('should have button role when clickable', () => {
      const category: Category = {
        id: '1',
        name: 'Test',
        color: '#3B82F6'
      };

      render(<CategoryBadge category={category} onClick={() => {}} />);

      const badge = screen.getByRole('button');
      expect(badge).toBeInTheDocument();
    });

    it('should not have button role when not clickable', () => {
      const category: Category = {
        id: '1',
        name: 'Test',
        color: '#3B82F6'
      };

      render(<CategoryBadge category={category} />);

      const badge = screen.queryByRole('button');
      expect(badge).not.toBeInTheDocument();
    });

    it('should be keyboard accessible when clickable', () => {
      const category: Category = {
        id: '1',
        name: 'Test',
        color: '#3B82F6'
      };

      let clicked = false;
      const handleClick = () => { clicked = true; };

      render(<CategoryBadge category={category} onClick={handleClick} />);

      const badge = screen.getByText('Test');

      // Should have tabIndex
      expect(badge).toHaveAttribute('tabIndex', '0');

      // Should trigger onClick on Enter key
      badge.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(clicked).toBe(true);
    });
  });

  describe('Accessibility', () => {
    it('should have aria-label', () => {
      const category: Category = {
        id: '1',
        name: 'Test Category',
        color: '#3B82F6'
      };

      render(<CategoryBadge category={category} />);

      const badge = screen.getByLabelText('Category: Test Category');
      expect(badge).toBeInTheDocument();
    });

    it('should have title attribute for dot variant', () => {
      const category: Category = {
        id: '1',
        name: 'Test Category',
        color: '#3B82F6'
      };

      const { container } = render(<CategoryBadge category={category} variant="dot" />);

      const dot = container.querySelector('[title="Test Category"]');
      expect(dot).toBeInTheDocument();
    });
  });

  describe('Custom Styling', () => {
    it('should accept custom className', () => {
      const category: Category = {
        id: '1',
        name: 'Test',
        color: '#3B82F6'
      };

      render(<CategoryBadge category={category} className="custom-class" />);

      const badge = screen.getByText('Test');
      expect(badge).toHaveClass('custom-class');
    });

    it('should preserve base classes with custom className', () => {
      const category: Category = {
        id: '1',
        name: 'Test',
        color: '#3B82F6'
      };

      render(<CategoryBadge category={category} className="custom-class" />);

      const badge = screen.getByText('Test');
      expect(badge).toHaveClass('custom-class');
      expect(badge).toHaveClass('rounded-full');
    });
  });
});
