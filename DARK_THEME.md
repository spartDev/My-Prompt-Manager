# Dark Theme Implementation

## Overview
This project now supports both light and dark themes with automatic system preference detection and manual toggle functionality.

## Features
- ✅ **System Preference Detection**: Automatically detects user's system theme preference
- ✅ **Manual Toggle**: Theme toggle button in the header for manual control
- ✅ **Persistent Settings**: Theme preference is saved to localStorage
- ✅ **Three Theme Options**: Light, Dark, and System (follows OS preference)
- ✅ **Seamless Integration**: All components support dark mode variants
- ✅ **Accessible**: Proper focus states and contrast in both themes

## Implementation Details

### Theme Hook (`useTheme.ts`)
- Manages theme state (light/dark/system)
- Detects system preferences via `prefers-color-scheme` media query
- Persists theme choice in localStorage
- Automatically applies `dark` class to document root

### Theme Context (`ThemeContext.tsx`)
- Provides theme state and controls throughout the app
- Wraps the entire application to ensure theme consistency

### Theme Toggle Component (`ThemeToggle.tsx`)
- Visual toggle button with sun/moon icons
- Located in the header for easy access
- Accessible with proper ARIA labels

### Dark Mode Classes
All components have been updated with dark mode variants:
- Background colors: `bg-white dark:bg-gray-800`
- Text colors: `text-gray-900 dark:text-gray-100`
- Border colors: `border-gray-200 dark:border-gray-700`
- Interactive states: `hover:bg-purple-50 dark:hover:bg-purple-900/20`

### Focus States
Custom focus utilities updated for dark mode:
- `.focus-primary`: Purple ring with proper offset colors
- `.focus-secondary`: Lighter purple ring for secondary elements
- `.focus-danger`: Red ring for delete actions
- `.focus-input`: Input-specific focus styles
- `.focus-interactive`: General interactive element focus

## Usage

The theme system is automatically initialized when the app loads. Users can:

1. **Automatic**: System preference is detected by default
2. **Manual Toggle**: Click the theme toggle button in the header
3. **Persistent**: Choice is remembered across sessions

## Color Palette

### Light Theme
- Background: White/Gray-50 gradients
- Text: Gray-900 (primary), Gray-600 (secondary)
- Accent: Purple-500/600 gradients
- Borders: Purple-100/Gray-200

### Dark Theme
- Background: Gray-900/800 gradients  
- Text: Gray-100 (primary), Gray-400 (secondary)
- Accent: Purple-400/500 (adjusted for better contrast)
- Borders: Gray-700

## Technical Notes

- Uses Tailwind CSS `dark:` utility classes
- Tailwind configured with `darkMode: 'class'`
- Theme detection via CSS media queries
- Automatic class toggling on document root
- TypeScript support throughout