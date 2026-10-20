# My Prompt Manager

A browser extension where a user keeps a personal collection of reusable prompts and inserts them into AI platforms.

## Language

### Content

**Prompt**:
A reusable piece of text with a title, stored by the user and inserted into AI platforms.
_Avoid_: Template, snippet

**Category**:
A user-defined label that groups Prompts; each Prompt belongs to exactly one Category.
_Avoid_: Collection, tag, folder

**Pinned Prompt**:
A Prompt the user has marked to always appear before unpinned Prompts in the Library, whatever the chosen sort; within the pinned and unpinned groups the chosen sort still applies.
_Avoid_: Favorite, starred prompt

**Variable**:
A named placeholder written {{name}} inside a Prompt's text, filled in by the user when the Prompt is inserted.
_Avoid_: Blank, placeholder, field

### Navigation

**Library**:
The top-level section listing the user's Prompts, with search, filter and sort.
_Avoid_: Home, prompt list

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
