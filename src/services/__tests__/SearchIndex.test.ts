import { describe, it, expect, beforeEach } from 'vitest';

import { Prompt } from '../../types';
import { SearchIndex, getSearchIndex, resetSearchIndex } from '../SearchIndex';

describe('SearchIndex', () => {
  let searchIndex: SearchIndex;
  let mockPrompts: Prompt[];

  beforeEach(() => {
    // Reset singleton between tests
    resetSearchIndex();
    searchIndex = new SearchIndex();

    // Create mock prompts
    mockPrompts = [
      {
        id: '1',
        title: 'JavaScript Tutorial',
        content: 'Learn JavaScript basics including variables, functions, and objects.',
        category: 'Programming',
        createdAt: Date.now() - 3000,
        updatedAt: Date.now() - 3000
      },
      {
        id: '2',
        title: 'Python Guide',
        content: 'Python programming guide for beginners. Covers syntax and data structures.',
        category: 'Programming',
        createdAt: Date.now() - 2000,
        updatedAt: Date.now() - 2000
      },
      {
        id: '3',
        title: 'Recipe: Chocolate Cake',
        content: 'Delicious chocolate cake recipe with step-by-step instructions.',
        category: 'Cooking',
        createdAt: Date.now() - 1000,
        updatedAt: Date.now() - 1000
      },
      {
        id: '4',
        title: 'Meeting Notes',
        content: 'Quarterly review meeting notes and action items.',
        category: 'Work',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ];
  });

  describe('Index Building', () => {
    it('should build index from prompts', () => {
      searchIndex.buildIndex(mockPrompts);
      const stats = searchIndex.getStats();

      expect(stats.promptCount).toBe(4);
      expect(stats.termCount).toBeGreaterThan(0);
      expect(stats.lastUpdated).toBeLessThanOrEqual(Date.now());
    });

    it('should handle empty prompt array', () => {
      searchIndex.buildIndex([]);
      const stats = searchIndex.getStats();

      expect(stats.promptCount).toBe(0);
      expect(stats.termCount).toBe(0);
    });

    it('should extract terms correctly from title, content, and category', () => {
      const testPrompt: Prompt = {
        id: 'test',
        title: 'Test Title',
        content: 'Test content with multiple words',
        category: 'TestCategory',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      searchIndex.buildIndex([testPrompt]);
      const results = searchIndex.search('test', { maxResults: 10 });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].prompt.id).toBe('test');
    });

    it('should filter stop words from index', () => {
      const testPrompt: Prompt = {
        id: 'test',
        title: 'The Quick Brown Fox',
        content: 'The and for are but not you all',
        category: 'Test',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      searchIndex.buildIndex([testPrompt]);

      // Stop words should not match
      const resultsThe = searchIndex.search('the', { maxResults: 10 });
      const resultsAnd = searchIndex.search('and', { maxResults: 10 });

      expect(resultsThe.length).toBe(0);
      expect(resultsAnd.length).toBe(0);

      // Non-stop words should match
      const resultsQuick = searchIndex.search('quick', { maxResults: 10 });
      expect(resultsQuick.length).toBeGreaterThan(0);
    });

    it('should handle 20K character prompts efficiently', () => {
      const largeContent = 'word '.repeat(4000); // ~20K characters
      const largePrompt: Prompt = {
        id: 'large',
        title: 'Large Prompt',
        content: largeContent,
        category: 'Test',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const startTime = performance.now();
      searchIndex.buildIndex([largePrompt]);
      const buildTime = performance.now() - startTime;

      expect(buildTime).toBeLessThan(500); // Should build in < 500ms
      expect(searchIndex.getStats().promptCount).toBe(1);
    });

    it('should ignore terms shorter than 3 characters', () => {
      const testPrompt: Prompt = {
        id: 'test',
        title: 'a b ab test',
        content: 'x y xy testing',
        category: 'Test',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      searchIndex.buildIndex([testPrompt]);

      // Single/double char terms should not match
      expect(searchIndex.search('a', { maxResults: 10 })).toHaveLength(0);
      expect(searchIndex.search('ab', { maxResults: 10 })).toHaveLength(0);

      // 3+ char terms should match
      expect(searchIndex.search('test', { maxResults: 10 }).length).toBeGreaterThan(0);
    });

    it('should rebuild index when called multiple times', () => {
      searchIndex.buildIndex(mockPrompts.slice(0, 2));
      expect(searchIndex.getStats().promptCount).toBe(2);

      searchIndex.buildIndex(mockPrompts);
      expect(searchIndex.getStats().promptCount).toBe(4);
    });
  });

  describe('Search Operations', () => {
    beforeEach(() => {
      searchIndex.buildIndex(mockPrompts);
    });

    it('should find prompts by exact term match', () => {
      const results = searchIndex.search('javascript', { maxResults: 10 });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].prompt.title).toContain('JavaScript');
    });

    it('should find prompts by partial term match (prefix)', () => {
      const results = searchIndex.search('java', { maxResults: 10 });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].prompt.title).toContain('JavaScript');
    });

    it('should find prompts by content search', () => {
      const results = searchIndex.search('variables', { maxResults: 10 });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].prompt.content).toContain('variables');
    });

    it('should apply category filter correctly', () => {
      const results = searchIndex.search('guide', {
        maxResults: 10,
        categoryFilter: 'Programming'
      });

      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.prompt.category).toBe('Programming');
      });
    });

    it('should return empty array for no matches', () => {
      const results = searchIndex.search('nonexistent', { maxResults: 10 });

      expect(results).toHaveLength(0);
    });

    it('should limit results to maxResults', () => {
      const results = searchIndex.search('programming', { maxResults: 1 });

      expect(results.length).toBeLessThanOrEqual(1);
    });

    it('should filter by minRelevance threshold', () => {
      const results = searchIndex.search('test', {
        maxResults: 100,
        minRelevance: 0.9 // Very high threshold
      });

      // Should return fewer results with high threshold
      expect(results.length).toBeLessThanOrEqual(mockPrompts.length);
      results.forEach(result => {
        expect(result.relevance).toBeGreaterThanOrEqual(0.9);
      });
    });

    it('should sort results by relevance (highest first)', () => {
      const results = searchIndex.search('programming', { maxResults: 10 });

      if (results.length > 1) {
        for (let i = 0; i < results.length - 1; i++) {
          expect(results[i].relevance).toBeGreaterThanOrEqual(results[i + 1].relevance);
        }
      }
    });

    it('should handle multi-term queries', () => {
      const results = searchIndex.search('javascript functions', { maxResults: 10 });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].matchedTerms.length).toBeGreaterThan(0);
    });

    it('should return empty array for empty query', () => {
      const results = searchIndex.search('', { maxResults: 10 });

      expect(results).toHaveLength(0);
    });

    it('should handle special characters gracefully', () => {
      const results = searchIndex.search('recipe: chocolate', { maxResults: 10 });

      expect(results.length).toBeGreaterThan(0);
    });

    it('should be case-insensitive', () => {
      const resultsLower = searchIndex.search('javascript', { maxResults: 10 });
      const resultsUpper = searchIndex.search('JAVASCRIPT', { maxResults: 10 });
      const resultsMixed = searchIndex.search('JavaScript', { maxResults: 10 });

      expect(resultsLower.length).toBe(resultsUpper.length);
      expect(resultsLower.length).toBe(resultsMixed.length);
    });

    it('should search within 10ms for typical queries', () => {
      const startTime = performance.now();
      searchIndex.search('programming', { maxResults: 100 });
      const searchTime = performance.now() - startTime;

      expect(searchTime).toBeLessThan(10);
    });
  });

  describe('Relevance Scoring', () => {
    beforeEach(() => {
      searchIndex.buildIndex(mockPrompts);
    });

    it('should score exact phrase matches in title highest', () => {
      const results = searchIndex.search('JavaScript Tutorial', { maxResults: 10 });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].prompt.title).toBe('JavaScript Tutorial');
      expect(results[0].relevance).toBeGreaterThan(0.5);
    });

    it('should return relevance scores between 0 and 1', () => {
      const results = searchIndex.search('programming', { maxResults: 10 });

      results.forEach(result => {
        expect(result.relevance).toBeGreaterThanOrEqual(0);
        expect(result.relevance).toBeLessThanOrEqual(1);
      });
    });

    it('should include matched terms in results', () => {
      const results = searchIndex.search('javascript functions', { maxResults: 10 });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].matchedTerms).toBeDefined();
      expect(Array.isArray(results[0].matchedTerms)).toBe(true);
    });

    it('should score title matches higher than content matches', () => {
      // Create prompts where term appears in title vs content
      const titleMatch: Prompt = {
        id: 'title',
        title: 'Python Programming',
        content: 'Learn coding basics',
        category: 'Programming',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      const contentMatch: Prompt = {
        id: 'content',
        title: 'Coding Guide',
        content: 'Python is a popular language',
        category: 'Programming',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const testIndex = new SearchIndex();
      testIndex.buildIndex([titleMatch, contentMatch]);

      const results = testIndex.search('python', { maxResults: 10 });

      expect(results.length).toBe(2);
      expect(results[0].prompt.id).toBe('title'); // Title match should rank higher
    });
  });

  describe('Index Maintenance', () => {
    beforeEach(() => {
      searchIndex.buildIndex(mockPrompts);
    });

    it('should add prompt to existing index', () => {
      const newPrompt: Prompt = {
        id: '5',
        title: 'Additional Prompt',
        content: 'Additional content for testing',
        category: 'Test',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      searchIndex.addPromptToIndex(newPrompt);
      const results = searchIndex.search('additional', { maxResults: 10 });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].prompt.id).toBe('5');
    });

    it('should remove prompt from index', () => {
      searchIndex.removePromptFromIndex('1');
      const results = searchIndex.search('javascript', { maxResults: 10 });

      expect(results).toHaveLength(0);
    });

    it('should update prompt in index', () => {
      const updatedPrompt: Prompt = {
        ...mockPrompts[0],
        title: 'Modified JavaScript Tutorial',
        updatedAt: Date.now()
      };

      searchIndex.updatePromptInIndex(updatedPrompt);
      const results = searchIndex.search('modified', { maxResults: 10 });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].prompt.title).toContain('Modified');
    });

    it('should handle removing non-existent prompt gracefully', () => {
      expect(() => {
        searchIndex.removePromptFromIndex('nonexistent');
      }).not.toThrow();
    });

    it('should detect when rebuild is needed (prompt count changed)', () => {
      const initialPrompts = mockPrompts.slice(0, 2);
      searchIndex.buildIndex(initialPrompts);

      expect(searchIndex.needsRebuild(mockPrompts)).toBe(true);
    });

    it('should detect when rebuild is needed (prompts updated)', () => {
      searchIndex.buildIndex(mockPrompts);

      // Simulate prompt update after index was built
      const updatedPrompts = mockPrompts.map(p => ({
        ...p,
        updatedAt: Date.now() + 1000
      }));

      expect(searchIndex.needsRebuild(updatedPrompts)).toBe(true);
    });

    it('should not rebuild when index is current', () => {
      searchIndex.buildIndex(mockPrompts);

      expect(searchIndex.needsRebuild(mockPrompts)).toBe(false);
    });

    it('should clear index completely', () => {
      searchIndex.clear();
      const stats = searchIndex.getStats();

      expect(stats.promptCount).toBe(0);
      expect(stats.termCount).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle prompts with empty strings', () => {
      const emptyPrompt: Prompt = {
        id: 'empty',
        title: '',
        content: '',
        category: '',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      expect(() => {
        searchIndex.buildIndex([emptyPrompt]);
      }).not.toThrow();
    });

    it('should handle unicode characters', () => {
      const unicodePrompt: Prompt = {
        id: 'unicode',
        title: 'Emoji Test 🚀',
        content: 'Content with 中文字符 and émojis',
        category: 'Test',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      searchIndex.buildIndex([unicodePrompt]);
      const results = searchIndex.search('emoji', { maxResults: 10 });

      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle very long queries', () => {
      searchIndex.buildIndex(mockPrompts);
      const longQuery = 'javascript python programming tutorial guide'.repeat(10);

      expect(() => {
        searchIndex.search(longQuery, { maxResults: 10 });
      }).not.toThrow();
    });

    it('should handle prompts with only punctuation', () => {
      const punctuationPrompt: Prompt = {
        id: 'punct',
        title: '!!!???...',
        content: '---***===',
        category: '###',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      expect(() => {
        searchIndex.buildIndex([punctuationPrompt]);
      }).not.toThrow();
    });

    it('should handle duplicate prompts with same id', () => {
      const duplicate: Prompt = {
        ...mockPrompts[0],
        title: 'Duplicate Title'
      };

      searchIndex.buildIndex([mockPrompts[0], duplicate]);

      // Should only index once (second overwrites first)
      const results = searchIndex.search('duplicate', { maxResults: 10 });
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance from getSearchIndex', () => {
      const instance1 = getSearchIndex();
      const instance2 = getSearchIndex();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
      const instance1 = getSearchIndex();
      instance1.buildIndex(mockPrompts);

      resetSearchIndex();

      const instance2 = getSearchIndex();
      expect(instance2.getStats().promptCount).toBe(0);
    });
  });

  describe('Performance', () => {
    it('should handle 1000 prompts efficiently', () => {
      const manyPrompts: Prompt[] = Array.from({ length: 1000 }, (_, i) => ({
        id: String(i),
        title: `Prompt ${i}`,
        content: `Content for prompt number ${i} with some searchable text`,
        category: 'Test',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }));

      const startTime = performance.now();
      searchIndex.buildIndex(manyPrompts);
      const buildTime = performance.now() - startTime;

      expect(buildTime).toBeLessThan(1000); // Should build in < 1 second
      expect(searchIndex.getStats().promptCount).toBe(1000);
    });

    it('should search 1000 prompts quickly', () => {
      const manyPrompts: Prompt[] = Array.from({ length: 1000 }, (_, i) => ({
        id: String(i),
        title: `Prompt ${i}`,
        content: `Content for prompt number ${i} with some searchable text`,
        category: 'Test',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }));

      searchIndex.buildIndex(manyPrompts);

      const startTime = performance.now();
      const results = searchIndex.search('prompt', { maxResults: 100 });
      const searchTime = performance.now() - startTime;

      // Should be reasonably fast (< 50ms even on slower machines)
      expect(searchTime).toBeLessThan(50);
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
