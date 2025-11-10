/**
 * API Storage Backend
 * StorageBackend implementation that uses the MindMesh REST API instead of direct DynamoDB access
 *
 * This backend:
 * - Calls the backend REST API via MindMeshAPIClient
 * - Caches workspace data locally for efficient operations
 * - Automatically syncs changes back to the API
 * - Handles authentication via JWT tokens
 *
 * Architecture:
 * - The API only has 5 endpoints (load/save workspace, create/update/delete file)
 * - For operations like getFolder, listFiles, etc., we load the full workspace and operate on it
 * - Changes are batched and saved back via saveWorkspace when needed
 */

import {
  StorageBackend,
  Workspace,
  StorageBackendInfo,
  StorageError,
} from './StorageBackend.interface';
import { File, Folder } from '../models/types';
import { MindMeshAPIClient, mindMeshClient } from '../api/mindmesh-client';

/**
 * API-based storage implementation
 * Uses the MindMesh REST API for all storage operations
 */
export class APIStorageBackend implements StorageBackend {
  private client: MindMeshAPIClient;
  private initialized = false;

  // Local cache of workspace data to avoid excessive API calls
  private workspaceCache: Map<string, Workspace> = new Map();
  private cacheTimestamps: Map<string, number> = new Map();
  private cacheTTL = 30000; // 30 seconds cache TTL

  constructor(client?: MindMeshAPIClient) {
    // Allow dependency injection for testing, or use singleton
    this.client = client || mindMeshClient;
  }

  /**
   * Initialize the storage backend
   * Sets up the API client and verifies connectivity
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('[APIStorageBackend] Initializing...');

      // The client doesn't need explicit initialization
      // Connection will be verified on first API call

      this.initialized = true;
      console.log('[APIStorageBackend] Initialization successful');
    } catch (error) {
      console.error('[APIStorageBackend] Initialization failed:', error);
      throw StorageError.initializationError(
        'Failed to initialize API storage backend',
        error as Error
      );
    }
  }

  /**
   * Set authentication token provider
   * This should be called to configure JWT token retrieval
   */
  setAuthTokenProvider(provider: () => Promise<string>): void {
    this.client.setAuthTokenProvider(provider);
  }

  /**
   * Get cache key for a user
   */
  private getCacheKey(userId: string | null): string {
    return userId || 'anonymous';
  }

  /**
   * Check if cached workspace is still valid
   */
  private isCacheValid(userId: string | null): boolean {
    const key = this.getCacheKey(userId);
    const timestamp = this.cacheTimestamps.get(key);

    if (!timestamp) return false;

    const age = Date.now() - timestamp;
    return age < this.cacheTTL;
  }

  /**
   * Get workspace from cache or load from API
   */
  private async getWorkspace(userId: string | null, forceRefresh = false): Promise<Workspace> {
    const key = this.getCacheKey(userId);

    // Return cached version if valid and not forcing refresh
    if (!forceRefresh && this.isCacheValid(userId)) {
      const cached = this.workspaceCache.get(key);
      if (cached) {
        console.log('[APIStorageBackend] Using cached workspace');
        return cached;
      }
    }

    // Load from API
    console.log('[APIStorageBackend] Loading workspace from API');
    const workspace = await this.client.loadWorkspace(userId);

    // Update cache
    this.workspaceCache.set(key, workspace);
    this.cacheTimestamps.set(key, Date.now());

    return workspace;
  }

  /**
   * Update workspace in cache and optionally save to API
   */
  private async updateWorkspace(
    userId: string | null,
    workspace: Workspace,
    saveToAPI = true
  ): Promise<void> {
    const key = this.getCacheKey(userId);

    // Update cache
    this.workspaceCache.set(key, workspace);
    this.cacheTimestamps.set(key, Date.now());

    // Save to API if requested
    if (saveToAPI) {
      console.log('[APIStorageBackend] Saving workspace to API');
      await this.client.saveWorkspace(userId, workspace);
    }
  }

  /**
   * Invalidate workspace cache
   */
  private invalidateCache(userId: string | null): void {
    const key = this.getCacheKey(userId);
    this.workspaceCache.delete(key);
    this.cacheTimestamps.delete(key);
  }

  /**
   * Load entire workspace for a user
   */
  async loadWorkspace(userId: string | null): Promise<Workspace> {
    await this.ensureInitialized();

    try {
      return await this.getWorkspace(userId, true); // Force refresh on explicit load
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw StorageError.networkError('Failed to load workspace', error as Error);
    }
  }

  /**
   * Save entire workspace for a user
   */
  async saveWorkspace(userId: string | null, workspace: Workspace): Promise<void> {
    await this.ensureInitialized();

    try {
      await this.updateWorkspace(userId, workspace, true);
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw StorageError.networkError('Failed to save workspace', error as Error);
    }
  }

  /**
   * Get a single file by ID
   */
  async getFile(userId: string | null, fileId: string): Promise<File | null> {
    await this.ensureInitialized();

    try {
      const workspace = await this.getWorkspace(userId);
      return workspace.files.get(fileId) || null;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw StorageError.networkError('Failed to get file', error as Error);
    }
  }

  /**
   * Create a new file
   * Uses the dedicated POST /mindmesh/files endpoint
   */
  async createFile(userId: string | null, file: File): Promise<void> {
    await this.ensureInitialized();

    try {
      // Call API endpoint
      await this.client.createFile(userId, file);

      // Update local cache
      const workspace = await this.getWorkspace(userId);
      workspace.files.set(file.id, file);
      workspace.metadata.fileCount = workspace.files.size;
      workspace.metadata.lastAccessed = Date.now();

      // Update cache without calling API again (we just did)
      await this.updateWorkspace(userId, workspace, false);
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw StorageError.networkError('Failed to create file', error as Error);
    }
  }

  /**
   * Update an existing file
   * Uses the dedicated PUT /mindmesh/files/{id} endpoint
   */
  async updateFile(userId: string | null, file: File): Promise<void> {
    await this.ensureInitialized();

    try {
      // Call API endpoint
      await this.client.updateFile(userId, file);

      // Update local cache
      const workspace = await this.getWorkspace(userId);

      if (!workspace.files.has(file.id)) {
        throw StorageError.notFound(`File ${file.id}`);
      }

      workspace.files.set(file.id, file);
      workspace.metadata.lastAccessed = Date.now();

      // Update cache without calling API again (we just did)
      await this.updateWorkspace(userId, workspace, false);
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw StorageError.networkError('Failed to update file', error as Error);
    }
  }

  /**
   * Delete a file
   * Uses the dedicated DELETE /mindmesh/files/{id} endpoint
   */
  async deleteFile(userId: string | null, fileId: string): Promise<void> {
    await this.ensureInitialized();

    try {
      // Call API endpoint
      await this.client.deleteFile(userId, fileId);

      // Update local cache
      const workspace = await this.getWorkspace(userId);
      workspace.files.delete(fileId);
      workspace.metadata.fileCount = workspace.files.size;
      workspace.metadata.lastAccessed = Date.now();

      // Update cache without calling API again (we just did)
      await this.updateWorkspace(userId, workspace, false);
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw StorageError.networkError('Failed to delete file', error as Error);
    }
  }

  /**
   * Get a single folder by ID
   * Derives from workspace data
   */
  async getFolder(userId: string | null, folderId: string): Promise<Folder | null> {
    await this.ensureInitialized();

    try {
      const workspace = await this.getWorkspace(userId);
      return workspace.folders.get(folderId) || null;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw StorageError.networkError('Failed to get folder', error as Error);
    }
  }

  /**
   * Create a new folder
   * Loads workspace, adds folder, saves back
   */
  async createFolder(userId: string | null, folder: Folder): Promise<void> {
    await this.ensureInitialized();

    try {
      const workspace = await this.getWorkspace(userId);
      workspace.folders.set(folder.id, folder);
      workspace.metadata.folderCount = workspace.folders.size;
      workspace.metadata.lastAccessed = Date.now();

      await this.updateWorkspace(userId, workspace, true);
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw StorageError.networkError('Failed to create folder', error as Error);
    }
  }

  /**
   * Update an existing folder
   * Loads workspace, updates folder, saves back
   */
  async updateFolder(userId: string | null, folder: Folder): Promise<void> {
    await this.ensureInitialized();

    try {
      const workspace = await this.getWorkspace(userId);

      if (!workspace.folders.has(folder.id)) {
        throw StorageError.notFound(`Folder ${folder.id}`);
      }

      workspace.folders.set(folder.id, folder);
      workspace.metadata.lastAccessed = Date.now();

      await this.updateWorkspace(userId, workspace, true);
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw StorageError.networkError('Failed to update folder', error as Error);
    }
  }

  /**
   * Delete a folder
   * Loads workspace, removes folder, saves back
   */
  async deleteFolder(userId: string | null, folderId: string): Promise<void> {
    await this.ensureInitialized();

    try {
      const workspace = await this.getWorkspace(userId);
      workspace.folders.delete(folderId);
      workspace.metadata.folderCount = workspace.folders.size;
      workspace.metadata.lastAccessed = Date.now();

      await this.updateWorkspace(userId, workspace, true);
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw StorageError.networkError('Failed to delete folder', error as Error);
    }
  }

  /**
   * List all files (optionally filtered by parent folder)
   * Operates on cached workspace data
   */
  async listFiles(userId: string | null, parentFolderId?: string): Promise<File[]> {
    await this.ensureInitialized();

    try {
      const workspace = await this.getWorkspace(userId);
      let files = Array.from(workspace.files.values());

      // Filter by parent folder if specified
      if (parentFolderId) {
        files = files.filter((file) => {
          // Extract parent folder from path
          const pathParts = file.path.split('/');
          pathParts.pop(); // Remove file name
          const parentPath = pathParts.join('/');

          // Match against parent folder path
          const parentFolder = workspace.folders.get(parentFolderId);
          return parentFolder && parentPath === parentFolder.path;
        });
      }

      return files;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw StorageError.networkError('Failed to list files', error as Error);
    }
  }

  /**
   * List all folders (optionally filtered by parent folder)
   * Operates on cached workspace data
   */
  async listFolders(userId: string | null, parentFolderId?: string): Promise<Folder[]> {
    await this.ensureInitialized();

    try {
      const workspace = await this.getWorkspace(userId);
      let folders = Array.from(workspace.folders.values());

      // Filter by parent folder if specified
      if (parentFolderId) {
        const parentFolder = workspace.folders.get(parentFolderId);
        if (parentFolder) {
          folders = folders.filter(
            (folder) => folder.parentPath === parentFolder.path
          );
        } else {
          folders = [];
        }
      }

      return folders;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw StorageError.networkError('Failed to list folders', error as Error);
    }
  }

  /**
   * Search files by query (searches in name and content)
   * Operates on cached workspace data
   */
  async searchFiles(userId: string | null, query: string): Promise<File[]> {
    await this.ensureInitialized();

    try {
      const workspace = await this.getWorkspace(userId);
      const lowerQuery = query.toLowerCase();

      return Array.from(workspace.files.values()).filter(
        (file) =>
          file.name.toLowerCase().includes(lowerQuery) ||
          file.content.toLowerCase().includes(lowerQuery) ||
          file.path.toLowerCase().includes(lowerQuery)
      );
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw StorageError.networkError('Failed to search files', error as Error);
    }
  }

  /**
   * Get storage backend info (strategy, size, etc.)
   * Returns info derived from workspace metadata
   */
  async getStorageInfo(userId: string | null): Promise<StorageBackendInfo> {
    await this.ensureInitialized();

    try {
      const workspace = await this.getWorkspace(userId);

      return {
        strategy: 'single-document', // API backend uses single-document approach
        isMigrated: false, // API handles storage internally
        itemCount: workspace.files.size + workspace.folders.size,
        sizeBytes: workspace.metadata.sizeBytes || 0,
      };
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw StorageError.networkError('Failed to get storage info', error as Error);
    }
  }

  /**
   * Clear all data for a user
   * Saves an empty workspace to the API
   */
  async clearUserData(userId: string | null): Promise<void> {
    await this.ensureInitialized();

    try {
      // Create empty workspace
      const emptyWorkspace: Workspace = {
        files: new Map(),
        folders: new Map(),
        metadata: {
          fileCount: 0,
          folderCount: 0,
          lastAccessed: Date.now(),
          sizeBytes: 0,
        },
      };

      // Save to API
      await this.client.saveWorkspace(userId, emptyWorkspace);

      // Clear cache
      this.invalidateCache(userId);
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw StorageError.networkError('Failed to clear user data', error as Error);
    }
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
   * Clear all caches (useful for testing or logout)
   */
  clearCache(): void {
    this.workspaceCache.clear();
    this.cacheTimestamps.clear();
    console.log('[APIStorageBackend] Cache cleared');
  }

  /**
   * Get circuit breaker state (for debugging)
   */
  getCircuitBreakerState(): string {
    return this.client.getCircuitBreakerState();
  }

  /**
   * Reset circuit breaker (for testing)
   */
  resetCircuitBreaker(): void {
    this.client.resetCircuitBreaker();
  }
}
