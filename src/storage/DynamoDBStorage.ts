/**
 * DynamoDB Storage Backend
 * Main orchestrator that implements the StorageBackend interface
 * Uses hybrid strategy: starts with single-document, auto-migrates to individual-items
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  StorageBackend,
  Workspace,
  StorageBackendInfo,
  StorageError,
  StorageStrategy,
} from './StorageBackend.interface';
import { File, Folder } from '../models/types';
import { SingleDocumentStorage } from './SingleDocumentStorage';
import { IndividualItemsStorage } from './IndividualItemsStorage';
import { MigrationService } from './MigrationService';
import { retryWithBackoff, convertAWSError, CircuitBreaker } from './RetryUtil';
import { AWS_CONFIG } from '../config/dynamodb.config';

/**
 * Main DynamoDB Storage implementation with hybrid strategy
 */
export class DynamoDBStorage implements StorageBackend {
  private client: DynamoDBClient;
  private singleDocStorage: SingleDocumentStorage;
  private individualItemsStorage: IndividualItemsStorage;
  private migrationService: MigrationService;
  private circuitBreaker: CircuitBreaker;
  private initialized = false;

  // Cache to track which strategy each user is using
  private userStrategyCache = new Map<string, StorageStrategy>();

  constructor() {
    // Initialize DynamoDB client
    this.client = new DynamoDBClient({
      region: AWS_CONFIG.region,
      endpoint: AWS_CONFIG.endpoint,
      credentials: AWS_CONFIG.credentials,
    });

    // Initialize storage implementations
    this.singleDocStorage = new SingleDocumentStorage(this.client);
    this.individualItemsStorage = new IndividualItemsStorage(this.client);
    this.migrationService = new MigrationService(this.client);

    // Initialize circuit breaker
    this.circuitBreaker = new CircuitBreaker();
  }

  /**
   * Initialize storage backend
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Test connection by attempting a simple operation
      // This will throw if credentials are invalid or network is down
      console.log('[DynamoDBStorage] Initializing connection...');

      // Try a simple GetItem operation with a non-existent key to test connection
      await this.circuitBreaker.execute(async () => {
        await this.singleDocStorage.getStorageMetrics('_test_connection_');
      });

      this.initialized = true;
      console.log('[DynamoDBStorage] Initialization successful');
    } catch (error) {
      console.error('[DynamoDBStorage] Initialization failed:', error);
      throw StorageError.initializationError(
        'Failed to initialize DynamoDB connection',
        convertAWSError(error)
      );
    }
  }

  /**
   * Determine which storage strategy to use for a user
   */
  private async getStorageStrategy(userId: string | null): Promise<StorageStrategy> {
    const cacheKey = userId || 'anonymous';

    // Check cache first
    if (this.userStrategyCache.has(cacheKey)) {
      return this.userStrategyCache.get(cacheKey)!;
    }

    try {
      // Try to load from individual-items first (it's the migrated state)
      const individualItemsWorkspace =
        await this.individualItemsStorage.loadWorkspace(userId);

      if (
        individualItemsWorkspace.files.size > 0 ||
        individualItemsWorkspace.folders.size > 0
      ) {
        // User has data in individual-items storage
        this.userStrategyCache.set(cacheKey, 'individual-items');
        return 'individual-items';
      }

      // Check single-document storage
      const singleDocWorkspace = await this.singleDocStorage.loadWorkspace(userId);

      if (singleDocWorkspace.files.size > 0 || singleDocWorkspace.folders.size > 0) {
        // User has data in single-document storage
        this.userStrategyCache.set(cacheKey, 'single-document');
        return 'single-document';
      }

      // New user - default to single-document
      this.userStrategyCache.set(cacheKey, 'single-document');
      return 'single-document';
    } catch (error) {
      console.error('[DynamoDBStorage] Error determining storage strategy:', error);
      // Default to single-document on error
      return 'single-document';
    }
  }

  /**
   * Check if migration is needed and perform it automatically
   */
  private async checkAndMigrate(userId: string | null): Promise<void> {
    try {
      const needsMigration = await this.migrationService.needsMigration(userId);

      if (needsMigration) {
        console.log('[DynamoDBStorage] Migration threshold reached, starting migration...');

        const result = await this.migrationService.migrateToIndividualItems(userId);

        if (result.success) {
          console.log(
            `[DynamoDBStorage] Migration successful: ${result.itemsMigrated} items in ${result.duration}ms`
          );

          // Update cache
          const cacheKey = userId || 'anonymous';
          this.userStrategyCache.set(cacheKey, 'individual-items');
        } else {
          console.error('[DynamoDBStorage] Migration failed:', result.error);
        }
      }
    } catch (error) {
      console.error('[DynamoDBStorage] Error during migration check:', error);
      // Don't throw - migration failure shouldn't block normal operations
    }
  }

  /**
   * Load workspace using appropriate strategy
   */
  async loadWorkspace(userId: string | null): Promise<Workspace> {
    await this.ensureInitialized();

    return retryWithBackoff(async () => {
      try {
        const strategy = await this.getStorageStrategy(userId);
        console.log(`[DynamoDBStorage] Loading workspace using ${strategy} strategy`);

        if (strategy === 'individual-items') {
          return await this.individualItemsStorage.loadWorkspace(userId);
        } else {
          return await this.singleDocStorage.loadWorkspace(userId);
        }
      } catch (error) {
        throw convertAWSError(error);
      }
    });
  }

  /**
   * Save workspace using appropriate strategy
   */
  async saveWorkspace(userId: string | null, workspace: Workspace): Promise<void> {
    await this.ensureInitialized();

    return retryWithBackoff(async () => {
      try {
        // Check if migration is needed before saving
        const strategy = await this.getStorageStrategy(userId);

        if (strategy === 'single-document') {
          // Check if we need to migrate after this save
          await this.singleDocStorage.saveWorkspace(userId, workspace);
          await this.checkAndMigrate(userId);
        } else {
          // Already using individual-items
          await this.individualItemsStorage.saveWorkspace(userId, workspace);
        }
      } catch (error) {
        throw convertAWSError(error);
      }
    });
  }

  /**
   * Get a single file
   */
  async getFile(userId: string | null, fileId: string): Promise<File | null> {
    await this.ensureInitialized();

    return retryWithBackoff(async () => {
      try {
        const strategy = await this.getStorageStrategy(userId);

        if (strategy === 'individual-items') {
          return await this.individualItemsStorage.getFile(userId, fileId);
        } else {
          // For single-document, we need to load entire workspace
          const workspace = await this.singleDocStorage.loadWorkspace(userId);
          return workspace.files.get(fileId) || null;
        }
      } catch (error) {
        throw convertAWSError(error);
      }
    });
  }

  /**
   * Create a new file
   */
  async createFile(userId: string | null, file: File): Promise<void> {
    await this.ensureInitialized();

    return retryWithBackoff(async () => {
      try {
        const strategy = await this.getStorageStrategy(userId);

        if (strategy === 'individual-items') {
          await this.individualItemsStorage.putFile(userId, file);
        } else {
          // For single-document, load workspace, add file, and save
          const workspace = await this.singleDocStorage.loadWorkspace(userId);
          workspace.files.set(file.id, file);
          workspace.metadata.fileCount = workspace.files.size;
          await this.singleDocStorage.saveWorkspace(userId, workspace);
          await this.checkAndMigrate(userId);
        }
      } catch (error) {
        throw convertAWSError(error);
      }
    });
  }

  /**
   * Update an existing file
   */
  async updateFile(userId: string | null, file: File): Promise<void> {
    await this.ensureInitialized();

    return retryWithBackoff(async () => {
      try {
        const strategy = await this.getStorageStrategy(userId);

        if (strategy === 'individual-items') {
          await this.individualItemsStorage.updateFile(userId, file);
        } else {
          // For single-document, load workspace, update file, and save
          const workspace = await this.singleDocStorage.loadWorkspace(userId);
          workspace.files.set(file.id, file);
          await this.singleDocStorage.saveWorkspace(userId, workspace);
          await this.checkAndMigrate(userId);
        }
      } catch (error) {
        throw convertAWSError(error);
      }
    });
  }

  /**
   * Delete a file
   */
  async deleteFile(userId: string | null, fileId: string): Promise<void> {
    await this.ensureInitialized();

    return retryWithBackoff(async () => {
      try {
        const strategy = await this.getStorageStrategy(userId);

        if (strategy === 'individual-items') {
          await this.individualItemsStorage.deleteFile(userId, fileId);
        } else {
          // For single-document, load workspace, remove file, and save
          const workspace = await this.singleDocStorage.loadWorkspace(userId);
          workspace.files.delete(fileId);
          workspace.metadata.fileCount = workspace.files.size;
          await this.singleDocStorage.saveWorkspace(userId, workspace);
        }
      } catch (error) {
        throw convertAWSError(error);
      }
    });
  }

  /**
   * Get a single folder
   */
  async getFolder(userId: string | null, folderId: string): Promise<Folder | null> {
    await this.ensureInitialized();

    return retryWithBackoff(async () => {
      try {
        const strategy = await this.getStorageStrategy(userId);

        if (strategy === 'individual-items') {
          return await this.individualItemsStorage.getFolder(userId, folderId);
        } else {
          const workspace = await this.singleDocStorage.loadWorkspace(userId);
          return workspace.folders.get(folderId) || null;
        }
      } catch (error) {
        throw convertAWSError(error);
      }
    });
  }

  /**
   * Create a new folder
   */
  async createFolder(userId: string | null, folder: Folder): Promise<void> {
    await this.ensureInitialized();

    return retryWithBackoff(async () => {
      try {
        const strategy = await this.getStorageStrategy(userId);

        if (strategy === 'individual-items') {
          await this.individualItemsStorage.putFolder(userId, folder);
        } else {
          const workspace = await this.singleDocStorage.loadWorkspace(userId);
          workspace.folders.set(folder.id, folder);
          workspace.metadata.folderCount = workspace.folders.size;
          await this.singleDocStorage.saveWorkspace(userId, workspace);
          await this.checkAndMigrate(userId);
        }
      } catch (error) {
        throw convertAWSError(error);
      }
    });
  }

  /**
   * Update an existing folder
   */
  async updateFolder(userId: string | null, folder: Folder): Promise<void> {
    await this.ensureInitialized();

    return retryWithBackoff(async () => {
      try {
        const strategy = await this.getStorageStrategy(userId);

        if (strategy === 'individual-items') {
          await this.individualItemsStorage.putFolder(userId, folder);
        } else {
          const workspace = await this.singleDocStorage.loadWorkspace(userId);
          workspace.folders.set(folder.id, folder);
          await this.singleDocStorage.saveWorkspace(userId, workspace);
          await this.checkAndMigrate(userId);
        }
      } catch (error) {
        throw convertAWSError(error);
      }
    });
  }

  /**
   * Delete a folder
   */
  async deleteFolder(userId: string | null, folderId: string): Promise<void> {
    await this.ensureInitialized();

    return retryWithBackoff(async () => {
      try {
        const strategy = await this.getStorageStrategy(userId);

        if (strategy === 'individual-items') {
          await this.individualItemsStorage.deleteFolder(userId, folderId);
        } else {
          const workspace = await this.singleDocStorage.loadWorkspace(userId);
          workspace.folders.delete(folderId);
          workspace.metadata.folderCount = workspace.folders.size;
          await this.singleDocStorage.saveWorkspace(userId, workspace);
        }
      } catch (error) {
        throw convertAWSError(error);
      }
    });
  }

  /**
   * List all files
   */
  async listFiles(userId: string | null, parentFolderId?: string): Promise<File[]> {
    await this.ensureInitialized();

    return retryWithBackoff(async () => {
      try {
        const strategy = await this.getStorageStrategy(userId);

        if (strategy === 'individual-items') {
          const allFiles = await this.individualItemsStorage.listFiles(userId);

          // Filter by parent folder if specified
          if (parentFolderId) {
            // This would require storing parentFolderId in FileItemSchema
            // For now, return all files
            return allFiles;
          }

          return allFiles;
        } else {
          const workspace = await this.singleDocStorage.loadWorkspace(userId);
          return Array.from(workspace.files.values());
        }
      } catch (error) {
        throw convertAWSError(error);
      }
    });
  }

  /**
   * List all folders
   */
  async listFolders(userId: string | null, parentFolderId?: string): Promise<Folder[]> {
    await this.ensureInitialized();

    return retryWithBackoff(async () => {
      try {
        const strategy = await this.getStorageStrategy(userId);

        if (strategy === 'individual-items') {
          const allFolders = await this.individualItemsStorage.listFolders(userId);

          // Filter by parent folder if specified
          if (parentFolderId) {
            // This would require checking folder hierarchy
            // For now, return all folders
            return allFolders;
          }

          return allFolders;
        } else {
          const workspace = await this.singleDocStorage.loadWorkspace(userId);
          return Array.from(workspace.folders.values());
        }
      } catch (error) {
        throw convertAWSError(error);
      }
    });
  }

  /**
   * Search files by query
   */
  async searchFiles(userId: string | null, query: string): Promise<File[]> {
    await this.ensureInitialized();

    return retryWithBackoff(async () => {
      try {
        const files = await this.listFiles(userId);
        const lowerQuery = query.toLowerCase();

        return files.filter(
          (file) =>
            file.name.toLowerCase().includes(lowerQuery) ||
            file.content.toLowerCase().includes(lowerQuery) ||
            file.path.toLowerCase().includes(lowerQuery)
        );
      } catch (error) {
        throw convertAWSError(error);
      }
    });
  }

  /**
   * Get storage backend info
   */
  async getStorageInfo(userId: string | null): Promise<StorageBackendInfo> {
    await this.ensureInitialized();

    return retryWithBackoff(async () => {
      try {
        const strategy = await this.getStorageStrategy(userId);

        if (strategy === 'individual-items') {
          const workspace = await this.individualItemsStorage.loadWorkspace(userId);
          return {
            strategy: 'individual-items',
            isMigrated: true,
            itemCount: workspace.files.size + workspace.folders.size,
            sizeBytes: workspace.metadata.sizeBytes || 0,
          };
        } else {
          const metrics = await this.singleDocStorage.getStorageMetrics(userId);
          return {
            strategy: 'single-document',
            isMigrated: false,
            itemCount: metrics.itemCount,
            sizeBytes: metrics.sizeBytes,
          };
        }
      } catch (error) {
        throw convertAWSError(error);
      }
    });
  }

  /**
   * Clear all data for a user
   */
  async clearUserData(userId: string | null): Promise<void> {
    await this.ensureInitialized();

    return retryWithBackoff(async () => {
      try {
        const strategy = await this.getStorageStrategy(userId);

        if (strategy === 'individual-items') {
          await this.individualItemsStorage.deleteAllItems(userId);
        } else {
          await this.singleDocStorage.deleteWorkspace(userId);
        }

        // Clear cache
        const cacheKey = userId || 'anonymous';
        this.userStrategyCache.delete(cacheKey);
      } catch (error) {
        throw convertAWSError(error);
      }
    });
  }

  /**
   * Ensure storage is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Close connections and cleanup
   */
  async destroy(): Promise<void> {
    this.client.destroy();
    this.userStrategyCache.clear();
    this.initialized = false;
    console.log('[DynamoDBStorage] Storage backend destroyed');
  }
}
