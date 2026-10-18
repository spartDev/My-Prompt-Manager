<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Elements Charts - Data Format Examples

> **Important**: This file shows data structure patterns, not exact API guarantees. Always run Phase 1: Discovery (`scripts/discover-elements-charts.sh`) to confirm which chart components and data types exist in the team's installed version before using any structure listed here.

## Table of Contents
1. [BarChart Data](#barchart-data)
2. [LineChart Data](#linechart-data)
3. [BoxPlot Data](#boxplot-data)
4. [HeatMap Data](#heatmap-data)
5. [Common Patterns](#common-patterns)

---

## BarChart Data

### Simple Bars
```typescript
const data: BarChartData[] = [
  { label: "Jan", value: 120 },
  { label: "Feb", value: 150 },
  { label: "Mar", value: 90 },
];

<BarChart chartData={data} />
```

### With Custom Colors and Stripes
```typescript
const data: BarChartData[] = [
  { label: "Success", value: 85, color: "#21C55E" },
  { label: "Warning", value: 45, color: "#EAB308", striped: true },
  { label: "Error", value: 12, color: "#EF4444" },
];
```

### With Error Bars (Whiskers)
```typescript
const data: BarChartData[] = [
  { label: "Drug A", value: 72, whiskerMin: 65, whiskerMax: 79 },
  { label: "Drug B", value: 68, whiskerMin: 58, whiskerMax: 78 },
  { label: "Placebo", value: 45, whiskerMin: 38, whiskerMax: 52 },
];
```

### With Point Shapes
```typescript
const data: BarChartData[] = [
  { label: "Group 1", value: 50, shape: "circle" },
  { label: "Group 2", value: 65, shape: "triangle" },
  { label: "Group 3", value: 40, shape: "diamond" },
];

<BarChart chartData={data} shapesOnTop={true} />
```

### Grouped (2-Level Hierarchy)
```typescript
const data: BarChartData[] = [
  { region: "North", product: "Widget A", value: 120 },
  { region: "North", product: "Widget B", value: 95 },
  { region: "South", product: "Widget A", value: 140 },
  { region: "South", product: "Widget B", value: 110 },
];

<BarChart
  chartData={data}
  xAxis={[{ dataKey: "region" }, { dataKey: "product" }]}
/>
```

### Grouped (3-Level Hierarchy)
```typescript
const data: BarChartData[] = [
  { year: "2024", quarter: "Q1", metric: "Revenue", value: 500 },
  { year: "2024", quarter: "Q1", metric: "Profit", value: 120 },
  { year: "2024", quarter: "Q2", metric: "Revenue", value: 620 },
  { year: "2024", quarter: "Q2", metric: "Profit", value: 155 },
];

<BarChart
  chartData={data}
  xAxis={[{ dataKey: "year" }, { dataKey: "quarter" }, { dataKey: "metric" }]}
/>
```

### Negative Values
```typescript
const data: BarChartData[] = [
  { label: "Sector A", value: 30 },
  { label: "Sector B", value: -15 },
  { label: "Sector C", value: 45 },
  { label: "Sector D", value: -25 },
];
```

---

## LineChart Data

### Simple Single Series
```typescript
const series: LineChartSeries[] = [
  {
    name: "Revenue",
    data: [
      { x: 0, y: 100 },
      { x: 1, y: 120 },
      { x: 2, y: 115 },
      { x: 3, y: 140 },
    ],
    color: "#3B82F6",
  },
];

<LineChart series={series} xLabel="Month" yLabel="Revenue ($K)" />
```

### Multiple Series
```typescript
const series: LineChartSeries[] = [
  {
    name: "Product A",
    data: [{ x: 0, y: 20 }, { x: 1, y: 35 }, { x: 2, y: 28 }],
    color: "#3B82F6",
    showPoints: true,
    pointShape: "circle",
  },
  {
    name: "Product B",
    data: [{ x: 0, y: 15 }, { x: 1, y: 25 }, { x: 2, y: 40 }],
    color: "#FF9B4A",
    showPoints: true,
    pointShape: "triangle",
  },
  {
    name: "Baseline",
    data: [{ x: 0, y: 18 }, { x: 1, y: 18 }, { x: 2, y: 18 }],
    color: "#6E6E79",
    dashed: true,
  },
];
```

### With Confidence Intervals (Envelope)
```typescript
const series: LineChartSeries[] = [
  {
    name: "Treatment A",
    data: [
      { x: 0, y: 100, yUpper: 110, yLower: 90 },
      { x: 4, y: 120, yUpper: 135, yLower: 105 },
      { x: 8, y: 145, yUpper: 165, yLower: 125 },
      { x: 12, y: 160, yUpper: 180, yLower: 140 },
    ],
    color: "#01BDAD",
  },
];

<LineChart series={series} hideEnvelope={false} />
```

### With String X-Axis (Categorical)
```typescript
const series: LineChartSeries[] = [
  {
    name: "Score",
    data: [
      { x: "Jan", y: 72 },
      { x: "Feb", y: 78 },
      { x: "Mar", y: 85 },
      { x: "Apr", y: 82 },
    ],
    color: "#A855F7",
    showPoints: true,
  },
];
```

### With Date X-Axis (Time Series)
```typescript
const series: LineChartSeries[] = [
  {
    name: "Daily Active Users",
    data: [
      { x: new Date("2024-01-01"), y: 1200 },
      { x: new Date("2024-01-02"), y: 1350 },
      { x: new Date("2024-01-03"), y: 1100 },
      { x: new Date("2024-01-04"), y: 1500 },
    ],
    color: "#06B6D4",
  },
];
```

---

## BoxPlot Data

### Pre-Calculated Statistics
```typescript
const data: BoxPlotData[] = [
  {
    label: "Control",
    min: 10, q1: 25, median: 40, q3: 55, max: 75,
    outliers: [2, 82, 88],
  },
  {
    label: "Treatment",
    min: 20, q1: 35, median: 50, q3: 65, max: 85,
    outliers: [12],
  },
];

<BoxPlot chartData={data} yLabel="Response Score" />
```

### Raw Values (Auto-Calculated)
```typescript
const data: BoxPlotData[] = [
  {
    label: "Morning",
    values: [45, 48, 50, 52, 55, 58, 60, 62, 65, 70, 72, 95],
  },
  {
    label: "Afternoon",
    values: [30, 35, 38, 40, 42, 44, 46, 48, 50, 52, 55],
  },
  {
    label: "Evening",
    values: [20, 25, 28, 30, 32, 34, 36, 38, 40, 42, 80],
  },
];
```

### Grouped BoxPlots
```typescript
const data: BoxPlotData[] = [
  { treatment: "Drug A", timepoint: "Week 0", values: [45, 50, 55, 60, 65] },
  { treatment: "Drug A", timepoint: "Week 4", values: [55, 60, 65, 70, 75] },
  { treatment: "Drug B", timepoint: "Week 0", values: [40, 48, 52, 58, 62] },
  { treatment: "Drug B", timepoint: "Week 4", values: [48, 55, 60, 66, 72] },
];

<BoxPlot
  chartData={data}
  xAxis={[{ dataKey: "treatment" }, { dataKey: "timepoint" }]}
/>
```

### With Shapes
```typescript
const data: BoxPlotData[] = [
  { label: "Group A", min: 10, q1: 20, median: 35, q3: 50, max: 70, shape: "circle" },
  { label: "Group B", min: 15, q1: 30, median: 45, q3: 60, max: 80, shape: "triangle" },
];

<BoxPlot chartData={data} shapesOnTop={true} />
```

---

## HeatMap Data

### Simple Grid
```typescript
const data: HeatMapDataPoint[] = [
  { x: "A", y: "Row 1", value: 10 },
  { x: "A", y: "Row 2", value: 25 },
  { x: "A", y: "Row 3", value: 5 },
  { x: "B", y: "Row 1", value: 30 },
  { x: "B", y: "Row 2", value: 15 },
  { x: "B", y: "Row 3", value: 20 },
];
```

### Correlation Matrix
```typescript
const markers = ["IL-6", "TNF-a", "CRP", "IL-1b"];
const correlations = [
  [1.0, 0.85, 0.72, 0.45],
  [0.85, 1.0, 0.63, 0.38],
  [0.72, 0.63, 1.0, 0.55],
  [0.45, 0.38, 0.55, 1.0],
];

const data: HeatMapDataPoint[] = markers.flatMap((row, i) =>
  markers.map((col, j) => ({
    x: col,
    y: row,
    value: correlations[i][j],
  }))
);

<HeatMap
  data={data}
  cellContentRenderer={(cell) => cell.value.toFixed(2)}
  colorPalette={HEATMAP_CHRISIDIS_PALETTE}
  centerValue={0}
/>
```

### Gene Expression Data (with negative values)
```typescript
const data: HeatMapDataPoint[] = [
  { x: "Sample_1", y: "BRCA1", value: 2.3 },
  { x: "Sample_1", y: "TP53", value: -1.5 },
  { x: "Sample_1", y: "EGFR", value: 0.2 },
  { x: "Sample_2", y: "BRCA1", value: -0.8 },
  { x: "Sample_2", y: "TP53", value: 1.7 },
  { x: "Sample_2", y: "EGFR", value: 3.1 },
];

<HeatMap
  data={data}
  xLabel="Samples"
  yLabel="Genes"
  centerValue={0}
  colorPalette={HEATMAP_CHRISIDIS_PALETTE}
  cellContentRenderer={(cell) => ({
    primary: cell.value.toFixed(1),
    secondary: cell.value > 0 ? "up" : "down",
  })}
/>
```

### With Cell Content Formatting
```typescript
<HeatMap
  data={data}
  cellContentRenderer={(cell) => ({
    primary: `${cell.value.toFixed(0)}%`,
    secondary: cell.normalizedValue > 0.8 ? "High" : "Normal",
  })}
/>
```

### With Selection (Controlled)
```typescript
const [selected, setSelected] = useState<HeatMapSelectedCell[]>([]);

<HeatMap
  data={data}
  selection={{
    mode: "multiple",
    selectedCells: selected,
    onChange: setSelected,
    style: (cell) => ({
      backgroundColor: cell.value > 50 ? "#FFD700" : "#87CEEB",
      borderColor: "#000",
      borderWidth: 2,
    }),
  }}
/>
```

### With Fixed Cell Size
```typescript
<HeatMap
  data={data}
  cellSize={{ x: 40, y: 30 }}
/>
```

---

## Common Patterns

### Adding Threshold Lines to Any Chart
```typescript
const thresholds: ThresholdLine[] = [
  { value: 100, label: "Target", color: "#21C55E" },
  { value: 75, label: "Warning", color: "#EAB308", striped: true },
  { value: 50, label: "Critical", color: "#EF4444", shortLabel: "C", strokeWidth: 3 },
];

// Works with BarChart, LineChart, and BoxPlot
<BarChart chartData={data} thresholdLines={thresholds} />
<LineChart series={series} thresholdLines={thresholds} />
<BoxPlot chartData={boxData} thresholdLines={thresholds} />
```

### Custom Tooltip Renderer
```typescript
// All charts support custom tooltip renderers
<BarChart
  chartData={data}
  tooltipRenderer={(item) => (
    <div>
      <strong>{item.label}</strong>
      <p>Value: {item.value}</p>
      <p>Change: {item.change > 0 ? "+" : ""}{item.change}%</p>
    </div>
  )}
/>
```

### Responsive Container (no explicit dimensions)
```tsx
// Charts auto-resize to fill their container when width/height omitted
<div style={{ width: "100%", height: "500px" }}>
  <BarChart chartData={data} />
</div>
```

### Combining with Elements Design System
```tsx
import { Card, Title, TitleVariant } from "@sanofi-accelerator/elements";
import { BarChart } from "@sanofi-accelerator/elements-charts";

<Card>
  <Title variant={TitleVariant.TITLE_4}>Sales Overview</Title>
  <BarChart
    chartData={salesData}
    width={600}
    height={300}
    yLabel="Revenue ($)"
    locale="en"
    ariaLabel="Sales overview bar chart"
  />
</Card>
```
