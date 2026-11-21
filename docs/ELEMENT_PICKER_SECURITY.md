# Element Picker Security Safeguards

The Element picker runs in the page the user picks on, so it keeps the user from picking a sensitive field, warns on a sensitive page, and sends back only what placing the Prompts button needs. All of it lives in `src/content/modules/element-picker.ts`, with the fingerprint in `src/content/utils/element-fingerprint.ts`. How a pick starts and travels: [ELEMENT_PICKER_IMPLEMENTATION.md](./ELEMENT_PICKER_IMPLEMENTATION.md).

One test covers a safeguard: "should ignore sensitive IDs and attributes" in `src/content/utils/__tests__/element-fingerprint.test.ts` checks that a sensitive `id` and `data-testid` are left out of the fingerprint (section 3). Nothing tests the rest, the other values the fingerprint filters included: a change to them is checked by hand, on the pages each section names.

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

- **`fingerprint`**, from `ElementFingerprintGenerator`: the identifier the content script places the button by. It holds the element's `id`, `data-testid`, `data-id`, `name`, `aria-label` and `placeholder`, its tag, `type` and `role`, its text content (the first 50 characters, for an element whose text is under 200), its parent's tag, `id` and `data-testid`, its stable attributes and class patterns, and the page URL (`meta.url`). The generator's `SENSITIVE_PATTERNS` filters the identifiers, the placeholder, the text, the parent's identifiers and the stable attributes: a value that matches is left out. The tag, `type`, `role`, the class patterns and `meta.url` are kept as they are, the URL's path and query included. A Custom site stores the whole fingerprint in its positioning (`src/components/settings/AddCustomSiteForm.tsx`). Export (`handleExportCustomSite` in `src/components/settings/SiteIntegrationSection.tsx`) copies it whole into the share code (`configToPayload` in `src/services/configurationEncoder.ts`), which anyone holding the code can decode.
- **`selector`**, the fallback: the element's `#id`, or `tag[data-x="<value>"]`, or classes, or a path (see [ELEMENT_PICKER_IMPLEMENTATION.md](./ELEMENT_PICKER_IMPLEMENTATION.md)).
- **`elementInfo`**, from `getElementInfo`: the tag, the selector, the position and size, `hasId`, `hasClasses`, the depth, the visibility, `blocked` and `securityLevel` (`high`, `medium` or `low`, as in section 2). Nothing reads `securityLevel`.
- **`elementType`** (the tag) and **`hostname`**.

No field's live `value` is read, so what the user typed in an `<input>` is not sent from there. The `value` attribute is read: step 3 of section 1 and the fingerprint's filter test it as they test every attribute, and neither sends it. A React-controlled input keeps that attribute equal to what the user typed, so typing `my account` there blocks the field. A copy the page makes in another attribute can be sent, though. The fingerprint keeps up to 10 stable attributes: those whose name starts with `data-` (except the names that start `data-sensitive`, `data-private`, `data-password`, `data-token`, `data-key` or `data-secret`), `aria-` (except `aria-label`), `ng-`, `v-` or `react-`, each with its whole value, once `SENSITIVE_PATTERNS` lets its name and value through. A `data-` attribute can also make the `selector`, whose value is not filtered. A page that mirrors the draft into `data-draft` can send it in both, unless the draft matches the pattern of step 3, which blocks the field.

A pick on a composer that holds a draft carries the draft's first 50 characters, within the limits above, when the composer is a contenteditable field, whose text content is what the user typed in it, or a React-controlled `<textarea>`, whose text content is its default value, which React keeps equal to what the user typed. A pick on an element that contains such a field, such as the composer's wrapper, carries the draft too: the picked element's text content includes the field's, and is kept when all of it is under 200 characters.

## 4. Audit log

`logAudit` records two actions, each with the page URL and a timestamp:

- `blocked_selection`, at each warning, the Caution of a medium page included, with the reason, the selector and the hostname;
- `element_selected`, with the selector, the tag, the hostname, `secure` (a low page), `hasFingerprintId` and `fingerprintConfidence`.

Activation, Escape and deactivation are not recorded. The log keeps the last 50 entries (`MAX_AUDIT_ENTRIES`) in memory, and each entry copies it to the page's `sessionStorage` under `element-picker-audit`. That storage belongs to the page's origin, so the page's own scripts can read it. Each page load starts an empty log, whose first entry overwrites the stored one, and nothing reads the key back.

When the page's `localStorage` holds `prompt-library-debug` = `true`, each entry is also printed to the console, reduced by `sanitizeAuditDetailsForLogging` to categories: `reasonType`, `selectorType` and `domainType` for a warning; `elementType`, `secure`, `selectorType` and `domainType` for a pick. The sanitizer's branch for a URL (`protocol`, `hasSensitivePath`) never runs, since `logAudit` adds the URL to the stored entry only. The debug logger separately prints the raw fingerprint and selector of a pick.

## 5. Visual feedback

- The highlight box is purple (`#7c3aed` border) over an element that can be picked, red (`#dc2626`) over a blocked one. The box ignores the pointer, so the page keeps the picker's crosshair cursor.
- A warning is a red box fixed at the center of the page (`#mpm-security-warning`, z-index 2147483647), removed after 3 seconds. Its text is the reason, as in sections 1 and 2.

## Checking a change by hand

Load the build, add a test page as a Custom site, start the picker, and check:

- a password field, a card number field (`autocomplete="cc-number"`) and an element inside a blocked container: red, and a click shows the warning and picks nothing;
- a field inside an `iframe`: the picker listens on the top page only, so it never sees the field, and the highlight keeps the last element the pointer crossed there. A click on the field goes to the frame's page: no warning, nothing picked, and the picker stays open. Over the `iframe`'s own border, when it has one, the highlight is red, and a click there shows the warning;
- a login page over HTTPS: the Caution warning shows, and the pick arrives;
- a page whose hostname matches `SENSITIVE_DOMAINS`: the picker opens, and the first click on an element that is not blocked shows the warning and closes it.
