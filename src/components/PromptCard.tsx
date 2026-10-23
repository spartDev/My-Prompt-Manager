import type { FC, MouseEvent, ReactNode } from 'react';
import { memo, useState } from 'react';

import { encode } from '../services/promptEncoder';
import type { PromptCardProps } from '../types/components';
import { Logger, toError } from '../utils';
import { extractVariables } from '../utils/promptVariables';
import { cutWithoutSplittingPairs } from '../utils/truncate';

import CategoryBadge from './CategoryBadge';

/**
 * Formats how many times a prompt was used ("Never used", "1 use", "18 uses").
 * Pure function hoisted to module scope to avoid recreation on every render.
 */
const formatUsage = (usageCount: number): string => {
  if (usageCount <= 0) {return 'Never used';}
  return usageCount === 1 ? '1 use' : `${String(usageCount)} uses`;
};

/** "1 variable" / "3 variables" for the chip counting a Prompt's distinct Variables. */
const formatVariableCount = (count: number): string =>
  count === 1 ? '1 variable' : `${String(count)} variables`;

/**
 * How many UTF-16 code units of a Prompt's content the card preview renders.
 * The preview is clamped to two lines by CSS, so anything past this is never seen;
 * bounding it keeps 20,000-char prompts out of the DOM and out of highlightText.
 */
const PREVIEW_MAX_LENGTH = 300;

/** Bounded prefix of a Prompt's content for the card preview, with an ellipsis when cut. */
const previewOf = (content: string): string =>
  content.length <= PREVIEW_MAX_LENGTH ? content : `${cutWithoutSplittingPairs(content, PREVIEW_MAX_LENGTH)}…`;

/**
 * Highlights matching text in a string based on a search query.
 * Pure function hoisted to module scope to avoid recreation on every render.
 *
 * The text is shown exactly as stored: React renders every part below as a text node, so markup
 * in a title is displayed, never interpreted, and nothing needs to be rewritten first.
 */
const highlightText = (text: string, query: string, promptId: string): ReactNode => {
  const searchTerm = query.trim().toLowerCase();
  if (searchTerm === '') {return text;}

  const lowerText = text.toLowerCase();
  // Lowercasing can change the length (an 'İ' becomes two code units), which would put a match at the wrong
  // position of the stored text: show the title as it is, unmarked
  if (lowerText.length !== text.length) {return text;}

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let index = lowerText.indexOf(searchTerm);

  while (index !== -1) {
    // Add text before the match
    if (index > lastIndex) {
      parts.push(text.substring(lastIndex, index));
    }

    // Add highlighted match - using stable key with prompt ID and match position
    parts.push(
      <mark key={`highlight-${promptId}-${String(index)}-${searchTerm}`} className="bg-highlight text-inherit px-1 rounded-sm">
        {text.substring(index, index + searchTerm.length)}
      </mark>
    );

    lastIndex = index + searchTerm.length;
    index = lowerText.indexOf(searchTerm, lastIndex);
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
};

const PromptCard: FC<PromptCardProps> = ({
  prompt,
  categories,
  onEdit,
  onCopy,
  onTogglePin,
  showToast,
  searchQuery = ''
}) => {
  const [isSharing, setIsSharing] = useState(false);
  const usageCount = typeof prompt.usageCount === 'number' && Number.isFinite(prompt.usageCount) ? prompt.usageCount : 0;

  const handleCopyClick = (e?: MouseEvent | KeyboardEvent) => {
    e?.stopPropagation();
    onCopy(prompt.content);
  };

  const isPinned = prompt.pinned === true;

  const handlePinClick = (e: MouseEvent) => {
    e.stopPropagation();
    onTogglePin(prompt.id);
  };

  const handleEditClick = () => {
    onEdit(prompt);
  };


  const handleShare = async (e?: MouseEvent | KeyboardEvent) => {
    e?.stopPropagation();
    setIsSharing(true);
    try {
      const encoded = encode(prompt);
      await navigator.clipboard.writeText(encoded);
      showToast('Share link copied to clipboard!', 'success');
    } catch (err) {
      Logger.error('Share failed', toError(err), {
        component: 'PromptCard',
        operation: 'share',
        promptId: prompt.id
      });
      showToast('Failed to share prompt. Please try again.', 'error');
    } finally {
      setIsSharing(false);
    }
  };



  const category = categories.find(cat => cat.name === prompt.category);
  const variableCount = extractVariables(prompt.content).length;

  return (
    <article
      data-testid="prompt-card"
      className="bg-card border border-default min-w-0 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow duration-200 relative group"
      aria-labelledby={`prompt-title-${prompt.id}`}
    >
      {/* Header: title and pin star */}
      <div className="flex items-start gap-2">
        <h3
          id={`prompt-title-${prompt.id}`}
          className="min-w-0 flex-1 font-semibold text-primary text-base leading-snug"
          aria-label={prompt.title}
        >
          {/* Stretched button: its ::after overlay covers the card, so clicking anywhere opens the editor.
              inline-block enables text-overflow: ellipsis with <mark> tags from search highlighting */}
          <button
            type="button"
            onClick={handleEditClick}
            className="inline-block max-w-full truncate text-left align-top cursor-pointer focus:outline-none after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-accent"
            aria-label={`Edit ${prompt.title}`}
            title={prompt.title}
          >
            {highlightText(prompt.title, searchQuery, prompt.id)}
          </button>
        </h3>

        {/* Pin star */}
        <button
          type="button"
          onClick={handlePinClick}
          className={`relative z-10 shrink-0 -mt-0.5 p-1 rounded-full transition-colors focus-interactive ${isPinned ? 'text-pin' : 'text-(--border-color-input) hover:text-pin'}`}
          aria-pressed={isPinned}
          aria-label={isPinned ? `Unpin ${prompt.title}` : `Pin ${prompt.title}`}
          title={isPinned ? 'Unpin' : 'Pin to top'}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill={isPinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
            <path strokeLinejoin="round" d="M11.48 3.5a.56.56 0 011.04 0l2.13 5.11a.56.56 0 00.47.34l5.52.44c.5.04.7.66.32.99l-4.2 3.6a.56.56 0 00-.18.55l1.28 5.39a.56.56 0 01-.84.61l-4.73-2.89a.56.56 0 00-.58 0l-4.73 2.89a.56.56 0 01-.84-.61l1.28-5.39a.56.56 0 00-.18-.55l-4.2-3.6a.56.56 0 01.32-.99l5.52-.44a.56.56 0 00.47-.34L11.48 3.5z" />
          </svg>
        </button>
      </div>

      {/* Content preview (2 lines) */}
      <p className="mt-1.5 text-sm leading-relaxed text-tertiary line-clamp-2 break-words">
        {highlightText(previewOf(prompt.content), searchQuery, prompt.id)}
      </p>

      {/* Footer: category, usage and round actions */}
      <div className="mt-3 flex items-center gap-2">
        <div className="min-w-0 flex-1 flex items-center gap-1.5">
          {category ? (
            <CategoryBadge category={category} variant="soft" size="sm" className="min-w-0" />
          ) : null}
          {variableCount > 0 ? (
            <span
              data-testid="prompt-variables-chip"
              className="shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-subtle text-secondary"
              title="Filled in when you insert this prompt on an AI site"
            >
              {formatVariableCount(variableCount)}
            </span>
          ) : null}
        </div>

        <span className="shrink-0 text-xs text-tertiary">
          {formatUsage(usageCount)}
        </span>

        {/* Copy Button */}
        <button
          onClick={handleCopyClick}
          className="relative z-10 shrink-0 h-10 w-10 inline-flex items-center justify-center rounded-full bg-accent-subtle text-accent hover:bg-accent-selected transition-colors focus-interactive"
          aria-label={`Copy content of ${prompt.title} to clipboard`}
          title="Copy to clipboard"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        </button>

        {/* Share Button */}
        <button
          onClick={(e) => { void handleShare(e); }}
          disabled={isSharing}
          className="relative z-10 shrink-0 h-10 w-10 inline-flex items-center justify-center rounded-full bg-subtle text-secondary hover:bg-muted transition-colors focus-interactive disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={isSharing ? `Sharing ${prompt.title}...` : `Share ${prompt.title}`}
          title="Share this prompt"
          aria-busy={isSharing}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
            />
          </svg>
        </button>
      </div>

    </article>
  );
};

// Custom comparison function for React.memo optimization
// Only re-render when essential props change that affect the UI
const arePropsEqual = (prevProps: PromptCardProps, nextProps: PromptCardProps): boolean => {
  // Check if prompt data has changed (most critical for performance)
  if (prevProps.prompt.id !== nextProps.prompt.id) {return false;}
  if (prevProps.prompt.title !== nextProps.prompt.title) {return false;}
  if (prevProps.prompt.content !== nextProps.prompt.content) {return false;}
  if (prevProps.prompt.category !== nextProps.prompt.category) {return false;}
  if (prevProps.prompt.updatedAt !== nextProps.prompt.updatedAt) {return false;}
  if (prevProps.prompt.usageCount !== nextProps.prompt.usageCount) {return false;}
  if (prevProps.prompt.pinned !== nextProps.prompt.pinned) {return false;}
  
  // Check search query changes (affects highlighting)
  if (prevProps.searchQuery !== nextProps.searchQuery) {return false;}
  
  // Check isSelected prop if it exists
  if (prevProps.isSelected !== nextProps.isSelected) {return false;}
  
  // Check categories array length and relevant category data
  // We only need to check if the current prompt's category changed in the categories array
  if (prevProps.categories.length !== nextProps.categories.length) {return false;}
  
  const prevCategory = prevProps.categories.find(cat => cat.name === prevProps.prompt.category);
  const nextCategory = nextProps.categories.find(cat => cat.name === nextProps.prompt.category);
  
  // If category color changed, we need to re-render
  if (prevCategory?.color !== nextCategory?.color) {return false;}
  
  // Function references comparison - these should be stable from parent
  // but we'll do a shallow check to be safe
  if (prevProps.onEdit !== nextProps.onEdit) {return false;}
  if (prevProps.onCopy !== nextProps.onCopy) {return false;}
  if (prevProps.onTogglePin !== nextProps.onTogglePin) {return false;}
  // Note: showToast is excluded from comparison as function references change frequently
  // and re-rendering on showToast changes provides no benefit

  return true;
};

export default memo(PromptCard, arePropsEqual);