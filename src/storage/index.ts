/**
 * Storage Module Exports
 * Centralized exports for all storage-related components
 */

// Storage interface and types
export type {
  StorageBackend,
  Workspace,
  WorkspaceMetadata,
  StorageStrategy,
  StorageBackendInfo,
} from './StorageBackend.interface';

export { StorageError, StorageErrorType } from './StorageBackend.interface';

// Storage implementations
export { APIStorageBackend } from './APIStorageBackend';
