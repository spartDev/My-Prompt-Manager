# Implementation Plan

- [ ] 1. Create PromptEncoder service with core encoding/decoding functionality
  - Implement `PromptEncoder` service at `src/services/promptEncoder.ts`
  - Use same lz-string compression and checksum validation as `ConfigurationEncoder`
  - Create encoding method that converts `Prompt` to `EncodedPromptPayloadV1`
  - Create decoding method that converts encoded string to `SharedPromptData`
  - Implement validation with DOMPurify sanitization for all text fields
  - Add comprehensive error handling with specific error codes
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 2. Add shared prompt types and interfaces
  - Add `SharedPromptData`, `EncodedPromptPayloadV1`, and `PromptValidationResult` interfaces to `src/types/index.ts`
  - Define validation constants for prompt sharing (max lengths, version)
  - Add error types specific to prompt encoding/decoding
  - Export new types from types index file
  - _Requirements: 3.6, 4.3_

- [ ] 3. Create unit tests for PromptEncoder service
  - Create test file `src/services/__tests__/promptEncoder.test.ts`
  - Test encoding/decoding round-trip with valid prompt data
  - Test validation with invalid data (empty fields, oversized content, malicious input)
  - Test checksum validation and integrity checks
  - Test error handling for malformed encoded strings
  - Mock DOMPurify and test sanitization behavior
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 4. Add share button to PromptCard component
  - Modify `src/components/PromptCard.tsx` to add share icon button
  - Position share button between copy button and menu button
  - Implement share click handler that calls PromptEncoder.encode
  - Add clipboard integration using existing useClipboard hook
  - Add loading state during encoding operation
  - Add tooltip with "Share this prompt" text
  - _Requirements: 1.1, 1.2, 1.3, 4.1, 4.2, 4.3_

- [ ] 5. Implement share functionality with toast notifications
  - Integrate PromptEncoder service into PromptCard share handler
  - Use existing toast system for success/error notifications
  - Handle encoding errors with user-friendly messages
  - Handle clipboard errors with fallback options
  - Add proper error logging for debugging
  - _Requirements: 1.4, 1.5, 4.3_

- [ ] 6. Create import mode interface for AddPromptForm
  - Modify `src/components/AddPromptForm.tsx` to add mode selector
  - Add "Create New Prompt" and "Import Shared Prompt" toggle buttons
  - Create import mode UI with text area for encoded string input
  - Add real-time validation of pasted encoded strings
  - Show preview section when valid encoded string is detected
  - _Requirements: 2.1, 2.2, 4.5_

- [ ] 7. Implement prompt import functionality
  - Add decode functionality to AddPromptForm import mode
  - Implement preview display showing decoded prompt title, content, and category
  - Add category selection dropdown for imported prompts (existing + create new)
  - Add import confirmation button that adds prompt to library
  - Handle import errors with clear error messages
  - _Requirements: 2.3, 2.4, 2.5, 2.6, 5.2, 5.3, 5.4_

- [ ] 8. Add validation and error handling for import process
  - Implement client-side validation for encoded string format
  - Add error display for invalid encoded strings
  - Handle category assignment for imported prompts
  - Validate imported prompts against existing prompt validation rules
  - Add storage quota checking before import
  - _Requirements: 2.5, 3.2, 3.3, 5.1, 5.5, 5.6_

- [ ] 9. Create comprehensive component tests for sharing functionality
  - Create test file `src/components/__tests__/PromptCard.sharing.test.tsx`
  - Test share button rendering and click behavior
  - Test clipboard integration and error handling
  - Test toast notification display for success/error cases
  - Mock PromptEncoder service and test error scenarios
  - Test accessibility features (keyboard navigation, ARIA labels)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 4.1, 4.2, 4.3_

- [ ] 10. Create comprehensive component tests for import functionality
  - Create test file `src/components/__tests__/AddPromptForm.import.test.tsx`
  - Test mode selector functionality and UI state changes
  - Test import mode text area and validation behavior
  - Test preview display with valid encoded strings
  - Test category selection and import confirmation
  - Test error handling and error message display
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 4.5, 5.2, 5.3, 5.4_

- [ ] 11. Add integration tests for complete sharing workflow
  - Create test file `src/test/__tests__/prompt-sharing.integration.test.ts`
  - Test complete encode → decode → import workflow
  - Test sharing between different component instances
  - Test category handling during import process
  - Test storage integration and prompt library updates
  - Test error scenarios with realistic user interactions
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 5.1, 5.5, 5.6_

- [ ] 12. Implement accessibility features and keyboard navigation
  - Add proper ARIA labels to share button and import interface
  - Implement keyboard navigation for import mode components
  - Add screen reader announcements for encoding/decoding operations
  - Test focus management during mode switching
  - Add high contrast support for share button icon
  - _Requirements: 4.6, 4.1, 4.2_

- [ ] 13. Add performance optimizations and cleanup
  - Implement debounced validation for import text area (300ms)
  - Add React.memo optimization for import preview components
  - Implement proper cleanup in useEffect hooks
  - Add loading states for encoding/decoding operations
  - Optimize clipboard operations and error handling
  - _Requirements: 1.3, 2.3, 4.3_