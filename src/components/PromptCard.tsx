import DOMPurify from 'dompurify';
import React, { useState } from 'react';

import { Category } from '../types';
import { PromptCardProps } from '../types/components';

const PromptCard: React.FC<PromptCardProps> = ({
  prompt,
  categories,
  onEdit,
  onDelete,
  onCopy,
  searchQuery = ''
}) => {
  const [showFullContent, setShowFullContent] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) {return text;}
    return text.substring(0, maxLength) + '...';
  };

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) {return text;}
    
    // Sanitize both text and query to prevent XSS
    const sanitizedText = DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
    const sanitizedQuery = DOMPurify.sanitize(query, { ALLOWED_TAGS: [] });
    
    const searchTerm = sanitizedQuery.toLowerCase().trim();
    const lowerText = sanitizedText.toLowerCase();
    const parts = [];
    let lastIndex = 0;
    let index = lowerText.indexOf(searchTerm);
    
    while (index !== -1) {
      // Add text before the match
      if (index > lastIndex) {
        parts.push(sanitizedText.substring(lastIndex, index));
      }
      
      // Add highlighted match - using key with unique identifier
      parts.push(
        <mark key={`highlight-${index}-${Date.now()}`} className="bg-yellow-200 px-1 rounded">
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

  const handleCopyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCopy(prompt.content);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(prompt);
    setShowMenu(false);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this prompt? This action cannot be undone.')) {
      onDelete(prompt.id);
    }
    setShowMenu(false);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const getCategoryColor = (categoryName: string) => {
    const category = categories.find((cat: Category) => cat.name === categoryName);
    return category?.color || '#6B7280'; // Default gray color if category not found
  };

  const contentToShow = showFullContent 
    ? prompt.content 
    : truncateText(prompt.content, 150);

  return (
    <div className="bg-white/70 backdrop-blur-sm border border-purple-100 rounded-2xl p-5 hover:shadow-xl hover:shadow-purple-500/10 transition-all duration-300 relative group hover:bg-white/90">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0 pr-2">
          <h3 className="font-semibold text-gray-900 text-base leading-tight" 
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                wordBreak: 'break-word'
              }}
              title={prompt.title} // Show full title on hover
          >
            {highlightText(prompt.title, searchQuery)}
          </h3>
          <div className="flex items-center space-x-3 mt-3">
            <span 
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold text-white border-2 border-white shadow-sm"
              style={{ backgroundColor: getCategoryColor(prompt.category) }}
            >
              {prompt.category}
            </span>
            <span className="text-xs text-gray-500 font-medium">
              {formatDate(prompt.updatedAt)}
            </span>
          </div>
        </div>
        
        {/* Actions Menu */}
        <div className="relative flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1.5 text-gray-400 hover:text-purple-600 rounded-lg hover:bg-purple-50 opacity-0 group-hover:opacity-100 transition-all duration-200"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>
          
          {showMenu && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-10 bg-transparent border-0 cursor-default"
                onClick={() => setShowMenu(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setShowMenu(false);
                  }
                }}
                aria-label="Close menu"
              />
              <div className="absolute right-0 top-full mt-1 w-28 bg-white/90 backdrop-blur-sm rounded-xl shadow-xl z-20 border border-purple-200 overflow-hidden">
                <button
                  onClick={handleEditClick}
                  className="block w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 font-medium transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={handleDeleteClick}
                  className="block w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 font-medium transition-colors"
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="mb-4">
        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
          {highlightText(contentToShow, searchQuery)}
        </p>
        
        {prompt.content.length > 150 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowFullContent(!showFullContent);
            }}
            className="text-xs text-purple-600 hover:text-purple-700 mt-2 font-semibold"
          >
            {showFullContent ? '↑ Show less' : '↓ Show more'}
          </button>
        )}
      </div>

      {/* Copy Button */}
      <div className="flex justify-end">
        <button
          onClick={handleCopyClick}
          className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-all duration-200 text-xs font-semibold shadow-md hover:shadow-lg transform hover:scale-105"
        >
          <svg className="h-3 w-3 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    </div>
  );
};

export default PromptCard;