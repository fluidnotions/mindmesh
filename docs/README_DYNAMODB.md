# DynamoDB Storage Backend

This is the implementation of the DynamoDB storage backend for the Obsidian Clone application, based on the hybrid storage strategy outlined in `DYNAMODB_DESIGN.md`.

## Overview

The DynamoDB storage backend uses a **hybrid approach**:

1. **Single-Document Strategy (Option 1)** - Default for new users
   - Stores entire workspace in one DynamoDB item
   - Optimized for <500 files and <300KB total size
   - Lowest cost: 1 read + 1 write per session
   - Perfect for 95% of users

2. **Individual-Items Strategy (Option 2)** - Automatic migration
   - Each file and folder is a separate DynamoDB item
   - Used when user exceeds 500 files or 300KB
   - Supports unlimited files with granular updates
   - Better concurrency for large workspaces

## Key Features

- ✅ **Automatic Migration**: Seamlessly migrates from Option 1 to Option 2 when thresholds are reached
- ✅ **Compression**: Automatic gzip compression for large content (60-80% reduction)
- ✅ **Retry Logic**: Exponential backoff with jitter for transient errors
- ✅ **Circuit Breaker**: Prevents cascading failures
- ✅ **Optimistic Locking**: Prevents data loss from concurrent edits
- ✅ **Error Handling**: Comprehensive error types and recovery
- ✅ **Anonymous Users**: Full support for unauthenticated usage

## Architecture

```
src/storage/
├── StorageBackend.interface.ts    # Storage abstraction interface
├── DynamoDBStorage.ts              # Main orchestrator (hybrid strategy)
├── SingleDocumentStorage.ts        # Option 1 implementation
├── IndividualItemsStorage.ts       # Option 2 implementation
├── MigrationService.ts             # Auto-migration logic
├── CompressionUtil.ts              # Gzip compression utilities
├── RetryUtil.ts                    # Retry and circuit breaker
└── index.ts                        # Module exports

src/config/
└── dynamodb.config.ts              # Configuration and schemas
```

## Installation

Dependencies are already installed:

```bash
npm install @aws-sdk/client-dynamodb @aws-sdk/util-dynamodb pako @types/pako
```

## Configuration

Set environment variables:

```bash
# AWS Configuration
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key

# DynamoDB Tables (optional, defaults provided)
export DYNAMODB_TABLE_USERS=notes-app-users
export DYNAMODB_TABLE_DATA=notes-app-data

# For local development with DynamoDB Local
export DYNAMODB_ENDPOINT=http://localhost:8000
```

## Usage

### Basic Usage

```typescript
import { DynamoDBStorage } from './storage';

// Create storage instance
const storage = new DynamoDBStorage();

// Initialize connection
await storage.initialize();

// Load workspace
const workspace = await storage.loadWorkspace('user-123');

// Save workspace
await storage.saveWorkspace('user-123', workspace);

// Cleanup
await storage.destroy();
```

### File Operations

```typescript
// Create a file
const newFile: File = {
  id: 'file-uuid-1',
  name: 'My Note',
  content: '# Hello World\nThis is my note',
  path: '/Notes/My Note',
  created: Date.now(),
  modified: Date.now(),
  links: [],
};

await storage.createFile('user-123', newFile);

// Get a file
const file = await storage.getFile('user-123', 'file-uuid-1');

// Update a file
file.content = '# Updated content';
file.modified = Date.now();
await storage.updateFile('user-123', file);

// Delete a file
await storage.deleteFile('user-123', 'file-uuid-1');
```

### Folder Operations

```typescript
// Create a folder
const newFolder: Folder = {
  id: 'folder-uuid-1',
  name: 'Programming',
  path: '/Programming',
  children: [],
};

await storage.createFolder('user-123', newFolder);

// Get a folder
const folder = await storage.getFolder('user-123', 'folder-uuid-1');

// List all folders
const allFolders = await storage.listFolders('user-123');
```

### Search

```typescript
// Search files by query
const results = await storage.searchFiles('user-123', 'react hooks');
```

### Storage Info

```typescript
// Get storage backend info
const info = await storage.getStorageInfo('user-123');
console.log(`Strategy: ${info.strategy}`);
console.log(`Items: ${info.itemCount}`);
console.log(`Size: ${info.sizeBytes} bytes`);
console.log(`Migrated: ${info.isMigrated}`);
```

### Anonymous Users

```typescript
// For anonymous/unauthenticated users, pass null as userId
await storage.loadWorkspace(null);
await storage.saveWorkspace(null, workspace);
```

## Migration

Migration happens **automatically** when thresholds are exceeded:

- **File count threshold**: 500 files
- **Size threshold**: 300KB

### Manual Migration Check

```typescript
import { MigrationService } from './storage';

const migrationService = new MigrationService(client);

// Check if migration is needed
const needsMigration = await migrationService.needsMigration('user-123');

// Get detailed recommendation
const recommendation = await migrationService.getMigrationRecommendation('user-123');
console.log(recommendation.reason);

// Perform migration manually
const result = await migrationService.migrateToIndividualItems('user-123');
if (result.success) {
  console.log(`Migrated ${result.itemsMigrated} items in ${result.duration}ms`);
}

// Estimate migration time
const estimate = await migrationService.estimateMigrationTime('user-123');
console.log(`Estimated time: ${estimate.estimatedSeconds} seconds`);

// Dry run (validation only)
const dryRun = await migrationService.dryRunMigration('user-123');
if (!dryRun.canMigrate) {
  console.log('Migration issues:', dryRun.issues);
}
```

## Error Handling

The storage backend provides comprehensive error handling:

```typescript
import { StorageError, StorageErrorType } from './storage';

try {
  await storage.getFile('user-123', 'non-existent-file');
} catch (error) {
  if (error instanceof StorageError) {
    switch (error.type) {
      case StorageErrorType.NOT_FOUND:
        console.log('File not found');
        break;
      case StorageErrorType.THROTTLED:
        console.log('Request throttled, retrying...');
        break;
      case StorageErrorType.NETWORK_ERROR:
        console.log('Network error:', error.message);
        break;
      case StorageErrorType.QUOTA_EXCEEDED:
        console.log('Storage quota exceeded');
        break;
      case StorageErrorType.VERSION_CONFLICT:
        console.log('Concurrent edit detected, reload and retry');
        break;
      default:
        console.error('Storage error:', error);
    }
  }
}
```

## Compression

Content is automatically compressed when it exceeds 1KB:

```typescript
import { smartCompress, smartDecompress, testCompression } from './storage';

// Test compression effectiveness
const testResult = testCompression('# My large markdown content...');
console.log(`Compression saved ${testResult.savedPercent.toFixed(1)}%`);

// Manual compression
const compressed = smartCompress('content');
console.log(`Compressed: ${compressed.isCompressed}`);
console.log(`Size reduction: ${compressed.originalSize} -> ${compressed.finalSize}`);

// Manual decompression
const original = smartDecompress(compressed.content, compressed.isCompressed);
```

## Retry Logic

Built-in retry with exponential backoff:

```typescript
import { retryWithBackoff, withRetry } from './storage';

// Retry a function
const result = await retryWithBackoff(
  async () => {
    return await someUnreliableOperation();
  },
  {
    maxRetries: 3,
    baseDelayMs: 100,
    maxDelayMs: 5000,
  }
);

// Wrap a function with retry logic
const reliableFunction = withRetry(unreliableFunction, {
  maxRetries: 5,
});
```

## DynamoDB Table Setup

### Option 1 Table: `notes-app-users`

```bash
aws dynamodb create-table \
  --table-name notes-app-users \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
    AttributeName=SK,AttributeType=S \
  --key-schema \
    AttributeName=PK,KeyType=HASH \
    AttributeName=SK,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --tags Key=Application,Value=obsidian-clone
```

### Option 2 Table: `notes-app-data`

```bash
aws dynamodb create-table \
  --table-name notes-app-data \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
    AttributeName=SK,AttributeType=S \
    AttributeName=GSI_PK,AttributeType=S \
    AttributeName=GSI_SK,AttributeType=S \
  --key-schema \
    AttributeName=PK,KeyType=HASH \
    AttributeName=SK,KeyType=RANGE \
  --global-secondary-indexes \
    IndexName=PathIndex,KeySchema=[{AttributeName=GSI_PK,KeyType=HASH},{AttributeName=GSI_SK,KeyType=RANGE}],Projection={ProjectionType=ALL} \
  --billing-mode PAY_PER_REQUEST \
  --tags Key=Application,Value=obsidian-clone
```

## Local Development

Use DynamoDB Local for development:

```bash
# Download and run DynamoDB Local
docker run -p 8000:8000 amazon/dynamodb-local

# Set endpoint in environment
export DYNAMODB_ENDPOINT=http://localhost:8000

# Create tables locally
aws dynamodb create-table ... --endpoint-url http://localhost:8000
```

## Cost Estimates

### Small Users (95%)
- **Strategy**: Single-document
- **Storage**: ~50KB per user
- **Cost**: ~$0.03 per 1000 users/month

### Large Users (5%)
- **Strategy**: Individual-items
- **Storage**: ~2MB per user
- **Cost**: ~$0.60 per 1000 users/month

### Total for 10,000 users
- **Combined cost**: ~$0.63/month
- **Storage**: ~100MB
- **Very cost-effective compared to alternatives!**

## Monitoring

Monitor storage usage:

```typescript
// Get storage info for all users
const users = ['user-1', 'user-2', 'user-3'];

for (const userId of users) {
  const info = await storage.getStorageInfo(userId);

  console.log(`User: ${userId}`);
  console.log(`  Strategy: ${info.strategy}`);
  console.log(`  Items: ${info.itemCount}`);
  console.log(`  Size: ${(info.sizeBytes / 1024).toFixed(2)}KB`);

  if (info.sizeBytes > 250_000) {
    console.log(`  ⚠️  Approaching migration threshold`);
  }
}
```

## Best Practices

1. **Initialize Once**: Create one `DynamoDBStorage` instance and reuse it
2. **Handle Errors**: Always wrap storage operations in try-catch
3. **Use Anonymous Mode**: For demo/guest users, pass `null` as userId
4. **Monitor Size**: Check storage info periodically to anticipate migrations
5. **Test Locally**: Use DynamoDB Local during development
6. **Set TTL**: Enable TTL for inactive users to reduce costs
7. **Batch Operations**: Use `saveWorkspace` for bulk updates instead of individual file operations

## Troubleshooting

### Connection Issues

```typescript
try {
  await storage.initialize();
} catch (error) {
  console.error('Failed to connect to DynamoDB:', error);
  // Check AWS credentials and region
}
```

### Migration Failures

```typescript
// Run dry-run first
const dryRun = await migrationService.dryRunMigration('user-123');
if (!dryRun.canMigrate) {
  console.error('Migration validation failed:', dryRun.issues);
}
```

### Performance Issues

```typescript
// Check circuit breaker state
console.log('Circuit breaker state:', storage['circuitBreaker'].getState());

// Reset if needed
storage['circuitBreaker'].reset();
```

## Integration with Existing App

To integrate with the existing LocalStorage-based app:

```typescript
// In your App.tsx or storage service wrapper
import { DynamoDBStorage } from './storage';
import { loadFiles, saveFiles } from './services/storageService';

// Create storage backend
const dynamoStorage = new DynamoDBStorage();
await dynamoStorage.initialize();

// Migrate from LocalStorage to DynamoDB
const localFiles = loadFiles();
const localFolders = loadFolders();

const workspace: Workspace = {
  files: localFiles,
  folders: localFolders,
  metadata: {
    fileCount: localFiles.size,
    folderCount: localFolders.size,
    lastAccessed: Date.now(),
  },
};

await dynamoStorage.saveWorkspace('user-123', workspace);

// From now on, use DynamoDB
const currentWorkspace = await dynamoStorage.loadWorkspace('user-123');
```

## Further Reading

- [DYNAMODB_DESIGN.md](./DYNAMODB_DESIGN.md) - Detailed design document
- [AWS DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)

## Support

For issues or questions:
1. Check the [DYNAMODB_DESIGN.md](./DYNAMODB_DESIGN.md) for architecture details
2. Review error messages and types in `StorageBackend.interface.ts`
3. Enable debug logging by setting `DEBUG=true` in environment
4. Check AWS CloudWatch logs for DynamoDB operations
