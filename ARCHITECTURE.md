# MindMesh - Architecture and Dependencies

## Overview

**MindMesh** is a standalone React/TypeScript library that provides Obsidian-like note-taking functionality with wiki-style linking, graph visualization, and keyword-based connections. It is packaged as an npm library and distributed via GitHub Packages.

**Package**: `@fluidnotions/mindmesh`
**Version**: 1.0.0
**Type**: React Component Library
**License**: MIT

## Purpose and Role

MindMesh serves as the **note-taking and knowledge management component** used within the YouTube Study Buddy ecosystem. It provides:

- **Wiki-style linking**: Create bidirectional links between notes using `[[note-name]]` syntax
- **Graph visualization**: 3D interactive graph view of note connections using Three.js
- **Markdown support**: Full markdown rendering with GitHub Flavored Markdown (GFM)
- **IndexedDB storage**: Client-side persistent storage for notes and workspaces
- **Internationalization**: Multi-language support via i18next

## Technology Stack

- **Framework**: React 19.x
- **Language**: TypeScript 5.2+
- **Build Tool**: Vite 5.x
- **3D Graphics**: Three.js 0.160+
- **Storage**: IndexedDB (via `idb` library)
- **Markdown**: react-markdown with remark-gfm
- **Testing**: Vitest with React Testing Library
- **Styling**: Tailwind CSS 4.x

## Package Structure

```
mindmesh/
├── src/                    # Library source code
│   ├── components/         # React components
│   ├── hooks/             # Custom React hooks
│   ├── stores/            # State management
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Utility functions
├── dist/                  # Built library output
│   ├── mindmesh.es.js    # ES module bundle
│   ├── mindmesh.umd.js   # UMD bundle
│   ├── mindmesh.css      # Component styles
│   └── index.d.ts        # TypeScript declarations
└── package.json          # Package configuration
```

## Build Configuration

MindMesh is built as a library with multiple output formats:

- **ES Module**: For modern bundlers (Vite, Webpack 5+)
- **UMD**: For legacy compatibility
- **TypeScript Declarations**: Full type support for consumers

### Key Dependencies

**Runtime Dependencies:**
- `react` & `react-dom`: ^19.0.0 (peer dependencies)
- `three`: ^0.160.1 (3D graph visualization)
- `idb`: ^8.0.3 (IndexedDB wrapper)
- `pako`: ^2.1.0 (compression)
- `uuid`: ^9.0.1 (unique identifiers)
- `react-markdown`: ^9.0.1 (markdown rendering)
- `i18next` & `react-i18next`: ^25.6.0 (internationalization)

## Integration with Other Repositories

### Used By: YouTube Buddy Frontend

**Repository**: `youtube-buddy-frontend`
**Relationship**: MindMesh is installed as a direct npm package dependency

```json
{
  "dependencies": {
    "@fluidnotions/mindmesh": "file:../../mindmesh-app/mindmesh/fluidnotions-mindmesh-1.0.0.tgz"
  }
}
```

The frontend uses MindMesh to:
1. **Display study notes** generated from YouTube video transcripts
2. **Enable wiki-style linking** between related study topics
3. **Visualize knowledge graphs** showing connections between concepts
4. **Manage user workspaces** with persistent storage

### Key Integration Points

1. **Component Import**: Frontend imports MindMesh React components
   ```typescript
   import { MindMeshEditor, GraphView } from '@fluidnotions/mindmesh'
   import '@fluidnotions/mindmesh/css'
   ```

2. **Data Format**: MindMesh expects notes in a specific format:
   ```typescript
   interface Note {
     id: string
     title: string
     content: string  // Markdown with [[wiki-links]]
     tags: string[]
     createdAt: number
     updatedAt: number
   }
   ```

3. **Storage**: Uses browser IndexedDB for client-side persistence
   - Workspaces can be exported/imported
   - Backend lambdas handle workspace sync with S3

## Development Workflow

### Building the Library

```bash
npm run build:lib        # Build library bundle
npm run build:all        # Build library + demo app
npm pack                 # Create .tgz package for local install
```

### Testing

```bash
npm run test            # Run tests in watch mode
npm run test:run        # Single test run
npm run test:coverage   # Generate coverage report
```

### Publishing

The library is configured for GitHub Packages:

```json
{
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  }
}
```

## Current Status

### Stable Features
- ✅ Wiki-style linking with `[[note-name]]` syntax
- ✅ Bidirectional link tracking
- ✅ 3D graph visualization
- ✅ Markdown rendering with GFM support
- ✅ IndexedDB persistence
- ✅ Multi-language support (i18n)
- ✅ Full TypeScript support

### Architecture Notes

1. **Standalone Library**: MindMesh is completely independent and can be used in any React application
2. **No Backend Dependency**: All core functionality works entirely in the browser
3. **Flexible Storage**: While it uses IndexedDB by default, the storage layer can be customized
4. **Peer Dependencies**: Requires React 19+ to be installed by the consuming application

## Dependencies on Other Repositories

**None** - MindMesh is a standalone library with no direct dependencies on other YouTube Study Buddy repositories.

## Related Repositories

### Downstream (Uses MindMesh)
- **youtube-buddy-frontend**: React web application that integrates MindMesh for note display and management

### Related Infrastructure
- **youtube-buddy-infrastructure**: Lambda functions for workspace sync
  - `mindmesh_workspace_load`: Load workspace from S3
  - `mindmesh_workspace_save`: Save workspace to S3
  - `mindmesh_file_create/update/delete`: Individual file operations

## Future Considerations

1. **NPM Publishing**: Currently uses local .tgz file; consider publishing to GitHub Packages
2. **Version Management**: Coordinate version updates with frontend dependency updates
3. **Storage Sync**: Enhanced synchronization between IndexedDB and S3-backed storage
4. **Graph Performance**: Optimization for large note collections (1000+ notes)

## Contact and Context

When working in this repository with Claude Code, remember:
- This is a **pure library** - no application-specific business logic
- Changes here affect the **frontend UI/UX** for note display
- Test thoroughly before packaging - the frontend depends on stability
- Coordinate with frontend team when making breaking changes to the API
