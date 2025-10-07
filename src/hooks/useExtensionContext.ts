import { useMemo } from 'react';

/**
 * Hook to automatically detect the current Chrome extension context.
 *
 * This hook determines whether the extension is running in a popup window
 * or a sidepanel window by analyzing multiple signals. The detection is
 * memoized and stable throughout the component lifecycle.
 *
 * **Detection Strategy (in order of priority):**
 * 1. **URL Path Analysis** - Checks for 'sidepanel.html' or 'popup.html' in the URL (most reliable)
 * 2. **Test Environment Detection** - Defaults to 'popup' in test/development environments
 * 3. **Window Dimensions** - Uses window width as heuristic (>= 600px suggests sidepanel)
 * 4. **Safe Default** - Falls back to 'popup' if no clear signals are found
 *
 * **Use Cases:**
 * - Adapting UI layout based on available space
 * - Showing/hiding context-specific features
 * - Adjusting ARIA labels for better accessibility
 * - Enabling different navigation patterns per context
 *
 * @returns {('popup' | 'sidepanel')} The detected extension context
 *
 * @example
 * // Basic usage
 * const context = useExtensionContext();
 * console.log(context); // 'popup' or 'sidepanel'
 *
 * @example
 * // Conditional rendering based on context
 * function MyComponent() {
 *   const context = useExtensionContext();
 *
 *   return (
 *     <div>
 *       {context === 'sidepanel' && <WideLayoutContent />}
 *       {context === 'popup' && <CompactLayoutContent />}
 *     </div>
 *   );
 * }
 *
 * @example
 * // Using with ViewHeader auto-detection
 * function MyView() {
 *   // ViewHeader uses this hook internally
 *   return (
 *     <ViewHeader
 *       title="My View"
 *       onClose={() => window.close()}
 *       // context prop is optional - auto-detected
 *     />
 *   );
 * }
 *
 * @example
 * // Adjusting button labels based on context
 * function CloseButton() {
 *   const context = useExtensionContext();
 *   const label = context === 'sidepanel' ? 'Close side panel' : 'Close';
 *
 *   return (
 *     <button aria-label={label} onClick={() => window.close()}>
 *       ✕
 *     </button>
 *   );
 * }
 *
 * @see {@link https://developer.chrome.com/docs/extensions/reference/api/sidePanel | Chrome Side Panel API}
 */
export function useExtensionContext(): 'popup' | 'sidepanel' {
  return useMemo(() => {
    // Method 1: Check URL path (most reliable)
    const url = window.location.href;

    // Explicit sidepanel indicator
    if (url.includes('sidepanel.html') || url.includes('/sidepanel')) {
      return 'sidepanel';
    }

    // Explicit popup indicator OR test environment
    if (url.includes('popup.html') || url.includes('/popup') ||
        process.env.NODE_ENV === 'test' || url.includes('localhost')) {
      return 'popup';
    }

    // Method 2: Check window dimensions as secondary indicator
    // Only use this as a heuristic if URL doesn't provide clear indication
    // Sidepanel is typically wider (min 320px width recommended)
    // Popup is typically narrower (400px default width)
    // Note: This is a heuristic and may not be 100% reliable
    if (window.innerWidth >= 600) { // Increased threshold to be more conservative
      return 'sidepanel';
    }

    // Default fallback to popup (safest default)
    return 'popup';
  }, []); // Empty dependency array - context doesn't change during component lifecycle
}
