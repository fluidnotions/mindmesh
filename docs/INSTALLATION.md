# MindMesh Installation Guide

## Quick Start

This guide shows you how to install and use MindMesh in your React application.

## Installation

### From GitHub Packages

```bash
npm install @fluidnotions/mindmesh
```

### From Local Build

For development or testing:

```bash
# In the mindmesh directory
npm run build:lib
npm pack

# In your project
npm install /path/to/mindmesh/fluidnotions-mindmesh-1.0.0.tgz
```

### Peer Dependencies

MindMesh requires the following peer dependencies:

```bash
npm install react@^18.0.0 react-dom@^18.0.0
```

## Basic Usage

### 1. Import the Library

```typescript
import { NotesAppFacade } from '@fluidnotions/mindmesh'
import '@fluidnotions/mindmesh/css'
```

**Important:** You must import the CSS file separately.

### 2. Facade API Pattern (Recommended)

Use the `NotesAppFacade` for programmatic control:

```typescript
import { NotesAppFacade, NotesAppConfig, NotesAppEvent } from '@fluidnotions/mindmesh'
import '@fluidnotions/mindmesh/css'

// Configuration
const config: NotesAppConfig = {
  userId: 'user-123',
  storageBackend: myStorageBackend, // Implement StorageBackend interface
  initialLanguage: 'en',
  enableAutoSave: true,
  autoSaveInterval: 5000 // 5 seconds
}

// Create facade instance
const notesApp = new NotesAppFacade(config)

// Initialize
await notesApp.initialize()

// Mount to DOM
notesApp.mount('#app-root')

// Listen to events
notesApp.on(NotesAppEvent.FILE_CREATED, (event) => {
  console.log('File created:', event.file)
})

// Programmatic API
const newFile = await notesApp.createFile('New Note', '/folder1')
await notesApp.updateFile(newFile.id, 'Updated content')
const files = await notesApp.getFiles()

// Cleanup
notesApp.unmount()
```

### 3. React Component Pattern

Use MindMesh as a React component:

```typescript
import React from 'react'
import { App, AppProvider } from '@fluidnotions/mindmesh'
import '@fluidnotions/mindmesh/css'

function MyApp() {
  const storageBackend = myStorageBackend // Your storage implementation

  return (
    <AppProvider storageBackend={storageBackend} userId="user-123">
      <App />
    </AppProvider>
  )
}

export default MyApp
```

### 4. Individual Components

Use specific components in your UI:

```typescript
import React from 'react'
import {
  AppProvider,
  FileExplorer,
  Editor,
  GraphView
} from '@fluidnotions/mindmesh'
import '@fluidnotions/mindmesh/css'

function CustomNotesApp() {
  return (
    <AppProvider storageBackend={myStorageBackend} userId="user-123">
      <div className="custom-layout">
        <aside>
          <FileExplorer />
        </aside>
        <main>
          <Editor />
        </main>
        <aside>
          <GraphView />
        </aside>
      </div>
    </AppProvider>
  )
}
```

## Storage Backend

MindMesh requires a storage backend implementation. You can use built-in strategies or create your own.

### Storage Backend Interface

```typescript
import { StorageBackend, Workspace } from '@fluidnotions/mindmesh'

class MyStorageBackend implements StorageBackend {
  async initialize(): Promise<void> {
    // Setup storage connection
  }

  async loadWorkspace(userId: string | null): Promise<Workspace> {
    // Load user's workspace
  }

  async saveWorkspace(userId: string | null, workspace: Workspace): Promise<void> {
    // Save user's workspace
  }

  async getFile(userId: string | null, fileId: string): Promise<File | null> {
    // Get single file
  }

  async createFile(userId: string | null, file: File): Promise<void> {
    // Create new file
  }

  async updateFile(userId: string | null, file: File): Promise<void> {
    // Update existing file
  }

  async deleteFile(userId: string | null, fileId: string): Promise<void> {
    // Delete file
  }

  // ... implement remaining methods
}
```

### Example: LocalStorage Backend

```typescript
import { StorageBackend, Workspace, File, Folder } from '@fluidnotions/mindmesh'

class LocalStorageBackend implements StorageBackend {
  private storageKey = 'mindmesh-workspace'

  async initialize(): Promise<void> {
    // No initialization needed for localStorage
  }

  async loadWorkspace(userId: string | null): Promise<Workspace> {
    const key = `${this.storageKey}-${userId || 'anonymous'}`
    const data = localStorage.getItem(key)

    if (!data) {
      return {
        files: new Map(),
        folders: new Map(),
        metadata: {
          fileCount: 0,
          folderCount: 0,
          lastAccessed: Date.now()
        }
      }
    }

    const parsed = JSON.parse(data)
    return {
      files: new Map(Object.entries(parsed.files)),
      folders: new Map(Object.entries(parsed.folders)),
      metadata: parsed.metadata
    }
  }

  async saveWorkspace(userId: string | null, workspace: Workspace): Promise<void> {
    const key = `${this.storageKey}-${userId || 'anonymous'}`
    const data = {
      files: Object.fromEntries(workspace.files),
      folders: Object.fromEntries(workspace.folders),
      metadata: {
        ...workspace.metadata,
        lastAccessed: Date.now()
      }
    }
    localStorage.setItem(key, JSON.stringify(data))
  }

  async getFile(userId: string | null, fileId: string): Promise<File | null> {
    const workspace = await this.loadWorkspace(userId)
    return workspace.files.get(fileId) || null
  }

  async createFile(userId: string | null, file: File): Promise<void> {
    const workspace = await this.loadWorkspace(userId)
    workspace.files.set(file.id, file)
    workspace.metadata.fileCount = workspace.files.size
    await this.saveWorkspace(userId, workspace)
  }

  async updateFile(userId: string | null, file: File): Promise<void> {
    await this.createFile(userId, file) // Same as create for localStorage
  }

  async deleteFile(userId: string | null, fileId: string): Promise<void> {
    const workspace = await this.loadWorkspace(userId)
    workspace.files.delete(fileId)
    workspace.metadata.fileCount = workspace.files.size
    await this.saveWorkspace(userId, workspace)
  }

  // Implement remaining methods similarly...
  async getFolder(userId: string | null, folderId: string): Promise<Folder | null> {
    const workspace = await this.loadWorkspace(userId)
    return workspace.folders.get(folderId) || null
  }

  async createFolder(userId: string | null, folder: Folder): Promise<void> {
    const workspace = await this.loadWorkspace(userId)
    workspace.folders.set(folder.id, folder)
    workspace.metadata.folderCount = workspace.folders.size
    await this.saveWorkspace(userId, workspace)
  }

  async updateFolder(userId: string | null, folder: Folder): Promise<void> {
    await this.createFolder(userId, folder)
  }

  async deleteFolder(userId: string | null, folderId: string): Promise<void> {
    const workspace = await this.loadWorkspace(userId)
    workspace.folders.delete(folderId)
    workspace.metadata.folderCount = workspace.folders.size
    await this.saveWorkspace(userId, workspace)
  }

  async listFiles(userId: string | null, parentFolderId?: string): Promise<File[]> {
    const workspace = await this.loadWorkspace(userId)
    const files = Array.from(workspace.files.values())
    return parentFolderId
      ? files.filter(f => f.parentFolderId === parentFolderId)
      : files
  }

  async listFolders(userId: string | null, parentFolderId?: string): Promise<Folder[]> {
    const workspace = await this.loadWorkspace(userId)
    const folders = Array.from(workspace.folders.values())
    return parentFolderId
      ? folders.filter(f => f.parentFolderId === parentFolderId)
      : folders
  }

  async searchFiles(userId: string | null, query: string): Promise<File[]> {
    const workspace = await this.loadWorkspace(userId)
    const lowerQuery = query.toLowerCase()
    return Array.from(workspace.files.values()).filter(file =>
      file.name.toLowerCase().includes(lowerQuery) ||
      file.content.toLowerCase().includes(lowerQuery)
    )
  }

  async getStorageInfo(userId: string | null): Promise<StorageBackendInfo> {
    const workspace = await this.loadWorkspace(userId)
    return {
      strategy: 'single-document',
      isMigrated: false,
      itemCount: workspace.files.size + workspace.folders.size,
      sizeBytes: JSON.stringify(workspace).length
    }
  }

  async clearUserData(userId: string | null): Promise<void> {
    const key = `${this.storageKey}-${userId || 'anonymous'}`
    localStorage.removeItem(key)
  }
}
```

### Example: Using with ytsb-Frontend

In your ytsb-Frontend application:

```typescript
// storage/mindmeshBackend.ts
import { StorageBackend } from '@fluidnotions/mindmesh'

class YtsbMindMeshBackend implements StorageBackend {
  private apiBaseUrl = '/api/mindmesh'

  async initialize(): Promise<void> {
    // Authenticate with backend
  }

  async loadWorkspace(userId: string | null): Promise<Workspace> {
    const response = await fetch(`${this.apiBaseUrl}/workspace/${userId}`)
    return response.json()
  }

  async saveWorkspace(userId: string | null, workspace: Workspace): Promise<void> {
    await fetch(`${this.apiBaseUrl}/workspace/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workspace)
    })
  }

  // ... implement remaining methods
}

// App.tsx
import { NotesAppFacade } from '@fluidnotions/mindmesh'
import '@fluidnotions/mindmesh/css'
import { YtsbMindMeshBackend } from './storage/mindmeshBackend'

const backend = new YtsbMindMeshBackend()
const mindmesh = new NotesAppFacade({
  userId: currentUser.id,
  storageBackend: backend
})

await mindmesh.initialize()
mindmesh.mount('#mindmesh-container')
```

## Advanced Usage

### Event Handling

```typescript
import { NotesAppFacade, NotesAppEvent } from '@fluidnotions/mindmesh'

const notesApp = new NotesAppFacade(config)

// File events
notesApp.on(NotesAppEvent.FILE_CREATED, (event) => {
  console.log('File created:', event.file)
})

notesApp.on(NotesAppEvent.FILE_UPDATED, (event) => {
  console.log('File updated:', event.file)
})

notesApp.on(NotesAppEvent.FILE_DELETED, (event) => {
  console.log('File deleted:', event.fileId)
})

// Folder events
notesApp.on(NotesAppEvent.FOLDER_CREATED, (event) => {
  console.log('Folder created:', event.folder)
})

// Workspace events
notesApp.on(NotesAppEvent.WORKSPACE_SAVED, (event) => {
  console.log('Workspace saved at:', event.timestamp)
})

// View events
notesApp.on(NotesAppEvent.VIEW_MODE_CHANGED, (event) => {
  console.log('View mode changed to:', event.mode)
})
```

### Graph Services

```typescript
import { buildGraphData, getConnectedSubgraph } from '@fluidnotions/mindmesh'

// Build full graph from files
const files = await notesApp.getFiles()
const graphData = buildGraphData(files)

console.log('Nodes:', graphData.nodes.length)
console.log('Links:', graphData.links.length)

// Get subgraph for specific file
const subgraph = getConnectedSubgraph(graphData, 'file-id-123', 2) // depth 2
```

### Keyword Indexing

```typescript
import { buildKeywordIndex } from '@fluidnotions/mindmesh'

const files = await notesApp.getFiles()
const keywordIndex = buildKeywordIndex(files)

// Find files by keyword
const filesWithKeyword = keywordIndex.get('important') || []
console.log('Files tagged with "important":', filesWithKeyword)
```

### Link Parsing

```typescript
import { extractLinks, parseLinkReference, hasLink } from '@fluidnotions/mindmesh'

const content = 'This is a note with [[link to another note]] and #tag'

// Extract all wiki links
const links = extractLinks(content)
console.log('Links:', links) // ['link to another note']

// Parse link reference
const linkRef = parseLinkReference('[[link to another note|Display Text]]')
console.log(linkRef) // { target: 'link to another note', displayText: 'Display Text' }

// Check if content has links
const hasLinks = hasLink(content)
console.log('Has links:', hasLinks) // true
```

### Custom Styling

Override default styles:

```css
/* Override MindMesh styles */
.mindmesh-container {
  --primary-color: #your-brand-color;
  --background-color: #your-background;
}

.mindmesh-file-explorer {
  width: 250px;
}

.mindmesh-editor {
  font-family: 'Your Font', sans-serif;
}
```

### Internationalization

```typescript
import { NotesAppFacade, i18n } from '@fluidnotions/mindmesh'

// Change language
await i18n.changeLanguage('es')

// Available languages
console.log(i18n.languages) // ['en', 'es', ...]

// Add custom translations
i18n.addResourceBundle('en', 'translation', {
  'custom.key': 'Custom translation'
})
```

## TypeScript Support

MindMesh is fully typed with TypeScript. Import types as needed:

```typescript
import type {
  // Facade API
  NotesAppConfig,
  WorkspaceData,
  NotesAppEventMap,

  // Data models
  File,
  Folder,
  EditorViewMode,
  GraphData,
  GraphNode,
  GraphLink,

  // Storage
  StorageBackend,
  StorageStrategy,
  WorkspaceMetadata,
  Workspace,
  StorageBackendInfo,

  // Services
  KeywordIndex,

  // Events
  EventHandler
} from '@fluidnotions/mindmesh'
```

## Build Configuration

### Vite

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['@fluidnotions/mindmesh']
  }
})
```

### Webpack

```javascript
// webpack.config.js
module.exports = {
  // ... other config
  resolve: {
    alias: {
      '@fluidnotions/mindmesh': '@fluidnotions/mindmesh/dist/mindmesh.es.js'
    }
  }
}
```

### Next.js

```javascript
// next.config.js
module.exports = {
  transpilePackages: ['@fluidnotions/mindmesh']
}
```

## Troubleshooting

### CSS Not Loading

**Problem:** Styles are not applied.

**Solution:** Import the CSS file:

```typescript
import '@fluidnotions/mindmesh/css'
```

### React Version Mismatch

**Problem:** Multiple React instances detected.

**Solution:** Ensure peer dependencies are satisfied:

```bash
npm list react react-dom
```

Install correct versions:

```bash
npm install react@^18.0.0 react-dom@^18.0.0
```

### TypeScript Errors

**Problem:** TypeScript can't find types.

**Solution:** Check `tsconfig.json`:

```json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "esModuleInterop": true
  }
}
```

### Storage Backend Not Implemented

**Problem:** App throws "Method not implemented" errors.

**Solution:** Implement all required `StorageBackend` interface methods.

## Examples Repository

See complete examples:
- [Basic Integration](../examples/basic)
- [Custom Storage](../examples/custom-storage)
- [Advanced Usage](../examples/advanced)

## Support

- **Documentation**: [API Documentation](./API_DOCUMENTATION.md)
- **Build Guide**: [Library Build](./LIBRARY_BUILD.md)
- **Development**: [Development Guide](./DEVELOPMENT.md)
- **Issues**: [GitHub Issues](https://github.com/fluidnotions/mindmesh/issues)

## License

MIT
