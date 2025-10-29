# Obsidian Clone - Note Taking Application

A minimal React-based note-taking application inspired by Obsidian, featuring wiki-style linking between documents, visual graph representation of connections, and a file explorer interface.

## Features

- **File Explorer**: Left sidebar with file management (create, delete, search files)
- **Markdown Editor**: Central editing area with multiple view modes (edit, preview, split)
- **Wiki-Style Linking**: Bidirectional linking using `[[note-name]]` syntax
- **Graph Visualization**: Interactive graph showing document relationships
- **Auto-save**: Automatic saving with debounce (500ms)
- **Local Storage**: Persistent storage using browser LocalStorage

## Technology Stack

- **React 18+** with TypeScript
- **Vite** for build tooling
- **react-markdown** for markdown rendering
- **remark-gfm** for GitHub Flavored Markdown support
- **UUID** for unique identifiers
- **React Context API** for state management

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:5173`

### Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

### Preview Production Build

```bash
npm run preview
```

## Usage

### Creating Notes

1. Click the "+ New Note" button in the file explorer
2. Enter a name for your note
3. Start writing in markdown

### Linking Notes

Use the wiki-style syntax to link between notes:

```markdown
This is a link to [[Another Note]]
```

- Blue links indicate existing notes
- Orange dashed links indicate notes that don't exist yet
- Click a missing link to create the note

### View Modes

Toggle between three editor modes:
- **Edit**: Pure editing mode
- **Preview**: Rendered markdown view
- **Split**: Side-by-side editing and preview

### Graph View

Click the "Graph" button in the bottom-right to toggle the graph visualization:
- Nodes represent notes
- Lines represent links between notes
- The current note is highlighted in blue
- Click nodes to navigate (implementation in progress)

## Project Structure

```
src/
├── components/
│   ├── FileExplorer/    # File sidebar component
│   ├── Editor/          # Markdown editor component
│   ├── GraphView/       # Graph visualization component
│   └── Preview/         # Markdown preview component
├── context/
│   └── AppContext.tsx   # Global state management
├── models/
│   └── types.ts         # TypeScript interfaces
├── services/
│   ├── fileService.ts   # File CRUD operations
│   ├── storageService.ts # LocalStorage persistence
│   └── graphService.ts  # Graph data generation
├── utils/
│   └── linkParser.ts    # Wiki-link parsing utilities
├── App.tsx              # Main app component
└── main.tsx            # Entry point
```

## Development Roadmap

### Phase 1: Core Foundation (Completed)
- [x] Project setup with Vite + React + TypeScript
- [x] Basic file CRUD operations
- [x] File explorer UI
- [x] Markdown editor with auto-save

### Phase 2: Linking System (In Progress)
- [x] [[link]] parsing
- [x] Link navigation functionality
- [x] Bidirectional link tracking
- [ ] Backlinks panel

### Phase 3: Graph Visualization (In Progress)
- [x] Basic graph rendering
- [x] Graph data from links
- [ ] Interactive node clicking
- [ ] Force-directed layout with physics
- [ ] Graph controls (zoom, pan, filter)

### Phase 4: Polish & Optimization
- [ ] Keyboard shortcuts
- [ ] Performance optimization
- [ ] Responsive design
- [ ] Comprehensive testing

## Future Enhancements

- File sync across devices
- Tags and metadata system
- Full-text search
- Export to PDF/HTML
- Themes and customization
- Plugin system
- Version history

## Contributing

This is a learning/demo project. Feel free to fork and modify for your own use.

## License

MIT

## Acknowledgments

Inspired by [Obsidian](https://obsidian.md/) - the excellent markdown note-taking application.
