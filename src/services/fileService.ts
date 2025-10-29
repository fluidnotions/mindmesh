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
  const parentPath = getParentPath(path);
  return {
    id: uuidv4(),
    name,
    path,
    parentPath,
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

/**
 * Path utility functions for folder hierarchy
 */

/**
 * Get parent path from a full path
 * @param path - Full path (e.g., "/Programming/React/Hooks")
 * @returns Parent path or null if root (e.g., "/Programming/React")
 */
export function getParentPath(path: string): string | null {
  if (path === '/' || !path || path === '') {
    return null;
  }

  const normalized = path.replace(/\/$/, ''); // Remove trailing slash
  const lastSlashIndex = normalized.lastIndexOf('/');

  if (lastSlashIndex === 0) {
    return '/'; // Parent is root
  }

  if (lastSlashIndex === -1) {
    return '/'; // No parent, treat as root child
  }

  return normalized.substring(0, lastSlashIndex);
}

/**
 * Get folder name from path
 * @param path - Full path (e.g., "/Programming/React")
 * @returns Folder name (e.g., "React")
 */
export function getFolderNameFromPath(path: string): string {
  const normalized = path.replace(/\/$/, '');
  const lastSlashIndex = normalized.lastIndexOf('/');

  if (lastSlashIndex === -1) {
    return normalized;
  }

  return normalized.substring(lastSlashIndex + 1);
}

/**
 * Check if a path is a child of another path
 * @param childPath - Potential child path
 * @param parentPath - Potential parent path
 * @returns true if childPath is a direct child of parentPath
 */
export function isDirectChild(childPath: string, parentPath: string): boolean {
  if (parentPath === '/' || parentPath === '') {
    // Root level - check if path has only one slash at the beginning
    const normalized = childPath.replace(/^\//, '').replace(/\/$/, '');
    return normalized.length > 0 && !normalized.includes('/');
  }

  const normalizedChild = childPath.replace(/\/$/, '');
  const normalizedParent = parentPath.replace(/\/$/, '');

  if (!normalizedChild.startsWith(normalizedParent + '/')) {
    return false;
  }

  const remainder = normalizedChild.substring(normalizedParent.length + 1);
  return !remainder.includes('/');
}

/**
 * Build a tree structure from flat files and folders
 * @param files - Map of all files
 * @param folders - Map of all folders
 * @returns Tree structure with folders containing their children
 */
export interface TreeNode {
  type: 'file' | 'folder';
  id: string;
  name: string;
  path: string;
  children?: TreeNode[];
  file?: File;
  folder?: Folder;
}

export function buildTree(
  files: Map<string, File>,
  folders: Map<string, Folder>
): TreeNode[] {
  const tree: TreeNode[] = [];
  const folderNodes = new Map<string, TreeNode>();

  // Create folder nodes
  folders.forEach((folder) => {
    const node: TreeNode = {
      type: 'folder',
      id: folder.id,
      name: folder.name,
      path: folder.path,
      children: [],
      folder,
    };
    folderNodes.set(folder.path, node);
  });

  // Create file nodes
  const fileNodes: TreeNode[] = Array.from(files.values()).map((file) => ({
    type: 'file',
    id: file.id,
    name: file.name,
    path: file.path,
    file,
  }));

  // Build hierarchy for folders
  folders.forEach((folder) => {
    const node = folderNodes.get(folder.path)!;
    const parentPath = folder.parentPath;

    if (!parentPath || parentPath === '/') {
      // Root level folder
      tree.push(node);
    } else {
      // Child folder
      const parentNode = folderNodes.get(parentPath);
      if (parentNode && parentNode.children) {
        parentNode.children.push(node);
      } else {
        // Parent not found, add to root
        tree.push(node);
      }
    }
  });

  // Add files to their parent folders
  fileNodes.forEach((fileNode) => {
    const parentPath = getParentPath(fileNode.path);

    if (!parentPath || parentPath === '/') {
      // Root level file
      tree.push(fileNode);
    } else {
      // File in a folder
      const parentNode = folderNodes.get(parentPath);
      if (parentNode && parentNode.children) {
        parentNode.children.push(fileNode);
      } else {
        // Parent folder not found, add to root
        tree.push(fileNode);
      }
    }
  });

  // Sort children alphabetically (folders first, then files)
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    nodes.forEach((node) => {
      if (node.children) {
        sortNodes(node.children);
      }
    });
  };

  sortNodes(tree);

  return tree;
}
