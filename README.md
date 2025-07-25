# Chrome Extension Prompt Library

A Chrome extension for storing, organizing, and managing personal text prompts with an intuitive popup interface.

## Features

✅ **Save Prompts:** Store frequently used text prompts with custom titles  
✅ **Organize by Categories:** Create and manage categories with custom colors  
✅ **Quick Copy:** One-click copying to clipboard with visual confirmation  
✅ **Search & Filter:** Real-time search with text highlighting  
✅ **CRUD Operations:** Edit and delete prompts with confirmation dialogs  
✅ **Data Persistence:** Automatic saving using Chrome's storage API  
✅ **Error Handling:** Graceful handling of storage quotas and data corruption  
✅ **Responsive UI:** Clean, modern interface built with React and Tailwind CSS  

## Tech Stack

- **Frontend:** React 18 + TypeScript
- **Styling:** Tailwind CSS
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

### Development Workflow

1. Make changes to source code
2. The extension auto-reloads in development mode
3. For major changes, manually reload the extension in `chrome://extensions/`
4. Test functionality in the popup

## Project Structure

```
src/
├── components/          # React components
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
│   └── StorageWarning.tsx  # Storage quota warnings
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
├── popup.html         # Extension popup HTML
├── popup.tsx          # React entry point
└── popup.css          # Global styles
```

## Architecture Overview

### Data Flow
1. **Storage Layer:** `StorageManager` handles Chrome storage API operations
2. **Business Logic:** `PromptManager` handles validation, search, and data processing
3. **React Hooks:** Custom hooks provide data and operations to components
4. **Components:** React components handle UI rendering and user interactions

### Key Components

- **App:** Main orchestrator, manages global state and routing
- **LibraryView:** Primary interface showing prompts, search, and filters
- **PromptCard:** Individual prompt display with actions (copy, edit, delete)
- **Forms:** Add/Edit forms with validation and error handling
- **CategoryManager:** Modal for creating and managing categories

### Error Handling

- **ErrorBoundary:** Catches React errors and provides recovery interface
- **StorageWarning:** Handles storage quota exceeded scenarios
- **Toast Notifications:** User feedback for all operations
- **Validation:** Input validation with helpful error messages

## Usage Guide

### Creating Prompts
1. Click the extension icon to open the popup
2. Click "Add Prompt" button
3. Enter content (required) and optional title
4. Select or create a category
5. Click "Save Prompt"

### Managing Categories
1. In the library view, click "Manage Categories"
2. Add new categories with custom names and colors
3. Edit existing categories by clicking the edit icon
4. Delete categories (prompts move to "Uncategorized")

### Searching and Filtering
- Use the search bar for real-time filtering
- Search matches titles, content, and categories
- Use category dropdown to filter by specific category
- Matching text is highlighted in search results

### Copying Prompts
- Click the "Copy" button on any prompt card
- Content is copied to clipboard
- Success notification confirms the copy operation
- Use copied text in any application

## Data Storage

The extension uses Chrome's `chrome.storage.local` API for data persistence:

- **Prompts:** Stored as array with metadata (id, timestamps, etc.)
- **Categories:** Stored separately with colors and settings
- **Settings:** User preferences and configuration
- **Quota Management:** Automatic monitoring and warnings

## Testing

See [TESTING.md](./TESTING.md) for comprehensive testing procedures.

### Quick Test
1. Build and load the extension
2. Create a few test prompts
3. Restart browser and verify data persists
4. Test search, categories, and copy functionality

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

### Future Enhancements
- [ ] Import/Export functionality
- [ ] Prompt templates and variables
- [ ] Keyboard shortcuts
- [ ] Prompt usage analytics
- [ ] Cloud sync (optional)
- [ ] Dark mode theme
- [ ] Prompt sharing capabilities