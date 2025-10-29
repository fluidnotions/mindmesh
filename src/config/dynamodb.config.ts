/**
 * DynamoDB Configuration
 * Contains table schemas, migration thresholds, and AWS SDK configuration
 */

/**
 * DynamoDB table names
 */
export const DYNAMODB_TABLES = {
  USERS: typeof process !== 'undefined' && process.env?.DYNAMODB_TABLE_USERS || 'notes-app-users',
  DATA: typeof process !== 'undefined' && process.env?.DYNAMODB_TABLE_DATA || 'notes-app-data',
} as const;

/**
 * Partition key formats
 */
export const KEY_FORMATS = {
  USER_PK: (userId: string) => `USER#${userId}`,
  ANONYMOUS_PK: () => 'USER#anonymous',
  WORKSPACE_SK: () => 'WORKSPACE#main',
  FILE_SK: (fileId: string) => `FILE#${fileId}`,
  FOLDER_SK: (folderId: string) => `FOLDER#${folderId}`,
  METADATA_SK: () => 'METADATA#workspace',
  PATH_GSI_SK: (path: string) => `PATH#${path}`,
} as const;

/**
 * Migration thresholds for switching from single-document to individual-items strategy
 */
export const MIGRATION_THRESHOLDS = {
  MAX_SIZE_BYTES: 300_000, // 300KB (75% of DynamoDB's 400KB limit)
  MAX_FILE_COUNT: 500, // Maximum number of files in single document
} as const;

/**
 * DynamoDB item size limits
 */
export const ITEM_SIZE_LIMITS = {
  MAX_ITEM_SIZE: 400_000, // 400KB (DynamoDB hard limit)
  WARNING_SIZE: 300_000, // 300KB (warn when approaching limit)
  MAX_BATCH_SIZE: 25, // Max items in BatchWriteItem
} as const;

/**
 * Retry configuration for DynamoDB operations
 */
export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  BASE_DELAY_MS: 100, // Initial delay for exponential backoff
  MAX_DELAY_MS: 5000, // Maximum delay between retries
  JITTER: true, // Add random jitter to prevent thundering herd
} as const;

/**
 * Compression configuration
 */
export const COMPRESSION_CONFIG = {
  ENABLED: true,
  MIN_SIZE_BYTES: 1024, // Only compress content larger than 1KB
  LEVEL: 6, // gzip compression level (0-9, 6 is default)
} as const;

/**
 * AWS SDK configuration
 */
export const AWS_CONFIG = {
  region: (typeof process !== 'undefined' && process.env?.AWS_REGION) || 'us-east-1',
  endpoint: typeof process !== 'undefined' ? process.env?.DYNAMODB_ENDPOINT : undefined, // For local development (DynamoDB Local)
  credentials: typeof process !== 'undefined' && process.env?.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env?.AWS_SECRET_ACCESS_KEY || '',
      }
    : undefined,
} as const;

/**
 * TTL configuration for inactive users
 */
export const TTL_CONFIG = {
  ENABLED: false, // Set to true to enable auto-expiration
  INACTIVE_DAYS: 90, // Delete workspaces inactive for 90 days
} as const;

/**
 * DynamoDB table schema for Option 1 (Single Document)
 * Table: notes-app-users
 */
export interface SingleDocumentSchema {
  PK: string; // USER#{userId}
  SK: string; // WORKSPACE#main
  userId: string;
  workspace: {
    files: Record<string, unknown>; // Map of fileId -> File
    folders: Record<string, unknown>; // Map of folderId -> Folder
    metadata: {
      fileCount: number;
      folderCount: number;
      lastAccessed: number;
    };
  };
  version: number; // For optimistic locking
  lastModified: number;
  itemCount: number; // Number of files (for migration detection)
  sizeBytes: number; // Approximate size (for migration detection)
  storageStrategy: 'single-document';
  ttl?: number; // Optional TTL for inactive users
}

/**
 * DynamoDB table schema for Option 2 (Individual Items)
 * Table: notes-app-data
 */
export interface IndividualItemsSchema {
  PK: string; // USER#{userId}
  SK: string; // FILE#{fileId} | FOLDER#{folderId} | METADATA#workspace
  GSI_PK?: string; // USER#{userId} (for GSI)
  GSI_SK?: string; // PATH#{path} (for GSI)
  type: 'FILE' | 'FOLDER' | 'METADATA';
  version?: number; // For optimistic locking
  [key: string]: unknown; // Additional attributes based on type
}

/**
 * File item in Option 2
 */
export interface FileItemSchema extends IndividualItemsSchema {
  type: 'FILE';
  fileId: string;
  name: string;
  content?: string; // Regular content
  contentCompressed?: string; // Base64-encoded compressed content
  path: string;
  parentFolderId: string | null;
  created: number;
  modified: number;
  links: string[];
}

/**
 * Folder item in Option 2
 */
export interface FolderItemSchema extends IndividualItemsSchema {
  type: 'FOLDER';
  folderId: string;
  name: string;
  path: string;
  parentId: string | null;
  childFileIds: string[];
  childFolderIds: string[];
  created: number;
  modified: number;
}

/**
 * Metadata item in Option 2
 */
export interface MetadataItemSchema extends IndividualItemsSchema {
  type: 'METADATA';
  userId: string;
  fileCount: number;
  folderCount: number;
  lastModified: number;
  storageStrategy: 'individual-items';
  migratedAt?: number;
  migratedFrom?: 'single-document';
}

/**
 * Helper to check if user should be migrated
 */
export function shouldMigrate(itemCount: number, sizeBytes: number): boolean {
  return (
    itemCount > MIGRATION_THRESHOLDS.MAX_FILE_COUNT ||
    sizeBytes > MIGRATION_THRESHOLDS.MAX_SIZE_BYTES
  );
}

/**
 * Calculate TTL timestamp for inactive users
 */
export function calculateTTL(daysInactive: number = TTL_CONFIG.INACTIVE_DAYS): number {
  const now = Math.floor(Date.now() / 1000); // DynamoDB TTL uses Unix timestamp in seconds
  return now + daysInactive * 24 * 60 * 60;
}

/**
 * Generate user key (PK) with support for anonymous users
 */
export function getUserKey(userId: string | null): string {
  if (!userId || userId === 'anonymous') {
    return KEY_FORMATS.ANONYMOUS_PK();
  }
  return KEY_FORMATS.USER_PK(userId);
}

/**
 * Extract userId from PK
 */
export function extractUserId(pk: string): string | null {
  if (pk === KEY_FORMATS.ANONYMOUS_PK()) {
    return null;
  }
  return pk.replace('USER#', '');
}

/**
 * Extract fileId from SK
 */
export function extractFileId(sk: string): string {
  return sk.replace('FILE#', '');
}

/**
 * Extract folderId from SK
 */
export function extractFolderId(sk: string): string {
  return sk.replace('FOLDER#', '');
}
