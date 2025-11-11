// Markdown Editor component
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../context/AppContext';
import { Preview } from '../Preview/Preview';
import { Breadcrumb } from '../FileExplorer/Breadcrumb';

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
      <div className="flex flex-col h-screen bg-card overflow-hidden">
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
          <p>{t('editor.noFileSelected')}</p>
          <p>{t('editor.selectFilePrompt')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-card overflow-hidden">
      <Breadcrumb path={currentFile.path} />
      <div className="p-6 border-b border-border bg-background">
        <div>
          <h1 className="text-2xl text-foreground m-0">{currentFile.name}</h1>
        </div>
        <div className="mt-4 flex justify-between items-center">
          <div className="flex gap-2">
            <button
              className={`px-4 py-2 rounded text-sm transition-colors border ${editorViewMode === 'edit' ? 'bg-primary border-primary text-primary-foreground' : 'bg-secondary text-foreground border-border hover:bg-secondary/80'}`}
              onClick={() => setEditorViewMode('edit')}
            >
              {t('editor.editMode')}
            </button>
            <button
              className={`px-4 py-2 rounded text-sm transition-colors border ${editorViewMode === 'preview' ? 'bg-primary border-primary text-primary-foreground' : 'bg-secondary text-foreground border-border hover:bg-secondary/80'}`}
              onClick={() => setEditorViewMode('preview')}
            >
              {t('editor.previewMode')}
            </button>
            <button
              className={`px-4 py-2 rounded text-sm transition-colors border ${editorViewMode === 'split' ? 'bg-primary border-primary text-primary-foreground' : 'bg-secondary text-foreground border-border hover:bg-secondary/80'}`}
              onClick={() => setEditorViewMode('split')}
            >
              {t('editor.splitMode')}
            </button>
          </div>
          <div className={`text-sm ${saveStatus === 'saved' ? 'text-success' : saveStatus === 'saving' ? 'text-warning' : 'text-destructive'}`}>
            {saveStatus === 'saved' && `✓ ${t('editor.saved')}`}
            {saveStatus === 'saving' && `⟳ ${t('editor.saving')}`}
            {saveStatus === 'unsaved' && `● ${t('editor.unsaved')}`}
          </div>
        </div>
      </div>

      <div className={`flex-1 flex overflow-hidden ${editorViewMode === 'split' ? 'grid grid-cols-2' : ''}`}>
        {(editorViewMode === 'edit' || editorViewMode === 'split') && (
          <div className="flex-1 flex overflow-hidden">
            <textarea
              value={localContent}
              onChange={handleContentChange}
              placeholder={t('editor.placeholder')}
              spellCheck={false}
              className="flex-1 p-6 bg-background text-foreground border-none outline-none font-mono text-base leading-relaxed resize-none"
            />
          </div>
        )}

        {(editorViewMode === 'preview' || editorViewMode === 'split') && (
          <div className="flex-1 overflow-y-auto p-6 bg-card border-l border-border">
            <Preview content={localContent} />
          </div>
        )}
      </div>
    </div>
  );
}
