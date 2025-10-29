// Markdown Editor component
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../context/AppContext';
import { Preview } from '../Preview/Preview';
import { Breadcrumb } from '../FileExplorer/Breadcrumb';
import './Editor.css';

export function Editor() {
  const { t } = useTranslation();
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
          <p>{t('editor.noFileSelected')}</p>
          <p>{t('editor.selectFilePrompt')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-container">
      <Breadcrumb path={currentFile.path} />
      <div className="editor-header">
        <div className="editor-title">
          <h1>{currentFile.name}</h1>
        </div>
        <div className="editor-toolbar">
          <div className="view-mode-toggle">
            <button
              className={editorViewMode === 'edit' ? 'active' : ''}
              onClick={() => setEditorViewMode('edit')}
            >
              {t('editor.editMode')}
            </button>
            <button
              className={editorViewMode === 'preview' ? 'active' : ''}
              onClick={() => setEditorViewMode('preview')}
            >
              {t('editor.previewMode')}
            </button>
            <button
              className={editorViewMode === 'split' ? 'active' : ''}
              onClick={() => setEditorViewMode('split')}
            >
              {t('editor.splitMode')}
            </button>
          </div>
          <div className={`save-indicator ${saveStatus}`}>
            {saveStatus === 'saved' && `✓ ${t('editor.saved')}`}
            {saveStatus === 'saving' && `⟳ ${t('editor.saving')}`}
            {saveStatus === 'unsaved' && `● ${t('editor.unsaved')}`}
          </div>
        </div>
      </div>

      <div className={`editor-content mode-${editorViewMode}`}>
        {(editorViewMode === 'edit' || editorViewMode === 'split') && (
          <div className="editor-pane">
            <textarea
              value={localContent}
              onChange={handleContentChange}
              placeholder={t('editor.placeholder')}
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
