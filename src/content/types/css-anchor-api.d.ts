/**
 * TypeScript type definitions for CSS Anchor Positioning API
 *
 * The CSS Anchor Positioning API is a new web platform feature that allows
 * positioning elements relative to other elements using CSS properties.
 *
 * @see https://developer.chrome.com/blog/anchor-positioning-api/
 * @see https://drafts.csswg.org/css-anchor-position-1/
 */

declare global {
  interface CSSStyleDeclaration {
    /**
     * Defines an anchor name for the element
     * @see https://drafts.csswg.org/css-anchor-position-1/#anchor-name
     */
    anchorName: string;

    /**
     * Associates the element with a named anchor
     * @see https://drafts.csswg.org/css-anchor-position-1/#position-anchor
     */
    positionAnchor: string;

    /**
     * Specifies the area relative to the anchor where the element should be positioned
     * @see https://drafts.csswg.org/css-anchor-position-1/#position-area
     */
    positionArea: string;
  }
}

export {};
