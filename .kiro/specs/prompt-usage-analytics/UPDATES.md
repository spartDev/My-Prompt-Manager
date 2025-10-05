# Design Document Updates - Prompt Usage Analytics

## Summary of Changes

This document summarizes the comprehensive updates made to the `design.md` file based on research and technical analysis.

---

## 1. Storage Architecture Decision ✅

**Added:** Explicit choice of `chrome.storage.local` with 3-tier aggregation over IndexedDB

**Key Points:**
- Rationale: Data volume (1-10k events = 1-5 MB) well under 10 MB limit
- Simpler implementation (~300 lines vs ~800 for IndexedDB)
- Better cross-context access (content scripts, popup, background)
- Performance adequate for scale (<1s for 10k events)
- Migration thresholds defined (when to switch to IndexedDB)

**Storage Structure:**
```
Tier 1: Raw events (circular buffer, max 1000)
Tier 2: Hourly aggregates (keep 30 days)
Tier 3: Daily aggregates (keep 365 days)
```

---

## 2. Chart Library Selection ✅

**Added:** Specific chart library recommendations with bundle size analysis

**Primary Choice: Lightweight Charts (35 KB)**
- Time-series line charts, area charts
- CSP compliant (canvas-based)
- Best performance for extensions

**Secondary: uPlot (48 KB)**
- General charts, bar charts
- Excellent performance (10% CPU for 3600 points)

**For Pie Charts: Chart.js (~50-70 KB, tree-shaken)**
- Platform/category breakdown
- Total bundle impact: ~83 KB

**Libraries Explicitly Avoided:**
- Recharts (139 KB)
- ECharts (1 MB)
- ApexCharts (170 KB)

---

## 3. UX Pattern Specifications ✅

**Added:** Concrete UX patterns with TypeScript interfaces

### Time Range Selector
- Presets: 7d, 30d, 90d, 1y, custom
- Placement: top-right (standard position)
- Default: 30d

### Empty State Design
- Icon: chart-line-icon
- Message: "No usage data yet"
- CTA: "View Prompt Library"

### Privacy Badge
- Text: "Local Only 🔒"
- Tooltip: "All analytics stored on your device. Never transmitted."
- Placement: dashboard-header

### Number Formatting Standards
```
1234 → "1.2k"
1234567 → "1.2M"
0.12345 → "12.3%"
```

### Clear Data Confirmation Pattern
- Question format title
- Red warning label
- Specific consequence details
- Red confirm button
- Optional typing requirement for critical data

---

## 4. Export/Import Specification ✅

**Added:** Complete export format and UI specification

### Export Format (TypeScript Interface)
```typescript
interface AnalyticsExport {
  version: '1.0'
  exportedAt: string
  extension: { version, name }
  data: {
    rawEvents?: UsageEvent[]  // Optional
    aggregates: { hourly, daily, platform, prompt }
  }
  metadata: { totalEvents, dateRange, exportedBy }
}
```

### Supported Formats
- **Primary:** CSV (Excel compatibility)
- **Secondary:** JSON (developer-friendly)

### Export UI
- Button placement: top-right
- Dropdown: Export CSV / Export JSON
- Options: includeRawEvents, timeRange

---

## 5. Enhanced Service Layer Specifications ✅

### AnalyticsTracker
**Added:**
- Batch event queuing (BATCH_SIZE = 50)
- Auto-flush (FLUSH_INTERVAL = 5000ms)
- Private queue management methods

### AnalyticsProcessor
**Added:**
- In-memory caching (5-minute TTL)
- Incremental aggregation (only process new events)
- Rollup strategy (hourly → daily after 30 days)
- Trend calculation algorithm (±10% threshold)
- Cache management methods

### AnalyticsStorage
**Added:**
- Circular buffer operations
- Separate methods for hourly/daily stats
- Metadata management
- Import/export methods
- Storage quota monitoring
- Flexible clear options (by time, platform, data type)

---

## 6. Quota Management Strategy ✅

**Added:** Complete quota monitoring and cleanup strategy

### Monitoring
- Check frequency: on-write
- Warning threshold: 80% (8 MB)
- Critical threshold: 95% (9.5 MB)

### Auto-Cleanup
- Triggers: quota exceeded, scheduled weekly, user-initiated
- Actions: rollup hourly→daily, delete old daily, trim raw events

### User Notification
- Warning message at 80%
- Actions: View Details, Clear Old Data, Dismiss

---

## 7. Performance Targets ✅

**Added:** Specific performance benchmarks

### Tracking
- Event capture: < 5ms overhead
- Batch write (50-100 events): < 50ms

### Processing
- Incremental aggregation: < 100ms
- Stats computation: < 200ms

### UI
- Dashboard load: < 500ms
- Chart render: < 300ms
- Interactive update: < 100ms

### Storage
- Quota check: < 10ms
- Cleanup: < 1s

---

## 8. Enhanced Testing Strategy ✅

**Added:** Specific test scenarios and performance benchmarks

### Storage API Testing
- Quota exceeded scenarios (fill to 9.5 MB)
- Circular buffer edge cases (exactly 1000 events)

### Performance Benchmarks
- 10,000 events aggregation in < 200ms
- Dashboard load (365 days) in < 500ms
- Storage quota check in < 10ms
- Batch write (100 events) in < 50ms

### Migration & Upgrade Testing
- First-time users (onboarding)
- Existing users upgrading
- Settings migration
- Backwards compatibility

---

## 9. Feature Flags & Rollout ✅

**Added:** Settings for gradual rollout

```typescript
interface AnalyticsSettings {
  // ... existing fields
  betaOptIn?: boolean           // Gradual rollout
  migrationComplete?: boolean   // First-time setup
  onboardingShown?: boolean     // Tutorial
}
```

---

## 10. Retention & Cleanup Strategy ✅

**Added:** Explicit data lifecycle management

### Retention Policy
- Raw events: 1000 max (circular overwrite)
- Hourly data: 30 days → rollup to daily
- Daily data: 365 days → delete oldest
- Auto-cleanup at 80% quota

### Rollup Strategy
- Hourly aggregates older than 30 days → Daily summaries
- Daily aggregates older than 365 days → Deleted
- Circular buffer maintains most recent 1000 raw events

---

## Implementation Impact

### Code Complexity
- **Before:** Abstract design, multiple options
- **After:** Concrete decisions, clear implementation path

### Bundle Size Impact
- Chart libraries: ~83 KB total
- No IndexedDB dependencies needed
- Lightweight implementation

### Development Time Estimate
- **Before:** 2-3 weeks (uncertainty)
- **After:** 2-3 days (clear specifications)

### Testing Effort
- Performance benchmarks defined
- Clear acceptance criteria
- Migration test cases specified

---

## Migration Path (If Needed)

Clear thresholds defined for migrating from chrome.storage.local to IndexedDB:

1. Storage usage > 8 MB (80% of quota)
2. Dashboard load time > 1s
3. Events per day > 200
4. Aggregation time > 100ms

**Current Assessment:** Unlikely to need migration given expected usage patterns.

---

## What Was NOT Changed

- Core data models (UsageEvent, AnalyticsSettings, etc.)
- Component architecture (Dashboard, Charts, Tables)
- Error handling types
- Security considerations
- Privacy principles

These remain valid as originally designed.

---

## Next Steps

1. ✅ Design document updated with technical decisions
2. ⏭️ Update tasks.md with specific implementation steps
3. ⏭️ Begin implementation with clear technical foundation
4. ⏭️ Install chart libraries (Lightweight Charts + uPlot)
5. ⏭️ Implement 3-tier storage architecture
6. ⏭️ Build analytics tracking service
7. ⏭️ Create dashboard UI components

---

## Questions Resolved

❓ **IndexedDB vs chrome.storage.local?**
✅ chrome.storage.local with 3-tier aggregation (adequate for scale, simpler)

❓ **Which chart library?**
✅ Lightweight Charts (35 KB) + uPlot (48 KB) + Chart.js for pie charts

❓ **How to handle storage limits?**
✅ Circular buffer (1000 events) + auto-rollup + quota monitoring

❓ **What export formats?**
✅ CSV (primary) + JSON (secondary)

❓ **UX patterns?**
✅ Time ranges (7d/30d/90d/1y), empty states, privacy badges, number formatting

❓ **Performance targets?**
✅ < 500ms dashboard load, < 200ms aggregation, < 50ms batch writes

❓ **Testing strategy?**
✅ Performance benchmarks, quota tests, migration tests, cross-context tests

---

**Status:** Design document is now **production-ready** with all critical decisions documented and justified.
