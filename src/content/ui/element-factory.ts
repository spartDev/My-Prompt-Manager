/**
 * UI Element Factory module
 * Creates platform-specific UI elements for the prompt library
 */

import type { IconCreationResult } from '../types/ui';
import { createElement, createSVGElement } from '../utils/storage';

export class UIElementFactory {
  private instanceId: string;

  constructor(instanceId: string) {
    this.instanceId = instanceId;
  }

  createClaudeIcon(): IconCreationResult {
    const iconContainer = document.createElement('div');
    iconContainer.className = 'relative shrink-0';
    
    const innerDiv = document.createElement('div');
    const flexDiv = document.createElement('div');
    flexDiv.className = 'flex items-center';
    
    const shrinkDiv = document.createElement('div');
    shrinkDiv.className = 'flex shrink-0';
    shrinkDiv.setAttribute('data-state', 'closed');
    shrinkDiv.style.opacity = '1';
    shrinkDiv.style.transform = 'none';
    
    const icon = document.createElement('button');
    icon.className = `prompt-library-integrated-icon inline-flex items-center justify-center relative shrink-0 can-focus select-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:drop-shadow-none border-0.5 transition-all h-8 min-w-8 rounded-lg flex items-center px-[7.5px] group !pointer-events-auto !outline-offset-1 text-text-300 border-border-300 active:scale-[0.98] hover:text-text-200/90 hover:bg-bg-100`;
    icon.setAttribute('type', 'button');
    icon.setAttribute('aria-label', 'Open my prompt manager - Access your saved prompts');
    icon.setAttribute('title', 'My Prompt Manager - Access your saved prompts');
    icon.setAttribute('data-instance-id', this.instanceId);
    icon.setAttribute('tabindex', '0');
    
    // Create centered SVG container - no wrapper divs needed for centering
    const svg = createSVGElement('svg', {
      xmlns: 'http://www.w3.org/2000/svg',
      width: '18',
      height: '18',
      fill: 'currentColor',
      viewBox: '0 0 24 24',
      'aria-hidden': 'true',
      style: 'flex-shrink: 0;'
    });
    const path = createSVGElement('path', {
      d: 'M5.65 9.42C5.93 9.42 6.17 9.32 6.36 9.13C6.55 8.94 6.65 8.69 6.65 8.4C6.65 8.1 6.55 7.85 6.36 7.66C6.17 7.47 5.93 7.37 5.65 7.37C5.37 7.37 5.13 7.47 4.94 7.66C4.75 7.85 4.65 8.1 4.65 8.4C4.65 8.69 4.75 8.94 4.94 9.13C5.13 9.32 5.37 9.42 5.65 9.42ZM10.08 9.42C10.36 9.42 10.6 9.32 10.79 9.13C10.98 8.94 11.08 8.69 11.08 8.4C11.08 8.1 10.98 7.85 10.79 7.66C10.6 7.47 10.36 7.37 10.08 7.37C9.8 7.37 9.56 7.47 9.37 7.66C9.18 7.85 9.08 8.1 9.08 8.4C9.08 8.69 9.18 8.94 9.37 9.13C9.56 9.32 9.8 9.42 10.08 9.42ZM14.32 9.42C14.6 9.42 14.84 9.32 15.03 9.13C15.22 8.94 15.32 8.69 15.32 8.4C15.32 8.1 15.22 7.85 15.03 7.66C14.84 7.47 14.6 7.37 14.32 7.37C14.04 7.37 13.8 7.47 13.61 7.66C13.42 7.85 13.32 8.1 13.32 8.4C13.32 8.69 13.42 8.94 13.61 9.13C13.8 9.32 14.04 9.42 14.32 9.42ZM0 19.21V1.58C0 1.18 0.15 0.81 0.45 0.49C0.75 0.16 1.1 0 1.5 0H18.5C18.88 0 19.23 0.16 19.54 0.49C19.85 0.81 20 1.18 20 1.58V15.3C20 15.7 19.85 16.07 19.54 16.39C19.23 16.72 18.88 16.88 18.5 16.88H4L1.28 19.76C1.04 20.01 0.77 20.06 0.46 19.93C0.15 19.8 0 19.56 0 19.21ZM1.5 17.28L3.37 15.3H18.5V1.58H1.5V17.28ZM1.5 1.58V15.3V17.28V1.58Z'
    });
    svg.appendChild(path);
    
    // Add text container like Research button
    const textContainer = createElement('div', {
      class: 'min-w-0 flex items-center'
    });
    const textElement = createElement('p', {
      class: 'min-w-0 pl-1 text-xs tracking-tight text-ellipsis whitespace-nowrap break-words overflow-hidden shrink'
    });
    textElement.textContent = 'My Prompts';
    textContainer.appendChild(textElement);
    
    // Append both icon and text to button
    icon.appendChild(svg);
    icon.appendChild(textContainer);
    
    shrinkDiv.appendChild(icon);
    flexDiv.appendChild(shrinkDiv);
    innerDiv.appendChild(flexDiv);
    iconContainer.appendChild(innerDiv);
    
    return { container: iconContainer, icon };
  }

  createPerplexityIcon(): HTMLElement {
    const icon = document.createElement('button');
    icon.className = `prompt-library-integrated-icon focus-visible:bg-offsetPlus hover:bg-offsetPlus text-textOff hover:text-textMain dark:hover:bg-offsetPlus dark:hover:text-textMainDark font-sans focus:outline-none outline-none outline-transparent transition duration-300 ease-out font-sans select-none items-center relative group/button justify-center text-center items-center rounded-lg cursor-pointer active:scale-[0.97] active:duration-150 active:ease-outExpo origin-center whitespace-nowrap inline-flex text-sm h-8 px-3`;
    icon.setAttribute('type', 'button');
    icon.setAttribute('aria-label', 'Open my prompt manager - Access your saved prompts');
    icon.setAttribute('title', 'My Prompt Manager - Access your saved prompts');
    icon.setAttribute('data-state', 'closed');
    icon.setAttribute('data-instance-id', this.instanceId);
    icon.setAttribute('tabindex', '0');
    
    // Use secure DOM construction with consistent sizing
    const outerDiv = createElement('div', { 
      class: 'flex items-center min-w-0 font-medium gap-1.5 justify-center' 
    });
    
    // Create centered SVG without wrapper div complications
    const svg = createSVGElement('svg', {
      xmlns: 'http://www.w3.org/2000/svg',
      width: '18',
      height: '18',
      viewBox: '0 0 24 24',
      fill: 'currentColor',
      'aria-hidden': 'true',
      style: 'flex-shrink: 0;'
    });
    
    // Chat bubble icon with three dots - consistent with ChatGPT integration
    const path = createSVGElement('path', {
      d: 'M5.65 9.42C5.93 9.42 6.17 9.32 6.36 9.13C6.55 8.94 6.65 8.69 6.65 8.4C6.65 8.1 6.55 7.85 6.36 7.66C6.17 7.47 5.93 7.37 5.65 7.37C5.37 7.37 5.13 7.47 4.94 7.66C4.75 7.85 4.65 8.1 4.65 8.4C4.65 8.69 4.75 8.94 4.94 9.13C5.13 9.32 5.37 9.42 5.65 9.42ZM10.08 9.42C10.36 9.42 10.6 9.32 10.79 9.13C10.98 8.94 11.08 8.69 11.08 8.4C11.08 8.1 10.98 7.85 10.79 7.66C10.6 7.47 10.36 7.37 10.08 7.37C9.8 7.37 9.56 7.47 9.37 7.66C9.18 7.85 9.08 8.1 9.08 8.4C9.08 8.69 9.18 8.94 9.37 9.13C9.56 9.32 9.8 9.42 10.08 9.42ZM14.32 9.42C14.6 9.42 14.84 9.32 15.03 9.13C15.22 8.94 15.32 8.69 15.32 8.4C15.32 8.1 15.22 7.85 15.03 7.66C14.84 7.47 14.6 7.37 14.32 7.37C14.04 7.37 13.8 7.47 13.61 7.66C13.42 7.85 13.32 8.1 13.32 8.4C13.32 8.69 13.42 8.94 13.61 9.13C13.8 9.32 14.04 9.42 14.32 9.42ZM0 19.21V1.58C0 1.18 0.15 0.81 0.45 0.49C0.75 0.16 1.1 0 1.5 0H18.5C18.88 0 19.23 0.16 19.54 0.49C19.85 0.81 20 1.18 20 1.58V15.3C20 15.7 19.85 16.07 19.54 16.39C19.23 16.72 18.88 16.88 18.5 16.88H4L1.28 19.76C1.04 20.01 0.77 20.06 0.46 19.93C0.15 19.8 0 19.56 0 19.21ZM1.5 17.28L3.37 15.3H18.5V1.58H1.5V17.28ZM1.5 1.58V15.3V17.28V1.58Z'
    });
    
    svg.appendChild(path);
    outerDiv.appendChild(svg);
    
    // Add "My Prompts" text to match Perplexity's button pattern
    const textElement = createElement('span', {
      class: 'text-textOff hover:text-textMain dark:hover:text-textMainDark font-medium text-sm'
    });
    textElement.textContent = 'My Prompts';
    outerDiv.appendChild(textElement);
    
    icon.appendChild(outerDiv);
    
    return icon;
  }

  createChatGPTIcon(): HTMLElement {
    const icon = document.createElement('button');
    icon.className = `prompt-library-integrated-icon composer-btn`;
    icon.setAttribute('type', 'button');
    icon.setAttribute('aria-label', 'Open my prompt manager - Access your saved prompts');
    icon.setAttribute('title', 'My Prompt Manager - Access your saved prompts');
    icon.setAttribute('data-dashlane-label', 'true');
    icon.setAttribute('data-instance-id', this.instanceId);
    icon.setAttribute('tabindex', '0');

    // Use secure DOM construction with consistent 18px sizing
    const svg = createSVGElement('svg', {
      width: '18',
      height: '18',
      viewBox: '0 0 24 24',
      fill: 'currentColor',
      xmlns: 'http://www.w3.org/2000/svg',
      'aria-hidden': 'true',
      class: 'icon',
      'font-size': 'inherit',
      style: 'flex-shrink: 0;'
    });

    // Chat bubble icon with three dots - consistent sizing
    const path = createSVGElement('path', {
      d: 'M5.65 9.42C5.93 9.42 6.17 9.32 6.36 9.13C6.55 8.94 6.65 8.69 6.65 8.4C6.65 8.1 6.55 7.85 6.36 7.66C6.17 7.47 5.93 7.37 5.65 7.37C5.37 7.37 5.13 7.47 4.94 7.66C4.75 7.85 4.65 8.1 4.65 8.4C4.65 8.69 4.75 8.94 4.94 9.13C5.13 9.32 5.37 9.42 5.65 9.42ZM10.08 9.42C10.36 9.42 10.6 9.32 10.79 9.13C10.98 8.94 11.08 8.69 11.08 8.4C11.08 8.1 10.98 7.85 10.79 7.66C10.6 7.47 10.36 7.37 10.08 7.37C9.8 7.37 9.56 7.47 9.37 7.66C9.18 7.85 9.08 8.1 9.08 8.4C9.08 8.69 9.18 8.94 9.37 9.13C9.56 9.32 9.8 9.42 10.08 9.42ZM14.32 9.42C14.6 9.42 14.84 9.32 15.03 9.13C15.22 8.94 15.32 8.69 15.32 8.4C15.32 8.1 15.22 7.85 15.03 7.66C14.84 7.47 14.6 7.37 14.32 7.37C14.04 7.37 13.8 7.47 13.61 7.66C13.42 7.85 13.32 8.1 13.32 8.4C13.32 8.69 13.42 8.94 13.61 9.13C13.8 9.32 14.04 9.42 14.32 9.42ZM0 19.21V1.58C0 1.18 0.15 0.81 0.45 0.49C0.75 0.16 1.1 0 1.5 0H18.5C18.88 0 19.23 0.16 19.54 0.49C19.85 0.81 20 1.18 20 1.58V15.3C20 15.7 19.85 16.07 19.54 16.39C19.23 16.72 18.88 16.88 18.5 16.88H4L1.28 19.76C1.04 20.01 0.77 20.06 0.46 19.93C0.15 19.8 0 19.56 0 19.21ZM1.5 17.28L3.37 15.3H18.5V1.58H1.5V17.28ZM1.5 1.58V15.3V17.28V1.58Z',
      fill: 'currentColor'
    });

    svg.appendChild(path);
    icon.appendChild(svg);

    return icon;
  }

  createMistralIcon(): HTMLElement {
    const icon = document.createElement('button');
    // Match Mistral's native button styling exactly like Research/Think buttons
    icon.className = `prompt-library-integrated-icon flex items-center font-medium transition-all focus-visible:outline-3 outline-default outline-offset-1 justify-center whitespace-nowrap bg-transparent text-subtle active:bg-state-ghost-press hover:bg-state-ghost-hover hover:text-default data-[state=on]:bg-badge-sky data-[state=on]:hover:bg-badge-sky/80 data-[state=on]:active:bg-badge-sky data-[state=on]:text-basic-blue-strong px-2 text-sm rounded-sm h-9 gap-0`;
    icon.setAttribute('type', 'button');
    icon.setAttribute('aria-label', 'Open my prompt manager - Access your saved prompts');
    icon.setAttribute('title', 'My Prompt Manager - Access your saved prompts');
    icon.setAttribute('data-instance-id', this.instanceId);
    icon.setAttribute('tabindex', '0');
    icon.setAttribute('data-state', 'off');
    icon.setAttribute('aria-pressed', 'false');
    icon.setAttribute('data-dashlane-label', 'true');

    const flexContainer = createElement('div', {
      class: 'flex items-center'
    });

    const svg = createSVGElement('svg', {
      xmlns: 'http://www.w3.org/2000/svg',
      width: '24',
      height: '24',
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      class: 'lucide size-4',
      'aria-hidden': 'true'
    });

    // Use file-text icon to represent prompts/templates
    const path1 = createSVGElement('path', {
      d: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z'
    });
    const path2 = createSVGElement('path', {
      d: 'm15 2 5 5'
    });
    const path3 = createSVGElement('path', {
      d: 'M10 9H8'
    });
    const path4 = createSVGElement('path', {
      d: 'M16 13H8'
    });
    const path5 = createSVGElement('path', {
      d: 'M16 17H8'
    });

    svg.appendChild(path1);
    svg.appendChild(path2);
    svg.appendChild(path3);
    svg.appendChild(path4);
    svg.appendChild(path5);
    flexContainer.appendChild(svg);

    // Add text wrapper like native buttons with responsive hiding
    const textWrapper = createElement('div', {
      class: 'flex overflow-hidden transition-all interpolate-size-allow-keywords max-sm:w-0 max-sm:opacity-0'
    });

    const spacer = createElement('div', {
      class: 'w-2'
    });
    textWrapper.appendChild(spacer);
    textWrapper.appendChild(document.createTextNode('Prompts'));

    flexContainer.appendChild(textWrapper);
    icon.appendChild(flexContainer);

    return icon;
  }

  createFloatingIcon(positioning: 'absolute' | 'relative' = 'absolute'): HTMLElement {
    const icon = document.createElement('button');
    const baseClasses = 'prompt-library-icon-base';
    const positioningClass = positioning === 'absolute' ? 'prompt-library-icon-absolute' : 'prompt-library-icon-relative';
    icon.className = `${baseClasses} ${positioningClass}`;
    icon.setAttribute('data-instance-id', this.instanceId);
    icon.setAttribute('type', 'button');
    icon.setAttribute('aria-label', 'Open my prompt manager - Access your saved prompts');
    icon.setAttribute('title', 'My Prompt Manager - Access your saved prompts');
    icon.setAttribute('tabindex', '0');
    
    // Use secure DOM construction with consistent 18px sizing
    const svg = createSVGElement('svg', {
      width: '18',
      height: '18',
      viewBox: '0 0 24 24',
      fill: 'currentColor',
      'aria-hidden': 'true',
      style: 'flex-shrink: 0;'
    });
    
    // Chat bubble icon with three dots - consistent with ChatGPT integration
    const path = createSVGElement('path', {
      d: 'M5.65 9.42C5.93 9.42 6.17 9.32 6.36 9.13C6.55 8.94 6.65 8.69 6.65 8.4C6.65 8.1 6.55 7.85 6.36 7.66C6.17 7.47 5.93 7.37 5.65 7.37C5.37 7.37 5.13 7.47 4.94 7.66C4.75 7.85 4.65 8.1 4.65 8.4C4.65 8.69 4.75 8.94 4.94 9.13C5.13 9.32 5.37 9.42 5.65 9.42ZM10.08 9.42C10.36 9.42 10.6 9.32 10.79 9.13C10.98 8.94 11.08 8.69 11.08 8.4C11.08 8.1 10.98 7.85 10.79 7.66C10.6 7.47 10.36 7.37 10.08 7.37C9.8 7.37 9.56 7.47 9.37 7.66C9.18 7.85 9.08 8.1 9.08 8.4C9.08 8.69 9.18 8.94 9.37 9.13C9.56 9.32 9.8 9.42 10.08 9.42ZM14.32 9.42C14.6 9.42 14.84 9.32 15.03 9.13C15.22 8.94 15.32 8.69 15.32 8.4C15.32 8.1 15.22 7.85 15.03 7.66C14.84 7.47 14.6 7.37 14.32 7.37C14.04 7.37 13.8 7.47 13.61 7.66C13.42 7.85 13.32 8.1 13.32 8.4C13.32 8.69 13.42 8.94 13.61 9.13C13.8 9.32 14.04 9.42 14.32 9.42ZM0 19.21V1.58C0 1.18 0.15 0.81 0.45 0.49C0.75 0.16 1.1 0 1.5 0H18.5C18.88 0 19.23 0.16 19.54 0.49C19.85 0.81 20 1.18 20 1.58V15.3C20 15.7 19.85 16.07 19.54 16.39C19.23 16.72 18.88 16.88 18.5 16.88H4L1.28 19.76C1.04 20.01 0.77 20.06 0.46 19.93C0.15 19.8 0 19.56 0 19.21ZM1.5 17.28L3.37 15.3H18.5V1.58H1.5V17.28ZM1.5 1.58V15.3V17.28V1.58Z'
    });
    
    svg.appendChild(path);
    icon.appendChild(svg);
    
    return icon;
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
   * Creates Microsoft Copilot-specific icon matching native button styling
   * Follows Copilot's design: rounded-2xl, border, transparent background with hover
   */
  createCopilotIcon(): HTMLElement {
    const icon = document.createElement('button');

    // Copilot-specific classes to match native button styling
    // Matches the rounded buttons in Copilot's composer toolbar
    icon.className = 'prompt-library-icon-base prompt-library-icon-copilot prompt-library-cleanup-target';

    icon.setAttribute('type', 'button');
    icon.setAttribute('aria-label', 'Open my prompt manager - Access your saved prompts');
    icon.setAttribute('title', 'My Prompt Manager - Access your saved prompts');
    icon.setAttribute('data-instance-id', this.instanceId);
    icon.setAttribute('tabindex', '0');
    icon.setAttribute('data-dashlane-label', 'true');

    // Create icon SVG (20px to match Copilot's button icons)
    const svg = createSVGElement('svg', {
      xmlns: 'http://www.w3.org/2000/svg',
      width: '20',
      height: '20',
      viewBox: '0 0 24 24',
      fill: 'currentColor',
      'aria-hidden': 'true',
      style: 'flex-shrink: 0;'
    });

    // Standard chat bubble icon with three dots (consistent across platforms)
    const path = createSVGElement('path', {
      d: 'M5.65 9.42C5.93 9.42 6.17 9.32 6.36 9.13C6.55 8.94 6.65 8.69 6.65 8.4C6.65 8.1 6.55 7.85 6.36 7.66C6.17 7.47 5.93 7.37 5.65 7.37C5.37 7.37 5.13 7.47 4.94 7.66C4.75 7.85 4.65 8.1 4.65 8.4C4.65 8.69 4.75 8.94 4.94 9.13C5.13 9.32 5.37 9.42 5.65 9.42ZM10.08 9.42C10.36 9.42 10.6 9.32 10.79 9.13C10.98 8.94 11.08 8.69 11.08 8.4C11.08 8.1 10.98 7.85 10.79 7.66C10.6 7.47 10.36 7.37 10.08 7.37C9.8 7.37 9.56 7.47 9.37 7.66C9.18 7.85 9.08 8.1 9.08 8.4C9.08 8.69 9.18 8.94 9.37 9.13C9.56 9.32 9.8 9.42 10.08 9.42ZM14.32 9.42C14.6 9.42 14.84 9.32 15.03 9.13C15.22 8.94 15.32 8.69 15.32 8.4C15.32 8.1 15.22 7.85 15.03 7.66C14.84 7.47 14.6 7.37 14.32 7.37C14.04 7.37 13.8 7.47 13.61 7.66C13.42 7.85 13.32 8.1 13.32 8.4C13.32 8.69 13.42 8.94 13.61 9.13C13.8 9.32 14.04 9.42 14.32 9.42ZM0 19.21V1.58C0 1.18 0.15 0.81 0.45 0.49C0.75 0.16 1.1 0 1.5 0H18.5C18.88 0 19.23 0.16 19.54 0.49C19.85 0.81 20 1.18 20 1.58V15.3C20 15.7 19.85 16.07 19.54 16.39C19.23 16.72 18.88 16.88 18.5 16.88H4L1.28 19.76C1.04 20.01 0.77 20.06 0.46 19.93C0.15 19.8 0 19.56 0 19.21ZM1.5 17.28L3.37 15.3H18.5V1.58H1.5V17.28ZM1.5 1.58V15.3V17.28V1.58Z'
    });

    svg.appendChild(path);
    icon.appendChild(svg);

    // No text label for Copilot - just the icon

    return icon;
  }

  /**
   * Creates Gemini-specific icon using Material Design 3
   * Matches Gemini's mic and send button styling with Angular Material components
   */
  createGeminiIcon(): HTMLElement {
    const icon = document.createElement('button');
    // Material Design 3 button classes matching Gemini's UI
    icon.className = `prompt-library-integrated-icon mdc-icon-button mat-mdc-icon-button mat-mdc-button-base mat-unthemed`;
    icon.setAttribute('type', 'button');
    icon.setAttribute('aria-label', 'Open my prompt manager - Access your saved prompts');
    icon.setAttribute('title', 'My Prompt Manager - Access your saved prompts');
    icon.setAttribute('data-instance-id', this.instanceId);
    icon.setAttribute('tabindex', '0');
    icon.setAttribute('mat-ripple-loader-uninitialized', '');
    icon.setAttribute('mat-ripple-loader-class-name', 'mat-mdc-button-ripple');
    icon.setAttribute('mat-ripple-loader-centered', '');

    // Material Design ripple effect container
    const ripple = createElement('span', {
      class: 'mat-mdc-button-persistent-ripple mdc-icon-button__ripple'
    });
    icon.appendChild(ripple);

    // Icon SVG with Material Design sizing
    const svg = createSVGElement('svg', {
      xmlns: 'http://www.w3.org/2000/svg',
      width: '24',
      height: '24',
      viewBox: '0 0 24 24',
      fill: 'currentColor',
      'aria-hidden': 'true',
      class: 'mat-icon notranslate gds-icon-l google-symbols mat-ligature-font mat-icon-no-color',
      role: 'img',
      style: 'flex-shrink: 0;'
    });

    // Chat bubble icon with three dots (same icon used across platforms)
    const path = createSVGElement('path', {
      d: 'M5.65 9.42C5.93 9.42 6.17 9.32 6.36 9.13C6.55 8.94 6.65 8.69 6.65 8.4C6.65 8.1 6.55 7.85 6.36 7.66C6.17 7.47 5.93 7.37 5.65 7.37C5.37 7.37 5.13 7.47 4.94 7.66C4.75 7.85 4.65 8.1 4.65 8.4C4.65 8.69 4.75 8.94 4.94 9.13C5.13 9.32 5.37 9.42 5.65 9.42ZM10.08 9.42C10.36 9.42 10.6 9.32 10.79 9.13C10.98 8.94 11.08 8.69 11.08 8.4C11.08 8.1 10.98 7.85 10.79 7.66C10.6 7.47 10.36 7.37 10.08 7.37C9.8 7.37 9.56 7.47 9.37 7.66C9.18 7.85 9.08 8.1 9.08 8.4C9.08 8.69 9.18 8.94 9.37 9.13C9.56 9.32 9.8 9.42 10.08 9.42ZM14.32 9.42C14.6 9.42 14.84 9.32 15.03 9.13C15.22 8.94 15.32 8.69 15.32 8.4C15.32 8.1 15.22 7.85 15.03 7.66C14.84 7.47 14.6 7.37 14.32 7.37C14.04 7.37 13.8 7.47 13.61 7.66C13.42 7.85 13.32 8.1 13.32 8.4C13.32 8.69 13.42 8.94 13.61 9.13C13.8 9.32 14.04 9.42 14.32 9.42ZM0 19.21V1.58C0 1.18 0.15 0.81 0.45 0.49C0.75 0.16 1.1 0 1.5 0H18.5C18.88 0 19.23 0.16 19.54 0.49C19.85 0.81 20 1.18 20 1.58V15.3C20 15.7 19.85 16.07 19.54 16.39C19.23 16.72 18.88 16.88 18.5 16.88H4L1.28 19.76C1.04 20.01 0.77 20.06 0.46 19.93C0.15 19.8 0 19.56 0 19.21ZM1.5 17.28L3.37 15.3H18.5V1.58H1.5V17.28ZM1.5 1.58V15.3V17.28V1.58Z',
      fill: 'currentColor'
    });

    svg.appendChild(path);
    icon.appendChild(svg);

    // Focus indicator (Material Design requirement)
    const focusIndicator = createElement('span', {
      class: 'mat-focus-indicator'
    });
    icon.appendChild(focusIndicator);

    // Touch target for accessibility (44x44px minimum)
    const touchTarget = createElement('span', {
      class: 'mat-mdc-button-touch-target'
    });
    icon.appendChild(touchTarget);

    return icon;
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