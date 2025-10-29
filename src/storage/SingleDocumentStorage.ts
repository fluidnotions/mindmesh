/**
 * Single Document Storage Strategy (Option 1)
 * Stores entire workspace as a single DynamoDB item
 * Optimized for users with <500 files and <300KB total size
 * Lowest cost approach: 1 read + 1 write per session
 */

import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  DeleteItemCommand,
  ConditionalCheckFailedException,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { Workspace, StorageError } from './StorageBackend.interface';
import { File, Folder } from '../models/types';
import {
  DYNAMODB_TABLES,
  KEY_FORMATS,
  getUserKey,
  SingleDocumentSchema,
  TTL_CONFIG,
  calculateTTL,
} from '../config/dynamodb.config';
import { getByteSize } from './CompressionUtil';

/**
 * Single Document Storage Implementation
 * Uses one DynamoDB item per user workspace
 */
export class SingleDocumentStorage {
  constructor(private client: DynamoDBClient) {}

  /**
   * Load workspace from single DynamoDB item
   */
  async loadWorkspace(userId: string | null): Promise<Workspace> {
    const pk = getUserKey(userId);
    const sk = KEY_FORMATS.WORKSPACE_SK();

    try {
      const response = await this.client.send(
        new GetItemCommand({
          TableName: DYNAMODB_TABLES.USERS,
          Key: marshall({
            PK: pk,
            SK: sk,
          }),
          ConsistentRead: true,
        })
      );

      if (!response.Item) {
        // Return empty workspace for new users
        return this.createEmptyWorkspace();
      }

      const item = unmarshall(response.Item) as SingleDocumentSchema;
      return this.deserializeWorkspace(item);
    } catch (error) {
      console.error('Error loading workspace:', error);
      throw StorageError.networkError('Failed to load workspace', error as Error);
    }
  }

  /**
   * Save workspace as single DynamoDB item with optimistic locking
   */
  async saveWorkspace(userId: string | null, workspace: Workspace): Promise<void> {
    const pk = getUserKey(userId);
    const sk = KEY_FORMATS.WORKSPACE_SK();

    // Serialize workspace to DynamoDB schema
    const item = this.serializeWorkspace(userId, workspace);

    try {
      // First, try to get current version
      const currentResponse = await this.client.send(
        new GetItemCommand({
          TableName: DYNAMODB_TABLES.USERS,
          Key: marshall({ PK: pk, SK: sk }),
          ProjectionExpression: 'version',
        })
      );

      const currentVersion = currentResponse.Item
        ? (unmarshall(currentResponse.Item).version as number)
        : 0;

      // Increment version for optimistic locking
      item.version = currentVersion + 1;

      // Save with conditional check on version
      await this.client.send(
        new PutItemCommand({
          TableName: DYNAMODB_TABLES.USERS,
          Item: marshall(item, { removeUndefinedValues: true }),
          ConditionExpression:
            currentVersion === 0
              ? 'attribute_not_exists(PK)'
              : 'version = :expectedVersion',
          ExpressionAttributeValues:
            currentVersion === 0
              ? undefined
              : marshall({ ':expectedVersion': currentVersion }),
        })
      );
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        throw StorageError.versionConflict();
      }
      console.error('Error saving workspace:', error);
      throw StorageError.networkError('Failed to save workspace', error as Error);
    }
  }

  /**
   * Get storage size and item count for migration detection
   */
  async getStorageMetrics(
    userId: string | null
  ): Promise<{ itemCount: number; sizeBytes: number }> {
    const pk = getUserKey(userId);
    const sk = KEY_FORMATS.WORKSPACE_SK();

    try {
      const response = await this.client.send(
        new GetItemCommand({
          TableName: DYNAMODB_TABLES.USERS,
          Key: marshall({ PK: pk, SK: sk }),
          ProjectionExpression: 'itemCount, sizeBytes',
        })
      );

      if (!response.Item) {
        return { itemCount: 0, sizeBytes: 0 };
      }

      const data = unmarshall(response.Item);
      return {
        itemCount: data.itemCount || 0,
        sizeBytes: data.sizeBytes || 0,
      };
    } catch (error) {
      console.error('Error getting storage metrics:', error);
      return { itemCount: 0, sizeBytes: 0 };
    }
  }

  /**
   * Delete workspace (used during migration)
   */
  async deleteWorkspace(userId: string | null): Promise<void> {
    const pk = getUserKey(userId);
    const sk = KEY_FORMATS.WORKSPACE_SK();

    try {
      await this.client.send(
        new DeleteItemCommand({
          TableName: DYNAMODB_TABLES.USERS,
          Key: marshall({ PK: pk, SK: sk }),
        })
      );
    } catch (error) {
      console.error('Error deleting workspace:', error);
      throw StorageError.networkError('Failed to delete workspace', error as Error);
    }
  }

  /**
   * Create empty workspace for new users
   */
  private createEmptyWorkspace(): Workspace {
    return {
      files: new Map(),
      folders: new Map(),
      metadata: {
        fileCount: 0,
        folderCount: 0,
        lastAccessed: Date.now(),
        sizeBytes: 0,
      },
    };
  }

  /**
   * Serialize workspace for DynamoDB storage
   */
  private serializeWorkspace(
    userId: string | null,
    workspace: Workspace
  ): SingleDocumentSchema {
    // Convert Maps to plain objects for DynamoDB
    const filesObject: Record<string, unknown> = {};
    workspace.files.forEach((file, id) => {
      filesObject[id] = {
        id: file.id,
        name: file.name,
        content: file.content,
        path: file.path,
        created: file.created,
        modified: file.modified,
        links: file.links,
      };
    });

    const foldersObject: Record<string, unknown> = {};
    workspace.folders.forEach((folder, id) => {
      foldersObject[id] = {
        id: folder.id,
        name: folder.name,
        path: folder.path,
        children: folder.children.map((child) => child.id),
      };
    });

    // Calculate total size
    const workspaceJson = JSON.stringify({
      files: filesObject,
      folders: foldersObject,
      metadata: workspace.metadata,
    });
    const sizeBytes = getByteSize(workspaceJson);

    const item: SingleDocumentSchema = {
      PK: getUserKey(userId),
      SK: KEY_FORMATS.WORKSPACE_SK(),
      userId: userId || 'anonymous',
      workspace: {
        files: filesObject,
        folders: foldersObject,
        metadata: {
          fileCount: workspace.metadata.fileCount,
          folderCount: workspace.metadata.folderCount,
          lastAccessed: Date.now(),
        },
      },
      version: 0, // Will be set by saveWorkspace
      lastModified: Date.now(),
      itemCount: workspace.files.size,
      sizeBytes,
      storageStrategy: 'single-document',
    };

    // Add TTL if enabled
    if (TTL_CONFIG.ENABLED) {
      item.ttl = calculateTTL();
    }

    return item;
  }

  /**
   * Deserialize workspace from DynamoDB item
   */
  private deserializeWorkspace(item: SingleDocumentSchema): Workspace {
    const files = new Map<string, File>();
    const folders = new Map<string, Folder>();

    // Convert files object to Map
    if (item.workspace.files) {
      Object.entries(item.workspace.files).forEach(([id, fileData]) => {
        const file = fileData as File;
        files.set(id, {
          id: file.id,
          name: file.name,
          content: file.content,
          path: file.path,
          created: file.created,
          modified: file.modified,
          links: file.links || [],
        });
      });
    }

    // Convert folders object to Map
    if (item.workspace.folders) {
      Object.entries(item.workspace.folders).forEach(([id, folderData]) => {
        const folder = folderData as {
          id: string;
          name: string;
          path: string;
          children: string[];
        };

        // Reconstruct children array
        const children: (File | Folder)[] = [];
        if (folder.children && Array.isArray(folder.children)) {
          folder.children.forEach((childId) => {
            const childFile = files.get(childId);
            const childFolder = folders.get(childId);
            if (childFile) children.push(childFile);
            if (childFolder) children.push(childFolder);
          });
        }

        folders.set(id, {
          id: folder.id,
          name: folder.name,
          path: folder.path,
          parentPath: null,
          children,
        });
      });
    }

    return {
      files,
      folders,
      metadata: {
        fileCount: item.workspace.metadata.fileCount,
        folderCount: item.workspace.metadata.folderCount,
        lastAccessed: item.workspace.metadata.lastAccessed,
        sizeBytes: item.sizeBytes,
      },
    };
  }

  /**
   * Check if migration is needed based on current metrics
   */
  async shouldMigrate(userId: string | null): Promise<boolean> {
    const metrics = await this.getStorageMetrics(userId);
    const { itemCount, sizeBytes } = metrics;

    // Import migration thresholds
    const { MIGRATION_THRESHOLDS } = await import('../config/dynamodb.config');

    return (
      itemCount > MIGRATION_THRESHOLDS.MAX_FILE_COUNT ||
      sizeBytes > MIGRATION_THRESHOLDS.MAX_SIZE_BYTES
    );
  }
}
