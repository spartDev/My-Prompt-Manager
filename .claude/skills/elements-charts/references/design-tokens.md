<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Elements Charts - Design Tokens & Visual Constants

> **Important**: This is a fallback reference. When `node_modules` is available, run Phase 1: Discovery (`scripts/discover-elements-charts.sh`) to get the actual exported palettes and constants from the installed version. Color values, palette names, and sizing constants may differ across versions.

## Table of Contents
1. [Color Palettes](#color-palettes)
2. [HeatMap Palettes](#heatmap-palettes)
3. [Theme-Aware Colors](#theme-aware-colors)
4. [Sizing Constants](#sizing-constants)
5. [Font Configuration](#font-configuration)
6. [Spacing & Layout](#spacing--layout)
7. [Tooltip Styling](#tooltip-styling)
8. [Legend Configuration](#legend-configuration)

---

## Color Palettes

### Primary Palette (12 colors)
Used automatically for BarChart, LineChart, and BoxPlot data series:

```typescript
const COLOR_PALETTE = [
  "#3B82F6",  // Blue
  "#FF9B4A",  // Orange
  "#21C55E",  // Green
  "#A855F7",  // Purple
  "#EAB308",  // Yellow
  "#06B6D4",  // Cyan
  "#EC4899",  // Pink
  "#B87C33",  // Brown
  "#EF4444",  // Red
  "#14B8A6",  // Teal
  "#6366F1",  // Indigo
  "#6E6E79",  // Gray
];
```

Colors are assigned in order. The first series/bar gets `#3B82F6`, second gets `#FF9B4A`, etc. Override with the `color` prop on individual data points.

### Pastel Palette (9 colors)
```typescript
const PASTEL_COLOR_PALETTE = [
  "#93C5FD",  // Light Blue
  "#FED7AA",  // Light Orange
  "#86EFAC",  // Light Green
  "#D8B4FE",  // Light Purple
  "#FDE68A",  // Light Yellow
  "#A5F3FC",  // Light Cyan
  "#F9A8D4",  // Light Pink
  "#FCA5A5",  // Light Red
  "#99F6E4",  // Light Teal
];
```

### Gray Palette (4 colors)
```typescript
const GRAY_COLOR_PALETTE = [
  "#A1A1AA",  // Gray 400
  "#71717A",  // Gray 500
  "#52525B",  // Gray 600
  "#3F3F46",  // Gray 700
];
```

---

## HeatMap Palettes

### Viridis Palette (Default)
20 colors from yellow to purple. Best for sequential data (0 to max):

```typescript
const HEATMAP_VIRIDIS_PALETTE = [
  "#FDE727", "#BDDF26", "#7AD151", "#44BF70", "#22A884",
  "#1F9E89", "#25838E", "#2D708E", "#38598C", "#433E85",
  "#482878", "#481F70", "#471365", "#440D5A", "#450C54",
  "#43096E", "#3E0B72", "#350D78", "#2A1180", "#1F1387",
];
```

### Rainbow Palette
20 colors from dark purple to red. Good for wider range visualization:

```typescript
const HEATMAP_RAINBOW_PALETTE = [
  "#45065B", "#5D1E7A", "#6E369E", "#7B52BD", "#7D73D4",
  "#6D96E3", "#4FB4E8", "#38C8DD", "#3BD5C1", "#50DC9E",
  "#75DE75", "#9CD94E", "#C2CF2E", "#E2BF1C", "#F5A81B",
  "#FC8D26", "#F87036", "#EE5147", "#DE3555", "#FE1302",
];
```

### Chrisidis Palette (Diverging)
20 colors from red to blue. Ideal for diverging data (use with `centerValue`):

```typescript
const HEATMAP_CHRISIDIS_PALETTE = [
  "#B21529", "#CB2E3B", "#DA4E52", "#E3736E", "#EC978F",
  "#F1ADA7", "#F4C1BD", "#F8DCD9", "#FFF5F5", "#F0F4FB",
  "#D8E4F5", "#C1D5EF", "#AAC5E8", "#8FB3E0", "#749FD7",
  "#5A8BCE", "#4077C4", "#2864BB", "#1165AB", "#1165AB",
];
```

### Choosing a Palette

| Data Type | Palette | Use With |
|-----------|---------|----------|
| Values 0 to max | `HEATMAP_VIRIDIS_PALETTE` | Default |
| Wide range of positive values | `HEATMAP_RAINBOW_PALETTE` | - |
| Positive and negative (diverging) | `HEATMAP_CHRISIDIS_PALETTE` | `centerValue={0}` |
| Correlations (-1 to 1) | `HEATMAP_CHRISIDIS_PALETTE` | `centerValue={0}` |

---

## Theme-Aware Colors

Charts automatically detect dark mode via the Elements `ThemeProvider`. These colors adjust:

| Purpose | Light Mode | Dark Mode |
|---------|-----------|-----------|
| Text color | `#000000` | `#ffffff` |
| Reversed text | `#ffffff` | `#000000` |
| Grid lines | `#e0e0e0` | `#757575` |
| Background | `#e4e4e4` | `#171717` |
| Tooltip bg | `#ffffff` | `#333333` |

Dark mode detection uses:
```typescript
const isDarkMode = document.documentElement.classList.contains("dark") ||
  window.matchMedia("(prefers-color-scheme: dark)").matches;
```

---

## Sizing Constants

### Chart Dimensions
| Constant | Value | Used By |
|----------|-------|---------|
| `DEFAULT_WIDTH` | 800px | All charts |
| `DEFAULT_HEIGHT` | 400px | All charts |

### Element Sizes
| Constant | Value | Used By |
|----------|-------|---------|
| `BAR_WIDTH` | 16px | BarChart |
| `BOX_WIDTH` | 16px | BoxPlot |
| `DEFAULT_CELL_SIZE` | 20px | HeatMap |
| `DEFAULT_POINT_RADIUS` | 4px | LineChart |
| `DEFAULT_LINE_STROKE_WIDTH` | 2px | LineChart |
| `DEFAULT_THRESHOLD_LINE_WIDTH` | 2px | All charts |
| `OUTLIER_RADIUS` | 3px | BoxPlot |
| `BOX_STROKE_WIDTH` | 2px | BoxPlot |
| `WHISKER_STROKE_WIDTH` | 1px | BoxPlot |
| `CELL_BORDER_WIDTH` | 1px | HeatMap |
| `DEFAULT_STRIPE_WIDTH` | 3px | BarChart (striped pattern) |

---

## Font Configuration

All charts use the Sanofi Sans font family:

```typescript
const FONT_FAMILY = "Sanofi Sans";

// Size scale
const FONT_SIZE_XLARGE = "18px";  // Chart title (if applicable)
const FONT_SIZE_LARGE = "16px";   // Axis labels
const FONT_SIZE_MEDIUM = "14px";  // Tick labels
const FONT_SIZE_SMALL = "12px";   // Legend items
const FONT_SIZE_XSMALL = "10px";  // Small annotations

const FONT_WEIGHT_BOLD = "700";
```

---

## Spacing & Layout

### Bar & Group Spacing
```typescript
const GROUPS_SPACINGS = [4, 48, 80];
// Index 0: spacing between bars in same group (4px)
// Index 1: spacing between groups (48px)
// Index 2: spacing between top-level sections (80px)
```

### Margins
Margins are calculated dynamically based on content:
- Legend presence/absence
- Label positions (top/bottom)
- Axis label text
- Number of hierarchy levels

The `calculateMargins()` function in constants.ts handles this automatically.

### Scroll Behavior
Charts support horizontal scrolling when content exceeds container width. The minimum bar/box width is enforced to maintain readability.

---

## Tooltip Styling

| Property | Value |
|----------|-------|
| `TOOLTIP_SPACING` | 12px (distance from cursor) |
| `TOOLTIP_TRANSITION_DURATION` | "0.2s" |
| Background | Theme-aware (white/dark gray) |
| Text color | Theme-aware (black/white) |
| Border radius | 4px |
| Padding | 8px 12px |

---

## Legend Configuration

| Property | Value |
|----------|-------|
| `LEGEND_ITEM_WIDTH` | 120px |
| `LEGEND_ITEM_HEIGHT` | 20px |
| Position | Below chart (above if `labelsOnTop`) |
| Layout | Horizontal wrap |

Legend items include:
- Color swatch (small rectangle matching series color)
- Series name text
- For striped patterns: hatched swatch
- For shapes: shape icon + label
- For threshold lines: line icon + label
