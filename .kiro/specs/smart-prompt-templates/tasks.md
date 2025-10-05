# Implementation Plan - Smart Prompt Templates with Variables

## Phase 1: Foundation & Type Definitions (1-2 days)

### Task 1.1: Create template type definitions
- [ ] Create `src/types/templates.ts` with core interfaces
  - `PromptTemplate` extending existing `Prompt` interface
  - `TemplateVariable` with name, type, required, defaultValue, description, options
  - `VariableValidation` with minLength, maxLength, pattern, min, max
  - `TemplatePreset` with id, name, values, createdAt, lastUsed
  - `VariableFormData` for form state management
  - `TemplateRenderResult` and `TemplateError` for processing results
- [ ] Add template error types to `src/types/errors.ts`
  - `TemplateErrorType` enum (INVALID_SYNTAX, MISSING_VARIABLE, etc.)
  - `TemplateError` interface extending `AppError`
- [ ] Export template types from `src/types/index.ts`
- [ ] Write unit tests for type guards and validation functions
- **Acceptance:** All TypeScript types compile without errors, 100% type coverage
- _Requirements: 1.1, 1.2, 1.3, 1.4_

### Task 1.2: Extend existing Prompt interface for templates
- [ ] Modify `src/types/index.ts` to extend Prompt interface
  - Add optional `isTemplate: boolean` field
  - Add optional `templateContent: string` field (original with {{}} syntax)
  - Add optional `variables: TemplateVariable[]` field
  - Add optional `templateVersion: string` field for future migrations
- [ ] Update `StorageData` interface to include template storage
  - Add `template_presets: Record<string, TemplatePreset[]>`
  - Add `template_settings: TemplateSettings`
- [ ] Write migration helper for existing prompts
- [ ] Write unit tests for extended interfaces
- **Acceptance:** Existing prompts remain compatible, new template fields available
- _Requirements: 8.1, 9.1, 9.2_

---

## Phase 2: Template Parser Service (2-3 days)

### Task 2.1: Create TemplateParser service with regex-based parsing
- [ ] Create `src/services/TemplateParser.ts` as singleton
- [ ] Implement variable detection regex: `/\{\{([^}]+)\}\}/g`
- [ ] Create `parseTemplate(content: string)` method
  - Extract all {{}} patterns from content
  - Return `TemplateParseResult` with variables and errors
  - Determine if content is a template (has valid variables)
- [ ] Create `extractVariables(content: string)` method
  - Parse each variable definition
  - Handle syntax variations (name, type, required, default, options, description)
  - Return array of `TemplateVariable` objects
- [ ] Write comprehensive unit tests for parsing logic
- **Performance Target:** Parse template with 10 variables in < 20ms
- **Acceptance:** All supported syntax variations parsed correctly
- _Requirements: 1.1, 1.2, 1.3, 1.4_

### Task 2.2: Implement variable definition parsing
- [ ] Create `parseVariableDefinition(definition: string)` method
  - Parse variable name (required, alphanumeric + underscore)
  - Parse type specification (`:number`, `:textarea`)
  - Parse required marker (`*`)
  - Parse default value (`=default_value`)
  - Parse dropdown options (`|option1,option2,option3`)
  - Parse description (`|description:"Help text"`)
- [ ] Implement syntax validation patterns
  - Variable name: `/^[a-zA-Z_][a-zA-Z0-9_]*$/`
  - Type: `/:([a-zA-Z]+)/`
  - Required: `/\*/`
  - Default: `/=([^|]*)/`
  - Options: `/\|([^|]*?)(?:\|description:|$)/`
  - Description: `/description:"([^"]*?)"/`
- [ ] Add error handling for malformed syntax
- [ ] Write unit tests for all syntax combinations
- **Acceptance:** All syntax variations parsed correctly, errors handled gracefully
- _Requirements: 1.2, 1.3, 1.4, 3.1, 3.2, 3.3, 4.1, 7.1, 7.2_

### Task 2.3: Add template validation
- [ ] Create `validateTemplateSyntax(content: string)` method
  - Check for unclosed variables (`{{` without `}}`)
  - Validate variable names (no spaces, special chars, reserved words)
  - Check for duplicate variable names
  - Validate type specifications
  - Ensure dropdown options are properly formatted
- [ ] Create validation rules configuration
  - Max variables per template: 20
  - Max variable name length: 50
  - Reserved variable names: ['template', 'preset', 'system']
  - Max content length: 10,000 characters
- [ ] Add warning detection (non-breaking issues)
  - Variables without descriptions
  - Very long variable names
  - Too many dropdown options (>10)
- [ ] Write unit tests for validation edge cases
- **Acceptance:** Invalid templates rejected with clear error messages
- _Requirements: 1.4, 7.1, 7.2_

### Task 2.4: Implement template content sanitization
- [ ] Create `sanitizeVariableValue(value: string)` method
  - Remove potentially dangerous characters (`<`, `>`, `{`, `}`)
  - Limit value length to 1000 characters
  - Trim whitespace
  - Escape special characters for safe insertion
- [ ] Create `sanitizeOptions(options: string)` method for dropdown
  - Split by comma and trim each option
  - Remove empty options
  - Limit to 20 options maximum
  - Sanitize each option value
- [ ] Add input validation for variable names
  - Prevent injection attacks
  - Ensure compatibility with storage keys
- [ ] Write security-focused unit tests
- **Acceptance:** All user input sanitized, no injection vulnerabilities
- _Requirements: 1.4, 3.2, 3.3_

---

## Phase 3: Template Renderer Service (2-3 days)

### Task 3.1: Create TemplateRenderer service
- [ ] Create `src/services/TemplateRenderer.ts` as singleton
- [ ] Implement `renderTemplate(template: PromptTemplate, values: Record<string, string>)` method
  - Replace all {{variable_name}} with provided values
  - Handle missing variables (show error or use defaults)
  - Apply type-specific formatting
  - Return `TemplateRenderResult` with success status and content
- [ ] Create `replaceVariables(content: string, values: Record<string, string>)` method
  - Use string replacement for each variable
  - Preserve original content structure
  - Handle edge cases (variables in variables, special characters)
- [ ] Write unit tests for rendering logic
- **Performance Target:** Render template with 10 variables in < 5ms
- **Acceptance:** Variables replaced accurately, performance target met
- _Requirements: 2.1, 2.2, 2.3, 2.4_

### Task 3.2: Implement variable value validation
- [ ] Create `validateVariableValues(template: PromptTemplate, values: Record<string, string>)` method
  - Check required variables are provided
  - Validate number variables are numeric
  - Check dropdown values are in allowed options
  - Apply min/max length validation for text
  - Apply min/max value validation for numbers
- [ ] Create `ValidationResult` interface with errors array
- [ ] Implement field-specific validation rules
  - Text: minLength, maxLength, pattern matching
  - Number: min, max, integer vs decimal
  - Dropdown: value must be in options list
  - Textarea: same as text but allow newlines
- [ ] Write comprehensive validation tests
- **Acceptance:** All validation rules enforced, clear error messages
- _Requirements: 2.3, 2.4, 5.1, 5.2, 5.3_

### Task 3.3: Add type-specific value formatting
- [ ] Create `formatVariableValue(variable: TemplateVariable, value: string)` method
  - Text: trim whitespace, apply max length
  - Number: format as integer or decimal, apply min/max
  - Dropdown: ensure value is from options list
  - Textarea: preserve line breaks, trim excess whitespace
- [ ] Handle default values when user input is empty
  - Apply defaults before validation
  - Respect required field rules even with defaults
- [ ] Add value transformation for special cases
  - Convert number strings to proper format
  - Handle boolean-like values for dropdowns
- [ ] Write unit tests for all formatting scenarios
- **Acceptance:** Values formatted correctly for each type, defaults applied
- _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2_

### Task 3.4: Implement error handling and recovery
- [ ] Add graceful error handling for render failures
  - Missing variables: use placeholder or show error
  - Invalid values: show validation message
  - Malformed template: fall back to original content
- [ ] Create user-friendly error messages
  - "Variable 'project_name' is required"
  - "Value must be between 1 and 10"
  - "Please select from available options"
- [ ] Add error recovery options
  - Allow partial rendering with warnings
  - Provide suggestions for fixing errors
- [ ] Write error handling tests
- **Acceptance:** All error scenarios handled gracefully, helpful messages
- _Requirements: 2.3, 2.4, 5.1, 5.2, 5.3_

---

## Phase 4: Template Preset Management (2-3 days)

### Task 4.1: Create TemplatePresetManager service
- [ ] Create `src/services/TemplatePresetManager.ts` extending `StorageManager`
- [ ] Implement `getPresetsForTemplate(templateId: string)` method
  - Retrieve presets from `template_presets[templateId]`
  - Sort by lastUsed (most recent first)
  - Return array of `TemplatePreset` objects
- [ ] Implement `savePreset(templateId: string, preset: Omit<TemplatePreset, 'id' | 'createdAt'>)` method
  - Generate unique preset ID
  - Set createdAt timestamp
  - Store in template_presets storage
  - Return created preset with ID
- [ ] Add preset validation before saving
  - Ensure preset name is unique per template
  - Validate variable values match template requirements
- [ ] Write unit tests for CRUD operations
- **Acceptance:** Presets stored and retrieved correctly, validation works
- _Requirements: 6.1, 6.2, 6.3, 6.4_

### Task 4.2: Implement preset CRUD operations
- [ ] Implement `updatePreset(presetId: string, updates: Partial<TemplatePreset>)` method
  - Find preset across all templates
  - Apply updates while preserving ID and createdAt
  - Update storage
- [ ] Implement `deletePreset(presetId: string)` method
  - Find and remove preset from storage
  - Update template_presets storage
- [ ] Implement `markPresetUsed(presetId: string)` method
  - Update lastUsed timestamp
  - Increment usage counter for analytics
- [ ] Add batch operations for efficiency
  - Delete multiple presets
  - Update multiple presets
- [ ] Write comprehensive CRUD tests
- **Acceptance:** All CRUD operations work correctly, storage updated properly
- _Requirements: 6.1, 6.2, 6.3, 6.4_

### Task 4.3: Add preset cleanup and management
- [ ] Implement `cleanupUnusedPresets()` method
  - Find presets older than 90 days with no usage
  - Remove presets exceeding max limit per template (10)
  - Keep most recently used presets
- [ ] Implement `getRecentPresets(templateId: string, limit: number)` method
  - Return most recently used presets
  - Default limit of 5 for quick access
- [ ] Add preset storage quota management
  - Monitor preset storage usage
  - Warn when approaching limits
  - Auto-cleanup when necessary
- [ ] Create preset analytics tracking
  - Track preset usage frequency
  - Identify most popular presets
- [ ] Write cleanup and management tests
- **Acceptance:** Cleanup works correctly, storage managed efficiently
- _Requirements: 6.1, 6.2, 6.3, 6.4_

### Task 4.4: Implement preset import/export
- [ ] Add preset data to existing export functionality
  - Include presets in prompt export format
  - Maintain preset-template relationships
- [ ] Implement preset import validation
  - Ensure imported presets match template variables
  - Handle preset name conflicts
  - Validate preset values against template requirements
- [ ] Add preset-only export/import options
  - Export presets for specific templates
  - Import presets without overwriting existing ones
- [ ] Write import/export tests
- **Acceptance:** Presets included in export/import, validation works
- _Requirements: 9.1, 9.2, 9.3, 9.4_

---

## Phase 5: UI Components - Variable Form (3-4 days)

### Task 5.1: Create VariableFormModal component
- [ ] Create `src/components/templates/VariableFormModal.tsx`
- [ ] Implement modal structure with proper ARIA attributes
  - Modal overlay with backdrop click to close
  - Header with template name and "Fill Variables" title
  - Body with variable form and preset selector
  - Footer with Cancel, Save Preset, Insert buttons
- [ ] Add modal state management
  - Open/close state
  - Form data state
  - Validation state
  - Loading states
- [ ] Implement keyboard navigation
  - Tab order through form fields
  - Escape key to close
  - Enter key to submit (when valid)
- [ ] Add responsive design for different screen sizes
- [ ] Write component tests for modal behavior
- **Acceptance:** Modal opens/closes correctly, keyboard accessible, responsive
- _Requirements: 2.1, 2.2, 2.3, 2.4_

### Task 5.2: Create VariableInput component for different types
- [ ] Create `src/components/templates/VariableInput.tsx`
- [ ] Implement text input type (default)
  - Standard text input with validation
  - Show character count for maxLength
  - Real-time validation with debouncing (300ms)
- [ ] Implement number input type
  - Number input with min/max validation
  - Step controls for integer values
  - Format validation (integer vs decimal)
- [ ] Implement dropdown input type
  - Select dropdown with options from template
  - Search/filter for long option lists
  - Custom option validation
- [ ] Implement textarea input type
  - Multi-line text area (3-4 rows)
  - Auto-resize based on content
  - Character count display
- [ ] Add common input features
  - Required field indicators (asterisk)
  - Error message display
  - Help text/description display
  - Disabled state support
- [ ] Write component tests for all input types
- **Acceptance:** All input types work correctly, validation shown, accessible
- _Requirements: 3.1, 3.2, 3.3, 5.1, 5.2, 7.1, 7.2_

### Task 5.3: Implement form validation and error handling
- [ ] Add real-time validation to VariableInput components
  - Debounced validation (300ms after user stops typing)
  - Visual error indicators (red border, error icon)
  - Error message display below input
- [ ] Create form-level validation
  - Check all required fields are filled
  - Validate all field values meet requirements
  - Show summary of validation errors
- [ ] Implement validation error messages
  - "This field is required"
  - "Value must be between X and Y"
  - "Please select from available options"
  - "Maximum length is X characters"
- [ ] Add form submission prevention when invalid
  - Disable Insert button when form has errors
  - Show validation summary on submit attempt
  - Focus first invalid field
- [ ] Write validation tests for all scenarios
- **Acceptance:** Validation works in real-time, clear error messages, submission blocked when invalid
- _Requirements: 5.1, 5.2, 5.3_

### Task 5.4: Create PresetSelector component
- [ ] Create `src/components/templates/PresetSelector.tsx`
- [ ] Implement preset dropdown
  - Show preset names with descriptions
  - Display creation date and last used
  - "No presets" state when empty
- [ ] Add preset loading functionality
  - Load preset values into form
  - Show confirmation if form has unsaved changes
  - Clear form option (reset to defaults)
- [ ] Implement preset management actions
  - Delete preset with confirmation
  - Rename preset inline
  - Duplicate preset option
- [ ] Add preset creation flow
  - "Save as Preset" button in form
  - Preset name input with validation
  - Optional description field
- [ ] Write component tests for preset operations
- **Acceptance:** Presets load correctly, management actions work, creation flow smooth
- _Requirements: 6.1, 6.2, 6.3, 6.4_

### Task 5.5: Integrate form with template rendering
- [ ] Connect VariableFormModal to TemplateRenderer service
  - Pass form values to renderer on submit
  - Handle rendering errors and display to user
  - Show preview of rendered template (optional)
- [ ] Implement form submission flow
  - Validate all fields before submission
  - Render template with form values
  - Insert rendered content into AI platform
  - Close modal on successful insertion
- [ ] Add loading states during processing
  - Show spinner during template rendering
  - Disable form during submission
  - Handle timeout scenarios
- [ ] Implement error recovery
  - Show rendering errors in modal
  - Allow user to fix errors and retry
  - Provide fallback to raw template
- [ ] Write integration tests for full flow
- **Acceptance:** Form submits correctly, template rendered and inserted, errors handled
- _Requirements: 2.1, 2.2, 2.3, 2.4_

---

## Phase 6: UI Components - Template Indicators (2-3 days)

### Task 6.1: Create TemplateIndicator component
- [ ] Create `src/components/templates/TemplateIndicator.tsx`
- [ ] Design template badge/icon
  - Use `{{}}` symbol or template icon
  - Blue/purple color to distinguish from regular prompts
  - Show variable count (e.g., "Template (3)")
  - Small, medium, large size variants
- [ ] Implement tooltip on hover
  - "Template with X variables"
  - List variable names in tooltip
  - Show if template has presets
- [ ] Add accessibility features
  - Proper ARIA labels
  - Screen reader friendly text
  - High contrast support
- [ ] Write component tests for all variants
- **Acceptance:** Template indicator visible, informative tooltip, accessible
- _Requirements: 8.1, 8.2, 8.3_

### Task 6.2: Integrate template indicators into existing UI
- [ ] Add TemplateIndicator to PromptCard component
  - Show indicator when prompt.isTemplate is true
  - Position in top-right corner of card
  - Don't interfere with existing card actions
- [ ] Add template indicators to prompt list views
  - Show in library view
  - Show in search results
  - Show in category views
- [ ] Update prompt creation/editing UI
  - Show template status in edit form
  - Allow toggling template mode
  - Show variable count in editor
- [ ] Add template filter to prompt library
  - "Templates Only" filter option
  - "Regular Prompts Only" filter option
  - Show template count in filter label
- [ ] Write integration tests for UI updates
- **Acceptance:** Indicators shown in all relevant views, filtering works
- _Requirements: 8.1, 8.2, 8.3, 8.4_

### Task 6.3: Create TemplatePreview component
- [ ] Create `src/components/templates/TemplatePreview.tsx`
- [ ] Implement template content preview
  - Show template content with variables highlighted
  - Use different color/style for variable placeholders
  - Truncate long content with "show more" option
- [ ] Add variable list display
  - Show all variables with their types
  - Indicate required vs optional variables
  - Show default values when present
- [ ] Implement syntax highlighting
  - Highlight {{}} syntax in different color
  - Show invalid syntax in red
  - Provide hover details for variables
- [ ] Add preview modes
  - Raw template view (with {{}} syntax)
  - Rendered preview with sample values
  - Variable list only view
- [ ] Write component tests for preview functionality
- **Acceptance:** Template preview clear and informative, syntax highlighted
- _Requirements: 8.4, 7.1, 7.2_

### Task 6.4: Update prompt editing UI for templates
- [ ] Modify AddPromptForm and EditPromptForm components
  - Add template mode toggle
  - Show variable detection in real-time
  - Display parsed variables list
  - Show template validation errors
- [ ] Add template syntax help
  - Help text explaining {{}} syntax
  - Examples of different variable types
  - Link to documentation
- [ ] Implement template conversion
  - Convert regular prompt to template
  - Convert template back to regular prompt
  - Warn about data loss during conversion
- [ ] Add template validation in editor
  - Real-time syntax validation
  - Show parsing errors inline
  - Suggest fixes for common mistakes
- [ ] Write tests for editing UI updates
- **Acceptance:** Template editing smooth, validation helpful, conversion works
- _Requirements: 1.1, 1.2, 1.3, 1.4_

---

## Phase 7: Integration with Existing Systems (2-3 days)

### Task 7.1: Integrate template detection into prompt insertion
- [ ] Modify content script insertion logic
  - Check if prompt is template before insertion
  - Show variable form modal for templates
  - Insert rendered content for regular prompts
- [ ] Update PlatformInsertionManager
  - Add template detection method
  - Handle template vs regular prompt insertion
  - Ensure compatibility with all platforms (Claude, ChatGPT, Perplexity)
- [ ] Add template support to popup insertion
  - Show variable form in popup context
  - Handle modal sizing in popup
  - Maintain insertion flow consistency
- [ ] Update sidepanel insertion
  - Full variable form experience in sidepanel
  - Better space utilization for forms
  - Preset management in sidepanel
- [ ] Write integration tests for all insertion contexts
- **Acceptance:** Templates detected correctly, variable forms shown, insertion works across all platforms
- _Requirements: 2.1, 2.2, 2.3, 2.4_

### Task 7.2: Update storage and data management
- [ ] Extend StorageManager for template data
  - Add template-specific storage methods
  - Handle template preset storage
  - Maintain backwards compatibility
- [ ] Update prompt export/import functionality
  - Include template data in exports
  - Handle template imports with validation
  - Preserve preset relationships
- [ ] Add template data to backup/restore
  - Include templates in data backups
  - Restore template functionality correctly
  - Handle version compatibility
- [ ] Update data cleanup procedures
  - Clean up orphaned presets
  - Remove invalid template data
  - Maintain storage efficiency
- [ ] Write storage integration tests
- **Acceptance:** Template data stored correctly, export/import works, cleanup maintains integrity
- _Requirements: 9.1, 9.2, 9.3, 9.4_

### Task 7.3: Add template support to search and filtering
- [ ] Update search functionality
  - Search within template content
  - Search by variable names
  - Search preset names and descriptions
- [ ] Extend filtering system
  - Filter by template vs regular prompts
  - Filter by number of variables
  - Filter by variable types
- [ ] Update category management
  - Show template count per category
  - Handle template-specific category operations
  - Maintain category consistency
- [ ] Add template-specific sorting
  - Sort by variable count
  - Sort by preset count
  - Sort by template complexity
- [ ] Write search and filter tests
- **Acceptance:** Search finds templates correctly, filtering works, sorting options available
- _Requirements: 8.3, 8.4_

### Task 7.4: Integrate with analytics (if analytics feature exists)
- [ ] Track template usage separately from regular prompts
  - Record template insertions
  - Track variable form completions
  - Monitor preset usage
- [ ] Add template-specific analytics
  - Most used templates
  - Most used variables
  - Preset usage patterns
- [ ] Update analytics dashboard
  - Show template vs regular prompt usage
  - Display template complexity metrics
  - Show preset effectiveness
- [ ] Add template insights
  - Suggest template optimizations
  - Identify unused variables
  - Recommend preset creation
- [ ] Write analytics integration tests
- **Acceptance:** Template usage tracked, analytics show template insights
- _Requirements: 8.1, 8.2, 8.3, 8.4_

---

## Phase 8: Testing & Polish (2-3 days)

### Task 8.1: Write comprehensive unit tests
- [ ] TemplateParser: 25+ tests
  - All syntax variations parsing correctly
  - Error handling for malformed syntax
  - Edge cases (empty variables, special characters)
  - Performance with complex templates
- [ ] TemplateRenderer: 20+ tests
  - Variable replacement accuracy
  - Type-specific formatting
  - Validation logic for all types
  - Error scenarios and recovery
- [ ] TemplatePresetManager: 15+ tests
  - CRUD operations
  - Storage integration
  - Cleanup logic
  - Concurrent access handling
- [ ] UI Components: 30+ tests
  - Form validation and submission
  - User interactions
  - Error display
  - Accessibility compliance
- **Target:** 90%+ code coverage for template module
- **Acceptance:** All tests pass, coverage target met
- _Requirements: All_

### Task 8.2: Write integration tests
- [ ] End-to-end template flow
  - Create template → Fill variables → Insert prompt
  - Test on Claude, ChatGPT, Perplexity platforms
  - Verify data persistence across sessions
- [ ] Preset management flow
  - Create preset → Save → Load → Use
  - Preset cleanup and management
  - Import/export with presets
- [ ] Template conversion flow
  - Regular prompt → Template conversion
  - Template → Regular prompt conversion
  - Data integrity during conversion
- [ ] Cross-context functionality
  - Templates work in popup, sidepanel, content script
  - Data sync between contexts
  - Modal behavior in different contexts
- **Acceptance:** All integration tests pass, data flows correctly
- _Requirements: All_

### Task 8.3: Performance testing and optimization
- [ ] Benchmark template parsing (target: < 20ms for complex templates)
- [ ] Benchmark template rendering (target: < 5ms for 10 variables)
- [ ] Benchmark form generation (target: < 50ms for 20 variables)
- [ ] Benchmark preset loading (target: < 100ms for 50 presets)
- [ ] Test with large datasets
  - 100 templates with 10 variables each
  - 500 presets across all templates
  - Complex templates with 20+ variables
- [ ] Optimize slow operations if targets not met
- [ ] Verify memory usage doesn't increase significantly
- **Acceptance:** All performance targets met, optimizations applied
- _Requirements: All_

### Task 8.4: User experience testing
- [ ] Test template creation flow
  - Intuitive syntax learning
  - Error messages are helpful
  - Template conversion is smooth
- [ ] Test variable form experience
  - Form is easy to fill out
  - Validation is clear and helpful
  - Preset system is discoverable
- [ ] Test template management
  - Templates are easy to identify
  - Editing templates is straightforward
  - Preset management is intuitive
- [ ] Test across different screen sizes
  - Modal works on small screens
  - Form is usable in popup
  - Sidepanel experience is optimal
- [ ] Gather feedback from beta testers
- **Acceptance:** User experience is smooth, feedback incorporated
- _Requirements: All_

---

## Phase 9: Documentation & Release (1-2 days)

### Task 9.1: Create template documentation
- [ ] Add template section to README
  - Explain template concept and benefits
  - Show syntax examples
  - Document variable types
- [ ] Create template syntax guide
  - All supported syntax variations
  - Examples for each variable type
  - Best practices for template creation
- [ ] Document preset system
  - How to create and manage presets
  - Preset sharing and import/export
  - Cleanup and maintenance
- [ ] Add troubleshooting section
  - Common syntax errors and fixes
  - Template conversion issues
  - Performance considerations
- **Acceptance:** Documentation complete and accurate
- _Requirements: All_

### Task 9.2: Add template onboarding
- [ ] Create first-time template tutorial
  - Show how to create first template
  - Demonstrate variable form usage
  - Explain preset system
- [ ] Add template discovery hints
  - Suggest converting existing prompts
  - Show template benefits
  - Guide through first template creation
- [ ] Create template examples
  - Common use cases (email templates, code reviews, etc.)
  - Showcase different variable types
  - Demonstrate preset usage
- [ ] Add contextual help
  - Syntax help in template editor
  - Variable type explanations
  - Preset management guidance
- **Acceptance:** Onboarding helps users discover and use templates
- _Requirements: 8.1, 8.2, 8.3, 8.4_

### Task 9.3: Final QA and release preparation
- [ ] Run full test suite (unit + integration + e2e)
- [ ] Verify all requirements met
- [ ] Test on Chrome (stable, beta)
- [ ] Verify CSP compliance for all template features
- [ ] Check bundle size impact (should be < 50 KB increase)
- [ ] Test template functionality across all AI platforms
- [ ] Verify backwards compatibility with existing prompts
- [ ] Run accessibility audit on template UI
- [ ] Create release notes highlighting template features
- [ ] Tag version (e.g., v1.6.0)
- **Acceptance:** All tests pass, ready for release
- _Requirements: All_

### Task 9.4: Migration and upgrade testing
- [ ] Test upgrade from previous version
  - Existing prompts remain functional
  - Template detection works correctly
  - No data loss during upgrade
- [ ] Test template migration scenarios
  - Prompts with {{}} syntax auto-detected
  - User confirmation for template conversion
  - Rollback option if conversion fails
- [ ] Test export/import with templates
  - Templates export correctly
  - Import preserves template functionality
  - Preset relationships maintained
- [ ] Test edge cases
  - Very large templates (1000+ characters)
  - Templates with many variables (20+)
  - Complex preset scenarios
- **Acceptance:** Migration smooth, no data loss, edge cases handled
- _Requirements: 9.1, 9.2, 9.3, 9.4_

---

## Summary

**Total Estimated Time:** 18-22 days (3.5-4.5 weeks)

**Phase Breakdown:**
- Phase 1: Foundation (1-2 days)
- Phase 2: Parser (2-3 days)
- Phase 3: Renderer (2-3 days)
- Phase 4: Presets (2-3 days)
- Phase 5: Variable Form UI (3-4 days)
- Phase 6: Template Indicators (2-3 days)
- Phase 7: Integration (2-3 days)
- Phase 8: Testing (2-3 days)
- Phase 9: Documentation (1-2 days)

**Key Performance Targets:**
- Template parsing: < 20ms (complex templates)
- Template rendering: < 5ms (10 variables)
- Form generation: < 50ms (20 variables)
- Preset loading: < 100ms (50 presets)
- Modal open: < 200ms
- Form validation: < 50ms (debounced)

**Bundle Size Impact:** ~50 KB (template processing, UI components)

**Storage Usage:** ~10-50 KB per 100 templates with presets

**Template Syntax Examples:**
```
{{project_name*=MyProject|description:"Name of your project"}}
{{priority:number=1|1,2,3,4,5|description:"Priority level"}}
{{tone|professional,casual,friendly|description:"Communication tone"}}
{{description:textarea|description:"Detailed project description"}}
```

**Key Features Delivered:**
- Dynamic prompt templates with variables
- Four variable types (text, number, dropdown, textarea)
- Preset system for saving variable combinations
- Template indicators and management UI
- Real-time validation and error handling
- Export/import support for templates
- Backwards compatibility with existing prompts