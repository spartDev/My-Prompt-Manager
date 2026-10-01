# My Prompt Manager — Domain Glossary

The language used to talk about this product. Terms only; no implementation details.

## Terms

**Prompt**
A reusable piece of text the user saves in their Library so they can put it into an AI chat later. Has a title, content and a Category.

**Library**
The user's own collection of Prompts and Categories.

**Category**
A named group that a Prompt belongs to. Every Prompt is in exactly one Category. Two Categories never share a name, and a name is compared only after it has been admitted, so names that differ only by a Hidden character or by surrounding spaces are the same name.

**Platform**
An AI chat site the extension works on (for example Claude or ChatGPT).

**Prompt selector**
The list a user opens from the icon shown inside a Platform's input area, to choose a Prompt to insert.

**Insertion**
Putting a Prompt's content into a Platform's input field. A Prompt's content arrives exactly as saved (see Verbatim).

**Share code**
A compact text form of a single Prompt that a user can give to someone else, who can turn it back into a Prompt.

**Backup**
A file containing a user's Library, exported so it can be restored or moved.

**Verbatim**
A saved Prompt's content is exactly what the user wrote, including any spaces and line breaks at the start or end. The extension never changes it after it is saved — not when it is read, shown, copied or inserted. A Prompt that looks different in the Library than it does in the chat breaks this.
_Avoid_: "sanitized prompt", "cleaned prompt"

**Admission**
The moment Prompt text or a Category name enters the Library, by any route: creating or editing a Prompt, opening a Share code, restoring a Backup, or creating, renaming or restoring a Category. Every route is admitted the same way, even when the user typed or pasted the text themselves, because a pasted Hidden character is invisible to the person pasting it. Text is checked once, at Admission, and from then on it is Verbatim. Text that is too long is refused, never shortened; when a Backup is restored, a Prompt that is refused is skipped and reported while the rest are restored. Prompts already in the Library when this rule began are cleaned of Hidden characters once, but are never refused or shortened retroactively. Title and Category names also have surrounding spaces removed; content does not.
_Avoid_: "import" (covers only some of the routes), "sanitizing"

**Hidden character**
A character a reader cannot see but that can still carry meaning or change how text is read (for example control characters and invisible or direction-changing Unicode). Admission removes Hidden characters and nothing else; visible text, including angle-bracket tags, is never removed. The Library therefore never contains Hidden characters. Invisible characters that are part of ordinary writing are not Hidden characters and are kept: the joiners inside emoji and inside Persian or Indic words, the marks that Hebrew and Arabic need for direction, and the invisible pieces of the England, Scotland and Wales flag emoji.

## Relationships

- A Library holds many Prompts and many Categories.
- Each Prompt belongs to exactly one Category.
- Every Prompt in a Library is free of Hidden characters, however it arrived. Admitting text that has already been admitted changes nothing.
- Insertion delivers a Prompt's content Verbatim into a Platform.
