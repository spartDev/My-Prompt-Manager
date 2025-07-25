import React, { useState } from 'react';
import { PromptCardProps } from '../types/components';

const PromptCard: React.FC<PromptCardProps> = ({
  prompt,
  onEdit,
  onDelete,
  onCopy,
  searchQuery = ''
}) => {
  const [showFullContent, setShowFullContent] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const searchTerm = query.toLowerCase();
    const lowerText = text.toLowerCase();
    const parts = [];
    let lastIndex = 0;
    let index = lowerText.indexOf(searchTerm);
    
    while (index !== -1) {
      // Add text before the match
      if (index > lastIndex) {
        parts.push(text.substring(lastIndex, index));
      }
      
      // Add highlighted match
      parts.push(
        <mark key={`${index}-${searchTerm}`} className="bg-yellow-200 px-1 rounded">
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

  const contentToShow = showFullContent 
    ? prompt.content 
    : truncateText(prompt.content, 150);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow relative">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">
            {highlightText(prompt.title, searchQuery)}
          </h3>
          <div className="flex items-center space-x-2 mt-1">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
              {prompt.category}
            </span>
            <span className="text-xs text-gray-500">
              {formatDate(prompt.updatedAt)}
            </span>
          </div>
        </div>
        
        {/* Actions Menu */}
        <div className="relative ml-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>
          
          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 mt-1 w-24 bg-white rounded-md shadow-lg z-20 border border-gray-200">
                <button
                  onClick={handleEditClick}
                  className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Edit
                </button>
                <button
                  onClick={handleDeleteClick}
                  className="block w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-gray-100"
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="mb-3">
        <p className="text-sm text-gray-700 whitespace-pre-wrap">
          {highlightText(contentToShow, searchQuery)}
        </p>
        
        {prompt.content.length > 150 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowFullContent(!showFullContent);
            }}
            className="text-xs text-primary-600 hover:text-primary-700 mt-1"
          >
            {showFullContent ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>

      {/* Copy Button */}
      <div className="flex justify-end">
        <button
          onClick={handleCopyClick}
          className="inline-flex items-center px-3 py-1 border border-gray-300 rounded text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
        >
          <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          Copy
        </button>
      </div>
    </div>
  );
};

export default PromptCard;