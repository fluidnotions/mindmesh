// Public API Facade for NotesApp integration

import { createRoot, Root } from 'react-dom/client';
import { createElement } from 'react';
import { File, Folder, EditorViewMode } from '../models/types';
import {
  NotesAppConfig,
  NotesAppEvent,
  NotesAppEventMap,
  WorkspaceData,
  FileQueryOptions,
  WorkspaceStats,
  EventHandler,
} from './types';
import { NotesAppEventEmitter } from './EventEmitter';
import App from '../App';

/**
 * NotesAppFacade - Public API for embedding and controlling the NotesApp
 *
 * This class provides a clean interface for parent applications to:
 * - Mount/unmount the notes app in any DOM element
 * - Programmatically create, update, delete files and folders
 * - Listen to state changes via events
 * - Import/export workspace data
 * - Integrate with custom storage backends (e.g., DynamoDB)
 *
 * @example
 * ```typescript
 * const notesApp = new NotesAppFacade();
 *
 * notesApp.mount(document.getElementById('notes-container'), {
 *   initialViewMode: 'split',
 *   onReady: () => console.log('App ready!'),
 * });
 *
 * notesApp.on('file:created', (event) => {
 *   console.log('New file:', event.file.name);
 * });
 *
 * const file = await notesApp.createFile('My Note', '/My Note', '# Hello');
 * ```
 */
export class NotesAppFacade {
  private root: Root | null = null;
  private mountElement: HTMLElement | null = null;
  private eventEmitter: NotesAppEventEmitter;
  private config: NotesAppConfig | null = null;
  private contextRef: any = null; // Will hold reference to AppContext

  // Internal state (synchronized with React context)
  private files: Map<string, File> = new Map();
  private folders: Map<string, Folder> = new Map();
  private currentFileId: string | null = null;
  private editorViewMode: EditorViewMode = 'edit';
  private showGraphView: boolean = false;

  constructor() {
    this.eventEmitter = new NotesAppEventEmitter();
  }

  /**
   * Mount the NotesApp into a DOM element
   */
  mount(element: HTMLElement, config: NotesAppConfig = {}): void {
    if (this.root) {
      throw new Error('NotesApp is already mounted. Call unmount() first.');
    }

    if (!element) {
      throw new Error('Mount element is required');
    }

    this.mountElement = element;
    this.config = config;

    // Apply custom className
    if (config.className) {
      element.classList.add(config.className);
    }

    // Create React root and render App
    this.root = createRoot(element);

    // Render App component with facade prop
    this.root.render(createElement(App as any, {
      facade: this,
    }));

    // Call onReady callback
    if (config.onReady) {
      // Use setTimeout to ensure React has finished initial render
      setTimeout(() => config.onReady!(), 0);
    }

    this.eventEmitter.emit(NotesAppEvent.WORKSPACE_LOADED, {
      fileCount: this.files.size,
      folderCount: this.folders.size,
    });
  }

  /**
   * Unmount the NotesApp from the DOM
   */
  unmount(): void {
    if (this.root && this.mountElement) {
      this.root.unmount();
      this.root = null;

      if (this.config?.className) {
        this.mountElement.classList.remove(this.config.className);
      }

      this.mountElement = null;
      this.config = null;
      this.eventEmitter.removeAllListeners();
    }
  }

  /**
   * Check if the app is currently mounted
   */
  isMounted(): boolean {
    return this.root !== null;
  }

  // ========================================
  // FILE OPERATIONS
  // ========================================

  /**
   * Create a new file
   */
  async createFile(name: string, path: string, content: string = ''): Promise<File> {
    this.ensureMounted();

    if (!this.contextRef) {
      throw new Error('Context not available');
    }

    const file = this.contextRef.createNewFile(name, path, content);

    this.eventEmitter.emit(NotesAppEvent.FILE_CREATED, { file });

    return file;
  }

  /**
   * Update an existing file's content
   */
  async updateFile(fileId: string, content: string): Promise<void> {
    this.ensureMounted();

    const file = this.files.get(fileId);
    if (!file) {
      throw new Error(`File not found: ${fileId}`);
    }

    const previousContent = file.content;

    this.contextRef?.updateFile(fileId, content);

    const updatedFile = this.files.get(fileId);
    if (updatedFile) {
      this.eventEmitter.emit(NotesAppEvent.FILE_UPDATED, {
        file: updatedFile,
        previousContent,
      });
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId: string): Promise<void> {
    this.ensureMounted();

    const file = this.files.get(fileId);
    if (!file) {
      throw new Error(`File not found: ${fileId}`);
    }

    const fileName = file.name;

    this.contextRef?.deleteFile(fileId);

    this.eventEmitter.emit(NotesAppEvent.FILE_DELETED, {
      fileId,
      fileName,
    });
  }

  /**
   * Rename a file
   */
  async renameFile(fileId: string, newName: string, newPath: string): Promise<void> {
    this.ensureMounted();

    if (!this.files.has(fileId)) {
      throw new Error(`File not found: ${fileId}`);
    }

    this.contextRef?.renameFileById(fileId, newName, newPath);
  }

  /**
   * Get a file by ID
   */
  getFile(fileId: string): File | undefined {
    return this.files.get(fileId);
  }

  /**
   * Get all files
   */
  getAllFiles(): File[] {
    return Array.from(this.files.values());
  }

  /**
   * Query files with filters
   */
  queryFiles(options: FileQueryOptions = {}): File[] {
    let results = this.getAllFiles();

    // Filter by parent folder
    if (options.parentFolderId !== undefined) {
      results = results.filter((f) => {
        // If parentFolderId is null, match root files
        if (options.parentFolderId === null) {
          return !f.path.includes('/') || f.path === `/${f.name}`;
        }
        // Otherwise match files in that folder
        const folder = this.folders.get(options.parentFolderId!);
        return folder && f.path.startsWith(folder.path + '/');
      });
    }

    // Filter by name
    if (options.nameContains) {
      const search = options.nameContains.toLowerCase();
      results = results.filter((f) => f.name.toLowerCase().includes(search));
    }

    // Sort
    if (options.sortBy) {
      results.sort((a, b) => {
        let aVal: any, bVal: any;

        switch (options.sortBy) {
          case 'name':
            aVal = a.name.toLowerCase();
            bVal = b.name.toLowerCase();
            break;
          case 'created':
            aVal = a.created;
            bVal = b.created;
            break;
          case 'modified':
            aVal = a.modified;
            bVal = b.modified;
            break;
          default:
            return 0;
        }

        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return options.sortDirection === 'desc' ? -comparison : comparison;
      });
    }

    return results;
  }

  // ========================================
  // FOLDER OPERATIONS
  // ========================================

  /**
   * Create a new folder
   */
  async createFolder(name: string, path: string): Promise<Folder> {
    this.ensureMounted();

    const folder = this.contextRef?.createNewFolder(name, path);

    this.eventEmitter.emit(NotesAppEvent.FOLDER_CREATED, { folder });

    return folder;
  }

  /**
   * Delete a folder
   */
  async deleteFolder(folderId: string): Promise<void> {
    this.ensureMounted();

    const folder = this.folders.get(folderId);
    if (!folder) {
      throw new Error(`Folder not found: ${folderId}`);
    }

    const folderName = folder.name;

    this.contextRef?.deleteFolder(folderId);

    this.eventEmitter.emit(NotesAppEvent.FOLDER_DELETED, {
      folderId,
      folderName,
    });
  }

  /**
   * Get a folder by ID
   */
  getFolder(folderId: string): Folder | undefined {
    return this.folders.get(folderId);
  }

  /**
   * Get all folders
   */
  getAllFolders(): Folder[] {
    return Array.from(this.folders.values());
  }

  // ========================================
  // NAVIGATION
  // ========================================

  /**
   * Open a file (set as current)
   */
  openFile(fileId: string): void {
    this.ensureMounted();

    const file = this.files.get(fileId);
    if (!file) {
      throw new Error(`File not found: ${fileId}`);
    }

    this.contextRef?.setCurrentFile(fileId);

    this.eventEmitter.emit(NotesAppEvent.FILE_OPENED, { file });
  }

  /**
   * Get the currently open file
   */
  getCurrentFile(): File | undefined {
    if (this.currentFileId) {
      return this.files.get(this.currentFileId);
    }
    return undefined;
  }

  /**
   * Close the current file
   */
  closeCurrentFile(): void {
    this.ensureMounted();
    this.contextRef?.setCurrentFile(null);
  }

  // ========================================
  // VIEW SETTINGS
  // ========================================

  /**
   * Set the editor view mode
   */
  setViewMode(mode: EditorViewMode): void {
    this.ensureMounted();

    const previousMode = this.editorViewMode;
    this.contextRef?.setEditorViewMode(mode);

    this.eventEmitter.emit(NotesAppEvent.VIEW_MODE_CHANGED, {
      mode,
      previousMode,
    });
  }

  /**
   * Get the current view mode
   */
  getViewMode(): EditorViewMode {
    return this.editorViewMode;
  }

  /**
   * Toggle the graph view
   */
  toggleGraphView(): void {
    this.ensureMounted();

    this.contextRef?.toggleGraphView();

    this.eventEmitter.emit(NotesAppEvent.GRAPH_TOGGLED, {
      visible: !this.showGraphView,
    });
  }

  /**
   * Show or hide the graph view
   */
  setGraphViewVisible(visible: boolean): void {
    if (this.showGraphView !== visible) {
      this.toggleGraphView();
    }
  }

  // ========================================
  // WORKSPACE OPERATIONS
  // ========================================

  /**
   * Get the complete workspace data
   */
  getWorkspace(): WorkspaceData {
    const filesObj: Record<string, File> = {};
    this.files.forEach((file, id) => {
      filesObj[id] = file;
    });

    const foldersObj: Record<string, Folder> = {};
    this.folders.forEach((folder, id) => {
      foldersObj[id] = folder;
    });

    return {
      files: filesObj,
      folders: foldersObj,
      metadata: {
        version: '1.0.0',
        exportedAt: Date.now(),
        fileCount: this.files.size,
        folderCount: this.folders.size,
      },
    };
  }

  /**
   * Import workspace data
   */
  async importWorkspace(data: WorkspaceData): Promise<void> {
    this.ensureMounted();

    // Convert objects back to Maps
    const filesMap = new Map(Object.entries(data.files));
    const foldersMap = new Map(Object.entries(data.folders));

    // Update internal state
    this.files = filesMap;
    this.folders = foldersMap;

    // Trigger re-render with new data
    // This would require exposing a method in AppContext
    // For now, we'll save to storage and reload
    if (this.config?.enableLocalStorage !== false) {
      const { saveFiles, saveFolders } = await import('../services/storageService');
      saveFiles(filesMap);
      saveFolders(foldersMap);
    }

    this.eventEmitter.emit(NotesAppEvent.WORKSPACE_LOADED, {
      fileCount: this.files.size,
      folderCount: this.folders.size,
    });
  }

  /**
   * Export workspace data as JSON
   */
  exportWorkspace(): string {
    return JSON.stringify(this.getWorkspace(), null, 2);
  }

  /**
   * Get workspace statistics
   */
  getStats(): WorkspaceStats {
    let totalContentLength = 0;
    let linkCount = 0;
    let lastModified = 0;

    this.files.forEach((file) => {
      totalContentLength += file.content.length;
      linkCount += file.links.length;
      lastModified = Math.max(lastModified, file.modified);
    });

    return {
      fileCount: this.files.size,
      folderCount: this.folders.size,
      totalContentLength,
      linkCount,
      lastModified,
    };
  }

  /**
   * Clear all data
   */
  async clearWorkspace(): Promise<void> {
    this.ensureMounted();

    // Clear internal state
    this.files.clear();
    this.folders.clear();
    this.currentFileId = null;

    // Clear storage
    if (this.config?.enableLocalStorage !== false) {
      const { clearStorage } = await import('../services/storageService');
      clearStorage();
    }
  }

  // ========================================
  // EVENT SYSTEM
  // ========================================

  /**
   * Subscribe to an event
   */
  on<E extends NotesAppEvent>(
    event: E,
    handler: EventHandler<NotesAppEventMap[E]>
  ): () => void {
    return this.eventEmitter.on(event, handler);
  }

  /**
   * Subscribe to an event once
   */
  once<E extends NotesAppEvent>(
    event: E,
    handler: EventHandler<NotesAppEventMap[E]>
  ): void {
    this.eventEmitter.once(event, handler);
  }

  /**
   * Unsubscribe from an event
   */
  off<E extends NotesAppEvent>(
    event: E,
    handler: EventHandler<NotesAppEventMap[E]>
  ): void {
    this.eventEmitter.off(event, handler);
  }

  // ========================================
  // INTERNAL METHODS
  // ========================================

  /**
   * Internal: Update state from React context
   * Called by the App component to sync state
   */
  _updateState(state: {
    files: Map<string, File>;
    folders: Map<string, Folder>;
    currentFileId: string | null;
    editorViewMode: EditorViewMode;
    showGraphView: boolean;
  }): void {
    this.files = state.files;
    this.folders = state.folders;
    this.currentFileId = state.currentFileId;
    this.editorViewMode = state.editorViewMode;
    this.showGraphView = state.showGraphView;
  }

  /**
   * Internal: Set context reference
   * Called by the App component to provide access to context methods
   */
  _setContextRef(contextRef: any): void {
    this.contextRef = contextRef;
  }

  /**
   * Ensure the app is mounted before operations
   */
  private ensureMounted(): void {
    if (!this.isMounted()) {
      throw new Error('NotesApp must be mounted before calling this method');
    }
  }
}

// Export singleton instance for convenience
export const notesApp = new NotesAppFacade();
