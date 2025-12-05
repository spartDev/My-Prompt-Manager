import DOMPurify from 'dompurify';
import { useState, memo } from 'react';
import type { FC, MouseEvent, ReactNode } from 'react';

import { encode } from '../services/promptEncoder';
import { PromptCardProps } from '../types/components';
import { Logger, toError } from '../utils';

import CategoryBadge from './CategoryBadge';
import ConfirmDialog from './ConfirmDialog';
import { Dropdown, DropdownItem } from './Dropdown';

const PromptCard: FC<PromptCardProps> = ({
  prompt,
  categories,
  onEdit,
  onDelete,
  onCopy,
  showToast,
  searchQuery = ''
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const highlightText = (text: string, query: string): ReactNode => {
    if (!query.trim()) {return text;}
    
    // Sanitize both text and query to prevent XSS
     
    const sanitizedText = DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
     
    const sanitizedQuery = DOMPurify.sanitize(query, { ALLOWED_TAGS: [] });
    
    const searchTerm = sanitizedQuery.toLowerCase().trim();
    const lowerText = sanitizedText.toLowerCase();
    const parts: ReactNode[] = [];
    let lastIndex = 0;
    let index = lowerText.indexOf(searchTerm);
    
    while (index !== -1) {
      // Add text before the match
      if (index > lastIndex) {
        parts.push(sanitizedText.substring(lastIndex, index));
      }
      
      // Add highlighted match - using stable key with prompt ID and match position
      parts.push(
        <mark key={`highlight-${prompt.id}-${String(index)}-${searchTerm}`} className="bg-yellow-200 dark:bg-yellow-800/40 px-1 rounded-xs">
          {sanitizedText.substring(index, index + searchTerm.length)}
        </mark>
      );
      
      lastIndex = index + searchTerm.length;
      index = lowerText.indexOf(searchTerm, lastIndex);
    }
    
    // Add remaining text
    if (lastIndex < sanitizedText.length) {
      parts.push(sanitizedText.substring(lastIndex));
    }
    
    return parts;
  };

  const handleCopyClick = (e?: MouseEvent | KeyboardEvent) => {
    e?.stopPropagation();
    onCopy(prompt.content);
  };

  const handleEditClick = () => {
    onEdit(prompt);
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    onDelete(prompt.id);
    setShowDeleteConfirm(false);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
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

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const getCategory = (categoryName: string) => {
    return categories.find(cat => cat.name === categoryName);
  };

  // Menu items for dropdown
  const menuItems: DropdownItem[] = [
    {
      id: 'edit',
      label: 'Edit',
      onSelect: handleEditClick
    },
    {
      id: 'delete',
      label: 'Delete',
      onSelect: handleDeleteClick,
      className: 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 focus:bg-red-50 dark:focus:bg-red-900/20 focus:text-red-700 dark:focus:text-red-400'
    }
  ];


  return (
    <article className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xs border-b border-purple-100 dark:border-gray-700 p-5 hover:bg-white/90 dark:hover:bg-gray-800/90 transition-all duration-200 relative group" aria-labelledby={`prompt-title-${prompt.id}`}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 items-center">
        {/* Title and metadata */}
        <div className="pr-3">
          {/* inline-block enables text-overflow: ellipsis to work with inline elements (e.g., <mark> tags from search highlighting) */}
          <h3
            id={`prompt-title-${prompt.id}`}
            className="inline-block max-w-full font-semibold text-gray-900 dark:text-gray-100 text-sm leading-tight truncate"
            title={(prompt).title}
            aria-label={prompt.title}
          >
            {highlightText((prompt).title, searchQuery)}
          </h3>
          <div className="flex items-center space-x-2 mt-1">
            {(() => {
              const category = getCategory((prompt).category);
              return category ? (
                <CategoryBadge
                  category={category}
                  variant="pill"
                  size="sm"
                />
              ) : null;
            })()}
            <time
              className="text-xs text-gray-500 dark:text-gray-400"
              dateTime={new Date((prompt).updatedAt).toISOString()}
              aria-label={`Last updated: ${formatDate((prompt).updatedAt)}`}
            >
              {formatDate((prompt).updatedAt)}
            </time>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* Copy Button */}
          <button
            onClick={handleCopyClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCopyClick();
              }
            }}
            className="p-2 text-gray-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors focus-interactive"
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
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                void handleShare();
              }
            }}
            disabled={isSharing}
            className="p-2 text-gray-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors focus-interactive disabled:opacity-50 disabled:cursor-not-allowed"
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

          {/* Menu */}
          <Dropdown
            trigger={
              <button
                className="p-1 text-gray-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 rounded-md hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors focus-interactive"
                aria-label={`More actions for ${prompt.title}`}
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </button>
            }
            items={menuItems}
            placement="bottom-end"
            className="w-28"
            itemClassName="px-4 py-3 text-sm font-medium"
          />
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        title="Delete Prompt"
        message={`Are you sure you want to delete "${prompt.title}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
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
  if (prevProps.onDelete !== nextProps.onDelete) {return false;}
  if (prevProps.onCopy !== nextProps.onCopy) {return false;}
  // Note: showToast is excluded from comparison as function references change frequently
  // and re-rendering on showToast changes provides no benefit

  return true;
};

export default memo(PromptCard, arePropsEqual);