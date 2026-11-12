import type { FC } from 'react';
import { useActionState, useEffect, useId, useRef, useState } from 'react';

import { formatCharacterCount } from '../constants/validation';
import { useLookalike } from '../hooks/useLookalike';
import { PROMPT_LIMITS } from '../services/promptAdmission';
import { MOTION, motionDuration } from '../theme/motion';
import { DEFAULT_CATEGORY, type Prompt } from '../types';
import type { PromptEditorProps } from '../types/components';
import { type FieldErrors, Logger, toError, validatePromptFields } from '../utils';
import { cn } from '../utils/cn';
import { extractVariables } from '../utils/promptVariables';

import ConfirmDialog from './ConfirmDialog';
import CategoryChips from './editor/CategoryChips';
import LookalikeCallout from './editor/LookalikeCallout';
import { useShareCodeImport } from './editor/useShareCodeImport';
import VariableTextarea from './editor/VariableTextarea';

type EditorMode = 'write' | 'import';

/** No Library given: one array, so the Lookalike search is not restarted at each render */
const NO_PROMPTS: readonly Prompt[] = [];

/** Share of a limit from which the counter shows the limit too */
const NEAR_LIMIT = 0.9;

const plural = (count: number, word: string): string =>
  `${count.toLocaleString()} ${word}${count === 1 ? '' : 's'}`;

/** "118 characters"; against the limit ("19,000/20,000 characters") once close to it */
const countLabel = (length: number, limit: number): string =>
  length >= limit * NEAR_LIMIT ? formatCharacterCount(length, limit) : plural(length, 'character');

const CheckIcon: FC = () => (
  <svg className="w-4 h-4 animate-pop-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

/**
 * The one editor for writing a new Prompt, opening a Share code, and editing a Prompt. One header
 * bar (Cancel, the heading, Save), then the title, the Category chips, the text with its Variables
 * highlighted, and the list of those Variables. Cmd/Ctrl+S saves; Escape is Cancel, which asks
 * before discarding changes.
 */
const PromptEditor: FC<PromptEditorProps> = ({
  prompt,
  initialTitle = '',
  initialCategory = DEFAULT_CATEGORY,
  categories,
  library = NO_PROMPTS,
  onSubmit,
  onClose,
  onDelete,
  onCreateCategory
}) => {
  const isEdit = prompt !== undefined;
  const titleId = useId();
  const contentId = useId();
  const titleErrorId = useId();
  const contentErrorId = useId();
  const shareCodeId = useId();
  const shareCodeStatusId = useId();
  const saveRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const formId = useId();

  // The title takes the keyboard as the editor opens, while the sheet is still rising. It must not
  // scroll to the title: the sheet starts below the panel, and in the side panel (#root, overflow
  // hidden) that scroll would drag the whole app up at the first frame and cut the rise short
  useEffect(() => { titleRef.current?.focus({ preventScroll: true }); }, []);

  const [mode, setMode] = useState<EditorMode>('write');
  // The text as typed, kept as the fields' defaultValue: React 19 resets a form's uncontrolled
  // fields once its action completes, and the reset restores the defaultValue, so a refused save
  // keeps exactly what the user typed
  const [title, setTitle] = useState(prompt?.title ?? initialTitle);
  const [content, setContent] = useState(prompt?.content ?? '');
  const [category, setCategory] = useState(prompt?.category ?? initialCategory);
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState<'discard' | 'delete' | null>(null);
  // Keep both: no more "This looks familiar" until the editor closes
  const [keepBoth, setKeepBoth] = useState(false);

  const [importCategory, setImportCategory] = useState(DEFAULT_CATEGORY);
  // A Share code naming a Category of the Library imports into it; otherwise into the default one
  const shareCode = useShareCodeImport((decoded) => {
    setImportCategory(categories.some(c => c.name === decoded.category) ? decoded.category : DEFAULT_CATEGORY);
  });

  const isImport = mode === 'import';
  const hasChanges = isEdit
    ? title !== prompt.title || content !== prompt.content || category !== prompt.category
    : isImport
      ? shareCode.code !== ''
      // What the editor opened with (a title and a Category from the Library) is not a change
      : title !== initialTitle || content !== '' || category !== initialCategory;

  const [errors, submitAction, isPending] = useActionState(
    async (_previous: FieldErrors | null, formData: FormData): Promise<FieldErrors | null> => {
      let data: { title: string; content: string; category: string };

      if (isImport) {
        if (!shareCode.decoded || shareCode.error) {
          Logger.warn('Import refused: no Share code that can be opened', { component: 'PromptEditor', mode: 'import' });
          return { general: shareCode.error || 'Paste a valid Share code to import' };
        }
        data = { title: shareCode.decoded.title, content: shareCode.decoded.content, category: importCategory };
      } else {
        data = {
          title: formData.get('title') as string,
          content: formData.get('content') as string,
          category
        };
        const fieldErrors = validatePromptFields(data.title, data.content, {
          component: 'PromptEditor',
          ...(isEdit && { promptId: prompt.id, requireTitle: true })
        });
        if (Object.keys(fieldErrors).length > 0) {
          return fieldErrors;
        }
        if (isEdit && data.title === prompt.title && data.content === prompt.content && data.category === prompt.category) {
          Logger.warn('Form validation failed: No changes to save', { component: 'PromptEditor', promptId: prompt.id });
          return { general: 'No changes to save' };
        }
      }

      const context = {
        component: 'PromptEditor',
        mode: isEdit ? 'edit' : mode,
        category: data.category,
        ...(isEdit && { promptId: prompt.id })
      };
      try {
        await onSubmit(data);
        Logger.info('Prompt form submitted successfully', context);
      } catch (err) {
        Logger.error('Failed to submit prompt form', toError(err), context);
        return { general: (err as Error).message || 'Failed to save prompt' };
      }

      // Save shows "Saved" for a moment, still locked, then the editor closes (effect below). The
      // pause is not awaited here: React would hold every later transition until the action ends
      setSaved(true);
      return null;
    },
    null
  );

  // The latest onClose, so the pause below is not restarted by each render of the parent
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  useEffect(() => {
    if (!saved) { return; }
    const timer = setTimeout(() => { onCloseRef.current(); }, motionDuration(MOTION.savedPause));
    return () => { clearTimeout(timer); };
  }, [saved]);

  const locked = isPending || saved;
  // Nothing to point out once dismissed, while saving (the Library then holds this very Prompt) and
  // while a Share code is imported instead
  const found = useLookalike(content, library, prompt?.id);
  const lookalike = keepBoth || locked || isImport ? null : found;
  const saveBlocked = isImport && (!shareCode.decoded || !!shareCode.error || shareCode.validating);

  const requestClose = () => {
    if (locked) { return; }
    if (hasChanges) {
      setConfirming('discard');
    } else {
      onClose();
    }
  };

  // The editor's shortcuts, on its whole surface. A native listener: the dialogs render in a
  // portal, outside this element, so their keys never reach it
  const handleKeyDown = (event: KeyboardEvent) => {
    if (confirming !== null || event.defaultPrevented) { return; }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      // Pressing Save submits exactly like a click, through the form's action
      saveRef.current?.click();
    } else if (event.key === 'Escape') {
      // A part of the editor that uses Escape itself (the new Category row) is marked so; this
      // listener hears the key before React's handlers do
      if (event.target instanceof Element && event.target.closest('[data-keeps-escape]')) { return; }
      event.preventDefault();
      // The key stops here: React renders "Discard changes?" before the event goes on, and the
      // dialog's own Escape listener on the document would close it at once
      event.stopPropagation();
      requestClose();
    }
  };
  const keyHandlerRef = useRef(handleKeyDown);
  useEffect(() => { keyHandlerRef.current = handleKeyDown; });
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) { return; }
    const listener = (event: KeyboardEvent) => { keyHandlerRef.current(event); };
    root.addEventListener('keydown', listener);
    return () => { root.removeEventListener('keydown', listener); };
  }, []);

  const switchMode = (next: EditorMode) => {
    if (next === 'write') { shareCode.reset(); }
    setMode(next);
  };


  const variables = extractVariables(content);
  const titleNearLimit = title.length >= PROMPT_LIMITS.title * NEAR_LIMIT;

  let saveLabel = 'Save';
  if (saved) { saveLabel = 'Saved'; }
  else if (isPending) { saveLabel = 'Saving…'; }
  else if (isImport) { saveLabel = 'Import'; }

  return (
    <div ref={rootRef} className="h-full flex flex-col bg-card">
      {/* Seamless until the editor scrolls, like every Section header (scroll-edge-top) */}
      <header className="shrink-0 grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-3 bg-card border-b border-transparent scroll-edge-top">
        <button
          type="button"
          onClick={requestClose}
          disabled={locked}
          aria-keyshortcuts="Escape"
          className="justify-self-start h-9 px-3 rounded-full text-sm font-semibold text-accent hover:bg-muted transition-colors focus-interactive disabled:opacity-50"
        >
          Cancel
        </button>
        <h1 className="text-base font-extrabold text-primary tracking-tight">
          {isEdit ? 'Edit prompt' : 'New prompt'}
        </h1>
        <button
          ref={saveRef}
          type="submit"
          form={formId}
          disabled={locked || saveBlocked}
          aria-keyshortcuts="Meta+S Control+S"
          title={isImport ? 'Import (⌘S)' : 'Save (⌘S)'}
          className={cn(
            'justify-self-end h-9 px-4 inline-flex items-center gap-1.5 rounded-full text-sm font-bold transition-save focus-primary disabled:cursor-not-allowed active:scale-94',
            saved
              ? 'bg-success-subtle text-success'
              : 'bg-accent text-on-accent hover:bg-accent-hover disabled:opacity-50'
          )}
        >
          {saved && <CheckIcon />}
          {saveLabel}
        </button>
      </header>

      {errors?.general && (
        <div role="alert" className="shrink-0 px-5 py-3 text-sm font-medium text-danger bg-danger-subtle border-b border-danger">
          {errors.general}
        </div>
      )}

      <div className="flex-1 overflow-auto custom-scrollbar" data-scroll-container>
        <form id={formId} action={submitAction} className="flex flex-col gap-5 px-5 pt-5 pb-6" noValidate>
          {!isImport && (
            <div className="flex flex-col gap-1">
              <label htmlFor={titleId} className="sr-only">Title</label>
              <input
                id={titleId}
                ref={titleRef}
                type="text"
                name="title"
                defaultValue={title}
                onChange={(event) => { setTitle(event.target.value); }}
                placeholder={isEdit ? 'Name your prompt' : 'Name your prompt (optional)'}
                disabled={locked}
                aria-invalid={!!errors?.title}
                aria-describedby={errors?.title ? titleErrorId : undefined}
                className="w-full p-0 bg-transparent border-0 outline-none text-2xl font-extrabold tracking-tight text-primary placeholder:text-tertiary"
              />
              {errors?.title && (
                <p id={titleErrorId} className="text-sm font-medium text-danger">{errors.title}</p>
              )}
              {titleNearLimit && (
                <p className={cn('text-xs font-medium', title.length > PROMPT_LIMITS.title ? 'text-danger' : 'text-tertiary')}>
                  {formatCharacterCount(title.length, PROMPT_LIMITS.title)}
                </p>
              )}
            </div>
          )}

          {!isEdit && (
            <button
              type="button"
              onClick={() => { switchMode(isImport ? 'write' : 'import'); }}
              disabled={locked}
              className="self-start -mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline focus-interactive rounded disabled:opacity-50"
            >
              {isImport ? 'Write a new prompt instead' : 'Paste a Share code'}
            </button>
          )}

          {isImport ? (
            <div className="flex flex-col gap-2">
              <label htmlFor={shareCodeId} className="text-xs font-bold text-secondary">Share code</label>
              <textarea
                id={shareCodeId}
                value={shareCode.code}
                onChange={(event) => { shareCode.setCode(event.target.value); }}
                placeholder="Paste the Share code you received"
                rows={5}
                disabled={locked}
                aria-invalid={!!shareCode.error}
                aria-describedby={shareCodeStatusId}
                className={cn(
                  'w-full px-4 py-3 rounded-2xl border bg-subtle font-mono text-sm text-primary placeholder:text-tertiary resize-none focus-input',
                  shareCode.error ? 'border-error' : 'border-input'
                )}
              />
              <p id={shareCodeStatusId} aria-live="polite" className="text-xs font-medium">
                {shareCode.validating && <span className="text-accent">Opening the Share code…</span>}
                {!shareCode.validating && shareCode.error && <span className="text-danger">{shareCode.error}</span>}
                {!shareCode.validating && !shareCode.error && shareCode.decoded && (
                  <span className="text-success">Share code opened</span>
                )}
              </p>

              {shareCode.decoded && !shareCode.error && (
                <>
                  <div className="flex flex-col gap-2 p-4 rounded-2xl border border-default bg-raised">
                    <p className="text-base font-extrabold text-primary">{shareCode.decoded.title}</p>
                    <p className="max-h-40 overflow-y-auto custom-scrollbar text-sm text-secondary whitespace-pre-wrap break-words">
                      {shareCode.decoded.content}
                    </p>
                    <p className="text-xs text-tertiary">
                      {plural(shareCode.decoded.content.length, 'character')} · Shared in {shareCode.decoded.category}
                    </p>
                  </div>
                  <CategoryChips
                    label="Category"
                    categories={categories}
                    value={importCategory}
                    onChange={setImportCategory}
                    onCreateCategory={onCreateCategory}
                    disabled={locked}
                  />
                </>
              )}
            </div>
          ) : (
            <>
              <CategoryChips
                label="Category"
                categories={categories}
                value={category}
                onChange={setCategory}
                onCreateCategory={onCreateCategory}
                disabled={locked}
              />

              <div className="flex flex-col gap-1">
                <VariableTextarea
                  id={contentId}
                  name="content"
                  ariaLabel="Content"
                  value={content}
                  onChange={setContent}
                  placeholder="Write your prompt here."
                  disabled={locked}
                  invalid={!!errors?.content}
                  describedBy={errors?.content ? contentErrorId : undefined}
                />
                {errors?.content && (
                  <p id={contentErrorId} className="text-sm font-medium text-danger">{errors.content}</p>
                )}
              </div>

              {lookalike && (
                <LookalikeCallout
                  lookalike={lookalike}
                  yours={content}
                  onKeepBoth={() => { setKeepBoth(true); }}
                  disabled={locked}
                />
              )}

              <section aria-label="Variables" className="flex flex-col gap-2">
                <span className="text-xs font-bold text-secondary">Variables</span>
                {variables.length > 0 ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {/* Keyed by name: a Variable already there keeps its element, so only a new one pops in */}
                    {variables.map(name => (
                      <li
                        key={name}
                        className="animate-pop h-7 px-2.5 inline-flex items-center rounded-full border-[1.5px] border-dashed border-accent bg-accent-subtle text-xs font-bold text-accent-strong"
                      >
                        {name}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-tertiary">
                    Type {'{{name}}'} to add a Variable you fill in at Insertion.
                  </p>
                )}
              </section>

              <div className="flex items-center justify-between gap-3 text-xs font-medium text-tertiary">
                <span className={cn(content.length > PROMPT_LIMITS.content && 'text-danger')}>
                  {countLabel(content.length, PROMPT_LIMITS.content)}
                </span>
                {isEdit && (
                  <span>Edited {new Date(prompt.updatedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
                )}
              </div>
            </>
          )}

          {isEdit && onDelete && (
            <button
              type="button"
              onClick={() => { setConfirming('delete'); }}
              disabled={locked}
              className="self-center mt-2 px-3 py-1.5 rounded-lg text-sm font-medium text-danger hover:bg-danger-subtle transition-colors focus-danger disabled:opacity-50"
            >
              Delete prompt
            </button>
          )}
        </form>
      </div>

      {/* "This looks familiar" for a screen reader, whose focus stays in the text: said once per Prompt
          pointed out, without the percentage, which changes at each pause in typing */}
      <p data-testid="lookalike-announcement" aria-live="polite" className="sr-only">
        {lookalike && `This looks familiar: it is like “${lookalike.prompt.title}”, a Prompt of your Library`}
      </p>

      <ConfirmDialog
        isOpen={confirming === 'discard'}
        onConfirm={() => { setConfirming(null); onClose(); }}
        onCancel={() => { setConfirming(null); }}
        title="Discard changes?"
        message={isEdit ? 'Your changes to this prompt will be lost.' : 'This prompt will not be saved.'}
        confirmText="Discard"
        cancelText="Keep editing"
        variant="warning"
      />

      {isEdit && onDelete && (
        <ConfirmDialog
          isOpen={confirming === 'delete'}
          onConfirm={() => { setConfirming(null); onDelete(prompt.id); }}
          onCancel={() => { setConfirming(null); }}
          title="Delete Prompt"
          message={`Are you sure you want to delete "${prompt.title}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          variant="danger"
        />
      )}
    </div>
  );
};

export default PromptEditor;
