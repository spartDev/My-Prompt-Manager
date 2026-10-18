---
name: elements-charts
description: >
  Build data visualizations using Sanofi's Elements Charts library (@sanofi-accelerator/elements-charts).
  Use this skill when the user asks to create charts, graphs, data visualizations, dashboards with charts,
  or any visual data representation using the Elements Charts Design System. Triggers on "chart", "graph",
  "plot", "heatmap", "heat map", "bar chart", "line chart", "box plot", "boxplot", "data visualization",
  "visualize data", "correlation matrix", "time series", "trend chart", "elements-charts", or when the
  project imports from @sanofi-accelerator/elements-charts. Also triggers on adding charts to an Elements
  app, D3-based charts in Sanofi context, or scientific/clinical visualizations.
  Do NOT use for general UI layout without charts — use elements-design-system instead.
  Key capabilities: runtime component discovery from node_modules (adapts to any installed version),
  canvas-based React charts built on D3.js, theme-aware dark mode, and i18n support.
---

<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Elements Charts Builder

Build consistent, high-performance data visualizations with the Elements Charts library. This library provides canvas-based React chart components built on D3.js.

## Critical Rules (NEVER violate)

| Never | Always |
|-------|--------|
| Use raw `<canvas>` or D3 directly | Use `<BarChart>`, `<LineChart>`, `<BoxPlot>`, `<HeatMap>` components |
| Hardcode hex colors for data series | Use the built-in `COLOR_PALETTE` or chart-level `color` prop |
| Skip `width`/`height` or set them to 0 | Provide explicit dimensions or let the chart auto-resize via container |
| Use `<img>` for chart accessibility | Use `ariaLabel`, `ariaDescription`, and `accessibleDataTable` props |
| Format numbers manually | Use the `locale` prop or `formatNumber`/`formatCompactNumber` utilities |
| Import from subpaths | Import everything from `@sanofi-accelerator/elements-charts` |
| Assume hardcoded API from reference docs | Run Phase 1: Discovery to confirm the installed version's actual API |

## Workflow

### Phase 1: Discovery (run FIRST on every new project)

Run the discovery script to detect the installed version and its actual exports:

```bash
bash '${CLAUDE_SKILL_DIR}'/scripts/discover-elements-charts.sh <project-root>
```

This reads `package.json` and `node_modules/@sanofi-accelerator/elements-charts/dist/src/index.d.ts` to report the exact chart components, types, palettes, hooks, and utilities available in the team's installed version.

**If `node_modules` is not available** (not yet installed), fall back to the reference docs — but flag that the API may differ from what's documented.

**If `@sanofi-accelerator/elements-charts` is not in `package.json`**, inform the user and suggest installing it.

### Phase 2: Build

1. Pick the right chart for the use case (see Chart Selection Guide below)
2. Read `references/charts-api.md` for full TypeScript interfaces (fallback reference — prefer discovery output)
3. Read `references/data-formats.md` for data structure examples
4. Read `references/design-tokens.md` for color palettes and visual constants (fallback — prefer discovery output)
5. Apply accessibility props (`ariaLabel`, `ariaDescription`)
6. Use CSS Modules (`.module.scss`) with Elements design tokens for surrounding layout

## Setup

Install and import alongside the Elements Design System:

```tsx
import {
  BarChart, LineChart, BoxPlot, HeatMap,
  // Color palettes
  COLOR_PALETTE, HEATMAP_VIRIDIS_PALETTE, HEATMAP_RAINBOW_PALETTE, HEATMAP_CHRISIDIS_PALETTE,
  // i18n utilities
  formatNumber, formatCompactNumber, LOCALES,
  // Types
  type BarChartData, type LineChartSeries, type BoxPlotData, type HeatMapDataPoint,
  type ChartLocale, type ThresholdLine, type PointShape,
} from "@sanofi-accelerator/elements-charts";
import "@sanofi-accelerator/elements-charts/styles.css";
```

When used inside an Elements app, charts automatically inherit dark mode from `ThemeProvider`.

## Chart Selection Guide

| Use Case | Chart | Why |
|----------|-------|-----|
| Compare categories (sales by region) | `BarChart` | Best for discrete comparisons |
| Show trends over time | `LineChart` | Continuous data, multiple series |
| Statistical distributions (clinical trial results) | `BoxPlot` | Shows quartiles, outliers, spread |
| Matrix relationships (gene expression, correlations) | `HeatMap` | Color-coded 2D grid |
| Grouped comparisons (Q1 vs Q2 by department) | `BarChart` with `xAxis` hierarchy | Multi-level grouping |
| Trends with confidence intervals | `LineChart` with `yUpper`/`yLower` | Shaded envelope bands |
| Compare distributions across groups | `BoxPlot` with grouping | Side-by-side statistical comparison |
| Interactive cell selection | `HeatMap` with `selection` | Click to select cells |

## Common Props (All Charts)

All charts share these base props:

```typescript
interface BaseChartProps {
  width?: number;              // Default: 800
  height?: number;             // Default: 400
  xAxis?: XAxisConfig[];       // Default: [{ dataKey: 'label' }]
  labelsOnTop?: boolean;       // X-axis labels position (default: false = bottom)
  hideXLabels?: boolean;       // Hide x-axis labels
  hideLegend?: boolean;        // Hide legend
  thresholdLines?: ThresholdLine[];  // Horizontal reference lines
  tooltipRenderer?: (data) => ReactNode;  // Custom tooltip content
  locale?: ChartLocale | string;     // 'en', 'fr', 'de', 'es', 'ja', 'zh'
  ariaLabel?: string;                // Screen reader label
  ariaDescription?: string;          // Detailed screen reader description
  accessibleDataTable?: ReactNode;   // Hidden data table for screen readers
}
```

## Quick Reference: Each Chart

### BarChart

```tsx
<BarChart
  chartData={[
    { label: "Q1", value: 120, color: "#3B82F6" },
    { label: "Q2", value: 150, whiskerMin: 130, whiskerMax: 170 },
    { label: "Q3", value: 90, striped: true },
  ]}
  width={600}
  height={400}
  yLabel="Revenue (K)"
  ariaLabel="Bar chart showing quarterly revenue"
/>
```

**Key props**: `chartData`, `yLabel`, `shapesOnTop`
**Data fields**: `value` (required), `whiskerMin`/`whiskerMax`, `color`, `striped`, `shape`

### LineChart

```tsx
<LineChart
  series={[
    {
      name: "Treatment A",
      data: [
        { x: 0, y: 100, yUpper: 110, yLower: 90 },
        { x: 4, y: 120, yUpper: 135, yLower: 105 },
      ],
      color: "#01BDAD",
      showPoints: true,
      pointShape: "circle",
    },
    {
      name: "Placebo",
      data: [{ x: 0, y: 100 }, { x: 4, y: 105 }],
      color: "#FF5343",
      dashed: true,
    },
  ]}
  width={700}
  height={400}
  xLabel="Weeks"
  yLabel="Score"
  showGrid={true}
  includeZero={false}
/>
```

**Key props**: `series`, `xLabel`, `yLabel`, `showGrid`, `hideYLabels`, `includeZero`, `hideEnvelope`, `showWhiskers`, `xTickMarkEvery`
**Series fields**: `name`, `data`, `color`, `dashed`, `showPoints`, `pointShape`
**Data fields**: `x` (number/string/Date), `y` (required), `yUpper`/`yLower` (envelope)

### BoxPlot

```tsx
<BoxPlot
  chartData={[
    {
      label: "Group A",
      min: 10, q1: 25, median: 40, q3: 60, max: 80,
      outliers: [5, 85, 90],
    },
    {
      label: "Group B",
      values: [12, 15, 20, 25, 30, 35, 40, 45, 50], // Auto-calculates stats
    },
  ]}
  width={600}
  height={400}
  yLabel="Measurement"
/>
```

**Key props**: `chartData`, `yLabel`, `shapesOnTop`
**Data fields**: Either explicit stats (`min`, `q1`, `median`, `q3`, `max`, `outliers`) OR `values` array (auto-calculated)

### HeatMap

```tsx
<HeatMap
  data={[
    { x: "Sample A", y: "Gene 1", value: 2.3 },
    { x: "Sample A", y: "Gene 2", value: -1.5 },
    { x: "Sample B", y: "Gene 1", value: 0.8 },
    { x: "Sample B", y: "Gene 2", value: 3.1 },
  ]}
  width={600}
  height={400}
  xLabel="Samples"
  yLabel="Genes"
  colorPalette={HEATMAP_VIRIDIS_PALETTE}
  cellContentRenderer={(cell) => ({
    primary: cell.value.toFixed(1),
    secondary: `${(cell.normalizedValue * 100).toFixed(0)}%`,
  })}
/>
```

**Key props**: `data`, `xLabel`, `yLabel`, `colorPalette`, `cellSize`, `centerValue`, `selection`, `cellContentRenderer`, `showXAxisLabels`, `showYAxisLabels`
**Data fields**: `x`, `y`, `value` (all required)

## Color Palettes

```typescript
// Primary palette for BarChart, LineChart, BoxPlot (12 colors)
COLOR_PALETTE = ["#3B82F6", "#FF9B4A", "#21C55E", "#A855F7", "#EAB308",
  "#06B6D4", "#EC4899", "#B87C33", "#EF4444", "#14B8A6", "#6366F1", "#6E6E79"];

// HeatMap palettes (20 colors each)
HEATMAP_VIRIDIS_PALETTE   // Yellow -> Purple (default for HeatMap)
HEATMAP_RAINBOW_PALETTE   // Purple -> Red
HEATMAP_CHRISIDIS_PALETTE // Red -> Blue (diverging, use with centerValue)
```

## Hierarchical Grouping (BarChart & BoxPlot)

Group bars by multiple levels using `xAxis`:

```tsx
<BarChart
  chartData={[
    { treatment: "Drug A", visit: "Week 0", value: 45 },
    { treatment: "Drug A", visit: "Week 4", value: 62 },
    { treatment: "Drug B", visit: "Week 0", value: 48 },
    { treatment: "Drug B", visit: "Week 4", value: 55 },
  ]}
  xAxis={[
    { dataKey: "treatment" },  // Top-level group
    { dataKey: "visit" },      // Sub-group
  ]}
/>
```

## Threshold Lines

Add horizontal reference lines to BarChart, LineChart, or BoxPlot:

```tsx
thresholdLines={[
  { value: 100, label: "Target", color: "#00AA00" },
  { value: 75, label: "Warning", color: "#FFA500", striped: true },
  { value: 50, label: "Critical", color: "#FF0000", shortLabel: "C" },
]}
```

## Custom Tooltips

Override the default tooltip content:

```tsx
<BarChart
  chartData={data}
  tooltipRenderer={(item) => (
    <div style={{ padding: "8px" }}>
      <strong>{item.label}</strong>
      <p>Revenue: ${item.value.toLocaleString()}</p>
      <p>Target: ${item.threshold}</p>
    </div>
  )}
/>
```

## Internationalization (i18n)

Pass a locale string or custom `ChartLocale` object:

```tsx
// Built-in locales: 'en', 'fr', 'de', 'es', 'ja', 'zh'
<BarChart chartData={data} locale="fr" />

// Custom locale
const ptBR: ChartLocale = {
  code: 'pt-BR',
  numberFormat: { minimumFractionDigits: 0, maximumFractionDigits: 2 },
  compactNotation: { thousand: ' mil', million: ' mi' },
  translations: {
    noData: 'Nenhum dado disponivel',
    minimum: 'Minimo', maximum: 'Maximo', median: 'Mediana',
    quartile1: 'Q1', quartile3: 'Q3', outliers: 'Outliers',
  },
};

// Direct utilities
formatNumber(1234.567, LOCALES.fr);       // "1 234,57"
formatCompactNumber(1500000, LOCALES.de); // "1,5Mio."
```

## Accessibility

Every chart MUST have accessibility props in production:

```tsx
<LineChart
  series={series}
  ariaLabel="Line chart comparing treatment efficacy over 12 weeks"
  ariaDescription="Treatment A shows 40% improvement from baseline. Placebo shows 10% improvement."
/>

// For HeatMap, provide a data table for screen readers:
<HeatMap
  data={correlationData}
  ariaLabel="Correlation matrix"
  accessibleDataTable={
    <table>
      <caption>Correlation values</caption>
      <thead><tr><th>Marker</th><th>A</th><th>B</th></tr></thead>
      <tbody>
        <tr><th>A</th><td>1.0</td><td>0.85</td></tr>
        <tr><th>B</th><td>0.85</td><td>1.0</td></tr>
      </tbody>
    </table>
  }
/>
```

## HeatMap Cell Selection

Enable interactive cell selection:

```tsx
const [selected, setSelected] = useState<HeatMapSelectedCell[]>([]);

<HeatMap
  data={data}
  selection={{
    mode: "multiple",  // "single" | "multiple" | false
    selectedCells: selected,
    onChange: setSelected,
    style: {
      backgroundColor: "#FFD700",
      borderColor: "#000",
      borderWidth: 2,
    },
  }}
/>
```

## Design Constants

| Constant | Value | Context |
|----------|-------|---------|
| Default width | 800px | All charts |
| Default height | 400px | All charts |
| Bar/Box width | 16px | BarChart, BoxPlot |
| HeatMap cell size | 20px | HeatMap |
| Line stroke width | 2px | LineChart |
| Point radius | 4px | LineChart |
| Font family | "Sanofi Sans" | All charts |

## References

- **Full API for each chart**: See [references/charts-api.md](references/charts-api.md) for complete TypeScript interfaces, all props with defaults, and advanced configuration (fallback — prefer discovery output)
- **Data format examples**: See [references/data-formats.md](references/data-formats.md) for comprehensive data structure examples per chart type
- **Color palettes & theming**: See [references/design-tokens.md](references/design-tokens.md) for full color values, theme-aware colors, and font constants (fallback — prefer discovery output)
