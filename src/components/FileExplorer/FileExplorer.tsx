// File Explorer component - Left sidebar with file tree
import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import './FileExplorer.css';

export function FileExplorer() {
  const { files, currentFileId, setCurrentFile, createNewFile, deleteFile } = useApp();
  const [searchQuery, setSearchQuery] = useState('');

  const handleCreateFile = () => {
    const fileName = prompt('Enter file name:');
    if (fileName) {
      const newFile = createNewFile(fileName, `/${fileName}`);
      setCurrentFile(newFile.id);
    }
  };

  const handleDeleteFile = (fileId: string, fileName: string) => {
    if (confirm(`Delete "${fileName}"?`)) {
      deleteFile(fileId);
    }
  };

  const handleFileClick = (fileId: string) => {
    setCurrentFile(fileId);
  };

  // Filter files based on search query
  const filteredFiles = Array.from(files.values()).filter(file =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="file-explorer">
      <div className="file-explorer-header">
        <h2>Files</h2>
        <button onClick={handleCreateFile} className="btn-create-file">
          + New Note
        </button>
      </div>

      <div className="search-box">
        <input
          type="text"
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="file-list">
        {filteredFiles.map((file) => (
          <div
            key={file.id}
            className={`file-item ${currentFileId === file.id ? 'active' : ''}`}
            onClick={() => handleFileClick(file.id)}
          >
            <span className="file-icon">📄</span>
            <span className="file-name">{file.name}</span>
            <button
              className="btn-delete"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteFile(file.id, file.name);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
