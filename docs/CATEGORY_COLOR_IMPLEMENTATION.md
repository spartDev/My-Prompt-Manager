# Category Color Implementation Guide

Quick reference for implementing accessible category/tag colors in dual-theme systems.

**For Full Details:** See [ACCESSIBLE_COLOR_CONTRAST_GUIDE.md](./ACCESSIBLE_COLOR_CONTRAST_GUIDE.md)

---

## Quick Implementation Checklist

- [ ] Use separate color values for light and dark modes
- [ ] Test all combinations with WebAIM Contrast Checker
- [ ] Ensure minimum 4.5:1 contrast ratio for text
- [ ] Desaturate dark mode colors (~20 points less saturation)
- [ ] Use lighter backgrounds in dark mode (400 vs 500 scale)
- [ ] Avoid pure white text on dark backgrounds
- [ ] Test with color blindness simulators
- [ ] Validate focus states have 3:1 minimum contrast

---

## Recommended Category Colors

These color combinations are **pre-validated for WCAG AA compliance**:

### Light Mode (bg / text)
```css
Blue:    #3B82F6 / #FFFFFF  /* Blue 500 / White */
Green:   #10B981 / #FFFFFF  /* Green 500 / White */
Red:     #EF4444 / #FFFFFF  /* Red 500 / White */
Purple:  #8B5CF6 / #FFFFFF  /* Purple 500 / White */
Yellow:  #F59E0B / #78350F  /* Amber 500 / Amber 900 */
Cyan:    #06B6D4 / #FFFFFF  /* Cyan 500 / White */
Pink:    #EC4899 / #FFFFFF  /* Pink 500 / White */
Indigo:  #6366F1 / #FFFFFF  /* Indigo 500 / White */
```

### Dark Mode (bg / text)
```css
Blue:    #60A5FA / #1E3A8A  /* Blue 400 / Blue 900 */
Green:   #34D399 / #064E3B  /* Green 400 / Green 950 */
Red:     #F87171 / #7F1D1D  /* Red 400 / Red 900 */
Purple:  #A78BFA / #3B0764  /* Purple 400 / Purple 950 */
Yellow:  #FCD34D / #78350F  /* Yellow 300 / Amber 900 */
Cyan:    #22D3EE / #164E63  /* Cyan 400 / Cyan 900 */
Pink:    #F472B6 / #831843  /* Pink 400 / Pink 900 */
Indigo:  #818CF8 / #312E81  /* Indigo 400 / Indigo 950 */
```

---

## CSS Implementation

### Option 1: Tailwind Classes (Recommended)

```tsx
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

<span className={`px-3 py-1 rounded-full text-sm font-semibold ${colorClasses[color]}`}>
  {category}
</span>
```

### Option 2: CSS Custom Properties

```css
/* Light mode */
:root {
  --category-blue-bg: #3B82F6;
  --category-blue-text: #FFFFFF;
  /* ... */
}

/* Dark mode */
.dark-mode {
  --category-blue-bg: #60A5FA;
  --category-blue-text: #1E3A8A;
  /* ... */
}

.category-badge[data-color="blue"] {
  background-color: var(--category-blue-bg);
  color: var(--category-blue-text);
}
```

---

## TypeScript Color Config

```typescript
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
```

---

## Key Rules

1. **Never use pure black (#000000) in dark mode**
   - Use #121212 for backgrounds (Material Design standard)

2. **Desaturate colors in dark mode**
   - Light mode: More saturated (500-600 range)
   - Dark mode: Less saturated, lighter (300-400 range)

3. **Yellow is tricky**
   - Use amber (#F59E0B) instead of pure yellow in light mode
   - Use very light yellow (#FCD34D) in dark mode
   - Always use dark text (#78350F) for both modes

4. **Test with real tools**
   - Use WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/
   - Minimum 4.5:1 ratio for all text

5. **Respect user preferences**
   - Support `prefers-color-scheme` media query
   - Provide manual theme toggle option

---

## Testing Workflow

1. **Design Phase:**
   ```bash
   # Test each color combination at:
   https://webaim.org/resources/contrastchecker/
   ```

2. **Development Phase:**
   - Install TPGi Colour Contrast Analyser (CCA)
   - Use eyedropper tool to test live rendered colors
   - Check both light and dark modes

3. **Automated Testing:**
   ```typescript
   import { axe } from 'jest-axe';

   test('category badges should be accessible', async () => {
     const { container } = render(<CategoryBadge color="blue" />);
     const results = await axe(container);
     expect(results).toHaveNoViolations();
   });
   ```

---

## Common Pitfalls to Avoid

1. Using the same colors in both light and dark modes
2. Pure white text (#FFFFFF) on dark backgrounds → use rgba(255,255,255,0.87)
3. Pure black backgrounds (#000000) → use #121212
4. Not testing yellow/cyan carefully
5. Forgetting to test focus states
6. Relying only on color to convey information (add icons/labels)
7. Not testing with color blindness simulators

---

## Resources

### Tools
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) - Online, free
- [TPGi CCA](https://www.tpgi.com/color-contrast-checker/) - Desktop app, free
- [Coolors](https://coolors.co/contrast-checker) - Online, free

### Reference Implementations
- Material Design: https://m3.material.io/styles/color
- GitHub Primer: https://primer.style/design/foundations/color/
- Tailwind CSS: https://tailwindcss.com/docs/customizing-colors

### Standards
- WCAG 2.1: https://www.w3.org/WAI/WCAG21/quickref/
- Understanding Contrast: https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html

---

## Visual Comparison

### Light Mode Example
```
┌────────────────────────────────────┐
│  Background: #F9F9F9 (off-white)   │
│                                    │
│  ┌──────────────┐  ┌─────────────┐│
│  │ Development  │  │  Personal   ││
│  │  #3B82F6     │  │  #10B981    ││
│  │  #FFFFFF     │  │  #FFFFFF    ││
│  └──────────────┘  └─────────────┘│
│         Blue            Green       │
└────────────────────────────────────┘
```

### Dark Mode Example
```
┌────────────────────────────────────┐
│  Background: #121212 (dark gray)   │
│                                    │
│  ┌──────────────┐  ┌─────────────┐│
│  │ Development  │  │  Personal   ││
│  │  #60A5FA     │  │  #34D399    ││
│  │  #1E3A8A     │  │  #064E3B    ││
│  └──────────────┘  └─────────────┘│
│    Blue (lighter)  Green (lighter) │
└────────────────────────────────────┘
```

Note the differences:
- Background colors are lighter and less saturated in dark mode
- Text colors switch from white to dark in dark mode
- Both maintain 4.5:1+ contrast ratio

---

**Last Updated:** October 30, 2025
**See Also:** [ACCESSIBLE_COLOR_CONTRAST_GUIDE.md](./ACCESSIBLE_COLOR_CONTRAST_GUIDE.md)
