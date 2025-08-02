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
    
    // Create icon content with SVG and text (like Research button)
    const iconContentDiv = createElement('div', { 
      class: 'flex items-center justify-center',
      style: 'width: 16px; height: 16px;'
    });
    const svg = createSVGElement('svg', {
      xmlns: 'http://www.w3.org/2000/svg',
      width: '16',
      height: '16',
      fill: 'currentColor',
      viewBox: '0 0 256 256',
      'aria-hidden': 'true'
    });
    const path = createSVGElement('path', {
      d: 'M224,48H32A16,16,0,0,0,16,64V192a16,16,0,0,0,16,16H224a16,16,0,0,0,16-16V64A16,16,0,0,0,224,48ZM208,192H48a8,8,0,0,1-8-8V72H216V184A8,8,0,0,1,208,192ZM64,96a8,8,0,0,1,8-8H184a8,8,0,0,1,0,16H72A8,8,0,0,1,64,96Zm0,32a8,8,0,0,1,8-8H184a8,8,0,0,1,0,16H72A8,8,0,0,1,64,128Zm0,32a8,8,0,0,1,8-8h64a8,8,0,0,1,0,16H72A8,8,0,0,1,64,160Z'
    });
    svg.appendChild(path);
    iconContentDiv.appendChild(svg);
    
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
    icon.appendChild(iconContentDiv);
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
    
    // Use secure DOM construction
    const outerDiv = createElement('div', { 
      class: 'flex items-center min-w-0 font-medium gap-1.5 justify-center' 
    });
    const innerDiv = createElement('div', { 
      class: 'flex shrink-0 items-center justify-center size-4' 
    });
    const svg = createSVGElement('svg', {
      xmlns: 'http://www.w3.org/2000/svg',
      width: '16',
      height: '16',
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true'
    });
    
    // Simplified prompt library icon optimized for 16x16 rendering
    // Main document with subtle stack indicator - clean and instantly recognizable
    // Uses bolder strokes and fewer elements for crisp small-size display
    
    // Main document (primary element)
    const mainDoc = createSVGElement('rect', {
      x: '4', y: '4', width: '14', height: '16', rx: '2'
    });
    
    // Stack indicator - minimal corner accent showing multiple items
    const stackIndicator1 = createSVGElement('path', {
      d: 'M6 2h12a2 2 0 0 1 2 2v1'
    });
    const stackIndicator2 = createSVGElement('path', {
      d: 'M8 2h10a2 2 0 0 1 2 2v2'
    });
    
    // Simple text lines on main document (larger, more visible)
    const textLine1 = createSVGElement('line', {
      x1: '8', y1: '8', x2: '14', y2: '8'
    });
    const textLine2 = createSVGElement('line', {
      x1: '8', y1: '12', x2: '16', y2: '12'
    });
    const textLine3 = createSVGElement('line', {
      x1: '8', y1: '16', x2: '13', y2: '16'
    });
    
    svg.appendChild(stackIndicator1);
    svg.appendChild(stackIndicator2);
    svg.appendChild(mainDoc);
    svg.appendChild(textLine1);
    svg.appendChild(textLine2);
    svg.appendChild(textLine3);
    innerDiv.appendChild(svg);
    outerDiv.appendChild(innerDiv);
    
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
    
    // Use secure DOM construction
    const svg = createSVGElement('svg', {
      width: '20',
      height: '20',
      viewBox: '0 0 24 24',
      fill: 'currentColor',
      xmlns: 'http://www.w3.org/2000/svg',
      'aria-hidden': 'true',
      class: 'icon',
      'font-size': 'inherit'
    });
    
    // Chat bubble icon with three dots (scaled to 20x20 viewBox)
    const path = createSVGElement('path', {
      d: 'M5.65 9.42C5.93 9.42 6.17 9.32 6.36 9.13C6.55 8.94 6.65 8.69 6.65 8.4C6.65 8.1 6.55 7.85 6.36 7.66C6.17 7.47 5.93 7.37 5.65 7.37C5.37 7.37 5.13 7.47 4.94 7.66C4.75 7.85 4.65 8.1 4.65 8.4C4.65 8.69 4.75 8.94 4.94 9.13C5.13 9.32 5.37 9.42 5.65 9.42ZM10.08 9.42C10.36 9.42 10.6 9.32 10.79 9.13C10.98 8.94 11.08 8.69 11.08 8.4C11.08 8.1 10.98 7.85 10.79 7.66C10.6 7.47 10.36 7.37 10.08 7.37C9.8 7.37 9.56 7.47 9.37 7.66C9.18 7.85 9.08 8.1 9.08 8.4C9.08 8.69 9.18 8.94 9.37 9.13C9.56 9.32 9.8 9.42 10.08 9.42ZM14.32 9.42C14.6 9.42 14.84 9.32 15.03 9.13C15.22 8.94 15.32 8.69 15.32 8.4C15.32 8.1 15.22 7.85 15.03 7.66C14.84 7.47 14.6 7.37 14.32 7.37C14.04 7.37 13.8 7.47 13.61 7.66C13.42 7.85 13.32 8.1 13.32 8.4C13.32 8.69 13.42 8.94 13.61 9.13C13.8 9.32 14.04 9.42 14.32 9.42ZM0 19.21V1.58C0 1.18 0.15 0.81 0.45 0.49C0.75 0.16 1.1 0 1.5 0H18.5C18.88 0 19.23 0.16 19.54 0.49C19.85 0.81 20 1.18 20 1.58V15.3C20 15.7 19.85 16.07 19.54 16.39C19.23 16.72 18.88 16.88 18.5 16.88H4L1.28 19.76C1.04 20.01 0.77 20.06 0.46 19.93C0.15 19.8 0 19.56 0 19.21ZM1.5 17.28L3.37 15.3H18.5V1.58H1.5V17.28ZM1.5 1.58V15.3V17.28V1.58Z',
      fill: 'currentColor'
    });
    
    svg.appendChild(path);
    icon.appendChild(svg);
    
    return icon;
  }

  createFloatingIcon(): HTMLElement {
    const icon = document.createElement('button');
    icon.className = `prompt-library-icon`;
    icon.setAttribute('data-instance-id', this.instanceId);
    icon.setAttribute('type', 'button');
    icon.setAttribute('aria-label', 'Open my prompt manager - Access your saved prompts');
    icon.setAttribute('title', 'My Prompt Manager - Access your saved prompts');
    icon.setAttribute('tabindex', '0');
    
    // Use secure DOM construction
    const svg = createSVGElement('svg', {
      width: '20',
      height: '20',
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
      'aria-hidden': 'true'
    });
    const path = createSVGElement('path', {
      d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'
    });
    const polyline1 = createSVGElement('polyline', {
      points: '14,2 14,8 20,8'
    });
    const line1 = createSVGElement('line', {
      x1: '16', y1: '13', x2: '8', y2: '13'
    });
    const line2 = createSVGElement('line', {
      x1: '16', y1: '17', x2: '8', y2: '17'
    });
    const polyline2 = createSVGElement('polyline', {
      points: '10,9 9,9 8,9'
    });
    
    svg.appendChild(path);
    svg.appendChild(polyline1);
    svg.appendChild(line1);
    svg.appendChild(line2);
    svg.appendChild(polyline2);
    icon.appendChild(svg);
    
    return icon;
  }
}