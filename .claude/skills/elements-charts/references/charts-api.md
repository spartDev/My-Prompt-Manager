<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Elements Charts - Full API Reference

> **Important**: This is a fallback reference. When `node_modules` is available, run Phase 1: Discovery (`scripts/discover-elements-charts.sh`) to get the exact API from the installed version's barrel file (`index.d.ts`). Props, types, and exports may differ across versions.

## Table of Contents
1. [Shared Types](#shared-types)
2. [BarChart API](#barchart-api)
3. [LineChart API](#linechart-api)
4. [BoxPlot API](#boxplot-api)
5. [HeatMap API](#heatmap-api)
6. [Hooks](#hooks)
7. [i18n API](#i18n-api)

---

## Shared Types

### XAxisConfig
```typescript
interface XAxisConfig {
  dataKey: string; // Key in data object for axis grouping
}
```

### BaseChartData
```typescript
interface BaseChartData {
  [key: string]: string | number | boolean | Date | null | undefined | string[] | number[];
  color?: string;    // Custom color for this data point
  striped?: boolean; // Striped/hatched pattern
}
```

### ThresholdLine
```typescript
interface ThresholdLine {
  value: number;        // Y-axis position
  label?: string;       // Legend/tooltip label
  color?: string;       // Line color
  striped?: boolean;    // Dashed pattern
  strokeWidth?: number; // Line width (default: 2)
  shortLabel?: string;  // Short label near Y-axis (e.g., "A")
}
```

### PointShape
```typescript
type PointShape =
  | "circle" | "triangle" | "diamond" | "square" | "star4"
  | "triangleDown" | "hexagon" | "star5" | "pentagon" | "star6";
```

### BaseChartProps
```typescript
interface BaseChartProps {
  xAxis?: XAxisConfig[];           // Default: [{ dataKey: 'label' }]
  width?: number;                  // Default: 800
  height?: number;                 // Default: 400
  labelsOnTop?: boolean;           // Default: false (labels at bottom)
  tooltipRenderer?: (itemData: ProcessedChartData) => ReactNode;
  hideXLabels?: boolean;           // Default: false
  hideLegend?: boolean;            // Default: false
  thresholdLines?: ThresholdLine[];
  thresholdLabelPadding?: number;  // Default: 0
  locale?: ChartLocale | string;   // Default: 'en-US'
  ariaLabel?: string;
  ariaDescription?: string;
  accessibleDataTable?: ReactNode;
}
```

---

## BarChart API

### BarChartProps
```typescript
interface BarChartProps extends BaseChartProps {
  chartData: BarChartData[];   // Required
  shapesOnTop?: boolean;       // Default: false - shapes above bars
  yLabel?: string;             // Y-axis label text
}
```

### BarChartData
```typescript
interface BarChartData extends BaseChartData {
  value: number;            // Required - bar height value
  whiskerMin?: number;      // Error bar minimum
  whiskerMax?: number;      // Error bar maximum
  shape?: PointShape;       // Decorative shape marker
  // Plus any grouping keys defined in xAxis (e.g., label, groupLabel, category)
}
```

### BarChart Constants
| Constant | Value |
|----------|-------|
| `BAR_WIDTH` | 16px |
| `GROUPS_SPACINGS` | [4, 48, 80] (bar, group, section gaps) |
| `DEFAULT_STRIPE_WIDTH` | 3px |

### Usage Patterns

**Simple bars:**
```tsx
<BarChart chartData={[{ label: "A", value: 30 }]} />
```

**With error bars:**
```tsx
<BarChart chartData={[{ label: "A", value: 30, whiskerMin: 20, whiskerMax: 40 }]} />
```

**Grouped with 2 levels:**
```tsx
<BarChart
  chartData={groupedData}
  xAxis={[{ dataKey: "group" }, { dataKey: "category" }]}
/>
```

**With shapes and custom colors:**
```tsx
<BarChart
  chartData={[
    { label: "A", value: 30, shape: "diamond", color: "#FF5343" },
    { label: "B", value: 50, striped: true },
  ]}
  shapesOnTop={true}
/>
```

---

## LineChart API

### LineChartProps
```typescript
interface LineChartProps extends Omit<BaseChartProps, "chartData"> {
  series: LineChartSeries[];    // Required
  showGrid?: boolean;           // Default: true
  hideYLabels?: boolean;        // Default: false
  includeZero?: boolean;        // Default: false - force Y-axis to include 0
  hideEnvelope?: boolean;       // Default: false
  showWhiskers?: boolean;       // Default: false
  xLabel?: string;              // X-axis label
  yLabel?: string;              // Y-axis label
  xTickMarkEvery?: number;      // X-axis tick interval (numeric x only)
}
```

### LineChartSeries
```typescript
interface LineChartSeries {
  name: string;              // Series name (for legend)
  data: LineChartDataPoint[];
  color?: string;            // Line/point color
  dashed?: boolean;          // Dashed line style
  showPoints?: boolean;      // Show data point markers
  pointShape?: PointShape;   // Shape of markers
}
```

### LineChartDataPoint
```typescript
interface LineChartDataPoint extends BaseChartData {
  x: number | string | Date;  // Required - X-axis value
  y: number;                   // Required - Y-axis value
  yUpper?: number;             // Upper confidence bound (envelope)
  yLower?: number;             // Lower confidence bound (envelope)
  series?: string;             // Series identifier
}
```

### LineChart Constants
| Constant | Value |
|----------|-------|
| `DEFAULT_LINE_STROKE_WIDTH` | 2px |
| `DEFAULT_POINT_RADIUS` | 4px |
| `LINE_HIT_TOLERANCE` | 8px |

### Usage Patterns

**Simple trend:**
```tsx
<LineChart series={[{ name: "Sales", data: [{ x: 0, y: 20 }, { x: 1, y: 35 }] }]} />
```

**With confidence intervals:**
```tsx
<LineChart
  series={[{
    name: "Treatment",
    data: [{ x: 0, y: 100, yUpper: 110, yLower: 90 }],
    color: "#01BDAD",
  }]}
  hideEnvelope={false}
/>
```

**Multiple styled series:**
```tsx
<LineChart
  series={[
    { name: "Actual", data: [...], color: "#3B82F6", showPoints: true, pointShape: "circle" },
    { name: "Predicted", data: [...], color: "#A855F7", dashed: true },
  ]}
  showGrid={true}
  includeZero={true}
/>
```

---

## BoxPlot API

### BoxPlotProps
```typescript
interface BoxPlotProps extends BaseChartProps {
  chartData: BoxPlotData[];   // Required
  shapesOnTop?: boolean;      // Default: false
  yLabel?: string;            // Y-axis label
}
```

### BoxPlotData
```typescript
interface BoxPlotData extends BaseChartData {
  // Option A: Raw values (auto-calculates statistics)
  values?: number[];

  // Option B: Pre-calculated statistics
  min?: number;
  q1?: number;        // First quartile (25th percentile)
  median?: number;     // 50th percentile
  q3?: number;         // Third quartile (75th percentile)
  max?: number;
  outliers?: number[];

  shape?: PointShape;  // Decorative shape marker
}
```

### BoxPlot Constants
| Constant | Value |
|----------|-------|
| `BOX_WIDTH` | 16px |
| `OUTLIER_RADIUS` | 3px |
| `BOX_STROKE_WIDTH` | 2px |
| `WHISKER_STROKE_WIDTH` | 1px |

### Auto-Calculation Rules
When `values` array is provided:
- Sorts the values
- Q1 = 25th percentile, Q3 = 75th percentile
- IQR = Q3 - Q1
- Whisker min = min value >= Q1 - 1.5 * IQR
- Whisker max = max value <= Q3 + 1.5 * IQR
- Outliers = values outside whisker range

---

## HeatMap API

### HeatMapProps
```typescript
interface HeatMapProps extends Omit<BaseChartProps, "chartData"> {
  data: HeatMapDataPoint[];                           // Required
  cellSize?: { x?: number; y?: number };              // Fixed cell dimensions
  showXAxisLabels?: boolean;                          // Default: true
  showYAxisLabels?: boolean;                          // Default: true
  hideLegend?: boolean;                               // Default: false
  xLabel?: string;
  yLabel?: string;
  cellContentRenderer?: (cell: ProcessedHeatMapData) => string | HeatMapCellContent;
  colorPalette?: readonly string[];                   // Default: HEATMAP_VIRIDIS_PALETTE
  centerValue?: number;                               // Center for diverging scales
  selection?: HeatMapSelection;
}
```

### HeatMapDataPoint
```typescript
interface HeatMapDataPoint extends BaseChartData {
  x: string | number;  // Required - column identifier
  y: string | number;  // Required - row identifier
  value: number;       // Required - determines color
}
```

### HeatMapCellContent
```typescript
interface HeatMapCellContent {
  primary: string;     // Main text in cell
  secondary?: string;  // Smaller text below
}
```

### HeatMapSelection
```typescript
interface HeatMapSelection {
  mode?: "single" | "multiple" | false;
  selectedCells?: HeatMapSelectedCell[];
  defaultSelectedCells?: HeatMapSelectedCell[];
  onChange?: (cells: HeatMapSelectedCell[]) => void;
  style?: HeatMapSelectionStyle | ((cell: ProcessedHeatMapData) => HeatMapSelectionStyle);
}

interface HeatMapSelectionStyle {
  backgroundColor?: string | "transparent";
  textColor?: string | "transparent";
  borderColor?: string;
  borderWidth?: number;
}

interface HeatMapSelectedCell {
  x: string | number;
  y: string | number;
}
```

### HeatMap Constants
| Constant | Value |
|----------|-------|
| `DEFAULT_CELL_SIZE` | 20px |
| `CELL_BORDER_WIDTH` | 1px |
| Default `labelsOnTop` | true (unlike other charts) |

---

## Hooks

### useChartResize
Responsive sizing with ResizeObserver:
```typescript
const { width, height } = useChartResize(containerRef, explicitWidth?, explicitHeight?);
```

### useChartMouseEvents
Mouse hover tracking for chart elements:
```typescript
const { hoveredIndex, mousePos } = useChartMouseEvents(
  canvasRef, processedData, hitDetectionFn
);
```

### useThresholdMouseEvents
Threshold line hover detection:
```typescript
const { hoveredThresholdIndex, thresholdMousePos } = useThresholdMouseEvents(
  canvasRef, thresholdLines, margin, yScale, innerWidth, hitTolerance?
);
```

### useChartTooltip
Tooltip positioning and content:
```typescript
const { customTooltipContent, tooltipPosition, tooltipRef, getTooltipStyles } =
  useChartTooltip(containerRef, mousePos, hoveredIndex, processedData, renderer, textColor, bgColor);
```

### useCanvasDrawing
Canvas lifecycle with automatic redraw:
```typescript
useCanvasDrawing(canvasRef, dimensions, dependencies, drawFn);
```

---

## i18n API

### Built-in Locales
| Locale | Code |
|--------|------|
| English (default) | `en-US` / `en` |
| French | `fr-FR` / `fr` |
| German | `de-DE` / `de` |
| Spanish | `es-ES` / `es` |
| Japanese | `ja-JP` / `ja` |
| Chinese (Simplified) | `zh-CN` / `zh` |

### ChartLocale Interface
```typescript
interface ChartLocale {
  code: string;
  numberFormat?: Intl.NumberFormatOptions;
  compactNotation?: { thousand: string; million: string; billion?: string };
  translations: {
    noData: string;
    loading?: string;
    min?: string;
    max?: string;
    median?: string;
    quartile1?: string;
    quartile3?: string;
    outliers?: string;
    value?: string;
    normalized?: string;
    x?: string;
    y?: string;
    category?: string;
  };
}
```

### Utility Functions
```typescript
formatNumber(value: number, locale: ChartLocale): string;
formatCompactNumber(value: number, locale?: ChartLocale): string;
getTranslation(key: string, locale: ChartLocale): string;
getLocale(code: string): ChartLocale;
```

### Number Formatting by Locale
| Locale | 1234.56 | 1,500,000 |
|--------|---------|-----------|
| en | 1,234.56 | 1.5M |
| fr | 1 234,56 | 1,5M |
| de | 1.234,56 | 1,5Mio. |
| ja | 1,234.56 | 1.5百万 |
