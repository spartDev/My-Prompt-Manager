# Requirements Document

## Introduction

This feature improves the user experience and visual consistency of the Custom Sites section in the settings view. Currently, when no custom sites exist, a card appears with an "Add Custom Site" button. When custom sites are added, they appear as cards, but the add functionality remains as a separate button under the section title. This creates visual inconsistency and suboptimal UX. The improvement will make the "Add Custom Site" functionality appear as a card that matches the visual style of existing custom site cards when at least one custom site exists, while removing the separate button under the section title.

## Requirements

### Requirement 1

**User Story:** As a user with existing custom sites, I want the "Add Custom Site" option to appear as a card similar to my existing custom site cards, so that the interface feels consistent and organized.

#### Acceptance Criteria

1. WHEN I have at least one custom site configured THEN the system SHALL display an "Add Custom Site" card alongside the existing custom site cards
2. WHEN I view the "Add Custom Site" card THEN it SHALL have the same visual structure and styling as existing custom site cards
3. WHEN I view the "Add Custom Site" card THEN it SHALL display an appropriate icon, title, and description indicating its purpose
4. WHEN I click on the "Add Custom Site" card THEN it SHALL trigger the same functionality as the current "New Custom Site" button
5. WHEN I have no custom sites configured THEN the system SHALL continue to show the existing empty state card with the add button

### Requirement 2

**User Story:** As a user managing custom sites, I want the interface to be clean and uncluttered, so that I can focus on the site cards without redundant controls.

#### Acceptance Criteria

1. WHEN I have at least one custom site configured THEN the system SHALL NOT display the "New Custom Site" button under the Custom Sites section title
2. WHEN I have no custom sites configured THEN the system SHALL continue to show the existing empty state with the add button
3. WHEN viewing the custom sites section THEN all add functionality SHALL be consolidated into the card-based interface
4. WHEN the "Add Custom Site" card is displayed THEN it SHALL be visually distinguishable from actual custom site cards while maintaining design consistency

### Requirement 3

**User Story:** As a user interacting with the "Add Custom Site" card, I want it to provide clear visual feedback and accessibility, so that I understand its purpose and can use it effectively.

#### Acceptance Criteria

1. WHEN I hover over the "Add Custom Site" card THEN it SHALL provide appropriate hover states and visual feedback
2. WHEN I focus on the "Add Custom Site" card using keyboard navigation THEN it SHALL display proper focus indicators
3. WHEN viewing the "Add Custom Site" card THEN it SHALL include appropriate ARIA labels and accessibility attributes
4. WHEN the "Add Custom Site" card is displayed THEN it SHALL use iconography and text that clearly indicates its function
5. WHEN I interact with the "Add Custom Site" card THEN it SHALL maintain the same disabled states and loading behaviors as the current button implementation

### Requirement 4

**User Story:** As a user with multiple custom sites, I want the "Add Custom Site" card to be positioned appropriately within the grid, so that it feels like a natural part of the interface.

#### Acceptance Criteria

1. WHEN custom sites are displayed in a grid layout THEN the "Add Custom Site" card SHALL be positioned as the last item in the grid
2. WHEN custom sites are displayed THEN the "Add Custom Site" card SHALL maintain the same responsive behavior as other site cards
3. WHEN the grid layout changes due to screen size THEN the "Add Custom Site" card SHALL adapt consistently with other cards
4. WHEN there are many custom sites THEN the "Add Custom Site" card SHALL remain easily discoverable and accessible
5. WHEN custom sites are sorted or filtered THEN the "Add Custom Site" card SHALL maintain its position as the final item