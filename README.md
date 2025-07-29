# Prompt Library Extension

A Chrome extension that provides seamless access to your personal prompt library directly within popular AI chat interfaces. Features both a popup interface for managing prompts and native integration with supported AI platforms including Claude, ChatGPT, and Perplexity.

## Features

### Popup Interface (Prompt Management)
✅ **Save Prompts:** Store frequently used text prompts with custom titles  
✅ **Organize by Categories:** Create and manage categories with custom colors  
✅ **Quick Copy:** One-click copying to clipboard with visual confirmation  
✅ **Search & Filter:** Real-time search with text highlighting  
✅ **CRUD Operations:** Edit and delete prompts with confirmation dialogs  
✅ **Data Persistence:** Automatic saving using Chrome's storage API  
✅ **Error Handling:** Graceful handling of storage quotas and data corruption  
✅ **Responsive UI:** Clean, modern interface built with React and Tailwind CSS

### AI Platform Integration
✅ **Native Integration:** Library icon appears in supported AI chat interfaces  
✅ **Smart Positioning:** Popup appears adjacent to the trigger button for intuitive UX  
✅ **Dynamic Detection:** Automatically detects and integrates with AI chat input fields  
✅ **Seamless Insertion:** Direct prompt insertion into both textarea and contenteditable elements  
✅ **Multi-Platform Support:** Works with Claude, ChatGPT, Perplexity, and custom sites  
✅ **Fallback Support:** Graceful fallback for different page layouts  

## Supported Platforms

- **Claude** (claude.ai)
- **ChatGPT** (chatgpt.com)  
- **Perplexity** (www.perplexity.ai)
- **Custom Sites** (configurable through settings)

## Tech Stack

- **Frontend:** React 18 + TypeScript
- **Styling:** Tailwind CSS  
- **Content Script:** Vanilla JavaScript with CSS injection
- **Build Tool:** Vite with @crxjs/vite-plugin
- **Storage:** Chrome Storage API
- **Extension:** Manifest V3

## Development Setup

### Prerequisites

- Node.js 18+ 
- Chrome browser
- Basic knowledge of Chrome extensions

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd claude-ui
   npm install
   ```

2. **Development build:**
   ```bash
   npm run dev
   ```
   This starts the development server with hot module replacement.

3. **Production build:**
   ```bash
   npm run build
   ```
   Creates optimized build in `dist/` folder.

### Loading in Chrome

1. Open `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked" and select the `dist` folder
4. The extension icon should appear in the toolbar

### Testing the Integration

1. Visit any supported AI platform (Claude, ChatGPT, Perplexity)
2. Look for the library icon in the input area
3. Click the icon to access your prompt library
4. Select a prompt to insert it directly into the chat input

### Development Workflow

1. Make changes to source code
2. The extension auto-reloads in development mode
3. For major changes, manually reload the extension in `chrome://extensions/`
4. Test functionality in both the popup and platform integrations

## Project Structure

```
src/
├── components/          # React components (Popup Interface)
│   ├── App.tsx         # Main app component
│   ├── LibraryView.tsx # Main library interface
│   ├── PromptCard.tsx  # Individual prompt display
│   ├── SearchBar.tsx   # Search functionality
│   ├── CategoryFilter.tsx # Category filtering
│   ├── AddPromptForm.tsx  # Add prompt form
│   ├── EditPromptForm.tsx # Edit prompt form
│   ├── CategoryManager.tsx # Category management
│   ├── ToastContainer.tsx  # Notifications
│   ├── ErrorBoundary.tsx   # Error handling
│   ├── StorageWarning.tsx  # Storage quota warnings
│   └── SettingsView.tsx    # Settings configuration
├── hooks/              # Custom React hooks
│   ├── usePrompts.ts   # Prompt management
│   ├── useCategories.ts # Category management
│   ├── useClipboard.ts # Clipboard operations
│   ├── useSearch.ts    # Search functionality
│   └── useToast.ts     # Toast notifications
├── services/           # Business logic
│   ├── storage.ts      # Chrome storage operations
│   └── promptManager.ts # Prompt business logic
├── types/             # TypeScript type definitions
│   ├── index.ts       # Core types
│   ├── components.ts  # Component prop types
│   ├── hooks.ts       # Hook return types
│   └── context.ts     # Context types
├── content.js         # Content script for AI platform integration
├── popup.html         # Extension popup HTML
├── popup.tsx          # React entry point
└── popup.css          # Global styles
```

## Architecture Overview

### Dual Interface Architecture
The extension provides two complementary interfaces:

1. **Popup Interface** (React-based): For managing prompts, categories, and settings
2. **Content Script Integration**: For seamless prompt access within AI platforms

### Data Flow
1. **Storage Layer:** `StorageManager` handles Chrome storage API operations
2. **Business Logic:** `PromptManager` handles validation, search, and data processing
3. **React Hooks:** Custom hooks provide data and operations to popup components
4. **Content Script:** `content.js` handles AI platform integration and prompt insertion

### Key Components

**Popup Interface:**
- **App:** Main orchestrator, manages global state and routing
- **LibraryView:** Primary interface showing prompts, search, and filters
- **PromptCard:** Individual prompt display with actions (copy, edit, delete)
- **Forms:** Add/Edit forms with validation and error handling
- **CategoryManager:** Modal for creating and managing categories
- **SettingsView:** Configuration for supported sites and custom platforms

**Content Script Integration:**
- **PromptLibraryInjector:** Main class handling AI platform integration
- **Icon Injection:** Dynamically creates and positions the library icon
- **Input Detection:** Automatically detects and monitors text input fields
- **Prompt Selector UI:** Popup interface for selecting and inserting prompts

### Error Handling

- **ErrorBoundary:** Catches React errors and provides recovery interface
- **StorageWarning:** Handles storage quota exceeded scenarios
- **Toast Notifications:** User feedback for all operations
- **Validation:** Input validation with helpful error messages

## Usage Guide

### Managing Prompts (Popup Interface)

**Creating Prompts:**
1. Click the extension icon to open the popup
2. Click "Add Prompt" button
3. Enter content (required) and optional title
4. Select or create a category
5. Click "Save Prompt"

**Managing Categories:**  
1. In the library view, click "Manage Categories"
2. Add new categories with custom names and colors
3. Edit existing categories by clicking the edit icon
4. Delete categories (prompts move to "Uncategorized")

**Searching and Filtering:**
- Use the search bar for real-time filtering
- Search matches titles, content, and categories
- Use category dropdown to filter by specific category
- Matching text is highlighted in search results

**Copying Prompts:**
- Click the "Copy" button on any prompt card
- Content is copied to clipboard
- Success notification confirms the copy operation
- Use copied text in any application

### Using Prompts in AI Platforms

**Accessing Your Library:**
1. Visit any supported AI platform (Claude, ChatGPT, Perplexity)
2. Look for the library icon in the input area
3. Click the icon to open your prompt library

**Inserting Prompts:**
1. Select a prompt from the searchable list
2. The prompt is automatically inserted into the chat input
3. The popup closes automatically after selection
4. Continue typing or send the message as normal

**Smart Features:**
- Popup appears adjacent to the trigger button for intuitive UX
- Search functionality available within the integrated popup
- Works with both regular text areas and rich text editors
- Automatic input field detection and integration

### Configuring Sites (Settings)

**Built-in Sites:**
- Toggle support for Claude, ChatGPT, and Perplexity individually
- Sites are pre-configured with optimal selectors

**Custom Sites:**
1. Click settings icon in the popup
2. Add new sites by entering URL
3. Configure advanced positioning if needed
4. Test selectors before adding

## Data Storage

The extension uses Chrome's `chrome.storage.local` API for data persistence:

- **Prompts:** Stored as array with metadata (id, timestamps, etc.)
- **Categories:** Stored separately with colors and settings
- **Settings:** User preferences and site configurations
- **Quota Management:** Automatic monitoring and warnings

## Testing

### Quick Test
1. Build and load the extension
2. Create a few test prompts in the popup
3. Visit supported AI platforms and test the integration
4. Restart browser and verify data persists
5. Test search, categories, copy functionality, and prompt insertion

## Building for Production

1. **Build optimized version:**
   ```bash
   npm run build
   ```

2. **Package for Chrome Web Store:**
   - Zip the entire `dist/` folder
   - Upload to Chrome Web Store Developer Dashboard
   - Follow Chrome Web Store publishing guidelines

## Performance Considerations

- **Storage Efficiency:** Prompts are stored efficiently with minimal metadata
- **Search Performance:** Client-side search with optimized filtering
- **Memory Usage:** Components are optimized for minimal re-renders
- **Bundle Size:** Tree-shaking and code splitting for optimal loading

## Security

- **Content Security Policy:** Strict CSP prevents XSS attacks
- **Input Sanitization:** User content is properly sanitized
- **Minimal Permissions:** Only requests necessary storage permissions
- **Local Storage:** All data stays on user's device

## Browser Compatibility

- **Chrome:** Version 88+ (Manifest V3 support)
- **Storage API:** Uses chrome.storage.local for reliability
- **Modern Features:** Built with modern web standards

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with proper TypeScript typing
4. Test thoroughly using the testing guide
5. Submit a pull request

## License

[MIT License](LICENSE)

## Support

For issues and feature requests, please use the GitHub issues tracker.

## Roadmap

### Completed Features
- [x] Multi-platform AI integration (Claude, ChatGPT, Perplexity)
- [x] Smart popup positioning
- [x] Custom site configuration
- [x] Dark mode theme support
- [x] Responsive design

### Future Enhancements
- [ ] Import/Export functionality
- [ ] Prompt templates and variables
- [ ] Keyboard shortcuts for quick access
- [ ] Prompt usage analytics
- [ ] Cloud sync (optional)
- [ ] Prompt sharing capabilities
- [ ] Custom hotkeys for frequent prompts