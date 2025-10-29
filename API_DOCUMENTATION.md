## NotesApp Public API Documentation

Complete API reference for embedding and controlling the NotesApp in parent applications.

---

## Table of Contents

1. [Installation](#installation)
2. [Quick Start](#quick-start)
3. [API Reference](#api-reference)
   - [NotesAppFacade](#notesappfacade)
   - [Lifecycle Methods](#lifecycle-methods)
   - [File Operations](#file-operations)
   - [Folder Operations](#folder-operations)
   - [Navigation](#navigation)
   - [View Settings](#view-settings)
   - [Workspace Operations](#workspace-operations)
   - [Event System](#event-system)
4. [TypeScript Types](#typescript-types)
5. [Events](#events)
6. [Custom Storage Backends](#custom-storage-backends)
7. [Examples](#examples)

---

## Installation

```bash
npm install @yourorg/notes-app
# or
yarn add @yourorg/notes-app
```

---

## Quick Start

### Basic Embedding

```typescript
import { NotesAppFacade } from '@yourorg/notes-app';

const notesApp = new NotesAppFacade();

// Mount into a container
notesApp.mount(document.getElementById('notes-container'), {
  initialViewMode: 'split',
  showGraphButton: true,
  onReady: () => {
    console.log('Notes app ready!');
  },
});
```

### Programmatic Control

```typescript
// Create a file
const file = await notesApp.createFile('Meeting Notes', '/Work/Meeting Notes', '# Meeting\n\n...');

// Listen for changes
notesApp.on('file:created', (event) => {
  console.log('New file created:', event.file.name);
});

// Update a file
await notesApp.updateFile(file.id, '# Updated content');

// Export workspace
const json = notesApp.exportWorkspace();
```

---

## API Reference

### NotesAppFacade

Main class for controlling the notes application.

#### Constructor

```typescript
constructor()
```

Creates a new instance of NotesAppFacade. Multiple instances can be created for different containers.

```typescript
const notesApp = new NotesAppFacade();
```

---

### Lifecycle Methods

#### `mount(element, config?)`

Mount the notes app into a DOM element.

**Parameters:**
- `element: HTMLElement` - Container element for the app
- `config?: NotesAppConfig` - Optional configuration

**Returns:** `void`

**Throws:** Error if already mounted or element is invalid

```typescript
notesApp.mount(document.getElementById('container'), {
  initialViewMode: 'split',
  enableLocalStorage: true,
  showGraphButton: true,
  className: 'my-notes-app',
  onReady: () => console.log('Ready'),
  onError: (err) => console.error('Error:', err),
});
```

#### `unmount()`

Unmount the app from the DOM and clean up resources.

**Returns:** `void`

```typescript
notesApp.unmount();
```

#### `isMounted()`

Check if the app is currently mounted.

**Returns:** `boolean`

```typescript
if (notesApp.isMounted()) {
  console.log('App is running');
}
```

---

### File Operations

#### `createFile(name, path, content?)`

Create a new markdown file.

**Parameters:**
- `name: string` - File name (without extension)
- `path: string` - Full path including name (e.g., "/Folder/File Name")
- `content?: string` - Initial markdown content (default: empty)

**Returns:** `Promise<File>`

**Throws:** Error if app not mounted

```typescript
const file = await notesApp.createFile(
  'JavaScript Basics',
  '/Programming/JavaScript Basics',
  '# JavaScript\n\nIntroduction to JS...'
);
```

#### `updateFile(fileId, content)`

Update a file's content.

**Parameters:**
- `fileId: string` - File UUID
- `content: string` - New markdown content

**Returns:** `Promise<void>`

**Throws:** Error if file not found or app not mounted

```typescript
await notesApp.updateFile(file.id, '# Updated Content\n\n...');
```

#### `deleteFile(fileId)`

Delete a file.

**Parameters:**
- `fileId: string` - File UUID

**Returns:** `Promise<void>`

**Throws:** Error if file not found or app not mounted

```typescript
await notesApp.deleteFile(file.id);
```

#### `renameFile(fileId, newName, newPath)`

Rename or move a file.

**Parameters:**
- `fileId: string` - File UUID
- `newName: string` - New file name
- `newPath: string` - New full path

**Returns:** `Promise<void>`

**Throws:** Error if file not found or app not mounted

```typescript
await notesApp.renameFile(
  file.id,
  'Advanced JavaScript',
  '/Programming/Advanced JavaScript'
);
```

#### `getFile(fileId)`

Get a file by ID.

**Parameters:**
- `fileId: string` - File UUID

**Returns:** `File | undefined`

```typescript
const file = notesApp.getFile('file-uuid-123');
if (file) {
  console.log(file.name, file.content);
}
```

#### `getAllFiles()`

Get all files in the workspace.

**Returns:** `File[]`

```typescript
const allFiles = notesApp.getAllFiles();
console.log(`Total files: ${allFiles.length}`);
```

#### `queryFiles(options)`

Query files with filters and sorting.

**Parameters:**
- `options: FileQueryOptions` - Query options

**Returns:** `File[]`

```typescript
// Get all files in a folder
const files = notesApp.queryFiles({
  parentFolderId: 'folder-uuid',
});

// Search by name
const searchResults = notesApp.queryFiles({
  nameContains: 'javascript',
  sortBy: 'modified',
  sortDirection: 'desc',
});
```

---

### Folder Operations

#### `createFolder(name, path)`

Create a new folder.

**Parameters:**
- `name: string` - Folder name
- `path: string` - Full path including name

**Returns:** `Promise<Folder>`

**Throws:** Error if app not mounted

```typescript
const folder = await notesApp.createFolder('Programming', '/Programming');
```

#### `deleteFolder(folderId)`

Delete a folder.

**Parameters:**
- `folderId: string` - Folder UUID

**Returns:** `Promise<void>`

**Throws:** Error if folder not found or app not mounted

```typescript
await notesApp.deleteFolder(folder.id);
```

#### `getFolder(folderId)`

Get a folder by ID.

**Parameters:**
- `folderId: string` - Folder UUID

**Returns:** `Folder | undefined`

```typescript
const folder = notesApp.getFolder('folder-uuid-123');
```

#### `getAllFolders()`

Get all folders in the workspace.

**Returns:** `Folder[]`

```typescript
const allFolders = notesApp.getAllFolders();
```

---

### Navigation

#### `openFile(fileId)`

Open a file (set as current/active).

**Parameters:**
- `fileId: string` - File UUID

**Returns:** `void`

**Throws:** Error if file not found or app not mounted

```typescript
notesApp.openFile(file.id);
```

#### `getCurrentFile()`

Get the currently open file.

**Returns:** `File | undefined`

```typescript
const currentFile = notesApp.getCurrentFile();
if (currentFile) {
  console.log('Editing:', currentFile.name);
}
```

#### `closeCurrentFile()`

Close the current file.

**Returns:** `void`

```typescript
notesApp.closeCurrentFile();
```

---

### View Settings

#### `setViewMode(mode)`

Set the editor view mode.

**Parameters:**
- `mode: EditorViewMode` - One of: `'edit'`, `'preview'`, `'split'`

**Returns:** `void`

**Throws:** Error if app not mounted

```typescript
notesApp.setViewMode('split');
```

#### `getViewMode()`

Get the current view mode.

**Returns:** `EditorViewMode`

```typescript
const mode = notesApp.getViewMode(); // 'edit' | 'preview' | 'split'
```

#### `toggleGraphView()`

Toggle the graph view visibility.

**Returns:** `void`

**Throws:** Error if app not mounted

```typescript
notesApp.toggleGraphView();
```

#### `setGraphViewVisible(visible)`

Show or hide the graph view.

**Parameters:**
- `visible: boolean` - Whether graph should be visible

**Returns:** `void`

```typescript
notesApp.setGraphViewVisible(true);
```

---

### Workspace Operations

#### `getWorkspace()`

Get the complete workspace data.

**Returns:** `WorkspaceData`

```typescript
const workspace = notesApp.getWorkspace();
console.log(workspace.files, workspace.folders, workspace.metadata);
```

#### `importWorkspace(data)`

Import workspace data.

**Parameters:**
- `data: WorkspaceData` - Workspace data to import

**Returns:** `Promise<void>`

**Throws:** Error if app not mounted

```typescript
const workspaceData = {
  files: { ... },
  folders: { ... },
  metadata: { ... },
};

await notesApp.importWorkspace(workspaceData);
```

#### `exportWorkspace()`

Export workspace as JSON string.

**Returns:** `string`

```typescript
const json = notesApp.exportWorkspace();
localStorage.setItem('backup', json);
```

#### `getStats()`

Get workspace statistics.

**Returns:** `WorkspaceStats`

```typescript
const stats = notesApp.getStats();
console.log(`${stats.fileCount} files, ${stats.linkCount} links`);
```

#### `clearWorkspace()`

Clear all files and folders.

**Returns:** `Promise<void>`

**Throws:** Error if app not mounted

```typescript
if (confirm('Clear all data?')) {
  await notesApp.clearWorkspace();
}
```

---

### Event System

#### `on(event, handler)`

Subscribe to an event.

**Parameters:**
- `event: NotesAppEvent` - Event name
- `handler: EventHandler` - Callback function

**Returns:** `() => void` - Unsubscribe function

```typescript
const unsubscribe = notesApp.on('file:created', (event) => {
  console.log('New file:', event.file.name);
});

// Later: unsubscribe
unsubscribe();
```

#### `once(event, handler)`

Subscribe to an event once (auto-unsubscribes after first call).

**Parameters:**
- `event: NotesAppEvent` - Event name
- `handler: EventHandler` - Callback function

**Returns:** `void`

```typescript
notesApp.once('workspace:loaded', (event) => {
  console.log(`Loaded ${event.fileCount} files`);
});
```

#### `off(event, handler)`

Unsubscribe from an event.

**Parameters:**
- `event: NotesAppEvent` - Event name
- `handler: EventHandler` - Callback function to remove

**Returns:** `void`

```typescript
const handler = (event) => console.log(event);
notesApp.on('file:created', handler);
notesApp.off('file:created', handler);
```

---

## TypeScript Types

### NotesAppConfig

```typescript
interface NotesAppConfig {
  initialViewMode?: 'edit' | 'preview' | 'split';
  showGraphButton?: boolean;
  className?: string;
  initialWorkspace?: WorkspaceData;
  enableLocalStorage?: boolean;
  storageBackend?: StorageBackend;
  onReady?: () => void;
  onError?: (error: Error) => void;
}
```

### File

```typescript
interface File {
  id: string;              // UUID
  name: string;            // File name without extension
  content: string;         // Markdown content
  path: string;            // Full path: "/Folder/File Name"
  created: number;         // Timestamp
  modified: number;        // Timestamp
  links: string[];         // Extracted [[link]] names
}
```

### Folder

```typescript
interface Folder {
  id: string;              // UUID
  name: string;            // Folder name
  path: string;            // Full path: "/Folder/Subfolder"
  children: (File | Folder)[];
}
```

### WorkspaceData

```typescript
interface WorkspaceData {
  files: Record<string, File>;
  folders: Record<string, Folder>;
  metadata?: {
    version: string;
    exportedAt: number;
    fileCount: number;
    folderCount: number;
  };
}
```

### FileQueryOptions

```typescript
interface FileQueryOptions {
  parentFolderId?: string;
  nameContains?: string;
  tags?: string[];
  sortBy?: 'name' | 'created' | 'modified';
  sortDirection?: 'asc' | 'desc';
}
```

### WorkspaceStats

```typescript
interface WorkspaceStats {
  fileCount: number;
  folderCount: number;
  totalContentLength: number;
  linkCount: number;
  lastModified: number;
}
```

---

## Events

All available events with their payload types:

| Event | Payload | Description |
|-------|---------|-------------|
| `file:created` | `{ file: File }` | New file created |
| `file:updated` | `{ file: File, previousContent: string }` | File content changed |
| `file:deleted` | `{ fileId: string, fileName: string }` | File deleted |
| `file:opened` | `{ file: File }` | File opened/selected |
| `folder:created` | `{ folder: Folder }` | New folder created |
| `folder:deleted` | `{ folderId: string, folderName: string }` | Folder deleted |
| `workspace:loaded` | `{ fileCount: number, folderCount: number }` | Workspace loaded |
| `workspace:saved` | `{ timestamp: number }` | Workspace saved |
| `view:mode-changed` | `{ mode: EditorViewMode, previousMode: EditorViewMode }` | View mode changed |
| `graph:toggled` | `{ visible: boolean }` | Graph view toggled |

### Event Example

```typescript
notesApp.on('file:updated', (event) => {
  console.log(`File "${event.file.name}" updated`);
  console.log(`Previous content length: ${event.previousContent.length}`);
  console.log(`New content length: ${event.file.content.length}`);
});
```

---

## Custom Storage Backends

Implement custom storage (e.g., DynamoDB, Firebase) by providing a `StorageBackend`:

```typescript
interface StorageBackend {
  loadWorkspace(userId?: string): Promise<WorkspaceData>;
  saveWorkspace(workspace: WorkspaceData, userId?: string): Promise<void>;

  // Optional optimizations
  saveFile?(file: File, userId?: string): Promise<void>;
  saveFolder?(folder: Folder, userId?: string): Promise<void>;
  deleteFile?(fileId: string, userId?: string): Promise<void>;
  deleteFolder?(folderId: string, userId?: string): Promise<void>;
}
```

### Example: DynamoDB Backend

```typescript
class DynamoDBStorage implements StorageBackend {
  async loadWorkspace(userId: string): Promise<WorkspaceData> {
    const result = await dynamodb.getItem({
      TableName: 'notes-app',
      Key: { PK: `USER#${userId}`, SK: 'WORKSPACE#main' },
    });

    return JSON.parse(result.Item.workspace);
  }

  async saveWorkspace(workspace: WorkspaceData, userId: string): Promise<void> {
    await dynamodb.putItem({
      TableName: 'notes-app',
      Item: {
        PK: `USER#${userId}`,
        SK: 'WORKSPACE#main',
        workspace: JSON.stringify(workspace),
        lastModified: Date.now(),
      },
    });
  }
}

// Use it
notesApp.mount(container, {
  storageBackend: new DynamoDBStorage(),
  enableLocalStorage: false, // Disable localStorage
});
```

---

## Examples

### Example 1: Embed in a Dashboard

```typescript
import { NotesAppFacade, NotesAppEvent } from '@yourorg/notes-app';

class Dashboard {
  private notesApp: NotesAppFacade;

  constructor() {
    this.notesApp = new NotesAppFacade();
    this.setupNotesApp();
  }

  private setupNotesApp() {
    // Mount in sidebar
    this.notesApp.mount(document.getElementById('notes-sidebar'), {
      initialViewMode: 'preview',
      showGraphButton: false,
      className: 'dashboard-notes',
    });

    // Sync with analytics
    this.notesApp.on(NotesAppEvent.FILE_CREATED, (event) => {
      this.analytics.track('note_created', {
        fileName: event.file.name,
      });
    });
  }

  async createQuickNote(content: string) {
    const timestamp = new Date().toISOString();
    await this.notesApp.createFile(
      `Quick Note ${timestamp}`,
      `/Quick Notes/Note ${timestamp}`,
      content
    );
  }
}
```

### Example 2: Collaborative Editing

```typescript
import { NotesAppFacade } from '@yourorg/notes-app';

const notesApp = new NotesAppFacade();

notesApp.mount(container);

// Listen for local changes
notesApp.on('file:updated', async (event) => {
  // Send to server for other users
  await fetch('/api/sync', {
    method: 'POST',
    body: JSON.stringify({
      fileId: event.file.id,
      content: event.file.content,
    }),
  });
});

// Receive changes from other users
websocket.on('file-updated', (data) => {
  notesApp.updateFile(data.fileId, data.content);
});
```

### Example 3: Auto-Backup

```typescript
import { NotesAppFacade } from '@yourorg/notes-app';

const notesApp = new NotesAppFacade();

notesApp.mount(container);

// Auto-backup every 5 minutes
setInterval(() => {
  const backup = notesApp.exportWorkspace();
  localStorage.setItem(`backup_${Date.now()}`, backup);
}, 5 * 60 * 1000);
```

### Example 4: Template System

```typescript
const notesApp = new NotesAppFacade();

notesApp.mount(container);

async function createFromTemplate(templateName: string, fileName: string) {
  const templates = {
    'meeting': '# Meeting Notes\n\n## Attendees\n\n## Agenda\n\n## Action Items',
    'project': '# Project: {{name}}\n\n## Overview\n\n## Tasks\n\n## Timeline',
  };

  const content = templates[templateName] || '';
  await notesApp.createFile(fileName, `/${fileName}`, content);
  notesApp.openFile((await notesApp.getAllFiles()).slice(-1)[0].id);
}
```

---

## Browser Support

- Chrome/Edge: Latest 2 versions
- Firefox: Latest 2 versions
- Safari: Latest 2 versions

---

## License

MIT
