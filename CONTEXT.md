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

**Default Category**:
The Category named Uncategorized, which every Library has. It is never renamed, recolored or deleted, and it takes the Prompts of a Category that is deleted. A Library whose only Category is the Default Category has no Categories of the user's own.
_Avoid_: No category, none, unsorted

**Pack**:
A ready-made set of Prompts in one Category, offered by the Welcome's last step. Adding a Pack puts its Prompts in the Library's Category with the Pack's name, ignoring case, or else in a new Category with the Pack's color, and skips every Prompt whose content the Library already has (it would make a Duplicate pair), so adding the same Pack again adds nothing. The Packs the user chose are added all together or not at all.
_Avoid_: Template, starter kit

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

**Lookalike**:
The Prompt of the Library whose text is at least 60% like the text being written in the editor, pointed out as "This looks familiar". Looser than a Duplicate pair, and never blocks saving.
_Avoid_: Similar prompt, near-duplicate

**Variable**:
A named placeholder written {{name}} inside a Prompt's text, filled in by the user when the Prompt is inserted.
_Avoid_: Blank, placeholder, field

**Verbatim**:
A saved Prompt's content is exactly what the user wrote, including any spaces and line breaks at the start or end. The extension never changes it after it is saved — not when it is read, shown, copied or inserted. A Prompt that looks different in the Library than it does in the chat breaks this. Filling in a Prompt's Variables at Insertion is the user's own change; a Prompt inserted as is arrives exactly as saved.
_Avoid_: "sanitized prompt", "cleaned prompt"

**Admission**:
The moment Prompt text or a Category name enters the Library, by any route: creating or editing a Prompt, opening a Share code, restoring a Backup, adding a Pack, or creating, renaming or restoring a Category. Every route is admitted the same way, even when the user typed or pasted the text themselves, because a pasted Hidden character is invisible to the person pasting it. Text is checked once, at Admission, and from then on it is Verbatim. Text that is too long is refused, never shortened; when a Backup is restored, a Prompt that is refused is skipped and reported while the rest are restored. Prompts and Category names already in the Library when this rule began are cleaned of Hidden characters once (Categories whose names become the same are merged into the first), but Prompts are never refused or shortened retroactively. Title and Category names also have surrounding spaces removed; content does not.
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

**Custom site**:
A site the user has added themselves so that the extension works on it, beside the Platforms. The user says where the Prompts button goes on it with the Element picker.
_Avoid_: Custom platform, user site

**Site settings**:
Which Platforms and Custom sites the extension works on, each one turned on or off by the user, and the debug switch kept with them. Whether the extension opens as a popup or a side panel is not part of them.
_Avoid_: Site integration settings, extension settings, site configuration

**Platform choices**:
What the user turned on or off in the Site settings, Platform by Platform. A Platform the user never switched has no choice and is on or off by default, so a Platform added in a later release is on for every user, and the choices the user made are kept.
_Avoid_: enabled sites, enabled list

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
Putting a Prompt's content into a Platform's input field. A Prompt's content arrives exactly as saved (see Verbatim). It goes where the caret of the field was when the Prompt selector opened, in place of the text selected there; the text before and after stays, nothing is added around the Prompt, and the caret ends right after it. A field with no caret takes the Prompt after what it holds. An Insertion can be undone right after, from the confirmation shown above the field: Undo puts back the text the field held, as plain text, and the use of the Prompt stays counted. With the keyboard, Tab pressed in the input field while the confirmation shows goes to Undo, wherever the confirmation is in the page's tab order. An Insertion that fails is said, and counts no use.

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
The short line above a Section header's title that gives the Section's context: the extension's version in Settings, the number of Categories in Categories ("Organize" while the Default Category is the only one), the period counted in Analytics.
_Avoid_: Subtitle, overline, sur-titre

**Settings group**:
A named set of related preferences inside Settings (for example Appearance or the Platforms), shown together under one label.
_Avoid_: Section, panel

**Notification**:
A brief message at the top of the popup or side panel that confirms an action or reports its failure, then disappears on its own, though not while the pointer or the focus is on it. One that confirms a deletion can offer to undo it while it shows. Only one shows at a time: a new one replaces it. The user turns all of them on or off in Settings, failures included.
_Avoid_: Toast, alert, snackbar

### Releases

**Release**:
A version of the extension the user installs, named by its version number (2.0.0). Installing a newer Release over an older one is an update; installing the extension where it was not is a first install.
_Avoid_: Build, deploy

**Submission**:
A Release sent to the Chrome Web Store, waiting for its Store review.
_Avoid_: Upload, deploy

**Store review**:
Google's examination of a Submission before any Publication.
_Avoid_: "review" alone, which means a code review here

**Publication**:
The moment an approved Release becomes the one the Chrome Web Store installs and offers as an update.
_Avoid_: Deploy, ship, go live

**Release notes**:
What a Release brings that the user should know about: its Features and its Critical fixes, nothing else. A Release may have none.
_Avoid_: Changelog (the changelog lists every change, technical ones included)

**Feature**:
In Release notes, something the user can do that they could not do before. A refactoring, an invisible technical change or a small visual adjustment is not one.
_Avoid_: Improvement, enhancement

**Critical fix**:
In Release notes, a repair of data loss or corruption, of a security flaw, or of a main function the user could not use. A small bug, a wording mistake or a rare case without consequence is not one.
_Avoid_: Bug fix, hotfix

**What's new**:
The sheet that rises over the Library at the first opening after an update to a Release that has Release notes, and lists them. Never shown on a first install. Closing it, by any means, marks the Release as seen.
_Avoid_: Changelog, release popup, splash

**Welcome**:
The three screens shown full-screen at the first opening after a first install, until the user finishes them. Closed before the end, it resumes at the same step at the next opening. Once finished it never shows again, not after an update nor after Clear All Data. An update never starts it: a user who updates from a Release before the Welcome is marked as having finished it.
_Avoid_: Onboarding, tour, tutorial

**Last seen Release**:
The Release whose What's new the user last closed, or the Release installed when the user finished the Welcome, so What's new never follows the Welcome. What's new shows again only for a Release that has Release notes and is not the Last seen Release.
_Avoid_: Last version, seen flag

**Debug mode**:
The Advanced setting, off by default, that turns on detailed logging on Platforms and, at every opening, shows the Welcome from its first step, then What's new once the Welcome is finished. It records nothing about them, neither the step reached, nor the Welcome finished, nor the Last seen Release, so turning it off gives back what the user saw before; the Packs added at the Welcome's end do go into the Library, without duplicates, as in normal use.
_Avoid_: Dev mode, test mode

## Relationships

- A Library holds many Prompts and many Categories.
- Each Prompt belongs to exactly one Category.
- Every Prompt in a Library is free of Hidden characters, however it arrived. Admitting text that has already been admitted changes nothing.
- Insertion delivers a Prompt's content Verbatim into a Platform.
- A Release reaches users through its Submission, its Store review, then its Publication. A Release refused at Store review is never submitted again: its fix is the next Release, which carries the refused one's Release notes too, since What's new shows only the installed Release's notes.
