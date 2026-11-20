## [Unreleased]


## [2.0.0] - 2026-11-20


### ✨ Added

-  Welcome: three steps at the first opening after a first install (what the extension is for; a Prompt's Variables, filled in when it is inserted with //; Packs to start with), which leave for a Library holding the chosen Packs' Prompts, or for the editor of a new Prompt. Closed early, it resumes at the same step; once finished it never shows again, not after an update nor after Clear All Data; a user who updates never sees it ([#607](https://github.com/spartDev/My-Prompt-Manager/pull/607))
-  Packs: ready-made Prompts in a Category of their own (Product, Engineering, Writing, Hiring; Product and Writing selected), added all together through Admission, with no duplicate ([#607](https://github.com/spartDev/My-Prompt-Manager/pull/607))
-  On a first install, the chat tabs already open get the Prompts button and `//`, as after an update ([#607](https://github.com/spartDev/My-Prompt-Manager/pull/607))
-  What's new: at the first opening after an update to a Release that has Release notes, a sheet over the Library lists them; never on a first install ([#575](https://github.com/spartDev/My-Prompt-Manager/pull/575))
-  Prompt cards in the Library, Pinned Prompts, and Variables: a `{{name}}` in a Prompt's text is filled in when the Prompt is inserted ([#441](https://github.com/spartDev/My-Prompt-Manager/pull/441))
-  Library filter pills (All, Pinned, Most Used, one Category) replace the Category and sort dropdowns ([#442](https://github.com/spartDev/My-Prompt-Manager/pull/442))
-  The Library search is the Atelier 1C pill, reached with Cmd/Ctrl+K, and a search that finds nothing offers to create the Prompt ([#559](https://github.com/spartDev/My-Prompt-Manager/pull/559)); the New button sits beside the search ([#565](https://github.com/spartDev/My-Prompt-Manager/pull/565))
-  The Prompt editor, redesigned after Atelier 1C: one editor for a new Prompt and for an edit, whose New category chip creates a Category without leaving the Prompt ([#518](https://github.com/spartDev/My-Prompt-Manager/pull/518)); it rises as a sheet, with Save, the Category chips and the Variables placed as in the mockup ([#527](https://github.com/spartDev/My-Prompt-Manager/pull/527)), in 400 ms on a gentler curve while the Library recedes under a scrim ([#529](https://github.com/spartDev/My-Prompt-Manager/pull/529))
-  A new Prompt whose text looks like one of the Library shows "This looks familiar" ([#551](https://github.com/spartDev/My-Prompt-Manager/pull/551))
-  Categories, redesigned after Atelier 1C: create and edit a Category in one bottom sheet, and undo a deletion ([#521](https://github.com/spartDev/My-Prompt-Manager/pull/521)); a 12-color Category palette, with a chip text color rule and a safety net ([#447](https://github.com/spartDev/My-Prompt-Manager/pull/447))
-  Settings, redesigned after Atelier 1C: Settings groups of rows with segmented controls and switches ([#530](https://github.com/spartDev/My-Prompt-Manager/pull/530))
-  Analytics, redesigned after Atelier 1C, with a weekday hero, Most used, and Tidy up: the Never used Prompts and the Duplicate pairs, each with a Review button that opens them in the Library ([#540](https://github.com/spartDev/My-Prompt-Manager/pull/540)); the full-page Analytics view takes the same design ([#543](https://github.com/spartDev/My-Prompt-Manager/pull/543))
-  Categories and Analytics take the Settings Section header ([#538](https://github.com/spartDev/My-Prompt-Manager/pull/538))
-  The Atelier 1C Notification: a pill at the top center, turned on or off with one switch ([#519](https://github.com/spartDev/My-Prompt-Manager/pull/519))
-  The Atelier 1C empty states of the Library, Categories and Analytics ([#562](https://github.com/spartDev/My-Prompt-Manager/pull/562))
-  Schibsted Grotesk, self-hosted, is the font of the popup, the side panel and the Analytics page ([#539](https://github.com/spartDev/My-Prompt-Manager/pull/539))
-  A bottom tab bar replaces the floating + button ([#440](https://github.com/spartDev/My-Prompt-Manager/pull/440)); arriving on a Section slides it 26 px in from the side of its tab with a fade ([#531](https://github.com/spartDev/My-Prompt-Manager/pull/531)); the tab bar sits on a white card whose border stays at the end of the scroll ([#544](https://github.com/spartDev/My-Prompt-Manager/pull/544))
-  Light and dark color tokens ([#443](https://github.com/spartDev/My-Prompt-Manager/pull/443)), applied to the app shell and the Library ([#451](https://github.com/spartDev/My-Prompt-Manager/pull/451)), forms, dialogs and Notifications ([#452](https://github.com/spartDev/My-Prompt-Manager/pull/452)), Categories ([#454](https://github.com/spartDev/My-Prompt-Manager/pull/454)), the general Settings ([#455](https://github.com/spartDev/My-Prompt-Manager/pull/455)), the site Settings ([#458](https://github.com/spartDev/My-Prompt-Manager/pull/458)), Analytics ([#460](https://github.com/spartDev/My-Prompt-Manager/pull/460)), and the Prompt selector and Variable form on Platforms ([#461](https://github.com/spartDev/My-Prompt-Manager/pull/461))
-  The Prompt selector on a Platform, redesigned after Atelier 1C, in a shadow root: tabs for All, Pinned, Recent and each Category, a search over the whole Library, and a step that fills in a Prompt's Variables before the Insertion ([#545](https://github.com/spartDev/My-Prompt-Manager/pull/545))
-  Typing `//` in a Platform's input field opens the Prompt selector, and an Insertion is confirmed with Undo and a sweep ([#547](https://github.com/spartDev/My-Prompt-Manager/pull/547)); Tab in the input field goes to Undo while the confirmation shows ([#558](https://github.com/spartDev/My-Prompt-Manager/pull/558))
-  An Insertion puts the Prompt where the caret is, on every Platform ([#560](https://github.com/spartDev/My-Prompt-Manager/pull/560))
-  Icon placement, phase 2: the Prompts button is placed by an anchor chain per Platform, read from its live composer, with a look of its own instead of the Platform's classes ([#553](https://github.com/spartDev/My-Prompt-Manager/pull/553))
-  Icon placement, phase 3: when a Platform's Toolbar changes, its row in Settings offers Place the icon, and `npm run composers:capture` refreshes the composer fixtures from the live Platforms ([#571](https://github.com/spartDev/My-Prompt-Manager/pull/571))
-  Export a Backup through the browser's save dialog (File System Access API), with a download as fallback ([#349](https://github.com/spartDev/My-Prompt-Manager/pull/349))
-  Development: `npm run live:check` runs the `//` and icon-placement checks on the live Platforms ([#588](https://github.com/spartDev/My-Prompt-Manager/pull/588))
-  Development: agent skills and scripts: parallel-claude ([97a062d](https://github.com/spartDev/My-Prompt-Manager/commit/97a062dbf4829eae282404860e14747d1ebb5a77)), vercel-react-best-practices and web-design-guidelines ([41f39e7](https://github.com/spartDev/My-Prompt-Manager/commit/41f39e7fe98654c7225d476281886f6a3ee4d0e1)), `scripts/pr-review.sh` and a /codex-review skill ([#508](https://github.com/spartDev/My-Prompt-Manager/pull/508)), and triage-beads, where Jev judges each ticket and code ranks the backlog ([#580](https://github.com/spartDev/My-Prompt-Manager/pull/580))
-  CI: each pull request's test coverage is posted as one comment, and the coverage floor rises to 80% ([#383](https://github.com/spartDev/My-Prompt-Manager/pull/383))


### 🔄 Changed

-  Minimum Chrome version is now 116 (was 114): the lines under the header and above the tab bar use scroll-driven animations, which Chrome ships from 116 ([#451](https://github.com/spartDev/My-Prompt-Manager/pull/451))
-  The extension also runs at copilot.cloud.microsoft, where M365 Copilot and Copilot send a work account: a new host permission and content script match, `https://copilot.cloud.microsoft/*` ([#576](https://github.com/spartDev/My-Prompt-Manager/pull/576))
-  Debug mode shows the Welcome from its first step at every opening, then What's new, and records nothing about either; the Packs it adds go into the Library, with no duplicate ([#607](https://github.com/spartDev/My-Prompt-Manager/pull/607))
-  What's new never shows during or right after the Welcome ([#607](https://github.com/spartDev/My-Prompt-Manager/pull/607))
-  Analytics: Daily use and Time of day are hand-built pill bars, and Recharts leaves the extension ([#552](https://github.com/spartDev/My-Prompt-Manager/pull/552))
-  Site settings: the popup, the service worker and the content script read them through one module ([#564](https://github.com/spartDev/My-Prompt-Manager/pull/564)); a change is applied to what storage holds, under a lock every surface shares ([#567](https://github.com/spartDev/My-Prompt-Manager/pull/567)); the content script follows them in storage, and the settingsUpdated broadcast goes ([#586](https://github.com/spartDev/My-Prompt-Manager/pull/586))
-  The custom site Edit action, which nothing could show, is removed ([#475](https://github.com/spartDev/My-Prompt-Manager/pull/475)); the unrendered ThemeToggle is deleted ([#491](https://github.com/spartDev/My-Prompt-Manager/pull/491))
-  The manifest drops the unused `author` key ([#494](https://github.com/spartDev/My-Prompt-Manager/pull/494))
-  The encoder logs a deprecation warning for the legacy checksum formats ([#276](https://github.com/spartDev/My-Prompt-Manager/pull/276))
-  Refactoring, with no change in behavior: shared storage utilities ([#252](https://github.com/spartDev/My-Prompt-Manager/pull/252)); useTheme ([#262](https://github.com/spartDev/My-Prompt-Manager/pull/262), [#264](https://github.com/spartDev/My-Prompt-Manager/pull/264)); ErrorType as a string union ([#277](https://github.com/spartDev/My-Prompt-Manager/pull/277)); direct hook imports ([#278](https://github.com/spartDev/My-Prompt-Manager/pull/278)); runtime constants in src/constants ([5202eac](https://github.com/spartDev/My-Prompt-Manager/commit/5202eac4bd1a1279c3b38d699b184bfab84a4ed5)); Dropdown, ColorPicker and the Category selectors ([#286](https://github.com/spartDev/My-Prompt-Manager/pull/286), [#285](https://github.com/spartDev/My-Prompt-Manager/pull/285), [#291](https://github.com/spartDev/My-Prompt-Manager/pull/291)); ViewHeader, InterfaceModeSelector, LibraryView, ErrorBoundary and StorageWarning ([#292](https://github.com/spartDev/My-Prompt-Manager/pull/292), [#293](https://github.com/spartDev/My-Prompt-Manager/pull/293), [#295](https://github.com/spartDev/My-Prompt-Manager/pull/295), [#308](https://github.com/spartDev/My-Prompt-Manager/pull/308), [#309](https://github.com/spartDev/My-Prompt-Manager/pull/309)); native buttons without a redundant onKeyDown ([#300](https://github.com/spartDev/My-Prompt-Manager/pull/300)); type-only imports ([#302](https://github.com/spartDev/My-Prompt-Manager/pull/302)); CategoryManager handlers ([#303](https://github.com/spartDev/My-Prompt-Manager/pull/303)); SiteIntegrationSection split and moved to useReducer ([#322](https://github.com/spartDev/My-Prompt-Manager/pull/322), [#325](https://github.com/spartDev/My-Prompt-Manager/pull/325)); Analytics icons, utilities, tab constants, named constants and chart colors ([b2196ec](https://github.com/spartDev/My-Prompt-Manager/commit/b2196ec27e5d4c8e0068dc2d43b44dd046d4e33b), [#326](https://github.com/spartDev/My-Prompt-Manager/pull/326), [#364](https://github.com/spartDev/My-Prompt-Manager/pull/364), [#366](https://github.com/spartDev/My-Prompt-Manager/pull/366), [#367](https://github.com/spartDev/My-Prompt-Manager/pull/367)); DataStorageSection validation ([#329](https://github.com/spartDev/My-Prompt-Manager/pull/329)); chart helpers and theme hook ([#340](https://github.com/spartDev/My-Prompt-Manager/pull/340), [474529f](https://github.com/spartDev/My-Prompt-Manager/commit/474529f05592d172ee897e264a31beb94ba4f56a)); lazy siteConfigs icons ([#344](https://github.com/spartDev/My-Prompt-Manager/pull/344)); cn() for class composition ([#347](https://github.com/spartDev/My-Prompt-Manager/pull/347)); SettingsIcons ([#351](https://github.com/spartDev/My-Prompt-Manager/pull/351)); useSitePermissions with checkPermission ([#358](https://github.com/spartDev/My-Prompt-Manager/pull/358), [#361](https://github.com/spartDev/My-Prompt-Manager/pull/361)); an ErrorBoundary around the charts ([#360](https://github.com/spartDev/My-Prompt-Manager/pull/360)); site icons and header icons ([#369](https://github.com/spartDev/My-Prompt-Manager/pull/369), [#370](https://github.com/spartDev/My-Prompt-Manager/pull/370), [#371](https://github.com/spartDev/My-Prompt-Manager/pull/371), [#372](https://github.com/spartDev/My-Prompt-Manager/pull/372), [#373](https://github.com/spartDev/My-Prompt-Manager/pull/373), [#374](https://github.com/spartDev/My-Prompt-Manager/pull/374), [#375](https://github.com/spartDev/My-Prompt-Manager/pull/375)); if-then-else instead of `A && B || C` ([#376](https://github.com/spartDev/My-Prompt-Manager/pull/376)); one source for the storage warning levels and one byte formatter ([#497](https://github.com/spartDev/My-Prompt-Manager/pull/497)); the radio group keyboard behavior in useRadioGroup ([#492](https://github.com/spartDev/My-Prompt-Manager/pull/492)); StorageWarning and ConfigurationPreview on useModalFocus ([#526](https://github.com/spartDev/My-Prompt-Manager/pull/526)); the Category sheet on the motion tokens ([#533](https://github.com/spartDev/My-Prompt-Manager/pull/533))
-  Performance, with no change in behavior: safeguards on the O(n²) duplicate detection ([#253](https://github.com/spartDev/My-Prompt-Manager/pull/253)); theme change notification ([#261](https://github.com/spartDev/My-Prompt-Manager/pull/261)); module-scope constants, functions and icons in ConfirmDialog, PromptCard, ToastContainer, ThemeToggle and Settings ([#294](https://github.com/spartDev/My-Prompt-Manager/pull/294), [#301](https://github.com/spartDev/My-Prompt-Manager/pull/301), [4fc14ce](https://github.com/spartDev/My-Prompt-Manager/commit/4fc14ce8623e1e4994b9a5020f9216a0f17172d4), [#306](https://github.com/spartDev/My-Prompt-Manager/pull/306), [#307](https://github.com/spartDev/My-Prompt-Manager/pull/307), [#343](https://github.com/spartDev/My-Prompt-Manager/pull/343)); memoized sort label, storage calculation, enabled types, StorageManager instance, picker URL params and handlers ([#299](https://github.com/spartDev/My-Prompt-Manager/pull/299), [#317](https://github.com/spartDev/My-Prompt-Manager/pull/317), [#324](https://github.com/spartDev/My-Prompt-Manager/pull/324), [#327](https://github.com/spartDev/My-Prompt-Manager/pull/327), [#330](https://github.com/spartDev/My-Prompt-Manager/pull/330), [#331](https://github.com/spartDev/My-Prompt-Manager/pull/331), [#332](https://github.com/spartDev/My-Prompt-Manager/pull/332), [#334](https://github.com/spartDev/My-Prompt-Manager/pull/334), [#345](https://github.com/spartDev/My-Prompt-Manager/pull/345)); tab injection in parallel ([#318](https://github.com/spartDev/My-Prompt-Manager/pull/318)); React.memo on the charts ([#321](https://github.com/spartDev/My-Prompt-Manager/pull/321)); useCallback handlers in AnalyticsDashboard ([#323](https://github.com/spartDev/My-Prompt-Manager/pull/323)); data attributes for the theme buttons ([#333](https://github.com/spartDev/My-Prompt-Manager/pull/333))
-  Lint moves from ESLint to Biome ([#422](https://github.com/spartDev/My-Prompt-Manager/pull/422)), which also sorts imports ([#453](https://github.com/spartDev/My-Prompt-Manager/pull/453))
-  Development: one source of project rules, a design-system skill and the team-maintainer profile ([#484](https://github.com/spartDev/My-Prompt-Manager/pull/484)); `bd update --notes` blocked ([#486](https://github.com/spartDev/My-Prompt-Manager/pull/486)); "Done means green" catches a new lint warning and an e2e type error ([#490](https://github.com/spartDev/My-Prompt-Manager/pull/490)); Tailwind no longer scans .claude/ ([#491](https://github.com/spartDev/My-Prompt-Manager/pull/491)); the build and test configs are type-checked ([#494](https://github.com/spartDev/My-Prompt-Manager/pull/494)); npm prepare keeps the shared core.hooksPath ([#495](https://github.com/spartDev/My-Prompt-Manager/pull/495)); unused project agents and commands removed ([#502](https://github.com/spartDev/My-Prompt-Manager/pull/502)); one user-invoked release skill ([#503](https://github.com/spartDev/My-Prompt-Manager/pull/503)); a beads triage skill, a scratch directory per parallel agent and a contrast script ([#509](https://github.com/spartDev/My-Prompt-Manager/pull/509)); backlog and UI work routed to their skills ([#523](https://github.com/spartDev/My-Prompt-Manager/pull/523)); node_modules checked against the lockfile ([#524](https://github.com/spartDev/My-Prompt-Manager/pull/524)); the project skills match the code again ([#561](https://github.com/spartDev/My-Prompt-Manager/pull/561)); the parallel launchers' claim lock ([#570](https://github.com/spartDev/My-Prompt-Manager/pull/570), [#573](https://github.com/spartDev/My-Prompt-Manager/pull/573)); What's new screenshots out of the repository ([#578](https://github.com/spartDev/My-Prompt-Manager/pull/578)); the composer sanitizer keeps `|=` values and escaped quotes ([#581](https://github.com/spartDev/My-Prompt-Manager/pull/581)); services audit findings, a dev-workflow skill, Claude Code settings, a skill update and the beads file in .gitignore ([6d5a254](https://github.com/spartDev/My-Prompt-Manager/commit/6d5a25487bb866495f1db5e69acf4ebaa15b1ea5), [bfefa27](https://github.com/spartDev/My-Prompt-Manager/commit/bfefa274217f621e039355c2afd44896c7b1d4ad), [8e6ae30](https://github.com/spartDev/My-Prompt-Manager/commit/8e6ae30fc7accf792068d3eb8fa3d10ff7aa6f1c), [54a3131](https://github.com/spartDev/My-Prompt-Manager/commit/54a3131fe00983f1475a426106fe529d976158f8), [d01ae84](https://github.com/spartDev/My-Prompt-Manager/commit/d01ae846ffacfeaed86a595d6658c9b1b1a0b8ce)). Beads syncs of the issue tracker are not listed.
-  CI: a broken dependency pull request is blocked, and Renovate majors no longer fail alone ([#479](https://github.com/spartDev/My-Prompt-Manager/pull/479))


### 🐛 Fixed

-  Welcome: step 2 says Variables, the Notification that ends the Welcome stays 6 s, and Try again after a refused add never goes stale ([#609](https://github.com/spartDev/My-Prompt-Manager/pull/609))
-  Library: Try again on Error Loading Data keeps the keyboard, and malformed stored Categories no longer fail the Library ([#610](https://github.com/spartDev/My-Prompt-Manager/pull/610))
-  A Prompt is delivered Verbatim, and text is admitted once, at the write path ([#434](https://github.com/spartDev/My-Prompt-Manager/pull/434))
-  The Library stays usable when a save fails, and the storage warning opens ([#465](https://github.com/spartDev/My-Prompt-Manager/pull/465))
-  The storage limits count the bytes Chrome stores ([#468](https://github.com/spartDev/My-Prompt-Manager/pull/468)); Settings shows Chrome's real storage use, rounded alike, and the storage warning opens when storage stops an import ([#472](https://github.com/spartDev/My-Prompt-Manager/pull/472))
-  The default Category is written only under the Categories lock ([#476](https://github.com/spartDev/My-Prompt-Manager/pull/476)); Clear All Data runs under the storage locks, and the unused importData goes ([#482](https://github.com/spartDev/My-Prompt-Manager/pull/482))
-  Restoring a Backup creates the Category a Prompt names when neither the Backup nor the Library has it ([#487](https://github.com/spartDev/My-Prompt-Manager/pull/487))
-  The upgrade pass is retried at startup, and the entries a write cannot read are kept ([#500](https://github.com/spartDev/My-Prompt-Manager/pull/500))
-  Prompt statistics use local time throughout, clearing the usage history takes the lock, and usage events have a storage quota ([#251](https://github.com/spartDev/My-Prompt-Manager/pull/251)); a stored 0, "" or false is read back as it is ([#254](https://github.com/spartDev/My-Prompt-Manager/pull/254))
-  Import: Settings lists every skipped item, says how many Prompts a stopped import kept, and counts in the singular ([#507](https://github.com/spartDev/My-Prompt-Manager/pull/507))
-  Site settings are saved only when they change, not when Settings opens ([#477](https://github.com/spartDev/My-Prompt-Manager/pull/477)), and never as the empty settings Settings starts with ([#514](https://github.com/spartDev/My-Prompt-Manager/pull/514)); the stored ones are kept when the Library fails to load ([#515](https://github.com/spartDev/My-Prompt-Manager/pull/515)) or a later load fails, and a Library that could not be read is never counted or exported ([#517](https://github.com/spartDev/My-Prompt-Manager/pull/517))
-  A Platform added in a later Release is on for every user, and the user's Platform choices are kept ([#574](https://github.com/spartDev/My-Prompt-Manager/pull/574))
-  Settings: a Notification replaces alert() ([#315](https://github.com/spartDev/My-Prompt-Manager/pull/315)), and open tabs are notified with Promise.allSettled() ([#316](https://github.com/spartDev/My-Prompt-Manager/pull/316))
-  A refused Category rename shows Admission's reason, and long Category names are no longer cut ([#504](https://github.com/spartDev/My-Prompt-Manager/pull/504))
-  The editor's unsaved-changes state resets when the values match the original ([#287](https://github.com/spartDev/My-Prompt-Manager/pull/287)); the editor sheet rises from the bottom of the side panel, over a Library that stays in place ([#554](https://github.com/spartDev/My-Prompt-Manager/pull/554))
-  Analytics: no -Infinity in the charts ([#338](https://github.com/spartDev/My-Prompt-Manager/pull/338)); relative times keep updating ([#363](https://github.com/spartDev/My-Prompt-Manager/pull/363)); the tabs are fully accessible ([#365](https://github.com/spartDev/My-Prompt-Manager/pull/365)); trend colors no longer lose to a CSS specificity conflict ([#368](https://github.com/spartDev/My-Prompt-Manager/pull/368)); the Usage trend counts local days, the chart axes are readable, and Categories keep their colors ([#478](https://github.com/spartDev/My-Prompt-Manager/pull/478)); the clear-history dialog traps focus and closes on Escape ([#501](https://github.com/spartDev/My-Prompt-Manager/pull/501))
-  The ConfigurationPreview dialog traps focus ([#328](https://github.com/spartDev/My-Prompt-Manager/pull/328))
-  Icon placement, phase 1: the Prompts button is placed again when a Platform re-renders its Toolbar, and anchored on the editor when no Toolbar is found ([#535](https://github.com/spartDev/My-Prompt-Manager/pull/535))
-  Icon placement: a pick survives a service worker restart, and the linked-Platform and popup states are right ([#572](https://github.com/spartDev/My-Prompt-Manager/pull/572)); a tab waiting for its Toolbar or pick keeps the repair another tab's Toolbar would drop ([#582](https://github.com/spartDev/My-Prompt-Manager/pull/582)); an extension update no longer drops a pick that a tab not yet re-injected needs ([#584](https://github.com/spartDev/My-Prompt-Manager/pull/584)); the Copilot row offers the newest repair, and a host that redirects no longer keeps a stale one ([#589](https://github.com/spartDev/My-Prompt-Manager/pull/589))
-  The Prompts button: on Gemini, before the microphone, inside the composer ([#583](https://github.com/spartDev/My-Prompt-Manager/pull/583)); on Mistral, on the action row, before the voice button's wrapper ([#585](https://github.com/spartDev/My-Prompt-Manager/pull/585)); on M365 Copilot, first in the actions, on the field's row ([#603](https://github.com/spartDev/My-Prompt-Manager/pull/603)); none on chatgpt.com/settings, which has no composer ([#587](https://github.com/spartDev/My-Prompt-Manager/pull/587)); on a Platform, only on a textarea or an editable element ([#602](https://github.com/spartDev/My-Prompt-Manager/pull/602))
-  A Prompt keeps its line breaks in the ChatGPT and Mistral editors ([#549](https://github.com/spartDev/My-Prompt-Manager/pull/549)), and is inserted once on Perplexity, with its line breaks ([#550](https://github.com/spartDev/My-Prompt-Manager/pull/550)); `//` typed in Perplexity's empty field opens the Prompt selector ([#579](https://github.com/spartDev/My-Prompt-Manager/pull/579))
-  The Prompt selector stays open on scroll, and an Insertion closes only the selector it came from ([#485](https://github.com/spartDev/My-Prompt-Manager/pull/485))
-  Custom sites: the floating icon has no default button look at rest ([#516](https://github.com/spartDev/My-Prompt-Manager/pull/516)); Pick Element asks to reload the extension after a rebuild Chrome has not reloaded ([#532](https://github.com/spartDev/My-Prompt-Manager/pull/532))
-  Hooks: useToast without a nested setState ([#255](https://github.com/spartDev/My-Prompt-Manager/pull/255)) or an unused timeoutRef ([#258](https://github.com/spartDev/My-Prompt-Manager/pull/258)); useClipboard clears its timer on unmount ([#256](https://github.com/spartDev/My-Prompt-Manager/pull/256)); useSearch drops the no-op clearSearch ([#257](https://github.com/spartDev/My-Prompt-Manager/pull/257)); useCategories' dependency arrays match usePrompts ([#259](https://github.com/spartDev/My-Prompt-Manager/pull/259)); useSort keeps one state object, so no double render ([#260](https://github.com/spartDev/My-Prompt-Manager/pull/260))
-  Types: a generic saveData ([#265](https://github.com/spartDev/My-Prompt-Manager/pull/265)); a shared ToastType that includes 'warning' ([#267](https://github.com/spartDev/My-Prompt-Manager/pull/267)); UsageEvent.platform as a union ([#266](https://github.com/spartDev/My-Prompt-Manager/pull/266)); one SortOrder and SortDirection ([#270](https://github.com/spartDev/My-Prompt-Manager/pull/270)); a shared ViewType ([#271](https://github.com/spartDev/My-Prompt-Manager/pull/271)); Settings in UpdateSettingsMock ([#272](https://github.com/spartDev/My-Prompt-Manager/pull/272)); @deprecated on the legacy CustomSite fields ([#273](https://github.com/spartDev/My-Prompt-Manager/pull/273)); a type guard in getChromeMock ([#274](https://github.com/spartDev/My-Prompt-Manager/pull/274)); an optional validator in loadData ([#275](https://github.com/spartDev/My-Prompt-Manager/pull/275)); a simpler MockMediaQueryList ([#279](https://github.com/spartDev/My-Prompt-Manager/pull/279))
-  Components: SearchBar drops a redundant onKeyDown ([#288](https://github.com/spartDev/My-Prompt-Manager/pull/288)); EditPromptForm drops unused refs ([#289](https://github.com/spartDev/My-Prompt-Manager/pull/289)); the Dropdown keyboard effect has the right dependencies ([#290](https://github.com/spartDev/My-Prompt-Manager/pull/290)); saveSettings, SiteCard and NotificationSection handlers are stable ([#320](https://github.com/spartDev/My-Prompt-Manager/pull/320), [#342](https://github.com/spartDev/My-Prompt-Manager/pull/342), [#346](https://github.com/spartDev/My-Prompt-Manager/pull/346))
-  live:check: icon-steady measures the Prompts button from its anchor ([#597](https://github.com/spartDev/My-Prompt-Manager/pull/597)) and holds the anchor across typing ([#599](https://github.com/spartDev/My-Prompt-Manager/pull/599)); Gemini's field is found again when it is replaced before the click ([#600](https://github.com/spartDev/My-Prompt-Manager/pull/600)); `--stand-in` bypasses the service workers the profile holds ([#601](https://github.com/spartDev/My-Prompt-Manager/pull/601))
-  Agent skills: parallel Claude sessions always create a pull request ([08725f5](https://github.com/spartDev/My-Prompt-Manager/commit/08725f502774e85d2b8a16c6b960e0eac764ee9a)), and a non-interactive cleanup no longer exits with code 1 ([53cc846](https://github.com/spartDev/My-Prompt-Manager/commit/53cc846353a5bdd489ffd609f4b77ecea6d4156d))


### 🔒 Security

-  npm audit findings resolved, to 0 vulnerabilities, and agent worktrees kept out of vitest ([#435](https://github.com/spartDev/My-Prompt-Manager/pull/435)); Renovate pull request CI unblocked by clearing npm audit and peer splits ([#437](https://github.com/spartDev/My-Prompt-Manager/pull/437))
-  CI: the workflow token is read-only, with pull-requests write for the quality gate only ([#520](https://github.com/spartDev/My-Prompt-Manager/pull/520)); the workflows are linted with zizmor and its findings fixed ([#525](https://github.com/spartDev/My-Prompt-Manager/pull/525)); the audit waives the picomatch ReDoS advisory, which has no patched release ([#590](https://github.com/spartDev/My-Prompt-Manager/pull/590))


### 🧪 Testing

-  Unit tests for StorageWarning ([#311](https://github.com/spartDev/My-Prompt-Manager/pull/311)), ThemeToggle ([#310](https://github.com/spartDev/My-Prompt-Manager/pull/310)) and the Settings sections ([#362](https://github.com/spartDev/My-Prompt-Manager/pull/362))
-  Guardrails: README's Chrome version, ViewHeader scroll containers and Playwright locator matchers ([#506](https://github.com/spartDev/My-Prompt-Manager/pull/506)); the custom-site chunk list after every build ([#505](https://github.com/spartDev/My-Prompt-Manager/pull/505)); a 20 s timeout for the Admission guardrails' whole-src scans ([#534](https://github.com/spartDev/My-Prompt-Manager/pull/534))
-  End-to-end: the content script on a custom site and a Backup restore from Settings ([#510](https://github.com/spartDev/My-Prompt-Manager/pull/510)); `npm run test:e2e:linux` runs a spec like Linux CI ([#511](https://github.com/spartDev/My-Prompt-Manager/pull/511)); the Prompt selector by keyboard alone on a custom site ([#548](https://github.com/spartDev/My-Prompt-Manager/pull/548)); Lexical stand-ins for Perplexity and copilot.cloud.microsoft ([#595](https://github.com/spartDev/My-Prompt-Manager/pull/595)), emptied by live:check's cleanup ([#596](https://github.com/spartDev/My-Prompt-Manager/pull/596)); steadier hover ([#499](https://github.com/spartDev/My-Prompt-Manager/pull/499), [#557](https://github.com/spartDev/My-Prompt-Manager/pull/557)), ranking ([#546](https://github.com/spartDev/My-Prompt-Manager/pull/546)) and `//` typing ([#556](https://github.com/spartDev/My-Prompt-Manager/pull/556)) checks; hostnames validated by URL parsing ([#381](https://github.com/spartDev/My-Prompt-Manager/pull/381))


### 📚 Documentation

-  CLAUDE.md slimmed, with the coding rules in CODING_STANDARDS.md ([#469](https://github.com/spartDev/My-Prompt-Manager/pull/469)), after a progressive disclosure pass ([#355](https://github.com/spartDev/My-Prompt-Manager/pull/355)); a session ends on green checks and hands off in beads, with a pull request template that matches real pull requests ([#489](https://github.com/spartDev/My-Prompt-Manager/pull/489)); the real merge gate and Renovate setup ([#493](https://github.com/spartDev/My-Prompt-Manager/pull/493)); COMPONENTS, SERVICES_AND_HOOKS and TESTING point at the source ([#496](https://github.com/spartDev/My-Prompt-Manager/pull/496)); the Forms rule routed to PromptEditor, and the paths of every routed doc guarded ([#522](https://github.com/spartDev/My-Prompt-Manager/pull/522))
-  Code comments: useDropdownClose's onClose stability ([#263](https://github.com/spartDev/My-Prompt-Manager/pull/263)); useCallback wrappers for async handlers ([#339](https://github.com/spartDev/My-Prompt-Manager/pull/339), [#341](https://github.com/spartDev/My-Prompt-Manager/pull/341)); usePickerWindow's empty deps ([#348](https://github.com/spartDev/My-Prompt-Manager/pull/348)); JSDoc on Settings' async functions ([#352](https://github.com/spartDev/My-Prompt-Manager/pull/352)); removeTypedTrigger blames Copilot's / menu ([#598](https://github.com/spartDev/My-Prompt-Manager/pull/598))
-  README: Node.js 22 or later ([655661d](https://github.com/spartDev/My-Prompt-Manager/commit/655661de3d163774e2c1cc2f83b1593edc9a8607)); the parallel-claude skill guide ([bbd884e](https://github.com/spartDev/My-Prompt-Manager/commit/bbd884e049a312376eb32e9af5ae214f52c67f3b))


### 📦 Dependencies

-  90 dependency updates, most of them from Renovate, among them Vite 8 with Rolldown and @vitejs/plugin-react 6 ([#483](https://github.com/spartDev/My-Prompt-Manager/pull/483)), @crxjs/vite-plugin 3.0.0 ([#456](https://github.com/spartDev/My-Prompt-Manager/pull/456)), React 19.3.1, Tailwind CSS 4.3.5, Playwright 1.65.0, Vitest 4.1.12, Biome 2.6.8 and Node.js 22.23.5 ([#555](https://github.com/spartDev/My-Prompt-Manager/pull/555)). The full list is in the [compare view](https://github.com/spartDev/My-Prompt-Manager/compare/v1.9.0...v2.0.0)

[2.0.0]: https://github.com/spartDev/My-Prompt-Manager/compare/v1.9.0...v2.0.0


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

