# Implementation Plan - Prompt Usage Analytics

## Phase 1: Foundation & Data Models (2-3 days)

### Task 1.1: Set up analytics type definitions
- [ ] Create `src/types/analytics.ts` with core interfaces
  - `UsageEvent` with id, promptId, timestamp, platform, category, sessionId
  - `HourlyStats` with count, byPlatform, byCategory, uniquePrompts
  - `DailyStats` with count, byPlatform, byCategory, topPrompts, uniquePrompts
  - `AnalyticsSettings` with trackingEnabled, retentionDays, betaOptIn, migrationComplete, onboardingShown
  - `AnalyticsMeta` with lastCleanup, oldestEvent, totalEvents, lastAggregation
  - `AnalyticsExport` with version, exportedAt, extension, data, metadata
  - `PromptUsageStats`, `PlatformUsageStats`, `CategoryUsageStats`, `TimeSeriesPoint`
- [ ] Add analytics error types to `src/types/errors.ts`
  - `AnalyticsErrorType` enum (TRACKING_DISABLED, STORAGE_QUOTA_EXCEEDED, etc.)
  - `AnalyticsError` interface extending `AppError`
- [ ] Export analytics types from `src/types/index.ts`
- [ ] Write unit tests for type guards and validation functions
- **Acceptance:** All TypeScript types compile without errors, 100% type coverage
- _Requirements: 5.1, 5.2, 5.3_

### Task 1.2: Install and configure chart libraries
- [ ] Install Lightweight Charts: `npm install lightweight-charts@latest`
- [ ] Install uPlot: `npm install uplot@latest`
- [ ] Install Chart.js with tree-shaking: `npm install chart.js@latest`
- [ ] Install React wrappers: `npm install uplot-react@latest`
- [ ] Verify bundle size impact (~83 KB total)
- [ ] Configure Vite to properly bundle chart libraries
- [ ] Test CSP compliance (canvas-based, no inline styles)
- **Acceptance:** All libraries installed, bundle size verified, CSP compliant
- _Requirements: 1.2, 2.1_

---

## Phase 2: Storage Layer (3-4 days)

### Task 2.1: Implement 3-tier storage architecture
- [ ] Extend `StorageManager` with analytics storage methods
  - `addEventToCircularBuffer(event: UsageEvent)` - Add to raw events (max 1000)
  - `getCircularBuffer()` - Retrieve raw events array
  - `getHourlyStats(month: string)` - Get hourly aggregates for a month
  - `updateHourlyStats(month: string, stats)` - Update hourly aggregates
  - `getDailyStats(year: string)` - Get daily aggregates for a year
  - `updateDailyStats(year: string, stats)` - Update daily aggregates
- [ ] Implement circular buffer logic (writeIndex wrapping at 1000)
- [ ] Add storage key helpers (`getHourKey`, `getDayKey`, `getMonthKey`)
- [ ] Write unit tests for storage operations
- **Acceptance:** All storage methods tested, circular buffer wraps correctly
- _Requirements: 5.1, 5.2, 5.3_

### Task 2.2: Implement storage quota monitoring
- [ ] Create `getAnalyticsStorageUsage()` method
  - Use `chrome.storage.local.getBytesInUse()` for analytics keys
  - Calculate percentage of 10 MB quota
  - Return `{ bytes, percentage }`
- [ ] Create `checkQuotaAndCleanup()` method
  - Check if usage > 80% (8 MB)
  - Trigger auto-cleanup if > 95% (9.5 MB)
  - Show user notification at 80%
- [ ] Add quota check to every write operation
- [ ] Write tests for quota threshold scenarios
- **Acceptance:** Quota monitoring works, auto-cleanup at 95%, warning at 80%
- _Requirements: 5.4_

### Task 2.3: Implement analytics metadata management
- [ ] Create `getAnalyticsMeta()` method
- [ ] Create `updateAnalyticsMeta(meta)` method
- [ ] Initialize metadata on first run
- [ ] Track lastCleanup, oldestEvent, totalEvents, lastAggregation
- [ ] Write unit tests for metadata operations
- **Acceptance:** Metadata tracks all required fields, persists correctly
- _Requirements: 5.1, 5.2_

### Task 2.4: Implement analytics settings storage
- [ ] Create `getAnalyticsSettings()` method with defaults
  - `trackingEnabled: true`
  - `retentionDays: 365`
  - `includeCustomSites: true`
  - `anonymizeData: false`
  - `betaOptIn: false`
  - `migrationComplete: false`
  - `onboardingShown: false`
- [ ] Create `updateAnalyticsSettings(settings)` method
- [ ] Add settings validation
- [ ] Write unit tests for settings operations
- **Acceptance:** Settings persist, defaults work, validation passes
- _Requirements: 5.1, 6.1_

---

## Phase 3: Analytics Tracker Service (2-3 days)

### Task 3.1: Create AnalyticsTracker service with batching
- [ ] Create `src/services/AnalyticsTracker.ts` as singleton
- [ ] Implement event queue with `BATCH_SIZE = 50` and `FLUSH_INTERVAL = 5000ms`
- [ ] Create `trackPromptUsage(promptId, platform)` method
  - Generate UUID for event
  - Get current category for prompt
  - Create UsageEvent object
  - Add to queue
  - Auto-flush if batch size reached
- [ ] Create `trackPromptCopy(promptId)` method for popup/sidepanel
- [ ] Implement `flush()` method
  - Write queued events to circular buffer
  - Trigger incremental aggregation
  - Clear queue
- [ ] Implement auto-flush timer (5 seconds)
- [ ] Create session ID generation (UUID, persist for browser session)
- [ ] Write unit tests for batching logic
- **Performance Target:** Event capture < 5ms, batch write < 50ms
- **Acceptance:** Batching works, auto-flush at 50 events or 5 seconds
- _Requirements: 1.1, 3.1, 5.1_

### Task 3.2: Add event validation and sanitization
- [ ] Create `validateUsageEvent(event)` method
  - Validate promptId exists
  - Validate platform is whitelisted or custom site
  - Validate timestamp is reasonable
  - Validate category is non-empty
- [ ] Create `sanitizeUsageEvent(event)` method
  - Sanitize platform name (remove special chars)
  - Sanitize category name
  - Limit string lengths (50 chars)
- [ ] Add error handling for invalid events
- [ ] Write unit tests for validation edge cases
- **Acceptance:** Invalid events rejected, malicious input sanitized
- _Requirements: 5.1, 5.2_

### Task 3.3: Integrate tracking into content scripts
- [ ] Modify `PlatformInsertionManager` to call tracker after successful insertion
- [ ] Add tracking to each platform strategy (Claude, ChatGPT, Perplexity)
- [ ] Add tracking to custom site insertions
- [ ] Ensure tracking doesn't block insertion (fire-and-forget)
- [ ] Add tracking error handling (graceful degradation)
- [ ] Test tracking on all platforms
- **Acceptance:** All platforms track usage, doesn't block UI, graceful failures
- _Requirements: 1.1, 3.1, 3.2, 3.3_

### Task 3.4: Integrate tracking into popup/sidepanel
- [ ] Add tracking to prompt copy button clicks
- [ ] Add tracking to prompt insertion via popup
- [ ] Respect trackingEnabled setting
- [ ] Write unit tests for UI tracking
- **Acceptance:** Popup/sidepanel track usage, setting respected
- _Requirements: 1.1, 5.1_

---

## Phase 4: Analytics Processor Service (3-4 days)

### Task 4.1: Create AnalyticsProcessor with caching
- [ ] Create `src/services/AnalyticsProcessor.ts` as singleton
- [ ] Implement in-memory cache with 5-minute TTL
  - `cache: Map<string, { data: any, expires: number }>`
  - `getCachedStats(key)` method
  - `setCachedStats(key, data)` method
  - Auto-cleanup expired cache entries
- [ ] Write unit tests for caching logic
- **Acceptance:** Cache works, 5-minute TTL, auto-cleanup
- _Requirements: 2.1, 2.2_

### Task 4.2: Implement incremental aggregation
- [ ] Create `aggregateNewEvents()` method
  - Get lastAggregation timestamp from metadata
  - Get raw events since lastAggregation
  - If no new events, return early
  - Group events by hour and day
  - Update hourly stats (increment counts, merge platforms/categories)
  - Update daily stats (increment counts, merge platforms/categories)
  - Update lastAggregation timestamp
- [ ] Ensure aggregation doesn't reprocess all events
- [ ] Write unit tests for incremental logic
- **Performance Target:** < 100ms for 100 new events
- **Acceptance:** Only new events processed, performance target met
- _Requirements: 1.2, 2.1, 2.2_

### Task 4.3: Implement trend calculation algorithm
- [ ] Create `calculateTrends(events)` method
  - Compare last 7 days vs previous 7 days
  - Calculate percentage change
  - Return 'increasing' if > +10%
  - Return 'decreasing' if < -10%
  - Return 'stable' otherwise
- [ ] Apply trends to prompts and categories
- [ ] Write unit tests for edge cases (no previous data, zero usage, etc.)
- **Acceptance:** Trends calculated correctly, edge cases handled
- _Requirements: 1.3_

### Task 4.4: Implement time series data generation
- [ ] Create `generateTimeSeriesData(events, granularity)` method
  - Support 'day', 'week', 'month' granularity
  - Group events by time bucket
  - Count usage per bucket
  - Count unique prompts per bucket
  - Break down by platform per bucket
  - Return array of `TimeSeriesPoint[]`
- [ ] Handle gaps in data (fill with zeros)
- [ ] Write unit tests for all granularities
- **Acceptance:** Time series generated correctly, gaps filled, all granularities work
- _Requirements: 2.1, 2.2_

### Task 4.5: Implement statistics computation
- [ ] Create `processAnalytics(timeRange)` method
  - Get relevant daily/hourly stats for time range
  - Calculate totalUsage (sum of counts)
  - Calculate uniquePromptsUsed (unique IDs)
  - Calculate averageUsagePerDay
  - Find mostUsedPrompt
  - Find leastUsedPrompts (bottom 5)
  - Generate platformBreakdown with percentages
  - Generate categoryBreakdown with percentages
  - Generate timeSeriesData
  - Calculate trends
  - Cache result for 5 minutes
- [ ] Support time ranges: 7d, 30d, 90d, 1y, all
- [ ] Write comprehensive unit tests
- **Performance Target:** < 200ms for 365 days of data
- **Acceptance:** All statistics computed correctly, performance target met
- _Requirements: 1.2, 1.3, 2.1, 2.2, 3.2, 4.1_

### Task 4.6: Implement rollup and cleanup
- [ ] Create `rollupHourlyToDaily(month)` method
  - Get all hourly stats for month
  - Group by day
  - Sum counts, merge platforms/categories
  - Save as daily stats
  - Delete hourly stats for month
- [ ] Create `cleanupOldEvents()` method
  - Identify hourly data > 30 days old
  - Rollup to daily stats
  - Identify daily data > 365 days old
  - Delete old daily stats
  - Update metadata
- [ ] Add scheduled cleanup (weekly via chrome.alarms)
- [ ] Write unit tests for rollup logic
- **Acceptance:** Rollup works, old data deleted, metadata updated
- _Requirements: 5.4_

---

## Phase 5: UI Components (4-5 days)

### Task 5.1: Create AnalyticsDashboard component
- [ ] Create `src/components/analytics/AnalyticsDashboard.tsx`
- [ ] Add time range selector (7d, 30d, 90d, 1y, custom)
  - Placement: top-right
  - Default: 30d
  - Dropdown component
- [ ] Add privacy badge "Local Only 🔒"
  - Tooltip: "All analytics stored on your device. Never transmitted."
  - Placement: header
  - Green color
- [ ] Add loading states
- [ ] Add error boundaries
- [ ] Add empty state component
  - Icon: chart-line-icon
  - Message: "No usage data yet"
  - CTA: "View Prompt Library" button
- [ ] Display overview statistics (cards)
  - Total usage (formatted: 1.2k)
  - Unique prompts used
  - Average usage per day
  - Most used prompt
- [ ] Integrate time series chart
- [ ] Integrate platform breakdown
- [ ] Integrate prompt usage table
- [ ] Write component tests
- **Performance Target:** Dashboard load < 500ms
- **Acceptance:** All sections render, empty state works, performance target met
- _Requirements: 1.2, 1.3, 2.1, 2.2, 3.2, 4.1_

### Task 5.2: Create UsageChart component with Lightweight Charts
- [ ] Create `src/components/analytics/UsageChart.tsx`
- [ ] Integrate Lightweight Charts library
- [ ] Support line chart for time series
- [ ] Support area chart for cumulative data
- [ ] Add platform color coding
- [ ] Add interactive tooltips
- [ ] Add dark mode support (follow extension theme)
- [ ] Write component tests
- **Performance Target:** Chart render < 300ms for 365 data points
- **Acceptance:** Chart renders, interactive, dark mode works, performance met
- _Requirements: 2.1, 2.2_

### Task 5.3: Create PromptUsageTable component
- [ ] Create `src/components/analytics/PromptUsageTable.tsx`
- [ ] Display columns: Prompt Title, Category, Usage Count, Last Used, Trend
- [ ] Add sorting (usage, recent, alphabetical)
- [ ] Add trend indicators (↑ increasing, ↓ decreasing, → stable)
- [ ] Add "frequently used" badge (> 10 uses)
- [ ] Add click to view prompt details
- [ ] Add virtual scrolling for large lists
- [ ] Format numbers (1.2k, 1.2M)
- [ ] Write component tests
- **Acceptance:** Table sortable, trends shown, badges work, virtual scroll
- _Requirements: 1.2, 1.3_

### Task 5.4: Create PlatformBreakdown component with uPlot/Chart.js
- [ ] Create `src/components/analytics/PlatformBreakdown.tsx`
- [ ] Use Chart.js for pie chart (platform distribution)
- [ ] Use uPlot for bar chart (platform usage over time)
- [ ] Display percentages
- [ ] Add platform icons (Claude, ChatGPT, Perplexity, Custom)
- [ ] Add click to filter dashboard by platform
- [ ] Write component tests
- **Acceptance:** Charts render, percentages correct, filtering works
- _Requirements: 3.2, 3.3_

### Task 5.5: Create CategoryBreakdown component
- [ ] Create `src/components/analytics/CategoryBreakdown.tsx`
- [ ] Display category usage statistics
- [ ] Show unused categories (highlight)
- [ ] Display trends per category
- [ ] Add click to filter by category
- [ ] Write component tests
- **Acceptance:** Categories displayed, unused highlighted, trends shown
- _Requirements: 4.1, 4.2, 4.3_

### Task 5.6: Create TimeRangeSelector component
- [ ] Create `src/components/analytics/TimeRangeSelector.tsx`
- [ ] Add preset buttons (7d, 30d, 90d, 1y)
- [ ] Add custom date range picker
- [ ] Add onChange handler
- [ ] Style according to extension theme
- [ ] Write component tests
- **Acceptance:** All presets work, custom range works, theme matches
- _Requirements: 2.1, 2.2, 2.3_

### Task 5.7: Add analytics navigation integration
- [ ] Add "Analytics" tab to main extension navigation
- [ ] Add analytics icon (chart/graph icon)
- [ ] Integrate AnalyticsDashboard into routing
- [ ] Add loading states during navigation
- [ ] Ensure theme consistency
- [ ] Write navigation tests
- **Acceptance:** Analytics accessible via tab, navigation smooth, theme consistent
- _Requirements: 1.2, 1.3, 2.1_

---

## Phase 6: Data Management (2-3 days)

### Task 6.1: Implement analytics export (CSV & JSON)
- [ ] Create `src/services/AnalyticsExporter.ts`
- [ ] Implement `exportAsCSV(options)` method
  - Generate CSV headers (Prompt Title, Category, Usage Count, Platforms, Last Used)
  - Format data rows
  - Include metadata in header comments
  - Return CSV string
- [ ] Implement `exportAsJSON(options)` method
  - Create AnalyticsExport object
  - Include version, exportedAt, extension info
  - Include aggregates (hourly, daily, platform, prompt)
  - Optionally include raw events (default: false)
  - Return JSON string
- [ ] Add export options (includeRawEvents, timeRange)
- [ ] Create download functionality (Blob + URL.createObjectURL)
- [ ] Write unit tests for both formats
- **Acceptance:** CSV and JSON export work, downloads trigger, data valid
- _Requirements: 7.1, 7.2, 7.3, 7.4_

### Task 6.2: Create export UI
- [ ] Create `src/components/analytics/ExportButton.tsx`
- [ ] Add dropdown: "Export CSV" / "Export JSON"
- [ ] Add export options modal
  - Include raw events? (checkbox)
  - Time range selector (dropdown)
- [ ] Add progress indicator for large exports
- [ ] Add success notification
- [ ] Placement: top-right of dashboard
- [ ] Write component tests
- **Acceptance:** Export button works, options configurable, progress shown
- _Requirements: 7.1, 7.2, 7.3_

### Task 6.3: Implement analytics import
- [ ] Create `src/services/AnalyticsImporter.ts`
- [ ] Implement `importAnalyticsData(data)` method
  - Validate AnalyticsExport format
  - Merge with existing data (don't duplicate events)
  - Update aggregates
  - Update metadata
  - Return import summary
- [ ] Add validation for import data integrity
- [ ] Create import UI component
- [ ] Add conflict resolution (merge vs replace)
- [ ] Write unit tests for import logic
- **Acceptance:** Import works, data validated, conflicts resolved, no duplicates
- _Requirements: 7.1, 7.2, 7.3_

### Task 6.4: Implement clear analytics data
- [ ] Create `clearAnalyticsData(options)` method in AnalyticsStorage
  - Support clearing raw events only
  - Support clearing aggregates only
  - Support clearing by timestamp (before date)
  - Support clearing by platform
  - Update metadata after clearing
- [ ] Create confirmation dialog component
  - Title: "Delete All Analytics Data?" (question format)
  - Warning: "This action cannot be undone" (red label)
  - Details: Show specific count (e.g., "1,247 usage records")
  - Red confirm button
  - Gray cancel button (default)
- [ ] Add partial clear options UI
- [ ] Write unit tests for clear operations
- **Acceptance:** Clear works with options, confirmation shown, metadata updated
- _Requirements: 6.1, 6.2, 6.3, 6.4_

### Task 6.5: Create analytics settings UI
- [ ] Create `src/components/analytics/AnalyticsSettings.tsx`
- [ ] Add toggle for trackingEnabled
- [ ] Add retention period selector (30, 90, 180, 365 days)
- [ ] Add includeCustomSites toggle
- [ ] Add anonymizeData toggle (future: anonymize platform names)
- [ ] Show storage usage (bytes, percentage)
- [ ] Add "Clear Analytics Data" button
- [ ] Add "Export Analytics" button
- [ ] Write component tests
- **Acceptance:** All settings work, storage usage shown, actions available
- _Requirements: 6.1, 6.2, 6.3_

---

## Phase 7: Testing & Optimization (2-3 days)

### Task 7.1: Write comprehensive unit tests
- [ ] AnalyticsTracker: 20+ tests
  - Batching logic (49 events, 50 events, 51 events)
  - Auto-flush timer
  - Event validation
  - Session ID generation
- [ ] AnalyticsProcessor: 30+ tests
  - Incremental aggregation
  - Trend calculation (all scenarios)
  - Time series generation (all granularities)
  - Statistics computation (all metrics)
  - Caching (hit, miss, expiry)
  - Rollup logic
- [ ] AnalyticsStorage: 25+ tests
  - Circular buffer (wraparound, overflow)
  - Quota monitoring (thresholds)
  - CRUD operations
  - Metadata management
- [ ] UI Components: 40+ tests
  - Dashboard rendering
  - Chart rendering
  - Empty states
  - Loading states
  - Error boundaries
  - User interactions
- **Target:** 90%+ code coverage for analytics module
- **Acceptance:** All tests pass, coverage target met
- _Requirements: 1.1, 1.2, 2.1, 3.1, 4.1, 5.1_

### Task 7.2: Write integration tests
- [ ] End-to-end tracking flow
  - Content script → tracker → storage → processor → dashboard
  - Test on Claude, ChatGPT, Perplexity
  - Verify data persistence
- [ ] Cross-context communication
  - Content script to background
  - Popup to background
  - Data sync between contexts
- [ ] Storage quota scenarios
  - Fill to 8 MB (warning)
  - Fill to 9.5 MB (auto-cleanup)
  - Verify cleanup works
- [ ] Export/import round-trip
  - Export data
  - Clear storage
  - Import data
  - Verify integrity
- **Acceptance:** All integration tests pass, data flows correctly
- _Requirements: 1.1, 1.2, 2.1, 3.1, 4.1, 5.1_

### Task 7.3: Performance testing and optimization
- [ ] Benchmark event capture (target: < 5ms)
- [ ] Benchmark batch write (target: < 50ms for 100 events)
- [ ] Benchmark aggregation (target: < 100ms for 100 events)
- [ ] Benchmark statistics computation (target: < 200ms for 365 days)
- [ ] Benchmark dashboard load (target: < 500ms)
- [ ] Benchmark chart render (target: < 300ms)
- [ ] Optimize slow operations if targets not met
- [ ] Test with 10,000 events dataset
- [ ] Verify storage usage (should be < 5 MB for 10,000 events)
- **Acceptance:** All performance targets met, optimizations applied
- _Requirements: 2.1, 2.2, 5.4_

### Task 7.4: User acceptance testing
- [ ] Test onboarding flow (first-time user)
- [ ] Test upgrade flow (existing user without analytics)
- [ ] Test all user stories from requirements
- [ ] Verify all acceptance criteria met
- [ ] Test on different screen sizes (popup vs sidepanel)
- [ ] Test dark mode compatibility
- [ ] Gather feedback from beta testers
- **Acceptance:** All user stories verified, feedback incorporated
- _Requirements: All_

---

## Phase 8: Polish & Documentation (1-2 days)

### Task 8.1: Implement onboarding tutorial
- [ ] Create first-time analytics onboarding
- [ ] Show tour of dashboard features
- [ ] Explain privacy ("local only")
- [ ] Set onboardingShown flag
- [ ] Add "Show Tutorial Again" option in settings
- [ ] Write tests for onboarding flow
- **Acceptance:** Tutorial shows on first visit, can be replayed
- _Requirements: 1.2, 5.1_

### Task 8.2: Add analytics insights to main UI
- [ ] Add "most used" badge to prompts in library
- [ ] Add usage trend indicators (↑↓→) to prompt cards
- [ ] Add "unused prompts" filter option
- [ ] Show category usage stats in category management
- [ ] Add "View Analytics" link from prompts
- [ ] Write component tests
- **Acceptance:** Insights visible in main UI, analytics integrated
- _Requirements: 1.2, 1.3, 4.1, 4.2, 4.3_

### Task 8.3: Error handling and edge cases
- [ ] Handle trackingEnabled = false gracefully
- [ ] Handle storage quota exceeded errors
- [ ] Handle corrupt analytics data
- [ ] Handle missing prompts (deleted after usage)
- [ ] Handle missing categories (deleted after usage)
- [ ] Add error logging for debugging
- [ ] Write tests for all error scenarios
- **Acceptance:** All edge cases handled gracefully, no crashes
- _Requirements: 5.1, 5.2, 5.3_

### Task 8.4: Update extension documentation
- [ ] Add analytics section to README
- [ ] Document privacy guarantees
- [ ] Document storage usage
- [ ] Document export/import formats
- [ ] Add screenshots of dashboard
- [ ] Update CHANGELOG
- **Acceptance:** Documentation complete and accurate
- _Requirements: All_

### Task 8.5: Final QA and release preparation
- [ ] Run full test suite (unit + integration)
- [ ] Verify all requirements met
- [ ] Test on Chrome (stable, beta)
- [ ] Verify CSP compliance
- [ ] Check bundle size (should be < 100 KB increase)
- [ ] Run linter and fix issues
- [ ] Create release notes
- [ ] Tag version (e.g., v1.5.0)
- **Acceptance:** All tests pass, ready for release
- _Requirements: All_

---

## Summary

**Total Estimated Time:** 16-20 days (3-4 weeks)

**Phase Breakdown:**
- Phase 1: Foundation (2-3 days)
- Phase 2: Storage (3-4 days)
- Phase 3: Tracker (2-3 days)
- Phase 4: Processor (3-4 days)
- Phase 5: UI (4-5 days)
- Phase 6: Data Management (2-3 days)
- Phase 7: Testing (2-3 days)
- Phase 8: Polish (1-2 days)

**Key Performance Targets:**
- Event capture: < 5ms
- Batch write: < 50ms (100 events)
- Aggregation: < 100ms (100 events)
- Stats computation: < 200ms (365 days)
- Dashboard load: < 500ms
- Chart render: < 300ms
- Storage usage: < 5 MB (10,000 events)

**Bundle Size Impact:** ~83 KB (chart libraries)

**Storage Usage:** ~240 KB typical, < 5 MB max (for 10,000 events)
