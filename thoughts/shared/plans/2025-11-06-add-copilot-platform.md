# Microsoft Copilot Platform Integration Implementation Plan

## Overview

Add support for Microsoft Copilot (https://copilot.microsoft.com/) to the My Prompt Manager Chrome extension, enabling users to access their saved prompts directly within the Copilot interface. This implementation uses the Quick Method approach, adding platform configuration to achieve integration in approximately 5 minutes of development time.

## Current State Analysis

The extension currently supports 5 AI platforms:
- Claude (priority 100) - ProseMirror editor with custom strategy
- ChatGPT (priority 90) - React-aware textarea with custom strategy
- Gemini (priority 85) - Quill.js editor with custom strategy
- Mistral (priority 85) - ProseMirror with custom strategy
- Perplexity (priority 80) - Standard textarea with default strategy

**Key Architecture Elements**:
- Centralized platform configuration in `src/config/platforms.ts` (src/config/platforms.ts:1)
- Strategy pattern for platform-specific insertion logic (src/content/platforms/base-strategy.ts:1)
- Factory pattern with type-safe registry (src/content/platforms/platform-manager.ts:28)
- UI element factory for platform-specific icons (src/content/ui/element-factory.ts:1)

**Microsoft Copilot Analysis**:
- **Hostname**: copilot.microsoft.com
- **Input Type**: Standard HTML `<textarea>` element
- **Input Selectors**:
  - `textarea[data-testid="composer-input"]` (primary)
  - `textarea#userInput` (fallback)
  - `textarea[placeholder*="Message"]` (pattern match)
- **Button Container**: `.flex.gap-2.items-center` (second occurrence - contains "Talk to Copilot" button)
- **Insertion Method**: Standard textarea - default strategy with native value setter + event dispatching

## Desired End State

Microsoft Copilot will be fully integrated with the My Prompt Manager extension:

1. **Icon Placement**: "My Prompts" icon appears after the "Quick response" button, before the "Talk to Copilot" button
2. **Functionality**: Users can click the icon to access their prompt library
3. **Insertion**: Prompts insert seamlessly into the Copilot textarea using the default strategy
4. **Styling**: Icon matches Copilot's native button styling (rounded-2xl, border, gap-2)
5. **Priority**: Copilot has priority 80 (same tier as Perplexity)
6. **Default Enabled**: Enabled by default for all new and existing users

### Verification Criteria:
- Icon appears in correct position on copilot.microsoft.com
- Clicking icon opens prompt library modal
- Selecting a prompt inserts text into textarea correctly
- Text insertion triggers Copilot's state updates (send button enables)
- Extension works in both light and dark mode
- No console errors or warnings

## What We're NOT Doing

- **Custom Strategy Class**: Not creating a `CopilotStrategy` class - the default strategy handles standard textareas perfectly
- **Complex Insertion Logic**: No need for React-specific handling, ProseMirror manipulation, or Quill.js integration
- **Custom Icon Design**: Using the standard chat bubble icon consistent with other platforms
- **Advanced Features**: Not implementing voice input integration, image generation support, or conversation mode detection
- **Performance Optimizations**: No caching needed (unlike Gemini's Quill.js caching) since standard textarea lookup is fast
- **Multiple Hostnames**: Only supporting the primary hostname (copilot.microsoft.com), not other Microsoft domains

## Implementation Approach

Use the **Quick Method** with UI updates:
- **Phase 1**: Add platform configuration to `src/config/platforms.ts` + update `manifest.json`
- **Phase 2**: Create icons (React component for Settings + content script icon)
- **Phase 3**: Update Settings UI to display Copilot in "Supported Sites"
- **Phase 4**: Comprehensive testing and verification
- System handles platform detection and injection automatically via existing architecture

**Why Quick Method?**
1. Copilot uses standard `<textarea>` element (not contenteditable, React, ProseMirror, or Quill.js)
2. Default strategy's 3-tier fallback handles textareas perfectly:
   - Tier 1: Native value setter
   - Tier 2: execCommand fallback
   - Tier 3: Direct DOM manipulation
3. No special event handling needed beyond standard input/change events
4. Similar to Perplexity implementation which also uses default strategy

---

## Phase 1: Platform Configuration

### Overview
Add Microsoft Copilot to the centralized platform configuration system and Chrome extension manifest. These changes enable automatic platform detection, strategy selection, content script injection, and permissions for copilot.microsoft.com.

### Changes Required:

#### 1. Platform Definition
**File**: `src/config/platforms.ts`
**Changes**: Add Copilot entry to SUPPORTED_PLATFORMS object

```typescript
export const SUPPORTED_PLATFORMS: Record<string, PlatformDefinition> = {
  // ... existing platforms ...

  copilot: {
    id: 'copilot',
    hostname: 'copilot.microsoft.com',
    displayName: 'Microsoft Copilot',
    priority: 80,
    defaultEnabled: true,
    selectors: [
      'textarea[data-testid="composer-input"]',  // Primary selector - most specific
      'textarea#userInput',                      // Fallback - ID selector
      'textarea[placeholder*="Message"]',        // Pattern match fallback
      'textarea[placeholder*="Copilot"]'         // Additional pattern match
    ],
    buttonContainerSelector: '.flex.gap-2.items-center', // Second occurrence with "Talk to Copilot"
    strategyClass: 'DefaultStrategy',  // Uses default strategy (no custom class needed)
    hostnamePatterns: ['copilot.microsoft']
  }
};
```

**Rationale for Selector Order**:
1. `data-testid="composer-input"` - Most stable, used for automated testing
2. `#userInput` - ID selector, high specificity
3. `placeholder*="Message"` - Catches variations like "Message Copilot"
4. `placeholder*="Copilot"` - Broadest pattern match as final fallback

#### 2. Update Type Definitions
**File**: `src/config/platforms.ts`
**Changes**: Update legacy PlatformName type for TypeScript compatibility

```typescript
export type PlatformName = 'claude' | 'chatgpt' | 'mistral' | 'perplexity' | 'gemini' | 'copilot' | 'default';
```

**Note**: This is a legacy type - new code should use `PlatformDefinition.id` instead.

#### 3. Update Chrome Extension Manifest
**File**: `manifest.json`
**Changes**: Add Copilot URL to host_permissions and content_scripts.matches arrays

```json
{
  "host_permissions": [
    "https://claude.ai/*",
    "https://chatgpt.com/*",
    "https://gemini.google.com/*",
    "https://www.perplexity.ai/*",
    "https://chat.mistral.ai/*",
    "https://copilot.microsoft.com/*"
  ],
  "content_scripts": [
    {
      "matches": [
        "https://claude.ai/*",
        "https://chatgpt.com/*",
        "https://gemini.google.com/*",
        "https://www.perplexity.ai/*",
        "https://chat.mistral.ai/*",
        "https://copilot.microsoft.com/*"
      ],
      "js": ["src/content/index.ts"],
      "run_at": "document_idle",
      "all_frames": false
    }
  ]
}
```

**Critical Importance**: Without these manifest changes:
- Chrome will **block** the content script from running on copilot.microsoft.com
- The extension will have **no permissions** to access Copilot's DOM
- Users will see **no icon** even if all other code is correct

**Why both arrays?**
- `host_permissions`: Grants extension permission to access copilot.microsoft.com domain
- `content_scripts.matches`: Tells Chrome to inject content script on copilot.microsoft.com pages

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compilation succeeds: `npm run build`
- [x] No ESLint errors: `npm run lint`
- [x] All existing tests pass: `npm test`
- [x] Platform configuration exports correctly: Import `SUPPORTED_PLATFORMS` in Node console

#### Manual Verification:
- [ ] Manifest permissions are correctly set: Open `chrome://extensions/` → My Prompt Manager → Details → "Site access" should include copilot.microsoft.com
- [ ] Load extension in Chrome and navigate to copilot.microsoft.com
- [ ] Verify platform is detected (check browser console for "Loaded platform strategy" message)
- [ ] Verify content script injects without errors (no permission errors in console)
- [ ] Verify extension icon appears in Chrome toolbar and can be clicked

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the platform detection works correctly before proceeding to Phase 2.

---

## Phase 2: Icon Creation

### Overview
Create platform-specific icons in two locations:
1. **React Component** (`SiteIcons.tsx`) - Used in Settings UI to display platform logos
2. **Content Script Icon** (`element-factory.ts`) - Used in the actual Copilot page as a clickable button

Both icons represent Microsoft Copilot and follow its visual design language.

### Changes Required:

#### 1. React Icon Component for Settings UI
**File**: `src/components/icons/SiteIcons.tsx`
**Changes**: Add `CopilotIcon` React component

```typescript
export const CopilotIcon: FC<IconProps> = ({ className = '' }) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Microsoft Copilot logo - colorful gradient design */}
    <path
      d="M22.9253 4.97196C22.5214 3.79244 21.4126 3 20.1658 3L18.774 3C17.3622 3 16.1532 4.01106 15.9033 5.40051L14.4509 13.4782L15.0163 11.5829C15.3849 10.347 16.5215 9.5 17.8112 9.5L23.0593 9.5L25.3054 10.809L27.4705 9.5H26.5598C25.313 9.5 24.2042 8.70756 23.8003 7.52804L22.9253 4.97196Z"
      fill="url(#paint0_radial_copilot)"
    />
    <path
      d="M9.39637 27.0147C9.79613 28.2011 10.9084 29 12.1604 29H14.5727C16.1772 29 17.4805 27.704 17.4893 26.0995L17.5315 18.4862L16.9699 20.4033C16.6058 21.6461 15.4659 22.5 14.1708 22.5H8.88959L6.96437 21.0214L4.88007 22.5H5.78013C7.03206 22.5 8.14435 23.299 8.54411 24.4853L9.39637 27.0147Z"
      fill="url(#paint1_radial_copilot)"
    />
    <path
      d="M19.7501 3H8.81266C5.68767 3 3.81268 7.08916 2.56269 11.1783C1.08177 16.0229 -0.856044 22.5021 4.75017 22.5021H9.66051C10.9615 22.5021 12.105 21.6415 12.4657 20.3915C13.2784 17.5759 14.7501 12.4993 15.9014 8.65192C16.4758 6.73249 16.9543 5.08404 17.6886 4.05749C18.1003 3.48196 18.7864 3 19.7501 3Z"
      fill="url(#paint2_radial_copilot)"
    />
    <path
      d="M19.7501 3H8.81266C5.68767 3 3.81268 7.08916 2.56269 11.1783C1.08177 16.0229 -0.856044 22.5021 4.75017 22.5021H9.66051C10.9615 22.5021 12.105 21.6415 12.4657 20.3915C13.2784 17.5759 14.7501 12.4993 15.9014 8.65192C16.4758 6.73249 16.9543 5.08404 17.6886 4.05749C18.1003 3.48196 18.7864 3 19.7501 3Z"
      fill="url(#paint3_linear_copilot)"
    />
    <path
      d="M12.2478 29H23.1852C26.3102 29 28.1852 24.9103 29.4352 20.8207C30.9161 15.9755 32.854 9.49548 27.2477 9.49548H22.3375C21.0364 9.49548 19.893 10.3562 19.5322 11.6062C18.7196 14.4221 17.2479 19.4994 16.0965 23.3474C15.5221 25.2671 15.0436 26.9157 14.3093 27.9424C13.8976 28.518 13.2115 29 12.2478 29Z"
      fill="url(#paint4_radial_copilot)"
    />
    <path
      d="M12.2478 29H23.1852C26.3102 29 28.1852 24.9103 29.4352 20.8207C30.9161 15.9755 32.854 9.49548 27.2477 9.49548H22.3375C21.0364 9.49548 19.893 10.3562 19.5322 11.6062C18.7196 14.4221 17.2479 19.4994 16.0965 23.3474C15.5221 25.2671 15.0436 26.9157 14.3093 27.9424C13.8976 28.518 13.2115 29 12.2478 29Z"
      fill="url(#paint5_linear_copilot)"
    />
    <defs>
      <radialGradient
        id="paint0_radial_copilot"
        cx="0" cy="0" r="1"
        gradientUnits="userSpaceOnUse"
        gradientTransform="matrix(-7.37821 -8.55084 -7.96607 7.17216 25.5747 13.5466)"
      >
        <stop offset="0.0955758" stopColor="#00AEFF"/>
        <stop offset="0.773185" stopColor="#2253CE"/>
        <stop offset="1" stopColor="#0736C4"/>
      </radialGradient>
      <radialGradient
        id="paint1_radial_copilot"
        cx="0" cy="0" r="1"
        gradientUnits="userSpaceOnUse"
        gradientTransform="matrix(6.61516 7.92888 7.80904 -6.47171 7.1753 21.9482)"
      >
        <stop stopColor="#FFB657"/>
        <stop offset="0.633728" stopColor="#FF5F3D"/>
        <stop offset="0.923392" stopColor="#C02B3C"/>
      </radialGradient>
      <radialGradient
        id="paint2_radial_copilot"
        cx="0" cy="0" r="1"
        gradientUnits="userSpaceOnUse"
        gradientTransform="matrix(-0.990905 -17.2799 98.0282 -5.51056 8.54161 22.4952)"
      >
        <stop offset="0.03" stopColor="#FFC800"/>
        <stop offset="0.31" stopColor="#98BD42"/>
        <stop offset="0.49" stopColor="#52B471"/>
        <stop offset="0.843838" stopColor="#0D91E1"/>
      </radialGradient>
      <linearGradient
        id="paint3_linear_copilot"
        x1="9.52186" y1="3" x2="10.3572" y2="22.5029"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#3DCBFF"/>
        <stop offset="0.246674" stopColor="#0588F7" stopOpacity="0"/>
      </linearGradient>
      <radialGradient
        id="paint4_radial_copilot"
        cx="0" cy="0" r="1"
        gradientUnits="userSpaceOnUse"
        gradientTransform="matrix(-8.64067 24.4636 -29.4075 -10.797 27.8096 7.58585)"
      >
        <stop offset="0.0661714" stopColor="#8C48FF"/>
        <stop offset="0.5" stopColor="#F2598A"/>
        <stop offset="0.895833" stopColor="#FFB152"/>
      </radialGradient>
      <linearGradient
        id="paint5_linear_copilot"
        x1="28.6736" y1="8.30469" x2="28.6627" y2="13.617"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0.0581535" stopColor="#F8ADFA"/>
        <stop offset="0.708063" stopColor="#A86EDD" stopOpacity="0"/>
      </linearGradient>
    </defs>
  </svg>
);
```

**Purpose**: This icon appears in the Settings UI under "Supported Sites" section, matching the existing Claude, ChatGPT, Gemini, Mistral, and Perplexity icons.

**Design**: Uses Microsoft's official Copilot logo with colorful gradients (blue, orange, yellow, green, purple, pink).

#### 2. Content Script Icon Factory Method
**File**: `src/content/ui/element-factory.ts`
**Changes**: Add `createCopilotIcon()` method to UIElementFactory class

```typescript
/**
 * Creates Microsoft Copilot-specific icon matching native button styling
 * Follows Copilot's design: rounded-2xl, border, transparent background with hover
 */
createCopilotIcon(): HTMLElement {
  const icon = document.createElement('button');

  // Match Copilot's button classes exactly (from "Quick response" and "Talk to Copilot" buttons)
  icon.className = `prompt-library-integrated-icon relative flex items-center text-foreground-800 fill-foreground-800 active:text-foreground-600 active:fill-foreground-600 dark:active:text-foreground-650 dark:active:fill-foreground-650 bg-transparent safe-hover:bg-black/5 active:bg-black/3 dark:safe-hover:bg-black/30 dark:active:bg-black/20 text-sm justify-center min-h-9 min-w-9 after:rounded-xl after:absolute after:inset-0 after:pointer-events-none after:border after:border-transparent after:contrast-more:border-2 outline-2 outline-offset-1 focus-visible:z-[1] focus-visible:outline focus-visible:outline-stroke-900 h-9 select-none gap-1 rounded-2xl border border-black/8 dark:border-white/8 px-2.5 py-1`;

  icon.setAttribute('type', 'button');
  icon.setAttribute('aria-label', 'Open my prompt manager - Access your saved prompts');
  icon.setAttribute('title', 'My Prompt Manager - Access your saved prompts');
  icon.setAttribute('data-instance-id', this.instanceId);
  icon.setAttribute('tabindex', '0');
  icon.setAttribute('data-dashlane-label', 'true');

  // Create icon SVG (18px consistent sizing)
  const svg = createSVGElement('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    width: '18',
    height: '18',
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

  // Add text label matching Copilot's button pattern
  const textElement = createElement('span', {
    class: 'text-sm'
  });
  textElement.textContent = 'My Prompts';
  icon.appendChild(textElement);

  return icon;
}
```

**Design Decisions**:
- **Styling**: Matches Copilot's "Quick response" button exactly (rounded-2xl, border, transparent background)
- **Icon**: Standard chat bubble with dots (consistent with ChatGPT, Perplexity, Gemini)
- **Size**: 18px SVG (standard across all platforms)
- **Label**: "My Prompts" text (similar to "Quick response" pattern)
- **Dark Mode**: Automatic via `dark:` Tailwind classes in button styling
- **Accessibility**: ARIA labels, keyboard navigation (tabindex="0"), focus states

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compilation succeeds: `npm run build`
- [x] No ESLint errors: `npm run lint`
- [x] All tests pass including UI factory tests: `npm test src/content/ui/__tests__/element-factory.test.ts`

#### Manual Verification:
- [ ] Icon appears in the correct position (after "Quick response" button, before "Talk to Copilot")
- [ ] Icon styling matches Copilot's native buttons (rounded-2xl, border, hover states)
- [ ] Dark mode styling works correctly (test by toggling system theme)
- [ ] Hover states work (background changes on hover)
- [ ] Focus states work (outline appears when tabbing to button)
- [ ] Text label "My Prompts" is visible and properly styled
- [ ] Icon is clickable and accessible via keyboard (Tab + Enter)

**Implementation Note**: After completing this phase and all automated verification passes, test manually on copilot.microsoft.com to verify the icon appears and matches the visual design. Also verify the icon appears correctly in the Settings UI before proceeding to Phase 3.

---

## Phase 3: Settings UI Update

### Overview
Update the Settings page to include Microsoft Copilot in the "Supported Sites" section. This allows users to enable/disable Copilot integration and see it listed alongside other supported platforms.

### Changes Required:

#### 1. Update Settings Component
**File**: Need to identify the Settings view component that displays supported platforms
**Likely locations**:
- `src/components/SettingsView.tsx` or similar
- `src/components/settings/*.tsx`
- Component that renders the platform list in Settings

**Changes**: Add Copilot to the platform display list

```typescript
import { CopilotIcon } from '../icons/SiteIcons';

// In the component that renders supported platforms, add Copilot entry:
const supportedPlatforms = [
  { id: 'claude', name: 'Claude', icon: ClaudeIcon, hostname: 'claude.ai' },
  { id: 'chatgpt', name: 'ChatGPT', icon: ChatGPTIcon, hostname: 'chatgpt.com' },
  { id: 'gemini', name: 'Google Gemini', icon: GeminiIcon, hostname: 'gemini.google.com' },
  { id: 'mistral', name: 'Mistral LeChat', icon: MistralIcon, hostname: 'chat.mistral.ai' },
  { id: 'perplexity', name: 'Perplexity', icon: PerplexityIcon, hostname: 'www.perplexity.ai' },
  { id: 'copilot', name: 'Microsoft Copilot', icon: CopilotIcon, hostname: 'copilot.microsoft.com' }, // ✅ Add this
];
```

**Alternative**: If platforms are loaded from `SUPPORTED_PLATFORMS` config:
```typescript
import { SUPPORTED_PLATFORMS } from '@/config/platforms';
import { ClaudeIcon, ChatGPTIcon, CopilotIcon, GeminiIcon, MistralIcon, PerplexityIcon } from '../icons/SiteIcons';

// Map platform IDs to React icon components
const platformIcons = {
  claude: ClaudeIcon,
  chatgpt: ChatGPTIcon,
  gemini: GeminiIcon,
  mistral: MistralIcon,
  perplexity: PerplexityIcon,
  copilot: CopilotIcon, // ✅ Add this mapping
};
```

**Note**: The exact implementation depends on how the Settings UI currently renders the platform list. The key requirement is to ensure the `CopilotIcon` component is imported and mapped to the `copilot` platform ID.

#### 2. Export Icon from SiteIcons
**File**: `src/components/icons/SiteIcons.tsx`
**Changes**: Ensure `CopilotIcon` is exported (already included in Phase 2, Step 1)

The export should already be present:
```typescript
export const CopilotIcon: FC<IconProps> = ({ className = '' }) => (
  // ... SVG content from Phase 2, Step 1
);
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compilation succeeds: `npm run build`
- [x] No ESLint errors: `npm run lint`
- [x] React component tests pass (if applicable): `npm test`
- [x] `CopilotIcon` is properly exported from `SiteIcons.tsx`

#### Manual Verification:
- [ ] Open extension popup or side panel
- [ ] Navigate to Settings page
- [ ] Locate "Supported Sites" section
- [ ] Verify Microsoft Copilot appears in the list with:
  - ✅ Colorful Copilot logo icon
  - ✅ Text: "Microsoft Copilot"
  - ✅ Hostname: "copilot.microsoft.com"
  - ✅ Toggle switch to enable/disable (if applicable)
  - ✅ Icon renders correctly in both light and dark mode
  - ✅ Copilot is enabled by default (toggle should be ON)
- [ ] Verify existing platforms (Claude, ChatGPT, etc.) still display correctly
- [ ] Toggle Copilot off and verify it disables (icon should not appear on copilot.microsoft.com)
- [ ] Toggle Copilot back on and verify it re-enables (icon should reappear on copilot.microsoft.com)

**Implementation Note**: After verifying the Settings UI displays Copilot correctly and the toggle works, proceed to Phase 4 for comprehensive testing.

---

## Phase 4: Testing & Verification

### Overview
Ensure Copilot integration works correctly across all functionality: icon rendering, prompt insertion, event handling, and edge cases. This phase focuses on both automated test coverage and real-world manual testing.

### Changes Required:

#### 1. Platform Configuration Tests
**File**: `src/config/__tests__/platforms.test.ts`
**Changes**: Add test cases for Copilot platform configuration

```typescript
describe('Copilot Platform Configuration', () => {
  it('should include copilot in SUPPORTED_PLATFORMS', () => {
    expect(SUPPORTED_PLATFORMS.copilot).toBeDefined();
    expect(SUPPORTED_PLATFORMS.copilot.id).toBe('copilot');
    expect(SUPPORTED_PLATFORMS.copilot.hostname).toBe('copilot.microsoft.com');
  });

  it('should have correct priority (80)', () => {
    expect(SUPPORTED_PLATFORMS.copilot.priority).toBe(80);
  });

  it('should be enabled by default', () => {
    expect(SUPPORTED_PLATFORMS.copilot.defaultEnabled).toBe(true);
  });

  it('should have correct selectors', () => {
    const selectors = SUPPORTED_PLATFORMS.copilot.selectors;
    expect(selectors).toContain('textarea[data-testid="composer-input"]');
    expect(selectors).toContain('textarea#userInput');
    expect(selectors).toContain('textarea[placeholder*="Message"]');
  });

  it('should use DefaultStrategy', () => {
    expect(SUPPORTED_PLATFORMS.copilot.strategyClass).toBe('DefaultStrategy');
  });

  it('should be included in default enabled platforms', () => {
    const defaultPlatforms = getDefaultEnabledPlatforms();
    expect(defaultPlatforms).toContain('copilot.microsoft.com');
  });

  it('should be detectable by hostname', () => {
    expect(isHostnameSupported('copilot.microsoft.com')).toBe(true);
  });

  it('should match hostname patterns', () => {
    const patterns = getAllHostnamePatterns();
    expect(patterns).toContain('copilot.microsoft');
  });
});
```

#### 2. UI Element Factory Tests
**File**: `src/content/ui/__tests__/element-factory.test.ts`
**Changes**: Add test cases for Copilot icon creation

```typescript
describe('UIElementFactory - Copilot Icon', () => {
  let factory: UIElementFactory;

  beforeEach(() => {
    factory = new UIElementFactory('test-instance-123');
  });

  it('should create Copilot icon button element', () => {
    const icon = factory.createCopilotIcon();

    expect(icon).toBeDefined();
    expect(icon.tagName).toBe('BUTTON');
    expect(icon.getAttribute('type')).toBe('button');
  });

  it('should include prompt-library-integrated-icon class', () => {
    const icon = factory.createCopilotIcon();
    expect(icon.className).toContain('prompt-library-integrated-icon');
  });

  it('should include Copilot-specific styling classes', () => {
    const icon = factory.createCopilotIcon();
    expect(icon.className).toContain('rounded-2xl');
    expect(icon.className).toContain('border');
    expect(icon.className).toContain('bg-transparent');
  });

  it('should have proper ARIA attributes', () => {
    const icon = factory.createCopilotIcon();

    expect(icon.getAttribute('aria-label')).toContain('Open my prompt manager');
    expect(icon.getAttribute('title')).toContain('My Prompt Manager');
    expect(icon.getAttribute('tabindex')).toBe('0');
  });

  it('should include instance ID', () => {
    const icon = factory.createCopilotIcon();
    expect(icon.getAttribute('data-instance-id')).toBe('test-instance-123');
  });

  it('should contain SVG icon element', () => {
    const icon = factory.createCopilotIcon();
    const svg = icon.querySelector('svg');

    expect(svg).toBeDefined();
    expect(svg?.getAttribute('width')).toBe('18');
    expect(svg?.getAttribute('height')).toBe('18');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
  });

  it('should include text label "My Prompts"', () => {
    const icon = factory.createCopilotIcon();
    const textElement = icon.querySelector('span');

    expect(textElement).toBeDefined();
    expect(textElement?.textContent).toBe('My Prompts');
  });

  it('should have dark mode classes', () => {
    const icon = factory.createCopilotIcon();
    expect(icon.className).toContain('dark:');
  });
});
```

#### 3. Integration Testing
**File**: Manual testing on live site (no automated test file)
**Changes**: None - manual verification only

### Success Criteria:

#### Automated Verification:
- [x] All platform configuration tests pass: `npm test src/config/__tests__/platforms.test.ts`
- [x] All UI factory tests pass: `npm test src/content/ui/__tests__/element-factory.test.ts`
- [x] Full test suite passes: `npm test` (1307 tests passing, up from 1284)
- [x] Test coverage remains above 80%: `npm run test:coverage`
- [x] No ESLint errors: `npm run lint`
- [x] Production build succeeds: `npm run build`

#### Manual Verification:
- [ ] **Icon Rendering**: Icon appears in correct position on copilot.microsoft.com
- [ ] **Visual Consistency**: Icon matches Copilot's native button styling in both light and dark mode
- [ ] **Click Interaction**: Clicking icon opens prompt library modal
- [ ] **Prompt Insertion**: Selecting a prompt inserts text into textarea correctly
- [ ] **State Updates**: After insertion, Copilot's send button becomes enabled (indicates state update worked)
- [ ] **Event Handling**: Input and change events fire correctly (verify via browser DevTools)
- [ ] **Keyboard Navigation**: Icon is accessible via Tab key and activates with Enter/Space
- [ ] **Focus States**: Focus outline appears correctly when tabbing to icon
- [ ] **Multi-line Prompts**: Long prompts with newlines insert correctly without truncation
- [ ] **Special Characters**: Prompts with quotes, apostrophes, and Unicode characters insert correctly
- [ ] **Error Handling**: If insertion fails, error is logged to console (no UI crash)
- [ ] **Performance**: Icon appears within 500ms of page load
- [ ] **No Console Errors**: Browser console shows no errors or warnings
- [ ] **Existing Platforms**: Copilot addition doesn't break existing platform integrations (spot-check Claude, ChatGPT)

**Implementation Note**: After all automated tests pass, perform comprehensive manual testing on copilot.microsoft.com. Test both light and dark modes, multiple prompt types (short/long, special characters), and keyboard accessibility before marking this phase complete.

---

## Testing Strategy

### Unit Tests
**Location**: `src/config/__tests__/platforms.test.ts`, `src/content/ui/__tests__/element-factory.test.ts`

**Coverage**:
1. Platform configuration structure (8 tests)
   - Platform definition exists and is complete
   - Priority value is correct (80)
   - Default enabled status
   - Hostname configuration
   - Selector array completeness
   - Strategy class assignment
   - Hostname pattern matching
   - Default enabled platforms inclusion

2. Icon creation (8 tests)
   - Element creation and type
   - Class name inclusion
   - Copilot-specific styling
   - ARIA attributes
   - Instance ID assignment
   - SVG element presence and sizing
   - Text label content
   - Dark mode class inclusion

**Minimum**: 16 tests total for Copilot integration

### Integration Tests
**Location**: Manual testing on https://copilot.microsoft.com/

**Test Scenarios**:

1. **Icon Placement & Rendering**
   - Load Copilot homepage
   - Verify icon appears after "Quick response" button
   - Check icon styling matches native buttons
   - Test in light mode and dark mode
   - Verify icon is visible and clickable

2. **Prompt Insertion - Basic**
   - Click icon to open prompt library
   - Select a short, single-line prompt
   - Verify text appears in textarea
   - Verify send button becomes enabled
   - Verify cursor position is correct

3. **Prompt Insertion - Edge Cases**
   - Multi-line prompts with newlines
   - Long prompts (500+ characters)
   - Prompts with special characters: quotes, apostrophes, emojis
   - Prompts with HTML-like content: `<div>`, `&nbsp;`
   - Empty prompts (should handle gracefully)

4. **Event Handling**
   - Open browser DevTools console
   - Insert prompt and verify events fire:
     - `input` event with `InputEvent` type
     - `change` event
   - Verify Copilot's UI reacts correctly (send button enables, character count updates)

5. **Accessibility**
   - Tab through page elements
   - Verify icon receives focus
   - Check focus outline is visible
   - Activate icon with Enter key
   - Activate icon with Space key
   - Verify screen reader announces button correctly

6. **Performance**
   - Measure icon appearance time (should be <500ms)
   - Check for memory leaks (open/close modal 10+ times)
   - Verify no performance degradation with large prompt libraries (100+ prompts)

7. **Error Handling**
   - Test with no prompts saved (icon should still appear)
   - Test with network errors (extension should handle gracefully)
   - Test after Copilot DOM changes (icon should re-inject if needed)

8. **Compatibility**
   - Test on Chrome (latest version)
   - Test on Edge (latest version - since it's Chromium-based)
   - Verify no conflicts with other extensions

### Manual Testing Steps

**Setup**:
1. Build extension: `npm run build`
2. Load unpacked extension in Chrome from `dist/` folder
3. Navigate to https://copilot.microsoft.com/
4. Ensure you're signed in (icon appears on authenticated pages)

**Icon Verification**:
1. Wait for page to load completely
2. Locate the composer input area at bottom of page
3. Find the button row with "Open", "Quick response", "Talk to Copilot"
4. Verify "My Prompts" icon appears between "Quick response" and "Talk to Copilot"
5. Check icon styling matches adjacent buttons:
   - Same height (h-9 = 36px)
   - Same border style (rounded-2xl, border-black/8)
   - Same hover effect (background changes on hover)
   - Same spacing (gap-2 = 8px between buttons)

**Insertion Testing**:
1. Click "My Prompts" icon
2. Select a prompt from the modal
3. Verify prompt text appears in the textarea with `id="userInput"`
4. Verify the send button (right side of composer) becomes enabled
5. Try sending the message to ensure Copilot processes it correctly
6. Repeat with different prompt types (short, long, multi-line, special characters)

**Dark Mode Testing**:
1. Toggle system dark mode (macOS: System Preferences > General > Appearance)
2. Reload Copilot page
3. Verify icon colors update correctly:
   - Text color changes to light (dark:text-foreground-600)
   - Hover background changes to light (dark:safe-hover:bg-black/30)
   - Border remains visible (dark:border-white/8)
4. Test prompt insertion works the same in dark mode

**Regression Testing**:
1. Navigate to claude.ai and verify icon still works
2. Navigate to chatgpt.com and verify icon still works
3. Navigate to perplexity.ai and verify icon still works
4. Check browser console for any errors on all platforms

## Performance Considerations

**Icon Injection**:
- Default strategy uses standard DOM queries - no performance impact
- Copilot's `.flex.gap-2.items-center` selector is efficient (direct class match)
- Expected injection time: <100ms

**Content Insertion**:
- Standard textarea value assignment - minimal overhead
- Default strategy's 3-tier fallback ensures reliability:
  1. Native value setter (~1ms)
  2. execCommand fallback (~2-5ms)
  3. Direct DOM manipulation (~1ms)
- Expected insertion time: <10ms for most prompts

**Memory Usage**:
- No custom strategy = no additional memory overhead
- Standard icon element: ~2KB
- No caching needed (unlike Gemini's Quill.js caching)

**Bundle Size Impact**:
- Platform configuration: +15 lines (~500 bytes)
- Icon factory method: +60 lines (~2KB)
- Total impact: ~2.5KB (negligible)

**Comparison to Existing Platforms**:
- Same performance profile as Perplexity (both use default strategy)
- Faster than Claude/Mistral (ProseMirror overhead)
- Faster than Gemini (Quill.js overhead + caching)
- Simpler than ChatGPT (no React-specific handling)

## Migration Notes

**Not Applicable** - This is a new platform addition, not a migration. No existing data or user settings are affected.

**User Impact**:
- Existing users: Icon will appear automatically on next visit to copilot.microsoft.com
- New users: Icon will be available immediately after installation
- No user action required - platform is enabled by default

**Rollback Plan** (if needed):
1. Remove Copilot configuration from `src/config/platforms.ts`
2. Remove `createCopilotIcon()` from `src/content/ui/element-factory.ts`
3. Rebuild extension: `npm run build`
4. Reload extension in Chrome

## References

- Original research: `thoughts/shared/research/2025-11-06-adding-new-platforms.md`
- Platform configuration: `src/config/platforms.ts:1`
- Default strategy: `src/content/platforms/default-strategy.ts:1`
- UI element factory: `src/content/ui/element-factory.ts:1`
- Platform manager: `src/content/platforms/platform-manager.ts:1`
- Similar implementation (Perplexity): `src/content/platforms/perplexity-strategy.ts:1`
- Testing guide: `docs/TESTING.md`
- Architecture documentation: `docs/ARCHITECTURE.md`
- Platform integration guide: `docs/PLATFORM_INTEGRATION.md`

## Open Questions

None - all technical decisions have been made:
- ✅ Input selector confirmed: `textarea[data-testid="composer-input"]`
- ✅ Button container confirmed: `.flex.gap-2.items-center` (second occurrence)
- ✅ Implementation approach: Quick Method (configuration only)
- ✅ Priority level: 80 (same as Perplexity)
- ✅ Strategy: DefaultStrategy (no custom class needed)
- ✅ Icon design: Standard chat bubble matching Copilot's button styling
