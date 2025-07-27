import DOMPurify from 'dompurify';
import { useState, useRef, useEffect } from 'react';
import type { FC, MouseEvent } from 'react';

import { Category, Prompt } from '../types';
import { PromptCardProps } from '../types/components';

const PromptCard: FC<PromptCardProps> = ({
  prompt,
  categories,
  onEdit,
  onDelete,
  onCopy,
  searchQuery = ''
}) => {
  const [showFullContent, setShowFullContent] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const firstMenuItemRef = useRef<HTMLButtonElement>(null);

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) {return text;}
    return text.substring(0, maxLength) + '...';
  };

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) {return text;}
    
    // Sanitize both text and query to prevent XSS
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const sanitizedText = DOMPurify.sanitize(text, { ALLOWED_TAGS: [] }) as string;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const sanitizedQuery = DOMPurify.sanitize(query, { ALLOWED_TAGS: [] }) as string;
    
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

  const handleCopyClick = (e: MouseEvent) => {
     
    e.stopPropagation();
    (onCopy as (content: string) => void)((prompt).content);
  };

  const handleEditClick = (e: MouseEvent) => {
     
    e.stopPropagation();
    (onEdit as (prompt: Prompt) => void)(prompt);
    setShowMenu(false);
  };

  const handleDeleteClick = (e: MouseEvent) => {
     
    e.stopPropagation();
    if (confirm('Delete this prompt? This action cannot be undone.')) {
      (onDelete as (id: string) => void)((prompt).id);
    }
    setShowMenu(false);
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
    const handleClickOutside = (event: MouseEvent) => {
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
      document.addEventListener('mousedown', handleClickOutside as EventListener);
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside as EventListener);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [showMenu]);

  const contentToShow = showFullContent 
    ? (prompt).content 
    : truncateText((prompt).content, 150);

  return (
    <article className="bg-white/70 backdrop-blur-sm border border-purple-100 rounded-2xl p-5 hover:shadow-xl hover:shadow-purple-500/10 transition-all duration-300 relative group hover:bg-white/90" aria-labelledby={`prompt-title-${prompt.id}`}>
      {/* Header */}
      <header className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0 pr-2">
          <h3 
            id={`prompt-title-${prompt.id}`}
            className="font-semibold text-gray-900 text-base leading-tight" 
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word'
            }}
            title={(prompt).title} // Show full title on hover
          >
            {highlightText((prompt).title, searchQuery)}
          </h3>
          <div className="flex items-center space-x-3 mt-3" role="group" aria-label="Prompt metadata">
            <span 
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold text-white border-2 border-white shadow-sm"
              style={{ backgroundColor: getCategoryColor((prompt).category) }}
              role="img"
              aria-label={`Category: ${(prompt).category}`}
            >
              {(prompt).category}
            </span>
            <time 
              className="text-xs text-gray-500 font-medium"
              dateTime={new Date((prompt).updatedAt).toISOString()}
              aria-label={`Last updated: ${formatDate((prompt).updatedAt)}`}
            >
              {formatDate((prompt).updatedAt)}
            </time>
          </div>
        </div>
        
        {/* Actions Menu */}
        <div className="relative flex-shrink-0">
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
            className="p-1.5 text-gray-400 hover:text-purple-600 rounded-lg hover:bg-purple-50 opacity-0 group-hover:opacity-100 transition-all duration-200 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1"
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
                className="absolute right-0 top-full mt-1 w-28 bg-white/90 backdrop-blur-sm rounded-xl shadow-xl z-20 border border-purple-200 overflow-hidden"
                role="menu"
                aria-label="Prompt actions"
              >
                <button
                  ref={firstMenuItemRef}
                  onClick={handleEditClick}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleEditClick(e);
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
                  className="block w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 font-medium transition-colors focus:outline-none focus:bg-purple-50 focus:text-purple-700"
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
                      handleDeleteClick(e);
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
                  className="block w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 font-medium transition-colors focus:outline-none focus:bg-red-50 focus:text-red-700"
                  role="menuitem"
                  aria-label={`Delete ${prompt.title}`}
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="mb-4">
        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
          {highlightText(contentToShow, searchQuery)}
        </p>
        
        {(prompt).content.length > 150 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowFullContent(!showFullContent);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                setShowFullContent(!showFullContent);
              }
            }}
            className="text-xs text-purple-600 hover:text-purple-700 mt-2 font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1 rounded"
            aria-label={showFullContent ? 'Show less content' : 'Show more content'}
            aria-expanded={showFullContent}
          >
            {showFullContent ? '↑ Show less' : '↓ Show more'}
          </button>
        )}
      </div>

      {/* Copy Button */}
      <div className="flex justify-end">
        <button
          onClick={handleCopyClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleCopyClick(e);
            }
          }}
          className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-all duration-200 text-xs font-semibold shadow-md hover:shadow-lg transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          aria-label={`Copy content of ${prompt.title} to clipboard`}
        >
          <svg className="h-3 w-3 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          Copy Prompt
        </button>
      </div>
    </article>
  );
};

export default PromptCard;