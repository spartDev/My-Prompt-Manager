# Architecture Overview

## Three-Context System

### 1. Extension UI (Popup & Side Panel)
- **Technology**: React 18 + TypeScript + Tailwind CSS
- **Entry Points**: `src/popup.tsx`, `src/sidepanel.tsx`
- **Shared Component Tree**: Via `src/App.tsx`
- **State Management**: React contexts and custom hooks
- **Storage**: Chrome storage.local API

### 2. Content Script System
- **Location**: `src/content/` (modular TypeScript architecture)
- **Platform Detection**: Strategy pattern for AI site integration
- **Core Components**:
  - `PromptLibraryInjector`: Main orchestration
  - `PlatformManager`: Strategy selection
  - `InsertionManager`: Text insertion coordination
  - `StorageManager`: Singleton storage wrapper

### 3. Background Service Worker
- **Purpose**: Side panel API and tab management
- **Logic**: Minimal - primarily routing
- **File**: `src/background/background.ts`

## Data Flow Architecture
```
Chrome Storage API ← → StorageManager (singleton)
                       ↓
                   PromptManager (business logic)
                       ↓
    React Hooks ← → Components ← → Content Scripts
```

## Content Script Strategy Pattern
- `PlatformManager` detects current site
- Each platform extends `BaseStrategy`:
  - `ClaudeStrategy` (Priority 100)
  - `ChatGPTStrategy` (Priority 90)  
  - `PerplexityStrategy` (Priority 80)
  - `DefaultStrategy` (Fallback)
- Strategies handle DOM manipulation and text insertion
- `UIElementFactory` creates platform-specific icons

## Critical Services
- **StorageManager**: Singleton with mutex locking for concurrent operations
- **PromptManager**: Search, validation, duplicate detection (Levenshtein distance)
- **InsertionManager**: Platform-agnostic text insertion coordination
- **EventManager**: Centralized event listener management with cleanup