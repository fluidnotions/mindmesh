/**
 * Retry Utilities
 * Implements exponential backoff with jitter for DynamoDB operations
 * Handles transient errors like throttling, network issues, etc.
 */

import { RETRY_CONFIG } from '../config/dynamodb.config';
import { StorageError, StorageErrorType } from './StorageBackend.interface';

/**
 * Retry configuration for a specific operation
 */
export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitter?: boolean;
  retryableErrors?: string[];
}

/**
 * Default retryable error codes from AWS SDK
 */
const DEFAULT_RETRYABLE_ERRORS = [
  'ProvisionedThroughputExceededException',
  'ThrottlingException',
  'RequestLimitExceeded',
  'InternalServerError',
  'ServiceUnavailable',
  'NetworkingError',
  'TimeoutError',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
];

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown, retryableErrors?: string[]): boolean {
  if (!error) return false;

  const errorCodes = retryableErrors || DEFAULT_RETRYABLE_ERRORS;

  // Check error name
  if (error instanceof Error) {
    if (errorCodes.includes(error.name)) return true;
  }

  // Check error code property (AWS SDK errors)
  const awsError = error as { code?: string; $metadata?: { httpStatusCode?: number } };
  if (awsError.code && errorCodes.includes(awsError.code)) {
    return true;
  }

  // Check HTTP status code
  if (awsError.$metadata?.httpStatusCode) {
    const statusCode = awsError.$metadata.httpStatusCode;
    // 429 = Too Many Requests, 500+ = Server errors
    if (statusCode === 429 || statusCode >= 500) {
      return true;
    }
  }

  return false;
}

/**
 * Calculate delay with exponential backoff and optional jitter
 */
export function calculateDelay(
  attemptNumber: number,
  baseDelayMs: number,
  maxDelayMs: number,
  useJitter: boolean
): number {
  // Exponential backoff: delay = baseDelay * 2^attemptNumber
  let delay = baseDelayMs * Math.pow(2, attemptNumber);

  // Cap at max delay
  delay = Math.min(delay, maxDelayMs);

  // Add jitter to prevent thundering herd
  if (useJitter) {
    // Random jitter between 0 and delay
    delay = Math.random() * delay;
  }

  return Math.floor(delay);
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = RETRY_CONFIG.MAX_RETRIES,
    baseDelayMs = RETRY_CONFIG.BASE_DELAY_MS,
    maxDelayMs = RETRY_CONFIG.MAX_DELAY_MS,
    jitter = RETRY_CONFIG.JITTER,
    retryableErrors,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Attempt the operation
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      if (!isRetryableError(error, retryableErrors)) {
        throw error;
      }

      // Don't retry if we've exhausted all attempts
      if (attempt >= maxRetries) {
        break;
      }

      // Calculate delay and wait
      const delay = calculateDelay(attempt, baseDelayMs, maxDelayMs, jitter);
      console.warn(
        `[Retry] Attempt ${attempt + 1}/${maxRetries + 1} failed, retrying in ${delay}ms...`,
        error
      );

      await sleep(delay);
    }
  }

  // All retries exhausted
  console.error(`[Retry] All ${maxRetries + 1} attempts failed`);
  throw lastError;
}

/**
 * Wrap a function with retry logic
 * Returns a new function that automatically retries on failure
 */
export function withRetry<Args extends unknown[], T>(
  fn: (...args: Args) => Promise<T>,
  options: RetryOptions = {}
): (...args: Args) => Promise<T> {
  return async (...args: Args): Promise<T> => {
    return retryWithBackoff(() => fn(...args), options);
  };
}

/**
 * Convert AWS SDK errors to StorageError
 */
export function convertAWSError(error: unknown): StorageError {
  if (error instanceof StorageError) {
    return error;
  }

  const awsError = error as {
    name?: string;
    code?: string;
    message?: string;
    $metadata?: { httpStatusCode?: number };
  };

  // Check for specific error types
  if (awsError.name === 'ConditionalCheckFailedException') {
    return StorageError.versionConflict();
  }

  if (
    awsError.name === 'ProvisionedThroughputExceededException' ||
    awsError.name === 'ThrottlingException' ||
    awsError.code === 'ThrottlingException'
  ) {
    return StorageError.throttled();
  }

  if (awsError.name === 'ResourceNotFoundException' || awsError.$metadata?.httpStatusCode === 404) {
    return StorageError.notFound('Resource not found');
  }

  if (awsError.name === 'AccessDeniedException' || awsError.$metadata?.httpStatusCode === 403) {
    return StorageError.permissionDenied('Access denied to DynamoDB');
  }

  if (awsError.name === 'ItemSizeLimitExceededException') {
    return StorageError.quotaExceeded('Item size exceeds DynamoDB 400KB limit');
  }

  // Network errors
  if (
    awsError.name === 'NetworkingError' ||
    awsError.name === 'TimeoutError' ||
    awsError.code === 'ECONNRESET' ||
    awsError.code === 'ETIMEDOUT'
  ) {
    return StorageError.networkError(
      awsError.message || 'Network error',
      error as Error
    );
  }

  // Default to unknown error
  return new StorageError(
    StorageErrorType.UNKNOWN,
    awsError.message || 'Unknown error occurred',
    error as Error
  );
}

/**
 * Batch retry for multiple operations
 * Useful for batch writes that partially fail
 */
export async function retryBatch<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  options: RetryOptions = {}
): Promise<{ succeeded: T[]; failed: Array<{ item: T; error: unknown }> }> {
  const succeeded: T[] = [];
  const failed: Array<{ item: T; error: unknown }> = [];

  for (const item of items) {
    try {
      await retryWithBackoff(() => fn(item), options);
      succeeded.push(item);
    } catch (error) {
      failed.push({ item, error });
    }
  }

  return { succeeded, failed };
}

/**
 * Circuit breaker state
 */
enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Circuit tripped, reject all requests
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

/**
 * Circuit breaker to prevent cascading failures
 * Temporarily stops making requests after too many failures
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;

  constructor(
    private threshold: number = 5, // Open circuit after 5 failures
    private timeout: number = 60000, // Keep circuit open for 60 seconds
    private halfOpenSuccesses: number = 2 // Require 2 successes to close circuit
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check circuit state
    if (this.state === CircuitState.OPEN) {
      // Check if timeout has elapsed
      if (Date.now() - this.lastFailureTime >= this.timeout) {
        console.log('[CircuitBreaker] Transitioning to HALF_OPEN');
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN, rejecting request');
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
      } else if (
        this.state === CircuitState.CLOSED &&
        this.failureCount >= this.threshold
      ) {
        console.log(
          `[CircuitBreaker] Threshold reached (${this.failureCount} failures), opening circuit`
        );
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
  }
}
