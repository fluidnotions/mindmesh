/**
 * Migration Service
 * Handles automatic migration from single-document to individual-items strategy
 * Triggered when user exceeds migration thresholds (500 files or 300KB)
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { SingleDocumentStorage } from './SingleDocumentStorage';
import { IndividualItemsStorage } from './IndividualItemsStorage';
import { MIGRATION_THRESHOLDS, shouldMigrate } from '../config/dynamodb.config';

/**
 * Migration status
 */
export interface MigrationStatus {
  isComplete: boolean;
  startedAt?: number;
  completedAt?: number;
  itemsMigrated: number;
  error?: string;
}

/**
 * Migration result
 */
export interface MigrationResult {
  success: boolean;
  itemsMigrated: number;
  duration: number;
  error?: string;
}

/**
 * Service to handle storage strategy migration
 */
export class MigrationService {
  private singleDocStorage: SingleDocumentStorage;
  private individualItemsStorage: IndividualItemsStorage;

  constructor(client: DynamoDBClient) {
    this.singleDocStorage = new SingleDocumentStorage(client);
    this.individualItemsStorage = new IndividualItemsStorage(client);
  }

  /**
   * Check if user needs migration based on current metrics
   */
  async needsMigration(userId: string | null): Promise<boolean> {
    try {
      const metrics = await this.singleDocStorage.getStorageMetrics(userId);
      return shouldMigrate(metrics.itemCount, metrics.sizeBytes);
    } catch (error) {
      console.error('Error checking migration need:', error);
      return false;
    }
  }

  /**
   * Get migration recommendation with details
   */
  async getMigrationRecommendation(
    userId: string | null
  ): Promise<{
    shouldMigrate: boolean;
    reason?: string;
    metrics: { itemCount: number; sizeBytes: number };
  }> {
    const metrics = await this.singleDocStorage.getStorageMetrics(userId);
    const { itemCount, sizeBytes } = metrics;

    let shouldMigrate = false;
    let reason: string | undefined;

    if (itemCount > MIGRATION_THRESHOLDS.MAX_FILE_COUNT) {
      shouldMigrate = true;
      reason = `File count (${itemCount}) exceeds threshold (${MIGRATION_THRESHOLDS.MAX_FILE_COUNT})`;
    } else if (sizeBytes > MIGRATION_THRESHOLDS.MAX_SIZE_BYTES) {
      shouldMigrate = true;
      reason = `Storage size (${Math.round(sizeBytes / 1024)}KB) exceeds threshold (${Math.round(MIGRATION_THRESHOLDS.MAX_SIZE_BYTES / 1024)}KB)`;
    }

    return {
      shouldMigrate,
      reason,
      metrics,
    };
  }

  /**
   * Perform migration from single-document to individual-items
   * This is a critical operation with multiple steps:
   * 1. Load workspace from single document
   * 2. Write all items to individual-items storage
   * 3. Verify migration success
   * 4. Delete old single-document item
   */
  async migrateToIndividualItems(userId: string | null): Promise<MigrationResult> {
    const startTime = Date.now();
    let itemsMigrated = 0;

    try {
      console.log(`[Migration] Starting migration for user: ${userId || 'anonymous'}`);

      // Step 1: Load workspace from single document
      console.log('[Migration] Step 1: Loading workspace from single document...');
      const workspace = await this.singleDocStorage.loadWorkspace(userId);

      if (workspace.files.size === 0 && workspace.folders.size === 0) {
        console.log('[Migration] No data to migrate, skipping...');
        return {
          success: true,
          itemsMigrated: 0,
          duration: Date.now() - startTime,
        };
      }

      console.log(
        `[Migration] Loaded ${workspace.files.size} files and ${workspace.folders.size} folders`
      );

      // Step 2: Write to individual-items storage
      console.log('[Migration] Step 2: Writing items to individual-items storage...');
      await this.individualItemsStorage.saveWorkspace(userId, workspace);

      itemsMigrated = workspace.files.size + workspace.folders.size + 1; // +1 for metadata
      console.log(`[Migration] Wrote ${itemsMigrated} items`);

      // Step 3: Verify migration by reading back
      console.log('[Migration] Step 3: Verifying migration...');
      const verifyWorkspace = await this.individualItemsStorage.loadWorkspace(userId);

      if (verifyWorkspace.files.size !== workspace.files.size) {
        throw new Error(
          `File count mismatch: expected ${workspace.files.size}, got ${verifyWorkspace.files.size}`
        );
      }

      if (verifyWorkspace.folders.size !== workspace.folders.size) {
        throw new Error(
          `Folder count mismatch: expected ${workspace.folders.size}, got ${verifyWorkspace.folders.size}`
        );
      }

      console.log('[Migration] Verification successful');

      // Step 4: Delete old single-document item
      console.log('[Migration] Step 4: Deleting old single-document...');
      await this.singleDocStorage.deleteWorkspace(userId);

      const duration = Date.now() - startTime;
      console.log(`[Migration] Migration completed successfully in ${duration}ms`);

      return {
        success: true,
        itemsMigrated,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      console.error('[Migration] Migration failed:', errorMessage);

      // Attempt rollback by cleaning up partial migration
      try {
        console.log('[Migration] Attempting rollback...');
        await this.individualItemsStorage.deleteAllItems(userId);
        console.log('[Migration] Rollback successful');
      } catch (rollbackError) {
        console.error('[Migration] Rollback failed:', rollbackError);
      }

      return {
        success: false,
        itemsMigrated,
        duration,
        error: errorMessage,
      };
    }
  }

  /**
   * Perform migration back from individual-items to single-document
   * This might be needed if user deletes many files and falls below threshold
   * (Optional optimization - not implemented by default)
   */
  async migrateToSingleDocument(userId: string | null): Promise<MigrationResult> {
    const startTime = Date.now();
    let itemsMigrated = 0;

    try {
      console.log(`[Migration] Starting reverse migration for user: ${userId || 'anonymous'}`);

      // Step 1: Load workspace from individual items
      console.log('[Migration] Step 1: Loading workspace from individual items...');
      const workspace = await this.individualItemsStorage.loadWorkspace(userId);

      console.log(
        `[Migration] Loaded ${workspace.files.size} files and ${workspace.folders.size} folders`
      );

      // Step 2: Check if workspace is small enough for single document
      const workspaceJson = JSON.stringify(workspace);
      const sizeBytes = new TextEncoder().encode(workspaceJson).length;

      if (sizeBytes > MIGRATION_THRESHOLDS.MAX_SIZE_BYTES) {
        throw new Error(
          `Workspace too large for single document: ${Math.round(sizeBytes / 1024)}KB`
        );
      }

      // Step 3: Write to single-document storage
      console.log('[Migration] Step 2: Writing to single-document storage...');
      await this.singleDocStorage.saveWorkspace(userId, workspace);

      itemsMigrated = workspace.files.size + workspace.folders.size;
      console.log(`[Migration] Migrated ${itemsMigrated} items`);

      // Step 4: Verify migration
      console.log('[Migration] Step 3: Verifying migration...');
      const verifyWorkspace = await this.singleDocStorage.loadWorkspace(userId);

      if (verifyWorkspace.files.size !== workspace.files.size) {
        throw new Error('File count mismatch after migration');
      }

      // Step 5: Delete individual items
      console.log('[Migration] Step 4: Deleting individual items...');
      await this.individualItemsStorage.deleteAllItems(userId);

      const duration = Date.now() - startTime;
      console.log(`[Migration] Reverse migration completed successfully in ${duration}ms`);

      return {
        success: true,
        itemsMigrated,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      console.error('[Migration] Reverse migration failed:', errorMessage);

      return {
        success: false,
        itemsMigrated,
        duration,
        error: errorMessage,
      };
    }
  }

  /**
   * Estimate migration time based on workspace size
   */
  async estimateMigrationTime(userId: string | null): Promise<{
    estimatedSeconds: number;
    itemCount: number;
  }> {
    const metrics = await this.singleDocStorage.getStorageMetrics(userId);
    const itemCount = metrics.itemCount;

    // Rough estimate: ~10ms per item + 1 second overhead
    const estimatedMs = itemCount * 10 + 1000;
    const estimatedSeconds = Math.ceil(estimatedMs / 1000);

    return {
      estimatedSeconds,
      itemCount,
    };
  }

  /**
   * Perform dry-run migration to check for potential issues
   * Does not actually migrate data, just validates
   */
  async dryRunMigration(userId: string | null): Promise<{
    canMigrate: boolean;
    issues: string[];
    itemCount: number;
  }> {
    const issues: string[] = [];

    try {
      // Load workspace
      const workspace = await this.singleDocStorage.loadWorkspace(userId);
      const itemCount = workspace.files.size + workspace.folders.size;

      // Check if workspace exists
      if (itemCount === 0) {
        issues.push('No data to migrate');
      }

      // Check for duplicate IDs
      const allIds = new Set<string>();
      workspace.files.forEach((file) => {
        if (allIds.has(file.id)) {
          issues.push(`Duplicate file ID: ${file.id}`);
        }
        allIds.add(file.id);
      });

      workspace.folders.forEach((folder) => {
        if (allIds.has(folder.id)) {
          issues.push(`Duplicate folder ID: ${folder.id}`);
        }
        allIds.add(folder.id);
      });

      // Check for invalid paths
      workspace.files.forEach((file) => {
        if (!file.path || file.path.trim() === '') {
          issues.push(`File ${file.id} has invalid path`);
        }
      });

      // Check for circular folder references
      // (This is a simplified check - full implementation would need graph traversal)
      workspace.folders.forEach((folder) => {
        if (folder.children.some((child) => child.id === folder.id)) {
          issues.push(`Folder ${folder.id} contains circular reference`);
        }
      });

      return {
        canMigrate: issues.length === 0,
        issues,
        itemCount,
      };
    } catch (error) {
      issues.push(`Failed to load workspace: ${error}`);
      return {
        canMigrate: false,
        issues,
        itemCount: 0,
      };
    }
  }
}
