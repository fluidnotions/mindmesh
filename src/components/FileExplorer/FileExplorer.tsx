// File Explorer component - Left sidebar with hierarchical file tree
import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../context/AppContext';
import { buildTree, TreeNode } from '../../services/fileService';

export function FileExplorer() {
  const { t } = useTranslation();
  const {
    files,
    folders,
    currentFileId,
    setCurrentFile,
    createNewFile,
    deleteFile,
    createNewFolder,
    deleteFolder,
    renameFileById,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['/']));
  const [draggedItem, setDraggedItem] = useState<TreeNode | null>(null);

  // Build tree structure from flat files and folders
  const tree = buildTree(files, folders);

  // Toggle folder expansion
  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // File operations
  const handleCreateFile = (parentPath: string = '/') => {
    const fileName = prompt(t('fileExplorer.enterFileName'));
    if (fileName) {
      const filePath = parentPath === '/' ? `/${fileName}` : `${parentPath}/${fileName}`;
      const newFile = createNewFile(fileName, filePath);
      setCurrentFile(newFile.id);

      // Expand parent folder if it exists
      if (parentPath !== '/') {
        setExpandedFolders((prev) => new Set(prev).add(parentPath));
      }
    }
  };

  const handleDeleteFile = (fileId: string, fileName: string) => {
    if (confirm(t('fileExplorer.deleteConfirm', { name: fileName }))) {
      deleteFile(fileId);
    }
  };

  const handleFileClick = (fileId: string) => {
    setCurrentFile(fileId);
  };

  // Folder operations
  const handleCreateFolder = (parentPath: string = '/') => {
    const folderName = prompt(t('fileExplorer.enterFolderName'));
    if (folderName) {
      const folderPath = parentPath === '/' ? `/${folderName}` : `${parentPath}/${folderName}`;
      createNewFolder(folderName, folderPath);

      // Expand parent folder
      if (parentPath !== '/') {
        setExpandedFolders((prev) => new Set(prev).add(parentPath));
      }
    }
  };

  const handleDeleteFolder = (folderId: string, folderName: string, folderPath: string) => {
    // Check if folder has children
    const folderNode = findNodeByPath(tree, folderPath);
    const hasChildren = folderNode?.children && folderNode.children.length > 0;

    if (hasChildren) {
      alert(t('fileExplorer.cannotDeleteNonEmptyFolder'));
      return;
    }

    if (confirm(t('fileExplorer.deleteConfirm', { name: folderName }))) {
      deleteFolder(folderId);
    }
  };

  // Helper to find node by path
  const findNodeByPath = (nodes: TreeNode[], path: string): TreeNode | null => {
    for (const node of nodes) {
      if (node.path === path) {
        return node;
      }
      if (node.children) {
        const found = findNodeByPath(node.children, path);
        if (found) return found;
      }
    }
    return null;
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, node: TreeNode) => {
    setDraggedItem(node);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetNode: TreeNode) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedItem) return;

    // Can only drop into folders
    if (targetNode.type !== 'folder') return;

    // Don't drop into itself
    if (draggedItem.path === targetNode.path) return;

    // Don't drop a folder into its own child
    if (targetNode.path.startsWith(draggedItem.path + '/')) return;

    // Move the item
    const newPath = `${targetNode.path}/${draggedItem.name}`;

    if (draggedItem.type === 'file' && draggedItem.file) {
      renameFileById(draggedItem.file.id, draggedItem.name, newPath);
    } else if (draggedItem.type === 'folder' && draggedItem.folder) {
      // For now, just show a message - moving folders with children requires more logic
      alert('Moving folders is not yet fully implemented. Please create a new folder and move files individually.');
    }

    setDraggedItem(null);
  };

  // Render tree node (file or folder)
  const renderTreeNode = (node: TreeNode, depth: number = 0): React.ReactElement => {
    const isExpanded = expandedFolders.has(node.path);
    const hasChildren = node.children && node.children.length > 0;
    const isActive = node.type === 'file' && currentFileId === node.id;

    if (node.type === 'folder') {
      return (
        <div key={node.id} className="select-none">
          <div
            className={`flex items-center px-2 py-1 cursor-pointer rounded text-foreground hover:bg-secondary transition-colors ${isActive ? 'bg-primary/20 text-primary' : ''}`}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, node)}
          >
            <span
              className="w-4 inline-flex items-center justify-center text-xs text-muted-foreground cursor-pointer mr-1"
              onClick={() => toggleFolder(node.path)}
            >
              {hasChildren ? (isExpanded ? '▼' : '▶') : '▶'}
            </span>
            <span className="mr-2 text-base cursor-pointer" onClick={() => toggleFolder(node.path)}>
              {isExpanded ? '📂' : '📁'}
            </span>
            <span
              className="flex-1 text-sm overflow-hidden text-overflow-ellipsis whitespace-nowrap cursor-pointer"
              onClick={() => toggleFolder(node.path)}
            >
              {node.name}
            </span>
            <div className="hidden gap-1 group-hover:flex ml-2">
              <button
                className="px-2 py-1 bg-secondary text-muted-foreground rounded text-xs hover:bg-primary hover:text-primary-foreground transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCreateFile(node.path);
                }}
                title={t('fileExplorer.newFile')}
              >
                +📄
              </button>
              <button
                className="px-2 py-1 bg-secondary text-muted-foreground rounded text-xs hover:bg-primary hover:text-primary-foreground transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCreateFolder(node.path);
                }}
                title={t('fileExplorer.newFolder')}
              >
                +📁
              </button>
              <button
                className="px-2 py-1 bg-secondary text-destructive rounded text-xs hover:bg-destructive hover:text-destructive-foreground transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteFolder(node.id, node.name, node.path);
                }}
                title={t('button.delete')}
              >
                ×
              </button>
            </div>
          </div>
          {isExpanded && hasChildren && (
            <div>
              {node.children!.map((child) => renderTreeNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    } else {
      return (
        <div
          key={node.id}
          className={`flex items-center px-2 py-1 cursor-pointer rounded text-foreground hover:bg-secondary transition-colors ${isActive ? 'bg-primary/20 text-primary' : ''}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => handleFileClick(node.id)}
          draggable
          onDragStart={(e) => handleDragStart(e, node)}
        >
          <span className="w-4 mr-2"></span>
          <span className="mr-2 text-sm">📄</span>
          <span className="flex-1 text-sm overflow-hidden text-overflow-ellipsis whitespace-nowrap">{node.name}</span>
          <button
            className="px-2 py-1 bg-secondary text-destructive rounded text-xs hover:bg-destructive hover:text-destructive-foreground transition-colors ml-2"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteFile(node.id, node.name);
            }}
            title={t('button.delete')}
          >
            ×
          </button>
        </div>
      );
    }
  };

  // Filter tree based on search
  const filterTree = (nodes: TreeNode[]): TreeNode[] => {
    if (!searchQuery) return nodes;

    const filtered: TreeNode[] = [];

    for (const node of nodes) {
      if (node.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        filtered.push(node);
      } else if (node.children) {
        const filteredChildren = filterTree(node.children);
        if (filteredChildren.length > 0) {
          filtered.push({
            ...node,
            children: filteredChildren,
          });
        }
      }
    }

    return filtered;
  };

  const filteredTree = filterTree(tree);

  return (
    <div className="flex flex-col h-screen bg-background border-r border-border">
      <div className="p-4 border-b border-border bg-card">
        <h2 className="text-foreground font-semibold mb-3">{t('fileExplorer.title')}</h2>
        <div className="flex gap-2">
          <button
            onClick={() => handleCreateFile('/')}
            className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90 transition-colors"
            title={t('fileExplorer.newFile')}
          >
            +📄
          </button>
          <button
            onClick={() => handleCreateFolder('/')}
            className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90 transition-colors"
            title={t('fileExplorer.newFolder')}
          >
            +📁
          </button>
        </div>
      </div>

      <div className="px-4 py-2 border-b border-border">
        <input
          type="text"
          placeholder={t('fileExplorer.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 bg-secondary border border-border text-foreground rounded placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {filteredTree.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            {searchQuery ? t('fileExplorer.noFiles') : t('fileExplorer.noFiles')}
          </div>
        ) : (
          filteredTree.map((node) => renderTreeNode(node, 0))
        )}
      </div>
    </div>
  );
}
