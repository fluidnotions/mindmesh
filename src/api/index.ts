// Public API exports

export { NotesAppFacade, notesApp } from './NotesAppFacade';
export { NotesAppEventEmitter } from './EventEmitter';
export { NotesAppEvent } from './types';
export type {
  NotesAppConfig,
  NotesAppEventMap,
  WorkspaceData,
  FileQueryOptions,
  WorkspaceStats,
  EventHandler,
  StorageBackend,
  FileCreatedEvent,
  FileUpdatedEvent,
  FileDeletedEvent,
  FileOpenedEvent,
  FolderCreatedEvent,
  FolderDeletedEvent,
  WorkspaceLoadedEvent,
  WorkspaceSavedEvent,
  ViewModeChangedEvent,
  GraphToggledEvent,
} from './types';

// Re-export types from models for convenience
export type { File, Folder, EditorViewMode, GraphData, GraphNode, GraphLink } from '../models/types';
