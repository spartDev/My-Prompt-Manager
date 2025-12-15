# Team Libraries Design

**Status:** Validated
**Date:** 2025-01-15
**Author:** Thomas Roux (with Claude)

## Overview

A "Team Library" feature that lets small groups (2-20 people) share a prompt collection through a shared folder (Google Drive, Dropbox, OneDrive) - no server required.

### Key Characteristics

- **Privacy-first**: No cloud services, data lives in user-controlled shared folders
- **Clear separation**: Personal prompts and team prompts live in separate tabs
- **Structured permissions**: Owner → Editors → Viewers hierarchy
- **Conflict-safe**: When external changes detected, users see a comparison UI to merge

### User Flow at a Glance

1. Owner creates a team library, picks a shared folder location
2. Owner sets up categories and invites members by sharing folder access
3. Owner edits the team file to assign roles (editor/viewer)
4. Members connect to the same folder path in their extension
5. Everyone sees the same prompts, synced through the shared file
6. On conflict, a diff UI helps resolve changes

---

## File Format & Storage

### Team Library File Structure

File: `team-prompts.json` (or custom name)

```json
{
  "version": "1.0",
  "teamId": "uuid-generated-on-creation",
  "name": "Marketing Team Prompts",
  "createdAt": "2025-01-15T10:00:00Z",
  "lastModified": "2025-01-20T14:30:00Z",
  "members": {
    "owner": "alice@company.com",
    "editors": ["bob@company.com", "carol@company.com"],
    "viewers": ["dave@company.com"]
  },
  "categories": [
    { "id": "cat-1", "name": "Social Media", "color": "blue", "icon": "megaphone" },
    { "id": "cat-2", "name": "Email Campaigns", "color": "green", "icon": "mail" }
  ],
  "prompts": [
    {
      "id": "prompt-uuid",
      "title": "LinkedIn Post Generator",
      "content": "Write a LinkedIn post about {{topic}}...",
      "categoryId": "cat-1",
      "createdBy": "bob@company.com",
      "createdAt": "2025-01-16T09:00:00Z",
      "modifiedBy": "carol@company.com",
      "modifiedAt": "2025-01-18T11:00:00Z"
    }
  ]
}
```

### Member Identification

- On first setup, user enters their email (stored locally, never sent anywhere)
- Email is used to match against member list and determine role
- No authentication - honor system, appropriate for trusted teams

### Local Extension Storage

```json
{
  "teamLibraries": [
    {
      "name": "Marketing Team",
      "folderPath": "/Users/me/Dropbox/team-prompts.json",
      "myEmail": "bob@company.com"
    }
  ]
}
```

---

## Sync & Conflict Resolution

### How Sync Works

The extension uses the **File System Access API** (modern Chrome API):

1. User picks the shared folder once, browser remembers permission
2. Extension reads/writes directly to the JSON file
3. No server required

### Sync Triggers

- On extension popup open → read file, check for changes
- On any edit action → write to file immediately
- Optional: poll every 30 seconds while popup is open

### Detecting External Changes

Each write includes a `lastModified` timestamp + `lastModifiedBy`. On read:

- If `lastModified` matches local cache → no changes, proceed
- If `lastModified` differs → external changes detected, show conflict UI

### Conflict Resolution UI

When conflicts detected, a modal appears:

```
┌─────────────────────────────────────────────┐
│  📋 Team Library Updated Externally         │
│                                             │
│  Changed by: carol@company.com              │
│  3 prompts added, 1 edited, 1 deleted       │
│                                             │
│  [View Changes]  [Accept All]  [Review One] │
└─────────────────────────────────────────────┘
```

### "View Changes" Diff Screen

- Side-by-side comparison for edited prompts
- Checkboxes to accept/reject each change
- "Keep mine" / "Keep theirs" / "Keep both" per item

### Edge Case: Simultaneous Writes

- If write fails (file locked), retry after 1 second, up to 3 times
- If still failing, save changes locally and prompt user to retry later

---

## UI/UX Integration

### Tab Structure in Popup

```
┌─────────────────────────────────────────────┐
│  [My Prompts]  [Team Library ▾]  [Settings] │
├─────────────────────────────────────────────┤
```

- "Team Library" becomes a dropdown if user is in multiple teams
- Badge shows unread changes: `[Team Library 🔴3]`

### Team Library Tab Content

```
┌─────────────────────────────────────────────┐
│  Marketing Team Prompts          [⚙️ Manage]│
│  Role: Editor                               │
├─────────────────────────────────────────────┤
│  🔍 Search team prompts...                  │
├─────────────────────────────────────────────┤
│  Categories: [All ▾]                        │
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐   │
│  │ 📝 LinkedIn Post Generator          │   │
│  │ Social Media • by bob              │   │
│  │ [Copy] [Insert] [Edit]              │   │
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │ 📝 Email Subject Lines              │   │
│  │ Email Campaigns • by carol          │   │
│  │ [Copy] [Insert]           (view-only)│   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### Role-Based UI Differences

| Action | Owner | Editor | Viewer |
|--------|-------|--------|--------|
| View/copy/insert prompts | ✅ | ✅ | ✅ |
| Add new prompts | ✅ | ✅ | ❌ |
| Edit any prompt | ✅ | ✅ | ❌ |
| Delete prompts | ✅ | ✅ (own only) | ❌ |
| Manage categories | ✅ | ❌ | ❌ |
| Manage members | ✅ | ❌ | ❌ |

### "Manage" Menu (Owner Only)

- Edit team name
- Add/edit/delete categories
- Edit member roles (manual email entry)
- Delete team library

---

## Setup & Onboarding Flows

### Creating a New Team (Owner Flow)

**Step 1: Initiate**

Settings → Team Libraries → [+ Create Team]

```
┌─────────────────────────────────────────────┐
│  Create Team Library                        │
│                                             │
│  Team name: [Marketing Prompts         ]    │
│  Your email: [alice@company.com        ]    │
│                                             │
│  [Next →]                                   │
└─────────────────────────────────────────────┘
```

**Step 2: Pick Shared Folder**

```
┌─────────────────────────────────────────────┐
│  Choose Shared Folder                       │
│                                             │
│  Select a folder that your team can access  │
│  (Google Drive, Dropbox, OneDrive, etc.)    │
│                                             │
│  [📁 Browse...]                             │
│                                             │
│  Selected: /Dropbox/Team/prompts/           │
│  File: team-marketing.json (will be created)│
│                                             │
│  [Create Team]                              │
└─────────────────────────────────────────────┘
```

**Step 3: Confirmation**

```
┌─────────────────────────────────────────────┐
│  ✅ Team Created!                           │
│                                             │
│  Share this folder with your team members.  │
│  They'll need to:                           │
│  1. Have access to the shared folder        │
│  2. Click "Join Team" in the extension      │
│  3. Select the same folder                  │
│                                             │
│  Add members now? [Add Members] [Later]     │
└─────────────────────────────────────────────┘
```

### Joining an Existing Team (Member Flow)

Settings → Team Libraries → [+ Join Team]

```
┌─────────────────────────────────────────────┐
│  Join Team Library                          │
│                                             │
│  Your email: [bob@company.com          ]    │
│  (Must match what owner added)              │
│                                             │
│  [📁 Select team file...]                   │
│                                             │
│  Found: "Marketing Prompts"                 │
│  Your role: Editor                          │
│  Members: 4 people                          │
│                                             │
│  [Join Team]                                │
└─────────────────────────────────────────────┘
```

### Error States

- Email not in member list → "Contact team owner to add you"
- File not valid team format → "This doesn't appear to be a team library file"
- No file access permission → "Please grant folder access and try again"

---

## Content Script Integration

### Prompt Selector UI Update

When the user clicks the library icon on AI platforms:

```
┌─────────────────────────────────────────────┐
│  🔍 Search prompts...                       │
├─────────────────────────────────────────────┤
│  [My Prompts ▾]  ← dropdown to switch       │
│    • My Prompts                             │
│    • Marketing Team                         │
│    • Dev Team                               │
├─────────────────────────────────────────────┤
│  Recent                                     │
│  ├── Email opener (mine)                    │
│  └── LinkedIn generator (Marketing Team)   │
│                                             │
│  Social Media                               │
│  ├── Twitter thread writer                  │
│  └── LinkedIn post formatter                │
└─────────────────────────────────────────────┘
```

### Visual Distinction

- Personal prompts: normal appearance
- Team prompts: subtle team icon badge + team name on hover
- Color-coded by team (optional setting)

### Insertion Behavior

- Same as personal prompts - click to insert
- No permission check needed (if you can see it, you can use it)
- Usage stays local (no tracking sent to team file)

### Offline/Sync Considerations

- Content script reads from local cache (last known state)
- If team file unavailable, show cached prompts with "offline" indicator
- Sync happens in popup, not content script (simpler architecture)

### Search Scope

- Default: search current library only
- Optional toggle: "Search all libraries" for cross-library search

---

## Technical Implementation

### New Services

```
src/services/
├── TeamLibraryManager.ts    # Core team operations (singleton)
├── FileSystemService.ts     # File System Access API wrapper
├── ConflictResolver.ts      # Diff detection & merge logic
└── TeamSyncService.ts       # Read/write orchestration
```

#### TeamLibraryManager Responsibilities

- CRUD operations for team prompts (permission-checked)
- Member role validation
- Category management (owner-only operations)
- Local cache management

#### FileSystemService Responsibilities

- Request folder permission via File System Access API
- Read/write JSON files
- Handle file locks and retry logic
- Persist folder handles across sessions (IndexedDB)

### New React Components

```
src/components/
├── teams/
│   ├── TeamLibraryTab.tsx       # Main team view
│   ├── TeamSelector.tsx         # Dropdown for multiple teams
│   ├── TeamPromptCard.tsx       # Card with attribution
│   ├── ConflictModal.tsx        # Diff/merge UI
│   ├── CreateTeamWizard.tsx     # 3-step creation flow
│   ├── JoinTeamModal.tsx        # Join flow
│   └── TeamManagePanel.tsx      # Owner admin panel
```

### New Hooks

```typescript
useTeamLibrary(teamId)      // CRUD for specific team
useTeamSync(teamId)         // Sync state & conflict detection
useTeamPermissions(teamId)  // Current user's role & capabilities
useFileSystemAccess()       // Folder permission management
```

### Integration Points with Existing Code

- `StorageManager` → extended to store team metadata locally
- Content script → reads from new team cache in chrome.storage
- `PromptCard` → extended or wrapped for team attribution display

---

## Implementation Phases

### Phase 1: Foundation (Core Infrastructure)

- FileSystemService with File System Access API
- Basic team file format read/write
- Local team metadata storage
- Single team support

### Phase 2: Team Management (Owner Features)

- Create team wizard
- Category management UI
- Member role editing (manual)
- Delete team functionality

### Phase 3: Member Experience (Join & Use)

- Join team flow
- Team Library tab in popup
- Role-based UI restrictions
- Team prompt cards with attribution

### Phase 4: Sync & Conflicts (Multi-User)

- Change detection on file read
- Conflict resolution modal
- Diff view for edited prompts
- Retry logic for locked files

### Phase 5: Content Script Integration

- Team prompts in AI platform selector
- Library switcher dropdown
- Visual badges for team prompts
- Cached offline access

### Phase 6: Polish & Edge Cases

- Multiple team support
- Cross-library search
- "Copy to personal" action (save team prompt locally)
- Error handling & edge cases

---

## Known Limitations

- **Browser requirement**: Requires Chrome 86+ (File System Access API)
- **Manual folder sharing**: User must share folder outside extension (via Google Drive, Dropbox, etc.)
- **Poll-based sync**: No real-time sync, updates on popup open or manual refresh
- **Honor-system permissions**: No cryptographic enforcement, relies on trusted teams
- **Single file**: All team data in one JSON file (could become large with many prompts)

---

## Future Considerations (Out of Scope)

- Real-time collaboration (would require server)
- Prompt version history
- Comments/discussions on prompts
- Team activity feed
- Integration with team chat tools (Slack, Teams)
