# Requirements Document

## Introduction

The Smart Prompt Templates with Variables feature will allow users to create dynamic prompts with placeholder variables that can be filled in before insertion into AI platforms. This feature transforms static prompts into reusable templates, enabling users to create more flexible and personalized prompts while maintaining consistency in structure and tone. Users will be able to define variables within their prompts and fill them out through an intuitive interface before the prompt is inserted into the AI chat interface.

## Requirements

### Requirement 1

**User Story:** As a prompt library user, I want to create prompts with placeholder variables, so that I can reuse the same prompt structure with different specific details.

#### Acceptance Criteria

1. WHEN a user creates or edits a prompt THEN the system SHALL allow them to define variables using double curly brace syntax {{variable_name}}
2. WHEN a prompt contains variables THEN the system SHALL validate variable names contain only letters, numbers, and underscores
3. WHEN a user saves a prompt with variables THEN the system SHALL store the template and extract variable definitions
4. IF a variable name is invalid THEN the system SHALL show an error message and prevent saving until corrected

### Requirement 2

**User Story:** As a user inserting a template prompt, I want to fill in the variable values through a form interface, so that I can customize the prompt before it's inserted into the AI platform.

#### Acceptance Criteria

1. WHEN a user clicks to insert a prompt with variables THEN the system SHALL display a variable input form before insertion
2. WHEN the variable form is displayed THEN the system SHALL show each variable with a labeled input field
3. WHEN a user fills in all required variables THEN the system SHALL enable the "Insert Prompt" button
4. WHEN a user submits the form THEN the system SHALL replace all variables with the provided values and insert the final prompt
5. IF a user cancels the variable form THEN the system SHALL not insert the prompt and return to the previous state

### Requirement 3

**User Story:** As a template creator, I want to define different types of variables (text, dropdown, number), so that I can provide appropriate input controls for different kinds of data.

#### Acceptance Criteria

1. WHEN defining a variable THEN the system SHALL support text type as the default ({{variable_name}})
2. WHEN defining a dropdown variable THEN the system SHALL support syntax {{variable_name|option1,option2,option3}}
3. WHEN defining a number variable THEN the system SHALL support syntax {{variable_name:number}}
4. WHEN a dropdown variable is used THEN the system SHALL display a select dropdown with the specified options
5. WHEN a number variable is used THEN the system SHALL display a number input field with validation

### Requirement 4

**User Story:** As a user working with templates, I want to set default values for variables, so that I can speed up the form filling process for commonly used values.

#### Acceptance Criteria

1. WHEN defining a variable THEN the system SHALL support default value syntax {{variable_name=default_value}}
2. WHEN a variable form is displayed THEN the system SHALL pre-populate fields with default values
3. WHEN a user modifies a default value THEN the system SHALL use the new value for that insertion
4. IF no default is specified THEN the system SHALL leave the input field empty

### Requirement 5

**User Story:** As a template user, I want to mark certain variables as required, so that I'm prevented from inserting incomplete prompts.

#### Acceptance Criteria

1. WHEN defining a variable THEN the system SHALL support required syntax {{variable_name*}} for required fields
2. WHEN a variable form is displayed THEN the system SHALL mark required fields with visual indicators (asterisk)
3. WHEN a user attempts to insert with empty required fields THEN the system SHALL show validation errors and prevent insertion
4. WHEN all required fields are filled THEN the system SHALL allow insertion to proceed

### Requirement 6

**User Story:** As a power user, I want to save frequently used variable combinations as presets, so that I can quickly reuse common configurations.

#### Acceptance Criteria

1. WHEN a user fills out a variable form THEN the system SHALL provide an option to "Save as Preset"
2. WHEN saving a preset THEN the system SHALL prompt for a preset name and store the variable values
3. WHEN opening a variable form for a template with saved presets THEN the system SHALL show a dropdown to load presets
4. WHEN a user selects a preset THEN the system SHALL populate all form fields with the preset values
5. IF a template has no saved presets THEN the system SHALL not show the preset dropdown

### Requirement 7

**User Story:** As a template creator, I want to add descriptions and help text to variables, so that other users understand what each variable is for.

#### Acceptance Criteria

1. WHEN defining a variable THEN the system SHALL support description syntax {{variable_name|description:"Help text here"}}
2. WHEN a variable form is displayed THEN the system SHALL show help text below or next to each variable input
3. WHEN help text is long THEN the system SHALL truncate it with a "show more" option
4. IF no description is provided THEN the system SHALL show only the variable name as the label

### Requirement 8

**User Story:** As a user managing templates, I want to see which prompts are templates in the library view, so that I can easily identify and organize my dynamic prompts.

#### Acceptance Criteria

1. WHEN viewing the prompt library THEN the system SHALL display a template icon/badge on prompts containing variables
2. WHEN filtering prompts THEN the system SHALL provide a "Templates Only" filter option
3. WHEN searching prompts THEN the system SHALL allow searching by variable names within templates
4. WHEN viewing template details THEN the system SHALL show a preview of the template with variable placeholders highlighted

### Requirement 9

**User Story:** As a user sharing templates, I want to export and import templates with their variable definitions, so that I can share dynamic prompts with others.

#### Acceptance Criteria

1. WHEN exporting prompts THEN the system SHALL preserve variable definitions and metadata in the export format
2. WHEN importing templates THEN the system SHALL validate variable syntax and restore template functionality
3. WHEN sharing a template configuration THEN the system SHALL include variable types, defaults, and descriptions
4. IF imported template has invalid variable syntax THEN the system SHALL show validation errors and allow manual correction