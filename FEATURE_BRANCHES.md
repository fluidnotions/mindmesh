# Feature Branches and Worktrees

This document tracks the parallel development efforts across multiple feature branches.

## Active Branches

### 1. `feature/folders` - Hierarchical Folder Structure
**Location:** `../obclone-worktrees/feature-folders`

**Objective:** Implement true hierarchical folder navigation with tree UI

**Tasks:**
- [ ] Update FileExplorer component to render tree structure
- [ ] Implement folder expand/collapse functionality
- [ ] Add drag-and-drop file/folder organization
- [ ] Update file paths when moving between folders
- [ ] Add breadcrumb navigation
- [ ] Update link resolution to work with paths
- [ ] Add folder creation UI
- [ ] Implement recursive folder deletion

**Key Files to Modify:**
- `src/components/FileExplorer/FileExplorer.tsx`
- `src/context/AppContext.tsx` (use folder state)
- `src/services/fileService.ts` (path management)
- `src/models/types.ts` (enhance Folder interface)

---

### 2. `feature/api-facade` - Public Integration API
**Location:** `../obclone-worktrees/feature-api-facade`

**Objective:** Create a clean facade API for embedding this app into other applications

**Tasks:**
- [ ] Design public API interface
- [ ] Create NotesAppFacade class
- [ ] Expose all user operations programmatically
- [ ] Add event listeners for state changes
- [ ] Support headless operation (without UI)
- [ ] Add mounting/unmounting to DOM elements
- [ ] Document API with TypeScript definitions
- [ ] Create usage examples
- [ ] Add configuration options

**API Surface:**
```typescript
class NotesAppFacade {
  // Lifecycle
  mount(element: HTMLElement, config?: Config): void;
  unmount(): void;

  // File operations
  createFile(name: string, path: string, content?: string): Promise<File>;
  updateFile(fileId: string, content: string): Promise<void>;
  deleteFile(fileId: string): Promise<void>;
  getFile(fileId: string): File | undefined;

  // Folder operations
  createFolder(name: string, path: string): Promise<Folder>;
  deleteFolder(folderId: string): Promise<void>;

  // Navigation
  openFile(fileId: string): void;
  getCurrentFile(): File | undefined;

  // Events
  on(event: string, handler: Function): void;
  off(event: string, handler: Function): void;

  // State access
  getWorkspace(): Workspace;
  import(data: WorkspaceJSON): Promise<void>;
  export(): WorkspaceJSON;
}
```

**Key Files to Create:**
- `src/api/NotesAppFacade.ts`
- `src/api/types.ts`
- `src/api/events.ts`
- `examples/embedding.html`
- `API_DOCUMENTATION.md`

---

### 3. `feature/dynamodb-storage` - DynamoDB Backend
**Location:** `../obclone-worktrees/feature-dynamodb-storage`

**Objective:** Replace LocalStorage with DynamoDB for multi-user cloud storage

**Design:** See `DYNAMODB_DESIGN.md` in this branch

**Key Decision:** Hybrid approach
- Default: Single document per user (cost-effective, <$0.01/user/month)
- Auto-migrate to individual items when user exceeds 500 files or 300KB
- Supports unlimited notes per user after migration

**Tasks:**
- [ ] Create storage abstraction interface
- [ ] Implement DynamoDB client wrapper
- [ ] Implement single-document storage (Option 1)
- [ ] Implement individual-items storage (Option 2)
- [ ] Add automatic migration logic
- [ ] Add compression support (gzip)
- [ ] Implement AWS IAM security policies
- [ ] Add error handling and retry logic
- [ ] Create migration testing suite
- [ ] Add monitoring and alerting

**Schema Summary:**
```
Option 1: PK=USER#{userId}, SK=WORKSPACE#main
  → stores entire workspace as single JSON document

Option 2: PK=USER#{userId}, SK=FILE#{fileId} | FOLDER#{folderId}
  → stores each file/folder as separate item
  → GSI on path for efficient queries
```

**Key Files to Create:**
- `src/storage/StorageBackend.interface.ts`
- `src/storage/DynamoDBStorage.ts`
- `src/storage/SingleDocumentStorage.ts`
- `src/storage/IndividualItemsStorage.ts`
- `src/storage/MigrationService.ts`
- `src/storage/CompressionUtil.ts`
- `src/config/dynamodb.config.ts`

---

## Branch Management

### Checking Out Branches
Each branch has its own worktree directory:
```bash
cd ../obclone-worktrees/feature-folders
cd ../obclone-worktrees/feature-api-facade
cd ../obclone-worktrees/feature-dynamodb-storage
```

### List All Worktrees
```bash
git worktree list
```

### Merging Features Back to Main
```bash
# From main branch
git checkout main
git merge feature/folders
git merge feature/api-facade
git merge feature/dynamodb-storage
```

### Removing Worktrees (when done)
```bash
git worktree remove ../obclone-worktrees/feature-folders
git branch -d feature/folders
```

## Development Priority

1. **feature/api-facade** - Critical for integration, blocks external usage
2. **feature/folders** - Core UX improvement, highly visible
3. **feature/dynamodb-storage** - Infrastructure for production deployment

## Integration Strategy

All three features are designed to work together:

```
Parent Application
    ↓ (uses)
NotesAppFacade API
    ↓ (controls)
React Components (with folders UI)
    ↓ (uses)
Storage Backend Interface
    ↓ (implements)
DynamoDB Storage (or LocalStorage)
```

## Cost Projection

**DynamoDB costs for 10,000 active users:**
- Hybrid approach: **$0.63/month** (~$0.00006 per user)
- Storage: $0.12, Reads: $0.06, Writes: $0.30
- 95% users stay on single-document model
- 5% heavy users auto-migrate to individual items

This is 10x cheaper than individual items for all users ($6.40/month).
