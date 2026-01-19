## [Unreleased]


## [1.9.0] - 2026-01-19


### ✨ Added

-  Usage Analytics Dashboard with interactive charts and visualizations ([#241](https://github.com/spartDev/My-Prompt-Manager/pull/241))
-  Recharts integration for usage tracking charts ([#241](https://github.com/spartDev/My-Prompt-Manager/pull/241))
-  UsageTracker service for tracking prompt usage across platforms
-  AnalyticsTab component for displaying usage statistics
-  Floating action button for quick access to analytics ([#244](https://github.com/spartDev/My-Prompt-Manager/pull/244))


### 🔄 Changed

-  Replace footer navigation with floating action button for better UX ([#244](https://github.com/spartDev/My-Prompt-Manager/pull/244))
-  Refactor E2E tests for improved reliability and maintainability ([#233](https://github.com/spartDev/My-Prompt-Manager/pull/233))


### 🐛 Fixed

-  Remove reference to non-existent SELECTORS export in E2E tests


### 📚 Documentation

-  Add Microsoft 365 Copilot to supported platforms table
-  Update README to reflect current codebase state ([#247](https://github.com/spartDev/My-Prompt-Manager/pull/247))
-  Add beads workflow guide and session completion protocol


### 📦 Dependencies

-  Update TypeScript and linting to 8.53.0 ([#243](https://github.com/spartDev/My-Prompt-Manager/pull/243))
-  Update testing libraries (Vitest 4.0.17, Testing Library 16.3.1) ([#153](https://github.com/spartDev/My-Prompt-Manager/pull/153))
-  Update happy-dom to 20.3.1 ([#240](https://github.com/spartDev/My-Prompt-Manager/pull/240))
-  Update @types/react to 19.2.8 ([#239](https://github.com/spartDev/My-Prompt-Manager/pull/239))
-  Update @types/chrome to 0.1.33 ([#237](https://github.com/spartDev/My-Prompt-Manager/pull/237))
-  Pin dependencies for reproducible builds ([#214](https://github.com/spartDev/My-Prompt-Manager/pull/214))

[1.9.0]: https://github.com/spartDev/My-Prompt-Manager/compare/v1.8.2...v1.9.0


## [1.8.2] - 2026-01-12


### ✨ Added

-  Migrate to Tailwind CSS v4 for improved styling and performance ([#211](https://github.com/spartDev/My-Prompt-Manager/pull/211))
-  Replace native select with custom Dropdown component in AddPromptForm ([#205](https://github.com/spartDev/My-Prompt-Manager/pull/205))


### 🐛 Fixed

-  Increase MAX_PROMPT_SIZE and add validation on update ([#230](https://github.com/spartDev/My-Prompt-Manager/pull/230))
-  Resolve race condition in StorageManager mutex implementation ([#197](https://github.com/spartDev/My-Prompt-Manager/pull/197))


### 🧪 Testing

-  Add comprehensive E2E tests for MAX_PROMPT_SIZE fix
-  Improve test coverage and stability ([#192](https://github.com/spartDev/My-Prompt-Manager/pull/192))


### 📚 Documentation

-  Optimize CLAUDE.md for AI agent onboarding ([#215](https://github.com/spartDev/My-Prompt-Manager/pull/215))


### 📦 Dependencies

-  Update React packages to 19.2.3 ([#227](https://github.com/spartDev/My-Prompt-Manager/pull/227))
-  Update TypeScript and linting to 8.52.0 ([#228](https://github.com/spartDev/My-Prompt-Manager/pull/228))
-  Update ESLint to 9.39.2 ([#226](https://github.com/spartDev/My-Prompt-Manager/pull/226))
-  Update DOMPurify to 3.3.1 ([#217](https://github.com/spartDev/My-Prompt-Manager/pull/217))
-  Update Vite to 7.2.7 ([#216](https://github.com/spartDev/My-Prompt-Manager/pull/216))
-  Update Playwright monorepo to 1.57.0 ([#202](https://github.com/spartDev/My-Prompt-Manager/pull/202))

[1.8.2]: https://github.com/spartDev/My-Prompt-Manager/compare/v1.8.1...v1.8.2


## [1.8.1] - 2025-11-17


### 🐛 Fixed

-  Add Microsoft 365 Copilot support and enhance icon styling ([#173](https://github.com/spartDev/My-Prompt-Manager/pull/173))
-  replace WeakMap with Map for icon cleanup tracking ([a09332d](https://github.com/spartDev/My-Prompt-Manager/commit/a09332d))


### 🔄 Changed

-  use color-scheme property for Copilot theme detection ([a6d8b1e](https://github.com/spartDev/My-Prompt-Manager/commit/a6d8b1e))
-  Add iconMethod field to PlatformManager to eliminate special case ([#165](https://github.com/spartDev/My-Prompt-Manager/pull/165))


### 🧪 Testing

-  Consolidate repeated mock configurations in Copilot tests ([#168](https://github.com/spartDev/My-Prompt-Manager/pull/168))
-  Add localStorage mock to test setup for improved compatibility


### 📦 Dependencies

-  update typescript and linting to 8.46.4 ([#176](https://github.com/spartDev/My-Prompt-Manager/pull/176))
-  update autoprefixer to 10.4.22 ([#175](https://github.com/spartDev/My-Prompt-Manager/pull/175))
-  update github/codeql-action digest to 014f16e ([#174](https://github.com/spartDev/My-Prompt-Manager/pull/174))
-  update actions/dependency-review-action digest to 3c4e3dc ([#170](https://github.com/spartDev/My-Prompt-Manager/pull/170))

[1.8.1]: https://github.com/spartDev/My-Prompt-Manager/compare/v1.8.0...v1.8.1


## [1.8.0] - 2025-11-10


### 🔒 Security

-  add new agents for data integrity, performance analysis, style editing, and security auditing ([3872bd9](https://github.com/spartDev/My-Prompt-Manager/commit/3872bd9417b302d756a9bd42a22677009595575a))


### ✨ Added

-  Add Microsoft Copilot platform support  ([#160](https://github.com/spartDev/My-Prompt-Manager/pull/160))
-  Usage Counter & Smart Sorting with Session Persistence  ([#141](https://github.com/spartDev/My-Prompt-Manager/pull/141))
-  Enhance dropdown menu UX with distinct selected and focused states  ([#128](https://github.com/spartDev/My-Prompt-Manager/pull/128))
-  🎨 Implement Custom Dropdown Component with Flexible Pattern  ([#126](https://github.com/spartDev/My-Prompt-Manager/pull/126))


### 🔄 Changed

-  Add Claude Code slash commands and platform integration guide  ([#163](https://github.com/spartDev/My-Prompt-Manager/pull/163))
-  update documentation for project structure and best practices ([ac0a032](https://github.com/spartDev/My-Prompt-Manager/commit/ac0a03243af59b56d431f7a741f6cd8a5cca9348))


### 🐛 Fixed

-  category badge colors were not accessible  ([#145](https://github.com/spartDev/My-Prompt-Manager/pull/145))
-  correct heredoc syntax in release workflow summary ([5401c06](https://github.com/spartDev/My-Prompt-Manager/commit/5401c0644948a6dc2b1c76815417ad562441445e))

[1.8.0]: https://github.com/spartDev/My-Prompt-Manager/compare/v1.7.0...v1.8.0

## Release v1.7.0

### ✨ Added

- Icon-Based Compact Filter/Sort Controls for Mobile-First UI ([#114](https://github.com/spartDev/My-Prompt-Manager/pull/114))
- Claude Code skills system for project workflows ([#112](https://github.com/spartDev/My-Prompt-Manager/pull/112))
- TypeScript type-checking job to pr-checks workflow ([#113](https://github.com/spartDev/My-Prompt-Manager/pull/113))
- Release automation skill with changelog generation ([#123](https://github.com/spartDev/My-Prompt-Manager/pull/123))
- Enhanced release format with project branding and emojis ([#124](https://github.com/spartDev/My-Prompt-Manager/pull/124))
- Increased prompt character limit from 10K to 20K ([#103](https://github.com/spartDev/My-Prompt-Manager/pull/103))

### 🔄 Changed

- Disabled watch mode in Vitest configuration ([#115](https://github.com/spartDev/My-Prompt-Manager/pull/115))
- Updated DOMPurify to 3.3.0 ([#111](https://github.com/spartDev/My-Prompt-Manager/pull/111))
- Updated allowed licenses in dependency review action ([#122](https://github.com/spartDev/My-Prompt-Manager/pull/122))
- Updated eslint-plugin-react-hooks to 7.0.0 ([#93](https://github.com/spartDev/My-Prompt-Manager/pull/93))
- Updated testing libraries ([#119](https://github.com/spartDev/My-Prompt-Manager/pull/119))
- Updated Playwright monorepo to 1.56.1 ([#118](https://github.com/spartDev/My-Prompt-Manager/pull/118))
- Updated multiple dependencies including Vite to 7.1.10, happy-dom to 20.0.5, lint-staged to 16.2.4, and various @types packages
- Removed deprecated @types/uuid and @types/dompurify dependencies ([#106](https://github.com/spartDev/My-Prompt-Manager/pull/106), [#105](https://github.com/spartDev/My-Prompt-Manager/pull/105))

### 🐛 Fixed

- Adjusted padding in LibraryView and ViewHeader components ([#102](https://github.com/spartDev/My-Prompt-Manager/pull/102))

### 📚 Documentation

- Added historical release changelogs (v1.0.1 to v1.6.0)
- Updated tech stack versions and test counts ([#100](https://github.com/spartDev/My-Prompt-Manager/pull/100))
- Updated Chrome Web Store description for v1.6.0

**Full Changelog**: https://github.com/spartDev/My-Prompt-Manager/compare/v1.6.0...v1.7.0

## Release v1.6.0

### ✨ Added

- **MPM-4**: Add Import Mode to AddPromptForm for Shared Prompts ([#96](https://github.com/spartDev/My-Prompt-Manager/pull/96))
- **MPM-3**: Add Share Button to PromptCard Component ([#95](https://github.com/spartDev/My-Prompt-Manager/pull/95))
- **MPM-2**: Implement PromptEncoder Service for Secure Prompt Sharing ([#94](https://github.com/spartDev/My-Prompt-Manager/pull/94))
- Migrate to React 19 with useActionState and useOptimistic ([#88](https://github.com/spartDev/My-Prompt-Manager/pull/88))
- Add Google Gemini (gemini.google.com) Platform Integration ([#79](https://github.com/spartDev/My-Prompt-Manager/pull/79))

### 🔄 Changed

- **PromptCard**: Convert copy button to icon-only design ([#89](https://github.com/spartDev/My-Prompt-Manager/pull/89))
- Unify header components with consistent navigation patterns ([#70](https://github.com/spartDev/My-Prompt-Manager/pull/70))

### 🐛 Fixed

- resolve workflow secrets context error in release.yml ([#97](https://github.com/spartDev/My-Prompt-Manager/pull/97))

**Full Changelog**: https://github.com/spartDev/My-Prompt-Manager/compare/v1.5.0...v1.6.0

## Release v1.5.0

### ✨ Added

- Hybrid Positioning System with Element Fingerprinting ([#65](https://github.com/spartDev/My-Prompt-Manager/pull/65))
- Phase 1-1 - Centralized Logger Implementation ([#64](https://github.com/spartDev/My-Prompt-Manager/pull/64))
- Enhanced notification system with improved UX and customization ([#54](https://github.com/spartDev/My-Prompt-Manager/pull/54))
- Enhanced Category Management with Improved Color Picker UX ([#52](https://github.com/spartDev/My-Prompt-Manager/pull/52))

### 🐛 Fixed

- Update Claude.ai integration for new UI layout ([#67](https://github.com/spartDev/My-Prompt-Manager/pull/67))

**Full Changelog**: https://github.com/spartDev/My-Prompt-Manager/compare/v1.4.2...v1.5.0

## Release v1.4.2

### 🐛 Fixed

- custom site icons now persist after page reload ([#50](https://github.com/spartDev/My-Prompt-Manager/pull/50))

**Full Changelog**: https://github.com/spartDev/My-Prompt-Manager/compare/v1.4.1...v1.4.2

## Release v1.4.1

Initial release or maintenance update.

## Release v1.4.0

### ✨ Added

- 🚀 Add Mistral LeChat Platform Support ([#46](https://github.com/spartDev/My-Prompt-Manager/pull/46))

**Full Changelog**: https://github.com/spartDev/My-Prompt-Manager/compare/v1.3.0...v1.4.0

## Release v1.3.0

### ✨ Added

- share custom website configurations ([#41](https://github.com/spartDev/My-Prompt-Manager/pull/41))

### 🐛 Fixed

- prevent race condition in deleteCategory storage operation ([#42](https://github.com/spartDev/My-Prompt-Manager/pull/42))

**Full Changelog**: https://github.com/spartDev/My-Prompt-Manager/compare/v1.2.1...v1.3.0

## Release v1.2.1

### ✨ Added

- Change default interface mode from popup to sidepanel ([#24](https://github.com/spartDev/My-Prompt-Manager/pull/24))
- 🔒 Migrate to programmatic content script injection ([#18](https://github.com/spartDev/My-Prompt-Manager/pull/18))
- 🔒 Implement comprehensive security safeguards for element picker ([#17](https://github.com/spartDev/My-Prompt-Manager/pull/17))
- 🎨 Implement Brand-Specific Background Colors for Site Icons ([#15](https://github.com/spartDev/My-Prompt-Manager/pull/15))
- 🚀 Add Chrome Side Panel Support with Enhanced Settings UI ([#14](https://github.com/spartDev/My-Prompt-Manager/pull/14))

### 🐛 Fixed

- resolve element picker content script injection in Chrome Web Store ([#28](https://github.com/spartDev/My-Prompt-Manager/pull/28))
- 🐛 Correct interface mode setting display to match actual default ([#27](https://github.com/spartDev/My-Prompt-Manager/pull/27))
- 🔧 Update Perplexity button selector for new DOM structure ([#21](https://github.com/spartDev/My-Prompt-Manager/pull/21))
- 🔄 Improve extension reload handling and prevent duplicate icons ([#20](https://github.com/spartDev/My-Prompt-Manager/pull/20))
- 🔧 Fix backup & restore functionality and view refresh ([#19](https://github.com/spartDev/My-Prompt-Manager/pull/19))

**Full Changelog**: https://github.com/spartDev/My-Prompt-Manager/compare/v1.0.2...v1.2.1

## Release v1.0.2

### ✨ Added

- Enhance release workflow with security and performance improvements ([#12](https://github.com/spartDev/My-Prompt-Manager/pull/12))

### 🐛 Fixed

- add theme-aware hover states for custom site icons ([#11](https://github.com/spartDev/My-Prompt-Manager/pull/11))
- improve PR workflow handling of cancelled jobs ([#10](https://github.com/spartDev/My-Prompt-Manager/pull/10))

**Full Changelog**: https://github.com/spartDev/My-Prompt-Manager/compare/v1.0.1...v1.0.2

## Release v1.0.1

### ✨ Added

- Add Comprehensive GitHub Actions CI/CD Pipeline ([#2](https://github.com/spartDev/My-Prompt-Manager/pull/2))
- implement light/dark mode synchronization between popup and content script ([ed6e6d1](https://github.com/spartDev/My-Prompt-Manager/commit/ed6e6d1ac38db092dc51ce54d294fcdac47879b3))
- Update ChatGPT icon design and positioning ([7d7d458](https://github.com/spartDev/My-Prompt-Manager/commit/7d7d4589f31a5a6bb292907b74dcf5c618d68931))
- Update homepage URL to actual repository ([480b705](https://github.com/spartDev/My-Prompt-Manager/commit/480b705cb1533e05d6c4d16f4e32f9af79e591bb))
- Update My Prompt Manager icon to chat bubble design ([35080cb](https://github.com/spartDev/My-Prompt-Manager/commit/35080cba3027678da8a4e949f11045622183340b))
- Add consistent separator between Site Integration and Advanced Options ([f5644f8](https://github.com/spartDev/My-Prompt-Manager/commit/f5644f8660a0a020211acada7d85c6970abfca47))
- Improve custom site tile UI and reorganize site management ([35b4e81](https://github.com/spartDev/My-Prompt-Manager/commit/35b4e81ba5c84c161baffd1a572c03b0668c082b))
- Remove Sanofi Concierge integration completely ([1035822](https://github.com/spartDev/My-Prompt-Manager/commit/1035822af16e838234aecad32391870fc83d2975))
- Update extension icons with improved design ([1caf691](https://github.com/spartDev/My-Prompt-Manager/commit/1caf691bf484d779e3aa035b04b5c38bc6166c63))
- Add visual separators between settings sections ([955dcc9](https://github.com/spartDev/My-Prompt-Manager/commit/955dcc9fe9647a341dc0c59abb23bf6c9230b8ff))

_...and 25 more features_

### 🔄 Changed

- streamline CLAUDE.md and remove obsolete documentation ([#5](https://github.com/spartDev/My-Prompt-Manager/pull/5))
- complete content script modularization and achieve 99.6% test coverage ([#1](https://github.com/spartDev/My-Prompt-Manager/pull/1))
- Add search debouncing to improve performance ([aebf0bc](https://github.com/spartDev/My-Prompt-Manager/commit/aebf0bcf09b4ef31600002a54ce30f0c093bbc1b))
- Add React.memo optimization to frequently re-rendered components ([3018f86](https://github.com/spartDev/My-Prompt-Manager/commit/3018f86fd339da629f9d07dc2b98a4997b995fac))
- Remove footer and back button from CategoryManager ([e08115c](https://github.com/spartDev/My-Prompt-Manager/commit/e08115c518846ed5362b3017b4897e8b01fde107))

_...and 12 more improvements_

### 🐛 Fixed

- remove unused scripting permission for Chrome Web Store compliance ([#7](https://github.com/spartDev/My-Prompt-Manager/pull/7))
- implement proper site enable/disable functionality with settings-based debug mode ([474065c](https://github.com/spartDev/My-Prompt-Manager/commit/474065cbb48862691c25939aaabd23494781c0f8))
- Prevent icon from appearing on unsupported sites ([26e39d2](https://github.com/spartDev/My-Prompt-Manager/commit/26e39d2e74b869c540c480160f3c7518d5b9a983))
- Add consistent code formatting for onClick handlers ([3255fd4](https://github.com/spartDev/My-Prompt-Manager/commit/3255fd4f14ee4184656a34a40c2dadbdfebdd001))
- Resolve ESLint violations in SettingsView component ([51285d0](https://github.com/spartDev/My-Prompt-Manager/commit/51285d09000dcfa3243ed1b6eae24b18f316b1f6))
- Resolve custom icon positioning errors and infinite loop ([a701a07](https://github.com/spartDev/My-Prompt-Manager/commit/a701a07cc89be0c8031f32e95c4c10f62dd0a075))
- Resolve build syntax errors and CSS selector generation issues ([a2b09d5](https://github.com/spartDev/My-Prompt-Manager/commit/a2b09d508c0023204bcc36c271a66164a52bd403))
- Resolve memory leak in untracked outside click event listeners ([e7cb093](https://github.com/spartDev/My-Prompt-Manager/commit/e7cb093dbfbd6d0f8108064fc7b9a24846eacd10))
- Resolve all ESLint errors in content.js ([9e751bf](https://github.com/spartDev/My-Prompt-Manager/commit/9e751bfe5d84f72dfb843a655e850f7c46114714))
- Apply pb-24 padding only when PromptCards are present ([23ef088](https://github.com/spartDev/My-Prompt-Manager/commit/23ef088c1ece9b59644176413a6d192ae4868bc7))

_...and 24 more bug fixes_

