# Essential Development Commands

## Development Commands
```bash
npm run dev          # Start development server with hot reload
npm run build        # Production build (creates dist/ folder)
npm run preview      # Preview production build
```

## Testing Commands  
```bash
npm test             # Run all tests with Vitest (470+ tests)
npm run test:ui      # Run tests with UI interface
npm run test:coverage # Generate test coverage report
```

## Code Quality Commands (MANDATORY)
```bash
npm run lint         # Run ESLint checks
npm run lint:fix     # Fix ESLint issues automatically
```

## Packaging Commands
```bash
npm run package      # Package extension for Chrome Web Store
```

## System Commands (macOS/Darwin)
```bash
git                  # Version control
ls / eza             # List directory contents  
find                 # File searching
grep / rg            # Text searching
cd                   # Change directory
```

## Chrome Extension Loading
1. `npm run build` to create dist/ folder
2. Open chrome://extensions/
3. Enable Developer mode
4. Load unpacked → select dist/ folder
5. Test both popup and content script functionality

## Debug Commands
```javascript
// Enable debug logging in browser console
localStorage.setItem('prompt-library-debug', 'true');
location.reload();

// Check debug interface
window.__promptLibraryDebug?.activeStrategy
window.__promptLibraryDebug?.foundElements
window.__promptLibraryDebug?.testInsertion?.('test content')
```