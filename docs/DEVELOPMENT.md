# Development Guide

## Project Architecture

This project follows the architecture specified in the Obsidian Editor Product Specification Document.

### Key Architectural Decisions

1. **State Management**: React Context API for lightweight global state
2. **Data Persistence**: LocalStorage for simple, browser-based storage
3. **Markdown Processing**: react-markdown + remark-gfm for rendering
4. **Graph Rendering**: Basic Canvas API implementation (can be enhanced with D3.js or react-force-graph-2d)

## Component Hierarchy

```
App
├── AppProvider (Context)
│   └── AppContent
│       ├── FileExplorer
│       ├── Editor
│       │   └── Preview
│       └── GraphView
```

## Data Flow

1. **User creates/edits a file** → AppContext updates state → localStorage saves
2. **User types in editor** → Debounced update (500ms) → Extract links → Update file
3. **Link clicked in preview** → Check if file exists → Navigate or create new file
4. **Files updated** → Graph data rebuilt → GraphView re-renders

## Key Files

- `src/context/AppContext.tsx` - Global state and file operations
- `src/services/fileService.ts` - File CRUD operations and link extraction
- `src/services/storageService.ts` - LocalStorage persistence
- `src/services/graphService.ts` - Graph data generation
- `src/utils/linkParser.ts` - Wiki-link parsing utilities

## Development Milestones Status

### Phase 1: Core Foundation ✅
- [x] React project structure
- [x] Basic file CRUD operations
- [x] File explorer UI
- [x] Markdown editor with auto-save

### Phase 2: Linking System ✅ (Basic)
- [x] [[link]] parsing
- [x] Link navigation
- [x] Bidirectional link tracking
- [ ] Backlinks panel (TODO)

### Phase 3: Graph Visualization 🚧 (In Progress)
- [x] Basic graph rendering
- [x] Graph data from links
- [ ] Interactive node clicking (TODO)
- [ ] Force-directed layout with physics (TODO)
- [ ] Graph controls: zoom, pan, filter (TODO)

### Phase 4: Polish & Optimization ⏳
- [ ] Keyboard shortcuts
- [ ] Performance optimization
- [ ] Responsive design
- [ ] Testing

## Next Steps for Enhancement

1. **Improve Graph Visualization**
   - Add d3-force or react-force-graph-2d library
   - Implement interactive node dragging
   - Add zoom and pan controls
   - Implement force-directed layout

2. **Add Backlinks Panel**
   - Show which notes link to the current note
   - Display in a sidebar or collapsible section

3. **Keyboard Shortcuts**
   - Ctrl/Cmd + N: New note
   - Ctrl/Cmd + S: Manual save
   - Ctrl/Cmd + K: Toggle graph
   - Ctrl/Cmd + P: Command palette

4. **Folder Support**
   - Currently files are flat; add folder hierarchy
   - Tree view in file explorer
   - Nested navigation

5. **Search Functionality**
   - Full-text search across all notes
   - Search in file explorer (partially implemented)
   - Search results view

6. **Export Features**
   - Export individual notes
   - Export entire vault
   - Format options: Markdown, HTML, PDF

## Performance Considerations

- **File Size**: Current implementation loads all files into memory
  - Consider pagination or lazy loading for large vaults (>100 files)

- **Graph Rendering**: Basic canvas implementation
  - Switch to WebGL for better performance with large graphs
  - Implement viewport culling

- **Auto-save**: 500ms debounce prevents excessive localStorage writes
  - Consider IndexedDB for larger vaults

## Testing

Currently no tests are implemented. Recommended testing approach:

1. **Unit Tests**: Services and utilities (fileService, linkParser, graphService)
2. **Integration Tests**: Context and component interactions
3. **E2E Tests**: User workflows (create note, link notes, navigate graph)

## Browser Compatibility

Tested on:
- Chrome 90+
- Firefox 88+
- Edge 90+

Note: Safari may have different behavior with LocalStorage limits.

## Known Limitations

1. LocalStorage has ~5-10MB limit per origin
2. No file system access (browser security sandbox)
3. Single-user only (no collaboration)
4. Graph rendering is basic (not optimized for large networks)
5. No mobile optimization yet

## Contributing

When adding features:
1. Follow the existing component structure
2. Update type definitions in `models/types.ts`
3. Add services for business logic (not in components)
4. Use the AppContext for state management
5. Update this document with architectural decisions
