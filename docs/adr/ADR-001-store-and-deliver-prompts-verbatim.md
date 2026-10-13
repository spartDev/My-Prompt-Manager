# Store and deliver Prompts verbatim; remove only Hidden characters, once, at Admission

* Status: accepted
* Deciders: Maintainer of My Prompt Manager, in an architecture review session (with Claude)
* Date: 2026-09-30
* Amended: 2026-10-01 — Category names added to Admission; interface shape and compile-time enforcement recorded after a design-it-twice exercise. Nothing was implemented between the two dates. Amended again 2026-10-02: the upgrade pass also cleans stored Category names (slice 3). Amended again 2026-10-13: a merge re-points the Prompts and the default Category that named the merged Category, in the same write, and a restore keeps the first spelling ("Category names" and "Existing data" below).

Technical Story: Architecture review candidate "Prompt content integrity" — the content script alters Prompt text on read (reproduced: `metadata:` becomes `meta`). No ticket.

## Context and Problem Statement

The content script runs `sanitizeUserInput` whenever it reads a Prompt: it strips angle-bracket tags and any `data:` or `on*=` text, and cuts the result at 50,000 characters plus `...`. A Prompt such as `Summarize the metadata: use <example>text</example> tags; if count=5 and onboarding = true` reaches the AI chat as `Summarize the meta use text tags; if count=5 and  true`, while the popup shows the original. At the same time, Prompt text only ever reaches text sinks (`textContent`, `.value`, `execCommand('insertText')`, React text); the single `innerHTML` in the extension sets a static help banner in the element picker ("Select an element"), with no interpolated text. The invisible-character list in the same sanitizer also strips the joiners used in emoji and Persian text (U+200D, U+200C) while missing Unicode tag characters, the usual way to hide instructions inside text. What should the extension do to Prompt text, where, and how often?

## Decision Outcome

Chosen option: "Verbatim Prompts; Hidden characters removed once, at Admission", because it protects against the threat that actually exists (invisible instructions in pasted, shared or restored text), leaves visible text untouched, and puts the rule in one place that every route must pass through.

What this means:

* **Verbatim.** A saved Prompt's content is stored, read, shown, copied and inserted exactly as saved, including spaces and line breaks at its start and end. Title and Category names are trimmed; content is not, but content that is only whitespace is refused as empty.
* **Admission on every route.** Creating a Prompt, editing a Prompt, opening a Share code, restoring a Backup, and creating, renaming or restoring a Category are all admitted the same way, including text the user typed or pasted. The check is enforced inside the text-writing methods of `StorageManager` (`savePrompt`, `updatePrompt`, `importPrompt`, `saveCategory`, `updateCategory`, `importCategory`), so no route can skip it. Callers handle a refusal; the form may ask the same module whether text would be admitted without saving.
* **Category names.** A Category name follows the same rules as a Prompt's category field: Hidden characters removed, trimmed, not empty, at most 50 characters. The duplicate-name check runs on the admitted name, so names that differ only by an invisible character or surrounding spaces are the same name (today the check compares lowercased raw strings, which lets `Work` and `Work` + U+200B coexist). A Category refused on restore is skipped and reported. The rename cascade that rewrites `Prompt.category` goes through the same Admission. When a restore makes a Backup's Category name the same as a stored one ignoring case (a Hidden character or surrounding spaces in the Backup), the stored Category keeps its id and its name, first wins, and takes the other fields from the Backup; a restored Prompt whose Category the Library spells differently (`work` for `Work`) takes the stored spelling, and never has a Category invented for it. A whole-library import (`importData`) merges with the same plan as the upgrade pass, before the quota check and before anything is cleared, so a refusal still leaves the existing data untouched.
* **Hidden characters.** Admission removes control characters other than newline, carriage return and tab; Unicode tag characters (U+E0000–U+E007F), except inside valid England/Scotland/Wales flag sequences; bidirectional overrides, embeddings and isolates (U+202A–U+202E, U+2066–U+2069); zero-width space; word joiner; and a byte-order mark inside text. It keeps U+200C and U+200D, variation selectors, and the left-to-right and right-to-left marks. The exact code-point list lives with the implementation and its tests.
* **Size limits.** Over-limit title, content or Category text is refused, never shortened, on every route. A Backup restore skips and reports the refused Prompts and restores the rest.
* **One reader.** `StorageManager` and the content script share one pure definition of a stored Prompt (shape, defaults, backfill). The content script no longer sanitizes, truncates, or drops Prompts on its own. Reading never writes; a stored entry with no `createdAt` falls back to `updatedAt`, then `0`, so the reader needs no clock.
* **Interface and enforcement.** One pure module, shared by both bundles, with a small set of functions: a text-level `admit` (full text or a patch), which is also the form's dry check and live counter; one function per write route that returns a nominally typed `AdmittedPrompt`; a reader that returns nominally typed `StoredPrompt`s; and an upgrade scrub that works on raw stored entries, so it never drops a malformed one. `StorageManager`'s private write accepts only those types, so skipping Admission fails to compile. The types are classes with a private member, because a `unique symbol` brand can be forged by object spread. Non-text changes, such as a usage count, also go through the module so the result stays typed.
* **Insertion and the prompt selector apply no content checks or escaping.** The Gemini and Mistral sanitizing, the content side of `validateAndSanitize`, and the unused `MAX_CONTENT_LENGTHS` entries are removed. The selector sets text only and passes Prompt ids through unchanged.
* **Existing data.** Stored Prompts are cleaned of Hidden characters once on extension update. The pass is idempotent and never refuses, deletes or shortens a stored Prompt, including one already over the size limits. Stored Category names are cleaned the same way, because a Prompt names its Category and the two must keep matching; if cleaning makes two names the same ignoring case (`Work` and `work` + U+200B), the later Category is merged into the first, and every Prompt and the default Category that named the merged Category are re-pointed, in the same write, to the exact name of the kept Category that spells its cleaned name, or else of the first kept one. Re-pointing is not an edit: timestamps and usage stay. Names that were already the same before cleaning are left alone: the pass only merges what it made equal. One pure plan (`planCategoryMerge`) decides this for the upgrade pass and for a whole-library import.
* **Safety property, tested at the sinks.** A shared set of hostile-looking strings (`<script>`, `<img onerror=…>`, `javascript:`) is run against the prompt selector and each insertion path, asserting the text appears literally and creates no element or handler.

### Positive Consequences

* The text in the popup, the prompt selector and the AI chat is the same text; tags such as `<example>` and `<context>` survive.
* The rule lives in one write path instead of several validators and sanitizers that disagree, and is tested through that path against the in-memory storage adapter.
* The real invisible-text threat (tag characters) is handled, and multilingual text and emoji sequences are no longer altered.

### Negative Consequences

* Share codes now carry angle-bracket tags through to the recipient; before, tags were stripped on both encode and decode.
* Insertion-time defense layers are removed. Safety now rests on the invariant that no sink interprets Prompt text as HTML.
* U+200C and U+200D are kept, so they remain available as a steganographic channel.
* The compile-time guarantee covers the write method, not raw `chrome.storage.local` calls, and `as unknown as` casts still compile; both need a lint or grep rule. The types do not survive JSON or messaging, so receivers re-parse with the reader, and they cannot express that a legacy Prompt may exceed the limits.
* The upgrade pass rewrites stored Prompts that contain Hidden characters (removing only those characters).
* Roughly 60 sanitizer assertions across `mistral-strategy.test.ts`, `promptEncoder.test.ts`, `content/utils/__tests__/storage.test.ts` and the Gemini tests are rewritten or removed.
* The "Security Architecture" section of `docs/ARCHITECTURE.md` (Layer 2: tag removal, URL filtering, event-handler stripping; "sanitize at the insertion boundary") no longer matches and must be updated.
* Hard to reverse: characters removed at Admission cannot be restored, and Share codes issued with tags cannot be recalled. Re-adding sanitizing later would be a code change, not a data repair.
* Follow-up work, out of scope here: the dormant `StorageManager.importData` / `exportData` path must go through the same write path or be removed before anything uses it; Backup import/export consolidation.

## Decision Drivers

| Driver                    | Description                                                                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Fidelity                  | Users write XML-style tags and multilingual text in Prompts; what they save must arrive in the chat unchanged.                               |
| Actual threat model       | No HTML sink exists for Prompt text; the real risk is invisible characters, and the current sanitizer misses Unicode tag characters.         |
| Locality                  | The rule should be enforced and changed in one place, not in each strategy, the content script and the popup.                                |
| Testability               | The invariant should be provable through one interface against the existing in-memory storage adapter.                                       |
| No silent loss for users  | Existing Libraries must not lose text or lose protection on upgrade; stored Prompts are never deleted or shortened.                          |

## Considered Options

* Verbatim Prompts; Hidden characters removed once, at Admission (chosen)
* Keep HTML-style sanitizing and fix its patterns
* Sanitize at each sink with one shared policy

### Verbatim Prompts; Hidden characters removed once, at Admission

Store text as admitted, remove only Hidden characters at the single write path, and deliver it unchanged everywhere.

* **Pros**
  * Good, because the extension has no HTML sink for Prompt text (the only `innerHTML` in `src` is a static help banner in the element picker), so tag stripping protects nothing.
  * Good, because it handles Unicode tag characters, which the current sanitizer does not match, and keeps U+200C/U+200D, which the current sanitizer removes.
  * Good, because enforcement sits in the only code that writes the prompts key, so a new route cannot bypass it.
* **Cons**
  * Bad, because Share codes and Backups now propagate angle-bracket tags to recipients.
  * Bad, because it removes insertion-time layers that would catch text stored without Admission, and requires a one-time upgrade pass for existing data.

### Keep HTML-style sanitizing and fix its patterns

Keep stripping tags and dangerous-looking patterns, but anchor the regular expressions so `metadata:` and `onboarding =` survive.

* **Pros**
  * Good, because it is the smallest code change.
  * Good, because it keeps a pattern-based layer in place at read time.
* **Cons**
  * Bad, because it still removes `<example>` and `<context>` tags, which is the reported defect.
  * Bad, because the patterns defend against an HTML sink that does not exist, and Unicode tag characters would still need separate handling.
  * Bad, because the popup's Copy action copies the stored text directly, so read-time stripping in the content script cannot give the popup and the chat the same text.

### Sanitize at each sink with one shared policy

Leave stored text untouched and apply one shared policy in each insertion strategy and in the prompt selector.

* **Pros**
  * Good, because each sink can apply rules that fit it, and stored data is never changed.
* **Cons**
  * Bad, because the policy has to be applied in every strategy and in the selector; today only Gemini and Mistral call the shared sanitizer, and Copilot and M365 use their own length-checking validator.
  * Bad, because Hidden characters would stay in storage and be copied unchanged by the popup's Copy action, which is not an insertion sink.

## Architecture Manifesto Alignment

| # | Principle             | Alignment | Notes                                                                                                                              |
| - | --------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1 | User Centricity       | Aligned   | What the user writes is what arrives in the chat, in any language.                                                                 |
| 2 | Simplicity            | Aligned   | One rule in one write path replaces several validators and sanitizers that disagree.                                               |
| 3 | Technical Debt        | Aligned   | Removes duplicated validation and the per-strategy sanitizing drift.                                                               |
| 4 | Quality by Design     | Aligned   | The invariant is enforced where data is written and tested through that interface, with property tests at the sinks.               |
| 5 | Security and Privacy  | Partial   | Removes insertion-time layers and relies on "no HTML sink for Prompt text"; in exchange, the real invisible-text threat is handled. |

## Links

* [`CONTEXT.md`](../../CONTEXT.md) — definitions of Verbatim, Admission and Hidden character
* [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) — "Security Architecture" section superseded by this decision
