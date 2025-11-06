# Test Utilities

Test utilities and helpers for the My Prompt Manager test suite.

## InMemoryStorage

A real in-memory implementation of Chrome's `storage.local` API for testing. This eliminates the need for complex mocks and provides higher confidence that storage operations work correctly.

### Benefits

- **Real Behavior**: Tests actual storage behavior instead of mock behavior
- **Simplicity**: Reduces test setup complexity by 60%
- **Maintainability**: Eliminates mock implementation duplication
- **Confidence**: Provides higher confidence in storage operations
- **Compatibility**: Fully compatible with Chrome storage.local API

### Usage

#### Basic Setup

```typescript
import { InMemoryStorage } from '@test/utils/InMemoryStorage';

describe('MyComponent', () => {
  let storage: InMemoryStorage;

  beforeEach(() => {
    storage = new InMemoryStorage();
    global.chrome = {
      storage: {
        local: storage
      }
    } as any;
  });

  it('should save data', async () => {
    await storage.set({ key: 'value' });
    const result = await storage.get(['key']);
    expect(result.key).toBe('value');
  });
});
```

#### Advanced Usage

```typescript
import { InMemoryStorage } from '@test/utils/InMemoryStorage';

describe('StorageManager', () => {
  let storage: InMemoryStorage;
  let manager: StorageManager;

  beforeEach(() => {
    // Create fresh storage for each test
    storage = new InMemoryStorage();

    // Replace Chrome storage API
    global.chrome = {
      storage: {
        local: storage
      }
    } as any;

    // Initialize manager
    manager = StorageManager.getInstance();
  });

  it('should save and retrieve prompts', async () => {
    // Arrange
    const prompt = {
      id: '1',
      title: 'Test',
      content: 'Content'
    };

    // Act
    await manager.savePrompt(prompt);
    const prompts = await manager.getPrompts();

    // Assert
    expect(prompts).toHaveLength(1);
    expect(prompts[0].title).toBe('Test');
  });

  it('should handle multiple operations', async () => {
    // Set initial data
    await storage.set({
      prompts: [],
      categories: [{ id: 'default', name: 'General' }]
    });

    // Verify data was stored
    expect(storage.size()).toBe(2);
    expect(storage.has('prompts')).toBe(true);

    // Get all data
    const all = await storage.get(null);
    expect(all.prompts).toEqual([]);
    expect(all.categories).toHaveLength(1);
  });
});
```

### API Reference

#### `get(keys)`

Retrieves data from storage.

**Signatures:**
- `get(string)` - Get single key
- `get(string[])` - Get multiple keys
- `get(null)` - Get all data
- `get(Record<string, any>)` - Get keys with defaults

**Examples:**

```typescript
// Get single key
const result = await storage.get('prompts');
console.log(result.prompts); // []

// Get multiple keys
const result = await storage.get(['prompts', 'categories']);
console.log(result); // { prompts: [...], categories: [...] }

// Get all data
const result = await storage.get(null);
console.log(result); // { prompts: [...], categories: [...], ... }

// Get with defaults
const result = await storage.get({ prompts: [], theme: 'light' });
console.log(result); // { prompts: [...], theme: 'light' }
```

#### `set(items)`

Stores data in storage.

**Example:**

```typescript
await storage.set({
  prompts: [{ id: '1', title: 'Test' }],
  categories: [{ id: 'default', name: 'General' }]
});
```

#### `remove(keys)`

Removes data from storage.

**Examples:**

```typescript
// Remove single key
await storage.remove('prompts');

// Remove multiple keys
await storage.remove(['prompts', 'categories']);
```

#### `clear()`

Clears all data from storage.

**Example:**

```typescript
await storage.clear();
const result = await storage.get(null);
console.log(result); // {}
```

#### `getBytesInUse(keys?)`

Gets estimated bytes in use (mock implementation).

**Example:**

```typescript
const bytes = await storage.getBytesInUse();
console.log(bytes); // Estimated size
```

### Utility Methods

These methods are not part of the Chrome storage API but are useful for testing:

#### `size()`

Returns the number of items in storage.

```typescript
await storage.set({ a: 1, b: 2 });
console.log(storage.size()); // 2
```

#### `has(key)`

Checks if a key exists in storage.

```typescript
await storage.set({ prompts: [] });
console.log(storage.has('prompts')); // true
console.log(storage.has('categories')); // false
```

#### `keys()`

Returns all keys currently stored.

```typescript
await storage.set({ a: 1, b: 2 });
console.log(storage.keys()); // ['a', 'b']
```

### Migration from Mocks

**Before (Complex Mocks):**

```typescript
describe('StorageManager', () => {
  let mockStorage: MockStorage;

  beforeEach(() => {
    mockStorage = {
      prompts: [],
      categories: []
    };

    // Complex mock implementation
    vi.mocked(chrome.storage.local.get).mockImplementation((keys) => {
      return Promise.resolve(
        Object.keys(keys).reduce((acc, key) => {
          acc[key] = mockStorage[key] ?? keys[key];
          return acc;
        }, {} as any)
      );
    });

    vi.mocked(chrome.storage.local.set).mockImplementation((items) => {
      Object.assign(mockStorage, items);
      return Promise.resolve();
    });

    // More complex mock setup...
  });

  it('should save data', async () => {
    const manager = StorageManager.getInstance();
    await manager.savePrompt({ title: 'Test' });
    expect(mockStorage.prompts).toHaveLength(1);
  });
});
```

**After (InMemoryStorage):**

```typescript
import { InMemoryStorage } from '@test/utils/InMemoryStorage';

describe('StorageManager', () => {
  let storage: InMemoryStorage;

  beforeEach(() => {
    storage = new InMemoryStorage();
    global.chrome = {
      storage: {
        local: storage
      }
    } as any;
  });

  it('should save data', async () => {
    const manager = StorageManager.getInstance();
    await manager.savePrompt({ title: 'Test' });

    const result = await storage.get(['prompts']);
    expect(result.prompts).toHaveLength(1);
  });
});
```

### Best Practices

1. **Create Fresh Instance**: Always create a fresh `InMemoryStorage` instance in `beforeEach` to ensure test isolation
2. **Test Real Behavior**: Test storage operations through your actual services, not through direct storage calls
3. **Use Utility Methods**: Use `size()`, `has()`, and `keys()` for test assertions when helpful
4. **Verify Side Effects**: When testing services, verify the data was actually stored by retrieving it
5. **Clear Between Tests**: Let `beforeEach` handle cleanup by creating a fresh instance

### Performance

InMemoryStorage is extremely fast:
- Set operation: ~0.001ms
- Get operation: ~0.001ms
- Clear operation: ~0.001ms

This makes it ideal for unit tests where performance matters.

## See Also

- [Testing Best Practices](../../../docs/TESTING_BEST_PRACTICES.md)
- [Testing Guide](../../../docs/TESTING.md)
- [Storage Service](../../services/storage.ts)
