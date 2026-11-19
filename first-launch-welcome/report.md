# Welcome: every numeric target measured on the final tree (My-Prompt-Manager-ojz.16)

Commit 327ea6c5 of first-launch/ojz-16 (first-launch/integration with origin/main merged in). Machine: Apple M1 Pro, 10 cores, 32 GiB, Darwin 25.5.0, Node v25.3.0; HeadlessChrome/158.0.0.0, headless with the e2e suite's CI flags. Every timed sample records the 1-minute load average; the load of each kept series is given beside it. Targets 6 to 9 come from the full e2e run on the same commit.

| # | Target | Measured value | Tool | Met |
|---|---|---|---|---|
| 1 | Full journey, reading each screen: under 45 s | median **40.6 s** (40.58-40.64), 5 runs: 29 + 46 + 42 + 9 words at 238 wpm = 31.8 s, step 2's typing demo watched to its end 4.8 s, 3 actions x 1.3 s (KLM) = 3.9 s, machine 169.7 ms; load 7.2-9.2 | Playwright, reading model (measures.spec.ts) | yes |
| 2 | Actions from the opening to a ready Library: at most 2 | **2** (Skip, Add 9 prompts) | test helper act, every click counted | yes |
| 3 | First Prompt copied after the first opening, through a Pack: under 60 s | reading every screen (Next, Next, Add 9 prompts, Copy): median **55.4 s** (55.41-55.47); the shortest path (Skip, Add 9 prompts, Copy): median 37.7 s (37.72-37.76); 5 runs each, clipboard read back; load 5.6-6.1 | Playwright, reading model | yes |
| 4 | Clicks to copy a Prompt after the Welcome: at most 2 | **1** (Copy) | test helper act | yes |
| 5 | Welcome displayed and usable within 200 ms of the popup opening | fully opaque, medians of 10. From the surface's own start (navigation start): **104.8-171.5 ms** over the seven series. From the user's click or open request: side panel (sidePanel.open from a page button, not the icon) **117.1 ms**; action popup, icon pinned **164.1 ms**; action popup, icon not pinned **432.1 ms**, of which Chrome's own share before the popup's navigation starts 279.9 ms (270.8-284.1) | display probe (rAF, elementFromPoint, opacity) | from the surface's start: yes; side panel from the click: yes; pinned popup from the click: yes; unpinned popup from the open request: **no** |
| 6 | Exits on an empty Library with no next step: 0 | **0** failures in 7 tests | Playwright e2e, scenarios.spec.ts | yes |
| 7 | Reappearances once finished: 0 | **0** failures in 4 tests | Playwright e2e, scenarios.spec.ts | yes |
| 8 | Displays to existing users: 0 | **0** failures in 5 tests | Playwright e2e, scenarios.spec.ts + launch-decision.spec.ts | yes |
| 9 | Automated accessibility issues: 0 | **0** violations over 16 audits | @axe-core/playwright 4.14.0, wcag2a/2aa/21a/21aa/22aa (welcome-a11y.spec.ts) | yes |

## Display (target 5)

Fully opaque is what "displayed" means (review of .7); the primary button is hit-testable earlier, at opacity 0.

| Series | Hit-testable | First opacity > 0 | Fully opaque | Load 1 min |
|---|---|---|---|---|
| Popup 400x500, tab, 10 openings in one browser, from navigation start | 28.9 ms (24.4-65.7) | 46.1 ms (40.6-108.9) | 129.4 ms (123.6-191.2) | 6.9-7.1 |
| Side panel 360x720, tab, 10 openings in one browser, from navigation start | 25.8 ms (22.9-41.1) | 43.1 ms (37-62.4) | 126.1 ms (119.2-145.6) | 6.9-6.9 |
| Popup, tab, first opening of 10 fresh browsers, from navigation start | 55.9 ms (43.3-138.2) | 82.2 ms (74.1-151.8) | 164.7 ms (157.1-234.8) | 5.5-7 |
| Side panel, tab, first opening of 10 fresh browsers, from navigation start | 58.9 ms (53-63.4) | 88.8 ms (76-97.5) | 171.5 ms (159.1-180.4) | 4.7-5.5 |
| Real popup, its action pinned (chrome.action.openPopup), 10 fresh browsers, **from the open request** (navigation starts at 14.4 ms (8.8-20.5)) | 63.5 ms (61.6-78.5) | 80.3 ms (78.7-96.3) | 164.1 ms (162.2-179.5) | 3.9-5.1 |
| Real popup, its action not pinned (chrome.action.openPopup), 10 fresh browsers, **from the open request** (navigation starts at 279.9 ms (270.8-284.1)) | 327.7 ms (315.9-356.5) | 348 ms (332-373.3) | 432.1 ms (414.2-456.6) | 5.1-6 |
| Real side panel (sidePanel.open on a page button's click), 10 fresh browsers, **from the click** (navigation starts at 12.6 ms (6.3-14.6)) | 71.4 ms (57.7-73.1) | 71.4 ms (57.7-73.1) | 117.1 ms (113.8-130.4) | 3.6-4.9 |

Opening fade: 100 ms. Real surfaces, opaque from their own navigation start: popup 155.2 ms (137.2-172.5), pinned popup 154.1 ms (141.7-159.6), side panel 104.8 ms (103.1-117.1).

Open question for the user: the target says "après l'ouverture de la popup". The coordinator read it as from the surface's own start (the .7 / .13 plan). From the click, only the unpinned action popup misses, by Chrome's own share before any extension code runs; pinned, Chrome's share falls to 14.4 ms.

## Journey and first copy (targets 1 to 4)

| Screen | Words (rendered) |
|---|---|
| journey: step 1 | 29 |
| journey: step 2 | 46 |
| journey: step 3 | 42 |
| journey: the Library: the Notification | 9 |
| first copy: step 1 | 29 |
| first copy: step 3 | 42 |
| first copy: the Library: the Notification and the first card | 59 |
| first copy: the clipboard holds the Prompt | 0 |

Journey: Next, Next, Add 9 prompts; machine time 169.7 ms (153.9-211.9) (test clock); load 7.2-9.2. Every screen read, then the copy: Next, Next, Add 9 prompts, Copy; machine 1097.1 ms (1080-1145.7). Shortest path: Skip, Add 9 prompts, Copy; machine 1056.3 ms (1051.1-1089) by the test clock, of which the copy 934.9 ms (930.3-941.3) (the click call alone 931.8 ms (920.2-937.3); in the page, click to clipboard 6.5 ms (5.7-10.9)); the script reading nothing: 1077.9 ms (1071.5-1117.5); load 5.6-6.1.

## An existing user's Library, before and after

Same store (20 Prompts, the Welcome done, the notes seen), popup 400x500, 10 openings each, interleaved; from navigation start.

| Build | First copy button hit-testable | First card in the page | Copy button opaque | Load 1 min |
|---|---|---|---|---|
| before: origin/main @ 7b3a8f56 | 28.8 ms (26.3-94.4) | 28.8 ms (26.3-94.4) | 226.3 ms (221.7-303.7) | 5.5-5.8 |
| after: this branch | 30.8 ms (26.1-58) | 30.8 ms (26.1-58) | 229.7 ms (225.3-284.1) | 5.5-5.8 |

Difference of the medians (hit-testable): 2 ms.

## Bundle (js + css + html of dist, no source maps)

| Build | Raw bytes | gzip -9 bytes |
|---|---|---|
| origin/main @ 7b3a8f56 | 928,649 | 250,596 |
| first-launch/ojz-16 @ 327ea6c5 | 972,159 | 261,971 |
| difference | +43,510 (4.69%) | +11,375 (4.54%) |

Method of the epic's baseline: `find dist -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' \) | xargs cat | wc -c`, and the same concatenation `| gzip -9 | wc -c`. origin/main built in a throwaway worktree with its own `npm ci`.

## Contrasts (lowest pair per theme)

| Theme | Lowest required pair | Colors (as drawn) | Ratio (scripts/contrast.ts) | Under its threshold |
|---|---|---|---|---|
| light | inactive dot on the frame (non-text, min 3) | #8F87A5 on #F4F1FA | 3.05:1 | none |
| dark | primary on the frame (non-text, min 3) | #844BF2 on #2B2340 | 3.01:1 | primary hovered on the frame (transient) 2.70:1 |

## Failure counts (targets 6 to 9): the tests of the full e2e run

- Target 6: S2 I go to the end choosing Packs: I see the Library with their Prompts, and a Notification that confirms it (passed); S3 I go to the end choosing no Pack: I see the Library, then the editor of a new Prompt opens (passed); S12 I leave the Welcome with a Pack and copy a Prompt: 2 clicks, under 60s from the first opening (passed); Skip then no Pack: the Library, then the editor of a new Prompt (passed); a refused add: the Welcome stays at step 3 with a failure Notification, nothing recorded; the retry adds the Packs (passed); a refused add, then Try again in the failure Notification: the same Packs added, once each (passed); a refused add, then Start empty from the step: the Packs unselected, the Library, then the editor of a new Prompt (passed)
- Target 7: S4 I close and reopen the extension after finishing: I see the Library, no Welcome, no What's new (passed); S6 I close the popup at step 2, then reopen it: I see the Welcome at step 2 (passed); S5 I restart Chrome, then update the extension: no Welcome; What's new only if the new Release has Release notes (passed); Pending through an update: the Welcome resumes, What's new never follows (passed)
- Target 8: S5 I restart Chrome, then update the extension: no Welcome; What's new only if the new Release has Release notes (passed); S7 I start from an earlier Release with Prompts, and update: I see my Library, never the Welcome (passed); S7 I start from an earlier Release with no Prompt, and update: I see my empty Library, never the Welcome (passed); a relaunch over a Library with no Welcome record: the service worker writes pending, the popup opens on the Library, not the Welcome, and records it done, so an emptied Library never brings it back (passed); a real update of an existing user from 1.9.0 to 2.0.0, a Release with notes: the Library and What's new, never the Welcome (passed)
- Target 9 (axe): step 1, light, popup 400x500: 0 violations; step 2, light, popup 400x500: 0 violations; step 1, dark, popup 400x500: 0 violations; step 3, light, popup 400x500: 0 violations; step 2, dark, popup 400x500: 0 violations; step 3, dark, popup 400x500: 0 violations; step 1, light, sidepanel 320x600: 0 violations; step 2, light, sidepanel 320x600: 0 violations; step 1, dark, sidepanel 320x600: 0 violations; step 3, light, sidepanel 320x600: 0 violations; step 2, dark, sidepanel 320x600: 0 violations; step 3, dark, sidepanel 320x600: 0 violations; Library at the exit with its Notification, light, popup 400x500: 0 violations; Library at the exit with its Notification, dark, popup 400x500: 0 violations; Library at the exit with its Notification, light, sidepanel 320x600: 0 violations; Library at the exit with its Notification, dark, sidepanel 320x600: 0 violations

All tests of those files in the run: scenarios.spec.ts + launch-decision.spec.ts 20/20 passed; welcome-a11y.spec.ts 17/17 passed.

## The runs kept, and their load

`MEASURE=1 CI=1 MEASURE_OUT=<report.json> MEASURE_BASE_DIST=<dist of origin/main @ 7b3a8f56> npx playwright test tests/e2e/welcome/measures.spec.ts --retries=0 --workers=1` on commit 327ea6c5. Runs 1 and 3 exit 1 by design: the soft expect on the unpinned popup from the open request, the only failed expect in each; run 2 does not time that popup and exits 0.

- Run 1, 00:59-01:05 (1-minute load 7.4 at the start): kept for the display in a tab (load 6.9-7.1 / 6.9-6.9), the first openings (5.5-7 / 4.7-5.5) and the colors. Its journey, first copy and existing-user series ran while another session drove the load to 28-41 (138 at its end): replaced by run 2.
- Run 2 (`--grep "journey|first copy through a Pack|existing user"`), 01:51-01:53: journey (load 7.2-9.2), first copy (load 5.6-6.1), existing user (load 5.5-5.8).
- Run 3 (`--grep "on the real surfaces"`), 01:53-01:55: the real surfaces (load 5.1-6 unpinned popup, 3.9-5.1 pinned popup, 3.6-4.9 side panel). Run 1 gave the same medians within 7 ms (side panel 123.6, pinned 165.3, unpinned 428.5 ms), one side panel sample at load 36.7.

Not verified: a physical click on the toolbar icon (no API simulates it; chrome.action.openPopup and chrome.sidePanel.open from a page button stand in); headed Chrome with a GPU, other machines, Linux CI; a human stopwatch (targets 1 and 3 are the reading model). The dark primary hovered (2.70:1, transient) is under 3:1; axe does not audit hover states.
