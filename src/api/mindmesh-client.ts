/**
 * MindMesh API Client
 *
 * TypeScript client for interacting with the MindMesh backend API.
 * Replaces direct DynamoDB access with REST API calls.
 *
 * Features:
 * - JWT token authentication (Cognito)
 * - Automatic retry with exponential backoff
 * - Circuit breaker pattern for fault tolerance
 * - Type-safe request/response handling
 * - Error conversion to StorageError types
 */

import { File, Folder } from '../models/types';
import {
  Workspace,
  WorkspaceMetadata,
  StorageBackendInfo,
  StorageError,
  StorageErrorType,
} from '../storage/StorageBackend.interface';
import { apiConfig, API_ENDPOINTS, getApiUrl } from '../config/api';

/**
 * Response types matching backend Pydantic models
 */
export interface WorkspaceResponse {
  workspace: {
    files: Record<string, File>;
    folders: Record<string, Folder>;
    metadata: WorkspaceMetadata;
  };
  storageInfo: StorageBackendInfo;
}

export interface SaveWorkspaceResponse {
  success: boolean;
  migrated: boolean;
  migrationResult?: {
    itemsMigrated: number;
    duration: number;
    strategy: string;
  };
  storageInfo: StorageBackendInfo;
}

export interface CreateFileResponse {
  success: boolean;
  fileId: string;
  migrated: boolean;
  storageInfo: StorageBackendInfo;
}

export interface UpdateFileResponse {
  success: boolean;
  fileId: string;
  migrated: boolean;
}

export interface DeleteFileResponse {
  success: boolean;
  fileId: string;
  deleted: boolean;
}

export interface ErrorResponse {
  error: {
    type: string;
    message: string;
    retryable: boolean;
    recommendation?: string;
  };
}

/**
 * Circuit breaker states
 */
enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

/**
 * Circuit breaker for preventing cascading failures
 */
class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  private successCount = 0;

  constructor(
    private threshold = 5, // Open after 5 failures
    private timeout = 60000, // Keep open for 60 seconds
    private halfOpenSuccesses = 2 // Require 2 successes to close
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (this.lastFailureTime) {
        const elapsed = Date.now() - this.lastFailureTime;
        if (elapsed >= this.timeout) {
          console.log('[CircuitBreaker] Transitioning to HALF_OPEN');
          this.state = CircuitState.HALF_OPEN;
          this.successCount = 0;
        } else {
          throw StorageError.networkError('Circuit breaker is OPEN, rejecting request');
        }
      }
    }

    try {
      const result = await fn();

      // Success - update state
      if (this.state === CircuitState.HALF_OPEN) {
        this.successCount++;
        if (this.successCount >= this.halfOpenSuccesses) {
          console.log('[CircuitBreaker] Transitioning to CLOSED');
          this.state = CircuitState.CLOSED;
          this.failureCount = 0;
        }
      } else if (this.state === CircuitState.CLOSED) {
        this.failureCount = 0; // Reset on success
      }

      return result;
    } catch (error) {
      // Failure - update state
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.state === CircuitState.HALF_OPEN) {
        console.log('[CircuitBreaker] HALF_OPEN test failed, reopening circuit');
        this.state = CircuitState.OPEN;
        this.successCount = 0;
      } else if (this.state === CircuitState.CLOSED && this.failureCount >= this.threshold) {
        console.log(`[CircuitBreaker] Threshold reached (${this.failureCount} failures), opening circuit`);
        this.state = CircuitState.OPEN;
      }

      throw error;
    }
  }

  getState(): string {
    return this.state;
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
  }
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: any): boolean {
  // Network errors
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return true;
  }

  // HTTP status codes
  if (error.statusCode) {
    return error.statusCode === 429 || error.statusCode >= 500;
  }

  // StorageError types
  if (error instanceof StorageError) {
    return error.type === StorageErrorType.THROTTLED || error.type === StorageErrorType.NETWORK_ERROR;
  }

  return false;
}

/**
 * Calculate retry delay with exponential backoff
 */
function calculateDelay(attempt: number, baseDelay: number, maxDelay: number, useJitter: boolean): number {
  let delay = baseDelay * Math.pow(2, attempt);
  delay = Math.min(delay, maxDelay);

  if (useJitter) {
    delay = Math.random() * delay;
  }

  return delay;
}

/**
 * Retry function with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = apiConfig.retryAttempts,
  baseDelay = apiConfig.retryDelay,
  maxDelay = 5000,
  useJitter = true
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      if (!isRetryableError(error)) {
        throw error;
      }

      // Don't retry if we've exhausted all attempts
      if (attempt >= maxRetries) {
        break;
      }

      // Calculate delay and wait
      const delay = calculateDelay(attempt, baseDelay, maxDelay, useJitter);
      console.log(`[Retry] Attempt ${attempt + 1}/${maxRetries + 1} failed, retrying in ${delay}ms...`);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  console.log(`[Retry] All ${maxRetries + 1} attempts failed`);
  throw lastError;
}

/**
 * Convert HTTP error response to StorageError
 */
function convertHttpError(statusCode: number, errorResponse: ErrorResponse): StorageError {
  const { type, message, retryable } = errorResponse.error;

  // Map error type string to StorageErrorType enum
  const errorTypeMap: Record<string, StorageErrorType> = {
    NOT_FOUND: StorageErrorType.NOT_FOUND,
    PERMISSION_DENIED: StorageErrorType.PERMISSION_DENIED,
    QUOTA_EXCEEDED: StorageErrorType.QUOTA_EXCEEDED,
    NETWORK_ERROR: StorageErrorType.NETWORK_ERROR,
    THROTTLED: StorageErrorType.THROTTLED,
    VERSION_CONFLICT: StorageErrorType.VERSION_CONFLICT,
    INVALID_DATA: StorageErrorType.INVALID_DATA,
    INITIALIZATION_ERROR: StorageErrorType.INITIALIZATION_ERROR,
    UNKNOWN: StorageErrorType.UNKNOWN,
  };

  const errorType = errorTypeMap[type] || StorageErrorType.UNKNOWN;

  const error = new StorageError(errorType, message);
  (error as any).statusCode = statusCode;
  (error as any).retryable = retryable;

  return error;
}

/**
 * MindMesh API Client
 */
export class MindMeshAPIClient {
  private circuitBreaker: CircuitBreaker;
  private authTokenProvider: (() => Promise<string>) | null = null;

  constructor() {
    this.circuitBreaker = new CircuitBreaker(5, 60000, 2);
  }

  /**
   * Set authentication token provider
   * This should be called during initialization with a function that returns the current JWT token
   */
  setAuthTokenProvider(provider: () => Promise<string>): void {
    this.authTokenProvider = provider;
  }

  /**
   * Get authentication token
   */
  private async getAuthToken(): Promise<string | null> {
    if (!this.authTokenProvider) {
      console.warn('[MindMesh API] No auth token provider set');
      return null;
    }

    try {
      return await this.authTokenProvider();
    } catch (error) {
      console.error('[MindMesh API] Failed to get auth token:', error);
      return null;
    }
  }

  /**
   * Make HTTP request with retry and circuit breaker
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    return this.circuitBreaker.execute(async () => {
      return retryWithBackoff(async () => {
        const url = getApiUrl(endpoint);
        const token = await this.getAuthToken();

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        if (options.headers && typeof options.headers === 'object' && !Array.isArray(options.headers)) {
          Object.assign(headers, options.headers);
        }

        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), apiConfig.timeout);

        try {
          const response = await fetch(url, {
            ...options,
            headers,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          // Handle error responses
          if (!response.ok) {
            const errorResponse: ErrorResponse = await response.json();
            throw convertHttpError(response.status, errorResponse);
          }

          // Parse successful response
          return await response.json();
        } catch (error) {
          clearTimeout(timeoutId);

          // Convert fetch errors to StorageError
          if (error instanceof StorageError) {
            throw error;
          }

          if ((error as any).name === 'AbortError') {
            throw StorageError.networkError('Request timeout');
          }

          throw StorageError.networkError(`Network request failed: ${(error as Error).message}`, error as Error);
        }
      });
    });
  }

  /**
   * Load workspace for authenticated user
   */
  async loadWorkspace(_userId: string | null): Promise<Workspace> {
    const response = await this.request<WorkspaceResponse>(API_ENDPOINTS.WORKSPACE, {
      method: 'GET',
    });

    // Convert response format to internal Workspace format
    return {
      files: new Map(Object.entries(response.workspace.files)),
      folders: new Map(Object.entries(response.workspace.folders)),
      metadata: response.workspace.metadata,
    };
  }

  /**
   * Save workspace for authenticated user
   */
  async saveWorkspace(_userId: string | null, workspace: Workspace): Promise<void> {
    // Convert Map to object for JSON serialization
    const workspaceData = {
      files: Object.fromEntries(workspace.files),
      folders: Object.fromEntries(workspace.folders),
      metadata: workspace.metadata,
    };

    await this.request<SaveWorkspaceResponse>(API_ENDPOINTS.WORKSPACE, {
      method: 'PUT',
      body: JSON.stringify({ workspace: workspaceData }),
    });
  }

  /**
   * Create a new file
   */
  async createFile(_userId: string | null, file: File): Promise<void> {
    await this.request<CreateFileResponse>(API_ENDPOINTS.FILES, {
      method: 'POST',
      body: JSON.stringify({ file }),
    });
  }

  /**
   * Update an existing file
   */
  async updateFile(_userId: string | null, file: File): Promise<void> {
    await this.request<UpdateFileResponse>(API_ENDPOINTS.FILE_BY_ID(file.id), {
      method: 'PUT',
      body: JSON.stringify({ file }),
    });
  }

  /**
   * Delete a file
   */
  async deleteFile(_userId: string | null, fileId: string): Promise<void> {
    await this.request<DeleteFileResponse>(API_ENDPOINTS.FILE_BY_ID(fileId), {
      method: 'DELETE',
    });
  }

  /**
   * Get circuit breaker state (for debugging)
   */
  getCircuitBreakerState(): string {
    return this.circuitBreaker.getState();
  }

  /**
   * Reset circuit breaker (for testing)
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
  }
}

/**
 * Export singleton instance
 */
export const mindMeshClient = new MindMeshAPIClient();
