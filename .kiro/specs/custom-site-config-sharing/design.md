# Design Document

## Overview

The custom site configuration sharing feature enables users to export their custom AI platform configurations as encoded strings and import configurations shared by other users. This feature builds upon the existing custom site management system in the SettingsView component and extends it with encoding/decoding capabilities for secure sharing.

## Architecture

### Data Flow
```
User Configuration → Encoding Service → Clipboard → Share
Shared Code → Decoding Service → Validation → Preview → Import → Storage
```

### Component Integration
The feature integrates with the existing `SiteIntegrationSection` component by adding:
- Export button for existing custom sites
- Import input/button for new configurations
- Preview modal for import confirmation
- Enhanced validation and security measures

## Components and Interfaces

### 1. Configuration Encoding Service

**Location**: `src/services/configurationEncoder.ts`

```typescript
interface EncodedConfiguration {
  version: string;
  data: CustomSiteConfiguration;
  checksum: string;
}

interface CustomSiteConfiguration {
  hostname: string;
  displayName: string;
  positioning?: {
    mode: 'custom';
    selector: string;
    placement: 'before' | 'after' | 'inside-start' | 'inside-end';
    offset?: { x: number; y: number };
    zIndex?: number;
    description?: string;
  };
}

class ConfigurationEncoder {
  static encode(customSite: CustomSite): string
  static decode(encodedString: string): CustomSiteConfiguration
  static validate(config: CustomSiteConfiguration): ValidationResult
}
```

### 2. UI Components

**Enhanced SiteIntegrationSection**
- Add "Export" button next to each custom site
- Add "Import Configuration" section with input field and preview
- Integrate with existing form validation and error handling

**New Components**:
- `ConfigurationPreview`: Modal component for previewing imported configurations
- `ExportButton`: Reusable button component for exporting configurations
- `ImportSection`: Section component for importing configurations

### 3. Security and Validation Layer

**Location**: `src/utils/configurationSecurity.ts`

```typescript
interface SecurityValidation {
  isSelectorSafe(selector: string): boolean;
  sanitizeConfiguration(config: CustomSiteConfiguration): CustomSiteConfiguration;
  detectMaliciousContent(config: CustomSiteConfiguration): SecurityWarning[];
}
```

## Data Models

### Encoded Configuration Format

```typescript
interface EncodedConfigurationV1 {
  v: "1.0";                    // Version for backward compatibility
  h: string;                   // Hostname
  n: string;                   // Display name
  p?: {                        // Positioning (optional)
    s: string;                 // Selector
    pl: string;                // Placement
    ox?: number;               // Offset X
    oy?: number;               // Offset Y
    z?: number;                // Z-index
    d?: string;                // Description
  };
  c: string;                   // Checksum for integrity
}
```

### Storage Integration

The feature extends the existing `CustomSite` interface without breaking changes:
- Uses existing `chrome.storage.local` with key `promptLibrarySettings`
- Maintains compatibility with current custom site storage format
- No migration required for existing users

## Error Handling

### Encoding Errors
- **Data too large**: Compress using LZ-string or similar
- **Invalid configuration**: Validate before encoding
- **Encoding failure**: Display user-friendly error message

### Decoding Errors
- **Invalid format**: Show "Invalid configuration code" message
- **Version mismatch**: Attempt backward compatibility, warn if unsupported
- **Checksum failure**: Show "Corrupted configuration" message
- **Security violation**: Block import and show security warning

### Import Errors
- **Duplicate hostname**: Offer overwrite/rename options
- **Permission denied**: Guide user through permission granting
- **Storage quota**: Show storage management options

## Testing Strategy

### Unit Tests
- `ConfigurationEncoder.encode()` with various custom site configurations
- `ConfigurationEncoder.decode()` with valid and invalid encoded strings
- Security validation functions with malicious inputs
- Checksum verification with corrupted data

### Integration Tests
- End-to-end export → import workflow
- Import with existing custom sites (duplicate handling)
- Permission handling during import process
- Storage persistence after import

### Security Tests
- XSS prevention in custom selectors
- CSS injection prevention
- Malformed data handling
- Large payload handling

## Implementation Phases

### Phase 1: Core Encoding/Decoding
- Implement `ConfigurationEncoder` service
- Add basic validation and security checks
- Create unit tests for encoding/decoding

### Phase 2: UI Integration
- Add export buttons to existing custom sites
- Implement import section in `SiteIntegrationSection`
- Add configuration preview modal

### Phase 3: Enhanced Security
- Implement comprehensive security validation
- Add malicious content detection
- Create security warning system

### Phase 4: User Experience Polish
- Add clipboard integration
- Implement success/error notifications
- Add import confirmation workflow

## Security Considerations

### Input Sanitization
- All imported configurations pass through DOMPurify
- CSS selectors validated against safe patterns
- User-provided strings escaped and length-limited

### Content Security
- No execution of user-provided JavaScript
- CSS selectors restricted to safe patterns only
- Positioning values bounded to reasonable ranges

### Data Integrity
- Checksums prevent data corruption
- Version validation ensures compatibility
- Malformed data rejected with clear error messages

### Privacy Protection
- No sensitive data included in exports
- Hostname validation prevents private network exposure
- Optional anonymization of display names

## Backward Compatibility

### Version Management
- Current version: "1.0"
- Future versions maintain backward compatibility
- Graceful degradation for unsupported features

### Storage Compatibility
- No changes to existing storage schema
- New configurations use same `CustomSite` interface
- Existing custom sites unaffected by new feature

## Performance Considerations

### Encoding Performance
- Lightweight JSON serialization
- Optional compression for large configurations
- Minimal memory footprint

### UI Performance
- Lazy loading of preview modal
- Debounced input validation
- Non-blocking clipboard operations

### Storage Performance
- Batch operations for multiple imports
- Atomic updates to prevent corruption
- Efficient duplicate detection