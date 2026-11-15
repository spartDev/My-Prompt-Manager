/**
 * Release notes are typed data: a new Release is one new entry in the
 * registry (`releaseNotes.ts`), never a component change.
 * Terms: CONTEXT.md, section "Releases".
 */

/** The closed set of icons a Feature tile may show. */
export type WhatsNewIcon =
  | 'variables'
  | 'search'
  | 'slash'
  | 'pin'
  | 'lookalike'
  | 'broom'
  | 'category'
  | 'undo'
  | 'wrench';

/** Where a Feature tile takes the user when opened. */
export type WhatsNewDestination =
  | 'library'
  | 'library-search'
  | 'prompt-editor-new'
  | 'categories'
  | 'analytics'
  | 'settings';

/** Something the user can do that they could not do before. */
export interface FeatureItem {
  readonly kind: 'feature';
  readonly title: string;
  readonly description: string;
  readonly icon: WhatsNewIcon;
  /** Absent when the Feature lives on Platforms: the tile is then not a button. */
  readonly destination?: WhatsNewDestination;
  /** Hero only: a sentence where each `{{word}}` renders as a pill. */
  readonly example?: string;
}

/** A repair of data loss, a security flaw, or a main function the user could not use. */
export interface CriticalFixItem {
  readonly kind: 'critical-fix';
  readonly title: string;
  readonly description: string;
  /** A Critical fix opens nothing. */
  readonly destination?: never;
  /** A Critical fix shows the fixed pill, not an icon. */
  readonly icon?: never;
}

export type ReleaseNoteItem = FeatureItem | CriticalFixItem;

/** The Release notes of one Release. The first Feature is the hero. */
export interface ReleaseNotes {
  readonly version: string;
  readonly items: readonly ReleaseNoteItem[];
}

/** A piece of a hero example: plain text, or a `{{word}}` shown as a pill. */
export type ExampleSegment =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'variable'; readonly name: string };
