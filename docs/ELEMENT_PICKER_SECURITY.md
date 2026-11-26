# Element Picker Security Safeguards

The Element picker runs in the page the user picks on, so it keeps the user from picking a sensitive field, warns on a sensitive page, and sends back only what placing the Prompts button needs. All of it lives in `src/content/modules/element-picker.ts`, with the fingerprint in `src/content/utils/element-fingerprint.ts` and the rules of what a pick keeps in `src/utils/pickedValues.ts`. How a pick starts and travels: [ELEMENT_PICKER_IMPLEMENTATION.md](./ELEMENT_PICKER_IMPLEMENTATION.md).

What a pick keeps (section 3) is tested: `src/content/modules/__tests__/element-picker-privacy.test.ts` picks, through the picker's click, a composer holding a draft on a page whose address has a query and a fragment, a React-controlled textarea after typing, a field whose page copies the draft into `data-draft`, a token in `data-id` and in `data-state`, and an ancestor whose `id` is a session id, and checks that neither the pick nor the Custom site's configuration code holds the address or those values; `src/utils/__tests__/pickedValues.test.ts` holds the rules' tables; `src/services/__tests__/configurationEncoder.test.ts` exports a pick stored before them; and `tests/e2e/content/custom-site-pick-privacy.spec.ts` does it all in the extension, from Pick Element to Export. Of section 4, `src/content/modules/__tests__/element-picker.test.ts` tests that a refused pick goes into the page's `sessionStorage`, that it is printed to the console, reduced to its categories, in Debug mode, and that a page setting `prompt-library-debug` in its own `localStorage` does not get it printed (ticket My-Prompt-Manager-j3i6). Sections 1, 2 and 5, and the rest of section 4, are not tested: a change to them is checked by hand, on the pages each section names.

## 1. Blocked elements

`isElementBlocked(element)` runs on every hover, which colors the highlight red instead of purple, and again on the click. A blocked click shows a warning and picks nothing. The checks run in this order, and the first match blocks:

1. **`BLOCKED_SELECTORS`**: the element matches one of them. They cover password, hidden, tel, email and ssn inputs, inputs marked `data-sensitive` or `data-private`, `autocomplete` values of cards, passwords, payments and one-time codes, the `.sensitive` class, a `data-testid` or an `aria-label` holding `password`, an `id` holding `cvv` or `pin`, a `name` holding `creditcard` or `ssn`, and every `iframe`. Reason: `Sensitive field detected: <selector>`. Step 3 catches the other spellings, such as `id="password"`.
2. **A blocked ancestor**: `element.closest()` finds a match among the element's ancestors, so everything inside a sensitive field or container is blocked. A wrapper that only contains a sensitive field is not: nothing looks at descendants.
3. **Attribute names and values**: each attribute's name, then its value, is tested against `/password|secret|token|key|credential|private|ssn|credit|card|cvv|pin|bank|account/i`. Reasons: `Sensitive attribute detected: <name>`, or `Sensitive attribute value detected: <name>="[REDACTED]"`. The pattern is unanchored, so it also blocks ordinary elements such as `class="card"`, `keyboard`, `spinner` or `account-menu`.

Two later checks, of the placeholder and of `aria-label`, never decide anything: step 3 has already tested those values.

To block another kind of field, add a selector to `BLOCKED_SELECTORS`.

## 2. Sensitive pages

`isDomainSensitive()` tests the patterns of `SENSITIVE_DOMAINS` (banks, `.gov`, health, insurance, tax, payment processors, crypto exchanges, brokers) against the hostname and the full URL. The patterns are unanchored substrings: `/\.tax/` matches `x.taxi.com`, `/chase\./` matches `purchase.example.com`, and `/medical/` matches a URL with "medical" anywhere in it.

The check runs on a click on an element that is not blocked, never at activation: on a sensitive page the picker opens and highlights as on any other.

- **High** (a `SENSITIVE_DOMAINS` match): the warning "Warning: You are on a sensitive website. Element picker has been disabled for security reasons." shows, and the picker deactivates without a pick.
- **Medium** (an `https:` URL matching `/login|signin|checkout|payment|account|profile|banking|financial/i`): the warning "Caution: This appears to be a sensitive page. Please ensure you are not selecting private information." shows, and the pick is sent in the same click. Nothing asks for a confirmation.
- **Low**: the pick is sent.

To treat another site as sensitive, add a pattern to `SENSITIVE_DOMAINS`. The console sanitizer of section 4 reads the same list.

## 3. What a pick sends

The click sends `ELEMENT_SELECTED` with:

- **`fingerprint`**, from `ElementFingerprintGenerator`: what the content script finds the element by. It holds the names the page's authors gave the element, never what the page holds for the user, by the rules of `src/utils/pickedValues.ts`:
  - the element's `id`, `data-testid`, `data-id` and `name`, and its parent's `id` and `data-testid`, when the value is shaped as an identifier (`keepsIdentifier`): up to 48 characters, a letter then letters, digits, `-` and `_`, each part between two `-` or `_` a lowercase word, words in camelCase, or two to five capitals, with up to three digits after it, or a number of up to three digits. So `prompt-textarea`, `chatInput` and `mat-input-0` are kept, and an e-mail address, a UUID, a JWT, a hex or base64 token, a number of four digits or more (`user-90210731`), or text with a space is not. A token of letters only, and a name slug such as `dm-jane-doe`, are shaped as identifiers and are kept;
  - its `aria-label` and `placeholder`, as the site wrote them (`keepsLabel`): only the word filter below applies, so a label can bring a name, an e-mail address or a number the site put in it;
  - its tag, `type` and `role`, its parent's tag, its place among its siblings, its depth, and its class patterns: up to 5 lowercase class names that do not look generated (`extractClassPatterns`), which `keepsIdentifier` does not check;
  - up to 10 other attributes, from an allow-list (`keepsAttribute`): a `data-` attribute used as a switch (its value empty, `true` or `false`); a test id (`data-test`, `data-test-id`, `data-qa`, `data-cy`, `data-e2e`, `data-automation-id`, `data-role`, `data-component`…) whose value is an identifier; an `aria-` attribute other than `aria-label` whose value is a token of the ARIA specification (`true`, `menu`, `polite`…), or, for one that names other elements (`aria-controls`, `aria-describedby`…), the `id`s of identifiers. An attribute where a page copies the draft (`data-draft`, `data-value`), keeps a record's id or a token (`data-state`), or a framework's state (`ng-reflect-*`, `v-*`) is not on the list.

  The identifiers, the labels and the other attributes also pass `SENSITIVE_PATTERNS`: one holding `session`, `token`, `api` or another of its words is left out. The tag, `type`, `role` and the class patterns pass no word filter: `class="session-notes"` is kept. The fingerprint keeps nothing of the page's address: it has no `meta.url`, since the Custom site's hostname is stored beside it and nothing that finds the element reads the address, whose path, query and fragment can name the user, a conversation or a token. Nor does it keep any of the element's text content: `content` is empty, since the text of a chat box, or of the box around it, is the user's draft. A draft the page copies into a label or a class name can go with the pick, since those are kept as written.
- **`selector`**, the fallback: the element's `#id`, or `tag[data-x="<value>"]`, or classes, or a path (see [ELEMENT_PICKER_IMPLEMENTATION.md](./ELEMENT_PICKER_IMPLEMENTATION.md)). An `id`, the element's or that of an ancestor up to four levels above it, or a `data-` attribute is in the selector only when it passes the rules the fingerprint applies (`keepsIdentifier`, `keepsAttribute`), though the fingerprint records no ancestor above the parent: `<section id="dm-jane-doe">` around the picked textarea, a name slug the rules accept, gives `#dm-jane-doe > div > div > textarea`. Its classes are the element's first two, as written, whether or not the fingerprint keeps them as class patterns.
- **`elementInfo`**, from `getElementInfo`: the tag, the selector, the position and size, `hasId`, `hasClasses`, the depth, the visibility, `blocked` and `securityLevel` (`high`, `medium` or `low`, as in section 2). Nothing reads `securityLevel`.
- **`elementType`** (the tag) and **`hostname`**.

No field's live `value` is read, so what the user typed in an `<input>` is not sent from there. The `value` attribute is read by step 3 of section 1, which tests it as it tests every attribute, and is not sent: it is on no list. A React-controlled input keeps that attribute equal to what the user typed, so typing `my account` there blocks the field. A contenteditable composer, whose text content is what the user typed, and a React-controlled `<textarea>`, whose text content is its default value, which React keeps equal to what the user typed, send none of that text content, nor does an element that contains them, such as the composer's wrapper.

A Custom site stores the fingerprint and the selector in its positioning (`src/components/settings/AddCustomSiteForm.tsx`). Export (`handleExportCustomSite` in `src/components/settings/SiteIntegrationSection.tsx`) puts them in the site's configuration code, which anyone holding the code can decode. The code goes through `sanitizeConfiguration` (`src/utils/configurationSecurity.ts`) when it is made and when it is imported, and `sanitizeFingerprint` and `sanitizePositioning` apply the rules above there again.

### A pick stored before these rules

A Custom site picked from 1.5.0 to 2.0.0, before ticket My-Prompt-Manager-je37, can hold the page's address in `meta.url`, path, query and fragment included, the first 50 characters of the element's text, which is the draft for a composer, and values the rules leave out, in the fingerprint and in the selector. Such a pick is not rewritten: it stays on the device as it was stored, where nothing reads the address and the matcher still scores the text, so the button stays where it was. The Data Storage export does not hold the Custom sites. A configuration code never holds those values: Export, and the import of a code made before, leave out `meta.url` and `content` and keep only the values the rules keep, and a stored selector that names a value they leave out (`selectorKeepsOnlyKeptValues`) is left out of the code. Where the code is imported, the fingerprint alone must then find the element, with a score of 30 at least (`MIN_CONFIDENCE_SCORE` in `src/content/utils/element-fingerprint.ts`). One that scores less without its selector, as that of a 2.0.0 pick whose selector was `div[data-placeholder="Ask anything"]` can, finds nothing, and the Prompts button is placed on the chat box, as on a site with no pick (`placeOnEditor` in `src/content/core/injector.ts`). Export does not warn of it: it says "Configuration copied".

A site whose only element is such a selector, with no fingerprint, is not exported: Export shows "Couldn't export configuration", saying that a CSS selector or a fingerprint is required. Releases up to 1.4.2 stored a selector and no fingerprint, and from 1.3.0 shared it so in configuration codes: such a code, whose selector names a value the rules leave out, is refused on import with the same message ("Provide a CSS selector…"). Picking the element again gives the site a pick that exports.

A selector over 300 characters (`MAX_SELECTOR_LENGTH`) is not read by these rules: `isSelectorSafe` refuses the code as unsafe.

## 4. Audit log

`logAudit` records two actions, each with the page URL and a timestamp:

- `blocked_selection`, at each warning, the Caution of a medium page included, with the reason, the selector and the hostname;
- `element_selected`, with the selector, the tag, the hostname, `secure` (a low page), `hasFingerprintId` and `fingerprintConfidence`.

Activation, Escape and deactivation are not recorded. The log keeps the last 50 entries (`MAX_AUDIT_ENTRIES`) in memory, and each entry copies it to the page's `sessionStorage` under `element-picker-audit`. That storage belongs to the page's origin, so the page's own scripts can read it. Each page load starts an empty log, whose first entry overwrites the stored one, and nothing reads the key back.

In Debug mode (`isDebugMode()` of `src/content/utils/logger.ts`: the Settings switch; in a development build, also the page's `prompt-library-debug` flag and `localhost`, ticket My-Prompt-Manager-j3i6), each entry is also printed to the console, reduced by `sanitizeAuditDetailsForLogging` to categories: `reasonType`, `selectorType` and `domainType` for a warning; `elementType`, `secure`, `selectorType` and `domainType` for a pick. The sanitizer's branch for a URL (`protocol`, `hasSensitivePath`) never runs, since `logAudit` adds the URL to the stored entry only. The debug logger separately prints the raw fingerprint and selector of a pick.

## 5. Visual feedback

- The highlight box is purple (`#7c3aed` border) over an element that can be picked, red (`#dc2626`) over a blocked one. The box ignores the pointer, so the page keeps the picker's crosshair cursor.
- A warning is a red box fixed at the center of the page (`#mpm-security-warning`, z-index 2147483647), removed after 3 seconds. Its text is the reason, as in sections 1 and 2.

## Checking a change by hand

Load the build, add a test page as a Custom site, start the picker, and check:

- a password field, a card number field (`autocomplete="cc-number"`) and an element inside a blocked container: red, and a click shows the warning and picks nothing;
- a field inside an `iframe`: the picker listens on the top page only, so it never sees the field, and the highlight keeps the last element the pointer crossed there. A click on the field goes to the frame's page: no warning, nothing picked, and the picker stays open. Over the `iframe`'s own border, when it has one, the highlight is red, and a click there shows the warning;
- a login page over HTTPS: the Caution warning shows, and the pick arrives;
- a page whose hostname matches `SENSITIVE_DOMAINS`: the picker opens, and the first click on an element that is not blocked shows the warning and closes it.
