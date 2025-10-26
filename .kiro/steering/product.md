---
inclusion: always
---

# Product Guidelines & User Experience

**My Prompt Manager** is a Chrome extension that provides seamless prompt library access within AI chat interfaces, enabling users to organize, search, and insert prompts with one click.

## Product Vision & Core Value

### Primary Use Cases
- **Prompt Organization**: Users manage personal prompt libraries with categories and search
- **Quick Access**: One-click prompt insertion directly within AI chat interfaces
- **Cross-Platform**: Consistent experience across multiple AI platforms
- **Privacy-First**: All data stored locally, no external transmission

### Extension Contexts & User Flows
- **Popup**: Primary management interface for organizing prompts, categories, and settings
- **Content Scripts**: Inject prompt access icons into AI platforms for seamless workflow integration
- **Side Panel**: Enhanced management UI for Chrome 114+ with expanded workspace
- **Background Service Worker**: Coordinate data sync and cross-context messaging

## Platform Integration Strategy

### Supported AI Platforms
- **Primary Targets**: Claude.ai, ChatGPT.com, Perplexity.ai, Mistral.ai, Gemini
- **Custom Sites**: User-configurable AI platforms via visual element picker
- **Integration Approach**: Non-intrusive icons that blend with platform design
- **Fallback Strategy**: Default insertion behavior for unsupported platforms

### User Experience Requirements
- **Visual Consistency**: Icons should feel native to each platform while maintaining brand recognition
- **Seamless Integration**: Prompt insertion must not disrupt user's conversation flow
- **Responsive Design**: Handle platform UI changes and SPA navigation gracefully
- **Accessibility**: Full keyboard navigation and screen reader support

## Core Business Rules

### Prompt Management
- **Categories Required**: Every prompt must belong to a category - no orphaned prompts
- **Search Performance**: Instant search results with fuzzy matching and highlighting
- **User Control**: Maintain user-defined ordering within categories
- **Storage Awareness**: Warn users at 80% storage capacity, provide cleanup guidance

### Data Integrity & Privacy
- **Local-Only Storage**: Never transmit user data externally
- **Import/Export**: Support full data portability with validation
- **Backup/Restore**: Comprehensive data validation on import operations
- **Error Recovery**: Clear, actionable error messages with recovery suggestions

### Theme & Appearance
- **System Integration**: Follow system light/dark mode preferences
- **Platform Adaptation**: Icons adapt to platform themes while maintaining usability
- **Consistent Branding**: Maintain visual identity across all contexts

## Feature Behavior Specifications

### Search & Discovery
- **Instant Results**: 300ms debounced search with real-time filtering
- **Smart Matching**: Search across prompt titles, content, and categories
- **Result Highlighting**: Highlight matching terms in search results
- **Category Filtering**: Combined search and category filtering

### Prompt Insertion
- **Context Awareness**: Detect appropriate insertion points on each platform
- **Graceful Degradation**: Fallback to clipboard copy if insertion fails
- **User Feedback**: Clear confirmation of successful insertion or fallback action
- **Undo Support**: Allow users to easily remove or modify inserted content

### Storage Management
- **Quota Monitoring**: Real-time storage usage tracking and warnings
- **Efficient Storage**: Optimize data structure for Chrome storage limits
- **Cleanup Tools**: Help users identify and remove unused content
- **Migration Support**: Handle data format changes across extension versions

## Development Priorities

1. **User Experience**: Seamless, non-disruptive integration with AI platforms
2. **Reliability**: Graceful handling of platform changes and edge cases
3. **Privacy**: Local-only data storage and processing
4. **Performance**: Fast search, minimal memory footprint, efficient storage
5. **Accessibility**: Full keyboard navigation and assistive technology support
6. **Maintainability**: Clean separation between platform-specific and core logic