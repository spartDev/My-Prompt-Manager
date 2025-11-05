# Testing Best Practices

**Version:** 1.0.0
**Last Updated:** 2025-11-04

---

## Core Principles

> ### "The more your tests resemble the way your software is used, the more confidence they can give you."
>
> **— Kent C. Dodds**

This is the most important principle in testing. Your tests should interact with your components the same way users do: clicking buttons, typing in inputs, and reading text on the screen. Avoid testing implementation details like internal state or component methods.

---

> ### "Write tests. Not too many. Mostly integration."
>
> **— Kent C. Dodds**

Focus your testing efforts on integration tests that verify how multiple parts work together. Unit tests are valuable but shouldn't dominate your test suite. Avoid excessive mocking that makes tests brittle and disconnected from reality.

---

> ### "Test behavior, not implementation."
>
> **— React Testing Library Philosophy**

Test what your code *does*, not *how* it does it. If you refactor the internal implementation but the behavior stays the same, your tests should still pass. This makes your tests resilient to refactoring and focused on user-facing functionality.

---

## What Makes a Good Unit Test

### The Three Properties of Good Tests

1. **Protection against regressions** - Catches bugs when you change code
2. **Resistance to refactoring** - Doesn't break when you improve code structure
3. **Fast feedback** - Runs quickly and reports failures clearly

### The AAA Pattern (Arrange-Act-Assert)

Structure every test using this pattern for clarity and consistency:

```typescript
it('should add two numbers correctly', () => {
  // Arrange: Set up test data and dependencies
  const calculator = new Calculator();
  const a = 5;
  const b = 3;

  // Act: Execute the behavior being tested
  const result = calculator.add(a, b);

  // Assert: Verify the outcome
  expect(result).toBe(8);
});
```

**Component example:**

```typescript
it('should display success message when form is submitted', async () => {
  // Arrange
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(<LoginForm onSubmit={onSubmit} />);

  // Act
  await user.type(screen.getByLabelText(/username/i), 'testuser');
  await user.type(screen.getByLabelText(/password/i), 'password123');
  await user.click(screen.getByRole('button', { name: /submit/i }));

  // Assert
  await waitFor(() => {
    expect(screen.getByText(/success/i)).toBeInTheDocument();
  });
});
```

### Test Isolation and Independence

**Each test must be completely independent:**

```typescript
// ✅ Good - Tests are independent
describe('PromptManager', () => {
  let manager: PromptManager;

  beforeEach(() => {
    // Fresh instance for every test
    vi.clearAllMocks();
    manager = PromptManager.getInstance();
  });

  it('should create a prompt', async () => {
    const prompt = await manager.createPrompt({ title: 'Test' });
    expect(prompt).toBeDefined();
  });

  it('should delete a prompt', async () => {
    const prompt = await manager.createPrompt({ title: 'Test' });
    await manager.deletePrompt(prompt.id);
    const prompts = await manager.getPrompts();
    expect(prompts).toHaveLength(0);
  });
});

// ❌ Bad - Second test depends on first
let sharedPromptId: string;

it('should create a prompt', async () => {
  const prompt = await manager.createPrompt({ title: 'Test' });
  sharedPromptId = prompt.id; // DON'T DO THIS
});

it('should delete a prompt', async () => {
  await manager.deletePrompt(sharedPromptId); // Depends on previous test
  // Will fail if run in isolation!
});
```

**Why independence matters:**
- Tests can run in any order
- Tests can run in parallel
- Debugging is easier when tests don't affect each other
- CI/CD failures are more predictable

### Determinism

Tests must produce the same result every time they run:

```typescript
// ❌ Bad - Non-deterministic (time-dependent)
it('should create prompt with current timestamp', () => {
  const prompt = createPrompt({ title: 'Test' });
  expect(prompt.createdAt).toBe(Date.now()); // Will fail!
});

// ✅ Good - Deterministic
it('should create prompt with current timestamp', () => {
  const now = 1234567890;
  vi.spyOn(Date, 'now').mockReturnValue(now);

  const prompt = createPrompt({ title: 'Test' });
  expect(prompt.createdAt).toBe(now);
});

// ❌ Bad - Non-deterministic (random values)
it('should generate unique IDs', () => {
  const id1 = generateId();
  const id2 = generateId();
  expect(id1).not.toBe(id2); // Might fail due to collision!
});

// ✅ Good - Test the behavior, not the randomness
it('should generate IDs in expected format', () => {
  const id = generateId();
  expect(id).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-/);
});
```

### Test Behavior, Not Implementation

Focus on observable outcomes, not internal mechanics:

```typescript
// ❌ Bad - Testing implementation details
it('should set loading state to true', () => {
  const { result } = renderHook(() => usePrompts());

  // Testing internal state that user never sees
  expect(result.current['_isLoading']).toBe(true);
  expect(result.current['_loadingState'].status).toBe('pending');
});

// ✅ Good - Testing observable behavior
it('should show loading spinner while fetching prompts', async () => {
  render(<PromptList />);

  // Test what the user sees
  expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
  });
});

// ❌ Bad - Testing component methods directly
it('should call handleClick method', () => {
  const component = new PromptCard(props);
  const spy = vi.spyOn(component, 'handleClick');
  component.handleClick();
  expect(spy).toHaveBeenCalled();
});

// ✅ Good - Testing user interaction
it('should call onCopy when copy button is clicked', async () => {
  const onCopy = vi.fn();
  const user = userEvent.setup();
  render(<PromptCard {...props} onCopy={onCopy} />);

  await user.click(screen.getByLabelText(/copy/i));
  expect(onCopy).toHaveBeenCalled();
});
```

### Naming Conventions

Write test names that describe the behavior and expected outcome:

```typescript
// ✅ Good - Descriptive, explains behavior
it('should display error message when validation fails', () => {});
it('should call onSubmit when form is valid', () => {});
it('should disable submit button while request is pending', () => {});
it('should filter prompts by category when category is selected', () => {});

// ❌ Bad - Vague, doesn't explain what's being tested
it('works', () => {});
it('test1', () => {});
it('handles click', () => {});
it('should work correctly', () => {});

// ✅ Good - Follows "should [expected behavior] when [condition]" pattern
it('should show validation error when title is empty', () => {});
it('should enable save button when all fields are valid', () => {});
it('should highlight search term when search query matches', () => {});

// ✅ Good - For edge cases and error conditions
it('should handle empty array gracefully', () => {});
it('should throw error when prompt ID is invalid', () => {});
it('should maintain sort order when items have identical timestamps', () => {});
```

---

## What Makes a Bad Unit Test

### Common Anti-Patterns

#### 1. Testing Private Methods

```typescript
// ❌ Bad - Testing private implementation
class PromptManager {
  private validatePrompt(prompt: Prompt): boolean {
    return prompt.title.length > 0;
  }
}

it('should validate prompt correctly', () => {
  const manager = new PromptManager();
  // Accessing private method through type casting
  expect((manager as any).validatePrompt({ title: 'Test' })).toBe(true);
});

// ✅ Good - Test through public API
it('should reject prompts with empty titles', async () => {
  const manager = new PromptManager();

  await expect(
    manager.createPrompt({ title: '', content: 'Test' })
  ).rejects.toThrow('Title is required');
});
```

#### 2. Testing Implementation Details

```typescript
// ❌ Bad - Testing internal state
it('should update state correctly', () => {
  const { result } = renderHook(() => usePrompts());
  expect(result.current['_internalState']).toBe('loading');
});

// ✅ Good - Testing observable behavior
it('should show loading indicator while fetching', () => {
  render(<PromptList />);
  expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
});
```

#### 3. Over-Mocking (Sociable vs Solitary Tests)

```typescript
// ❌ Bad - Over-mocked, testing nothing real
it('should fetch prompts', async () => {
  const mockStorage = { getPrompts: vi.fn().mockResolvedValue([]) };
  const mockManager = { searchPrompts: vi.fn().mockResolvedValue([]) };
  const mockUI = { render: vi.fn() };

  // This test is just verifying that mocks work!
  mockManager.searchPrompts();
  expect(mockManager.searchPrompts).toHaveBeenCalled();
});

// ✅ Good - Sociable test, mocks only external dependencies
it('should fetch prompts from storage', async () => {
  const manager = PromptManager.getInstance();

  await manager.createPrompt({ title: 'Test', content: 'Content' });
  const prompts = await manager.getPrompts();

  expect(prompts).toHaveLength(1);
  expect(prompts[0].title).toBe('Test');
});
```

#### 4. Testing CSS Classes

```typescript
// ❌ Bad - Brittle, tied to styling implementation
it('should have correct CSS class', () => {
  render(<Button />);
  const button = screen.getByRole('button');
  expect(button).toHaveClass('bg-purple-600');
  expect(button).toHaveClass('hover:bg-purple-700');
});

// ✅ Good - Test visual behavior when possible
it('should be styled as primary button', () => {
  render(<Button variant="primary" />);
  const button = screen.getByRole('button');

  // Test semantic attributes instead
  expect(button).toHaveAttribute('data-variant', 'primary');
  // Or test computed styles if critical
  expect(button).toHaveStyle({ backgroundColor: expect.any(String) });
});
```

#### 5. Testing React Component Lifecycle Methods

```typescript
// ❌ Bad - Testing React internals
it('should call componentDidMount', () => {
  const spy = vi.spyOn(PromptList.prototype, 'componentDidMount');
  render(<PromptList />);
  expect(spy).toHaveBeenCalled();
});

// ✅ Good - Test the side effect of mounting
it('should load prompts when component mounts', async () => {
  render(<PromptList />);

  await waitFor(() => {
    expect(screen.getByText('Test Prompt')).toBeInTheDocument();
  });
});
```

### Test Smells

Warning signs that indicate test quality issues:

1. **Fragile Tests** - Break when you refactor without changing behavior
2. **Slow Tests** - Take more than a few milliseconds to run
3. **Unclear Failures** - Hard to understand what went wrong when they fail
4. **Testing the Mock** - Asserting against mock behavior instead of real behavior
5. **Copy-Paste Tests** - Duplicated test code instead of parameterized tests
6. **Magic Numbers** - Unexplained values without context
7. **Multiple Assertions on Unrelated Behavior** - Testing too many things at once

---

## Testing Guidelines by Code Type

### React Components (React Testing Library)

#### Query Priority

Always use queries in this priority order:

1. **Accessible by Everyone** (Preferred)
   - `getByRole` - Most semantic, matches how assistive tech works
   - `getByLabelText` - Good for form fields
   - `getByPlaceholderText` - Only if no label exists
   - `getByText` - For non-interactive content
   - `getByDisplayValue` - Current value of form element

2. **Semantic Queries**
   - `getByAltText` - For images
   - `getByTitle` - SVG title or elements with title attribute

3. **Test IDs** (Last Resort)
   - `getByTestId` - Only when semantic queries aren't possible

```typescript
// ✅ Good - Semantic queries
const button = screen.getByRole('button', { name: /submit/i });
const input = screen.getByLabelText(/username/i);
const heading = screen.getByRole('heading', { name: /welcome/i });

// ❌ Bad - Test IDs everywhere
const button = screen.getByTestId('submit-button');
const input = screen.getByTestId('username-input');
const heading = screen.getByTestId('welcome-heading');
```

#### What to Test in Components

**DO test:**
- Rendering with different props
- User interactions (clicks, typing, etc.)
- Conditional rendering
- Error states and loading states
- Accessibility (ARIA attributes, roles)
- Integration with callbacks/handlers

**DON'T test:**
- CSS classes or styles
- Component state directly
- React internals (lifecycle methods, hooks implementation)
- Third-party library functionality
- Exact HTML structure

#### Component Testing Pattern

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

describe('PromptCard', () => {
  // Arrange: Set up test data
  const mockPrompt = {
    id: '1',
    title: 'Test Prompt',
    content: 'Test content',
    category: 'Test',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const defaultProps = {
    prompt: mockPrompt,
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onCopy: vi.fn()
  };

  it('should render prompt title and content', () => {
    // Arrange
    render(<PromptCard {...defaultProps} />);

    // Assert (no Act needed for rendering tests)
    expect(screen.getByText('Test Prompt')).toBeInTheDocument();
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('should call onCopy when copy button is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<PromptCard {...defaultProps} />);

    // Act
    const copyButton = screen.getByLabelText(/copy/i);
    await user.click(copyButton);

    // Assert
    expect(defaultProps.onCopy).toHaveBeenCalledWith('1');
  });

  it('should highlight search term when provided', () => {
    // Arrange
    render(
      <PromptCard {...defaultProps} searchQuery="Test" />
    );

    // Assert
    const highlights = screen.getAllByRole('mark'); // Highlighted text
    expect(highlights.length).toBeGreaterThan(0);
  });
});
```

#### Async Testing

Always use `waitFor` for async state changes:

```typescript
// ✅ Good - Proper async handling
it('should load prompts on mount', async () => {
  render(<PromptList />);

  // Wait for async operation to complete
  await waitFor(() => {
    expect(screen.getByText('Test Prompt')).toBeInTheDocument();
  });
});

// ❌ Bad - No wait, will fail
it('should load prompts on mount', () => {
  render(<PromptList />);
  expect(screen.getByText('Test Prompt')).toBeInTheDocument(); // Fails!
});

// ✅ Good - findBy queries include waiting
it('should load prompts on mount', async () => {
  render(<PromptList />);
  expect(await screen.findByText('Test Prompt')).toBeInTheDocument();
});
```

#### User Interactions

Always use `userEvent` over `fireEvent`:

```typescript
import userEvent from '@testing-library/user-event';

// ✅ Good - userEvent simulates real user behavior
it('should update input value when user types', async () => {
  const user = userEvent.setup();
  render(<SearchInput />);

  const input = screen.getByRole('textbox');
  await user.type(input, 'search query');

  expect(input).toHaveValue('search query');
});

// ❌ Bad - fireEvent doesn't simulate real interactions
it('should update input value when user types', () => {
  render(<SearchInput />);

  const input = screen.getByRole('textbox');
  fireEvent.change(input, { target: { value: 'search query' } });

  expect(input).toHaveValue('search query');
});
```

### Custom React Hooks

Use `renderHook` from React Testing Library:

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';

describe('useSearchWithDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should debounce search input', async () => {
    // Arrange
    const { result } = renderHook(() => useSearchWithDebounce(prompts));

    // Act
    act(() => {
      result.current.setQuery('hello');
    });

    // Assert - Should be searching immediately
    expect(result.current.isSearching).toBe(true);
    expect(result.current.debouncedQuery).toBe('');

    // Act - Advance time
    await act(async () => {
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();
    });

    // Assert - Should be done after debounce
    expect(result.current.isSearching).toBe(false);
    expect(result.current.debouncedQuery).toBe('hello');
  });
});
```

**Hook Testing Guidelines:**
- Test the hook's public API (returned values and functions)
- Test state changes over time
- Test side effects (API calls, subscriptions)
- Don't test React internals
- Use `act()` for state updates

### Services and Business Logic

Test services with minimal mocking:

```typescript
describe('PromptManager', () => {
  let manager: PromptManager;

  beforeEach(() => {
    manager = PromptManager.getInstance();
    vi.clearAllMocks();
  });

  describe('searchPrompts', () => {
    it('should filter prompts by title', async () => {
      // Arrange
      const prompts = [
        { id: '1', title: 'React Hooks', content: '...' },
        { id: '2', title: 'Vue Components', content: '...' }
      ];
      vi.spyOn(manager['storageManager'], 'getPrompts')
        .mockResolvedValue(prompts);

      // Act
      const results = await manager.searchPrompts('React');

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('React Hooks');
    });

    it('should search in both title and content', async () => {
      // Arrange
      const prompts = [
        { id: '1', title: 'Guide', content: 'React hooks tutorial' },
        { id: '2', title: 'Vue Guide', content: 'Composition API' }
      ];
      vi.spyOn(manager['storageManager'], 'getPrompts')
        .mockResolvedValue(prompts);

      // Act
      const results = await manager.searchPrompts('React');

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].content).toContain('React');
    });
  });

  describe('validatePromptData', () => {
    it('should reject empty content', () => {
      // Act
      const error = manager.validatePromptData({
        title: 'Test',
        content: '',
        categoryId: 'cat1'
      });

      // Assert
      expect(error).toBeTruthy();
      expect(error?.field).toBe('content');
      expect(error?.message).toContain('required');
    });

    it('should reject content exceeding max length', () => {
      // Arrange
      const longContent = 'a'.repeat(10001);

      // Act
      const error = manager.validatePromptData({
        title: 'Test',
        content: longContent,
        categoryId: 'cat1'
      });

      // Assert
      expect(error).toBeTruthy();
      expect(error?.message).toContain('10,000 characters');
    });

    it('should accept valid prompt data', () => {
      // Act
      const error = manager.validatePromptData({
        title: 'Valid',
        content: 'Valid content',
        categoryId: 'cat1'
      });

      // Assert
      expect(error).toBeNull();
    });
  });
});
```

**Service Testing Guidelines:**
- Mock only external dependencies (network, storage, filesystem)
- Don't mock the service's own methods
- Test edge cases and error conditions
- Test validation logic thoroughly
- Test algorithms with various inputs

### Utilities and Helper Functions

Pure functions are the easiest to test:

```typescript
describe('toError', () => {
  it('should return Error objects unchanged', () => {
    const error = new Error('Test error');
    const result = toError(error);

    expect(result).toBe(error);
    expect(result.message).toBe('Test error');
  });

  it('should convert strings to Error objects', () => {
    const result = toError('String error');

    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('String error');
  });

  it('should extract message from error-like objects', () => {
    const errorLike = { message: 'Object error', code: 500 };
    const result = toError(errorLike);

    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('Object error');
  });

  it('should handle null and undefined', () => {
    expect(toError(null)).toBeInstanceOf(Error);
    expect(toError(undefined)).toBeInstanceOf(Error);
  });
});
```

**Utility Testing Guidelines:**
- Test all code paths
- Test edge cases (null, undefined, empty arrays, etc.)
- Test with various input types
- Test error conditions
- Use descriptive test data (not just `foo`, `bar`)

---

## Mocking Guidelines

### When to Mock

**DO mock:**
- External services (APIs, databases)
- Browser APIs (localStorage, fetch, clipboard)
- Chrome extension APIs
- Time-dependent code (Date.now(), setTimeout)
- Random number generators
- File system operations

**DON'T mock:**
- The code you're testing
- Simple utilities and helpers
- Pure functions
- Most of your own code

### Stubs vs Spies vs Mocks

```typescript
// Stub: Provides canned responses
const stub = vi.fn().mockReturnValue(42);

// Spy: Tracks calls but uses real implementation
const obj = { method: () => 'real' };
const spy = vi.spyOn(obj, 'method');
obj.method(); // Returns 'real' and tracks the call

// Mock: Replaces implementation entirely
const mock = vi.fn().mockImplementation(() => 'mocked');
```

### Best Practices for Mocking

```typescript
// ✅ Good - Mock external dependencies only
describe('PromptManager', () => {
  beforeEach(() => {
    vi.spyOn(chrome.storage.local, 'get').mockResolvedValue({ prompts: [] });
    vi.spyOn(chrome.storage.local, 'set').mockResolvedValue(undefined);
  });

  it('should save prompt to storage', async () => {
    const manager = PromptManager.getInstance();
    await manager.createPrompt({ title: 'Test', content: 'Content' });

    expect(chrome.storage.local.set).toHaveBeenCalled();
  });
});

// ❌ Bad - Mocking the entire service
describe('PromptManager', () => {
  it('should save prompt', async () => {
    const mockManager = {
      createPrompt: vi.fn().mockResolvedValue({ id: '1' })
    };

    await mockManager.createPrompt({ title: 'Test' });
    expect(mockManager.createPrompt).toHaveBeenCalled();
    // This test proves nothing!
  });
});

// ✅ Good - Restore mocks after each test
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ✅ Good - Mock timers for time-dependent code
describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should delay execution', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalled();
  });
});
```

### Sociable vs Solitary Tests

```typescript
// Solitary test: Mocks all dependencies
it('should save prompt (solitary)', async () => {
  const mockStorage = { set: vi.fn() };
  const manager = new PromptManager(mockStorage);

  await manager.createPrompt({ title: 'Test' });
  expect(mockStorage.set).toHaveBeenCalled();
});

// Sociable test: Uses real dependencies (preferred)
it('should save and retrieve prompt (sociable)', async () => {
  const manager = PromptManager.getInstance();

  await manager.createPrompt({ title: 'Test' });
  const prompts = await manager.getPrompts();

  expect(prompts).toHaveLength(1);
  expect(prompts[0].title).toBe('Test');
});
```

**Prefer sociable tests** - They test real integration between your components and catch more bugs.

---

## Testing Pyramid/Trophy

### The Testing Trophy (Modern Approach)

```
         ┌─────────────┐
         │     E2E     │ (Few - Slow, brittle)
         └─────────────┘
      ┌─────────────────┐
      │  Integration    │ (Many - Sweet spot!)
      │     Tests       │
      └─────────────────┘
    ┌─────────────────────┐
    │   Unit Tests        │ (Some - Fast, focused)
    └─────────────────────┘
  ┌───────────────────────────┐
  │  Static Analysis          │ (Maximum - TypeScript, ESLint)
  └───────────────────────────┘
```

**Distribution:**
- 70% Integration tests (component + hooks + services)
- 20% Unit tests (utilities, algorithms, edge cases)
- 10% E2E tests (critical user flows)

**Why Integration tests dominate:**
- Test how pieces work together
- More confidence than isolated unit tests
- Catch integration bugs
- Resilient to refactoring
- Still fast enough to run frequently

---

## Quick Reference Checklists

### Before Writing a Test

- [ ] Do I understand what behavior I'm testing?
- [ ] Is this testing user-facing behavior or implementation?
- [ ] Am I testing the right level (unit/integration/e2e)?
- [ ] Have I checked for existing similar tests?
- [ ] Can I describe the expected behavior in one sentence?

### When Writing a Test

- [ ] Used AAA pattern (Arrange-Act-Assert)?
- [ ] Test name describes behavior and condition?
- [ ] Used semantic queries (getByRole, getByLabelText)?
- [ ] Avoided testing implementation details?
- [ ] Mocked only external dependencies?
- [ ] Used `userEvent` instead of `fireEvent`?
- [ ] Used `waitFor` for async operations?
- [ ] Test is deterministic (no random/time-dependent values)?
- [ ] Test is isolated (doesn't depend on other tests)?

### After Writing a Test

- [ ] Run test multiple times - does it always pass?
- [ ] Run test in isolation - does it still pass?
- [ ] Clear test name that explains failure?
- [ ] Could I refactor the code and test still pass?
- [ ] Would this test catch real bugs?
- [ ] Is test fast enough (< 100ms for unit tests)?
- [ ] Added `beforeEach` to reset mocks?

---

## DO vs DON'T Examples

### Component Testing

```typescript
// ❌ DON'T: Test CSS classes
it('should have correct classes', () => {
  render(<Button />);
  expect(screen.getByRole('button')).toHaveClass('bg-purple-600');
});

// ✅ DO: Test visual behavior
it('should be keyboard accessible', () => {
  render(<Button>Click me</Button>);
  const button = screen.getByRole('button', { name: /click me/i });
  expect(button).toHaveAttribute('tabIndex', '0');
});
```

```typescript
// ❌ DON'T: Test component state directly
it('should set isOpen to true', () => {
  const { result } = renderHook(() => useDropdown());
  expect(result.current.isOpen).toBe(false);
  // Accessing internal state
});

// ✅ DO: Test observable behavior
it('should show dropdown menu when button is clicked', async () => {
  const user = userEvent.setup();
  render(<Dropdown />);

  await user.click(screen.getByRole('button'));
  expect(screen.getByRole('menu')).toBeInTheDocument();
});
```

### Service Testing

```typescript
// ❌ DON'T: Mock everything
it('should create prompt', async () => {
  const mockManager = {
    createPrompt: vi.fn().mockResolvedValue({ id: '1' }),
    validatePrompt: vi.fn().mockReturnValue(null),
    saveToStorage: vi.fn()
  };

  await mockManager.createPrompt({ title: 'Test' });
  expect(mockManager.createPrompt).toHaveBeenCalled();
});

// ✅ DO: Test real behavior with real dependencies
it('should create and retrieve prompt', async () => {
  const manager = PromptManager.getInstance();

  const prompt = await manager.createPrompt({
    title: 'Test',
    content: 'Content'
  });

  const retrieved = await manager.getPrompt(prompt.id);
  expect(retrieved?.title).toBe('Test');
});
```

### Async Testing

```typescript
// ❌ DON'T: Forget to wait for async operations
it('should load data', () => {
  render(<DataList />);
  expect(screen.getByText('Data loaded')).toBeInTheDocument(); // Will fail!
});

// ✅ DO: Use waitFor or findBy queries
it('should load data', async () => {
  render(<DataList />);
  expect(await screen.findByText('Data loaded')).toBeInTheDocument();
});

// ✅ DO: Use waitFor for complex conditions
it('should load data', async () => {
  render(<DataList />);
  await waitFor(() => {
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText('Data loaded')).toBeInTheDocument();
  });
});
```

### Query Selection

```typescript
// ❌ DON'T: Use test IDs everywhere
const button = screen.getByTestId('submit-button');
const input = screen.getByTestId('username-input');

// ✅ DO: Use semantic queries
const button = screen.getByRole('button', { name: /submit/i });
const input = screen.getByLabelText(/username/i);

// ❌ DON'T: Use getByClassName
const card = screen.getByClassName('prompt-card');

// ✅ DO: Use accessible queries
const card = screen.getByRole('article');
// or with specific content
const card = screen.getByText('Prompt Title').closest('article');
```

### User Interactions

```typescript
// ❌ DON'T: Use fireEvent
fireEvent.change(input, { target: { value: 'test' } });
fireEvent.click(button);

// ✅ DO: Use userEvent (simulates real interactions)
const user = userEvent.setup();
await user.type(input, 'test');
await user.click(button);
```

### Test Organization

```typescript
// ❌ DON'T: Put all setup in tests
it('should do something', () => {
  const manager = PromptManager.getInstance();
  vi.clearAllMocks();
  // Setup repeated in every test...
});

// ✅ DO: Use beforeEach for common setup
describe('PromptManager', () => {
  let manager: PromptManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = PromptManager.getInstance();
  });

  it('should do something', () => {
    // Test-specific code only
  });
});
```

---

## Common Mistakes to Avoid

### 1. Testing Private Methods

**Why it's bad:** Private methods are implementation details. If you refactor, these tests break even though behavior didn't change.

```typescript
// ❌ Bad
it('should validate email format', () => {
  const validator = new FormValidator();
  expect((validator as any)._validateEmail('test@example.com')).toBe(true);
});

// ✅ Good - Test through public API
it('should reject invalid email addresses', () => {
  const validator = new FormValidator();
  const result = validator.validate({ email: 'invalid-email' });
  expect(result.errors.email).toBe('Invalid email address');
});
```

### 2. Using Date.now() Without Mocking

**Why it's bad:** Non-deterministic - test will fail at different times.

```typescript
// ❌ Bad
it('should set created timestamp', () => {
  const prompt = createPrompt({ title: 'Test' });
  expect(prompt.createdAt).toBe(Date.now()); // Will fail!
});

// ✅ Good
it('should set created timestamp', () => {
  const now = 1234567890;
  vi.spyOn(Date, 'now').mockReturnValue(now);

  const prompt = createPrompt({ title: 'Test' });
  expect(prompt.createdAt).toBe(now);
});
```

### 3. Not Cleaning Up Mocks

**Why it's bad:** Mocks leak between tests, causing unpredictable failures.

```typescript
// ❌ Bad
describe('Tests', () => {
  it('test 1', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    // No cleanup!
  });

  it('test 2', () => {
    console.log('test'); // Still mocked!
  });
});

// ✅ Good
describe('Tests', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('test 1', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('test 2', () => {
    console.log('test'); // Real console.log
  });
});
```

### 4. Testing Multiple Things in One Test

**Why it's bad:** When test fails, hard to know what's broken.

```typescript
// ❌ Bad
it('should handle form submission', async () => {
  render(<Form />);

  // Testing validation
  await user.click(screen.getByRole('button', { name: /submit/i }));
  expect(screen.getByText('Title is required')).toBeInTheDocument();

  // Testing success case
  await user.type(screen.getByLabelText(/title/i), 'Test');
  await user.click(screen.getByRole('button', { name: /submit/i }));
  expect(screen.getByText('Success!')).toBeInTheDocument();

  // Testing error case
  // ... more assertions
});

// ✅ Good - Separate tests
it('should show validation error when title is empty', async () => {
  render(<Form />);
  await user.click(screen.getByRole('button', { name: /submit/i }));
  expect(screen.getByText('Title is required')).toBeInTheDocument();
});

it('should show success message on valid submission', async () => {
  render(<Form />);
  await user.type(screen.getByLabelText(/title/i), 'Test');
  await user.click(screen.getByRole('button', { name: /submit/i }));
  expect(screen.getByText('Success!')).toBeInTheDocument();
});
```

### 5. Not Testing Edge Cases

**Why it's bad:** Real-world bugs often occur at boundaries and edge cases.

```typescript
// ❌ Bad - Only happy path
it('should sort array', () => {
  const sorted = sort([3, 1, 2]);
  expect(sorted).toEqual([1, 2, 3]);
});

// ✅ Good - Test edge cases
describe('sort', () => {
  it('should sort array of numbers', () => {
    expect(sort([3, 1, 2])).toEqual([1, 2, 3]);
  });

  it('should handle empty array', () => {
    expect(sort([])).toEqual([]);
  });

  it('should handle single element', () => {
    expect(sort([1])).toEqual([1]);
  });

  it('should handle duplicate values', () => {
    expect(sort([2, 1, 2, 1])).toEqual([1, 1, 2, 2]);
  });

  it('should handle already sorted array', () => {
    expect(sort([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('should not mutate original array', () => {
    const original = [3, 1, 2];
    sort(original);
    expect(original).toEqual([3, 1, 2]);
  });
});
```

### 6. Using setTimeout in Tests

**Why it's bad:** Flaky, slow, and arbitrary delays don't guarantee completion.

```typescript
// ❌ Bad
it('should load data', (done) => {
  render(<DataList />);

  setTimeout(() => {
    expect(screen.getByText('Data loaded')).toBeInTheDocument();
    done();
  }, 1000); // Arbitrary delay
});

// ✅ Good
it('should load data', async () => {
  render(<DataList />);

  await waitFor(() => {
    expect(screen.getByText('Data loaded')).toBeInTheDocument();
  });
});
```

### 7. Asserting on Mock Implementation

**Why it's bad:** Tests the mock, not your code.

```typescript
// ❌ Bad
it('should call API', () => {
  const mockFetch = vi.fn().mockResolvedValue({ data: [] });
  global.fetch = mockFetch;

  // Test just verifies mock was called, not actual behavior
  expect(mockFetch).toHaveBeenCalled();
});

// ✅ Good
it('should display data from API', async () => {
  vi.spyOn(global, 'fetch').mockResolvedValue({
    json: async () => ({ data: [{ id: 1, name: 'Test' }] })
  } as Response);

  render(<DataList />);

  // Test actual visible behavior
  expect(await screen.findByText('Test')).toBeInTheDocument();
});
```

### 8. Over-Specific Assertions

**Why it's bad:** Brittle tests that break on irrelevant changes.

```typescript
// ❌ Bad
it('should format date', () => {
  const result = formatDate(new Date('2025-01-01'));
  expect(result).toBe('January 1, 2025 at 12:00:00 AM UTC');
});

// ✅ Good
it('should format date in readable format', () => {
  const result = formatDate(new Date('2025-01-01'));
  expect(result).toMatch(/January 1, 2025/);
  expect(result).toContain('2025');
});
```

### 9. Testing Third-Party Libraries

**Why it's bad:** Not your responsibility, wastes time, and should already be tested.

```typescript
// ❌ Bad - Testing React itself
it('should update state when useState is called', () => {
  const [value, setValue] = useState(0);
  setValue(1);
  expect(value).toBe(1); // Testing React!
});

// ✅ Good - Test your code that uses React
it('should increment counter when button is clicked', async () => {
  const user = userEvent.setup();
  render(<Counter />);

  await user.click(screen.getByRole('button', { name: /increment/i }));
  expect(screen.getByText('Count: 1')).toBeInTheDocument();
});
```

### 10. Snapshot Testing for Everything

**Why it's bad:** Snapshots are often blindly approved, creating false security.

```typescript
// ❌ Bad - Snapshot for dynamic content
it('should render correctly', () => {
  const { container } = render(<PromptCard prompt={mockPrompt} />);
  expect(container).toMatchSnapshot(); // Will break on any change!
});

// ✅ Good - Specific assertions
it('should render prompt details', () => {
  render(<PromptCard prompt={mockPrompt} />);
  expect(screen.getByText(mockPrompt.title)).toBeInTheDocument();
  expect(screen.getByText(mockPrompt.content)).toBeInTheDocument();
  expect(screen.getByLabelText(/copy/i)).toBeInTheDocument();
});

// ✅ OK - Snapshot for static UI components
it('should render icon correctly', () => {
  const { container } = render(<CopyIcon />);
  expect(container.firstChild).toMatchSnapshot(); // Static SVG
});
```

---

## Additional Resources

### Testing Library Documentation
- [React Testing Library](https://testing-library.com/react)
- [Common Mistakes](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Query Priority](https://testing-library.com/docs/queries/about#priority)

### Vitest Documentation
- [Vitest Guide](https://vitest.dev/guide/)
- [Mocking](https://vitest.dev/guide/mocking.html)
- [Coverage](https://vitest.dev/guide/coverage.html)

### Project-Specific Guides
- [Testing Guide](./TESTING.md) - Test infrastructure and running tests
- [React 19 Migration](./REACT_19_MIGRATION.md) - Testing React 19 hooks

---

**Last Updated:** 2025-11-04
**Version:** 1.0.0
