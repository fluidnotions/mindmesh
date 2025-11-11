// Main library entry point
// Export the facade API and React components

// Import Tailwind styles
import './index.css';

// Main facade API
export { NotesAppFacade } from './api/NotesAppFacade';

// Types
export type {
  NotesAppConfig,
  WorkspaceData,
  NotesAppEventMap,
  EventHandler,
} from './api/types';

export { NotesAppEvent } from './api/types';

export type {
  File,
  Folder,
  EditorViewMode,
  GraphData,
  GraphNode,
  GraphLink,
} from './models/types';

// React components for embedding
export { default as App } from './App';
export { AppProvider, useApp } from './context/AppContext';
export { FileExplorer } from './components/FileExplorer/FileExplorer';
export { Editor } from './components/Editor/Editor';
export { GraphView } from './components/GraphView/GraphView';
export { Preview } from './components/Preview/Preview';

// Services for advanced usage
export { buildGraphData, getConnectedSubgraph } from './services/graphService';
export { buildKeywordIndex } from './services/linkIndexService';
export type { KeywordIndex } from './services/linkIndexService';

// Storage backends and types
export type { StorageBackend, StorageStrategy, WorkspaceMetadata, Workspace, StorageBackendInfo } from './storage';
export { StorageError, StorageErrorType } from './storage';

// Utilities
export { extractLinks, parseLinkReference, hasLink } from './utils/linkParser';

// i18n
export { default as i18n } from './i18n/config';

// CSS - users must import this separately
// import '@fluidnotions/mindmesh/css';
