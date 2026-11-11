# My Prompt Manager

A browser extension where a user keeps a personal collection of reusable prompts and inserts them into AI platforms.

## Language

### Content

**Prompt**:
A reusable piece of text the user saves in their Library so they can put it into an AI chat later. Has a title, content and a Category.
_Avoid_: Template, snippet

**Category**:
A user-defined label that groups Prompts. Every Prompt is in exactly one Category. Category names are unique ignoring case, and a name is compared only after it has been admitted, so names that differ only by a Hidden character or by surrounding spaces are the same name. (Pairs that already differed only by case in data saved by earlier versions are left as they are by the upgrade pass.)
_Avoid_: Collection, tag, folder

**Pinned Prompt**:
A Prompt the user has marked to always appear before unpinned Prompts in the Library, whatever the chosen sort; within the pinned and unpinned groups the chosen sort still applies. Most Used is the one exception: it ranks by use alone.
_Avoid_: Favorite, starred prompt

**Most Used**:
The Prompts that have been inserted at least once, ranked by how many times each has ever been inserted, most first. A Prompt never inserted is not in Most Used, and copying a Prompt is not inserting it.
_Avoid_: Popular, top prompts, favorites

**Never used**:
The Prompts that have never been inserted, the complement of Most Used. Copying a Prompt does not count as using it.
_Avoid_: Unused, forgotten, stale

**Duplicate pair**:
Two Prompts with the same content, or with nearly identical titles and contents. Three such Prompts make two pairs, each later Prompt paired with the first.
_Avoid_: Similar prompts, copies

**Variable**:
A named placeholder written {{name}} inside a Prompt's text, filled in by the user when the Prompt is inserted.
_Avoid_: Blank, placeholder, field

**Verbatim**:
A saved Prompt's content is exactly what the user wrote, including any spaces and line breaks at the start or end. The extension never changes it after it is saved — not when it is read, shown, copied or inserted. A Prompt that looks different in the Library than it does in the chat breaks this. Filling in a Prompt's Variables at Insertion is the user's own change; a Prompt inserted as is arrives exactly as saved.
_Avoid_: "sanitized prompt", "cleaned prompt"

**Admission**:
The moment Prompt text or a Category name enters the Library, by any route: creating or editing a Prompt, opening a Share code, restoring a Backup, or creating, renaming or restoring a Category. Every route is admitted the same way, even when the user typed or pasted the text themselves, because a pasted Hidden character is invisible to the person pasting it. Text is checked once, at Admission, and from then on it is Verbatim. Text that is too long is refused, never shortened; when a Backup is restored, a Prompt that is refused is skipped and reported while the rest are restored. Prompts and Category names already in the Library when this rule began are cleaned of Hidden characters once (Categories whose names become the same are merged into the first), but Prompts are never refused or shortened retroactively. Title and Category names also have surrounding spaces removed; content does not.
_Avoid_: "import" (covers only some of the routes), "sanitizing"

**Hidden character**:
A character a reader cannot see but that can still carry meaning or change how text is read (for example control characters and invisible or direction-changing Unicode). Admission removes Hidden characters and nothing else; visible text, including angle-bracket tags, is never removed. The Library therefore contains none, once the upgrade pass has cleaned data saved by earlier versions. Invisible characters that are part of ordinary writing are not Hidden characters and are kept: the joiners inside emoji and inside Persian or Indic words, the marks that Hebrew and Arabic need for direction, and the invisible pieces of the England, Scotland and Wales flag emoji. The list of Hidden characters is closed and exact: a character is a Hidden character only if it is on that list, and an invisible character that is not on it is kept, so a name that differs from another only by such a character is a different name.

### Sharing

**Share code**:
A compact text form of a single Prompt that a user can give to someone else, who can turn it back into a Prompt.

**Backup**:
A file containing a user's Library, exported so it can be restored or moved.

### Platforms

**Platform**:
An AI chat site the extension works on (for example Claude or ChatGPT).

**Prompt selector**:
The list a user opens inside a Platform, from the Prompts button shown in its input area or by typing `//` in the input field, to choose a Prompt to insert. It lists All Prompts, the Pinned Prompts, the Recent Prompts, or the Prompts of one Category. `//` opens it only at the start of the field or after a space or a line break, so the `//` of a URL does not; the two characters are removed, and where they cannot be the selector stays closed.
_Avoid_: Picker (the Element picker is the tool that picks where the button goes on a custom site), palette, popover

**Recent**:
The five Prompts inserted most recently, latest first, as the Prompt selector lists them. A Prompt never inserted is not in Recent.
_Avoid_: History, last used

**Toolbar**:
The row of buttons in a Platform's input area (attach, voice, send…) where the icon is placed. Each Platform names where in it the icon goes once, in `src/config/platforms.ts`, as an anchor chain: buttons and groups named by what they are for (test ids, ARIA labels, custom elements), tried in order inside the composer.
_Avoid_: Button container, actions bar

**Anchored overlay**:
Where the icon goes when a Platform's Toolbar is not found, or where a custom site's positioning says: a layer that follows the element it is anchored on. On a Platform, inside the editor's bottom-end corner. An icon that stays there on a Platform means its Toolbar changed.
_Avoid_: Floating icon (the custom-site icon's look, not its placement), absolute fallback

**Insertion**:
Putting a Prompt's content into a Platform's input field. A Prompt's content arrives exactly as saved (see Verbatim). It replaces what the field held. An Insertion can be undone right after, from the confirmation shown above the field: Undo puts back the text the field held, as plain text, and the use of the Prompt stays counted. An Insertion that fails is said, and counts no use.

### Navigation

**Library**:
The user's own collection of Prompts and Categories, and the top-level section that lists its Prompts with search, a Library filter and sort.
_Avoid_: Home, prompt list

**Library filter**:
The one choice that narrows which Prompts the Library lists: All, the Pinned Prompts, Most Used, a single Category, or, reached only from Analytics, the Never used Prompts or the Prompts in a Duplicate pair. Exactly one is active at a time, All each time the extension is opened, and a search looks only inside the active Library filter.
_Avoid_: Pill, chip, tab, view

**Categories**:
The top-level section where the user creates, renames, recolors and deletes Categories.
_Avoid_: Collections, category manager

**Analytics**:
The top-level section showing usage statistics about Prompt insertions.
_Avoid_: Stats, dashboard

**Settings**:
The top-level section for user preferences, data import/export and site configuration.
_Avoid_: Preferences, options

**Section**:
One of the four top-level destinations (Library, Categories, Analytics, Settings), each reachable from the tab bar.
_Avoid_: Tab, page, view

**Section header**:
The band at the top of every Section but the Library: an Eyebrow over the Section's title, with the Section's own actions on the right. The full-page Analytics view has one too.
_Avoid_: Page header, title bar, view header

**Eyebrow**:
The short line above a Section header's title that gives the Section's context: the extension's version in Settings, the number of Categories in Categories, the period counted in Analytics.
_Avoid_: Subtitle, overline, sur-titre

**Settings group**:
A named set of related preferences inside Settings (for example Appearance or the Platforms), shown together under one label.
_Avoid_: Section, panel

**Notification**:
A brief message at the top of the popup or side panel that confirms an action or reports its failure, then disappears on its own, though not while the pointer or the focus is on it. One that confirms a deletion can offer to undo it while it shows. Only one shows at a time: a new one replaces it. The user turns all of them on or off in Settings, failures included.
_Avoid_: Toast, alert, snackbar

## Relationships

- A Library holds many Prompts and many Categories.
- Each Prompt belongs to exactly one Category.
- Every Prompt in a Library is free of Hidden characters, however it arrived. Admitting text that has already been admitted changes nothing.
- Insertion delivers a Prompt's content Verbatim into a Platform.
