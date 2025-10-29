// Data persistence service using LocalStorage
// As per spec section 6.4

import { File, Folder } from '../models/types';

const STORAGE_KEY_PREFIX = 'obsidian_clone_';
const FILES_KEY = `${STORAGE_KEY_PREFIX}files`;
const FOLDERS_KEY = `${STORAGE_KEY_PREFIX}folders`;

/**
 * Save files to LocalStorage
 */
export function saveFiles(files: Map<string, File>): void {
  try {
    const filesArray = Array.from(files.values());
    localStorage.setItem(FILES_KEY, JSON.stringify(filesArray));
  } catch (error) {
    console.error('Error saving files:', error);
  }
}

/**
 * Load files from LocalStorage
 */
export function loadFiles(): Map<string, File> {
  try {
    const filesJson = localStorage.getItem(FILES_KEY);
    if (!filesJson) return new Map();

    const filesArray: File[] = JSON.parse(filesJson);
    return new Map(filesArray.map(file => [file.id, file]));
  } catch (error) {
    console.error('Error loading files:', error);
    return new Map();
  }
}

/**
 * Save folders to LocalStorage
 */
export function saveFolders(folders: Map<string, Folder>): void {
  try {
    const foldersArray = Array.from(folders.values());
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(foldersArray));
  } catch (error) {
    console.error('Error saving folders:', error);
  }
}

/**
 * Load folders from LocalStorage
 */
export function loadFolders(): Map<string, Folder> {
  try {
    const foldersJson = localStorage.getItem(FOLDERS_KEY);
    if (!foldersJson) return new Map();

    const foldersArray: Folder[] = JSON.parse(foldersJson);
    return new Map(foldersArray.map(folder => [folder.id, folder]));
  } catch (error) {
    console.error('Error loading folders:', error);
    return new Map();
  }
}

/**
 * Clear all storage
 */
export function clearStorage(): void {
  localStorage.removeItem(FILES_KEY);
  localStorage.removeItem(FOLDERS_KEY);
}
