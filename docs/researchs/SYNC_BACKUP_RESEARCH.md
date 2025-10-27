# Modern Data Synchronization and Backup Patterns for Browser Extensions

**Research Date:** January 2025
**Purpose:** Comprehensive analysis of modern sync strategies, backup automation, UX patterns, and data integrity for browser extensions and web applications.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Sync Strategies](#sync-strategies)
3. [Backup Automation](#backup-automation)
4. [User Experience Patterns](#user-experience-patterns)
5. [Data Integrity](#data-integrity)
6. [Implementation Recommendations](#implementation-recommendations)
7. [Real-World Examples](#real-world-examples)
8. [Technology Stack Recommendations](#technology-stack-recommendations)

---

## Executive Summary

Modern browser extensions require robust synchronization and backup mechanisms to provide seamless cross-device experiences. This research synthesizes best practices from official Chrome documentation, successful open-source projects, academic research, and industry implementations.

**Key Findings:**

- **storage.sync is designed for small settings (100KB limit)** - not suitable for large datasets
- **Offline-first architecture with optimistic UI** provides the best user experience
- **Conflict resolution requires choosing between simplicity (LWW) and data preservation (vector clocks/CRDTs)**
- **Cloud backup integration** (Google Drive, Dropbox) requires careful API design and ToS compliance
- **Data integrity checks** should be proactive, not reactive

---

## 1. Sync Strategies

### 1.1 Chrome storage.sync API Best Practices

**Official Limitations (Chrome Documentation):**
- Maximum storage: ~100KB total
- Maximum item size: 8KB per item
- Sync operations: ~1,800 operations per hour
- Items: Maximum 512 items

**Recommended Use Cases:**
```typescript
// ✅ GOOD: User preferences and settings
interface SyncableSettings {
  theme: 'light' | 'dark';
  language: string;
  notificationsEnabled: boolean;
  autoSaveInterval: number;
}

// ❌ BAD: Large data collections
interface PromptsLibrary {
  prompts: Prompt[]; // Could exceed 100KB easily
  categories: Category[];
  // This should use storage.local instead
}
```

**Security Consideration:**
> **Chrome Documentation Warning:** Local and sync storage areas are not encrypted. Never store sensitive user data (passwords, tokens, API keys) in storage.sync or storage.local. Use `storage.session` for sensitive data.

**Source:** Chrome for Developers - chrome.storage API Reference (2025)

---

### 1.2 Conflict Resolution Patterns

When multiple devices modify data while offline, conflicts are inevitable. Here are the main resolution strategies:

#### A. Last Write Wins (LWW)

**How it Works:**
- Each update includes a timestamp
- During conflict, the modification with the latest timestamp wins
- Simple to implement, but may lose data silently

**Implementation Example:**
```typescript
interface TimestampedData<T> {
  value: T;
  timestamp: number;
  deviceId: string;
}

function resolveConflict<T>(local: TimestampedData<T>, remote: TimestampedData<T>): T {
  return local.timestamp > remote.timestamp ? local.value : remote.value;
}
```

**Pros:**
- Simple for developers and administrators
- No clock synchronization required
- Deterministic resolution

**Cons:**
- Silent data loss when conflicts occur
- Depends on accurate device clocks
- No way to merge conflicting changes

**Best For:** Simple settings, toggles, user preferences where latest value is always correct

**Sources:**
- Medium: "Data Synchronization in Chrome Extensions" (2024)
- Stack Overflow: "Conflict resolution for two-way sync" discussions

---

#### B. Vector Clocks

**How it Works:**
- Each replica maintains a counter for all other replicas
- Counters increment on local updates
- Can detect concurrent updates without timestamps
- Requires conflict resolution logic when conflicts detected

**Implementation Example:**
```typescript
interface VectorClock {
  [deviceId: string]: number;
}

interface VersionedData<T> {
  value: T;
  clock: VectorClock;
}

function compareClocks(a: VectorClock, b: VectorClock): 'before' | 'after' | 'concurrent' {
  let aGreater = false;
  let bGreater = false;

  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);

  for (const key of allKeys) {
    const aVal = a[key] || 0;
    const bVal = b[key] || 0;

    if (aVal > bVal) aGreater = true;
    if (bVal > aVal) bGreater = true;
  }

  if (aGreater && !bGreater) return 'after';
  if (bGreater && !aGreater) return 'before';
  return 'concurrent';
}
```

**Pros:**
- Detects all conflicts accurately
- No clock synchronization needed
- Preserves all conflicting versions

**Cons:**
- More complex implementation
- Requires conflict resolution UI
- Vector clocks grow with number of devices

**Best For:** Collaborative editing, important data where no loss is acceptable, applications where manual conflict resolution is feasible

**Sources:**
- Stack Overflow: "How to determine Last write win on concurrent Vector clocks?"
- Medium: "All Things Clock, Time and Order in Distributed Systems"
- Riak and Cassandra documentation

---

#### C. CRDTs (Conflict-Free Replicated Data Types)

**How it Works:**
- Special data structures with built-in merge algorithms
- Mathematically proven to converge without conflicts
- Automatic conflict resolution without user intervention

**Types of CRDTs:**

1. **Last-Write-Wins Register (LWW-Register)**
   - Simple CRDT using timestamps
   - Similar to LWW but with CRDT guarantees

2. **Multi-Value Register (MV-Register)**
   - Keeps all concurrent values
   - Application decides how to merge

3. **Grow-Only Set (G-Set)**
   - Elements can only be added
   - Perfect for append-only logs

4. **Sequence CRDTs (LSEQ, RGA)**
   - For collaborative text editing
   - Used in real-time editors

**Implementation Example (Simple G-Set):**
```typescript
class GrowOnlySet<T> {
  private items: Set<T>;

  constructor(items: T[] = []) {
    this.items = new Set(items);
  }

  add(item: T): void {
    this.items.add(item);
  }

  // Merge is simple: union of sets
  merge(other: GrowOnlySet<T>): GrowOnlySet<T> {
    const merged = new Set([...this.items, ...other.items]);
    return new GrowOnlySet(Array.from(merged));
  }

  has(item: T): boolean {
    return this.items.has(item);
  }
}
```

**Real-World Implementations:**
- **Teletype for Atom**: Collaborative code editing using CRDTs
- **Phoenix Framework**: Real-time multi-node information sharing
- **SoundCloud**: Audio distribution platform
- **RxDB**: JavaScript database with CRDT plugin

**JavaScript Libraries:**
- **Yjs**: Most popular CRDT library for JavaScript
- **Automerge**: CRDT library with JSON-like API
- **RxDB**: Database with CRDT plugin

**Pros:**
- Automatic conflict resolution
- No user intervention needed
- Mathematically proven convergence
- Works well for collaborative apps

**Cons:**
- Complex to implement correctly
- Limited data structure types
- Can have performance overhead
- Metadata overhead grows over time

**Best For:** Real-time collaboration, chat applications, collaborative editors, distributed systems

**Sources:**
- crdt.tech - Official CRDT resource
- Redis Blog: "Diving into CRDTs"
- RxDB Documentation
- Wikipedia: Conflict-free replicated data type

---

### 1.3 Offline-First Architecture

**Core Principles:**

1. **Local-First Storage**: Application stores and reads from local database (IndexedDB)
2. **Immediate Response**: UI updates optimistically without waiting for server
3. **Background Sync**: Changes sync to server when network available
4. **Resilience**: Application fully functional without network

**Architecture Pattern:**

```
┌─────────────┐
│   UI Layer  │ ← Immediate updates (optimistic)
└──────┬──────┘
       │
┌──────▼──────┐
│ Local Store │ ← IndexedDB / storage.local
│  (Source of │   (Primary source of truth)
│    Truth)   │
└──────┬──────┘
       │
┌──────▼──────┐
│ Sync Queue  │ ← Pending operations
└──────┬──────┘
       │
┌──────▼──────┐
│   Network   │ ← Background sync when online
│   Layer     │
└──────┬──────┘
       │
┌──────▼──────┐
│   Server    │ ← Remote backup/sync
└─────────────┘
```

**Implementation Strategy:**

```typescript
// 1. Define sync status
type SyncStatus = 'synced' | 'pending' | 'syncing' | 'error';

interface SyncState {
  lastSyncTime: number | null;
  status: SyncStatus;
  pendingOperations: number;
  error?: string;
}

// 2. Implement optimistic updates
class OfflineFirstStore<T> {
  private db: IDBDatabase;
  private syncQueue: Operation[] = [];

  async save(item: T): Promise<void> {
    // 1. Update local store immediately (optimistic)
    await this.saveToIndexedDB(item);

    // 2. Update UI immediately
    this.notifyListeners(item);

    // 3. Queue for background sync
    this.syncQueue.push({ type: 'save', data: item });

    // 4. Attempt sync if online
    if (navigator.onLine) {
      this.processQueue();
    }
  }

  async processQueue(): Promise<void> {
    while (this.syncQueue.length > 0 && navigator.onLine) {
      const operation = this.syncQueue[0];

      try {
        await this.syncToServer(operation);
        this.syncQueue.shift(); // Remove on success
      } catch (err) {
        // Keep in queue, retry later
        console.error('Sync failed, will retry', err);
        break;
      }
    }
  }
}

// 3. Listen for online/offline events
window.addEventListener('online', () => {
  store.processQueue();
});

window.addEventListener('offline', () => {
  // Inform user that app is in offline mode
  showOfflineIndicator();
});
```

**Delta Sync Pattern:**

Instead of syncing entire datasets, only sync changes:

```typescript
interface ChangeRecord {
  id: string;
  operation: 'create' | 'update' | 'delete';
  data?: any;
  timestamp: number;
  synced: boolean;
}

class DeltaSyncManager {
  private changes: ChangeRecord[] = [];

  async trackChange(operation: 'create' | 'update' | 'delete', data: any): Promise<void> {
    this.changes.push({
      id: generateId(),
      operation,
      data,
      timestamp: Date.now(),
      synced: false
    });
  }

  async sync(): Promise<void> {
    const unsyncedChanges = this.changes.filter(c => !c.synced);

    if (unsyncedChanges.length === 0) return;

    try {
      await this.sendToServer({ changes: unsyncedChanges });

      // Mark as synced
      unsyncedChanges.forEach(change => {
        change.synced = true;
      });

      // Clean up old synced changes
      this.pruneOldChanges();
    } catch (err) {
      console.error('Delta sync failed', err);
    }
  }

  private pruneOldChanges(): void {
    // Keep synced changes for 7 days for conflict resolution
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
    this.changes = this.changes.filter(c =>
      !c.synced || c.timestamp > cutoff
    );
  }
}
```

**Sources:**
- Aalpha: "Offline App Architecture: Building Offline-First Apps 2025"
- GitHub: pazguille/offline-first repository
- Hasura: "Design Guide for Building Offline First Apps"
- RxDB: "Local First / Offline First" documentation

---

### 1.4 Sync Timing Strategies

#### A. Manual Sync

**When to Use:**
- Large datasets where automatic sync would be expensive
- When user wants control over when data transfers
- Limited network scenarios

**Implementation:**
```typescript
class ManualSyncManager {
  async triggerSync(): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      // 1. Show sync in progress
      this.updateSyncStatus('syncing');

      // 2. Perform sync
      const result = await this.performFullSync();

      // 3. Update last sync time
      await storage.local.set({
        lastSyncTime: Date.now(),
        lastSyncResult: 'success'
      });

      this.updateSyncStatus('synced');

      return {
        success: true,
        itemsSynced: result.count,
        duration: Date.now() - startTime
      };
    } catch (err) {
      this.updateSyncStatus('error', err.message);
      throw err;
    }
  }
}
```

#### B. Automatic Periodic Sync

**When to Use:**
- Small, frequently changing data
- Background settings sync
- When user expects automatic updates

**Implementation:**
```typescript
class PeriodicSyncManager {
  private syncInterval: number = 5 * 60 * 1000; // 5 minutes
  private intervalId?: number;

  start(): void {
    // Initial sync
    this.sync();

    // Schedule periodic sync
    this.intervalId = window.setInterval(() => {
      if (navigator.onLine) {
        this.sync();
      }
    }, this.syncInterval);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  private async sync(): Promise<void> {
    try {
      const changes = await this.getLocalChanges();
      if (changes.length === 0) return;

      await this.pushChanges(changes);
      await this.pullChanges();
    } catch (err) {
      console.error('Periodic sync failed', err);
      // Don't throw - will retry on next interval
    }
  }
}
```

#### C. Real-Time Sync

**When to Use:**
- Collaborative applications
- Chat/messaging features
- When immediate sync is critical

**Implementation with WebSocket:**
```typescript
class RealtimeSyncManager {
  private ws?: WebSocket;

  connect(): void {
    this.ws = new WebSocket('wss://api.example.com/sync');

    this.ws.onmessage = (event) => {
      const update = JSON.parse(event.data);
      this.handleRemoteUpdate(update);
    };

    this.ws.onclose = () => {
      // Reconnect with exponential backoff
      setTimeout(() => this.connect(), this.getBackoffDelay());
    };
  }

  async sendUpdate(data: any): Promise<void> {
    // 1. Apply locally first (optimistic)
    await this.applyLocally(data);

    // 2. Send to server
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'update',
        data
      }));
    } else {
      // Queue for later if disconnected
      await this.queueForLater(data);
    }
  }

  private async handleRemoteUpdate(update: any): Promise<void> {
    // Check for conflicts before applying
    const hasConflict = await this.detectConflict(update);

    if (hasConflict) {
      await this.resolveConflict(update);
    } else {
      await this.applyLocally(update);
    }
  }
}
```

**Sources:**
- Medium: "Efficient Data Synchronization Strategies"
- Aalpha: "Offline App Architecture"

---

## 2. Backup Automation

### 2.1 Scheduled Backup Patterns

**Best Practices:**

1. **Multiple backup frequencies** for different data importance levels
2. **Incremental backups** to save space and time
3. **Rotation policy** to manage backup retention
4. **Verification** after each backup

**Implementation Example:**

```typescript
interface BackupConfig {
  enabled: boolean;
  frequency: 'hourly' | 'daily' | 'weekly' | 'manual';
  maxBackups: number;
  includeDeleted: boolean;
  compression: boolean;
}

class AutoBackupManager {
  private config: BackupConfig;
  private alarmName = 'auto-backup';

  async initialize(config: BackupConfig): Promise<void> {
    this.config = config;

    if (config.enabled && config.frequency !== 'manual') {
      await this.scheduleBackup();
    }
  }

  private async scheduleBackup(): Promise<void> {
    const intervals = {
      hourly: 60,
      daily: 60 * 24,
      weekly: 60 * 24 * 7
    };

    const periodInMinutes = intervals[this.config.frequency];

    // Use Chrome alarms API for reliable scheduling
    await chrome.alarms.create(this.alarmName, {
      periodInMinutes,
      when: Date.now() + (periodInMinutes * 60 * 1000)
    });

    // Listen for alarm
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === this.alarmName) {
        this.performBackup();
      }
    });
  }

  async performBackup(): Promise<BackupResult> {
    try {
      // 1. Get current data
      const data = await this.getAllData();

      // 2. Create backup object
      const backup: Backup = {
        id: generateId(),
        timestamp: Date.now(),
        version: this.getAppVersion(),
        data: this.config.compression ? this.compress(data) : data,
        checksum: await this.calculateChecksum(data)
      };

      // 3. Save backup
      await this.saveBackup(backup);

      // 4. Rotate old backups
      await this.rotateBackups();

      // 5. Verify backup
      const verified = await this.verifyBackup(backup.id);

      return {
        success: verified,
        backupId: backup.id,
        timestamp: backup.timestamp,
        size: JSON.stringify(backup).length
      };
    } catch (err) {
      console.error('Backup failed', err);
      throw err;
    }
  }

  private async rotateBackups(): Promise<void> {
    const backups = await this.listBackups();

    // Sort by timestamp, newest first
    backups.sort((a, b) => b.timestamp - a.timestamp);

    // Keep only maxBackups newest backups
    const toDelete = backups.slice(this.config.maxBackups);

    for (const backup of toDelete) {
      await this.deleteBackup(backup.id);
    }
  }

  private async calculateChecksum(data: any): Promise<string> {
    const jsonStr = JSON.stringify(data);
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(jsonStr);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async verifyBackup(backupId: string): Promise<boolean> {
    const backup = await this.getBackup(backupId);
    const recalculatedChecksum = await this.calculateChecksum(backup.data);
    return recalculatedChecksum === backup.checksum;
  }
}
```

**Chrome Alarms API Notes:**
- More reliable than `setInterval` or `setTimeout`
- Persists across browser restarts
- Minimum interval: 1 minute for unpacked extensions, 5 minutes for packed
- Perfect for scheduled backups

**Sources:**
- Duplicator: "Best Automatic Backup Services"
- HostPapa: "Automated Website Backup"

---

### 2.2 Auto-Save and Draft Mechanisms

**Pattern:** Save work-in-progress automatically to prevent data loss

**Implementation:**

```typescript
class AutoSaveManager<T> {
  private draftKey = 'draft';
  private saveDelay = 2000; // 2 seconds
  private saveTimer?: number;
  private lastSaved?: string;

  // Debounced auto-save
  scheduleSave(data: T): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = window.setTimeout(() => {
      this.saveDraft(data);
    }, this.saveDelay);
  }

  private async saveDraft(data: T): Promise<void> {
    const draft = {
      data,
      timestamp: Date.now(),
      checksum: await this.calculateChecksum(data)
    };

    const draftJson = JSON.stringify(draft);

    // Only save if changed
    if (draftJson === this.lastSaved) {
      return;
    }

    await storage.local.set({
      [this.draftKey]: draft
    });

    this.lastSaved = draftJson;

    // Show visual indicator
    this.showSavedIndicator();
  }

  async loadDraft(): Promise<T | null> {
    const result = await storage.local.get(this.draftKey);
    const draft = result[this.draftKey];

    if (!draft) return null;

    // Verify integrity
    const checksum = await this.calculateChecksum(draft.data);
    if (checksum !== draft.checksum) {
      console.warn('Draft checksum mismatch, may be corrupted');
      return null;
    }

    return draft.data;
  }

  async clearDraft(): Promise<void> {
    await storage.local.remove(this.draftKey);
    this.lastSaved = undefined;
  }

  async hasDraft(): Promise<boolean> {
    const result = await storage.local.get(this.draftKey);
    return !!result[this.draftKey];
  }
}

// Usage in form component
class PromptEditor {
  private autoSave = new AutoSaveManager<PromptDraft>();

  async componentDidMount(): Promise<void> {
    // Check for existing draft
    const draft = await this.autoSave.loadDraft();

    if (draft) {
      const restore = confirm(
        `Found unsaved changes from ${new Date(draft.timestamp).toLocaleString()}. Restore?`
      );

      if (restore) {
        this.setState({ formData: draft.data });
      } else {
        await this.autoSave.clearDraft();
      }
    }
  }

  handleChange(field: string, value: any): void {
    const newData = { ...this.state.formData, [field]: value };
    this.setState({ formData: newData });

    // Auto-save after 2 second delay
    this.autoSave.scheduleSave(newData);
  }

  async handleSubmit(): Promise<void> {
    await this.savePrompt(this.state.formData);

    // Clear draft after successful save
    await this.autoSave.clearDraft();
  }
}
```

**Best Practices:**

1. **Debounce auto-save** (1-3 seconds) to avoid excessive writes
2. **Show save indicator** so users know their work is saved
3. **Verify integrity** when loading drafts
4. **Prompt user** before restoring old drafts
5. **Clear draft** after successful save
6. **Include timestamp** in draft for user context

---

### 2.3 Version History

**Pattern:** Keep snapshots of data at different points in time for rollback

**Implementation:**

```typescript
interface Version<T> {
  id: string;
  timestamp: number;
  data: T;
  checksum: string;
  description?: string;
  auto: boolean; // true if auto-generated, false if manual save
}

class VersionHistoryManager<T> {
  private maxVersions = 50;
  private maxAutoVersions = 10; // Keep fewer auto versions

  async createVersion(
    data: T,
    description?: string,
    auto = false
  ): Promise<string> {
    const version: Version<T> = {
      id: generateId(),
      timestamp: Date.now(),
      data: structuredClone(data), // Deep clone
      checksum: await this.calculateChecksum(data),
      description,
      auto
    };

    // Save version
    await this.saveVersion(version);

    // Prune old versions
    await this.pruneVersions();

    return version.id;
  }

  async listVersions(): Promise<Version<T>[]> {
    const result = await storage.local.get('versions');
    const versions = result.versions || [];

    // Sort by timestamp, newest first
    return versions.sort((a, b) => b.timestamp - a.timestamp);
  }

  async restoreVersion(versionId: string): Promise<T> {
    const versions = await this.listVersions();
    const version = versions.find(v => v.id === versionId);

    if (!version) {
      throw new Error('Version not found');
    }

    // Verify integrity before restoring
    const checksum = await this.calculateChecksum(version.data);
    if (checksum !== version.checksum) {
      throw new Error('Version data corrupted');
    }

    // Create a version of current state before restoring
    // (so user can undo the restore)
    const currentData = await this.getCurrentData();
    await this.createVersion(
      currentData,
      `Before restore to ${new Date(version.timestamp).toLocaleString()}`,
      true
    );

    return structuredClone(version.data);
  }

  async compareVersions(versionId1: string, versionId2: string): Promise<Diff> {
    const versions = await this.listVersions();
    const v1 = versions.find(v => v.id === versionId1);
    const v2 = versions.find(v => v.id === versionId2);

    if (!v1 || !v2) {
      throw new Error('Version not found');
    }

    // Use a diff library like 'diff' or 'deep-diff'
    return this.calculateDiff(v1.data, v2.data);
  }

  private async pruneVersions(): Promise<void> {
    const versions = await this.listVersions();

    // Separate auto and manual versions
    const autoVersions = versions.filter(v => v.auto);
    const manualVersions = versions.filter(v => !v.auto);

    // Keep more manual versions (user explicitly saved these)
    const toKeep = [
      ...manualVersions.slice(0, this.maxVersions - this.maxAutoVersions),
      ...autoVersions.slice(0, this.maxAutoVersions)
    ];

    await storage.local.set({ versions: toKeep });
  }

  async deleteVersion(versionId: string): Promise<void> {
    const versions = await this.listVersions();
    const filtered = versions.filter(v => v.id !== versionId);
    await storage.local.set({ versions: filtered });
  }
}
```

**UI Considerations:**

```typescript
// Version history UI component
const VersionHistoryPanel: React.FC = () => {
  const [versions, setVersions] = useState<Version[]>([]);

  useEffect(() => {
    loadVersions();
  }, []);

  const handleRestore = async (versionId: string) => {
    const confirmed = confirm(
      'This will replace your current data. Continue?'
    );

    if (!confirmed) return;

    try {
      const data = await versionManager.restoreVersion(versionId);
      await saveCurrentData(data);
      showSuccessMessage('Version restored successfully');
    } catch (err) {
      showErrorMessage('Failed to restore version: ' + err.message);
    }
  };

  return (
    <div className="version-history">
      <h3>Version History</h3>
      <ul>
        {versions.map(version => (
          <li key={version.id}>
            <div className="version-info">
              <span className="timestamp">
                {new Date(version.timestamp).toLocaleString()}
              </span>
              {version.description && (
                <span className="description">{version.description}</span>
              )}
              {version.auto && <span className="badge">Auto</span>}
            </div>
            <button onClick={() => handleRestore(version.id)}>
              Restore
            </button>
            <button onClick={() => handlePreview(version.id)}>
              Preview
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
```

**Sources:**
- Windows Support: "System Restore"
- Cloudways: "Point-in-time Restore"

---

### 2.4 Cloud Backup Integration

#### Google Drive API Integration

**Important Considerations:**

1. **Terms of Service**: Google Drive API restricts backup use cases without prior written consent
2. **Application Data Folder**: Use the special `appDataFolder` for app-specific data
3. **OAuth Setup**: Requires Chrome Web Store item ID for OAuth redirect

**Setup Steps:**

```typescript
// 1. manifest.json configuration
{
  "permissions": [
    "identity",
    "storage"
  ],
  "oauth2": {
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/drive.appdata"
    ]
  }
}

// 2. Authentication
class GoogleDriveAuth {
  async getAuthToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else if (token) {
          resolve(token);
        } else {
          reject(new Error('Failed to get auth token'));
        }
      });
    });
  }

  async removeAuthToken(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.identity.removeCachedAuthToken({ token }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }
}

// 3. Google Drive backup implementation
class GoogleDriveBackupManager {
  private auth = new GoogleDriveAuth();
  private backupFileName = 'prompts-backup.json';

  async backup(data: any): Promise<void> {
    const token = await this.auth.getAuthToken();

    // 1. Check if backup file exists
    const fileId = await this.findBackupFile(token);

    if (fileId) {
      // Update existing file
      await this.updateFile(token, fileId, data);
    } else {
      // Create new file
      await this.createFile(token, data);
    }
  }

  private async findBackupFile(token: string): Promise<string | null> {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?` +
      `spaces=appDataFolder&` +
      `q=name='${this.backupFileName}'`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    const result = await response.json();
    return result.files?.[0]?.id || null;
  }

  private async createFile(token: string, data: any): Promise<string> {
    const metadata = {
      name: this.backupFileName,
      parents: ['appDataFolder']
    };

    const form = new FormData();
    form.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' })
    );
    form.append(
      'file',
      new Blob([JSON.stringify(data)], { type: 'application/json' })
    );

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: form
      }
    );

    const result = await response.json();
    return result.id;
  }

  private async updateFile(
    token: string,
    fileId: string,
    data: any
  ): Promise<void> {
    await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      }
    );
  }

  async restore(): Promise<any> {
    const token = await this.auth.getAuthToken();
    const fileId = await this.findBackupFile(token);

    if (!fileId) {
      throw new Error('No backup file found');
    }

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    return await response.json();
  }
}
```

**Alternative: Dropbox Integration**

Dropbox has simpler ToS for backup use cases:

```typescript
class DropboxBackupManager {
  private accessToken: string;

  async backup(data: any): Promise<void> {
    const content = JSON.stringify(data);

    const response = await fetch(
      'https://content.dropboxapi.com/2/files/upload',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/octet-stream',
          'Dropbox-API-Arg': JSON.stringify({
            path: '/prompts-backup.json',
            mode: 'overwrite',
            autorename: false
          })
        },
        body: content
      }
    );

    if (!response.ok) {
      throw new Error('Backup failed');
    }
  }

  async restore(): Promise<any> {
    const response = await fetch(
      'https://content.dropboxapi.com/2/files/download',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Dropbox-API-Arg': JSON.stringify({
            path: '/prompts-backup.json'
          })
        }
      }
    );

    if (!response.ok) {
      throw new Error('Restore failed');
    }

    return await response.json();
  }
}
```

**Sources:**
- Stack Overflow: "Chrome extension using Google Drive API"
- Stack Overflow: "Can I use Google Drive for chrome extensions"
- Medium: "Implementing an integrated client with Google Drive"

---

## 3. User Experience Patterns

### 3.1 Sync Status Indicators

**Visual Status Communication:**

Users need to know the sync state at all times. Here are proven patterns:

**Status Types:**

```typescript
type SyncStatus =
  | 'synced'      // All data synchronized
  | 'syncing'     // Sync in progress
  | 'pending'     // Changes waiting to sync
  | 'offline'     // No network connection
  | 'error'       // Sync failed
  | 'paused';     // User paused sync

interface SyncIndicator {
  status: SyncStatus;
  lastSyncTime: number | null;
  pendingChanges: number;
  error?: string;
}
```

**UI Implementation:**

```tsx
const SyncStatusIndicator: React.FC<{ status: SyncIndicator }> = ({ status }) => {
  const icons = {
    synced: '✓',     // Green checkmark
    syncing: '⟳',    // Spinning circle
    pending: '⋯',    // Dots
    offline: '⚠',    // Warning
    error: '✕',      // Red X
    paused: '⏸'      // Pause symbol
  };

  const colors = {
    synced: 'text-green-600',
    syncing: 'text-blue-600',
    pending: 'text-yellow-600',
    offline: 'text-gray-600',
    error: 'text-red-600',
    paused: 'text-gray-600'
  };

  const messages = {
    synced: 'All changes saved',
    syncing: 'Syncing...',
    pending: `${status.pendingChanges} changes pending`,
    offline: 'Offline - changes will sync when online',
    error: status.error || 'Sync failed',
    paused: 'Sync paused'
  };

  return (
    <div className={`sync-indicator ${colors[status.status]}`}>
      <span className={status.status === 'syncing' ? 'animate-spin' : ''}>
        {icons[status.status]}
      </span>
      <span className="message">{messages[status.status]}</span>
      {status.lastSyncTime && (
        <span className="last-sync">
          Last synced: {formatRelativeTime(status.lastSyncTime)}
        </span>
      )}
    </div>
  );
};
```

**Placement Best Practices:**

1. **Persistent Indicator**: Always visible in UI (header/footer)
2. **Non-Intrusive**: Don't block user interaction
3. **Contextual**: Show near modified content
4. **Temporary Success**: Fade out "synced" message after 2-3 seconds
5. **Persistent Errors**: Keep error messages visible until resolved

**Real-World Examples:**

- **Dropbox**: Green checkmark on synced files
- **Google Docs**: "All changes saved to Drive" with timestamp
- **Notion**: "Syncing..." then "Saved" in top-right
- **Obsidian**: Sync icon in status bar with color coding

**Sources:**
- Stack Overflow: "Syncing: should we visualize the 'everything-is-up-to-date' state?"
- O'Reilly: "Designing for the Internet of Things - Cross-Device Interactions"

---

### 3.2 Conflict Resolution UI

**When Conflicts Occur:**

Manual user intervention is sometimes necessary when automatic resolution isn't appropriate.

**Conflict Types:**

```typescript
interface DataConflict<T> {
  field: string;
  localValue: T;
  localTimestamp: number;
  localDevice: string;
  remoteValue: T;
  remoteTimestamp: number;
  remoteDevice: string;
}

interface ConflictResolution<T> {
  conflicts: DataConflict<T>[];
  itemId: string;
  itemType: string;
}
```

**UI Pattern: Side-by-Side Comparison**

```tsx
const ConflictResolver: React.FC<{
  conflict: ConflictResolution<any>;
  onResolve: (resolution: any) => void;
}> = ({ conflict, onResolve }) => {
  const [selectedValues, setSelectedValues] = useState<Map<string, any>>(
    new Map()
  );

  const handleFieldSelect = (field: string, value: any) => {
    setSelectedValues(new Map(selectedValues.set(field, value)));
  };

  const handleResolve = () => {
    const resolution = Object.fromEntries(selectedValues);
    onResolve(resolution);
  };

  return (
    <div className="conflict-resolver">
      <div className="conflict-header">
        <h3>Resolve Conflicts</h3>
        <p>
          This {conflict.itemType} was modified on multiple devices.
          Choose which version to keep for each field.
        </p>
      </div>

      <div className="conflict-comparison">
        <div className="column local">
          <h4>
            This Device
            <span className="timestamp">
              {new Date(conflict.conflicts[0].localTimestamp).toLocaleString()}
            </span>
          </h4>
        </div>

        <div className="column remote">
          <h4>
            {conflict.conflicts[0].remoteDevice}
            <span className="timestamp">
              {new Date(conflict.conflicts[0].remoteTimestamp).toLocaleString()}
            </span>
          </h4>
        </div>
      </div>

      {conflict.conflicts.map((c) => (
        <div key={c.field} className="conflict-field">
          <label>{c.field}</label>

          <div className="value-options">
            <button
              className={selectedValues.get(c.field) === c.localValue ? 'selected' : ''}
              onClick={() => handleFieldSelect(c.field, c.localValue)}
            >
              <div className="value">{renderValue(c.localValue)}</div>
            </button>

            <button
              className={selectedValues.get(c.field) === c.remoteValue ? 'selected' : ''}
              onClick={() => handleFieldSelect(c.field, c.remoteValue)}
            >
              <div className="value">{renderValue(c.remoteValue)}</div>
            </button>
          </div>
        </div>
      ))}

      <div className="actions">
        <button onClick={() => onResolve('keep-local')}>
          Keep All Local Changes
        </button>
        <button onClick={() => onResolve('keep-remote')}>
          Keep All Remote Changes
        </button>
        <button
          onClick={handleResolve}
          disabled={selectedValues.size !== conflict.conflicts.length}
        >
          Use Selected Values
        </button>
      </div>
    </div>
  );
};
```

**Alternative Pattern: Automatic with Review**

```tsx
const AutoResolvedConflictNotification: React.FC<{
  conflict: ConflictResolution<any>;
  resolution: any;
  onUndo: () => void;
}> = ({ conflict, resolution, onUndo }) => {
  return (
    <div className="notification conflict-notification">
      <div className="icon">⚠️</div>
      <div className="content">
        <h4>Conflict Automatically Resolved</h4>
        <p>
          Changes from multiple devices were merged using "latest wins" strategy.
        </p>
        <button onClick={() => showDetails(conflict)}>
          View Details
        </button>
      </div>
      <button onClick={onUndo} className="undo">
        Undo
      </button>
    </div>
  );
};
```

**Best Practices:**

1. **Defer Resolution**: Don't block user during sync; queue conflicts for later review
2. **Provide Context**: Show timestamps, device names, and what changed
3. **Allow Bulk Actions**: "Keep all local" / "Keep all remote" options
4. **Visual Diff**: Highlight differences between versions
5. **Undo Support**: Always allow undoing conflict resolution

**Sources:**
- Medium: "Conflict resolution strategies in Data Synchronization"
- Stack Overflow: "algorithms - Conflict resolution for two-way sync"

---

### 3.3 Cross-Device Data Preview

**Pattern:** Show users what data exists on other devices before syncing

```tsx
interface DeviceData {
  deviceId: string;
  deviceName: string;
  platform: string;
  lastSync: number;
  itemCount: number;
  storageUsed: number;
  dataPreview: {
    recentItems: any[];
    categories: string[];
    totalSize: number;
  };
}

const CrossDevicePreview: React.FC = () => {
  const [devices, setDevices] = useState<DeviceData[]>([]);

  useEffect(() => {
    loadDeviceData();
  }, []);

  const handleSyncFrom = async (deviceId: string) => {
    const confirmed = confirm(
      'This will replace your local data with data from the selected device. Continue?'
    );

    if (!confirmed) return;

    await syncManager.pullFromDevice(deviceId);
  };

  return (
    <div className="cross-device-preview">
      <h3>Your Devices</h3>

      <div className="device-list">
        {devices.map(device => (
          <div key={device.deviceId} className="device-card">
            <div className="device-header">
              <span className="device-icon">
                {getDeviceIcon(device.platform)}
              </span>
              <div className="device-info">
                <h4>{device.deviceName}</h4>
                <span className="platform">{device.platform}</span>
              </div>
            </div>

            <div className="device-stats">
              <div className="stat">
                <label>Items</label>
                <span>{device.itemCount}</span>
              </div>
              <div className="stat">
                <label>Storage</label>
                <span>{formatBytes(device.storageUsed)}</span>
              </div>
              <div className="stat">
                <label>Last Synced</label>
                <span>{formatRelativeTime(device.lastSync)}</span>
              </div>
            </div>

            <div className="recent-items">
              <h5>Recent Items</h5>
              <ul>
                {device.dataPreview.recentItems.map(item => (
                  <li key={item.id}>{item.title}</li>
                ))}
              </ul>
            </div>

            <button onClick={() => handleSyncFrom(device.deviceId)}>
              Sync from This Device
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
```

**Best Practices:**

1. **Show Preview First**: Let users see what they're syncing
2. **Display Differences**: Highlight items that differ between devices
3. **Selective Sync**: Allow choosing specific items or categories
4. **Clear Warnings**: Warn about data replacement
5. **Device Metadata**: Show device name, platform, last sync time

---

### 3.4 Selective Sync Controls

**Pattern:** Allow users to choose what data syncs

```tsx
interface SyncPreferences {
  syncEnabled: boolean;
  syncCategories: {
    [categoryId: string]: boolean;
  };
  syncSettings: boolean;
  syncCustomSites: boolean;
  maxStorageUsage: number; // MB
}

const SelectiveSyncSettings: React.FC = () => {
  const [prefs, setPrefs] = useState<SyncPreferences>(defaultPrefs);
  const [categories, setCategories] = useState<Category[]>([]);

  const handleToggleCategory = (categoryId: string) => {
    setPrefs({
      ...prefs,
      syncCategories: {
        ...prefs.syncCategories,
        [categoryId]: !prefs.syncCategories[categoryId]
      }
    });
  };

  const handleSave = async () => {
    await storage.sync.set({ syncPreferences: prefs });
    await syncManager.updatePreferences(prefs);
  };

  return (
    <div className="selective-sync-settings">
      <h3>Sync Preferences</h3>

      <div className="setting">
        <label>
          <input
            type="checkbox"
            checked={prefs.syncEnabled}
            onChange={(e) => setPrefs({
              ...prefs,
              syncEnabled: e.target.checked
            })}
          />
          Enable cross-device sync
        </label>
      </div>

      {prefs.syncEnabled && (
        <>
          <div className="section">
            <h4>What to Sync</h4>

            <label>
              <input
                type="checkbox"
                checked={prefs.syncSettings}
                onChange={(e) => setPrefs({
                  ...prefs,
                  syncSettings: e.target.checked
                })}
              />
              Settings and preferences
            </label>

            <label>
              <input
                type="checkbox"
                checked={prefs.syncCustomSites}
                onChange={(e) => setPrefs({
                  ...prefs,
                  syncCustomSites: e.target.checked
                })}
              />
              Custom site configurations
            </label>
          </div>

          <div className="section">
            <h4>Categories to Sync</h4>
            {categories.map(category => (
              <label key={category.id}>
                <input
                  type="checkbox"
                  checked={prefs.syncCategories[category.id] ?? true}
                  onChange={() => handleToggleCategory(category.id)}
                />
                {category.name}
                <span className="item-count">
                  ({category.promptCount} items)
                </span>
              </label>
            ))}
          </div>

          <div className="section">
            <h4>Storage Limit</h4>
            <input
              type="range"
              min="1"
              max="100"
              value={prefs.maxStorageUsage}
              onChange={(e) => setPrefs({
                ...prefs,
                maxStorageUsage: parseInt(e.target.value)
              })}
            />
            <span>{prefs.maxStorageUsage} MB</span>
          </div>
        </>
      )}

      <button onClick={handleSave}>Save Preferences</button>
    </div>
  );
};
```

**Sources:**
- O'Reilly: "Designing for the Internet of Things"
- UXPin: "Cross-Platform Experience Guide"

---

## 4. Data Integrity

### 4.1 Checksum Validation

**Purpose:** Detect data corruption during storage or transmission

**Implementation:**

```typescript
class DataIntegrityManager {
  // SHA-256 checksum calculation
  async calculateChecksum(data: any): Promise<string> {
    const jsonStr = JSON.stringify(data);
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(jsonStr);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Verify data integrity
  async verifyIntegrity<T>(
    data: T,
    expectedChecksum: string
  ): Promise<boolean> {
    const actualChecksum = await this.calculateChecksum(data);
    return actualChecksum === expectedChecksum;
  }

  // Store data with checksum
  async storeWithChecksum(key: string, data: any): Promise<void> {
    const checksum = await this.calculateChecksum(data);

    await storage.local.set({
      [key]: data,
      [`${key}_checksum`]: checksum,
      [`${key}_timestamp`]: Date.now()
    });
  }

  // Retrieve and verify data
  async retrieveWithVerification<T>(key: string): Promise<T | null> {
    const result = await storage.local.get([
      key,
      `${key}_checksum`,
      `${key}_timestamp`
    ]);

    const data = result[key];
    const storedChecksum = result[`${key}_checksum`];

    if (!data || !storedChecksum) {
      return null;
    }

    // Verify integrity
    const isValid = await this.verifyIntegrity(data, storedChecksum);

    if (!isValid) {
      console.error(`Data corruption detected for key: ${key}`);

      // Attempt recovery from backup
      return await this.recoverFromBackup(key);
    }

    return data;
  }
}
```

**Subresource Integrity (SRI) for External Resources:**

```html
<!-- Use SRI for CDN resources -->
<script
  src="https://cdn.example.com/library.js"
  integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC"
  crossorigin="anonymous"
></script>
```

**Sources:**
- MDN: "Subresource Integrity"
- Smashing Magazine: "Understanding Subresource Integrity"
- GeeksforGeeks: "Understanding Checksum Algorithm for Data Integrity"

---

### 4.2 Data Corruption Detection

**Strategies:**

1. **Checksum Validation** (covered above)
2. **Schema Validation**
3. **Structural Validation**
4. **Periodic Health Checks**

**Implementation:**

```typescript
import { z } from 'zod'; // Schema validation library

class CorruptionDetector {
  // Define schema for your data
  private promptSchema = z.object({
    id: z.string().uuid(),
    title: z.string().min(1).max(200),
    content: z.string(),
    categoryId: z.string().uuid(),
    createdAt: z.number().positive(),
    updatedAt: z.number().positive()
  });

  private categorySchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(100),
    color: z.string().regex(/^#[0-9A-F]{6}$/i),
    promptCount: z.number().int().nonnegative()
  });

  // Validate individual item
  validatePrompt(prompt: unknown): ValidationResult {
    try {
      this.promptSchema.parse(prompt);
      return { valid: true };
    } catch (err) {
      return {
        valid: false,
        errors: err.errors,
        severity: 'error'
      };
    }
  }

  // Validate entire dataset
  async validateAllData(): Promise<ValidationReport> {
    const report: ValidationReport = {
      timestamp: Date.now(),
      totalItems: 0,
      validItems: 0,
      invalidItems: 0,
      errors: [],
      warnings: []
    };

    // Get all data
    const data = await storage.local.get(null);

    // Validate prompts
    if (data.prompts) {
      for (const prompt of data.prompts) {
        report.totalItems++;
        const result = this.validatePrompt(prompt);

        if (result.valid) {
          report.validItems++;
        } else {
          report.invalidItems++;
          report.errors.push({
            item: prompt.id,
            type: 'prompt',
            errors: result.errors
          });
        }
      }
    }

    // Validate categories
    if (data.categories) {
      for (const category of data.categories) {
        report.totalItems++;
        const result = this.validateCategory(category);

        if (result.valid) {
          report.validItems++;
        } else {
          report.invalidItems++;
          report.errors.push({
            item: category.id,
            type: 'category',
            errors: result.errors
          });
        }
      }
    }

    // Check for orphaned prompts
    const orphanedPrompts = this.findOrphanedPrompts(
      data.prompts || [],
      data.categories || []
    );

    if (orphanedPrompts.length > 0) {
      report.warnings.push({
        type: 'orphaned_prompts',
        count: orphanedPrompts.length,
        items: orphanedPrompts
      });
    }

    return report;
  }

  // Find prompts with non-existent categories
  private findOrphanedPrompts(
    prompts: Prompt[],
    categories: Category[]
  ): string[] {
    const categoryIds = new Set(categories.map(c => c.id));
    return prompts
      .filter(p => !categoryIds.has(p.categoryId))
      .map(p => p.id);
  }

  // Periodic health check
  async runHealthCheck(): Promise<HealthCheckResult> {
    const report = await this.validateAllData();

    // Check checksums
    const checksumResults = await this.verifyAllChecksums();

    // Check storage quota
    const quota = await this.checkStorageQuota();

    return {
      validation: report,
      checksums: checksumResults,
      quota,
      timestamp: Date.now(),
      healthy: report.invalidItems === 0 &&
               checksumResults.failures === 0 &&
               quota.usagePercent < 90
    };
  }

  private async checkStorageQuota(): Promise<QuotaInfo> {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;
    const usagePercent = quota > 0 ? (usage / quota) * 100 : 0;

    return {
      usage,
      quota,
      usagePercent,
      available: quota - usage
    };
  }
}

// Run periodic health checks
class HealthCheckScheduler {
  private checkInterval = 24 * 60 * 60 * 1000; // 24 hours

  async start(): Promise<void> {
    // Run initial check
    await this.performCheck();

    // Schedule periodic checks
    chrome.alarms.create('health-check', {
      periodInMinutes: this.checkInterval / 60000
    });

    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'health-check') {
        this.performCheck();
      }
    });
  }

  private async performCheck(): Promise<void> {
    const detector = new CorruptionDetector();
    const result = await detector.runHealthCheck();

    if (!result.healthy) {
      // Notify user of issues
      await this.notifyUser(result);

      // Attempt automatic repair
      await this.attemptRepair(result);
    }

    // Log result
    await this.logHealthCheck(result);
  }

  private async notifyUser(result: HealthCheckResult): Promise<void> {
    if (result.validation.invalidItems > 0) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon128.png',
        title: 'Data Integrity Issue Detected',
        message: `Found ${result.validation.invalidItems} corrupted items. Click to view details.`
      });
    }
  }
}
```

**Sources:**
- Research: "Detection and Recovery Techniques for Database Corruption"
- Stack Overflow: Chrome extension corruption discussions

---

### 4.3 Automatic Recovery Mechanisms

**Recovery Strategies:**

1. **Restore from Last Good Backup**
2. **Rebuild Indexes**
3. **Remove Corrupted Items**
4. **Merge from Remote**

**Implementation:**

```typescript
class AutoRecoveryManager {
  async attemptRecovery(
    healthCheck: HealthCheckResult
  ): Promise<RecoveryResult> {
    const result: RecoveryResult = {
      attempted: [],
      succeeded: [],
      failed: [],
      timestamp: Date.now()
    };

    // Strategy 1: Restore from backup if severe corruption
    if (healthCheck.validation.invalidItems > 10) {
      result.attempted.push('restore_from_backup');

      try {
        await this.restoreFromBackup();
        result.succeeded.push('restore_from_backup');
        return result; // Exit early if successful
      } catch (err) {
        result.failed.push({
          strategy: 'restore_from_backup',
          error: err.message
        });
      }
    }

    // Strategy 2: Remove corrupted items
    if (healthCheck.validation.errors.length > 0) {
      result.attempted.push('remove_corrupted');

      try {
        await this.removeCorruptedItems(healthCheck.validation.errors);
        result.succeeded.push('remove_corrupted');
      } catch (err) {
        result.failed.push({
          strategy: 'remove_corrupted',
          error: err.message
        });
      }
    }

    // Strategy 3: Fix orphaned prompts
    if (healthCheck.validation.warnings.length > 0) {
      result.attempted.push('fix_orphans');

      try {
        await this.fixOrphanedPrompts();
        result.succeeded.push('fix_orphans');
      } catch (err) {
        result.failed.push({
          strategy: 'fix_orphans',
          error: err.message
        });
      }
    }

    // Strategy 4: Rebuild indexes
    result.attempted.push('rebuild_indexes');
    try {
      await this.rebuildIndexes();
      result.succeeded.push('rebuild_indexes');
    } catch (err) {
      result.failed.push({
        strategy: 'rebuild_indexes',
        error: err.message
      });
    }

    return result;
  }

  private async restoreFromBackup(): Promise<void> {
    // Get latest valid backup
    const backups = await this.listBackups();

    for (const backup of backups) {
      // Verify backup integrity
      const valid = await this.verifyBackup(backup.id);

      if (valid) {
        // Restore from this backup
        const data = await this.loadBackup(backup.id);
        await storage.local.clear();
        await storage.local.set(data);

        console.log(`Restored from backup: ${backup.id}`);
        return;
      }
    }

    throw new Error('No valid backup found');
  }

  private async removeCorruptedItems(
    errors: ValidationError[]
  ): Promise<void> {
    const data = await storage.local.get(['prompts', 'categories']);

    // Remove corrupted prompts
    const corruptedPromptIds = new Set(
      errors.filter(e => e.type === 'prompt').map(e => e.item)
    );

    if (corruptedPromptIds.size > 0) {
      const validPrompts = (data.prompts || []).filter(
        p => !corruptedPromptIds.has(p.id)
      );
      await storage.local.set({ prompts: validPrompts });
    }

    // Remove corrupted categories
    const corruptedCategoryIds = new Set(
      errors.filter(e => e.type === 'category').map(e => e.item)
    );

    if (corruptedCategoryIds.size > 0) {
      const validCategories = (data.categories || []).filter(
        c => !corruptedCategoryIds.has(c.id)
      );
      await storage.local.set({ categories: validCategories });
    }
  }

  private async fixOrphanedPrompts(): Promise<void> {
    const data = await storage.local.get(['prompts', 'categories']);
    const prompts = data.prompts || [];
    const categories = data.categories || [];

    // Create "Uncategorized" category if it doesn't exist
    let uncategorizedCategory = categories.find(
      c => c.name === 'Uncategorized'
    );

    if (!uncategorizedCategory) {
      uncategorizedCategory = {
        id: generateId(),
        name: 'Uncategorized',
        color: '#6B7280',
        promptCount: 0
      };
      categories.push(uncategorizedCategory);
    }

    // Move orphaned prompts to Uncategorized
    const categoryIds = new Set(categories.map(c => c.id));
    let movedCount = 0;

    for (const prompt of prompts) {
      if (!categoryIds.has(prompt.categoryId)) {
        prompt.categoryId = uncategorizedCategory.id;
        movedCount++;
      }
    }

    // Update category count
    uncategorizedCategory.promptCount += movedCount;

    // Save changes
    await storage.local.set({ prompts, categories });
  }

  private async rebuildIndexes(): Promise<void> {
    // Rebuild category prompt counts
    const data = await storage.local.get(['prompts', 'categories']);
    const prompts = data.prompts || [];
    const categories = data.categories || [];

    // Count prompts per category
    const countMap = new Map<string, number>();
    for (const prompt of prompts) {
      const count = countMap.get(prompt.categoryId) || 0;
      countMap.set(prompt.categoryId, count + 1);
    }

    // Update category counts
    for (const category of categories) {
      category.promptCount = countMap.get(category.id) || 0;
    }

    await storage.local.set({ categories });
  }
}
```

**Recovery UI:**

```tsx
const RecoveryPanel: React.FC<{
  healthCheck: HealthCheckResult;
  onRecover: () => Promise<void>;
}> = ({ healthCheck, onRecover }) => {
  const [recovering, setRecovering] = useState(false);
  const [result, setResult] = useState<RecoveryResult | null>(null);

  const handleRecover = async () => {
    setRecovering(true);
    try {
      const recoveryResult = await onRecover();
      setResult(recoveryResult);
    } catch (err) {
      console.error('Recovery failed', err);
    } finally {
      setRecovering(false);
    }
  };

  if (!healthCheck.healthy) {
    return (
      <div className="recovery-panel alert alert-warning">
        <h4>Data Integrity Issues Detected</h4>

        <ul>
          {healthCheck.validation.invalidItems > 0 && (
            <li>
              {healthCheck.validation.invalidItems} corrupted items found
            </li>
          )}
          {healthCheck.checksums.failures > 0 && (
            <li>
              {healthCheck.checksums.failures} checksum validation failures
            </li>
          )}
          {healthCheck.quota.usagePercent > 90 && (
            <li>
              Storage quota at {healthCheck.quota.usagePercent.toFixed(1)}%
            </li>
          )}
        </ul>

        <button
          onClick={handleRecover}
          disabled={recovering}
          className="btn btn-primary"
        >
          {recovering ? 'Recovering...' : 'Attempt Automatic Recovery'}
        </button>

        {result && (
          <div className="recovery-result">
            <h5>Recovery Complete</h5>
            <ul>
              {result.succeeded.map(strategy => (
                <li key={strategy} className="success">
                  ✓ {strategy}
                </li>
              ))}
              {result.failed.map(failure => (
                <li key={failure.strategy} className="error">
                  ✗ {failure.strategy}: {failure.error}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="recovery-panel alert alert-success">
      ✓ All systems healthy
    </div>
  );
};
```

**Sources:**
- Stack Overflow: Chrome extension corruption recovery discussions
- Research: "Detection and Recovery Techniques for Database Corruption"

---

### 4.4 Backup Verification

**Pattern:** Verify backups are actually restorable

```typescript
class BackupVerifier {
  async verifyBackup(backupId: string): Promise<VerificationResult> {
    const result: VerificationResult = {
      backupId,
      timestamp: Date.now(),
      checks: [],
      valid: true
    };

    // 1. Load backup
    let backup: Backup;
    try {
      backup = await this.loadBackup(backupId);
      result.checks.push({
        name: 'load',
        passed: true
      });
    } catch (err) {
      result.checks.push({
        name: 'load',
        passed: false,
        error: err.message
      });
      result.valid = false;
      return result;
    }

    // 2. Verify checksum
    const checksumValid = await this.verifyChecksum(backup);
    result.checks.push({
      name: 'checksum',
      passed: checksumValid
    });
    if (!checksumValid) result.valid = false;

    // 3. Validate schema
    const schemaValid = await this.validateSchema(backup.data);
    result.checks.push({
      name: 'schema',
      passed: schemaValid
    });
    if (!schemaValid) result.valid = false;

    // 4. Test restore (dry run)
    try {
      await this.dryRunRestore(backup);
      result.checks.push({
        name: 'restore_test',
        passed: true
      });
    } catch (err) {
      result.checks.push({
        name: 'restore_test',
        passed: false,
        error: err.message
      });
      result.valid = false;
    }

    // 5. Verify completeness
    const complete = await this.verifyCompleteness(backup.data);
    result.checks.push({
      name: 'completeness',
      passed: complete
    });
    if (!complete) result.valid = false;

    return result;
  }

  private async dryRunRestore(backup: Backup): Promise<void> {
    // Create a temporary in-memory store
    const tempStore = new Map();

    // Simulate restore
    for (const [key, value] of Object.entries(backup.data)) {
      tempStore.set(key, value);
    }

    // Verify all expected keys exist
    const requiredKeys = ['prompts', 'categories', 'settings'];
    for (const key of requiredKeys) {
      if (!tempStore.has(key)) {
        throw new Error(`Missing required key: ${key}`);
      }
    }
  }

  private async verifyCompleteness(data: any): Promise<boolean> {
    // Check that all referenced items exist
    const prompts = data.prompts || [];
    const categories = data.categories || [];

    const categoryIds = new Set(categories.map(c => c.id));

    // Every prompt should reference an existing category
    for (const prompt of prompts) {
      if (!categoryIds.has(prompt.categoryId)) {
        return false;
      }
    }

    return true;
  }

  // Periodic verification of all backups
  async verifyAllBackups(): Promise<VerificationSummary> {
    const backups = await this.listBackups();
    const results: VerificationResult[] = [];

    for (const backup of backups) {
      const result = await this.verifyBackup(backup.id);
      results.push(result);
    }

    return {
      totalBackups: backups.length,
      validBackups: results.filter(r => r.valid).length,
      invalidBackups: results.filter(r => !r.valid).length,
      results
    };
  }
}
```

---

## 5. Implementation Recommendations

### 5.1 For Your Prompt Manager Extension

Based on your current architecture and requirements, here are specific recommendations:

#### Current State Analysis

- Using `storage.local` for large datasets (prompts, categories)
- No sync functionality currently implemented
- Export/import functionality exists
- Strong focus on data integrity (checksum validation in PromptManager)

#### Recommended Approach

**Phase 1: Enhanced Local Backup** (Immediate)

```typescript
// Add to existing codebase
class EnhancedBackupManager {
  private autoBackupConfig: BackupConfig = {
    enabled: true,
    frequency: 'daily',
    maxBackups: 7,
    includeDeleted: false,
    compression: false
  };

  // Integrate with existing export functionality
  async createAutoBackup(): Promise<void> {
    const data = await PromptManager.getInstance().exportData();

    const backup: Backup = {
      id: generateId(),
      timestamp: Date.now(),
      version: this.getAppVersion(),
      data,
      checksum: await this.calculateChecksum(data),
      auto: true
    };

    // Store in storage.local under 'backups' key
    const existing = await this.getBackups();
    existing.push(backup);

    // Rotate backups
    const toKeep = this.rotateBackups(existing);

    await storage.local.set({ backups: toKeep });
  }

  private rotateBackups(backups: Backup[]): Backup[] {
    // Keep: last 7 daily, last 4 weekly, last 3 monthly
    const sorted = backups.sort((a, b) => b.timestamp - a.timestamp);

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    const daily = sorted.filter(
      b => now - b.timestamp < 7 * dayMs
    ).slice(0, 7);

    const weekly = sorted.filter(
      b => now - b.timestamp < 28 * dayMs &&
           !daily.includes(b)
    ).slice(0, 4);

    const monthly = sorted.filter(
      b => now - b.timestamp < 90 * dayMs &&
           !daily.includes(b) &&
           !weekly.includes(b)
    ).slice(0, 3);

    return [...daily, ...weekly, ...monthly];
  }
}
```

**Phase 2: Add Draft Auto-Save** (High Priority)

```typescript
// For AddPromptForm and EditPromptForm
class PromptDraftManager extends AutoSaveManager<PromptFormData> {
  constructor(formType: 'add' | 'edit', promptId?: string) {
    super();
    this.draftKey = formType === 'edit'
      ? `draft_edit_${promptId}`
      : 'draft_add';
  }
}

// Integration in forms
const AddPromptForm: FC<Props> = ({ onSave, onCancel }) => {
  const draftManager = useMemo(() => new PromptDraftManager('add'), []);
  const [formData, setFormData] = useState<PromptFormData>(initialData);

  // Load draft on mount
  useEffect(() => {
    const loadDraft = async () => {
      if (await draftManager.hasDraft()) {
        const draft = await draftManager.loadDraft();
        if (draft && confirm('Restore unsaved changes?')) {
          setFormData(draft);
        } else {
          await draftManager.clearDraft();
        }
      }
    };
    loadDraft();
  }, []);

  // Auto-save on changes
  const handleFieldChange = (field: string, value: any) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    draftManager.scheduleSave(newData);
  };

  // Clear draft on successful save
  const handleSubmit = async () => {
    await onSave(formData);
    await draftManager.clearDraft();
  };
};
```

**Phase 3: Optional Cloud Sync** (Future Enhancement)

Given Chrome's storage.sync limitations (100KB), recommend:

1. **Settings Only Sync via storage.sync**
   ```typescript
   // Sync only small settings
   const syncableSettings = {
     theme: settings.theme,
     language: settings.language,
     // ... other small settings
   };
   await chrome.storage.sync.set({ settings: syncableSettings });
   ```

2. **Full Data Sync via Google Drive** (Optional, User-Initiated)
   ```typescript
   class CloudSyncManager {
     // Manual sync button in settings
     async syncToCloud(): Promise<void> {
       const data = await PromptManager.getInstance().exportData();
       await googleDriveBackup.backup(data);
     }

     async syncFromCloud(): Promise<void> {
       const data = await googleDriveBackup.restore();
       await PromptManager.getInstance().importData(data);
     }
   }
   ```

---

### 5.2 Architecture Recommendations

**Recommended Stack:**

```
┌─────────────────────────────────────┐
│         React UI Layer              │
├─────────────────────────────────────┤
│   Enhanced Backup Manager           │
│   - Auto backup (daily)             │
│   - Draft auto-save (2s debounce)   │
│   - Version history (optional)      │
├─────────────────────────────────────┤
│   Existing PromptManager            │
│   - Add checksum validation         │
│   - Add corruption detection        │
├─────────────────────────────────────┤
│   Storage Layer                     │
│   - storage.local (primary)         │
│   - storage.sync (settings only)    │
│   - Google Drive (optional)         │
└─────────────────────────────────────┘
```

**Priority Implementation Order:**

1. **Auto-backup** (1-2 days)
   - Schedule daily backups
   - Implement rotation policy
   - Add restore UI

2. **Draft auto-save** (1 day)
   - Add to AddPromptForm
   - Add to EditPromptForm
   - Show draft recovery prompt

3. **Data integrity checks** (1-2 days)
   - Add schema validation
   - Add periodic health checks
   - Add recovery UI

4. **Sync status indicator** (0.5 day)
   - Add to header
   - Show backup status
   - Show last backup time

5. **Optional: Cloud sync** (Future)
   - Google Drive integration
   - Conflict resolution UI
   - Selective sync controls

---

### 5.3 Testing Requirements

**Critical Tests:**

```typescript
describe('EnhancedBackupManager', () => {
  it('should create backup with checksum', async () => {
    const manager = new EnhancedBackupManager();
    const result = await manager.performBackup();

    expect(result.success).toBe(true);
    expect(result.backupId).toBeDefined();

    // Verify backup includes checksum
    const backup = await manager.getBackup(result.backupId);
    expect(backup.checksum).toBeDefined();
  });

  it('should restore from valid backup', async () => {
    const manager = new EnhancedBackupManager();
    const original = await PromptManager.getInstance().exportData();

    // Create backup
    const { backupId } = await manager.performBackup();

    // Modify data
    await storage.local.set({ prompts: [] });

    // Restore
    await manager.restoreBackup(backupId);

    // Verify restoration
    const restored = await storage.local.get('prompts');
    expect(restored.prompts).toEqual(original.prompts);
  });

  it('should rotate old backups', async () => {
    const manager = new EnhancedBackupManager();

    // Create 10 backups
    for (let i = 0; i < 10; i++) {
      await manager.performBackup();
    }

    const backups = await manager.listBackups();

    // Should keep only maxBackups (7)
    expect(backups.length).toBeLessThanOrEqual(7);
  });
});

describe('PromptDraftManager', () => {
  it('should auto-save draft after delay', async () => {
    jest.useFakeTimers();

    const manager = new PromptDraftManager('add');
    const data = { title: 'Test', content: 'Content' };

    manager.scheduleSave(data);

    // Fast-forward time
    jest.advanceTimersByTime(2000);

    const draft = await manager.loadDraft();
    expect(draft).toEqual(data);
  });

  it('should detect corrupted draft', async () => {
    const manager = new PromptDraftManager('add');

    // Save valid draft
    const data = { title: 'Test' };
    await manager.saveDraft(data);

    // Corrupt the checksum
    const result = await storage.local.get('draft_add');
    result.draft_add.checksum = 'invalid';
    await storage.local.set(result);

    // Should return null for corrupted draft
    const loaded = await manager.loadDraft();
    expect(loaded).toBeNull();
  });
});
```

---

## 6. Real-World Examples

### 6.1 Successful Extension Implementations

**1. xBrowserSync**
- **What**: Cross-browser bookmark sync
- **Sync Strategy**: Custom server with end-to-end encryption
- **Conflict Resolution**: Last-write-wins with merge support
- **Key Features**:
  - Offline-first architecture
  - End-to-end encryption
  - Cross-browser support
  - Manual sync control

**2. Grammarly**
- **Sync Strategy**: Real-time cloud sync
- **Data**: User dictionary, settings
- **Key Features**:
  - Seamless cross-device experience
  - Real-time updates
  - Offline functionality with queue

**3. LastPass**
- **Sync Strategy**: Encrypted vault sync
- **Conflict Resolution**: Master password + sync status
- **Key Features**:
  - Secure encryption
  - Offline vault access
  - Conflict resolution UI

**4. Notion Web Clipper**
- **Sync Strategy**: API-based sync to Notion cloud
- **Key Features**:
  - Optimistic UI
  - Offline queue
  - Retry mechanism

---

### 6.2 Common Patterns from Popular Apps

**Google Docs:**
- Real-time sync with operational transformation
- "All changes saved to Drive" indicator
- Offline mode with sync queue
- Version history with restore

**Dropbox:**
- File-level sync with checksums
- Green checkmark for synced files
- Selective sync
- LAN sync for faster transfers

**Obsidian:**
- File-based sync
- Conflict resolution UI
- Version history
- Optional cloud sync

**Notion:**
- Block-level sync
- Optimistic updates
- Offline queue
- Background sync

---

## 7. Technology Stack Recommendations

### 7.1 Libraries and Tools

**For Offline-First:**
- **PouchDB**: IndexedDB wrapper with sync support
- **RxDB**: Reactive database with sync plugins
- **Dexie.js**: Modern IndexedDB wrapper

**For Conflict Resolution:**
- **Yjs**: CRDT library for collaborative editing
- **Automerge**: JSON-like CRDT library
- **deep-diff**: Object diffing for conflict visualization

**For Data Validation:**
- **Zod**: TypeScript-first schema validation
- **Joi**: Object schema validation
- **Ajv**: JSON Schema validator

**For Compression:**
- **pako**: Gzip compression for JavaScript
- **lz-string**: String compression for localStorage

**For Checksums:**
- **Web Crypto API**: Built-in SHA-256 hashing
- **crypto-js**: Fallback for older browsers

---

## 8. Summary and Key Takeaways

### Critical Points

1. **storage.sync is NOT for large data** - Use storage.local for your prompts
2. **Offline-first is the gold standard** - Build for offline, sync is a bonus
3. **Always validate data integrity** - Checksums, schema validation, health checks
4. **User control is important** - Manual sync, selective sync, conflict resolution
5. **Auto-save prevents data loss** - Debounced drafts with integrity checks

### Recommended Implementation for Your Extension

**Minimum Viable Sync (1-2 weeks):**
1. Auto-backup (daily, 7 retention)
2. Draft auto-save (2s debounce)
3. Backup restore UI
4. Data integrity health checks

**Enhanced Version (1-2 months):**
1. Settings sync via storage.sync
2. Google Drive backup integration
3. Version history
4. Conflict resolution UI

**Full Sync Solution (3+ months):**
1. Custom sync server
2. Real-time WebSocket sync
3. CRDT-based conflict resolution
4. Advanced selective sync

---

## Sources and References

**Official Documentation:**
- Chrome for Developers - chrome.storage API
- MDN - storage.sync API
- MDN - Subresource Integrity

**Research Papers:**
- "Detection and Recovery Techniques for Database Corruption" (Stanford)
- "A Study on the Use of Checksums for Integrity Verification" (ACM)

**Technical Articles:**
- Medium: "Data Synchronization in Chrome Extensions"
- Hasura: "Design Guide to Offline-First Apps"
- Redis: "Diving into CRDTs"
- RxDB: "Local First / Offline First"

**Open Source Projects:**
- xBrowserSync (github.com/xbrowsersync/app)
- PouchDB (pouchdb.com)
- Yjs (yjs.dev)

**Best Practices:**
- HackerNoon: "State Storage in Chrome Extensions"
- LogRocket: "Using IndexedDB Complete Guide"
- web.dev: "IndexedDB Best Practices"

---

**End of Report**

This research represents the current state of modern sync and backup patterns as of January 2025. Technologies and best practices continue to evolve, so periodic review is recommended.
