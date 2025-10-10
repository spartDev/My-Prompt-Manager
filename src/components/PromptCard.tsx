import DOMPurify from 'dompurify';
import { useState, useRef, useEffect, memo } from 'react';
import type { FC, MouseEvent } from 'react';

import { Category, Prompt } from '../types';
import { PromptCardProps } from '../types/components';

import ConfirmDialog from './ConfirmDialog';

const PromptCard: FC<PromptCardProps> = ({
  prompt,
  categories,
  onEdit,
  onDelete,
  onCopy,
  searchQuery = ''
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const firstMenuItemRef = useRef<HTMLButtonElement>(null);

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) {return text;}
    
    // Sanitize both text and query to prevent XSS
     
    const sanitizedText = DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
     
    const sanitizedQuery = DOMPurify.sanitize(query, { ALLOWED_TAGS: [] });
    
    const searchTerm = sanitizedQuery.toLowerCase().trim();
    const lowerText = sanitizedText.toLowerCase();
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    let index = lowerText.indexOf(searchTerm);
    
    while (index !== -1) {
      // Add text before the match
      if (index > lastIndex) {
        parts.push(sanitizedText.substring(lastIndex, index));
      }
      
      // Add highlighted match - using stable key with prompt ID and match position
      parts.push(
        <mark key={`highlight-${prompt.id}-${String(index)}-${searchTerm}`} className="bg-yellow-200 px-1 rounded">
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
    (onCopy as (content: string) => void)((prompt).content);
  };

  const handleEditClick = (e?: MouseEvent | KeyboardEvent) => {

    e?.stopPropagation();
    (onEdit as (prompt: Prompt) => void)(prompt);
    setShowMenu(false);
  };

  const handleDeleteClick = (e?: MouseEvent | KeyboardEvent) => {

    e?.stopPropagation();
    setShowDeleteConfirm(true);
    setShowMenu(false);
  };

  const handleConfirmDelete = () => {
    (onDelete as (id: string) => void)((prompt).id);
    setShowDeleteConfirm(false);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const getCategoryColor = (categoryName: string) => {
    const category = (categories).find((cat: Category) => cat.name === categoryName);
    return (category?.color as string) || '#6B7280'; // Default gray color if category not found
  };


  // Focus management for dropdown menu
  useEffect(() => {
    if (showMenu && firstMenuItemRef.current) {
      firstMenuItemRef.current.focus();
    }
  }, [showMenu]);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node) && 
          menuButtonRef.current && !menuButtonRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showMenu) {
        setShowMenu(false);
        if (menuButtonRef.current) {
          menuButtonRef.current.focus();
        }
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [showMenu]);


  return (
    <article className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border-b border-purple-100 dark:border-gray-700 p-5 hover:bg-white/90 dark:hover:bg-gray-800/90 transition-all duration-200 relative group" style={{ zIndex: showMenu ? 1000 : 'auto' }} aria-labelledby={`prompt-title-${prompt.id}`}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 items-center justify-between">
        {/* Title and metadata */}
        <div className="flex-1 min-w-0 pr-3">
          <h3
            id={`prompt-title-${prompt.id}`}
            className="inline-block max-w-full font-semibold text-gray-900 dark:text-gray-100 text-sm leading-tight truncate"
            title={(prompt).title}
          >
            {highlightText((prompt).title, searchQuery)}
          </h3>
          <div className="flex items-center space-x-2 mt-1">
            <span 
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
              style={{ backgroundColor: getCategoryColor((prompt).category) }}
              aria-label={`Category: ${(prompt).category}`}
            >
              {(prompt).category}
            </span>
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
        <div className="flex items-center space-x-1 flex-shrink-0">
          {/* Copy Button */}
          <button
            onClick={handleCopyClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCopyClick();
              }
            }}
            className="inline-flex items-center px-2 py-1 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-md hover:from-purple-600 hover:to-indigo-600 transition-all duration-200 text-xs font-medium focus-primary"
            aria-label={`Copy content of ${prompt.title} to clipboard`}
          >
            <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            Copy
          </button>

          {/* Menu */}
          <div className="relative">
            <button
              ref={menuButtonRef}
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                } else if (e.key === 'Escape') {
                  setShowMenu(false);
                } else if (e.key === 'ArrowDown' && showMenu) {
                  e.preventDefault();
                  if (firstMenuItemRef.current) {
                    firstMenuItemRef.current.focus();
                  }
                }
              }}
              className="p-1 text-gray-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 rounded-md hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors focus-interactive"
              aria-label={`More actions for ${prompt.title}`}
              aria-expanded={showMenu}
              aria-haspopup="menu"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
            
            {showMenu && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-10 bg-transparent border-0 cursor-default"
                  onClick={() => { setShowMenu(false); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setShowMenu(false);
                    }
                  }}
                  aria-label="Close menu"
                />
                <div 
                  ref={menuRef}
                  className="absolute right-0 top-full mt-1 w-28 bg-white dark:bg-gray-800 backdrop-blur-sm rounded-xl shadow-xl border border-purple-200 dark:border-gray-700 overflow-hidden"
                  style={{ zIndex: 1001 }}
                  role="menu"
                  aria-label="Prompt actions"
                >
                  <button
                    ref={firstMenuItemRef}
                    onClick={handleEditClick}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        (onEdit as (prompt: Prompt) => void)(prompt);
                        setShowMenu(false);
                      } else if (e.key === 'Escape') {
                        setShowMenu(false);
                        if (menuButtonRef.current) {
                          menuButtonRef.current.focus();
                        }
                      } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        const nextButton = e.currentTarget.nextElementSibling as HTMLButtonElement | null;
                        nextButton?.focus();
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        menuButtonRef.current?.focus();
                      }
                    }}
                    className="block w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-700 dark:hover:text-purple-400 font-medium transition-colors focus-secondary focus:bg-purple-50 dark:focus:bg-purple-900/20 focus:text-purple-700 dark:focus:text-purple-400"
                    role="menuitem"
                    aria-label={`Edit ${prompt.title}`}
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleDeleteClick}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setShowDeleteConfirm(true);
                        setShowMenu(false);
                      } else if (e.key === 'Escape') {
                        setShowMenu(false);
                        if (menuButtonRef.current) {
                          menuButtonRef.current.focus();
                        }
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        const prevButton = e.currentTarget.previousElementSibling as HTMLButtonElement | null;
                        prevButton?.focus();
                      } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        menuButtonRef.current?.focus();
                      }
                    }}
                    className="block w-full text-left px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 font-medium transition-colors focus-danger focus:bg-red-50 dark:focus:bg-red-900/20 focus:text-red-700 dark:focus:text-red-400"
                    role="menuitem"
                    aria-label={`Delete ${prompt.title}`}
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
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
  
  return true;
};

export default memo(PromptCard, arePropsEqual);