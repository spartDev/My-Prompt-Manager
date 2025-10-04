# Design Document

## Overview

This design improves the Custom Sites section UX by replacing the separate "New Custom Site" button with an integrated "Add Custom Site" card that appears alongside existing custom site cards. The design maintains visual consistency while providing a more intuitive and organized interface for managing custom sites.

## Architecture

### Component Structure

The improvement involves modifications to the existing `SiteIntegrationSection` component and potentially creating a new `AddCustomSiteCard` component that follows the same visual pattern as `SiteCard`.

### Current State Analysis

**Current Implementation:**
- Empty state: Shows a card with "Add Custom Site" button when no custom sites exist
- With custom sites: Shows custom site cards + separate "New Custom Site" button under section title
- Button triggers `setShowAddMethodChooser(true)` to show add method selection

**Proposed Implementation:**
- Empty state: Unchanged (existing card with button)
- With custom sites: Shows custom site cards + "Add Custom Site" card (no separate button)
- Card triggers the same `setShowAddMethodChooser(true)` functionality

## Components and Interfaces

### AddCustomSiteCard Component

```typescript
interface AddCustomSiteCardProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}
```

**Visual Design:**
- Same card structure as `SiteCard` (rounded-xl border, padding, etc.)
- Distinctive styling to indicate it's an action card, not a configured site
- Plus icon instead of site icon
- "Add Custom Site" title
- Descriptive subtitle
- Hover and focus states
- No toggle switch (replaced with click-to-add interaction)

### SiteIntegrationSection Modifications

**Conditional Rendering Logic:**
```typescript
const showAddButton = customSites.length === 0;
const showAddCard = customSites.length > 0;
```

**Grid Layout:**
- Custom sites render in existing grid
- Add card appears as final grid item when `showAddCard` is true
- Maintains responsive grid behavior (1 column on mobile, 2 on larger screens)

## Data Models

No new data models required. The component will use existing state management:
- `customSites` array to determine when to show the add card
- `setShowAddMethodChooser` function for triggering add flow
- Existing disabled state logic for current site integration

## Error Handling

**Disabled States:**
- Add card should be disabled when `isCurrentSiteIntegrated` is true (same logic as current button)
- Visual feedback should match current button disabled state
- Tooltip should explain why adding is disabled

**Accessibility:**
- Proper ARIA labels for screen readers
- Keyboard navigation support
- Focus management consistent with existing cards

## Testing Strategy

### Unit Tests
1. **Conditional Rendering Tests:**
   - Verify add card appears only when `customSites.length > 0`
   - Verify button appears only when `customSites.length === 0`
   - Test with various custom site array lengths

2. **Interaction Tests:**
   - Click handler triggers correct function
   - Disabled state prevents interaction
   - Keyboard navigation works correctly

3. **Visual State Tests:**
   - Hover states apply correctly
   - Focus states are visible
   - Disabled styling is applied appropriately

### Integration Tests
1. **Grid Layout Tests:**
   - Add card positions correctly in grid
   - Responsive behavior matches other cards
   - Grid maintains proper spacing and alignment

2. **Workflow Tests:**
   - Add card triggers same flow as current button
   - State transitions work correctly
   - No regression in existing functionality

### Visual Regression Tests
1. **Screenshot Comparisons:**
   - Empty state remains unchanged
   - Grid with add card matches design specifications
   - Responsive layouts render correctly

## Implementation Approach

### Phase 1: Create AddCustomSiteCard Component
- Design card component with proper styling
- Implement hover/focus/disabled states
- Add accessibility attributes
- Create unit tests

### Phase 2: Integrate with SiteIntegrationSection
- Add conditional rendering logic
- Remove button when custom sites exist
- Position add card in grid
- Update existing tests

### Phase 3: Styling and Polish
- Ensure visual consistency with existing cards
- Fine-tune spacing and alignment
- Test responsive behavior
- Validate accessibility compliance

## Visual Design Specifications

### AddCustomSiteCard Styling

**Base Card:**
```css
/* Same base structure as SiteCard */
.add-custom-site-card {
  @apply relative p-4 rounded-xl border transition-all duration-200;
  @apply border-gray-200 dark:border-gray-700;
  @apply bg-white dark:bg-gray-800;
  @apply hover:shadow-sm hover:border-purple-300 dark:hover:border-purple-600;
  @apply cursor-pointer;
}

/* Disabled state */
.add-custom-site-card:disabled {
  @apply bg-gray-100 dark:bg-gray-700;
  @apply border-gray-300 dark:border-gray-600;
  @apply cursor-not-allowed;
}
```

**Icon Styling:**
```css
.add-icon {
  @apply w-10 h-10 rounded-lg flex items-center justify-center;
  @apply bg-purple-100 dark:bg-purple-900/40;
  @apply text-purple-600 dark:text-purple-400;
  @apply transition-colors duration-200;
}

.add-custom-site-card:hover .add-icon {
  @apply bg-purple-200 dark:bg-purple-800/60;
}
```

**Content Layout:**
- Same flex structure as SiteCard
- Icon + content area + action area (empty for add card)
- Title: "Add Custom Site"
- Subtitle: "Configure a new AI platform integration"

### Grid Integration

**Current Grid:**
```jsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
  {customSites.map(site => <SiteCard key={site.hostname} ... />)}
</div>
```

**Updated Grid:**
```jsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
  {customSites.map(site => <SiteCard key={site.hostname} ... />)}
  {showAddCard && <AddCustomSiteCard onClick={handleAddClick} disabled={isDisabled} />}
</div>
```

## Accessibility Considerations

### ARIA Labels
- `role="button"` for the add card
- `aria-label="Add new custom site integration"`
- `aria-describedby` for additional context
- `aria-disabled` for disabled state

### Keyboard Navigation
- Tab order includes add card in natural sequence
- Enter/Space key activation
- Focus indicators match existing card focus styles

### Screen Reader Support
- Descriptive text for card purpose
- Status announcements for disabled state
- Proper heading hierarchy maintenance

## Browser Compatibility

No new browser compatibility concerns. The implementation uses existing CSS classes and React patterns already validated in the current codebase.

## Performance Considerations

**Minimal Impact:**
- Single additional component render when custom sites exist
- No new API calls or data fetching
- Reuses existing styling and interaction patterns
- No impact on existing performance metrics