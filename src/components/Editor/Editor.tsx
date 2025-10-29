// Markdown Editor component
import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Preview } from '../Preview/Preview';
import './Editor.css';

export function Editor() {
  const { getCurrentFile, updateFile, editorViewMode, setEditorViewMode } = useApp();
  const currentFile = getCurrentFile();
  const [localContent, setLocalContent] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

  // Update local content when file changes
  useEffect(() => {
    if (currentFile) {
      setLocalContent(currentFile.content);
      setSaveStatus('saved');
    }
  }, [currentFile?.id]);

  // Debounced auto-save
  useEffect(() => {
    if (!currentFile) return;

    if (localContent !== currentFile.content) {
      setSaveStatus('unsaved');
      const timeoutId = setTimeout(() => {
        setSaveStatus('saving');
        updateFile(currentFile.id, localContent);
        setTimeout(() => setSaveStatus('saved'), 300);
      }, 500); // 500ms debounce as per spec

      return () => clearTimeout(timeoutId);
    }
  }, [localContent, currentFile, updateFile]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalContent(e.target.value);
  };

  if (!currentFile) {
    return (
      <div className="editor-container">
        <div className="editor-empty">
          <p>No file selected</p>
          <p>Select a file from the explorer or create a new one</p>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-container">
      <div className="editor-header">
        <div className="editor-title">
          <h1>{currentFile.name}</h1>
          <span className="editor-path">{currentFile.path}</span>
        </div>
        <div className="editor-toolbar">
          <div className="view-mode-toggle">
            <button
              className={editorViewMode === 'edit' ? 'active' : ''}
              onClick={() => setEditorViewMode('edit')}
            >
              Edit
            </button>
            <button
              className={editorViewMode === 'preview' ? 'active' : ''}
              onClick={() => setEditorViewMode('preview')}
            >
              Preview
            </button>
            <button
              className={editorViewMode === 'split' ? 'active' : ''}
              onClick={() => setEditorViewMode('split')}
            >
              Split
            </button>
          </div>
          <div className={`save-indicator ${saveStatus}`}>
            {saveStatus === 'saved' && '✓ Saved'}
            {saveStatus === 'saving' && '⟳ Saving...'}
            {saveStatus === 'unsaved' && '● Unsaved'}
          </div>
        </div>
      </div>

      <div className={`editor-content mode-${editorViewMode}`}>
        {(editorViewMode === 'edit' || editorViewMode === 'split') && (
          <div className="editor-pane">
            <textarea
              value={localContent}
              onChange={handleContentChange}
              placeholder="Start typing... Use [[Note Name]] to link to other notes"
              spellCheck={false}
            />
          </div>
        )}

        {(editorViewMode === 'preview' || editorViewMode === 'split') && (
          <div className="preview-pane">
            <Preview content={localContent} />
          </div>
        )}
      </div>
    </div>
  );
}
