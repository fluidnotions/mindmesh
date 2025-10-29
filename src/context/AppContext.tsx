// Global app state management using React Context API
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { File, Folder, EditorViewMode } from '../models/types';
import { saveFiles, loadFiles, saveFolders, loadFolders } from '../services/storageService';
import { createFile, createFolder, updateFileContent, renameFile } from '../services/fileService';
import { createSeedData } from '../utils/seedData';
import { buildKeywordIndex, KeywordIndex } from '../services/linkIndexService';

interface AppContextType {
  // State
  files: Map<string, File>;
  folders: Map<string, Folder>;
  currentFileId: string | null;
  editorViewMode: EditorViewMode;
  showGraphView: boolean;
  keywordIndex: KeywordIndex | null;

  // File operations
  createNewFile: (name: string, path: string, content?: string) => File;
  updateFile: (fileId: string, content: string) => void;
  deleteFile: (fileId: string) => void;
  renameFileById: (fileId: string, newName: string, newPath: string) => void;
  getFile: (fileId: string) => File | undefined;
  getCurrentFile: () => File | undefined;

  // Folder operations
  createNewFolder: (name: string, path: string) => Folder;
  deleteFolder: (folderId: string) => void;

  // Navigation
  setCurrentFile: (fileId: string | null) => void;

  // View settings
  setEditorViewMode: (mode: EditorViewMode) => void;
  toggleGraphView: () => void;

  // Index management
  rebuildIndex: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [files, setFiles] = useState<Map<string, File>>(new Map());
  const [folders, setFolders] = useState<Map<string, Folder>>(new Map());
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  const [editorViewMode, setEditorViewMode] = useState<EditorViewMode>('edit');
  const [showGraphView, setShowGraphView] = useState(false);
  const [keywordIndex, setKeywordIndex] = useState<KeywordIndex | null>(null);

  // Load data from storage on mount
  useEffect(() => {
    const loadedFiles = loadFiles();
    const loadedFolders = loadFolders();

    // Load seed data if no files exist
    if (loadedFiles.size === 0) {
      const seedData = createSeedData();
      setFiles(seedData.files);
      setFolders(seedData.folders);

      // Set the first file as current
      const firstFile = Array.from(seedData.files.values())[0];
      if (firstFile) {
        setCurrentFileId(firstFile.id);
      }

      // Save to storage
      saveFiles(seedData.files);
      saveFolders(seedData.folders);
    } else {
      setFiles(loadedFiles);
      setFolders(loadedFolders);
    }
  }, []);

  // Auto-save files when they change (debounced in components)
  useEffect(() => {
    if (files.size > 0) {
      saveFiles(files);
    }
  }, [files]);

  // Save folders when they change
  useEffect(() => {
    if (folders.size > 0) {
      saveFolders(folders);
    }
  }, [folders]);

  // Build keyword index when files change
  useEffect(() => {
    if (files.size > 0) {
      buildKeywordIndex(files).then(setKeywordIndex);
    }
  }, [files]);

  // Function to manually rebuild index
  const rebuildIndex = async () => {
    if (files.size > 0) {
      const index = await buildKeywordIndex(files);
      setKeywordIndex(index);
    }
  };

  const createNewFile = (name: string, path: string, content: string = ''): File => {
    const newFile = createFile(name, path, content);
    setFiles(new Map(files).set(newFile.id, newFile));
    return newFile;
  };

  const updateFile = (fileId: string, content: string) => {
    const file = files.get(fileId);
    if (file) {
      const updatedFile = updateFileContent(file, content);
      setFiles(new Map(files).set(fileId, updatedFile));
    }
  };

  const deleteFile = (fileId: string) => {
    const newFiles = new Map(files);
    newFiles.delete(fileId);
    setFiles(newFiles);
    if (currentFileId === fileId) {
      setCurrentFileId(null);
    }
  };

  const renameFileById = (fileId: string, newName: string, newPath: string) => {
    const file = files.get(fileId);
    if (file) {
      const renamedFile = renameFile(file, newName, newPath);
      setFiles(new Map(files).set(fileId, renamedFile));
    }
  };

  const getFile = (fileId: string): File | undefined => {
    return files.get(fileId);
  };

  const getCurrentFile = (): File | undefined => {
    return currentFileId ? files.get(currentFileId) : undefined;
  };

  const createNewFolder = (name: string, path: string): Folder => {
    const newFolder = createFolder(name, path);
    setFolders(new Map(folders).set(newFolder.id, newFolder));
    return newFolder;
  };

  const deleteFolder = (folderId: string) => {
    const newFolders = new Map(folders);
    newFolders.delete(folderId);
    setFolders(newFolders);
  };

  const toggleGraphView = () => {
    setShowGraphView(!showGraphView);
  };

  const value: AppContextType = {
    files,
    folders,
    currentFileId,
    editorViewMode,
    showGraphView,
    keywordIndex,
    createNewFile,
    updateFile,
    deleteFile,
    renameFileById,
    getFile,
    getCurrentFile,
    createNewFolder,
    deleteFolder,
    setCurrentFile: setCurrentFileId,
    setEditorViewMode,
    toggleGraphView,
    rebuildIndex,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
