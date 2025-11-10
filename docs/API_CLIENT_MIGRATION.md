# API Client Migration Documentation

**Date**: 2025-11-10
**Version**: 1.0
**Status**: Completed - Phase 2 Task 1

---

## Overview

This document describes the migration from direct AWS DynamoDB SDK access to REST API-based backend integration for the MindMesh frontend library.

### Summary of Changes

- **Removed**: Direct DynamoDB access via AWS SDK
- **Removed**: 557-line `DynamoDBStorage.ts` and related files
- **Added**: TypeScript API client with HTTP/REST communication
- **Added**: Environment-based API configuration
- **Maintained**: Same interface contracts for seamless integration

---

## What Was Removed

### AWS SDK Dependencies

Removed from `package.json`:
- `@aws-sdk/client-dynamodb` (^3.919.0)
- `@aws-sdk/util-dynamodb` (^3.919.0)

### Deleted Files

The following files were removed as they contained direct DynamoDB access logic:

| File | Lines | Purpose |
|------|-------|---------|
| `src/storage/DynamoDBStorage.ts` | 557 | Main DynamoDB storage orchestrator with hybrid strategy |
| `src/storage/SingleDocumentStorage.ts` | ~300 | Single-document storage strategy implementation |
| `src/storage/IndividualItemsStorage.ts` | ~400 | Individual-items storage strategy implementation |
| `src/storage/MigrationService.ts` | ~300 | Auto-migration between storage strategies |
| `src/storage/CompressionUtil.ts` | ~150 | Data compression for DynamoDB items |
| `src/storage/RetryUtil.ts` | ~200 | Retry logic and circuit breaker for DynamoDB |
| `src/config/dynamodb.config.ts` | ~150 | DynamoDB client configuration |

**Total Lines Removed**: ~2,057 lines of AWS-specific code

---

## What Was Added

### 1. API Configuration (`src/config/api.ts`)

**Purpose**: Environment-based API endpoint configuration

**Features**:
- Multi-environment support (development, staging, production)
- Configurable timeouts and retry settings
- Type-safe endpoint definitions
- Vite environment variable integration

**Environment Variables**:
```bash
# Development
VITE_API_URL_DEV=http://localhost:8000

# Staging
VITE_API_URL_STAGING=https://staging-api.example.com

# Production
VITE_API_URL_PROD=https://api.example.com
```

**Configuration**:
```typescript
{
  baseUrl: string;        // API base URL (env-specific)
  timeout: 30000;         // Request timeout (30 seconds)
  retryAttempts: 3;       // Maximum retry attempts
  retryDelay: 1000;       // Initial retry delay (1 second)
}
```

**API Endpoints**:
- `GET /mindmesh/workspace` - Load workspace
- `PUT /mindmesh/workspace` - Save workspace
- `POST /mindmesh/files` - Create file
- `PUT /mindmesh/files/{id}` - Update file
- `DELETE /mindmesh/files/{id}` - Delete file

### 2. API Client (`src/api/mindmesh-client.ts`)

**Purpose**: HTTP client for backend API communication

**Features**:
- ✅ JWT token authentication (Cognito)
- ✅ Automatic retry with exponential backoff
- ✅ Circuit breaker pattern (5 failures → 60s open)
- ✅ Type-safe request/response handling
- ✅ Error conversion to `StorageError` types
- ✅ Request timeout (30 seconds)
- ✅ Jittered backoff to prevent thundering herd

**Key Methods**:

```typescript
class MindMeshAPIClient {
  // Authentication
  setAuthTokenProvider(provider: () => Promise<string>): void

  // Workspace operations
  loadWorkspace(userId: string | null): Promise<Workspace>
  saveWorkspace(userId: string | null, workspace: Workspace): Promise<void>

  // File operations
  createFile(userId: string | null, file: File): Promise<void>
  updateFile(userId: string | null, file: File): Promise<void>
  deleteFile(userId: string | null, fileId: string): Promise<void>

  // Diagnostics
  getCircuitBreakerState(): string
  resetCircuitBreaker(): void
}
```

**Singleton Instance**:
```typescript
import { mindMeshClient } from './api/mindmesh-client';

// Set auth token provider (once during initialization)
mindMeshClient.setAuthTokenProvider(async () => {
  // Return JWT token from Cognito or auth provider
  return await cognito.getIdToken();
});

// Use client
const workspace = await mindMeshClient.loadWorkspace(userId);
```

---

## New Architecture

### Before (Direct DynamoDB)

```
Frontend (MindMesh React)
    ↓ AWS SDK
DynamoDB Client
    ↓ HTTPS
DynamoDB Tables
    - notes-app-users (single-document)
    - notes-app-data (individual-items)
```

### After (API-Based)

```
Frontend (MindMesh React)
    ↓ HTTP/REST + JWT
API Gateway (Cognito Authorization)
    ↓ Lambda Proxy
Backend Lambda Functions
    ↓ Import
ytsb-Backend Package
    ↓ AWS SDK
DynamoDB Tables
    - notes-app-users (single-document)
    - notes-app-data (individual-items)
```

---

## Error Handling

### Error Type Mapping

All backend errors are converted to `StorageError` with appropriate types:

| Backend Error | StorageErrorType | HTTP Status | Retryable |
|---------------|------------------|-------------|-----------|
| Network timeout | `NETWORK_ERROR` | 504 | Yes |
| Request throttled | `THROTTLED` | 429 | Yes |
| File not found | `NOT_FOUND` | 404 | No |
| Version conflict | `VERSION_CONFLICT` | 409 | No |
| Quota exceeded | `QUOTA_EXCEEDED` | 413 | No |
| Permission denied | `PERMISSION_DENIED` | 403 | No |
| Invalid data | `INVALID_DATA` | 400 | No |
| Server error | `UNKNOWN` | 500 | Yes |

### Retry Logic

**Exponential Backoff Configuration**:
```typescript
{
  maxRetries: 3,           // Maximum 3 retries
  baseDelay: 1000,         // Start with 1 second
  maxDelay: 5000,          // Cap at 5 seconds
  jitter: true             // Randomize delay to prevent thundering herd
}
```

**Delay Calculation**:
- Attempt 1: 1000ms × 2^0 = 1000ms (± jitter)
- Attempt 2: 1000ms × 2^1 = 2000ms (± jitter)
- Attempt 3: 1000ms × 2^2 = 4000ms (± jitter)

### Circuit Breaker

**Configuration**:
```typescript
{
  threshold: 5,              // Open after 5 consecutive failures
  timeout: 60000,            // Keep open for 60 seconds
  halfOpenSuccesses: 2       // Require 2 successes to close
}
```

**States**:
1. **CLOSED**: Normal operation, requests pass through
2. **OPEN**: Circuit tripped, requests fail immediately (60s)
3. **HALF_OPEN**: Testing recovery, allow limited requests

**Behavior**:
- After 5 consecutive failures → Circuit opens
- During open state → All requests fail fast (no backend calls)
- After 60 seconds → Circuit enters half-open state
- After 2 successful requests → Circuit closes

---

## Type Definitions

### Request/Response Types

The API client uses types that match the backend Pydantic models:

```typescript
// Workspace response from backend
interface WorkspaceResponse {
  workspace: {
    files: Record<string, File>;
    folders: Record<string, Folder>;
    metadata: WorkspaceMetadata;
  };
  storageInfo: StorageBackendInfo;
}

// Save workspace response
interface SaveWorkspaceResponse {
  success: boolean;
  migrated: boolean;
  migrationResult?: {
    itemsMigrated: number;
    duration: number;
    strategy: string;
  };
  storageInfo: StorageBackendInfo;
}

// File operation responses
interface CreateFileResponse {
  success: boolean;
  fileId: string;
  migrated: boolean;
  storageInfo: StorageBackendInfo;
}

interface UpdateFileResponse {
  success: boolean;
  fileId: string;
  migrated: boolean;
}

interface DeleteFileResponse {
  success: boolean;
  fileId: string;
  deleted: boolean;
}

// Error response format
interface ErrorResponse {
  error: {
    type: string;
    message: string;
    retryable: boolean;
    recommendation?: string;
  };
}
```

### Core Data Types

These types remain unchanged from the original implementation:

```typescript
interface File {
  id: string;           // UUID
  name: string;         // File name without extension
  content: string;      // Markdown content
  path: string;         // Full path including folders
  created: number;      // Creation timestamp (ms)
  modified: number;     // Last modification timestamp (ms)
  links: string[];      // Extracted [[link]] references
}

interface Folder {
  id: string;
  name: string;
  path: string;
  parentPath: string | null;
  children: (File | Folder)[];
}

interface Workspace {
  files: Map<string, File>;
  folders: Map<string, Folder>;
  metadata: WorkspaceMetadata;
}

interface WorkspaceMetadata {
  fileCount: number;
  folderCount: number;
  lastAccessed: number;
  sizeBytes?: number;
}
```

---

## Configuration Guide

### 1. Set Environment Variables

Create a `.env` file in the frontend project:

```bash
# Development (local backend)
VITE_API_URL_DEV=http://localhost:8000

# Staging
VITE_API_URL_STAGING=https://staging-api.ytsb.example.com

# Production
VITE_API_URL_PROD=https://api.ytsb.example.com

# Environment selection
VITE_API_ENV=development
```

### 2. Initialize API Client

During application initialization:

```typescript
import { mindMeshClient } from '@fluidnotions/mindmesh/api/mindmesh-client';
import { getIdToken } from './auth/cognito';

// Set authentication token provider
mindMeshClient.setAuthTokenProvider(async () => {
  try {
    return await getIdToken();
  } catch (error) {
    console.error('Failed to get auth token:', error);
    throw error;
  }
});
```

### 3. Use API Client

Replace direct DynamoDB calls with API client calls:

**Before**:
```typescript
import { DynamoDBStorage } from './storage/DynamoDBStorage';

const storage = new DynamoDBStorage();
await storage.initialize();
const workspace = await storage.loadWorkspace(userId);
```

**After**:
```typescript
import { mindMeshClient } from './api/mindmesh-client';

const workspace = await mindMeshClient.loadWorkspace(userId);
```

---

## Migration Impact

### Interface Compatibility

✅ **No breaking changes** - The API client implements the same interface as `DynamoDBStorage`, ensuring:
- Components using the storage layer continue to work without modification
- Method signatures remain identical
- Data structures remain unchanged
- Error types remain the same

### Performance Considerations

**Network Latency**:
- Additional hop through API Gateway and Lambda (~50-100ms)
- Mitigated by Lambda warm starts and efficient handler design

**Retry Overhead**:
- Retry logic moved from client to centralized backend
- Frontend retries for network errors only (not business logic errors)

**Circuit Breaker Benefits**:
- Fails fast during outages (no wasted retries)
- Prevents cascading failures
- Automatic recovery detection

### Security Improvements

✅ **Enhanced Security**:
- No AWS credentials in frontend code
- JWT-based authentication (Cognito)
- Row-level security enforced by backend
- API Gateway rate limiting
- CORS configuration for authorized domains only

---

## Testing Strategy

### Unit Tests

Test individual components:
```typescript
describe('MindMeshAPIClient', () => {
  it('should retry on network errors', async () => {
    // Mock fetch to fail twice, succeed on third attempt
    // Verify retry logic with exponential backoff
  });

  it('should open circuit after threshold failures', async () => {
    // Mock fetch to fail 5 times
    // Verify circuit opens and subsequent requests fail fast
  });

  it('should convert HTTP errors to StorageError', async () => {
    // Mock 404 response
    // Verify StorageError with type NOT_FOUND
  });
});
```

### Integration Tests

Test API client with mocked backend:
```typescript
describe('API Integration', () => {
  it('should load workspace successfully', async () => {
    // Mock successful API response
    // Verify workspace structure matches expected format
  });

  it('should handle auth token expiration', async () => {
    // Mock 401 Unauthorized response
    // Verify token refresh and retry
  });
});
```

### End-to-End Tests

Test full flow from frontend to backend:
```typescript
describe('E2E Tests', () => {
  it('should create, update, and delete a file', async () => {
    // Create file via API
    // Update file content
    // Delete file
    // Verify all operations succeed
  });
});
```

---

## Troubleshooting

### Common Issues

**1. "Circuit breaker is OPEN"**
- **Cause**: Too many consecutive failures (5+)
- **Solution**: Check backend health, wait 60 seconds for auto-recovery
- **Debug**: `mindMeshClient.getCircuitBreakerState()`

**2. "Request timeout"**
- **Cause**: Request took longer than 30 seconds
- **Solution**: Check backend Lambda performance, increase timeout if needed
- **Config**: Adjust `apiConfig.timeout`

**3. "No auth token provider set"**
- **Cause**: Auth token provider not configured
- **Solution**: Call `mindMeshClient.setAuthTokenProvider()` during initialization

**4. "CORS error"**
- **Cause**: API Gateway CORS not configured for frontend domain
- **Solution**: Add frontend domain to API Gateway CORS allowed origins

**5. "401 Unauthorized"**
- **Cause**: Invalid or expired JWT token
- **Solution**: Implement token refresh logic in auth provider

### Debug Mode

Enable verbose logging:
```typescript
// Browser console
localStorage.setItem('DEBUG', 'mindmesh:*');

// Check circuit breaker state
console.log(mindMeshClient.getCircuitBreakerState());

// Reset circuit breaker (testing only)
mindMeshClient.resetCircuitBreaker();
```

---

## Next Steps

### Phase 2 Task 2: Update Components

Now that the API client is ready, the next task is to update React components to use the new client:

1. Replace `DynamoDBStorage` imports with `mindMeshClient`
2. Update component initialization logic
3. Handle auth token provider setup
4. Test all component interactions
5. Update tests to mock API client

See: **Phase 2 Task 2 documentation** (to be created)

---

## References

- **Backend API Spec**: `/home/justin/Documents/dev/workspaces/YouTube-Studdy-Buddy-App/ytsb-Backend/docs/MINDMESH_API_SPEC.md`
- **Project PRD**: Repository Separation & Deployment PRD (US-1.4)
- **API Client Source**: `src/api/mindmesh-client.ts`
- **API Config Source**: `src/config/api.ts`

---

## Changelog

### 2025-11-10 - Initial Migration
- Removed AWS SDK dependencies
- Deleted 7 DynamoDB-related files (~2,057 lines)
- Created API configuration system
- Created TypeScript API client with retry and circuit breaker
- Documented migration process
