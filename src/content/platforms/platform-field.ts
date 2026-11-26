/**
 * The rule every built-in Platform's input field follows: it is a textarea or an editable element.
 * Shared by PlatformManager.getAllSelectors() and scripts/capture-composers.ts, so live:check never
 * finds an element this rule rejects
 */

/** The elements that can be a built-in Platform's input field: a textarea, or an editable element */
const PLATFORM_FIELD = 'textarea, [contenteditable]:not([contenteditable="false"])';

/** Narrows a selector of a built-in Platform to the textareas and editable elements it names */
export const platformFieldSelector = (selector: string): string => `:is(${selector}):is(${PLATFORM_FIELD})`;
