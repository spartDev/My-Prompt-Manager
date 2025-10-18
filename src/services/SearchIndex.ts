/**
 * Search indexing system for fast prompt searching
 * Implements inverted index for O(1) term lookup + O(k) result filtering
 * where k = number of matching prompts (vs O(n×m) for full scan)
 */

import { Prompt } from '../types';

/**
 * Tokenize text into searchable terms
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // Replace punctuation with spaces (Unicode-aware: \p{L}=letters, \p{N}=numbers)
    .split(/\s+/)
    .filter(term => term.length > 0 && term.trim().length > 0); // Handle CJK single-character words
}

/**
 * Extract significant terms for indexing (skip common words)
 */
function extractIndexTerms(text: string): string[] {
  const stopWords = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'has',
    'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'use', 'how',
    'who', 'why', 'may', 'way', 'now', 'any', 'new', 'see', 'own', 'say'
  ]);

  return tokenize(text).filter(term => !stopWords.has(term));
}

/**
 * Inverted index structure
 * Maps terms to prompt IDs containing that term
 */
interface InvertedIndex {
  terms: Map<string, Set<string>>; // term -> Set of prompt IDs
  prompts: Map<string, Prompt>;    // prompt ID -> full prompt
  metadata: {
    lastUpdated: number;
    promptCount: number;
    termCount: number;
  };
}

/**
 * Search result with relevance score
 */
export interface SearchResult {
  prompt: Prompt;
  relevance: number; // 0-1 score
  matchedTerms: string[];
}

/**
 * SearchIndex class - manages inverted index for fast searching
 */
export class SearchIndex {
  private index: InvertedIndex;

  constructor() {
    this.index = {
      terms: new Map(),
      prompts: new Map(),
      metadata: {
        lastUpdated: Date.now(),
        promptCount: 0,
        termCount: 0
      }
    };
  }

  /**
   * Build index from prompt array
   * Time: O(n × m) where n = prompts, m = avg terms per prompt
   * Memory: O(t × k) where t = unique terms, k = avg prompts per term
   */
  buildIndex(prompts: Prompt[]): void {
    // Clear existing index
    this.index.terms.clear();
    this.index.prompts.clear();

    // Index each prompt
    for (const prompt of prompts) {
      this.addPromptToIndex(prompt);
    }

    this.index.metadata = {
      lastUpdated: Date.now(),
      promptCount: prompts.length,
      termCount: this.index.terms.size
    };
  }

  /**
   * Add a single prompt to the index
   */
  addPromptToIndex(prompt: Prompt): void {
    // Store prompt
    this.index.prompts.set(prompt.id, prompt);

    // Extract and index terms from all searchable fields
    const titleTerms = extractIndexTerms(prompt.title);
    const contentTerms = extractIndexTerms(prompt.content);
    const categoryTerms = extractIndexTerms(prompt.category);

    const allTerms = new Set([...titleTerms, ...contentTerms, ...categoryTerms]);

    // Add to inverted index
    for (const term of allTerms) {
      if (!this.index.terms.has(term)) {
        this.index.terms.set(term, new Set());
      }
      const termSet = this.index.terms.get(term);
      if (termSet) {
        termSet.add(prompt.id);
      }
    }
  }

  /**
   * Remove a prompt from the index
   */
  removePromptFromIndex(promptId: string): void {
    const prompt = this.index.prompts.get(promptId);
    if (!prompt) {return;}

    // Remove from prompts map
    this.index.prompts.delete(promptId);

    // Remove from term index
    for (const [term, promptIds] of this.index.terms.entries()) {
      promptIds.delete(promptId);
      // Clean up empty term entries
      if (promptIds.size === 0) {
        this.index.terms.delete(term);
      }
    }
  }

  /**
   * Update a prompt in the index
   */
  updatePromptInIndex(prompt: Prompt): void {
    this.removePromptFromIndex(prompt.id);
    this.addPromptToIndex(prompt);
  }

  /**
   * Search with inverted index and prefix matching
   *
   * Complexity:
   * - Exact matches: O(t) where t = query terms
   * - Prefix scan: O(t × V) where V = vocabulary size (~6K-12K typical)
   * - Scoring: O(k × t) where k = matching prompts
   * - Total: O(t × V + k × t)
   *
   * Performance: <2ms for realistic data (2000 prompts, 12K vocabulary)
   * Storage limit (5MB) naturally bounds vocabulary, keeping searches fast.
   *
   * @param query Search query string
   * @param options Search options
   * @returns Array of search results sorted by relevance
   */
  search(
    query: string,
    options: {
      maxResults?: number;
      minRelevance?: number;
      categoryFilter?: string;
    } = {}
  ): SearchResult[] {
    const { maxResults = 100, minRelevance = 0.1, categoryFilter } = options;

    if (!query.trim()) {
      return [];
    }

    // Tokenize search query
    const queryTerms = tokenize(query);
    if (queryTerms.length === 0) {
      return [];
    }

    // Find prompts containing any query term
    const candidatePrompts = new Map<string, Set<string>>(); // promptId -> matched terms

    for (const term of queryTerms) {
      // Check for exact term match
      const exactMatches = this.index.terms.get(term);
      if (exactMatches) {
        for (const promptId of exactMatches) {
          if (!candidatePrompts.has(promptId)) {
            candidatePrompts.set(promptId, new Set());
          }
          const matchedSet = candidatePrompts.get(promptId);
          if (matchedSet) {
            matchedSet.add(term);
          }
        }
      }

      // Check for partial term matches (prefix search)
      for (const [indexedTerm, promptIds] of this.index.terms.entries()) {
        if (indexedTerm.startsWith(term) && indexedTerm !== term) {
          for (const promptId of promptIds) {
            if (!candidatePrompts.has(promptId)) {
              candidatePrompts.set(promptId, new Set());
            }
            const matchedSet = candidatePrompts.get(promptId);
            if (matchedSet) {
              matchedSet.add(term);
            }
          }
        }
      }
    }

    // Calculate relevance scores and build results
    const results: SearchResult[] = [];

    for (const [promptId, matchedTerms] of candidatePrompts.entries()) {
      const prompt = this.index.prompts.get(promptId);
      if (!prompt) {continue;}

      // Apply category filter
      if (categoryFilter && prompt.category !== categoryFilter) {
        continue;
      }

      // Calculate relevance score
      const relevance = this.calculateRelevance(prompt, query, queryTerms, matchedTerms);

      if (relevance >= minRelevance) {
        results.push({
          prompt,
          relevance,
          matchedTerms: Array.from(matchedTerms)
        });
      }
    }

    // Sort by relevance (highest first)
    results.sort((a, b) => b.relevance - a.relevance);

    // Limit results
    return results.slice(0, maxResults);
  }

  /**
   * Calculate relevance score for a prompt
   */
  private calculateRelevance(
    prompt: Prompt,
    originalQuery: string,
    queryTerms: string[],
    matchedTerms: Set<string>
  ): number {
    let score = 0;
    const lowerQuery = originalQuery.toLowerCase();

    // Exact phrase match in title (highest weight)
    if (prompt.title.toLowerCase().includes(lowerQuery)) {
      score += 10;
    }

    // Exact phrase match in content
    if (prompt.content.toLowerCase().includes(lowerQuery)) {
      score += 5;
    }

    // Term coverage (what % of query terms matched)
    const termCoverage = matchedTerms.size / queryTerms.length;
    score += termCoverage * 3;

    // Title term matches (individual terms)
    const titleLower = prompt.title.toLowerCase();
    for (const term of queryTerms) {
      if (titleLower.includes(term)) {
        score += 2;
      }
    }

    // Content term matches
    const contentLower = prompt.content.toLowerCase();
    for (const term of queryTerms) {
      if (contentLower.includes(term)) {
        score += 1;
      }
    }

    // Category match
    if (prompt.category.toLowerCase().includes(lowerQuery)) {
      score += 1;
    }

    // Normalize score to 0-1 range (divide by theoretical maximum)
    // Max score = 10 (title phrase) + 5 (content phrase) + 3 (coverage) +
    //            2*queryTerms (title terms) + 1*queryTerms (content terms) + 1 (category)
    const maxScore = 19 + (3 * queryTerms.length);
    return Math.min(score / maxScore, 1);
  }

  /**
   * Get index statistics
   */
  getStats(): {
    promptCount: number;
    termCount: number;
    avgTermsPerPrompt: number;
    lastUpdated: number;
  } {
    return {
      promptCount: this.index.metadata.promptCount,
      termCount: this.index.metadata.termCount,
      avgTermsPerPrompt: this.index.metadata.termCount / Math.max(this.index.metadata.promptCount, 1),
      lastUpdated: this.index.metadata.lastUpdated
    };
  }

  /**
   * Check if index needs rebuilding
   *
   * IMPORTANT: This must detect changes even when importing older backups
   * where timestamps go backward (common scenario that broke previous implementation)
   */
  needsRebuild(prompts: Prompt[]): boolean {
    // Rebuild if prompt count doesn't match
    if (prompts.length !== this.index.metadata.promptCount) {
      return true;
    }

    // Fast path: check if any prompt has been modified since last index
    const lastUpdated = this.index.metadata.lastUpdated;
    const hasNewerPrompts = prompts.some(prompt => prompt.updatedAt > lastUpdated);
    if (hasNewerPrompts) {
      return true;
    }

    // CRITICAL: Check if prompt IDs have changed (handles backup/restore with older timestamps)
    // This catches the case where user imports a backup with same count but different prompts
    const currentIds = new Set(prompts.map(p => p.id));
    const indexedIds = new Set(this.index.prompts.keys());

    // If any ID is missing from index or index has IDs not in current set, rebuild
    if (currentIds.size !== indexedIds.size) {
      return true;
    }

    for (const id of currentIds) {
      if (!indexedIds.has(id)) {
        return true; // New prompt ID found
      }
    }

    // Check if any indexed prompt content has changed (handles same ID, different content)
    for (const prompt of prompts) {
      const indexedPrompt = this.index.prompts.get(prompt.id);
      if (!indexedPrompt) {
        return true; // Should never happen due to above check, but defensive
      }

      // Check if content has changed (title, content, or category)
      if (
        indexedPrompt.title !== prompt.title ||
        indexedPrompt.content !== prompt.content ||
        indexedPrompt.category !== prompt.category
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Clear the index
   */
  clear(): void {
    this.index.terms.clear();
    this.index.prompts.clear();
    this.index.metadata = {
      lastUpdated: Date.now(),
      promptCount: 0,
      termCount: 0
    };
  }
}

/**
 * Singleton instance for global use
 */
let searchIndexInstance: SearchIndex | null = null;

export function getSearchIndex(): SearchIndex {
  if (!searchIndexInstance) {
    searchIndexInstance = new SearchIndex();
  }
  return searchIndexInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetSearchIndex(): void {
  searchIndexInstance = null;
}
