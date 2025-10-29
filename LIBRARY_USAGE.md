# MindMesh Library Usage Guide

MindMesh can be used both as a standalone application and as an embeddable library in your React applications.

## Installation

### From GitHub Packages (Private)

```bash
# Configure npm to use GitHub Packages
echo "@fluidnotions:registry=https://npm.pkg.github.com" >> .npmrc
echo "//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN" >> .npmrc

# Install the package
npm install @fluidnotions/mindmesh
```

### From Local Development

```bash
# In the mindmesh directory
npm run build:lib
npm link

# In your project
npm link @fluidnotions/mindmesh
```

## Usage Modes

### Mode 1: Facade API (Programmatic Control)

Use the facade API for headless integration and programmatic control.

```typescript
import { NotesAppFacade, NotesAppEvent } from '@fluidnotions/mindmesh';
import '@fluidnotions/mindmesh/css';

// Create instance
const notesApp = new NotesAppFacade();

// Mount to DOM
const container = document.getElementById('notes-app');
notesApp.mount(container);

// Programmatic file creation
const file = await notesApp.createFile('My Note', '/My Note', '# Hello World');

// Listen to events
notesApp.on(NotesAppEvent.FILE_CREATED, (event) => {
  console.log('File created:', event.file);
});

notesApp.on(NotesAppEvent.FILE_UPDATED, (event) => {
  console.log('File updated:', event.file);
});

// Get workspace data
const workspace = notesApp.getWorkspace();
console.log('Files:', workspace.files);

// Export/Import
const exportedData = notesApp.exportWorkspace();
notesApp.importWorkspace(exportedData);

// Unmount when done
notesApp.unmount();
```

### Mode 2: React Component Integration

Embed the app as React components in your application.

```typescript
import { App, AppProvider, useApp } from '@fluidnotions/mindmesh';
import '@fluidnotions/mindmesh/css';

function MyApp() {
  return (
    <AppProvider>
      <App />
    </AppProvider>
  );
}

// Or use individual components
import { FileExplorer, Editor, GraphView } from '@fluidnotions/mindmesh';

function CustomLayout() {
  return (
    <AppProvider>
      <div style={{ display: 'flex' }}>
        <FileExplorer />
        <Editor />
        <GraphView />
      </div>
    </AppProvider>
  );
}
```

### Mode 3: Custom Storage Backend

Provide your own storage implementation.

```typescript
import { NotesAppFacade, StorageBackend, WorkspaceData } from '@fluidnotions/mindmesh';

class MyCustomStorage implements StorageBackend {
  async loadWorkspace(userId: string): Promise<WorkspaceData> {
    // Your loading logic
    const response = await fetch(`/api/workspace/${userId}`);
    return response.json();
  }

  async saveWorkspace(userId: string, data: WorkspaceData): Promise<void> {
    // Your saving logic
    await fetch(`/api/workspace/${userId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

const notesApp = new NotesAppFacade({
  storage: new MyCustomStorage(),
  userId: 'user-123',
});
```

### Mode 4: DynamoDB Backend

Use the built-in DynamoDB storage.

```typescript
import { NotesAppFacade, DynamoDBStorage } from '@fluidnotions/mindmesh';

const storage = new DynamoDBStorage({
  region: 'us-east-1',
  tableName: 'notes-workspace',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const notesApp = new NotesAppFacade({
  storage,
  userId: 'user-123',
});
```

## Advanced Usage

### Keyword Index

Access and manipulate the keyword index:

```typescript
import { buildKeywordIndex } from '@fluidnotions/mindmesh';

const files = new Map(/* your files */);
const index = await buildKeywordIndex(files);

// Find files by keyword
const filesWithKeyword = index.keywordToFiles.get('JavaScript');
console.log('Files containing "JavaScript":', filesWithKeyword);
```

### Graph Data

Build and query graph data:

```typescript
import { buildGraphData, getConnectedSubgraph } from '@fluidnotions/mindmesh';

const files = new Map(/* your files */);
const keywordIndex = await buildKeywordIndex(files);

// Build full graph
const graphData = buildGraphData(files, keywordIndex);

// Get subgraph around a specific node
const subgraph = getConnectedSubgraph(graphData, fileId, 2); // 2 degrees
```

### Link Parsing

Parse and extract wiki links:

```typescript
import { extractLinks, parseLinkReference } from '@fluidnotions/mindmesh';

const content = `
# My Note
Links to [[Other Note]] and [[/Path/To/Note]]
`;

// Extract all links
const links = extractLinks(content); // ['Other Note', '/Path/To/Note']

// Parse link reference
const parsed = parseLinkReference('/Path/To/Note');
console.log(parsed);
// { name: 'Note', fullPath: '/Path/To/Note', isPath: true }
```

### Internationalization

Configure language:

```typescript
import { i18n } from '@fluidnotions/mindmesh';

// Change language
i18n.changeLanguage('es'); // Spanish
i18n.changeLanguage('fr'); // French

// Add custom language
i18n.addResourceBundle('de', 'translation', {
  'fileExplorer.title': 'Datei-Explorer',
  // ... more translations
});
```

## TypeScript Support

Full TypeScript definitions are included:

```typescript
import type {
  File,
  Folder,
  EditorViewMode,
  GraphData,
  GraphNode,
  GraphLink,
  NotesAppConfig,
  WorkspaceData,
  NotesAppEventMap,
  KeywordIndex,
  StorageBackend,
} from '@fluidnotions/mindmesh';
```

## Event System

Listen to all application events:

```typescript
// File events
notesApp.on(NotesAppEvent.FILE_CREATED, handler);
notesApp.on(NotesAppEvent.FILE_UPDATED, handler);
notesApp.on(NotesAppEvent.FILE_DELETED, handler);
notesApp.on(NotesAppEvent.FILE_RENAMED, handler);
notesApp.on(NotesAppEvent.FILE_SELECTED, handler);

// Folder events
notesApp.on(NotesAppEvent.FOLDER_CREATED, handler);
notesApp.on(NotesAppEvent.FOLDER_DELETED, handler);

// View events
notesApp.on(NotesAppEvent.VIEW_MODE_CHANGED, handler);
notesApp.on(NotesAppEvent.GRAPH_VIEW_TOGGLED, handler);

// Workspace events
notesApp.on(NotesAppEvent.WORKSPACE_LOADED, handler);
notesApp.on(NotesAppEvent.WORKSPACE_EXPORTED, handler);
notesApp.on(NotesAppEvent.WORKSPACE_IMPORTED, handler);

// Unsubscribe
const unsubscribe = notesApp.on(NotesAppEvent.FILE_CREATED, handler);
unsubscribe(); // Stop listening
```

## Styling

### Default Styles

Import the default stylesheet:

```typescript
import '@fluidnotions/mindmesh/css';
```

### Custom Styling

Override CSS variables:

```css
:root {
  /* Colors */
  --mindmesh-bg-primary: #1e1e1e;
  --mindmesh-bg-secondary: #252526;
  --mindmesh-text-primary: #e0e0e0;
  --mindmesh-text-secondary: #888;
  --mindmesh-accent: #007acc;

  /* Spacing */
  --mindmesh-spacing-sm: 0.5rem;
  --mindmesh-spacing-md: 1rem;
  --mindmesh-spacing-lg: 1.5rem;

  /* Font */
  --mindmesh-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --mindmesh-font-size: 14px;
}
```

## Build Outputs

The library provides multiple output formats:

- **ESM**: `dist/mindmesh.es.js` (for modern bundlers)
- **UMD**: `dist/mindmesh.umd.js` (for legacy/browser)
- **Types**: `dist/index.d.ts` (TypeScript definitions)
- **CSS**: `dist/mindmesh.css` (styles)

## Bundle Size

- Core library: ~150KB (minified)
- With dependencies: ~385KB (gzipped: ~122KB)

Tree-shaking supported for ESM imports.

## Browser Support

- Chrome/Edge: Latest 2 versions
- Firefox: Latest 2 versions
- Safari: 14+
- React: 18+
- TypeScript: 5.0+

## License

MIT
