// Public API types for external integration
import { File, Folder, EditorViewMode } from '../models/types';

/**
 * Configuration options for mounting the Notes app
 */
export interface NotesAppConfig {
  /** Initial view mode for the editor */
  initialViewMode?: EditorViewMode;

  /** Whether to show the graph view button */
  showGraphButton?: boolean;

  /** Custom CSS class for the root element */
  className?: string;

  /** Initial workspace data to load */
  initialWorkspace?: WorkspaceData;

  /** Whether to persist to localStorage */
  enableLocalStorage?: boolean;

  /** Custom storage backend (for DynamoDB integration) */
  storageBackend?: StorageBackend;

  /** Callback when app is ready */
  onReady?: () => void;

  /** Callback when app encounters an error */
  onError?: (error: Error) => void;
}

/**
 * Complete workspace data structure for import/export
 */
export interface WorkspaceData {
  files: Record<string, File>;
  folders: Record<string, Folder>;
  metadata?: {
    version: string;
    exportedAt: number;
    fileCount: number;
    folderCount: number;
  };
}

/**
 * Event types emitted by the NotesApp
 */
export enum NotesAppEvent {
  FILE_CREATED = 'file:created',
  FILE_UPDATED = 'file:updated',
  FILE_DELETED = 'file:deleted',
  FILE_OPENED = 'file:opened',
  FOLDER_CREATED = 'folder:created',
  FOLDER_DELETED = 'folder:deleted',
  WORKSPACE_LOADED = 'workspace:loaded',
  WORKSPACE_SAVED = 'workspace:saved',
  VIEW_MODE_CHANGED = 'view:mode-changed',
  GRAPH_TOGGLED = 'graph:toggled',
}

/**
 * Event payload structures
 */
export interface FileCreatedEvent {
  file: File;
}

export interface FileUpdatedEvent {
  file: File;
  previousContent: string;
}

export interface FileDeletedEvent {
  fileId: string;
  fileName: string;
}

export interface FileOpenedEvent {
  file: File;
}

export interface FolderCreatedEvent {
  folder: Folder;
}

export interface FolderDeletedEvent {
  folderId: string;
  folderName: string;
}

export interface WorkspaceLoadedEvent {
  fileCount: number;
  folderCount: number;
}

export interface WorkspaceSavedEvent {
  timestamp: number;
}

export interface ViewModeChangedEvent {
  mode: EditorViewMode;
  previousMode: EditorViewMode;
}

export interface GraphToggledEvent {
  visible: boolean;
}

/**
 * Type-safe event map
 */
export type NotesAppEventMap = {
  [NotesAppEvent.FILE_CREATED]: FileCreatedEvent;
  [NotesAppEvent.FILE_UPDATED]: FileUpdatedEvent;
  [NotesAppEvent.FILE_DELETED]: FileDeletedEvent;
  [NotesAppEvent.FILE_OPENED]: FileOpenedEvent;
  [NotesAppEvent.FOLDER_CREATED]: FolderCreatedEvent;
  [NotesAppEvent.FOLDER_DELETED]: FolderDeletedEvent;
  [NotesAppEvent.WORKSPACE_LOADED]: WorkspaceLoadedEvent;
  [NotesAppEvent.WORKSPACE_SAVED]: WorkspaceSavedEvent;
  [NotesAppEvent.VIEW_MODE_CHANGED]: ViewModeChangedEvent;
  [NotesAppEvent.GRAPH_TOGGLED]: GraphToggledEvent;
};

/**
 * Event handler type
 */
export type EventHandler<T = any> = (event: T) => void;

/**
 * Storage backend interface for custom implementations (e.g., DynamoDB)
 */
export interface StorageBackend {
  /**
   * Load the complete workspace for a user
   */
  loadWorkspace(userId?: string): Promise<WorkspaceData>;

  /**
   * Save the complete workspace
   */
  saveWorkspace(workspace: WorkspaceData, userId?: string): Promise<void>;

  /**
   * Save a single file (optional, for optimization)
   */
  saveFile?(file: File, userId?: string): Promise<void>;

  /**
   * Save a single folder (optional, for optimization)
   */
  saveFolder?(folder: Folder, userId?: string): Promise<void>;

  /**
   * Delete a file (optional, for optimization)
   */
  deleteFile?(fileId: string, userId?: string): Promise<void>;

  /**
   * Delete a folder (optional, for optimization)
   */
  deleteFolder?(folderId: string, userId?: string): Promise<void>;
}

/**
 * Query options for filtering files
 */
export interface FileQueryOptions {
  /** Filter by parent folder */
  parentFolderId?: string;

  /** Search by name (case-insensitive) */
  nameContains?: string;

  /** Filter by tag (if tags are implemented) */
  tags?: string[];

  /** Sort order */
  sortBy?: 'name' | 'created' | 'modified';

  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
}

/**
 * Statistics about the workspace
 */
export interface WorkspaceStats {
  fileCount: number;
  folderCount: number;
  totalContentLength: number;
  linkCount: number;
  lastModified: number;
}
