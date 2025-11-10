/**
 * API Configuration for MindMesh Backend
 *
 * Environment-based configuration for API endpoints.
 * Supports development, staging, and production environments.
 */

/**
 * API environment types
 */
export type ApiEnvironment = 'development' | 'staging' | 'production';

/**
 * API configuration interface
 */
export interface ApiConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

/**
 * Get current environment from environment variables
 */
function getEnvironment(): ApiEnvironment {
  const env = import.meta.env.VITE_API_ENV || import.meta.env.MODE || 'development';

  if (env === 'production' || env === 'prod') {
    return 'production';
  }
  if (env === 'staging' || env === 'stage') {
    return 'staging';
  }
  return 'development';
}

/**
 * Environment-specific API base URLs
 */
const API_BASE_URLS: Record<ApiEnvironment, string> = {
  development: import.meta.env.VITE_API_URL_DEV || 'http://localhost:8000',
  staging: import.meta.env.VITE_API_URL_STAGING || '',
  production: import.meta.env.VITE_API_URL_PROD || '',
};

/**
 * Default API configuration
 */
const DEFAULT_CONFIG: Omit<ApiConfig, 'baseUrl'> = {
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
  retryDelay: 1000, // 1 second
};

/**
 * Get API configuration for current environment
 */
export function getApiConfig(): ApiConfig {
  const env = getEnvironment();
  const baseUrl = API_BASE_URLS[env];

  if (!baseUrl) {
    console.warn(`[API Config] No base URL configured for environment: ${env}`);
  }

  return {
    baseUrl,
    ...DEFAULT_CONFIG,
  };
}

/**
 * API endpoint paths
 */
export const API_ENDPOINTS = {
  // Workspace endpoints
  WORKSPACE: '/mindmesh/workspace',

  // File endpoints
  FILES: '/mindmesh/files',
  FILE_BY_ID: (fileId: string) => `/mindmesh/files/${fileId}`,

  // Health check (optional)
  HEALTH: '/health',
} as const;

/**
 * Get full API URL for an endpoint
 */
export function getApiUrl(endpoint: string): string {
  const config = getApiConfig();
  return `${config.baseUrl}${endpoint}`;
}

/**
 * Export singleton config instance
 */
export const apiConfig = getApiConfig();
