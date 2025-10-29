// Main App component - Root of the application
import { AppProvider, useApp } from './context/AppContext';
import { FileExplorer } from './components/FileExplorer/FileExplorer';
import { Editor } from './components/Editor/Editor';
import { GraphView } from './components/GraphView/GraphView';
import './App.css';

function AppContent() {
  const { toggleGraphView } = useApp();

  return (
    <div className="app">
      <FileExplorer />
      <Editor />
      <GraphView />
      <button className="btn-toggle-graph" onClick={toggleGraphView}>
        📊 Graph
      </button>
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
