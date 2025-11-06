---
status: pending
priority: p3
issue_id: "008"
tags: [code-review, code-simplicity, refactoring, pr-156]
dependencies: []
---

# Remove AAA (Arrange-Act-Assert) Comments from Test Files

## Problem Statement

The three new hook test files contain **~225 lines of AAA (Arrange-Act-Assert) comments** that add visual noise without providing value. These comments are redundant because the AAA pattern is already clear from the test structure itself. The comments make tests harder to read by cluttering the code.

**Current Impact:**
- 225+ lines of comment noise
- Inconsistent usage (only 6 of 58 test files use AAA comments)
- Reduces readability instead of improving it
- Makes tests feel bloated

**Files Affected:**
- `src/hooks/__tests__/useCategories.test.ts` (62 comment lines)
- `src/hooks/__tests__/usePrompts.test.ts` (79 comment lines)
- `src/hooks/__tests__/useTheme.test.ts` (84 comment lines)

## Findings

**Discovered during code review by:**
- code-simplicity-reviewer agent
- Code readability analysis
- Pattern consistency review

**Example of Visual Noise:**

**Current (with AAA comments):**
```typescript
it('should load categories on mount', async () => {
  // Arrange
  vi.mocked(mockStorageManager.getCategories).mockResolvedValue(mockCategories);

  // Act
  const { result } = renderHook(() => useCategories());

  // Assert - Initially loading
  expect(result.current.loading).toBe(true);
  expect(result.current.categories).toEqual([]);
  expect(result.current.error).toBeNull();

  // Wait for categories to load
  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });

  // Assert - Categories loaded
  expect(result.current.categories).toEqual(mockCategories);
  expect(result.current.error).toBeNull();
  expect(mockStorageManager.getCategories).toHaveBeenCalledTimes(1);
});
```

**Simplified (obvious structure):**
```typescript
it('should load categories on mount', async () => {
  vi.mocked(mockStorageManager.getCategories).mockResolvedValue(mockCategories);

  const { result } = renderHook(() => useCategories());

  expect(result.current.loading).toBe(true);
  expect(result.current.categories).toEqual([]);

  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(result.current.categories).toEqual(mockCategories);
  expect(mockStorageManager.getCategories).toHaveBeenCalledTimes(1);
});
```

**Why the comments are unnecessary:**
1. **Obvious separation** - Blank lines already separate sections
2. **Self-documenting** - Variable names and assertions make intent clear
3. **Standard pattern** - All tests follow same structure
4. **Visual clutter** - Comments draw attention away from actual code
5. **Inconsistent** - 52 of 58 test files don't use them

## Impact Analysis

**Readability:**
- Comments create visual breaks that interrupt flow
- Eye has to skip over comment lines
- Actual code is harder to scan

**Consistency:**
- Only 10% of test files use AAA comments
- Creates inconsistent codebase style
- Developers confused about when to use them

**Maintenance:**
- Comments need updating if test structure changes
- Additional lines to scroll through
- Harder to see actual test logic at a glance

**LOC Reduction:**
- Remove 225 lines of comments
- Files become 15-20% shorter
- Same information content

## Comparison to Other Test Files

**Files WITHOUT AAA comments (52 files):**
```typescript
// src/components/__tests__/AddPromptForm.test.tsx
it('should validate empty title', async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(<AddPromptForm onSubmit={onSubmit} onCancel={vi.fn()} categories={[]} />);

  await user.click(screen.getByRole('button', { name: /save/i }));

  expect(screen.getByText(/title.*required/i)).toBeInTheDocument();
  expect(onSubmit).not.toHaveBeenCalled();
});
```

**Clean, readable, no comments needed.**

**Files WITH AAA comments (6 files):**
```typescript
// src/hooks/__tests__/useCategories.test.ts
it('should validate empty title', async () => {
  // Arrange
  const onSubmit = vi.fn();

  // Act
  render(<AddPromptForm onSubmit={onSubmit} categories={[]} />);
  await user.click(screen.getByRole('button', { name: /save/i }));

  // Assert
  expect(screen.getByText(/title.*required/i)).toBeInTheDocument();
  expect(onSubmit).not.toHaveBeenCalled();
});
```

**Same test, more lines, not more clarity.**

## Proposed Solution

### Option 1: Remove All AAA Comments (Recommended)

**Approach:** Delete all AAA comments, rely on code structure

**Find and replace pattern:**
```bash
# Remove standalone AAA comments
sed -i '' '/^[[:space:]]*\/\/ Arrange$/d' src/hooks/__tests__/*.test.ts
sed -i '' '/^[[:space:]]*\/\/ Act$/d' src/hooks/__tests__/*.test.ts
sed -i '' '/^[[:space:]]*\/\/ Assert$/d' src/hooks/__tests__/*.test.ts

# Remove AAA comments with descriptions
sed -i '' '/^[[:space:]]*\/\/ Arrange -/d' src/hooks/__tests__/*.test.ts
sed -i '' '/^[[:space:]]*\/\/ Act -/d' src/hooks/__tests__/*.test.ts
sed -i '' '/^[[:space:]]*\/\/ Assert -/d' src/hooks/__tests__/*.test.ts
```

**Manual cleanup:**
- Review each file after automated deletion
- Remove extra blank lines if needed
- Ensure test structure still clear

**Pros:**
- Immediate readability improvement
- Consistent with 90% of codebase
- 225 lines removed
- Cleaner, more professional code

**Cons:**
- None (comments add no value)

**Effort:** Small (1 hour)
**Risk:** None

---

### Option 2: Keep Comments But Make Consistent

**Approach:** Add AAA comments to ALL 58 test files

**Impact:**
- Would add ~2,000 lines of comments
- All test files bloated
- Massive waste of screen space

**Verdict:** ❌ NOT RECOMMENDED

---

### Option 3: Keep Comments in Complex Tests Only

**Approach:** Remove from simple tests, keep for complex multi-step tests

**Criteria for keeping:**
- Tests with 5+ distinct steps
- Tests with complex async flows
- Tests with multiple phases

**Pros:**
- Balances clarity and conciseness
- Comments only where needed

**Cons:**
- Subjective (what's "complex"?)
- Inconsistent application
- Still adds visual noise

**Effort:** Medium (2 hours)
**Risk:** Low

## Recommended Action

**Option 1** - Remove all AAA comments

**Rationale:**
- 90% of test files don't use them and are perfectly readable
- Comments state the obvious
- Code structure already clear
- Industry best practice: code should be self-documenting

**Kent C. Dodds (React Testing Library creator):**
> "If you need comments to explain what your test is doing, your test is probably too complex or poorly named. Good tests are self-documenting."

## Technical Details

**Files to Modify:**
- `src/hooks/__tests__/useCategories.test.ts` (remove 62 comment lines)
- `src/hooks/__tests__/usePrompts.test.ts` (remove 79 comment lines)
- `src/hooks/__tests__/useTheme.test.ts` (remove 84 comment lines)

**Automated Removal Script:**

```bash
#!/bin/bash
# remove-aaa-comments.sh

files=(
  "src/hooks/__tests__/useCategories.test.ts"
  "src/hooks/__tests__/usePrompts.test.ts"
  "src/hooks/__tests__/useTheme.test.ts"
)

for file in "${files[@]}"; do
  echo "Processing $file..."

  # Remove AAA comments (standalone)
  sed -i '' '/^[[:space:]]*\/\/ Arrange$/d' "$file"
  sed -i '' '/^[[:space:]]*\/\/ Act$/d' "$file"
  sed -i '' '/^[[:space:]]*\/\/ Assert$/d' "$file"

  # Remove AAA comments with descriptions
  sed -i '' '/^[[:space:]]*\/\/ Arrange -/d' "$file"
  sed -i '' '/^[[:space:]]*\/\/ Act -/d' "$file"
  sed -i '' '/^[[:space:]]*\/\/ Assert -/d' "$file"

  # Remove common variations
  sed -i '' '/^[[:space:]]*\/\/ Wait for/d' "$file"

  echo "✓ Removed AAA comments from $file"
done

echo "✓ Complete! Removed ~225 lines of comments"
```

**Before/After Examples:**

**useCategories.test.ts:**
- Before: 662 lines
- After: ~600 lines (9% reduction)

**usePrompts.test.ts:**
- Before: 779 lines
- After: ~700 lines (10% reduction)

**useTheme.test.ts:**
- Before: 777 lines
- After: ~693 lines (11% reduction)

**Total:**
- Before: 2,218 lines
- After: 1,993 lines
- **Reduction: 225 lines (10%)**

## Acceptance Criteria

- [ ] All AAA comments removed from hook test files
- [ ] No comments stating "Arrange", "Act", or "Assert"
- [ ] Test structure remains clear and readable
- [ ] All 1,244 tests continue to pass
- [ ] No blank line issues (max 1 blank line between sections)
- [ ] Consistent with 90% of existing test files
- [ ] Code review confirms improved readability

## Work Log

### 2025-11-06 - Code Review Discovery
**By:** Claude Code Review System
**Actions:**
- Discovered during code simplicity review
- Analyzed by code-simplicity-reviewer agent
- Found 225 lines of AAA comments
- Only 6/58 files use them (10% adoption)

**Inconsistency Analysis:**
```
Files with AAA comments:    6 (10%)
Files without AAA comments: 52 (90%)

Hook tests with AAA:        3 (useCategories, usePrompts, useTheme)
Hook tests without AAA:     5 (useToast, useSearchWithDebounce, etc.)

Component tests with AAA:   0 (0%)
Service tests with AAA:     3 (recent additions)
```

**Learnings:**
- AAA comments are a code smell
- Self-documenting code is better than commented code
- Test structure is clear from blank lines
- Comments add maintenance burden
- Industry best practice: remove obvious comments

## Notes

**Priority Justification:**
- P3 (Nice-to-Have) because doesn't affect functionality
- Improves readability and consistency
- Low effort, high benefit
- Can be done anytime post-merge

**Related Issues:**
- Finding #5: Code duplication (both about code simplicity)
- Finding #9: Over-documentation in InMemoryStorage
- Code style consistency across test suite

**Community Best Practices:**

**React Testing Library docs:**
> "Write tests that focus on behavior, not implementation. If your test needs comments to explain what it's doing, consider refactoring the test to be more obvious."

**Jest documentation:**
> "Good test names eliminate the need for most comments. The test name should describe what behavior is being tested."

**Success Metrics:**
- 225 fewer lines to maintain
- Consistent with 90% of codebase
- Improved readability (subjective)
- No functionality changes
- Developer satisfaction (cleaner code)

**Future Guidelines:**
Add to TESTING_BEST_PRACTICES.md:

```markdown
### Comments in Tests

**DON'T:** Add AAA (Arrange-Act-Assert) comments
```typescript
// ❌ Bad
it('should work', () => {
  // Arrange
  const x = 1;

  // Act
  const result = add(x, 2);

  // Assert
  expect(result).toBe(3);
});
```

**DO:** Write self-documenting tests
```typescript
// ✅ Good
it('should work', () => {
  const x = 1;
  const result = add(x, 2);
  expect(result).toBe(3);
});
```

Use blank lines to separate sections. Comments should explain WHY, not WHAT.
```
