import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotesAppFacade } from '../NotesAppFacade';
import { NotesAppEvent } from '../types';
import { File, Folder } from '../../models/types';

// Mock react-dom/client
vi.mock('react-dom/client', () => ({
  createRoot: vi.fn(() => ({
    render: vi.fn(),
    unmount: vi.fn(),
  })),
}));

// Mock the App component
vi.mock('../../App', () => ({
  default: vi.fn(() => null),
}));

describe('NotesAppFacade', () => {
  let facade: NotesAppFacade;
  let mockElement: HTMLElement;

  beforeEach(() => {
    facade = new NotesAppFacade();
    mockElement = document.createElement('div');
    document.body.appendChild(mockElement);
  });

  afterEach(() => {
    if (facade.isMounted()) {
      facade.unmount();
    }
    document.body.removeChild(mockElement);
  });

  describe('mount() and unmount()', () => {
    it('should mount the app to a DOM element', () => {
      expect(() => {
        facade.mount(mockElement);
      }).not.toThrow();

      expect(facade.isMounted()).toBe(true);
    });

    it('should throw error if already mounted', () => {
      facade.mount(mockElement);

      expect(() => {
        facade.mount(mockElement);
      }).toThrow('NotesApp is already mounted');
    });

    it('should throw error if no element provided', () => {
      expect(() => {
        facade.mount(null as any);
      }).toThrow('Mount element is required');
    });

    it('should apply custom className to mount element', () => {
      facade.mount(mockElement, { className: 'custom-class' });

      expect(mockElement.classList.contains('custom-class')).toBe(true);
    });

    it('should call onReady callback after mounting', () => {
      return new Promise<void>((resolve) => {
        facade.mount(mockElement, {
          onReady: () => {
            expect(facade.isMounted()).toBe(true);
            resolve();
          },
        });
      });
    });

    it('should emit WORKSPACE_LOADED event on mount', () => {
      return new Promise<void>((resolve) => {
        facade.on(NotesAppEvent.WORKSPACE_LOADED, (event) => {
          expect(event.fileCount).toBeDefined();
          expect(event.folderCount).toBeDefined();
          resolve();
        });

        facade.mount(mockElement);
      });
    });

    it('should unmount the app correctly', () => {
      facade.mount(mockElement);
      facade.unmount();

      expect(facade.isMounted()).toBe(false);
    });

    it('should remove custom className on unmount', () => {
      facade.mount(mockElement, { className: 'custom-class' });
      facade.unmount();

      expect(mockElement.classList.contains('custom-class')).toBe(false);
    });

    it('should remove all event listeners on unmount', () => {
      const handler = vi.fn();
      facade.mount(mockElement);
      facade.on(NotesAppEvent.FILE_CREATED, handler);

      facade.unmount();

      // Try to emit an event - handler should not be called
      facade['eventEmitter'].emit(NotesAppEvent.FILE_CREATED, {
        file: createMockFile(),
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle multiple mount/unmount cycles', () => {
      facade.mount(mockElement);
      facade.unmount();

      expect(() => {
        facade.mount(mockElement);
        facade.unmount();
      }).not.toThrow();
    });
  });

  describe('isMounted()', () => {
    it('should return false before mounting', () => {
      expect(facade.isMounted()).toBe(false);
    });

    it('should return true after mounting', () => {
      facade.mount(mockElement);
      expect(facade.isMounted()).toBe(true);
    });

    it('should return false after unmounting', () => {
      facade.mount(mockElement);
      facade.unmount();
      expect(facade.isMounted()).toBe(false);
    });
  });

  describe('File Operations', () => {
    beforeEach(() => {
      facade.mount(mockElement);
      // Mock the context reference
      const mockContext = {
        createNewFile: vi.fn((name: string, path: string, content: string) => {
          const file = createMockFile(name, path, content);
          facade['files'].set(file.id, file);
          return file;
        }),
        updateFile: vi.fn((fileId: string, content: string) => {
          const file = facade['files'].get(fileId);
          if (file) {
            file.content = content;
            file.modified = Date.now();
          }
        }),
        deleteFile: vi.fn((fileId: string) => {
          facade['files'].delete(fileId);
        }),
        renameFileById: vi.fn(),
        setCurrentFile: vi.fn(),
      };
      facade['contextRef'] = mockContext;
    });

    describe('createFile()', () => {
      it('should create a new file', async () => {
        const file = await facade.createFile('Test Note', '/Test Note', '# Hello');

        expect(file).toBeDefined();
        expect(file.name).toBe('Test Note');
        expect(file.content).toBe('# Hello');
      });

      it('should emit FILE_CREATED event', async () => {
        const handler = vi.fn();
        facade.on(NotesAppEvent.FILE_CREATED, handler);

        const file = await facade.createFile('Test', '/Test');

        expect(handler).toHaveBeenCalledWith({ file });
      });

      it('should throw if not mounted', async () => {
        facade.unmount();

        await expect(facade.createFile('Test', '/Test')).rejects.toThrow(
          'NotesApp must be mounted'
        );
      });
    });

    describe('updateFile()', () => {
      it('should update file content', async () => {
        const file = await facade.createFile('Test', '/Test', 'old content');

        await facade.updateFile(file.id, 'new content');

        const updatedFile = facade.getFile(file.id);
        expect(updatedFile?.content).toBe('new content');
      });

      it('should emit FILE_UPDATED event', async () => {
        const handler = vi.fn();
        const file = await facade.createFile('Test', '/Test', 'old content');

        facade.on(NotesAppEvent.FILE_UPDATED, handler);
        await facade.updateFile(file.id, 'new content');

        expect(handler).toHaveBeenCalledWith({
          file: expect.objectContaining({ id: file.id }),
          previousContent: 'old content',
        });
      });

      it('should throw if file not found', async () => {
        await expect(facade.updateFile('nonexistent', 'content')).rejects.toThrow(
          'File not found'
        );
      });

      it('should throw if not mounted', async () => {
        facade.unmount();

        await expect(facade.updateFile('id', 'content')).rejects.toThrow(
          'NotesApp must be mounted'
        );
      });
    });

    describe('deleteFile()', () => {
      it('should delete a file', async () => {
        const file = await facade.createFile('Test', '/Test');

        await facade.deleteFile(file.id);

        expect(facade.getFile(file.id)).toBeUndefined();
      });

      it('should emit FILE_DELETED event', async () => {
        const handler = vi.fn();
        const file = await facade.createFile('Test', '/Test');

        facade.on(NotesAppEvent.FILE_DELETED, handler);
        await facade.deleteFile(file.id);

        expect(handler).toHaveBeenCalledWith({
          fileId: file.id,
          fileName: file.name,
        });
      });

      it('should throw if file not found', async () => {
        await expect(facade.deleteFile('nonexistent')).rejects.toThrow('File not found');
      });

      it('should throw if not mounted', async () => {
        facade.unmount();

        await expect(facade.deleteFile('id')).rejects.toThrow(
          'NotesApp must be mounted'
        );
      });
    });

    describe('renameFile()', () => {
      it('should rename a file', async () => {
        const file = await facade.createFile('Old Name', '/Old Name');

        await facade.renameFile(file.id, 'New Name', '/New Name');

        expect(facade['contextRef'].renameFileById).toHaveBeenCalledWith(
          file.id,
          'New Name',
          '/New Name'
        );
      });

      it('should throw if file not found', async () => {
        await expect(
          facade.renameFile('nonexistent', 'New Name', '/New Name')
        ).rejects.toThrow('File not found');
      });

      it('should throw if not mounted', async () => {
        facade.unmount();

        await expect(facade.renameFile('id', 'name', 'path')).rejects.toThrow(
          'NotesApp must be mounted'
        );
      });
    });

    describe('getFile()', () => {
      it('should return a file by ID', async () => {
        const file = await facade.createFile('Test', '/Test');

        const retrieved = facade.getFile(file.id);

        expect(retrieved).toEqual(file);
      });

      it('should return undefined for non-existent file', () => {
        expect(facade.getFile('nonexistent')).toBeUndefined();
      });
    });

    describe('getAllFiles()', () => {
      it('should return all files', async () => {
        await facade.createFile('File 1', '/File 1');
        await facade.createFile('File 2', '/File 2');
        await facade.createFile('File 3', '/File 3');

        const files = facade.getAllFiles();

        expect(files).toHaveLength(3);
      });

      it('should return empty array when no files exist', () => {
        expect(facade.getAllFiles()).toEqual([]);
      });
    });

    describe('queryFiles()', () => {
      beforeEach(async () => {
        // Create some test files
        await facade.createFile('Alpha', '/Alpha', 'content');
        await facade.createFile('Beta', '/Beta', 'content');
        await facade.createFile('Gamma', '/Gamma', 'content');
      });

      it('should return all files with no filters', () => {
        const files = facade.queryFiles();
        expect(files.length).toBeGreaterThanOrEqual(3);
      });

      it('should filter by name', () => {
        const files = facade.queryFiles({ nameContains: 'alpha' });
        expect(files.every((f) => f.name.toLowerCase().includes('alpha'))).toBe(true);
      });

      it('should sort by name ascending', () => {
        const files = facade.queryFiles({ sortBy: 'name', sortDirection: 'asc' });
        const names = files.map((f) => f.name.toLowerCase());

        for (let i = 1; i < names.length; i++) {
          expect(names[i] >= names[i - 1]).toBe(true);
        }
      });

      it('should sort by name descending', () => {
        const files = facade.queryFiles({ sortBy: 'name', sortDirection: 'desc' });
        const names = files.map((f) => f.name.toLowerCase());

        for (let i = 1; i < names.length; i++) {
          expect(names[i] <= names[i - 1]).toBe(true);
        }
      });

      it('should sort by created date', () => {
        const files = facade.queryFiles({ sortBy: 'created', sortDirection: 'asc' });
        const dates = files.map((f) => f.created);

        for (let i = 1; i < dates.length; i++) {
          expect(dates[i] >= dates[i - 1]).toBe(true);
        }
      });

      it('should sort by modified date', () => {
        const files = facade.queryFiles({ sortBy: 'modified', sortDirection: 'asc' });
        const dates = files.map((f) => f.modified);

        for (let i = 1; i < dates.length; i++) {
          expect(dates[i] >= dates[i - 1]).toBe(true);
        }
      });
    });
  });

  describe('Folder Operations', () => {
    beforeEach(() => {
      facade.mount(mockElement);
      const mockContext = {
        createNewFolder: vi.fn((name: string, path: string) => {
          const folder = createMockFolder(name, path);
          facade['folders'].set(folder.id, folder);
          return folder;
        }),
        deleteFolder: vi.fn((folderId: string) => {
          facade['folders'].delete(folderId);
        }),
      };
      facade['contextRef'] = mockContext;
    });

    describe('createFolder()', () => {
      it('should create a new folder', async () => {
        const folder = await facade.createFolder('Projects', '/Projects');

        expect(folder).toBeDefined();
        expect(folder.name).toBe('Projects');
      });

      it('should emit FOLDER_CREATED event', async () => {
        const handler = vi.fn();
        facade.on(NotesAppEvent.FOLDER_CREATED, handler);

        const folder = await facade.createFolder('Test', '/Test');

        expect(handler).toHaveBeenCalledWith({ folder });
      });

      it('should throw if not mounted', async () => {
        facade.unmount();

        await expect(facade.createFolder('Test', '/Test')).rejects.toThrow(
          'NotesApp must be mounted'
        );
      });
    });

    describe('deleteFolder()', () => {
      it('should delete a folder', async () => {
        const folder = await facade.createFolder('Test', '/Test');

        await facade.deleteFolder(folder.id);

        expect(facade.getFolder(folder.id)).toBeUndefined();
      });

      it('should emit FOLDER_DELETED event', async () => {
        const handler = vi.fn();
        const folder = await facade.createFolder('Test', '/Test');

        facade.on(NotesAppEvent.FOLDER_DELETED, handler);
        await facade.deleteFolder(folder.id);

        expect(handler).toHaveBeenCalledWith({
          folderId: folder.id,
          folderName: folder.name,
        });
      });

      it('should throw if folder not found', async () => {
        await expect(facade.deleteFolder('nonexistent')).rejects.toThrow(
          'Folder not found'
        );
      });

      it('should throw if not mounted', async () => {
        facade.unmount();

        await expect(facade.deleteFolder('id')).rejects.toThrow(
          'NotesApp must be mounted'
        );
      });
    });

    describe('getFolder()', () => {
      it('should return a folder by ID', async () => {
        const folder = await facade.createFolder('Test', '/Test');

        const retrieved = facade.getFolder(folder.id);

        expect(retrieved).toEqual(folder);
      });

      it('should return undefined for non-existent folder', () => {
        expect(facade.getFolder('nonexistent')).toBeUndefined();
      });
    });

    describe('getAllFolders()', () => {
      it('should return all folders', async () => {
        await facade.createFolder('Folder 1', '/Folder 1');
        await facade.createFolder('Folder 2', '/Folder 2');

        const folders = facade.getAllFolders();

        expect(folders).toHaveLength(2);
      });

      it('should return empty array when no folders exist', () => {
        expect(facade.getAllFolders()).toEqual([]);
      });
    });
  });

  describe('Navigation', () => {
    beforeEach(async () => {
      facade.mount(mockElement);
      const mockContext = {
        createNewFile: vi.fn((name: string, path: string, content: string) => {
          const file = createMockFile(name, path, content);
          facade['files'].set(file.id, file);
          return file;
        }),
        setCurrentFile: vi.fn((fileId: string | null) => {
          facade['currentFileId'] = fileId;
        }),
      };
      facade['contextRef'] = mockContext;
    });

    describe('openFile()', () => {
      it('should open a file', async () => {
        const file = await facade.createFile('Test', '/Test');

        facade.openFile(file.id);

        expect(facade['contextRef'].setCurrentFile).toHaveBeenCalledWith(file.id);
      });

      it('should emit FILE_OPENED event', async () => {
        const handler = vi.fn();
        const file = await facade.createFile('Test', '/Test');

        facade.on(NotesAppEvent.FILE_OPENED, handler);
        facade.openFile(file.id);

        expect(handler).toHaveBeenCalledWith({ file });
      });

      it('should throw if file not found', () => {
        expect(() => facade.openFile('nonexistent')).toThrow('File not found');
      });

      it('should throw if not mounted', () => {
        facade.unmount();

        expect(() => facade.openFile('id')).toThrow('NotesApp must be mounted');
      });
    });

    describe('getCurrentFile()', () => {
      it('should return the current file', async () => {
        const file = await facade.createFile('Test', '/Test');
        facade.openFile(file.id);

        const current = facade.getCurrentFile();

        expect(current).toEqual(file);
      });

      it('should return undefined when no file is open', () => {
        expect(facade.getCurrentFile()).toBeUndefined();
      });
    });

    describe('closeCurrentFile()', () => {
      it('should close the current file', async () => {
        const file = await facade.createFile('Test', '/Test');
        facade.openFile(file.id);

        facade.closeCurrentFile();

        expect(facade['contextRef'].setCurrentFile).toHaveBeenCalledWith(null);
      });

      it('should throw if not mounted', () => {
        facade.unmount();

        expect(() => facade.closeCurrentFile()).toThrow('NotesApp must be mounted');
      });
    });
  });

  describe('View Settings', () => {
    beforeEach(() => {
      facade.mount(mockElement);
      const mockContext = {
        setEditorViewMode: vi.fn((mode) => {
          facade['editorViewMode'] = mode;
        }),
        toggleGraphView: vi.fn(() => {
          facade['showGraphView'] = !facade['showGraphView'];
        }),
      };
      facade['contextRef'] = mockContext;
    });

    describe('setViewMode()', () => {
      it('should set the view mode', () => {
        facade.setViewMode('split');

        expect(facade['contextRef'].setEditorViewMode).toHaveBeenCalledWith('split');
      });

      it('should emit VIEW_MODE_CHANGED event', () => {
        const handler = vi.fn();
        facade.on(NotesAppEvent.VIEW_MODE_CHANGED, handler);

        const previousMode = facade.getViewMode();
        facade.setViewMode('split');
        facade['editorViewMode'] = 'split'; // Update internal state after event

        expect(handler).toHaveBeenCalledWith({
          mode: 'split',
          previousMode,
        });
      });

      it('should throw if not mounted', () => {
        facade.unmount();

        expect(() => facade.setViewMode('split')).toThrow('NotesApp must be mounted');
      });
    });

    describe('getViewMode()', () => {
      it('should return the current view mode', () => {
        facade['editorViewMode'] = 'preview';
        expect(facade.getViewMode()).toBe('preview');
      });
    });

    describe('toggleGraphView()', () => {
      it('should toggle the graph view', () => {
        facade.toggleGraphView();

        expect(facade['contextRef'].toggleGraphView).toHaveBeenCalled();
      });

      it('should emit GRAPH_TOGGLED event', () => {
        const handler = vi.fn();
        facade.on(NotesAppEvent.GRAPH_TOGGLED, handler);

        const initialState = facade['showGraphView'];
        facade['showGraphView'] = !initialState;
        facade.toggleGraphView();

        expect(handler).toHaveBeenCalledWith({
          visible: !initialState,
        });
      });

      it('should throw if not mounted', () => {
        facade.unmount();

        expect(() => facade.toggleGraphView()).toThrow('NotesApp must be mounted');
      });
    });

    describe('setGraphViewVisible()', () => {
      it('should show the graph view when hidden', () => {
        facade['showGraphView'] = false;

        facade.setGraphViewVisible(true);

        expect(facade['contextRef'].toggleGraphView).toHaveBeenCalled();
      });

      it('should hide the graph view when visible', () => {
        facade['showGraphView'] = true;

        facade.setGraphViewVisible(false);

        expect(facade['contextRef'].toggleGraphView).toHaveBeenCalled();
      });

      it('should not toggle if already in desired state', () => {
        facade['showGraphView'] = true;

        facade.setGraphViewVisible(true);

        expect(facade['contextRef'].toggleGraphView).not.toHaveBeenCalled();
      });
    });
  });

  describe('Workspace Operations', () => {
    beforeEach(async () => {
      facade.mount(mockElement);
      const mockContext = {
        createNewFile: vi.fn((name: string, path: string, content: string) => {
          const file = createMockFile(name, path, content);
          facade['files'].set(file.id, file);
          return file;
        }),
        createNewFolder: vi.fn((name: string, path: string) => {
          const folder = createMockFolder(name, path);
          facade['folders'].set(folder.id, folder);
          return folder;
        }),
      };
      facade['contextRef'] = mockContext;
    });

    describe('getWorkspace()', () => {
      it('should return workspace data', async () => {
        await facade.createFile('File 1', '/File 1');
        await facade.createFolder('Folder 1', '/Folder 1');

        const workspace = facade.getWorkspace();

        expect(workspace.files).toBeDefined();
        expect(workspace.folders).toBeDefined();
        expect(workspace.metadata).toBeDefined();
        expect(workspace.metadata?.fileCount).toBe(1);
        expect(workspace.metadata?.folderCount).toBe(1);
      });

      it('should include metadata', async () => {
        const workspace = facade.getWorkspace();

        expect(workspace.metadata?.version).toBe('1.0.0');
        expect(workspace.metadata?.exportedAt).toBeDefined();
      });
    });

    describe('exportWorkspace()', () => {
      it('should export workspace as JSON string', async () => {
        await facade.createFile('Test', '/Test');

        const json = facade.exportWorkspace();

        expect(() => JSON.parse(json)).not.toThrow();
        const parsed = JSON.parse(json);
        expect(parsed.files).toBeDefined();
        expect(parsed.folders).toBeDefined();
      });
    });

    describe('importWorkspace()', () => {
      it('should import workspace data', async () => {
        const workspaceData = {
          files: {
            '1': createMockFile('Imported File', '/Imported File'),
          },
          folders: {
            '1': createMockFolder('Imported Folder', '/Imported Folder'),
          },
          metadata: {
            version: '1.0.0',
            exportedAt: Date.now(),
            fileCount: 1,
            folderCount: 1,
          },
        };

        await facade.importWorkspace(workspaceData);

        expect(facade.getFile('1')).toBeDefined();
        expect(facade.getFolder('1')).toBeDefined();
      });

      it('should emit WORKSPACE_LOADED event', async () => {
        const handler = vi.fn();
        facade.on(NotesAppEvent.WORKSPACE_LOADED, handler);

        const workspaceData = {
          files: {},
          folders: {},
        };

        await facade.importWorkspace(workspaceData);

        expect(handler).toHaveBeenCalled();
      });

      it('should throw if not mounted', async () => {
        facade.unmount();

        await expect(facade.importWorkspace({ files: {}, folders: {} })).rejects.toThrow(
          'NotesApp must be mounted'
        );
      });
    });

    describe('getStats()', () => {
      it('should return workspace statistics', async () => {
        await facade.createFile('File 1', '/File 1', 'Content 1');
        await facade.createFile('File 2', '/File 2', 'Content 2');

        const stats = facade.getStats();

        expect(stats.fileCount).toBe(2);
        expect(stats.folderCount).toBeDefined();
        expect(stats.totalContentLength).toBeGreaterThan(0);
        expect(stats.linkCount).toBeDefined();
        expect(stats.lastModified).toBeGreaterThan(0);
      });

      it('should return zero stats for empty workspace', () => {
        const stats = facade.getStats();

        expect(stats.fileCount).toBe(0);
        expect(stats.totalContentLength).toBe(0);
        expect(stats.linkCount).toBe(0);
      });
    });

    describe('clearWorkspace()', () => {
      it('should clear all files and folders', async () => {
        await facade.createFile('Test', '/Test');
        await facade.createFolder('Test', '/Test');

        await facade.clearWorkspace();

        expect(facade.getAllFiles()).toHaveLength(0);
        expect(facade.getAllFolders()).toHaveLength(0);
      });

      it('should throw if not mounted', async () => {
        facade.unmount();

        await expect(facade.clearWorkspace()).rejects.toThrow(
          'NotesApp must be mounted'
        );
      });
    });
  });

  describe('Event System', () => {
    beforeEach(() => {
      facade.mount(mockElement);
    });

    describe('on()', () => {
      it('should subscribe to events', () => {
        const handler = vi.fn();
        const unsubscribe = facade.on(NotesAppEvent.FILE_CREATED, handler);

        expect(typeof unsubscribe).toBe('function');
      });

      it('should receive events', async () => {
        const handler = vi.fn();
        facade.on(NotesAppEvent.WORKSPACE_LOADED, handler);

        facade['eventEmitter'].emit(NotesAppEvent.WORKSPACE_LOADED, {
          fileCount: 1,
          folderCount: 1,
        });

        expect(handler).toHaveBeenCalled();
      });
    });

    describe('once()', () => {
      it('should subscribe to events only once', () => {
        const handler = vi.fn();
        facade.once(NotesAppEvent.WORKSPACE_LOADED, handler);

        facade['eventEmitter'].emit(NotesAppEvent.WORKSPACE_LOADED, {
          fileCount: 1,
          folderCount: 1,
        });
        facade['eventEmitter'].emit(NotesAppEvent.WORKSPACE_LOADED, {
          fileCount: 2,
          folderCount: 2,
        });

        expect(handler).toHaveBeenCalledTimes(1);
      });
    });

    describe('off()', () => {
      it('should unsubscribe from events', () => {
        const handler = vi.fn();
        facade.on(NotesAppEvent.FILE_CREATED, handler);
        facade.off(NotesAppEvent.FILE_CREATED, handler);

        facade['eventEmitter'].emit(NotesAppEvent.FILE_CREATED, {
          file: createMockFile(),
        });

        expect(handler).not.toHaveBeenCalled();
      });
    });
  });

  describe('State Synchronization', () => {
    beforeEach(() => {
      facade.mount(mockElement);
    });

    it('should update internal state via _updateState', () => {
      const files = new Map([['1', createMockFile()]]);
      const folders = new Map([['1', createMockFolder()]]);

      facade._updateState({
        files,
        folders,
        currentFileId: '1',
        editorViewMode: 'split',
        showGraphView: true,
      });

      expect(facade['files']).toBe(files);
      expect(facade['folders']).toBe(folders);
      expect(facade['currentFileId']).toBe('1');
      expect(facade['editorViewMode']).toBe('split');
      expect(facade['showGraphView']).toBe(true);
    });

    it('should set context reference via _setContextRef', () => {
      const mockContext = { test: true };
      facade._setContextRef(mockContext);

      expect(facade['contextRef']).toBe(mockContext);
    });
  });
});

// Helper functions
function createMockFile(
  name: string = 'Test File',
  path: string = '/Test File',
  content: string = ''
): File {
  return {
    id: `file-${Math.random()}`,
    name,
    path,
    content,
    created: Date.now(),
    modified: Date.now(),
    links: [],
  };
}

function createMockFolder(
  name: string = 'Test Folder',
  path: string = '/Test Folder'
): Folder {
  return {
    id: `folder-${Math.random()}`,
    name,
    path,
    children: [],
  };
}
