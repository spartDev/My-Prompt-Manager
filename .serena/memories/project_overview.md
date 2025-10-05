# My Prompt Manager Chrome Extension - Project Overview

## Purpose
A Chrome extension providing seamless access to personal prompt libraries directly within AI chat interfaces. Dual interface system:
- **Popup/Side Panel**: React-based prompt management UI
- **Content Script**: Native integration with AI platforms (Claude, ChatGPT, Perplexity)

## Key Features
- Smart prompt management with categories and search
- Native integration with AI platforms via content scripts  
- Universal compatibility (textarea and contenteditable elements)
- Dark mode with theme synchronization
- Custom site configuration
- Security-first approach with DOMPurify sanitization
- Local storage only - no data transmission
- Side panel support (Chrome 114+)

## Target Users
Developers, writers, researchers, and AI power users who maintain reusable prompt libraries across multiple AI platforms.

## Supported Platforms
- Claude.ai (Priority 100) ✅
- ChatGPT (Priority 90) ✅ 
- Perplexity.ai (Priority 80) ✅
- Custom sites (configurable) ✅

## Current Status
- Version: 1.2.1
- Tests: 470+ passing tests across 26 test files
- License: MIT
- Author: Thomas Roux