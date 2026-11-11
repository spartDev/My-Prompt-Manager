/**
 * UI Element Factory module
 * Creates the Prompts button that opens the Prompt selector, for each Platform.
 *
 * The button looks the same everywhere (Atelier 1C): a pill with the extension's badge and the
 * label "Prompts". It borrows no class from a Platform: where it goes is said by the Platform's
 * anchor chain (src/config/platforms.ts), not by wrappers that mimic the Platform's own buttons.
 */

import { createSVGElement } from '../utils/storage';
import { ThemeManager } from '../utils/theme-manager';

/** The extension's mark: a speech bubble with three dots. */
const BADGE_PATH = 'M5.09 8.48a1 1 0 0 0 .64-.28 1 1 0 0 0 .25-.67 1 1 0 0 0-.25-.68 1 1 0 0 0-.65-.27 1 1 0 0 0-.64.27 1 1 0 0 0-.26.68q.01.41.26.67a1 1 0 0 0 .64.28m3.98 0a1 1 0 0 0 .64-.28 1 1 0 0 0 .26-.67 1 1 0 0 0-.26-.68 1 1 0 0 0-.64-.27 1 1 0 0 0-.64.27 1 1 0 0 0-.26.68q0 .41.26.67a1 1 0 0 0 .64.28m3.82 0a1 1 0 0 0 .64-.28 1 1 0 0 0 .26-.67 1 1 0 0 0-.26-.68 1 1 0 0 0-.64-.27 1 1 0 0 0-.64.27 1 1 0 0 0-.26.68q0 .41.26.67a1 1 0 0 0 .64.28M0 17.28V1.44q0-.55.4-1Q.83 0 1.36 0h15.3q.53 0 .93.44.42.44.42.99v12.34q0 .55-.42.99-.4.43-.93.43H3.6l-2.45 2.6q-.32.32-.73.15-.42-.18-.42-.66m1.35-1.73 1.69-1.78h13.61V1.43H1.35zm0-14.13v14.13z';

export const PILL_CLASS = 'prompt-library-pill';
export const PILL_COMPACT_CLASS = 'prompt-library-pill-compact';

/** How many ancestors of the button are checked for the bar that overflows: a few wrappers, then the bar. */
export const BAR_SEARCH_DEPTH = 6;

/**
 * Shrinks the Prompts button to its badge when the bar it sits in has no room for the label,
 * and gives the label back when there is room again.
 */
export function fitPromptsPill(icon: HTMLElement): void {
  const pill = icon.matches(`.${PILL_CLASS}`) ? icon : icon.querySelector<HTMLElement>(`.${PILL_CLASS}`);
  if (!pill) {
    return;
  }
  pill.classList.remove(PILL_COMPACT_CLASS);
  // The bar is not always the parent: an anchor can sit in wrappers that grow with the button, so
  // the element that runs out of room is a few levels up. Not further: a page that scrolls sideways
  // for its own reasons says nothing about the bar.
  let ancestor = pill.parentElement;
  for (let level = 0; ancestor && ancestor !== document.body && level < BAR_SEARCH_DEPTH; level++) {
    if (ancestor.scrollWidth > ancestor.clientWidth + 1) {
      pill.classList.add(PILL_COMPACT_CLASS);
      return;
    }
    ancestor = ancestor.parentElement;
  }
}

/**
 * Gives the Prompts button the extension's current theme. The button takes it when it is made,
 * but the theme can be read from storage, or changed, while the button is not in the page yet
 * (some placements are asynchronous), where the theme manager's update cannot find it.
 */
export function syncPromptsPillTheme(icon: HTMLElement): void {
  const pill = icon.matches(`.${PILL_CLASS}`) ? icon : icon.querySelector<HTMLElement>(`.${PILL_CLASS}`);
  pill?.classList.toggle('dark-theme', ThemeManager.getInstance().getCurrentTheme() === 'dark');
}

export class UIElementFactory {
  private instanceId: string;

  constructor(instanceId: string) {
    this.instanceId = instanceId;
  }

  /**
   * The Prompts button: a 32px pill with the extension's badge and the label "Prompts".
   * aria-expanded says whether the Prompt selector it opens is open; the injector keeps it current.
   */
  private createPill(classes: string): HTMLButtonElement {
    const pill = document.createElement('button');
    pill.className = `${PILL_CLASS} ${classes}`;
    if (ThemeManager.getInstance().getCurrentTheme() === 'dark') {
      pill.classList.add('dark-theme');
    }
    pill.setAttribute('type', 'button');
    pill.setAttribute('aria-label', 'Prompts: insert a saved prompt');
    pill.setAttribute('aria-haspopup', 'dialog');
    pill.setAttribute('aria-expanded', 'false');
    pill.setAttribute('title', 'My Prompt Manager');
    pill.setAttribute('data-instance-id', this.instanceId);
    pill.setAttribute('tabindex', '0');

    const badge = document.createElement('span');
    badge.className = 'prompt-library-pill-badge';
    const svg = createSVGElement('svg', {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: '0 0 18 18',
      fill: 'currentColor',
      'aria-hidden': 'true'
    });
    svg.appendChild(createSVGElement('path', { d: BADGE_PATH }));
    badge.appendChild(svg);

    const label = document.createElement('span');
    label.className = 'prompt-library-pill-label';
    label.textContent = 'Prompts';

    pill.appendChild(badge);
    pill.appendChild(label);
    return pill;
  }

  /** Claude: the button alone, placed in the composer by its anchor chain. */
  createClaudeIcon(): HTMLElement {
    return this.createPill('prompt-library-integrated-icon');
  }

  createPerplexityIcon(): HTMLElement {
    return this.createPill('prompt-library-integrated-icon');
  }

  createChatGPTIcon(): HTMLElement {
    return this.createPill('prompt-library-integrated-icon');
  }

  createMistralIcon(): HTMLElement {
    return this.createPill('prompt-library-integrated-icon');
  }

  createGeminiIcon(): HTMLElement {
    return this.createPill('prompt-library-integrated-icon');
  }

  /**
   * Microsoft Copilot and Microsoft 365 Copilot. The button no longer follows the Platform's theme
   * (it follows the extension's, like the selector), so there is nothing to clean up: `cleanup`
   * stays for the strategies that call it.
   */
  createCopilotIcon(): { element: HTMLElement; cleanup: () => void } {
    return {
      element: this.createPill('prompt-library-integrated-icon prompt-library-copilot-icon'),
      cleanup: () => {
        // Nothing to release
      }
    };
  }

  /** The button of a custom site, placed over or next to the element the user picked. */
  createFloatingIcon(positioning: 'absolute' | 'relative' = 'absolute'): HTMLElement {
    const positioningClass = positioning === 'absolute' ? 'prompt-library-icon-absolute' : 'prompt-library-icon-relative';
    return this.createPill(`prompt-library-icon-base ${positioningClass}`);
  }

  /**
   * Creates a floating icon for DOM insertion (relative positioning)
   * This is used when icons are inserted into the DOM structure using before/after/inside placement
   */
  createRelativeIcon(): HTMLElement {
    return this.createFloatingIcon('relative');
  }

  /**
   * Creates a floating icon for absolute positioning (fallback)
   * This is used when icons need to be positioned absolutely as a fallback
   */
  createAbsoluteIcon(): HTMLElement {
    return this.createFloatingIcon('absolute');
  }

  /**
   * Converts an existing icon from absolute to relative positioning
   * This is used when an icon created for absolute positioning needs to be used with DOM insertion
   */
  static convertToRelativePositioning(icon: HTMLElement): void {
    // Remove absolute positioning classes and add relative positioning classes
    icon.classList.remove('prompt-library-icon-absolute', 'prompt-library-icon');
    icon.classList.add('prompt-library-icon-base', 'prompt-library-icon-relative');
  }

  /**
   * Converts an existing icon from relative to absolute positioning
   * This is used when an icon created for DOM insertion needs to be used with absolute positioning as fallback
   */
  static convertToAbsolutePositioning(icon: HTMLElement): void {
    // Remove relative positioning classes and add absolute positioning classes
    icon.classList.remove('prompt-library-icon-relative');
    icon.classList.add('prompt-library-icon-base', 'prompt-library-icon-absolute');
  }
}
