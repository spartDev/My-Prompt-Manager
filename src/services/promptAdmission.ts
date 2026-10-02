/**
 * Prompt Admission
 *
 * Pure module (no chrome.* dependency) shared by the popup, the service worker
 * and the content script. See CONTEXT.md (Admission, Verbatim, Hidden character)
 * and docs/adr/ADR-001-store-and-deliver-prompts-verbatim.md.
 */

import { DEFAULT_CATEGORY, VALIDATION_LIMITS } from '../constants';
import type { AppError, ErrorType } from '../types';

/** Single source of truth for Prompt text limits (derived from VALIDATION_LIMITS). */
export const PROMPT_LIMITS = {
  title: VALIDATION_LIMITS.PROMPT_TITLE_MAX,
  content: VALIDATION_LIMITS.PROMPT_CONTENT_MAX,
  category: VALIDATION_LIMITS.CATEGORY_NAME_MAX
} as const;

export type PromptField = keyof typeof PROMPT_LIMITS;

export interface PromptText {
  title: string;
  content: string;
  category: string;
}

export interface Refusal {
  field: PromptField;
  reason: 'empty' | 'too_long';
  length: number;
  max: number;
  /** Ready to show to the user. */
  message: string;
}

export type Refusals = Partial<Record<PromptField, Refusal>>;

export type Admission<T> = { ok: true; text: T } | { ok: false; errors: Refusals };

const FIELDS: readonly PromptField[] = ['title', 'content', 'category'];

const LABELS: Record<PromptField, string> = {
  title: 'Title',
  content: 'Content',
  category: 'Category name'
};

/**
 * Hidden characters: control characters (except newline, carriage return and tab),
 * zero-width space, bidi embeddings/overrides, U+2060-U+206F (word joiner, invisible
 * operators, bidi isolates, deprecated format characters) and the byte-order mark.
 *
 * Invisible characters that are part of ordinary writing are deliberately NOT here:
 * U+200C/U+200D joiners (emoji, Persian, Indic), U+200E/U+200F direction marks
 * (Hebrew, Arabic) and variation selectors.
 */
const HIDDEN_CHARACTERS =
  // biome-ignore lint/suspicious/noControlCharactersInRegex: removing control characters is the purpose of this pattern
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B\u202A-\u202E\u2060-\u206F\uFEFF]/g;

const BLACK_FLAG = '\u{1F3F4}';

/**
 * Unicode tag characters (a way to hide text), except inside the three flag emoji
 * that are built from them: England (gbeng), Scotland (gbsct) and Wales (gbwls).
 */
const TAG_CHARACTERS =
  /\u{1F3F4}\u{E0067}\u{E0062}(?:\u{E0065}\u{E006E}\u{E0067}|\u{E0073}\u{E0063}\u{E0074}|\u{E0077}\u{E006C}\u{E0073})\u{E007F}|[\u{E0000}-\u{E007F}]/gu;

function removeHiddenCharacters(text: string): string {
  return text
    .replace(HIDDEN_CHARACTERS, '')
    .replace(TAG_CHARACTERS, (match) => (match.startsWith(BLACK_FLAG) ? match : ''));
}

/** Title and category are labels and are trimmed; content is never trimmed. */
const TRIMMED: Record<PromptField, boolean> = {
  title: true,
  content: false,
  category: true
};

/** Some of the fields; `undefined` means absent. */
export type PromptTextPatch = { [K in PromptField]?: string | undefined };

/**
 * Admits Prompt text: removes Hidden characters, trims title and category, and refuses
 * (never shortens) text that is empty or over the limits. Pure, so it doubles as the
 * form's "would this be admitted?" check. Admitting admitted text changes nothing.
 *
 * Takes the full text (create, Share code, restore) or a patch (an edit, or a Category
 * name on its own); a patch checks and returns only the fields that are present.
 */
export function admit(text: PromptText): Admission<PromptText>;
export function admit(patch: PromptTextPatch): Admission<PromptTextPatch>;
export function admit(input: PromptTextPatch): Admission<PromptTextPatch> {
  const errors: Refusals = {};
  const admitted: PromptTextPatch = {};

  for (const field of FIELDS) {
    const raw = input[field];
    if (raw === undefined) {
      continue;
    }

    const cleaned = removeHiddenCharacters(raw);
    const value = TRIMMED[field] ? cleaned.trim() : cleaned;
    const max = PROMPT_LIMITS[field];
    admitted[field] = value;

    if (value.trim().length === 0) {
      errors[field] = {
        field,
        reason: 'empty',
        length: value.length,
        max,
        message: `${LABELS[field]} is required`
      };
    } else if (value.length > max) {
      errors[field] = {
        field,
        reason: 'too_long',
        length: value.length,
        max,
        message: `${LABELS[field]} cannot exceed ${max.toLocaleString('en-US')} characters`
      };
    }
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, text: admitted };
}

/**
 * A Prompt as read from storage: complete, with its text exactly as stored.
 *
 * Declared as a class with a private member so it is nominal: an object literal or an
 * object spread can never be assigned to it, only a value produced by this module.
 * (A `unique symbol` brand would survive object spread and could be forged.)
 * It widens to a plain `Prompt`, so UI code is unaffected.
 */
export declare class StoredPrompt {
  private readonly _stored: never;
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly category: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly usageCount: number;
  readonly lastUsedAt: number;
}

interface StoredFields {
  id: string;
  title: string;
  content: string;
  category: string;
  createdAt: number;
  updatedAt: number;
  usageCount: number;
  lastUsedAt: number;
}

/** The only place a StoredPrompt value is made. */
function mintStored(fields: StoredFields): StoredPrompt {
  return fields as unknown as StoredPrompt;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * Reads one stored entry, or returns null if it is not a Prompt (not an object, or
 * without a string id, title or content). Text is never altered, shortened or checked.
 *
 * Missing fields are filled in deterministically, with no clock: createdAt falls back
 * to updatedAt and then 0; an unused Prompt was last used when it was created, a used
 * one when it was updated; lastUsedAt is never before createdAt.
 */
export function readPrompt(raw: unknown): StoredPrompt | null {
  if (
    !isRecord(raw) ||
    typeof raw.id !== 'string' ||
    typeof raw.title !== 'string' ||
    typeof raw.content !== 'string'
  ) {
    return null;
  }

  const created = finiteNumber(raw.createdAt);
  const updated = finiteNumber(raw.updatedAt);
  const createdAt = created ?? updated ?? 0;
  const updatedAt = updated ?? createdAt;

  const count = finiteNumber(raw.usageCount);
  const usageCount = count !== undefined && count >= 0 ? Math.floor(count) : 0;

  const used = finiteNumber(raw.lastUsedAt);
  const fallbackLastUsedAt = usageCount > 0 ? updatedAt : createdAt;
  const lastUsedAt = Math.max(used !== undefined && used > 0 ? used : fallbackLastUsedAt, createdAt);

  return mintStored({
    id: raw.id,
    title: raw.title,
    content: raw.content,
    category: typeof raw.category === 'string' ? raw.category : DEFAULT_CATEGORY,
    createdAt,
    updatedAt,
    usageCount,
    lastUsedAt
  });
}

/**
 * The one-time upgrade pass: removes Hidden characters from the title, content and
 * category of raw stored entries. It works on the raw value, never refuses, and never
 * trims, shortens or drops anything (including over-limit and malformed entries), so
 * existing Prompts are cleaned without ever being lost. Entries with nothing to clean
 * are returned as the same objects; `changed` tells the caller whether a write is needed.
 */
export function scrubStored(raw: unknown): { entries: unknown[]; changed: boolean } {
  if (!Array.isArray(raw)) {
    return { entries: [], changed: false };
  }

  let changed = false;

  const entries = raw.map((entry: unknown) => {
    if (!isRecord(entry)) {
      return entry;
    }

    let scrubbed: Record<string, unknown> | undefined;

    for (const field of FIELDS) {
      const value = entry[field];
      if (typeof value !== 'string') {
        continue;
      }

      const clean = removeHiddenCharacters(value);
      if (clean !== value) {
        scrubbed = scrubbed ?? { ...entry };
        scrubbed[field] = clean;
      }
    }

    if (!scrubbed) {
      return entry;
    }

    changed = true;
    return scrubbed;
  });

  return { entries, changed };
}

/**
 * The one-time upgrade pass for Category names, the counterpart of scrubStored: removes
 * Hidden characters from the `name` of raw stored Categories, and never trims, refuses or
 * shortens a name or drops a malformed entry. Entries with nothing to clean are returned
 * as the same objects.
 *
 * Prompts have their `category` cleaned by scrubStored, so a Category that kept its Hidden
 * character would no longer match its Prompts. Cleaning can also make two names the same
 * (`Work` and `Work` + U+200B); Categories never share a name, so the first is kept and the
 * later ones are dropped. Nothing is orphaned: their Prompts already name the kept Category.
 * Names that were already the same before cleaning are left as they are, so this pass only
 * merges what it made equal.
 */
export function scrubStoredCategories(raw: unknown): { entries: unknown[]; changed: boolean } {
  if (!Array.isArray(raw)) {
    return { entries: [], changed: false };
  }

  let changed = false;
  /** Cleaned name (lowercase) -> stored name (lowercase) of the first Category with that name. */
  const firstByName = new Map<string, string>();

  const entries = raw.flatMap((entry: unknown) => {
    if (!isRecord(entry) || typeof entry.name !== 'string') {
      return [entry];
    }

    const name = removeHiddenCharacters(entry.name);
    const cleanedKey = name.toLowerCase();
    const storedKey = entry.name.toLowerCase();
    const first = firstByName.get(cleanedKey);

    if (first === undefined) {
      firstByName.set(cleanedKey, storedKey);
    } else if (first !== storedKey) {
      changed = true;
      return [];
    }

    if (name === entry.name) {
      return [entry];
    }

    changed = true;
    return [{ ...entry, name }];
  });

  return { entries, changed };
}

/**
 * Reads the value stored under the prompts key: the one definition of a stored Prompt,
 * shared by StorageManager and the content script. Pure; reading never writes.
 */
export function readPrompts(raw: unknown): StoredPrompt[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.flatMap((entry: unknown) => {
    const prompt = readPrompt(entry);
    return prompt ? [prompt] : [];
  });
}

/**
 * A Prompt whose text has just been through Admission. Only the routes below make one,
 * and StorageManager's write accepts only these, so a route that skips Admission does
 * not compile. A StoredPrompt is not an AdmittedPrompt.
 */
export declare class AdmittedPrompt extends StoredPrompt {
  private readonly _admitted: never;
}

export type PromptAdmission = { ok: true; prompt: AdmittedPrompt } | { ok: false; errors: Refusals };

/** The only place an AdmittedPrompt value is made. */
function mintAdmitted(fields: StoredFields): AdmittedPrompt {
  return fields as unknown as AdmittedPrompt;
}

/**
 * Thrown by the write path when a route is refused. It is an AppError (a validation
 * error), so the existing error handling in PromptManager and the hooks passes it through.
 */
export class AdmissionRefusedError extends Error implements AppError {
  readonly type: ErrorType = 'VALIDATION_ERROR';
  readonly details: Refusals;

  constructor(readonly errors: Refusals) {
    super(
      Object.values(errors)
        .flatMap((refusal) => (refusal ? [refusal.message] : []))
        .join('; ')
    );
    this.name = 'AdmissionRefusedError';
    this.details = errors;
  }
}

/** Create: admits the text and stamps the new Prompt with the given id and time. */
export function admitNew(text: PromptText, stamp: { id: string; now: number }): PromptAdmission {
  const admission = admit(text);
  if (!admission.ok) {
    return admission;
  }

  return {
    ok: true,
    prompt: mintAdmitted({
      ...admission.text,
      id: stamp.id,
      createdAt: stamp.now,
      updatedAt: stamp.now,
      usageCount: 0,
      lastUsedAt: stamp.now
    })
  };
}

/**
 * Edit: admits the patch. Text the patch does not touch is carried over as stored: it is
 * not checked against the limits again (a legacy over-limit Prompt stays editable), but
 * it is cleaned of Hidden characters so an AdmittedPrompt never contains any.
 */
export function admitEdit(current: StoredPrompt, patch: PromptTextPatch, now: number): PromptAdmission {
  const admission = admit(patch);
  if (!admission.ok) {
    return admission;
  }

  return {
    ok: true,
    prompt: mintAdmitted({
      id: current.id,
      title: admission.text.title ?? removeHiddenCharacters(current.title),
      content: admission.text.content ?? removeHiddenCharacters(current.content),
      category: admission.text.category ?? removeHiddenCharacters(current.category),
      createdAt: current.createdAt,
      updatedAt: now,
      usageCount: current.usageCount,
      lastUsedAt: current.lastUsedAt
    })
  };
}

/**
 * Restore (Backup): admits the text of a Prompt read from a Backup, keeping its id,
 * usage and timestamps. A timestamp that is missing (0) becomes `now`. When it replaces
 * an existing Prompt (`replacing`), updatedAt is stamped with `now`. A refusal means the
 * restore skips and reports this Prompt and carries on with the rest.
 */
export function admitRestored(
  incoming: StoredPrompt,
  now: number,
  options: { replacing?: boolean } = {}
): PromptAdmission {
  const admission = admit({ title: incoming.title, content: incoming.content, category: incoming.category });
  if (!admission.ok) {
    return admission;
  }

  const createdAt = incoming.createdAt || now;

  return {
    ok: true,
    prompt: mintAdmitted({
      ...admission.text,
      id: incoming.id,
      createdAt,
      updatedAt: options.replacing ? now : incoming.updatedAt || now,
      usageCount: incoming.usageCount,
      lastUsedAt: Math.max(incoming.lastUsedAt, createdAt)
    })
  };
}

/** A non-text change that keeps the result typed: counts one use. */
export function recordUse(prompt: StoredPrompt, now: number): StoredPrompt {
  return mintStored({ ...prompt, usageCount: prompt.usageCount + 1, lastUsedAt: now });
}
