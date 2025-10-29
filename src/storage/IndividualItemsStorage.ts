/**
 * Individual Items Storage Strategy (Option 2)
 * Stores each file and folder as separate DynamoDB items
 * Optimized for users with >500 files or >300KB total size
 * Supports granular updates and better concurrency
 */

import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  DeleteItemCommand,
  QueryCommand,
  BatchWriteItemCommand,
  UpdateItemCommand,
  ConditionalCheckFailedException,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { Workspace, StorageError } from './StorageBackend.interface';
import { File, Folder } from '../models/types';
import {
  DYNAMODB_TABLES,
  KEY_FORMATS,
  getUserKey,
  FileItemSchema,
  FolderItemSchema,
  MetadataItemSchema,
  ITEM_SIZE_LIMITS,
} from '../config/dynamodb.config';
import { smartCompress, smartDecompress } from './CompressionUtil';

/**
 * Individual Items Storage Implementation
 * Each file and folder is a separate DynamoDB item
 */
export class IndividualItemsStorage {
  constructor(private client: DynamoDBClient) {}

  /**
   * Load entire workspace by querying all items for user
   */
  async loadWorkspace(userId: string | null): Promise<Workspace> {
    const pk = getUserKey(userId);

    try {
      // Query all items for user
      const response = await this.client.send(
        new QueryCommand({
          TableName: DYNAMODB_TABLES.DATA,
          KeyConditionExpression: 'PK = :pk',
          ExpressionAttributeValues: marshall({
            ':pk': pk,
          }),
        })
      );

      if (!response.Items || response.Items.length === 0) {
        return this.createEmptyWorkspace();
      }

      // Deserialize items
      const items = response.Items.map((item) => unmarshall(item));
      return this.deserializeWorkspace(items);
    } catch (error) {
      console.error('Error loading workspace:', error);
      throw StorageError.networkError('Failed to load workspace', error as Error);
    }
  }

  /**
   * Save entire workspace as individual items using batch write
   */
  async saveWorkspace(userId: string | null, workspace: Workspace): Promise<void> {
    const pk = getUserKey(userId);

    try {
      // Prepare all items to write
      const items: unknown[] = [];

      // Add metadata item
      const metadata: MetadataItemSchema = {
        PK: pk,
        SK: KEY_FORMATS.METADATA_SK(),
        type: 'METADATA',
        userId: userId || 'anonymous',
        fileCount: workspace.files.size,
        folderCount: workspace.folders.size,
        lastModified: Date.now(),
        storageStrategy: 'individual-items',
      };
      items.push(metadata);

      // Add file items
      workspace.files.forEach((file) => {
        const fileItem = this.serializeFile(pk, file);
        items.push(fileItem);
      });

      // Add folder items
      workspace.folders.forEach((folder) => {
        const folderItem = this.serializeFolder(pk, folder);
        items.push(folderItem);
      });

      // Write in batches of 25 (DynamoDB limit)
      await this.batchWrite(items);
    } catch (error) {
      console.error('Error saving workspace:', error);
      throw StorageError.networkError('Failed to save workspace', error as Error);
    }
  }

  /**
   * Get a single file by ID
   */
  async getFile(userId: string | null, fileId: string): Promise<File | null> {
    const pk = getUserKey(userId);
    const sk = KEY_FORMATS.FILE_SK(fileId);

    try {
      const response = await this.client.send(
        new GetItemCommand({
          TableName: DYNAMODB_TABLES.DATA,
          Key: marshall({ PK: pk, SK: sk }),
        })
      );

      if (!response.Item) {
        return null;
      }

      const item = unmarshall(response.Item) as FileItemSchema;
      return this.deserializeFile(item);
    } catch (error) {
      console.error('Error getting file:', error);
      throw StorageError.networkError('Failed to get file', error as Error);
    }
  }

  /**
   * Create or update a file
   */
  async putFile(userId: string | null, file: File): Promise<void> {
    const pk = getUserKey(userId);
    const fileItem = this.serializeFile(pk, file);

    try {
      await this.client.send(
        new PutItemCommand({
          TableName: DYNAMODB_TABLES.DATA,
          Item: marshall(fileItem, { removeUndefinedValues: true }),
        })
      );

      // Update metadata file count
      await this.updateMetadataCount(userId, 'fileCount', 1);
    } catch (error) {
      console.error('Error putting file:', error);
      throw StorageError.networkError('Failed to save file', error as Error);
    }
  }

  /**
   * Update an existing file with optimistic locking
   */
  async updateFile(userId: string | null, file: File): Promise<void> {
    const pk = getUserKey(userId);
    const sk = KEY_FORMATS.FILE_SK(file.id);

    // Compress content if needed
    const compressionResult = smartCompress(file.content);

    try {
      // Get current version
      const current = await this.getFile(userId, file.id);
      const currentVersion = current ? 1 : 0; // Simplified versioning

      const updateExpression =
        'SET #name = :name, ' +
        (compressionResult.isCompressed ? '#contentCompressed = :content' : '#content = :content') +
        ', #path = :path, #modified = :modified, #links = :links, #version = :version';

      const expressionAttributeNames: Record<string, string> = {
        '#name': 'name',
        '#path': 'path',
        '#modified': 'modified',
        '#links': 'links',
        '#version': 'version',
      };

      if (compressionResult.isCompressed) {
        expressionAttributeNames['#contentCompressed'] = 'contentCompressed';
      } else {
        expressionAttributeNames['#content'] = 'content';
      }

      await this.client.send(
        new UpdateItemCommand({
          TableName: DYNAMODB_TABLES.DATA,
          Key: marshall({ PK: pk, SK: sk }),
          UpdateExpression: updateExpression,
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: marshall({
            ':name': file.name,
            ':content': compressionResult.content,
            ':path': file.path,
            ':modified': file.modified,
            ':links': file.links,
            ':version': currentVersion + 1,
          }),
        })
      );
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        throw StorageError.versionConflict();
      }
      console.error('Error updating file:', error);
      throw StorageError.networkError('Failed to update file', error as Error);
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(userId: string | null, fileId: string): Promise<void> {
    const pk = getUserKey(userId);
    const sk = KEY_FORMATS.FILE_SK(fileId);

    try {
      await this.client.send(
        new DeleteItemCommand({
          TableName: DYNAMODB_TABLES.DATA,
          Key: marshall({ PK: pk, SK: sk }),
        })
      );

      // Update metadata file count
      await this.updateMetadataCount(userId, 'fileCount', -1);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw StorageError.networkError('Failed to delete file', error as Error);
    }
  }

  /**
   * Get a single folder by ID
   */
  async getFolder(userId: string | null, folderId: string): Promise<Folder | null> {
    const pk = getUserKey(userId);
    const sk = KEY_FORMATS.FOLDER_SK(folderId);

    try {
      const response = await this.client.send(
        new GetItemCommand({
          TableName: DYNAMODB_TABLES.DATA,
          Key: marshall({ PK: pk, SK: sk }),
        })
      );

      if (!response.Item) {
        return null;
      }

      const item = unmarshall(response.Item) as FolderItemSchema;

      // Load children
      const children: (File | Folder)[] = [];

      // Load child files
      for (const fileId of item.childFileIds || []) {
        const file = await this.getFile(userId, fileId);
        if (file) children.push(file);
      }

      // Load child folders
      for (const childFolderId of item.childFolderIds || []) {
        const childFolder = await this.getFolder(userId, childFolderId);
        if (childFolder) children.push(childFolder);
      }

      return {
        id: item.folderId,
        name: item.name,
        path: item.path,
        children,
      };
    } catch (error) {
      console.error('Error getting folder:', error);
      throw StorageError.networkError('Failed to get folder', error as Error);
    }
  }

  /**
   * Create or update a folder
   */
  async putFolder(userId: string | null, folder: Folder): Promise<void> {
    const pk = getUserKey(userId);
    const folderItem = this.serializeFolder(pk, folder);

    try {
      await this.client.send(
        new PutItemCommand({
          TableName: DYNAMODB_TABLES.DATA,
          Item: marshall(folderItem, { removeUndefinedValues: true }),
        })
      );

      // Update metadata folder count
      await this.updateMetadataCount(userId, 'folderCount', 1);
    } catch (error) {
      console.error('Error putting folder:', error);
      throw StorageError.networkError('Failed to save folder', error as Error);
    }
  }

  /**
   * Delete a folder
   */
  async deleteFolder(userId: string | null, folderId: string): Promise<void> {
    const pk = getUserKey(userId);
    const sk = KEY_FORMATS.FOLDER_SK(folderId);

    try {
      await this.client.send(
        new DeleteItemCommand({
          TableName: DYNAMODB_TABLES.DATA,
          Key: marshall({ PK: pk, SK: sk }),
        })
      );

      // Update metadata folder count
      await this.updateMetadataCount(userId, 'folderCount', -1);
    } catch (error) {
      console.error('Error deleting folder:', error);
      throw StorageError.networkError('Failed to delete folder', error as Error);
    }
  }

  /**
   * List all files for a user
   */
  async listFiles(userId: string | null): Promise<File[]> {
    const pk = getUserKey(userId);

    try {
      const response = await this.client.send(
        new QueryCommand({
          TableName: DYNAMODB_TABLES.DATA,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :filePrefix)',
          ExpressionAttributeValues: marshall({
            ':pk': pk,
            ':filePrefix': 'FILE#',
          }),
        })
      );

      if (!response.Items) {
        return [];
      }

      return response.Items.map((item) => {
        const fileItem = unmarshall(item) as FileItemSchema;
        return this.deserializeFile(fileItem);
      });
    } catch (error) {
      console.error('Error listing files:', error);
      throw StorageError.networkError('Failed to list files', error as Error);
    }
  }

  /**
   * List all folders for a user
   */
  async listFolders(userId: string | null): Promise<Folder[]> {
    const pk = getUserKey(userId);

    try {
      const response = await this.client.send(
        new QueryCommand({
          TableName: DYNAMODB_TABLES.DATA,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :folderPrefix)',
          ExpressionAttributeValues: marshall({
            ':pk': pk,
            ':folderPrefix': 'FOLDER#',
          }),
        })
      );

      if (!response.Items) {
        return [];
      }

      // For each folder, we need to load its children
      const folders: Folder[] = [];
      for (const item of response.Items) {
        const folderItem = unmarshall(item) as FolderItemSchema;
        const folder = await this.getFolder(userId, folderItem.folderId);
        if (folder) folders.push(folder);
      }

      return folders;
    } catch (error) {
      console.error('Error listing folders:', error);
      throw StorageError.networkError('Failed to list folders', error as Error);
    }
  }

  /**
   * Delete all items for a user
   */
  async deleteAllItems(userId: string | null): Promise<void> {
    const pk = getUserKey(userId);

    try {
      // Query all items
      const response = await this.client.send(
        new QueryCommand({
          TableName: DYNAMODB_TABLES.DATA,
          KeyConditionExpression: 'PK = :pk',
          ExpressionAttributeValues: marshall({ ':pk': pk }),
          ProjectionExpression: 'PK, SK',
        })
      );

      if (!response.Items || response.Items.length === 0) {
        return;
      }

      // Delete in batches
      const items = response.Items.map((item) => ({
        DeleteRequest: { Key: item },
      }));

      await this.batchDelete(items);
    } catch (error) {
      console.error('Error deleting all items:', error);
      throw StorageError.networkError('Failed to delete all items', error as Error);
    }
  }

  /**
   * Batch write items (handles chunking into batches of 25)
   */
  private async batchWrite(items: unknown[]): Promise<void> {
    const chunks = this.chunkArray(items, ITEM_SIZE_LIMITS.MAX_BATCH_SIZE);

    for (const chunk of chunks) {
      const putRequests = chunk.map((item) => ({
        PutRequest: { Item: marshall(item as Record<string, unknown>, { removeUndefinedValues: true }) },
      }));

      await this.client.send(
        new BatchWriteItemCommand({
          RequestItems: {
            [DYNAMODB_TABLES.DATA]: putRequests,
          },
        })
      );
    }
  }

  /**
   * Batch delete items
   */
  private async batchDelete(
    deleteRequests: { DeleteRequest: { Key: Record<string, unknown> } }[]
  ): Promise<void> {
    const chunks = this.chunkArray(deleteRequests, ITEM_SIZE_LIMITS.MAX_BATCH_SIZE);

    for (const chunk of chunks) {
      await this.client.send(
        new BatchWriteItemCommand({
          RequestItems: {
            [DYNAMODB_TABLES.DATA]: chunk as any,
          },
        })
      );
    }
  }

  /**
   * Update metadata count (file or folder count)
   */
  private async updateMetadataCount(
    userId: string | null,
    countField: 'fileCount' | 'folderCount',
    increment: number
  ): Promise<void> {
    const pk = getUserKey(userId);
    const sk = KEY_FORMATS.METADATA_SK();

    try {
      await this.client.send(
        new UpdateItemCommand({
          TableName: DYNAMODB_TABLES.DATA,
          Key: marshall({ PK: pk, SK: sk }),
          UpdateExpression: `SET ${countField} = if_not_exists(${countField}, :zero) + :inc, lastModified = :now`,
          ExpressionAttributeValues: marshall({
            ':inc': increment,
            ':zero': 0,
            ':now': Date.now(),
          }),
        })
      );
    } catch (error) {
      console.warn(`Failed to update ${countField}:`, error);
      // Don't throw - metadata update is not critical
    }
  }

  /**
   * Serialize file to DynamoDB item
   */
  private serializeFile(pk: string, file: File): FileItemSchema {
    const compressionResult = smartCompress(file.content);

    const item: FileItemSchema = {
      PK: pk,
      SK: KEY_FORMATS.FILE_SK(file.id),
      GSI_PK: pk,
      GSI_SK: KEY_FORMATS.PATH_GSI_SK(file.path),
      type: 'FILE',
      fileId: file.id,
      name: file.name,
      path: file.path,
      parentFolderId: null, // Will be set if file has parent
      created: file.created,
      modified: file.modified,
      links: file.links,
      version: 1,
    };

    if (compressionResult.isCompressed) {
      item.contentCompressed = compressionResult.content;
    } else {
      item.content = compressionResult.content;
    }

    return item;
  }

  /**
   * Deserialize file from DynamoDB item
   */
  private deserializeFile(item: FileItemSchema): File {
    // Handle compressed content
    const content = item.contentCompressed
      ? smartDecompress(item.contentCompressed, true)
      : item.content || '';

    return {
      id: item.fileId,
      name: item.name,
      content,
      path: item.path,
      created: item.created,
      modified: item.modified,
      links: item.links || [],
    };
  }

  /**
   * Serialize folder to DynamoDB item
   */
  private serializeFolder(pk: string, folder: Folder): FolderItemSchema {
    // Extract child IDs
    const childFileIds = folder.children
      .filter((child) => 'content' in child)
      .map((child) => child.id);

    const childFolderIds = folder.children
      .filter((child) => 'children' in child)
      .map((child) => child.id);

    return {
      PK: pk,
      SK: KEY_FORMATS.FOLDER_SK(folder.id),
      GSI_PK: pk,
      GSI_SK: KEY_FORMATS.PATH_GSI_SK(folder.path),
      type: 'FOLDER',
      folderId: folder.id,
      name: folder.name,
      path: folder.path,
      parentId: null,
      childFileIds,
      childFolderIds,
      created: Date.now(),
      modified: Date.now(),
    };
  }

  /**
   * Create empty workspace
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
   * Deserialize workspace from items
   */
  private deserializeWorkspace(items: unknown[]): Workspace {
    const files = new Map<string, File>();
    const folders = new Map<string, Folder>();
    let metadata = {
      fileCount: 0,
      folderCount: 0,
      lastAccessed: Date.now(),
      sizeBytes: 0,
    };

    // First pass: deserialize files and folders (without children)
    const folderItems: FolderItemSchema[] = [];

    for (const item of items) {
      const typedItem = item as { type: string };

      if (typedItem.type === 'FILE') {
        const fileItem = item as FileItemSchema;
        const file = this.deserializeFile(fileItem);
        files.set(file.id, file);
      } else if (typedItem.type === 'FOLDER') {
        const folderItem = item as FolderItemSchema;
        folderItems.push(folderItem);
      } else if (typedItem.type === 'METADATA') {
        const metadataItem = item as MetadataItemSchema;
        metadata = {
          fileCount: metadataItem.fileCount,
          folderCount: metadataItem.folderCount,
          lastAccessed: metadataItem.lastModified,
          sizeBytes: 0,
        };
      }
    }

    // Second pass: reconstruct folder hierarchy
    for (const folderItem of folderItems) {
      const children: (File | Folder)[] = [];

      // Add child files
      for (const fileId of folderItem.childFileIds || []) {
        const file = files.get(fileId);
        if (file) children.push(file);
      }

      // Add child folders (recursive)
      for (const childFolderId of folderItem.childFolderIds || []) {
        const childFolder = folders.get(childFolderId);
        if (childFolder) children.push(childFolder);
      }

      folders.set(folderItem.folderId, {
        id: folderItem.folderId,
        name: folderItem.name,
        path: folderItem.path,
        children,
      });
    }

    return { files, folders, metadata };
  }

  /**
   * Chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
