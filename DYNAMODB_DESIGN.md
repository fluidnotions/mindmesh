# DynamoDB Storage Backend Design

## Executive Summary

This document outlines two DynamoDB schema approaches for the Obsidian clone note-taking application with multi-tenant support, cost optimization, and hierarchical folder structure.

## Schema Option Comparison

### Option 1: Single Document Per User (Recommended for <1000 notes per user)
**Pros:**
- Single read/write per user session
- Minimal cost (1 RCU/WCU per user operation)
- Simple consistency model
- Easy backup/export per user
- No need for queries or GSIs

**Cons:**
- 400KB item size limit (DynamoDB max)
- Must read/write entire document on updates
- Not suitable for users with >1000 notes
- Concurrent edit conflicts more likely

**Cost:** ~$0.25/month per 1000 active users (1M RCU + 1M WCU)

### Option 2: Individual Items Per File (Recommended for >1000 notes per user)
**Pros:**
- Unlimited notes per user
- Granular updates (single file at a time)
- Better concurrency
- Can use DynamoDB Streams for real-time sync

**Cons:**
- Multiple reads required for user session
- Needs GSI for queries (additional cost)
- More complex pagination logic
- Higher base cost

**Cost:** ~$1.25/month per 1000 active users (5M RCU + 2M WCU + GSI)

## Recommended Approach: Hybrid Strategy

Use **Option 1** as default with automatic migration to **Option 2** when user exceeds threshold.

### Threshold Detection
- Document size > 300KB (75% of limit)
- File count > 500 files
- Auto-migrate to individual items model

## Schema Design: Option 1 (Single Document)

### Table: `notes-app-users`

| Attribute | Type | Description |
|-----------|------|-------------|
| PK | String | `USER#{userId}` |
| SK | String | `WORKSPACE#main` |
| userId | String | User identifier |
| workspace | Map | Complete workspace data |
| version | Number | Optimistic locking |
| lastModified | Number | Timestamp |
| itemCount | Number | Number of files (for migration trigger) |
| sizeBytes | Number | Approximate size (for migration trigger) |
| ttl | Number | Optional expiration for inactive users |

### Workspace Structure (JSON)
```json
{
  "userId": "user-123",
  "workspace": {
    "files": {
      "file-uuid-1": {
        "id": "file-uuid-1",
        "name": "JavaScript Basics",
        "content": "# JavaScript...",
        "path": "/Programming/JavaScript Basics",
        "created": 1698765432000,
        "modified": 1698765432000,
        "links": ["React", "TypeScript"],
        "parentFolderId": "folder-uuid-1"
      }
    },
    "folders": {
      "folder-uuid-1": {
        "id": "folder-uuid-1",
        "name": "Programming",
        "path": "/Programming",
        "parentId": null,
        "childFileIds": ["file-uuid-1"],
        "childFolderIds": []
      }
    },
    "metadata": {
      "fileCount": 42,
      "folderCount": 5,
      "lastAccessed": 1698765432000
    }
  },
  "version": 5,
  "lastModified": 1698765432000,
  "itemCount": 42,
  "sizeBytes": 156789
}
```

### Access Patterns - Option 1
1. **Load user workspace**: `GetItem(PK=USER#{userId}, SK=WORKSPACE#main)`
2. **Save workspace**: `PutItem` with `ConditionExpression: version = :expectedVersion`
3. **Check size for migration**: Compare `sizeBytes` and `itemCount` against thresholds

## Schema Design: Option 2 (Individual Items)

### Table: `notes-app-data`

**Primary Key:**
- PK: `USER#{userId}`
- SK: `FILE#{fileId}` or `FOLDER#{folderId}` or `METADATA#workspace`

**GSI: PathIndex**
- GSI_PK: `USER#{userId}`
- GSI_SK: `PATH#{/path/to/file}`

### Item Types

#### 1. User Metadata Item
```json
{
  "PK": "USER#user-123",
  "SK": "METADATA#workspace",
  "userId": "user-123",
  "fileCount": 42,
  "folderCount": 5,
  "lastModified": 1698765432000,
  "type": "METADATA"
}
```

#### 2. File Item
```json
{
  "PK": "USER#user-123",
  "SK": "FILE#file-uuid-1",
  "GSI_PK": "USER#user-123",
  "GSI_SK": "PATH#/Programming/JavaScript Basics",
  "type": "FILE",
  "fileId": "file-uuid-1",
  "name": "JavaScript Basics",
  "content": "# JavaScript...",
  "path": "/Programming/JavaScript Basics",
  "parentFolderId": "folder-uuid-1",
  "created": 1698765432000,
  "modified": 1698765432000,
  "links": ["React", "TypeScript"],
  "version": 3
}
```

#### 3. Folder Item
```json
{
  "PK": "USER#user-123",
  "SK": "FOLDER#folder-uuid-1",
  "GSI_PK": "USER#user-123",
  "GSI_SK": "PATH#/Programming",
  "type": "FOLDER",
  "folderId": "folder-uuid-1",
  "name": "Programming",
  "path": "/Programming",
  "parentId": null,
  "childFileIds": ["file-uuid-1"],
  "childFolderIds": [],
  "created": 1698765432000,
  "modified": 1698765432000
}
```

### Access Patterns - Option 2
1. **Load all user files**: `Query(PK=USER#{userId}, SK begins_with FILE#)`
2. **Load all folders**: `Query(PK=USER#{userId}, SK begins_with FOLDER#)`
3. **Get single file**: `GetItem(PK=USER#{userId}, SK=FILE#{fileId})`
4. **Find by path**: `Query(GSI: GSI_PK=USER#{userId}, GSI_SK=PATH#{path})`
5. **Update file**: `UpdateItem` with version check
6. **Delete file**: `DeleteItem` + update parent folder's `childFileIds`

## Hierarchical Folder Structure

Both options support the same logical structure:

```
/ (root)
├── Programming/
│   ├── JavaScript Basics.md
│   ├── React/
│   │   └── Hooks.md
│   └── TypeScript.md
└── Personal/
    └── Daily Notes.md
```

**Path Format:** `/Programming/React/Hooks`
- Enables efficient querying by path prefix
- Supports breadcrumb navigation
- Easy to reconstruct tree structure

## Cost Optimization Strategies

### 1. Lazy Loading
- Load folder structure first (small items)
- Load file content on-demand
- Cache in browser LocalStorage

### 2. Compression
- Compress large markdown content with gzip
- Store as Base64 in `contentCompressed` attribute
- Reduces storage costs by 60-80%

### 3. TTL for Inactive Users
- Set `ttl` attribute for auto-deletion
- Archive to S3 before deletion
- Free tier: 25GB storage, 25 WCU, 25 RCU

### 4. On-Demand Billing
- No provisioned capacity needed for <1000 users
- Pay only for actual requests
- Auto-scales to zero

### 5. DynamoDB Streams (Optional)
- Enable only for Option 2
- Real-time sync across devices
- Costs: $0.02 per 100K reads

## Migration Strategy

### Detecting Migration Need
```typescript
const MIGRATION_THRESHOLDS = {
  MAX_SIZE_BYTES: 300_000,    // 300KB (75% of 400KB limit)
  MAX_FILE_COUNT: 500,         // Files per user
};

function shouldMigrate(workspace: UserWorkspace): boolean {
  return (
    workspace.sizeBytes > MIGRATION_THRESHOLDS.MAX_SIZE_BYTES ||
    workspace.itemCount > MIGRATION_THRESHOLDS.MAX_FILE_COUNT
  );
}
```

### Migration Process
1. **Background job** detects threshold breach
2. Create individual items from single document
3. Verify migration success
4. Update user metadata to flag as migrated
5. Delete old single-document item
6. All future operations use Option 2 schema

## Cost Estimates (Monthly)

### Scenario: 10,000 users, avg 50 files each

**Option 1 (Single Document):**
- Storage: 10K users × 50KB avg = 500MB = $0.12
- Reads: 10K users × 30 sessions × 1 read = 300K RCU = $0.06
- Writes: 10K users × 30 saves × 1 write = 300K WCU = $0.15
- **Total: $0.33/month**

**Option 2 (Individual Items):**
- Storage: 500K items × 2KB avg = 1GB = $0.25
- Reads: 10K users × 30 sessions × 50 files = 15M RCU = $3.00
- Writes: 10K users × 30 saves × 1 file = 300K WCU = $0.15
- GSI: Same as base table = $3.00
- **Total: $6.40/month**

**Hybrid (95% Option 1, 5% Option 2):**
- 95% on Option 1: $0.31
- 5% on Option 2: $0.32
- **Total: $0.63/month for 10K users**

## Implementation Recommendations

### Phase 1: Start with Option 1
- Fastest to implement
- Lowest cost for MVP
- Sufficient for 95% of users

### Phase 2: Add Lazy Option 2 Migration
- Automatic migration when threshold hit
- Transparent to user
- No data loss

### Phase 3: Optimize with Compression
- Implement gzip compression
- Increases capacity 3-5x
- Delays migration need

### Phase 4: Add DynamoDB Streams (if needed)
- Real-time multi-device sync
- Collaborative editing support
- Only for Option 2 users

## Security Considerations

### Row-Level Security
- Every operation validates `userId` matches authenticated user
- Use AWS IAM roles with conditions:
  ```json
  "Condition": {
    "ForAllValues:StringEquals": {
      "dynamodb:LeadingKeys": ["USER#${cognito:sub}"]
    }
  }
  ```

### Encryption
- Enable encryption at rest (AWS managed keys)
- TLS for data in transit
- No additional cost

## API Design

The storage backend will implement this interface:

```typescript
interface NotesStorageBackend {
  // User workspace operations
  loadWorkspace(userId: string): Promise<Workspace>;
  saveWorkspace(userId: string, workspace: Workspace): Promise<void>;

  // File operations (granular, works with both schemas)
  getFile(userId: string, fileId: string): Promise<File>;
  createFile(userId: string, file: File): Promise<void>;
  updateFile(userId: string, file: File): Promise<void>;
  deleteFile(userId: string, fileId: string): Promise<void>;

  // Folder operations
  getFolder(userId: string, folderId: string): Promise<Folder>;
  createFolder(userId: string, folder: Folder): Promise<void>;
  updateFolder(userId: string, folder: Folder): Promise<void>;
  deleteFolder(userId: string, folderId: string): Promise<void>;

  // Query operations
  listFiles(userId: string, parentFolderId?: string): Promise<File[]>;
  listFolders(userId: string, parentFolderId?: string): Promise<Folder[]>;
  searchFiles(userId: string, query: string): Promise<File[]>;

  // Migration
  migrateToIndividualItems(userId: string): Promise<void>;
}
```

## Next Steps

1. Implement storage abstraction layer
2. Create DynamoDB client wrapper
3. Implement Option 1 (single document) first
4. Add migration detection logic
5. Implement Option 2 for migrated users
6. Add compression support
7. Performance testing and optimization
