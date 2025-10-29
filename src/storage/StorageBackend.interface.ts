/**
 * Storage Backend Interface
 * Defines the contract for storage implementations (LocalStorage, DynamoDB, etc.)
 * Supports both workspace-level and granular file/folder operations
 */

import { File, Folder } from '../models/types';

/**
 * Workspace structure containing all user data
 */
export interface Workspace {
  files: Map<string, File>;
  folders: Map<string, Folder>;
  metadata: WorkspaceMetadata;
}

/**
 * Metadata about the workspace
 */
export interface WorkspaceMetadata {
  fileCount: number;
  folderCount: number;
  lastAccessed: number;
  sizeBytes?: number;
}

/**
 * Storage strategy type (for DynamoDB hybrid approach)
 */
export type StorageStrategy = 'single-document' | 'individual-items';

/**
 * Storage backend metadata
 */
export interface StorageBackendInfo {
  strategy: StorageStrategy;
  isMigrated: boolean;
  itemCount: number;
  sizeBytes: number;
}

/**
 * Main storage backend interface
 * All storage implementations must implement this interface
 */
export interface StorageBackend {
  /**
   * Initialize the storage backend (setup connections, verify credentials, etc.)
   */
  initialize(): Promise<void>;

  /**
   * Load entire workspace for a user
   * @param userId User identifier (can be null for anonymous users)
   */
  loadWorkspace(userId: string | null): Promise<Workspace>;

  /**
   * Save entire workspace for a user
   * @param userId User identifier (can be null for anonymous users)
   * @param workspace Complete workspace data
   */
  saveWorkspace(userId: string | null, workspace: Workspace): Promise<void>;

  /**
   * Get a single file by ID
   * @param userId User identifier
   * @param fileId File identifier
   */
  getFile(userId: string | null, fileId: string): Promise<File | null>;

  /**
   * Create a new file
   * @param userId User identifier
   * @param file File to create
   */
  createFile(userId: string | null, file: File): Promise<void>;

  /**
   * Update an existing file
   * @param userId User identifier
   * @param file File with updated data
   */
  updateFile(userId: string | null, file: File): Promise<void>;

  /**
   * Delete a file
   * @param userId User identifier
   * @param fileId File identifier
   */
  deleteFile(userId: string | null, fileId: string): Promise<void>;

  /**
   * Get a single folder by ID
   * @param userId User identifier
   * @param folderId Folder identifier
   */
  getFolder(userId: string | null, folderId: string): Promise<Folder | null>;

  /**
   * Create a new folder
   * @param userId User identifier
   * @param folder Folder to create
   */
  createFolder(userId: string | null, folder: Folder): Promise<void>;

  /**
   * Update an existing folder
   * @param userId User identifier
   * @param folder Folder with updated data
   */
  updateFolder(userId: string | null, folder: Folder): Promise<void>;

  /**
   * Delete a folder
   * @param userId User identifier
   * @param folderId Folder identifier
   */
  deleteFolder(userId: string | null, folderId: string): Promise<void>;

  /**
   * List all files (optionally filtered by parent folder)
   * @param userId User identifier
   * @param parentFolderId Optional parent folder filter
   */
  listFiles(userId: string | null, parentFolderId?: string): Promise<File[]>;

  /**
   * List all folders (optionally filtered by parent folder)
   * @param userId User identifier
   * @param parentFolderId Optional parent folder filter
   */
  listFolders(userId: string | null, parentFolderId?: string): Promise<Folder[]>;

  /**
   * Search files by query (searches in name and content)
   * @param userId User identifier
   * @param query Search query
   */
  searchFiles(userId: string | null, query: string): Promise<File[]>;

  /**
   * Get storage backend info (strategy, size, etc.)
   * @param userId User identifier
   */
  getStorageInfo(userId: string | null): Promise<StorageBackendInfo>;

  /**
   * Clear all data for a user
   * @param userId User identifier
   */
  clearUserData(userId: string | null): Promise<void>;
}

/**
 * Storage error types
 */
export enum StorageErrorType {
  NOT_FOUND = 'NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  THROTTLED = 'THROTTLED',
  VERSION_CONFLICT = 'VERSION_CONFLICT',
  INVALID_DATA = 'INVALID_DATA',
  INITIALIZATION_ERROR = 'INITIALIZATION_ERROR',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Custom storage error class
 */
export class StorageError extends Error {
  constructor(
    public type: StorageErrorType,
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'StorageError';
    Object.setPrototypeOf(this, StorageError.prototype);
  }

  static notFound(resource: string): StorageError {
    return new StorageError(
      StorageErrorType.NOT_FOUND,
      `Resource not found: ${resource}`
    );
  }

  static permissionDenied(action: string): StorageError {
    return new StorageError(
      StorageErrorType.PERMISSION_DENIED,
      `Permission denied: ${action}`
    );
  }

  static quotaExceeded(limit: string): StorageError {
    return new StorageError(
      StorageErrorType.QUOTA_EXCEEDED,
      `Quota exceeded: ${limit}`
    );
  }

  static networkError(message: string, error?: Error): StorageError {
    return new StorageError(StorageErrorType.NETWORK_ERROR, message, error);
  }

  static throttled(retryAfter?: number): StorageError {
    const message = retryAfter
      ? `Request throttled, retry after ${retryAfter}ms`
      : 'Request throttled';
    return new StorageError(StorageErrorType.THROTTLED, message);
  }

  static versionConflict(): StorageError {
    return new StorageError(
      StorageErrorType.VERSION_CONFLICT,
      'Version conflict detected, data was modified by another process'
    );
  }

  static invalidData(reason: string): StorageError {
    return new StorageError(
      StorageErrorType.INVALID_DATA,
      `Invalid data: ${reason}`
    );
  }

  static initializationError(message: string, error?: Error): StorageError {
    return new StorageError(
      StorageErrorType.INITIALIZATION_ERROR,
      message,
      error
    );
  }
}
