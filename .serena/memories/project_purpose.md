# Project Purpose

## My Prompt Manager - Chrome Extension

This is a powerful Chrome extension that provides seamless access to personal prompt libraries directly within popular AI chat interfaces.

### Key Features:
- **Dual Interface**: React-based popup/side panel for prompt management + native content script integration
- **AI Platform Integration**: Works with Claude, ChatGPT, Perplexity, and custom sites
- **Smart Prompt Management**: Store, organize, and search prompts with custom categories
- **Security First**: DOMPurify sanitization, local storage only, no external data transmission
- **Universal Compatibility**: Works with textarea and contenteditable elements
- **Theme Support**: Dark mode with automatic system detection

### Target Users:
Developers, writers, researchers, and AI power users who frequently use text prompts across multiple AI platforms and want to maintain a personal, organized library of reusable prompts.

### Architecture:
1. **Extension UI (Popup & Side Panel)**: React 18 + TypeScript + Tailwind CSS
2. **Content Script System**: Modular TypeScript architecture with platform strategies
3. **Background Service Worker**: Minimal routing and tab management

### Current Version: 1.2.1
- 470+ tests across comprehensive test suite
- Manifest V3 Chrome extension
- Chrome 114+ compatibility
- MIT License