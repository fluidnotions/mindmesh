// File CRUD operations service
import { v4 as uuidv4 } from 'uuid';
import { File, Folder } from '../models/types';
import { extractLinks } from '../utils/linkParser';

/**
 * Create a new file
 */
export function createFile(
  name: string,
  path: string,
  content: string = ''
): File {
  const now = Date.now();
  return {
    id: uuidv4(),
    name,
    content,
    path,
    created: now,
    modified: now,
    links: extractLinks(content),
  };
}

/**
 * Create a new folder
 */
export function createFolder(name: string, path: string): Folder {
  return {
    id: uuidv4(),
    name,
    path,
    children: [],
  };
}

/**
 * Update file content and extract links
 */
export function updateFileContent(file: File, content: string): File {
  return {
    ...file,
    content,
    modified: Date.now(),
    links: extractLinks(content),
  };
}

/**
 * Rename a file
 */
export function renameFile(file: File, newName: string, newPath: string): File {
  return {
    ...file,
    name: newName,
    path: newPath,
    modified: Date.now(),
  };
}

/**
 * Build backlinks map (which files link to which)
 */
export function buildBacklinksMap(
  files: Map<string, File>
): Map<string, string[]> {
  const backlinks = new Map<string, string[]>();

  files.forEach((file) => {
    file.links.forEach((linkedFileName) => {
      // Find the file with this name
      const linkedFile = Array.from(files.values()).find(
        (f) => f.name === linkedFileName
      );

      if (linkedFile) {
        if (!backlinks.has(linkedFile.id)) {
          backlinks.set(linkedFile.id, []);
        }
        backlinks.get(linkedFile.id)!.push(file.id);
      }
    });
  });

  return backlinks;
}
