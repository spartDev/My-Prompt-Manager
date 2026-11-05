# Accessible Color Contrast Guide: Dual Theme Implementation

Comprehensive best practices for accessible color contrast in dark/light mode UI design, with specific guidance for category/tag systems.

**Last Updated:** October 2025
**Based on:** WCAG 2.1 (current standard), WCAG 3.0/APCA (emerging)

---

## Table of Contents

1. [WCAG 2.1 Contrast Requirements](#wcag-21-contrast-requirements)
2. [Background Color Best Practices](#background-color-best-practices)
3. [Text on Colored Backgrounds](#text-on-colored-backgrounds)
4. [Adaptive Color Palette Strategies](#adaptive-color-palette-strategies)
5. [Testing Tools and Techniques](#testing-tools-and-techniques)
6. [Design System Examples](#design-system-examples)
7. [Implementation Guide for Category/Tag Colors](#implementation-guide-for-categorytag-colors)
8. [Code Examples](#code-examples)

---

## WCAG 2.1 Contrast Requirements

### Level AA (Standard Compliance)

**Required for most web applications and legal compliance:**

- **Normal Text:** Minimum 4.5:1 contrast ratio
  - Applies to text under 18pt (24px) or under 14pt bold (18.66px bold)
- **Large Text:** Minimum 3:1 contrast ratio
  - Applies to 18pt+ (24px+) or 14pt+ bold (18.66px+ bold)
- **UI Components:** Minimum 3:1 contrast ratio
  - Form input borders, icons, active navigation indicators
  - Graphics and user interface elements

### Level AAA (Enhanced Compliance)

**Recommended for healthcare, government, and high-accessibility applications:**

- **Normal Text:** Minimum 7:1 contrast ratio
- **Large Text:** Minimum 4.5:1 contrast ratio

### Key Points

- Most organizations target **AA compliance** for practical implementation
- AA compensates for vision loss equivalent to ~20/40 vision
- AAA compensates for vision loss equivalent to ~20/80 vision
- These requirements remain current as of 2025

**Sources:**
- [WCAG 2.1 Understanding Contrast (Minimum)](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

---

## Background Color Best Practices

### Light Mode

**Avoid Pure White (#FFFFFF)**
- Pure white can feel stark and cause eye strain
- Use off-whites or light grays for a more natural, comfortable appearance

**Recommended Light Mode Backgrounds:**
```css
--bg-light-primary: #F9F9F9;    /* Soft off-white */
--bg-light-secondary: #F3F3F3;  /* Light gray */
--bg-light-elevated: #FFFFFF;   /* Pure white (sparingly, for elevation) */
```

### Dark Mode

**NEVER Use Pure Black (#000000)**
- Pure black causes eye strain and reduces legibility
- Creates "halation effect" (glowing text) for users with astigmatism
- Exhibits excessive contrast with white text

**Use Dark Gray (#121212) as the Primary Background**
- This is the industry standard established by Material Design
- Provides comfortable viewing while maintaining depth
- Allows for elevation through subtle lightening

**Recommended Dark Mode Backgrounds:**
```css
--bg-dark-primary: #121212;     /* Material Design standard */
--bg-dark-secondary: #1E1E1E;   /* Slightly elevated */
--bg-dark-elevated: #2C2C2C;    /* For cards/modals */
```

### Elevation System

Material Design uses white overlay layers with transparency to create elevation in dark mode:

```css
/* Dark mode elevation */
--elevation-1: rgba(255, 255, 255, 0.05);  /* 5% white overlay */
--elevation-2: rgba(255, 255, 255, 0.07);  /* 7% white overlay */
--elevation-3: rgba(255, 255, 255, 0.08);  /* 8% white overlay */
--elevation-4: rgba(255, 255, 255, 0.09);  /* 9% white overlay */
```

**Sources:**
- [Material Design Dark Theme](https://design.google/library/material-design-dark-theme)
- [Smashing Magazine: Inclusive Dark Mode](https://www.smashingmagazine.com/2025/04/inclusive-dark-mode-designing-accessible-dark-themes/)

---

## Text on Colored Backgrounds

### Core Principles

1. **Avoid Pure White Text on Dark Backgrounds**
   - Pure white (#FFFFFF) creates excessive contrast and eye strain
   - Use slightly off-white colors instead

2. **Desaturate Colors in Dark Mode**
   - Saturated colors create optical vibrations on dark backgrounds
   - Reduce saturation by ~20 points compared to light mode
   - Prefer pastels over vivid colors

3. **Use Appropriate Text Opacities**

Material Design's text hierarchy system:
```css
/* Light mode */
--text-high-emphasis: rgba(0, 0, 0, 0.87);    /* 87% opacity */
--text-medium-emphasis: rgba(0, 0, 0, 0.60);  /* 60% opacity */
--text-disabled: rgba(0, 0, 0, 0.38);         /* 38% opacity */

/* Dark mode */
--text-high-emphasis: rgba(255, 255, 255, 0.87);    /* 87% opacity */
--text-medium-emphasis: rgba(255, 255, 255, 0.60);  /* 60% opacity */
--text-disabled: rgba(255, 255, 255, 0.38);         /* 38% opacity */
```

### Color-Specific Challenges

**Yellow, Green, and Cyan**
- Have narrower perceptual ranges in dark mode
- Require careful lightness adjustment for recognition
- Test extensively to ensure color identity is preserved

**Blue and Red**
- More forgiving across lightness levels
- Blue ~600 (light mode) → Blue ~700 (dark mode) for surfaces
- Blue ~200 (light mode) → Blue ~400 (dark mode) for alerts

**Sources:**
- [Color Tokens Guide to Light and Dark Modes](https://medium.com/design-bootcamp/color-tokens-guide-to-light-and-dark-modes-in-design-systems-146ab33023ac)
- [WorkOS Dark Mode Lessons](https://workos.com/blog/5-lessons-we-learned-adding-dark-mode-to-our-platform)

---

## Adaptive Color Palette Strategies

### Semantic Color Tokens

Use semantic tokens that adapt automatically when switching themes:

```css
/* Light mode */
--color-primary: #6366F1;           /* Indigo 600 */
--color-on-primary: #FFFFFF;        /* White text */
--color-surface: #F9F9F9;           /* Off-white */
--color-on-surface: #1F2937;        /* Gray 800 */

/* Dark mode */
--color-primary: #818CF8;           /* Indigo 400 (lighter) */
--color-on-primary: #1E1B4B;        /* Indigo 950 (darker text) */
--color-surface: #121212;           /* Dark gray */
--color-on-surface: #E5E7EB;        /* Gray 200 */
```

### Perceptual Color Scales

**GitHub Primer Approach:**
- 0-13 scale for each color family
- Light scale: starts with white (0) → darkest (13)
- Dark scale: inverted, starts with black (0) → lightest (13)

**Usage by purpose:**
- **Steps 0-6:** Background colors
- **Steps 7-8:** Borders and dividers (step 8 = minimum contrast for controls)
- **Steps 9-10:** Text and icons
  - Step 9: minimum contrast against backgrounds 0-4
  - Step 10: minimum contrast against backgrounds 5-6

### Adobe Leonardo: Contrast-Based Color Generation

**Revolutionary approach for adaptive palettes:**
- Define target contrast ratios (3:1, 4.5:1, 7:1)
- Algorithm generates colors that meet those ratios
- Automatic regeneration when background changes
- Works in CIECAM02 or LCH color space (perceptually uniform)

**Key features:**
- Users can adjust overall contrast, brightness, saturation
- Any background change regenerates the entire palette
- Enables creating entirely new themes automatically
- Ensures accessibility is baked into the system

**Tool:** [Leonardo Color](https://leonardocolor.io/)

### Radix Colors: Semantic Scale System

**Accessibility-first color system:**
- Each color has light and dark versions
- 12-step scales with semantic meanings
- Built-in accessibility guarantees
- No contrast issues if you follow recommended applications

**Scale structure (1-12):**
- Steps 1-2: Backgrounds
- Steps 3-5: Component backgrounds
- Steps 6-8: Borders and separators
- Steps 9-11: Solid colors and text
- Step 12: High contrast text

**Sources:**
- [Adobe Leonardo Overview](https://medium.com/@NateBaldwin/accessible-color-for-design-systems-just-got-easier-40e8420a8371)
- [GitHub Primer Color Usage](https://primer.style/product/getting-started/foundations/color-usage/)
- [Radix Colors with Tailwind](https://blog.soards.me/posts/radix-colors-with-tailwind/)

---

## Testing Tools and Techniques

### Essential Online Tools

1. **WebAIM Contrast Checker** (Industry Standard)
   - URL: https://webaim.org/resources/contrastchecker/
   - Tests WCAG 2.0/2.1 compliance
   - Shows pass/fail for normal, large text, and UI components
   - Free and widely trusted

2. **Coolors Contrast Checker**
   - URL: https://coolors.co/contrast-checker
   - Visual interface with real-time updates
   - Supports AA and AAA testing
   - Integrates with Coolors palette generator

3. **Accessible Color Palette Generator**
   - URL: https://venngage.com/tools/accessible-color-palette-generator
   - Generates WCAG-compliant color combinations
   - Batch testing for entire palettes
   - Export options for design tools

### Desktop Applications

**TPGi Colour Contrast Analyser (CCA)**
- Download: https://www.tpgi.com/color-contrast-checker/
- Tests WCAG 2.0, 2.1, and 2.2
- Eyedropper tool for testing live interfaces
- Simulates 8 different vision deficiencies
- Mac and Windows support

### Browser Extensions

1. **WCAG Color Contrast Checker (Chrome)**
   - Real-time page analysis
   - Highlights contrast failures
   - Simulates color blindness
   - Free on Chrome Web Store

2. **Accessible Web Helper (Chrome)**
   - Comprehensive accessibility scanning
   - Contrast ratio checks
   - WCAG violation detection
   - Free extension

### Programmatic Testing

**For automated CI/CD pipelines:**

```javascript
// Using axe-core for automated testing
import { axe } from 'jest-axe';

test('should have accessible color contrast', async () => {
  const { container } = render(<CategoryBadge color="blue" />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### Testing Workflow

1. **During Design:**
   - Use WebAIM or Coolors for quick checks
   - Test all text/background combinations
   - Verify both light and dark modes

2. **During Development:**
   - Install CCA for pixel-perfect testing
   - Use browser extensions for live testing
   - Implement automated accessibility tests

3. **Before Release:**
   - Test on actual devices in different lighting
   - Verify with vision deficiency simulations
   - Get feedback from users with visual impairments

**Sources:**
- [Accessibility Checker Color Contrast Tool](https://www.accessibilitychecker.org/color-contrast-checker/)
- [TPGi CCA Documentation](https://www.tpgi.com/color-contrast-checker/)

---

## Design System Examples

### Material Design 3

**Color System Approach:**
- Base color: #121212 for dark backgrounds
- Use tonal palette value ~200 for dark theme UI elements
- Desaturated colors (pastels) for dark mode
- Dynamic color with automated accessible color generation

**Implementation:**
```css
/* Light mode */
--md-sys-color-primary: #6750A4;
--md-sys-color-on-primary: #FFFFFF;
--md-sys-color-surface: #FFFBFE;
--md-sys-color-on-surface: #1C1B1F;

/* Dark mode */
--md-sys-color-primary: #D0BCFF;          /* Lighter, desaturated */
--md-sys-color-on-primary: #381E72;       /* Darker for contrast */
--md-sys-color-surface: #1C1B1F;          /* Dark gray, not black */
--md-sys-color-on-surface: #E6E1E5;       /* Off-white, not pure white */
```

**Text Hierarchy:**
- High emphasis: 87% opacity
- Medium emphasis: 60% opacity
- Disabled: 38% opacity

**Sources:**
- [Material Design Color System](https://m3.material.io/styles/color/system/overview)
- [Material Design Dark Theme](https://design.google/library/material-design-dark-theme)

### GitHub Primer

**Scale-Based System:**
- Neutral scales 0-13 (inverted for light/dark)
- Functional scales for each semantic color
- Nine themes including high contrast and color blindness themes

**Scale Usage:**
```css
/* Light mode */
--bgColor-default: var(--color-canvas-default);      /* scale.gray[0] */
--fgColor-default: var(--color-fg-default);          /* scale.gray[9] */
--borderColor-default: var(--color-border-default);  /* scale.gray[7] */

/* Dark mode */
--bgColor-default: var(--color-canvas-default);      /* scale.gray[13] inverted */
--fgColor-default: var(--color-fg-default);          /* scale.gray[9] inverted */
--borderColor-default: var(--color-border-default);  /* scale.gray[7] inverted */
```

**Key Innovation:**
- Primer Prism tool for automated palette creation
- Built-in accessibility validation
- Supports color vision deficiency themes

**Sources:**
- [GitHub Primer Color Tooling](https://github.blog/2022-06-14-accelerating-github-theme-creation-with-color-tooling/)
- [Primer Color Usage](https://primer.style/product/getting-started/foundations/color-usage/)

### Tailwind CSS

**Utility-First with Semantic Variants:**
- 50-950 color scales (10 steps)
- Dark mode via `prefers-color-scheme` or class strategy
- Community integration with Radix Colors

**Basic Implementation:**
```html
<!-- Auto-adapting with dark: variant -->
<div class="bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
  <span class="text-blue-600 dark:text-blue-400">Category</span>
</div>
```

**Accessibility Pattern:**
```javascript
// Tailwind config with accessible color strategy
module.exports = {
  theme: {
    extend: {
      colors: {
        // Light mode (saturated)
        'category-blue': {
          light: '#3B82F6',    // Blue 500
          dark: '#60A5FA',     // Blue 400 (lighter)
        }
      }
    }
  }
}
```

**Sources:**
- [Tailwind CSS Dark Mode](https://tailwindcss.com/docs/dark-mode)
- [Radix Colors with Tailwind](https://blog.soards.me/posts/radix-colors-with-tailwind/)

### Stripe's Badge System

**Real-World Example:**
Stripe redesigned their Badge component specifically for dark mode accessibility:
- Changed from border-only to colored backgrounds
- Ensured lightest values are distinguishable
- Maintains brand colors while meeting WCAG AA

**Key Lesson:**
"We found that our lightest badge values were too difficult to distinguish in dark mode, so we switched to color backgrounds to clearly differentiate each color."

**Sources:**
- [Stripe Accessible Color Systems](https://stripe.com/blog/accessible-color-systems)
- [WorkOS Dark Mode Implementation](https://workos.com/blog/5-lessons-we-learned-adding-dark-mode-to-our-platform)

---

## Implementation Guide for Category/Tag Colors

### Design Requirements

**For a category/tag system, you need:**
1. **8-12 distinct colors** for visual differentiation
2. **Readable text** (usually white or dark) on colored backgrounds
3. **Consistent appearance** across light and dark modes
4. **WCAG AA compliance** minimum (4.5:1 for small text)
5. **Color identity preservation** (blue looks blue in both modes)

### Strategy 1: Adaptive Color Pairs

**Approach:** Define separate light/dark color values for each category

```css
:root {
  /* Blue Category */
  --category-blue-bg-light: #3B82F6;      /* Blue 500 */
  --category-blue-bg-dark: #60A5FA;       /* Blue 400 */
  --category-blue-text-light: #FFFFFF;    /* White */
  --category-blue-text-dark: #1E3A8A;     /* Blue 900 */

  /* Green Category */
  --category-green-bg-light: #10B981;     /* Green 500 */
  --category-green-bg-dark: #34D399;      /* Green 400 */
  --category-green-text-light: #FFFFFF;   /* White */
  --category-green-text-dark: #064E3B;    /* Green 900 */

  /* Red Category */
  --category-red-bg-light: #EF4444;       /* Red 500 */
  --category-red-bg-dark: #F87171;        /* Red 400 */
  --category-red-text-light: #FFFFFF;     /* White */
  --category-red-text-dark: #7F1D1D;      /* Red 900 */

  /* Purple Category */
  --category-purple-bg-light: #8B5CF6;    /* Purple 500 */
  --category-purple-bg-dark: #A78BFA;     /* Purple 400 */
  --category-purple-text-light: #FFFFFF;  /* White */
  --category-purple-text-dark: #3B0764;   /* Purple 950 */

  /* Yellow Category (tricky in dark mode) */
  --category-yellow-bg-light: #F59E0B;    /* Amber 500 */
  --category-yellow-bg-dark: #FCD34D;     /* Yellow 300 (lighter for visibility) */
  --category-yellow-text-light: #78350F;  /* Amber 900 */
  --category-yellow-text-dark: #78350F;   /* Amber 900 */

  /* Cyan Category */
  --category-cyan-bg-light: #06B6D4;      /* Cyan 500 */
  --category-cyan-bg-dark: #22D3EE;       /* Cyan 400 */
  --category-cyan-text-light: #FFFFFF;    /* White */
  --category-cyan-text-dark: #164E63;     /* Cyan 900 */

  /* Pink Category */
  --category-pink-bg-light: #EC4899;      /* Pink 500 */
  --category-pink-bg-dark: #F472B6;       /* Pink 400 */
  --category-pink-text-light: #FFFFFF;    /* White */
  --category-pink-text-dark: #831843;     /* Pink 900 */

  /* Indigo Category */
  --category-indigo-bg-light: #6366F1;    /* Indigo 500 */
  --category-indigo-bg-dark: #818CF8;     /* Indigo 400 */
  --category-indigo-text-light: #FFFFFF;  /* White */
  --category-indigo-text-dark: #312E81;   /* Indigo 900 */
}

/* Semantic tokens that switch based on theme */
.light-mode {
  --category-blue-bg: var(--category-blue-bg-light);
  --category-blue-text: var(--category-blue-text-light);
  /* ... repeat for all colors ... */
}

.dark-mode {
  --category-blue-bg: var(--category-blue-bg-dark);
  --category-blue-text: var(--category-blue-text-dark);
  /* ... repeat for all colors ... */
}
```

### Strategy 2: Opacity-Based Variants

**Approach:** Use same base colors with different opacity for light/dark modes

```css
:root {
  /* Base colors (saturated for light mode) */
  --color-blue-base: #3B82F6;
  --color-green-base: #10B981;
  --color-red-base: #EF4444;
  /* ... */
}

.light-mode {
  --category-bg-opacity: 1;           /* Full saturation */
  --category-text-color: #FFFFFF;     /* White text */
}

.dark-mode {
  --category-bg-opacity: 0.8;         /* Slightly desaturated */
  --category-text-color: #1F2937;     /* Dark gray text */
}

.category-badge {
  background-color: rgb(from var(--color-blue-base) r g b / var(--category-bg-opacity));
  color: var(--category-text-color);
}
```

**Note:** This requires CSS Color Module Level 5 support (currently limited browser support).

### Strategy 3: HSL Manipulation

**Approach:** Adjust lightness and saturation in dark mode

```css
:root {
  /* Light mode - saturated colors */
  --category-blue-hsl: 217 91% 60%;    /* Blue 500 */

  /* Dark mode - lighter, less saturated */
  --category-blue-hsl-dark: 217 71% 70%;  /* +10% lightness, -20% saturation */
}

.light-mode {
  --category-blue: hsl(var(--category-blue-hsl));
}

.dark-mode {
  --category-blue: hsl(var(--category-blue-hsl-dark));
}
```

### Recommended: Strategy 1 (Adaptive Color Pairs)

**Rationale:**
- Maximum control over both modes
- Guaranteed WCAG compliance for each mode
- Handles problematic colors (yellow, cyan) individually
- Most reliable cross-browser support
- Used by Material Design, GitHub Primer, Tailwind

### Color Selection Guidelines

**For Light Mode Backgrounds:**
1. Use saturated colors (500-600 range in most scales)
2. Pair with white or very dark text
3. Test contrast ratio ≥ 4.5:1

**For Dark Mode Backgrounds:**
1. Use lighter variants (300-400 range)
2. Reduce saturation by ~20 points
3. Pair with dark text (usually 900 range)
4. Test contrast ratio ≥ 4.5:1

**Special Cases:**

**Yellow/Amber:**
- Light mode: Use amber/orange (better contrast than pure yellow)
- Dark mode: Use lighter yellow (300-400) with dark text
- Alternative: Use border-based design instead of filled background

**Cyan/Light Blue:**
- Requires careful lightness adjustment in dark mode
- Test extensively to maintain "cyan" identity
- Consider using teal as alternative

### Validation Checklist

Before finalizing category colors, verify:

- [ ] Text contrast ≥ 4.5:1 in light mode (all categories)
- [ ] Text contrast ≥ 4.5:1 in dark mode (all categories)
- [ ] Colors are visually distinct from each other (both modes)
- [ ] Color identity is preserved (blue looks blue, not purple)
- [ ] Works with color blindness simulations (protanopia, deuteranopia)
- [ ] Tested on actual devices in various lighting conditions
- [ ] Focus states have ≥ 3:1 contrast with background
- [ ] Border/outline colors (if used) have ≥ 3:1 contrast

**Sources:**
- [Color Tokens Guide](https://medium.com/design-bootcamp/color-tokens-guide-to-light-and-dark-modes-in-design-systems-146ab33023ac)
- [Stripe Accessible Color Systems](https://stripe.com/blog/accessible-color-systems)

---

## Code Examples

### React + Tailwind Implementation

```tsx
// CategoryBadge.tsx
import { FC } from 'react';

interface CategoryBadgeProps {
  category: string;
  color: 'blue' | 'green' | 'red' | 'purple' | 'yellow' | 'cyan' | 'pink' | 'indigo';
}

const colorClasses = {
  blue: 'bg-blue-500 text-white dark:bg-blue-400 dark:text-blue-950',
  green: 'bg-green-500 text-white dark:bg-green-400 dark:text-green-950',
  red: 'bg-red-500 text-white dark:bg-red-400 dark:text-red-950',
  purple: 'bg-purple-500 text-white dark:bg-purple-400 dark:text-purple-950',
  yellow: 'bg-amber-500 text-amber-900 dark:bg-yellow-300 dark:text-amber-900',
  cyan: 'bg-cyan-500 text-white dark:bg-cyan-400 dark:text-cyan-950',
  pink: 'bg-pink-500 text-white dark:bg-pink-400 dark:text-pink-950',
  indigo: 'bg-indigo-500 text-white dark:bg-indigo-400 dark:text-indigo-950',
} as const;

export const CategoryBadge: FC<CategoryBadgeProps> = ({ category, color }) => {
  return (
    <span
      className={`
        inline-flex items-center px-3 py-1 rounded-full
        text-sm font-semibold
        transition-colors duration-200
        ${colorClasses[color]}
      `}
    >
      {category}
    </span>
  );
};
```

### CSS Custom Properties Implementation

```css
/* theme.css */

/* Light mode color definitions */
:root,
.light-mode {
  /* Blue */
  --category-blue-bg: #3B82F6;
  --category-blue-text: #FFFFFF;

  /* Green */
  --category-green-bg: #10B981;
  --category-green-text: #FFFFFF;

  /* Red */
  --category-red-bg: #EF4444;
  --category-red-text: #FFFFFF;

  /* Purple */
  --category-purple-bg: #8B5CF6;
  --category-purple-text: #FFFFFF;

  /* Yellow */
  --category-yellow-bg: #F59E0B;
  --category-yellow-text: #78350F;

  /* Cyan */
  --category-cyan-bg: #06B6D4;
  --category-cyan-text: #FFFFFF;

  /* Pink */
  --category-pink-bg: #EC4899;
  --category-pink-text: #FFFFFF;

  /* Indigo */
  --category-indigo-bg: #6366F1;
  --category-indigo-text: #FFFFFF;
}

/* Dark mode color definitions */
.dark-mode {
  /* Blue */
  --category-blue-bg: #60A5FA;
  --category-blue-text: #1E3A8A;

  /* Green */
  --category-green-bg: #34D399;
  --category-green-text: #064E3B;

  /* Red */
  --category-red-bg: #F87171;
  --category-red-text: #7F1D1D;

  /* Purple */
  --category-purple-bg: #A78BFA;
  --category-purple-text: #3B0764;

  /* Yellow */
  --category-yellow-bg: #FCD34D;
  --category-yellow-text: #78350F;

  /* Cyan */
  --category-cyan-bg: #22D3EE;
  --category-cyan-text: #164E63;

  /* Pink */
  --category-pink-bg: #F472B6;
  --category-pink-text: #831843;

  /* Indigo */
  --category-indigo-bg: #818CF8;
  --category-indigo-text: #312E81;
}

/* Component styles */
.category-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 600;
  transition: all 0.2s;
}

.category-badge[data-color="blue"] {
  background-color: var(--category-blue-bg);
  color: var(--category-blue-text);
}

.category-badge[data-color="green"] {
  background-color: var(--category-green-bg);
  color: var(--category-green-text);
}

/* ... repeat for all colors ... */
```

```html
<!-- Usage -->
<span class="category-badge" data-color="blue">Development</span>
<span class="category-badge" data-color="green">Personal</span>
<span class="category-badge" data-color="red">Urgent</span>
```

### TypeScript Color Configuration

```typescript
// colors.config.ts

export interface ColorPair {
  light: {
    background: string;
    text: string;
  };
  dark: {
    background: string;
    text: string;
  };
}

export const categoryColors = {
  blue: {
    light: { background: '#3B82F6', text: '#FFFFFF' },
    dark: { background: '#60A5FA', text: '#1E3A8A' },
  },
  green: {
    light: { background: '#10B981', text: '#FFFFFF' },
    dark: { background: '#34D399', text: '#064E3B' },
  },
  red: {
    light: { background: '#EF4444', text: '#FFFFFF' },
    dark: { background: '#F87171', text: '#7F1D1D' },
  },
  purple: {
    light: { background: '#8B5CF6', text: '#FFFFFF' },
    dark: { background: '#A78BFA', text: '#3B0764' },
  },
  yellow: {
    light: { background: '#F59E0B', text: '#78350F' },
    dark: { background: '#FCD34D', text: '#78350F' },
  },
  cyan: {
    light: { background: '#06B6D4', text: '#FFFFFF' },
    dark: { background: '#22D3EE', text: '#164E63' },
  },
  pink: {
    light: { background: '#EC4899', text: '#FFFFFF' },
    dark: { background: '#F472B6', text: '#831843' },
  },
  indigo: {
    light: { background: '#6366F1', text: '#FFFFFF' },
    dark: { background: '#818CF8', text: '#312E81' },
  },
} as const;

export type CategoryColor = keyof typeof categoryColors;

// Usage in components
import { categoryColors } from './colors.config';

const getCategoryColors = (color: CategoryColor, isDark: boolean) => {
  const theme = isDark ? 'dark' : 'light';
  return categoryColors[color][theme];
};

// Example
const colors = getCategoryColors('blue', true);
// Returns: { background: '#60A5FA', text: '#1E3A8A' }
```

### Testing Example with Jest

```typescript
// CategoryBadge.test.tsx
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { CategoryBadge } from './CategoryBadge';

expect.extend(toHaveNoViolations);

describe('CategoryBadge Accessibility', () => {
  const colors = ['blue', 'green', 'red', 'purple', 'yellow', 'cyan', 'pink', 'indigo'] as const;

  describe('Light Mode', () => {
    colors.forEach(color => {
      it(`should have accessible contrast for ${color} category in light mode`, async () => {
        const { container } = render(
          <div className="light-mode">
            <CategoryBadge category="Test" color={color} />
          </div>
        );
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });
    });
  });

  describe('Dark Mode', () => {
    colors.forEach(color => {
      it(`should have accessible contrast for ${color} category in dark mode`, async () => {
        const { container } = render(
          <div className="dark-mode">
            <CategoryBadge category="Test" color={color} />
          </div>
        );
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });
    });
  });
});
```

---

## Quick Reference Table

### Contrast Ratio Requirements

| Element Type | WCAG AA | WCAG AAA | Notes |
|--------------|---------|----------|-------|
| Normal text (<18pt) | 4.5:1 | 7:1 | Most common requirement |
| Large text (≥18pt or ≥14pt bold) | 3:1 | 4.5:1 | Headings, large UI text |
| UI components (borders, icons) | 3:1 | N/A | WCAG 2.1+ requirement |
| Inactive/disabled elements | N/A | N/A | No requirement (but consider UX) |

### Background Color Recommendations

| Theme | Primary | Secondary | Elevated |
|-------|---------|-----------|----------|
| Light | #F9F9F9 | #F3F3F3 | #FFFFFF |
| Dark | #121212 | #1E1E1E | #2C2C2C |

### Text Color Recommendations

| Theme | High Emphasis | Medium Emphasis | Disabled |
|-------|---------------|-----------------|----------|
| Light | rgba(0,0,0,0.87) | rgba(0,0,0,0.60) | rgba(0,0,0,0.38) |
| Dark | rgba(255,255,255,0.87) | rgba(255,255,255,0.60) | rgba(255,255,255,0.38) |

### Category Color Quick Reference

| Color | Light Mode BG | Light Mode Text | Dark Mode BG | Dark Mode Text | Notes |
|-------|---------------|-----------------|--------------|----------------|-------|
| Blue | #3B82F6 | #FFFFFF | #60A5FA | #1E3A8A | Safe choice |
| Green | #10B981 | #FFFFFF | #34D399 | #064E3B | Safe choice |
| Red | #EF4444 | #FFFFFF | #F87171 | #7F1D1D | Safe choice |
| Purple | #8B5CF6 | #FFFFFF | #A78BFA | #3B0764 | Safe choice |
| Yellow | #F59E0B | #78350F | #FCD34D | #78350F | Tricky - use amber |
| Cyan | #06B6D4 | #FFFFFF | #22D3EE | #164E63 | Test carefully |
| Pink | #EC4899 | #FFFFFF | #F472B6 | #831843 | Safe choice |
| Indigo | #6366F1 | #FFFFFF | #818CF8 | #312E81 | Safe choice |

---

## Emerging Standards: WCAG 3.0 and APCA

### What's Changing

**WCAG 3.0** (still in draft) will introduce the **Advanced Perceptual Contrast Algorithm (APCA)**:

- Replaces ratio-based system with 0-100+ scale
- Higher numbers = higher contrast
- Perceptually uniform (matches human vision)
- Context-aware (considers text size and weight)
- Directional (swapping text/background affects results)

### APCA Levels

| Level | Use Case | Approximate WCAG Equivalent |
|-------|----------|----------------------------|
| 15 | Non-text elements minimum | ~3:1 |
| 30 | Absolute minimum for any text | ~3.5:1 |
| 60 | Body text minimum | ~4.5:1 (AA) |
| 75 | Body text preferred | ~5.5:1 |
| 90 | High contrast (AAA equivalent) | ~7:1 (AAA) |

### Current Status (2025)

- **WCAG 2.1 remains the legal standard**
- APCA is experimental and not yet required
- Chrome has experimental APCA support
- Full legal adoption may take years
- Use WCAG 2.1 for compliance, monitor APCA for future

**Tool for testing:** [APCA Contrast Calculator](https://www.myndex.com/APCA/)

**Sources:**
- [WCAG 3 and APCA Overview](https://typefully.com/DanHollick/wcag-3-and-apca-sle13GMW2Brp)
- [APCA vs WCAG 2.x Comparison](https://weable.pro/products/weable-color/blog/wcag-vs-apca-comparison)

---

## Key Takeaways

1. **Use Dark Gray, Not Black**
   - Light mode: #F9F9F9 (off-white)
   - Dark mode: #121212 (Material Design standard)

2. **Desaturate Colors in Dark Mode**
   - Reduce saturation by ~20 points
   - Use lighter variants (400 vs 500 in most scales)
   - Prevents optical vibrations and eye strain

3. **Test Everything**
   - Minimum 4.5:1 for normal text (WCAG AA)
   - Use WebAIM Contrast Checker or CCA
   - Test in both light and dark modes

4. **Avoid Pure White Text on Dark Backgrounds**
   - Use rgba(255,255,255,0.87) instead
   - Reduces eye strain and halation effect

5. **Use Semantic Color Tokens**
   - Define theme-aware variables
   - Automatic adaptation on theme switch
   - Easier maintenance and consistency

6. **Yellow/Cyan Require Special Attention**
   - Use amber instead of pure yellow
   - Test extensively to maintain color identity
   - Consider border-based designs as alternative

7. **Provide User Choice**
   - Support system preference (prefers-color-scheme)
   - Offer manual theme toggle
   - Respect user's accessibility needs

8. **Test with Real Users**
   - Simulate color blindness
   - Test in different lighting conditions
   - Get feedback from users with visual impairments

---

## Additional Resources

### Official Standards
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Understanding WCAG Contrast Requirements](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)

### Design Systems
- [Material Design Color System](https://m3.material.io/styles/color)
- [GitHub Primer](https://primer.style/design/foundations/color/)
- [Tailwind CSS Colors](https://tailwindcss.com/docs/customizing-colors)
- [Radix Colors](https://www.radix-ui.com/colors)

### Tools
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Adobe Leonardo](https://leonardocolor.io/)
- [Coolors Contrast Checker](https://coolors.co/contrast-checker)
- [TPGi Colour Contrast Analyser](https://www.tpgi.com/color-contrast-checker/)

### Articles
- [Smashing Magazine: Inclusive Dark Mode](https://www.smashingmagazine.com/2025/04/inclusive-dark-mode-designing-accessible-dark-themes/)
- [Stripe: Accessible Color Systems](https://stripe.com/blog/accessible-color-systems)
- [WorkOS: Dark Mode Lessons](https://workos.com/blog/5-lessons-we-learned-adding-dark-mode-to-our-platform)
- [Adaptive Color in Design Systems](https://medium.com/thinking-design/adaptive-color-in-design-systems-7bcd2e664fa0)

---

**Document Version:** 1.0
**Last Updated:** October 30, 2025
**Maintained by:** My Prompt Manager Project
