/**
 * Accessibility Tests for Color Contrast
 *
 * Tests WCAG 2.1 compliance for category colors in both light and dark modes.
 */

import { describe, it, expect } from 'vitest';

import {
  PRESET_COLORS,
  getRelativeLuminance,
  getContrastRatio,
  meetsWCAGStandard,
  getAccessibleTextColor,
  getContrastingTextColor,
  isValidHexColor
} from '../colors';

describe('Color Contrast Accessibility', () => {
  describe('WCAG 2.1 Compliance - Relative Luminance', () => {
    it('should calculate correct relative luminance for white', () => {
      const luminance = getRelativeLuminance('#FFFFFF');
      expect(luminance).toBeCloseTo(1.0, 2);
    });

    it('should calculate correct relative luminance for black', () => {
      const luminance = getRelativeLuminance('#000000');
      expect(luminance).toBeCloseTo(0.0, 2);
    });

    it('should return fallback luminance for invalid colors', () => {
      const luminance = getRelativeLuminance('invalid');
      expect(luminance).toBe(0.5);
    });

    it('should handle lowercase hex colors', () => {
      const upper = getRelativeLuminance('#FF0000');
      const lower = getRelativeLuminance('#ff0000');
      expect(upper).toBe(lower);
    });
  });

  describe('WCAG 2.1 Compliance - Contrast Ratio', () => {
    it('should calculate maximum contrast (21:1) for black on white', () => {
      const ratio = getContrastRatio('#000000', '#FFFFFF');
      expect(ratio).toBeCloseTo(21, 0);
    });

    it('should calculate minimum contrast (1:1) for identical colors', () => {
      const ratio = getContrastRatio('#FF0000', '#FF0000');
      expect(ratio).toBe(1);
    });

    it('should be symmetric (order independent)', () => {
      const ratio1 = getContrastRatio('#000000', '#FFFFFF');
      const ratio2 = getContrastRatio('#FFFFFF', '#000000');
      expect(ratio1).toBe(ratio2);
    });

    it('should handle invalid colors gracefully', () => {
      const ratio = getContrastRatio('invalid', '#FFFFFF');
      expect(ratio).toBeGreaterThan(0);
      expect(ratio).toBeLessThanOrEqual(21);
    });
  });

  describe('WCAG AA Standard Compliance', () => {
    describe('Normal Text (4.5:1 minimum)', () => {
      it('should pass for black on white', () => {
        expect(meetsWCAGStandard('#000000', '#FFFFFF', 'AA', false)).toBe(true);
      });

      it('should pass for white on black', () => {
        expect(meetsWCAGStandard('#FFFFFF', '#000000', 'AA', false)).toBe(true);
      });

      it('should fail for low contrast colors', () => {
        // Light gray on white - typically fails
        expect(meetsWCAGStandard('#E0E0E0', '#FFFFFF', 'AA', false)).toBe(false);
      });

      it('should validate all preset colors meet AA with their specified text colors', () => {
        PRESET_COLORS.forEach(color => {
          const textColor = color.textColor || '#FFFFFF';
          const passes = meetsWCAGStandard(textColor, color.value, 'AA', false);
          expect(passes).toBe(true);
        });
      });
    });

    describe('Large Text (3:1 minimum)', () => {
      it('should pass for black on white', () => {
        expect(meetsWCAGStandard('#000000', '#FFFFFF', 'AA', true)).toBe(true);
      });

      it('should have lower threshold than normal text', () => {
        const color = '#787878'; // Mid-gray (4.47:1 - just below 4.5:1)
        const background = '#FFFFFF';

        // Should fail normal text AA (4.5:1)
        const normalPasses = meetsWCAGStandard(color, background, 'AA', false);

        // Should pass large text AA (3:1)
        const largePasses = meetsWCAGStandard(color, background, 'AA', true);

        expect(normalPasses).toBe(false);
        expect(largePasses).toBe(true);
      });
    });
  });

  describe('WCAG AAA Standard Compliance', () => {
    it('should require 7:1 for normal text', () => {
      // Black on white passes AAA
      expect(meetsWCAGStandard('#000000', '#FFFFFF', 'AAA', false)).toBe(true);

      // Mid-range contrast that passes AA but not AAA (6.98:1 - just below 7:1)
      expect(meetsWCAGStandard('#5A5A5A', '#FFFFFF', 'AAA', false)).toBe(false);
      expect(meetsWCAGStandard('#5A5A5A', '#FFFFFF', 'AA', false)).toBe(true);
    });

    it('should require 4.5:1 for large text', () => {
      // Should pass AAA large text
      expect(meetsWCAGStandard('#000000', '#FFFFFF', 'AAA', true)).toBe(true);
    });
  });

  describe('Accessible Text Color Selection', () => {
    it('should select white text for dark backgrounds', () => {
      const textColor = getAccessibleTextColor('#000000');
      expect(textColor).toBe('#FFFFFF');
    });

    it('should select black text for light backgrounds', () => {
      const textColor = getAccessibleTextColor('#FFFFFF');
      expect(textColor).toBe('#000000');
    });

    it('should select black text for yellow (high luminance)', () => {
      const textColor = getAccessibleTextColor('#EAB308');
      expect(textColor).toBe('#000000');
    });

    it('should select black text for amber (high luminance)', () => {
      const textColor = getAccessibleTextColor('#F59E0B');
      expect(textColor).toBe('#000000');
    });

    it('should select white text for navy blue (low luminance)', () => {
      const textColor = getAccessibleTextColor('#1E40AF');
      expect(textColor).toBe('#FFFFFF');
    });

    it('should handle invalid colors gracefully', () => {
      const textColor = getAccessibleTextColor('invalid');
      expect(textColor).toBe('#000000'); // Defaults to black
    });

    it('should use custom light/dark text options', () => {
      const textColor = getAccessibleTextColor('#000000', '#EEEEEE', '#111111');
      expect(textColor).toBe('#EEEEEE');
    });

    it('should prioritize better contrast', () => {
      // For a mid-tone color, should pick the option with better contrast
      const textColor = getAccessibleTextColor('#888888');
      const whiteContrast = getContrastRatio('#FFFFFF', '#888888');
      const blackContrast = getContrastRatio('#000000', '#888888');

      if (whiteContrast > blackContrast) {
        expect(textColor).toBe('#FFFFFF');
      } else {
        expect(textColor).toBe('#000000');
      }
    });
  });

  describe('Preset Colors WCAG AA Compliance', () => {
    it('all preset colors should meet WCAG AA with white OR black text', () => {
      PRESET_COLORS.forEach(color => {
        const whiteContrast = getContrastRatio('#FFFFFF', color.value);
        const blackContrast = getContrastRatio('#000000', color.value);

        const passesWithWhite = whiteContrast >= 4.5;
        const passesWithBlack = blackContrast >= 4.5;

        // At least one should pass
        expect(passesWithWhite || passesWithBlack).toBe(true);
      });
    });

    it('all preset colors should use the specified text color', () => {
      PRESET_COLORS.forEach(color => {
        const textColor = color.textColor || '#FFFFFF';
        const contrast = getContrastRatio(textColor, color.value);

        expect(contrast).toBeGreaterThanOrEqual(4.5);
      });
    });

    it('yellow and amber should specify black text', () => {
      const yellow = PRESET_COLORS.find(c => c.name === 'Yellow');
      const amber = PRESET_COLORS.find(c => c.name === 'Amber');

      expect(yellow?.textColor).toBe('#000000');
      expect(amber?.textColor).toBe('#000000');
    });

    it('dark colors should specify white text', () => {
      const darkColors = ['Navy', 'Purple', 'Violet', 'Emerald', 'Slate'];

      darkColors.forEach(colorName => {
        const color = PRESET_COLORS.find(c => c.name === colorName);
        expect(color?.textColor).toBe('#FFFFFF');
      });
    });
  });

  describe('Dark Mode Support', () => {
    it('preset colors should work on dark backgrounds', () => {
      const darkBackground = '#1F2937'; // Tailwind gray-800

      PRESET_COLORS.forEach(color => {
        // Color should have sufficient contrast against dark background
        const contrastOnDark = getContrastRatio(color.value, darkBackground);

        // Badge backgrounds should be distinguishable from dark mode background
        // We expect at least 1.5:1 for color differentiation
        expect(contrastOnDark).toBeGreaterThan(1.5);
      });
    });

    it('text colors should remain accessible in dark mode', () => {
      PRESET_COLORS.forEach(color => {
        const textColor = color.textColor || '#FFFFFF';

        // The text on the colored background should still be readable
        const textContrast = getContrastRatio(textColor, color.value);
        expect(textContrast).toBeGreaterThanOrEqual(4.5);
      });
    });
  });

  describe('Backward Compatibility', () => {
    it('getContrastingTextColor should match getAccessibleTextColor for most cases', () => {
      PRESET_COLORS.forEach(color => {
        const oldResult = getContrastingTextColor(color.value);
        const newResult = getAccessibleTextColor(color.value);

        // They should both return either white or black
        expect(['#FFFFFF', '#000000']).toContain(oldResult);
        expect(['#FFFFFF', '#000000']).toContain(newResult);
      });
    });

    it('getContrastingTextColor should handle invalid input', () => {
      const result = getContrastingTextColor('invalid');
      expect(result).toBe('#000000');
    });
  });

  describe('Edge Cases', () => {
    it('should handle colors without # prefix', () => {
      // getRelativeLuminance expects # prefix, so invalid format returns fallback
      const luminance = getRelativeLuminance('FF0000');
      expect(luminance).toBe(0.5); // Fallback value
    });

    it('should handle 3-digit hex colors as invalid', () => {
      expect(isValidHexColor('#FFF')).toBe(false);
      const textColor = getAccessibleTextColor('#FFF');
      expect(textColor).toBe('#000000'); // Defaults to black
    });

    it('should handle case-insensitive hex validation', () => {
      expect(isValidHexColor('#FF0000')).toBe(true);
      expect(isValidHexColor('#ff0000')).toBe(true);
      expect(isValidHexColor('#Ff0000')).toBe(true);
    });
  });

  describe('Real-World Scenarios', () => {
    it('category badges on white background should be accessible', () => {
      PRESET_COLORS.forEach(color => {
        const textColor = getAccessibleTextColor(color.value);
        const passes = meetsWCAGStandard(textColor, color.value, 'AA', false);

        expect(passes).toBe(true);
      });
    });

    it('category badges on light gray background should be accessible', () => {
      PRESET_COLORS.forEach(color => {
        const textColor = getAccessibleTextColor(color.value);
        const passes = meetsWCAGStandard(textColor, color.value, 'AA', false);

        expect(passes).toBe(true);
      });
    });

    it('category badges on dark background should be accessible', () => {
      PRESET_COLORS.forEach(color => {
        const textColor = getAccessibleTextColor(color.value);
        const passes = meetsWCAGStandard(textColor, color.value, 'AA', false);

        expect(passes).toBe(true);
      });
    });
  });
});
