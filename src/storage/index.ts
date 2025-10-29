/**
 * Storage Module Exports
 * Centralized exports for all storage-related components
 */

// Main storage backend
export { DynamoDBStorage } from './DynamoDBStorage';

// Storage interface and types
export type {
  StorageBackend,
  Workspace,
  WorkspaceMetadata,
  StorageStrategy,
  StorageBackendInfo,
} from './StorageBackend.interface';

export { StorageError, StorageErrorType } from './StorageBackend.interface';

// Individual storage strategies (for advanced usage)
export { SingleDocumentStorage } from './SingleDocumentStorage';
export { IndividualItemsStorage } from './IndividualItemsStorage';

// Migration service
export { MigrationService } from './MigrationService';
export type { MigrationStatus, MigrationResult } from './MigrationService';

// Utilities
export {
  compress,
  decompress,
  shouldCompress,
  smartCompress,
  smartDecompress,
  getByteSize,
  testCompression,
} from './CompressionUtil';

export {
  retryWithBackoff,
  withRetry,
  isRetryableError,
  convertAWSError,
  CircuitBreaker,
} from './RetryUtil';
