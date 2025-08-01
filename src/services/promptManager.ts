import { 
  Prompt, 
  VALIDATION_LIMITS, 
  DEFAULT_CATEGORY,
  ErrorType,
  AppError 
} from '../types';
import { HighlightedPrompt, TextHighlight } from '../types/hooks';

import { StorageManager } from './storage';

class PromptManagerError extends Error implements AppError {
  public type: ErrorType;
  public details?: unknown;

  constructor(appError: AppError) {
    super(appError.message);
    this.name = 'PromptManagerError';
    this.type = appError.type;
    this.details = appError.details;
  }
}

export class PromptManager {
  private static instance: PromptManager | undefined;
  private storageManager: StorageManager;

  private constructor() {
    this.storageManager = StorageManager.getInstance();
  }

  static getInstance(): PromptManager {
    if (!PromptManager.instance) {
      PromptManager.instance = new PromptManager();
    }
    return PromptManager.instance;
  }

  // Prompt creation and management
  async createPrompt(title: string, content: string, category: string = DEFAULT_CATEGORY): Promise<Prompt> {
    try {
      // Validate input
      const validationError = this.validatePromptData({ title, content, category });
      if (validationError) {
        throw validationError;
      }

      // Generate title if empty
      const finalTitle = title.trim() || this.generateTitle(content);

      // Ensure category exists
      const categories = await this.storageManager.getCategories();
      if (!categories.some(c => c.name === category)) {
        throw new Error(`Category "${category}" does not exist`);
      }

      const promptData = {
        title: finalTitle,
        content: content.trim(),
        category
      };

      return await this.storageManager.savePrompt(promptData);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updatePrompt(id: string, updates: { title?: string; content?: string; category?: string }): Promise<Prompt> {
    try {
      // Validate updates
      const validationError = this.validatePromptData(updates);
      if (validationError) {
        throw validationError;
      }

      // If updating category, ensure it exists
      if (updates.category) {
        const categories = await this.storageManager.getCategories();
        if (!categories.some(c => c.name === updates.category)) {
          throw new Error(`Category "${updates.category}" does not exist`);
        }
      }

      // Clean up data
      const cleanUpdates = {
        ...updates,
        title: updates.title?.trim(),
        content: updates.content?.trim()
      };

      return await this.storageManager.updatePrompt(id, cleanUpdates);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Search functionality
  async searchPrompts(query: string): Promise<Prompt[]> {
    try {
      if (!query.trim()) {
        return await this.storageManager.getPrompts();
      }

      const allPrompts = await this.storageManager.getPrompts();
      const searchTerm = query.toLowerCase().trim();

      return allPrompts.filter(prompt => 
        prompt.title.toLowerCase().includes(searchTerm) ||
        prompt.content.toLowerCase().includes(searchTerm) ||
        prompt.category.toLowerCase().includes(searchTerm)
      );
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async searchPromptsWithHighlights(query: string): Promise<HighlightedPrompt[]> {
    try {
      const searchResults = await this.searchPrompts(query);
      
      if (!query.trim()) {
        return searchResults.map(prompt => ({
          ...prompt,
          titleHighlights: [],
          contentHighlights: []
        }));
      }

      const searchTerm = query.toLowerCase().trim();

      return searchResults.map(prompt => ({
        ...prompt,
        titleHighlights: this.findTextHighlights(prompt.title, searchTerm),
        contentHighlights: this.findTextHighlights(prompt.content, searchTerm)
      }));
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Filtering functionality
  async filterByCategory(category: string | null): Promise<Prompt[]> {
    try {
      const allPrompts = await this.storageManager.getPrompts();
      
      if (!category) {
        return allPrompts;
      }

      return allPrompts.filter(prompt => prompt.category === category);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getPromptsByDateRange(startDate: number, endDate: number): Promise<Prompt[]> {
    try {
      const allPrompts = await this.storageManager.getPrompts();
      
      return allPrompts.filter(prompt => 
        prompt.createdAt >= startDate && prompt.createdAt <= endDate
      );
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Sorting functionality
  async getSortedPrompts(sortBy: 'createdAt' | 'updatedAt' | 'title', order: 'asc' | 'desc' = 'desc'): Promise<Prompt[]> {
    try {
      const allPrompts = await this.storageManager.getPrompts();
      
      return allPrompts.sort((a, b) => {
        let comparison = 0;
        
        switch (sortBy) {
          case 'title':
            comparison = a.title.localeCompare(b.title);
            break;
          case 'createdAt':
            comparison = a.createdAt - b.createdAt;
            break;
          case 'updatedAt':
            comparison = a.updatedAt - b.updatedAt;
            break;
        }
        
        return order === 'asc' ? comparison : -comparison;
      });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Title generation
  generateTitle(content: string): string {
    if (!content || !content.trim()) {
      return 'Untitled Prompt';
    }

    const cleanContent = content.trim().replace(/\s+/g, ' ');
    
    if (cleanContent.length <= VALIDATION_LIMITS.TITLE_GENERATION_LENGTH) {
      return cleanContent;
    }

    // Find the best place to cut off
    const truncated = cleanContent.substring(0, VALIDATION_LIMITS.TITLE_GENERATION_LENGTH);
    const lastSpaceIndex = truncated.lastIndexOf(' ');
    
    if (lastSpaceIndex > VALIDATION_LIMITS.TITLE_GENERATION_LENGTH * 0.7) {
      return truncated.substring(0, lastSpaceIndex) + '...';
    }
    
    return truncated + '...';
  }

  // Validation
  validatePromptData(data: { title?: string; content?: string; category?: string }): PromptManagerError | null {
    const { title, content, category } = data;

    if (title !== undefined) {
      if (title.length > VALIDATION_LIMITS.PROMPT_TITLE_MAX) {
        return new PromptManagerError({
          type: ErrorType.VALIDATION_ERROR,
          message: `Title cannot exceed ${String(VALIDATION_LIMITS.PROMPT_TITLE_MAX)} characters`
        });
      }
    }

    if (content !== undefined) {
      if (!content.trim()) {
        return new PromptManagerError({
          type: ErrorType.VALIDATION_ERROR,
          message: 'Prompt content cannot be empty'
        });
      }

      if (content.length > VALIDATION_LIMITS.PROMPT_CONTENT_MAX) {
        return new PromptManagerError({
          type: ErrorType.VALIDATION_ERROR,
          message: `Content cannot exceed ${String(VALIDATION_LIMITS.PROMPT_CONTENT_MAX)} characters`
        });
      }
    }

    if (category !== undefined) {
      if (category.length > VALIDATION_LIMITS.CATEGORY_NAME_MAX) {
        return new PromptManagerError({
          type: ErrorType.VALIDATION_ERROR,
          message: `Category name cannot exceed ${String(VALIDATION_LIMITS.CATEGORY_NAME_MAX)} characters`
        });
      }
    }

    return null;
  }

  validateCategoryData(data: { name?: string; color?: string }): PromptManagerError | null {
    const { name, color } = data;

    if (name !== undefined) {
      if (!name.trim()) {
        return new PromptManagerError({
          type: ErrorType.VALIDATION_ERROR,
          message: 'Category name cannot be empty'
        });
      }

      if (name.length > VALIDATION_LIMITS.CATEGORY_NAME_MAX) {
        return new PromptManagerError({
          type: ErrorType.VALIDATION_ERROR,
          message: `Category name cannot exceed ${String(VALIDATION_LIMITS.CATEGORY_NAME_MAX)} characters`
        });
      }
    }

    if (color !== undefined && color) {
      const hexColorRegex = /^#[0-9A-F]{6}$/i;
      if (!hexColorRegex.test(color)) {
        return new PromptManagerError({
          type: ErrorType.VALIDATION_ERROR,
          message: 'Color must be a valid hex color code (e.g., #FF0000)'
        });
      }
    }

    return null;
  }

  // Statistics and analytics
  async getPromptStatistics(): Promise<{
    totalPrompts: number;
    categoryCounts: Record<string, number>;
    averageContentLength: number;
    recentActivity: { date: string; count: number }[];
  }> {
    try {
      const allPrompts = await this.storageManager.getPrompts();
      
      const categoryCounts: Record<string, number> = {};
      let totalContentLength = 0;
      
      allPrompts.forEach(prompt => {
        categoryCounts[prompt.category] = (categoryCounts[prompt.category] || 0) + 1;
        totalContentLength += prompt.content.length;
      });

      // Calculate recent activity (last 7 days)
      const now = Date.now();
      const recentActivity: { date: string; count: number }[] = [];
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now - (i * 24 * 60 * 60 * 1000));
        const dateString = date.toISOString().split('T')[0];
        const dayStart = date.setHours(0, 0, 0, 0);
        const dayEnd = date.setHours(23, 59, 59, 999);
        
        const count = allPrompts.filter(prompt => 
          prompt.createdAt >= dayStart && prompt.createdAt <= dayEnd
        ).length;
        
        recentActivity.push({ date: dateString, count });
      }

      return {
        totalPrompts: allPrompts.length,
        categoryCounts,
        averageContentLength: allPrompts.length > 0 ? Math.round(totalContentLength / allPrompts.length) : 0,
        recentActivity
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Duplicate detection
  async findDuplicatePrompts(): Promise<{ original: Prompt; duplicates: Prompt[] }[]> {
    try {
      const allPrompts = await this.storageManager.getPrompts();
      const duplicateGroups: { original: Prompt; duplicates: Prompt[] }[] = [];
      const processedIds = new Set<string>();

      for (let i = 0; i < allPrompts.length; i++) {
        const prompt = allPrompts[i];
        
        if (processedIds.has(prompt.id)) {
          continue;
        }

        const duplicates = allPrompts.slice(i + 1).filter(other => 
          !processedIds.has(other.id) && this.areSimilarPrompts(prompt, other)
        );

        if (duplicates.length > 0) {
          duplicateGroups.push({ original: prompt, duplicates });
          processedIds.add(prompt.id);
          duplicates.forEach(dup => processedIds.add(dup.id));
        }
      }

      return duplicateGroups;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Private helper methods
  private findTextHighlights(text: string, searchTerm: string): TextHighlight[] {
    const highlights: TextHighlight[] = [];
    const lowerText = text.toLowerCase();
    const lowerSearchTerm = searchTerm.toLowerCase();
    
    let startIndex = 0;
    let index = lowerText.indexOf(lowerSearchTerm, startIndex);
    
    while (index !== -1) {
      highlights.push({
        start: index,
        end: index + searchTerm.length,
        text: text.substring(index, index + searchTerm.length)
      });
      
      startIndex = index + searchTerm.length;
      index = lowerText.indexOf(lowerSearchTerm, startIndex);
    }
    
    return highlights;
  }

  private areSimilarPrompts(prompt1: Prompt, prompt2: Prompt): boolean {
    // Check for exact content match
    if (prompt1.content.trim() === prompt2.content.trim()) {
      return true;
    }

    // Check for similar titles and content (simple similarity check)
    const titleSimilarity = this.calculateStringSimilarity(prompt1.title, prompt2.title);
    const contentSimilarity = this.calculateStringSimilarity(prompt1.content, prompt2.content);
    
    return titleSimilarity > 0.8 && contentSimilarity > 0.9;
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) {
      return 1.0; // Both strings are empty
    }
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = Array.from({ length: str2.length + 1 }, () => 
      Array.from({ length: str1.length + 1 }, () => 0)
    );
    
    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }
    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private handleError(error: unknown): PromptManagerError {
    // If it's already a PromptManagerError or StorageError, re-throw it
    if (error instanceof PromptManagerError || (error instanceof Error && 'type' in error)) {
      return error as PromptManagerError;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    return new PromptManagerError({
      type: ErrorType.VALIDATION_ERROR,
      message: errorMessage || 'An unknown error occurred in PromptManager',
      details: error
    });
  }
}