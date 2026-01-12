# Usage Analytics Dashboard — Design Document

**Date**: 2026-01-12
**Status**: Ready for implementation
**Version**: 1.0

## Overview

A 30-day rolling analytics dashboard that helps users understand their prompting behavior across time, platforms, and categories. The feature provides both a compact tab view for quick glances and an expandable full-page dashboard for deeper exploration.

## Goals

- Surface usage patterns (when, where, which prompts)
- Help users discover forgotten prompts
- Identify most/least used categories
- Track platform distribution

## Non-Goals (v1)

- Cloud sync of analytics data
- Prompt effectiveness/outcome tracking
- AI-powered suggestions
- Export functionality (future enhancement)

---

## Data Model

### UsageEvent

Each prompt insertion records a usage event:

```typescript
interface UsageEvent {
  promptId: string;        // Reference to the prompt
  timestamp: number;       // Unix milliseconds
  platform: string;        // 'claude' | 'chatgpt' | 'gemini' | 'perplexity' | 'copilot' | 'mistral' | 'custom'
  categoryId: string | null;
}
```

### Storage

- **Location**: Chrome local storage, new `usageHistory` key
- **Retention**: 30 days rolling window
- **Cleanup**: Events older than 30 days purged on extension load
- **Size estimate**: ~100 bytes/event × 50 uses/day × 30 days = ~150KB max

### Privacy

- Only IDs stored, no prompt content in history
- All data stays local (no cloud)
- User can clear history from settings

---

## UI Design

### Tab View (Compact)

Located in popup/side panel as new "Analytics" tab alongside Prompts, Categories, Settings.

**Layout (top to bottom):**

1. **Header row**
   - Title: "Analytics"
   - "Expand" button → opens full-page view
   - Subtitle: "Last 30 days"

2. **Summary cards (2×2 grid)**
   | Card | Content |
   |------|---------|
   | Total uses | "127 prompts used" + sparkline |
   | Top platform | "Claude (68%)" + mini bar |
   | Peak day | "Tuesdays" + day-of-week mini chart |
   | Top category | "Coding (42 uses)" |

3. **Top 5 prompts list**
   - Ranked by usage count
   - Shows: title, use count, last used date
   - Clickable → navigates to prompt

4. **Actions**
   - "View full dashboard" button
   - "Clear history" link (with confirmation modal)

**Behavior:**
- Cards show tooltips on hover with additional detail
- Cards clickable → jump to section in full-page view
- Respects dark mode via existing Tailwind theme

### Full-Page View

Opens in new browser tab for richer visualizations.

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│ Header: ← Back | "Usage Analytics" | Last 30 days          │
├─────────────────────────────────────────────────────────────┤
│ Row 1: Daily Usage Line Chart (full width)                  │
│        [Daily ○ Weekly] toggle                              │
├────────────────────────────┬────────────────────────────────┤
│ Row 2a: Platform Pie Chart │ Row 2b: Day of Week Bar Chart  │
├────────────────────────────┼────────────────────────────────┤
│ Row 3a: Category Bar Chart │ Row 3b: Time of Day Chart      │
├─────────────────────────────────────────────────────────────┤
│ Row 4: Prompt Tables                                        │
│        [Most Used] [Recently Used] [Forgotten]              │
│        Sortable table with columns:                         │
│        Title | Category | Uses | Last Used | Platforms      │
└─────────────────────────────────────────────────────────────┘
```

**Charts detail:**

| Chart | Type | Description |
|-------|------|-------------|
| Daily usage | Line | X: dates (30 days), Y: use count |
| Platform breakdown | Donut/Pie | % per platform |
| Day of week | Vertical bar | Mon-Sun usage distribution |
| Category distribution | Horizontal bar | Categories ranked by usage |
| Time of day | Bar or heatmap | Morning/Afternoon/Evening buckets |

**Prompt Tables:**
- Three tabs: Most Used, Recently Used, Forgotten (unused 14+ days)
- Columns: Prompt title, Category badge, Use count, Last used, Platform mini-bar
- Sortable by any column
- Click row → opens prompt in popup/side panel

---

## Technical Implementation

### Dependencies

**Add Recharts** for charting:
```bash
npm install recharts
```

- React-native, composable API
- ~40KB gzipped, tree-shakeable
- TypeScript types included
- Good dark mode support

### New Files

```
src/
├── services/
│   └── UsageTracker.ts           # Singleton service
├── components/
│   └── analytics/
│       ├── AnalyticsTab.tsx      # Compact tab view
│       ├── AnalyticsDashboard.tsx # Full-page container
│       ├── SummaryCard.tsx       # Reusable stat card
│       ├── UsageLineChart.tsx    # 30-day trend line
│       ├── PlatformPieChart.tsx  # Platform donut chart
│       ├── DayOfWeekChart.tsx    # Day distribution bar
│       ├── CategoryBarChart.tsx  # Category horizontal bars
│       ├── TimeOfDayChart.tsx    # Time bucket chart
│       └── PromptTable.tsx       # Sortable prompt list
├── hooks/
│   └── useUsageStats.ts          # Data aggregation hook
└── pages/
    └── analytics.tsx             # Full-page entry point
```

### UsageTracker Service

```typescript
// src/services/UsageTracker.ts
class UsageTracker {
  private static instance: UsageTracker;

  static getInstance(): UsageTracker;

  // Record a prompt usage
  async record(promptId: string, platform: string, categoryId: string | null): Promise<void>;

  // Get all events within retention period
  async getHistory(): Promise<UsageEvent[]>;

  // Clear all history
  async clearHistory(): Promise<void>;

  // Remove events older than 30 days (called on init)
  async cleanup(): Promise<void>;
}
```

### useUsageStats Hook

```typescript
// src/hooks/useUsageStats.ts
interface UsageStats {
  totalUses: number;
  dailyUsage: { date: string; count: number }[];
  platformBreakdown: { platform: string; count: number; percentage: number }[];
  dayOfWeekDistribution: { day: string; count: number }[];
  timeOfDayDistribution: { bucket: string; count: number }[];
  categoryDistribution: { categoryId: string; name: string; count: number }[];
  topPrompts: { promptId: string; title: string; count: number; lastUsed: number }[];
  recentPrompts: { promptId: string; title: string; count: number; lastUsed: number }[];
  forgottenPrompts: { promptId: string; title: string; count: number; lastUsed: number }[];
}

function useUsageStats(): {
  stats: UsageStats | null;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
};
```

### Integration Points

1. **PromptLibraryInjector.ts**
   - Call `UsageTracker.getInstance().record()` when prompt is inserted into AI platform

2. **TabNavigation.tsx**
   - Add "Analytics" as fourth tab with chart icon

3. **manifest.json**
   - Add `analytics.html` to extension pages
   - Update `web_accessible_resources` if needed

4. **App initialization**
   - Call `UsageTracker.getInstance().cleanup()` on extension load

---

## Dark Mode Support

All charts use Recharts theming props:
- Background: transparent (inherits from container)
- Text/labels: `var(--color-text)` or Tailwind's `text-gray-900 dark:text-gray-100`
- Grid lines: `var(--color-border)` or Tailwind equivalent
- Chart colors: Use existing category color palette where applicable

---

## Testing Strategy

### Unit Tests
- `UsageTracker`: record, getHistory, cleanup, clearHistory
- `useUsageStats`: aggregation logic for each stat type
- Date boundary handling (30-day cutoff)

### Component Tests
- `AnalyticsTab`: renders summary cards, handles empty state
- `PromptTable`: sorting, tab switching, row click navigation
- Chart components: render with mock data, dark mode variants

### E2E Tests
- Record usage → verify appears in analytics
- Clear history → verify empty state
- Full page navigation flow

---

## Implementation Order

1. **UsageTracker service** + storage integration
2. **useUsageStats hook** with aggregation logic
3. **AnalyticsTab** with summary cards (no charts yet)
4. **Install Recharts**, build individual chart components
5. **Full-page dashboard** layout
6. **Integration**: wire up recording in PromptLibraryInjector
7. **Polish**: dark mode, empty states, loading states
8. **Testing**: unit, component, E2E

---

## Open Questions (Resolved)

| Question | Resolution |
|----------|------------|
| Data retention period? | 30 days |
| Where does dashboard live? | Tab + expandable full page |
| Charting library? | Recharts |
| Store prompt content? | No, IDs only |

---

## Future Enhancements (Out of Scope)

- Export to CSV/JSON
- Custom date range picker
- Prompt effectiveness tracking
- AI-powered prompt suggestions
- Sync analytics across devices
