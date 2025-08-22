# Element Picker Implementation - Popup Persistence Solution

## Problem Solved
Chrome automatically closes the extension popup when it loses focus (e.g., when clicking on another tab or window). This made it impossible to select elements on webpages while keeping the settings visible.

## Solution Architecture

### 1. **Window-Based Approach**
Instead of trying to keep the popup open (which Chrome doesn't allow), we open the settings in a separate window that persists independently.

### 2. **Implementation Flow**

#### When User Clicks "Pick Element":
1. **From Regular Popup:**
   - Detects current active tab
   - Opens settings in a new window with `?picker=true` query parameter
   - Closes original popup
   - New window stays open during element selection

2. **From Picker Window:**
   - Directly starts element picker on the stored target tab
   - Switches focus to the target webpage
   - User can select elements while window remains open

### 3. **Key Components**

#### Background Script (`src/background/background.ts`)
- Manages picker sessions and window tracking
- Coordinates messages between popup window and content scripts
- Handles window lifecycle (creation, focus management, cleanup)
- Tracks original tab ID for element selection

#### Element Picker Module (`src/content/modules/element-picker.ts`)
- Visual element selection with purple highlighting
- Generates optimized CSS selectors
- Sends selection back through background script
- Provides real-time element information display

#### Settings View (`src/components/SettingsView.tsx`)
- Detects picker mode via URL parameter
- Auto-expands relevant sections in picker mode
- Handles both regular popup and picker window contexts
- Shows appropriate UI hints based on context

### 4. **Message Flow**
```
User clicks "Pick Element" 
→ Opens new window 
→ Window sends START_ELEMENT_PICKER 
→ Background activates picker on target tab
→ User selects element
→ Content script sends selection to background
→ Background forwards to picker window
→ Window updates selector field
```

### 5. **Features**
- ✅ **Popup never closes** - Uses separate window instead
- ✅ **Visual feedback** - Purple border highlighting on hover
- ✅ **Smart selector generation** - ID > unique class > path-based
- ✅ **Auto-focus management** - Returns focus to picker window after selection
- ✅ **Cleanup on close** - Properly handles window/tab closure

### 6. **User Experience**
1. Navigate to target webpage
2. Open extension popup
3. Go to Settings → Custom Sites
4. Enable "Advanced Positioning Options"
5. Select "Custom" mode
6. Click "Pick Element" (opens new window)
7. Click on desired element on webpage
8. Selector auto-populates in settings window
9. Window stays open for further configuration

## Testing Instructions

1. Load extension from `dist` folder
2. Navigate to any website (e.g., claude.ai)
3. Click extension icon
4. Go to Settings → Add Custom Site
5. Enable Advanced Positioning → Custom mode
6. Click "Pick Element" button
7. Verify new window opens and stays open
8. Click on any element on the webpage
9. Verify selector appears in the window
10. Verify window remains open after selection

## Technical Notes

- Uses Chrome's `windows.create()` API with `type: 'popup'`
- Maintains state through URL parameters (`?picker=true`)
- Background script acts as message broker
- No need for complex focus hacks or port connections
- Clean separation between regular popup and picker modes