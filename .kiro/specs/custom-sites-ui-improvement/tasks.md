# Implementation Plan

- [ ] 1. Create AddCustomSiteCard component
  - Create new component file `src/components/settings/AddCustomSiteCard.tsx`
  - Implement component interface with onClick, disabled, and className props
  - Add proper TypeScript types and interfaces
  - _Requirements: 1.2, 1.3, 3.4_

- [ ] 2. Implement AddCustomSiteCard styling and structure
  - Create card layout matching SiteCard visual structure (icon + content + action area)
  - Add plus icon with purple theming to match design specifications
  - Implement "Add Custom Site" title and descriptive subtitle text
  - Apply base card styling with proper spacing and borders
  - _Requirements: 1.2, 1.3, 3.4_

- [ ] 3. Add interactive states to AddCustomSiteCard
  - Implement hover states with border color changes and shadow effects
  - Add focus states with proper focus indicators for keyboard navigation
  - Create disabled state styling with grayed-out appearance
  - Add cursor pointer for enabled state and not-allowed for disabled state
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 4. Implement accessibility features for AddCustomSiteCard
  - Add proper ARIA attributes (role="button", aria-label, aria-disabled)
  - Implement keyboard event handlers for Enter and Space key activation
  - Add descriptive text for screen readers explaining the card's purpose
  - Ensure proper tab order and focus management
  - _Requirements: 3.2, 3.3_

- [ ] 5. Add conditional rendering logic to SiteIntegrationSection
  - Create boolean variables to determine when to show add button vs add card
  - Implement logic: show button when customSites.length === 0, show card when > 0
  - Add conditional rendering around existing "New Custom Site" button
  - Ensure existing empty state behavior remains unchanged
  - _Requirements: 1.1, 1.5, 2.1, 2.2_

- [ ] 6. Integrate AddCustomSiteCard into custom sites grid
  - Import AddCustomSiteCard component in SiteIntegrationSection
  - Add AddCustomSiteCard as final item in existing custom sites grid
  - Pass appropriate props (onClick handler, disabled state, styling)
  - Ensure grid layout maintains responsive behavior with new card
  - _Requirements: 1.1, 4.1, 4.2, 4.5_

- [ ] 7. Connect AddCustomSiteCard click handler to existing functionality
  - Wire AddCustomSiteCard onClick to existing setShowAddMethodChooser function
  - Ensure same disabled logic applies (isCurrentSiteIntegrated check)
  - Add same tooltip functionality for disabled state explanation
  - Verify click behavior matches current "New Custom Site" button exactly
  - _Requirements: 1.4, 2.3, 3.5_

- [ ] 8. Remove redundant "New Custom Site" button when cards exist
  - Wrap existing button in conditional rendering based on customSites.length
  - Ensure button only appears when customSites array is empty
  - Maintain all existing button functionality for empty state
  - Test that button removal doesn't break existing workflows
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 9. Create unit tests for AddCustomSiteCard component
  - Test component renders with correct props and styling
  - Test onClick handler is called when card is clicked
  - Test disabled state prevents click events and shows proper styling
  - Test keyboard navigation (Enter/Space key handling)
  - Test accessibility attributes are properly applied
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 10. Create integration tests for conditional rendering logic
  - Test add card appears only when customSites.length > 0
  - Test add button appears only when customSites.length === 0
  - Test grid layout with various numbers of custom sites
  - Test responsive behavior of grid with add card included
  - Test that existing functionality is not broken by changes
  - _Requirements: 1.1, 1.5, 2.1, 4.1, 4.2_

- [ ] 11. Add visual regression tests and styling validation
  - Test hover states apply correctly on AddCustomSiteCard
  - Test focus indicators are visible and properly styled
  - Test disabled state styling matches design specifications
  - Verify grid alignment and spacing with add card present
  - Test responsive layout behavior across different screen sizes
  - _Requirements: 3.1, 4.2, 4.3_

- [ ] 12. Update existing SiteIntegrationSection tests
  - Modify existing tests to account for new conditional rendering logic
  - Update test assertions for button visibility based on customSites length
  - Add test coverage for AddCustomSiteCard integration
  - Ensure all existing test cases continue to pass
  - Add edge case testing for empty and populated custom sites arrays
  - _Requirements: 1.5, 2.1, 2.2_