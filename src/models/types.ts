// File object structure as per spec
export interface File {
  id: string; // Unique identifier (UUID)
  name: string; // File name without extension
  content: string; // Markdown content
  path: string; // Full path including folder hierarchy
  created: number; // Creation date (timestamp)
  modified: number; // Last modification date (timestamp)
  links: string[]; // Extracted [[link]] references
}

// Folder object structure as per spec
export interface Folder {
  id: string; // Unique identifier
  name: string; // Folder name
  path: string; // Full path
  parentPath: string | null; // Parent folder path (null for root)
  children: (File | Folder)[]; // Child files and folders
}

// Graph data structure
export interface GraphNode {
  id: string;
  name: string;
  color?: string;
}

export interface GraphLink {
  source: string; // file id
  target: string; // linked file id
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

// View modes for the editor
export type EditorViewMode = 'edit' | 'preview' | 'split';

// App state structure
export interface AppState {
  files: Map<string, File>;
  folders: Map<string, Folder>;
  currentFileId: string | null;
  editorViewMode: EditorViewMode;
  showGraphView: boolean;
}
