// Main App component - Root of the application
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AppProvider, useApp } from './context/AppContext';
import { FileExplorer } from './components/FileExplorer/FileExplorer';
import { Editor } from './components/Editor/Editor';
import { GraphView } from './components/GraphView/GraphView';
import { LanguageSwitcher } from './components/LanguageSwitcher/LanguageSwitcher';
import { NotesAppFacade } from './api/NotesAppFacade';

interface AppProps {
  facade?: NotesAppFacade;
}

function AppContent({ facade }: { facade?: NotesAppFacade }) {
  const { t } = useTranslation();
  const context = useApp();
  const { toggleGraphView, files, folders, currentFileId, editorViewMode, showGraphView } = context;

  // Sync state with facade
  useEffect(() => {
    if (facade) {
      facade._updateState({
        files,
        folders,
        currentFileId,
        editorViewMode,
        showGraphView,
      });
    }
  }, [facade, files, folders, currentFileId, editorViewMode, showGraphView]);

  // Provide context reference to facade
  useEffect(() => {
    if (facade) {
      facade._setContextRef(context);
    }
  }, [facade, context]);

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden">
      <div className="shrink-0 w-full">
        <LanguageSwitcher />
      </div>
      <div className="flex-1 flex overflow-hidden">
        <FileExplorer />
        <Editor />
        <GraphView />
        <button className="fixed bottom-8 right-8 px-5 py-3 bg-primary text-primary-foreground rounded-lg shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0" onClick={toggleGraphView}>
          📊 {t('graphView.title')}
        </button>
      </div>
    </div>
  );
}

function App({ facade }: AppProps = {}) {
  return (
    <AppProvider>
      <AppContent facade={facade} />
    </AppProvider>
  );
}

export default App;
