# MindMesh Library Build Documentation

## Overview

MindMesh is configured as a reusable React library that can be installed and consumed by other projects. This document describes the build configuration, outputs, and development workflow.

## Build Configuration

### Library Entry Point

**File:** `src/index.ts`

The main entry point exports all public APIs, components, hooks, types, and utilities:

- **Facade API**: `NotesAppFacade` - Main programmatic API
- **React Components**: `App`, `FileExplorer`, `Editor`, `GraphView`, `Preview`
- **Context & Hooks**: `AppProvider`, `useApp`
- **Services**: `buildGraphData`, `getConnectedSubgraph`, `buildKeywordIndex`
- **Storage**: `StorageBackend` interface, types, and error handling
- **Utilities**: Link parsing utilities
- **i18n**: Internationalization configuration

### Vite Library Configuration

**File:** `vite.config.lib.ts`

The library uses Vite's library mode with the following configuration:

- **Entry Point**: `src/index.ts`
- **Library Name**: `MindMesh`
- **Output Formats**:
  - ESM (ES Modules): `mindmesh.es.js`
  - UMD (Universal Module Definition): `mindmesh.umd.js`
- **External Dependencies**: React, React-DOM, React JSX Runtime (not bundled)
- **TypeScript Declarations**: Generated via `vite-plugin-dts`
- **Source Maps**: Enabled for debugging
- **CSS**: Bundled as `mindmesh.css`

### TypeScript Configuration

**File:** `tsconfig.json`

Key compiler options for library builds:

- `declaration: true` - Generate `.d.ts` files
- `declarationMap: true` - Generate declaration source maps
- `declarationDir: "./dist"` - Output location for declarations
- Excludes test files and `main.tsx` from type generation

### Package Configuration

**File:** `package.json`

Library metadata and entry points:

```json
{
  "name": "@fluidnotions/mindmesh",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/mindmesh.umd.js",
  "module": "./dist/mindmesh.es.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/mindmesh.es.js",
      "require": "./dist/mindmesh.umd.js",
      "types": "./dist/index.d.ts"
    },
    "./css": "./dist/mindmesh.css"
  },
  "files": ["dist", "README.md", "LICENSE"]
}
```

## Build Commands

### Build Library

```bash
npm run build:lib
```

This command:
1. Runs TypeScript compiler (`tsc`) to validate types
2. Builds the library using Vite with library configuration
3. Generates TypeScript declarations with source maps
4. Outputs to `dist/` directory

### Build All

```bash
npm run build:all
```

Builds both the library and the standalone application.

### Development Mode

```bash
npm run dev
```

Runs the development server for testing the application locally.

## Build Outputs

After running `npm run build:lib`, the `dist/` directory contains:

### JavaScript Bundles

| File | Size | Format | Description |
|------|------|--------|-------------|
| `mindmesh.es.js` | ~986 KB | ESM | ES module format for modern bundlers |
| `mindmesh.umd.js` | ~737 KB | UMD | Universal format for browser/Node.js |
| `mindmesh.es.js.map` | ~3.3 MB | - | Source map for ESM build |
| `mindmesh.umd.js.map` | ~3.2 MB | - | Source map for UMD build |

**Compressed Sizes:**
- ESM gzipped: ~235 KB
- UMD gzipped: ~203 KB

### CSS

| File | Size | Description |
|------|------|-------------|
| `mindmesh.css` | ~10 KB | Compiled styles (2.5 KB gzipped) |

### TypeScript Declarations

The build generates complete TypeScript declarations for the entire library:

```
dist/
├── index.d.ts              # Main declarations entry point
├── index.d.ts.map          # Declaration source map
├── api/                    # API types and facade
│   ├── NotesAppFacade.d.ts
│   ├── types.d.ts
│   └── ...
├── components/             # Component types
│   ├── FileExplorer/
│   ├── Editor/
│   ├── GraphView/
│   └── ...
├── services/               # Service types
├── storage/                # Storage types
├── models/                 # Data model types
└── utils/                  # Utility types
```

## Bundle Analysis

### External Dependencies

The following dependencies are **externalized** (not bundled):
- `react`
- `react-dom`
- `react/jsx-runtime`

Consumers must install these as peer dependencies.

### Bundled Dependencies

The following dependencies are **included** in the bundle:
- `@aws-sdk/client-dynamodb`
- `@aws-sdk/util-dynamodb`
- `i18next`
- `react-i18next`
- `idb` (IndexedDB wrapper)
- `pako` (compression)
- `react-markdown`
- `remark-gfm`
- `three` (3D graph rendering)
- `uuid`

## Build Warnings

### Dynamic Import Warning

```
(!) storageService.ts is dynamically imported by NotesAppFacade.ts
but also statically imported by AppContext.tsx, dynamic import
will not move module into another chunk.
```

**Status:** Non-critical. This is a code-splitting optimization hint. The module is included in the main bundle.

**Impact:** None on functionality. Slight impact on bundle optimization.

## Quality Checks

### Type Safety

The build runs `tsc` first, ensuring:
- All TypeScript files compile without errors
- Generated declarations are valid
- Type exports are correctly structured

### Source Maps

Both JavaScript bundles and TypeScript declarations include source maps for:
- Better debugging experience
- IDE jump-to-definition support
- Error stack trace clarity

## Publishing

### Pre-publish Checklist

Before publishing to npm/GitHub Packages:

1. **Run Tests**: `npm run test:run`
2. **Build Library**: `npm run build:lib`
3. **Verify Outputs**: Check `dist/` directory
4. **Version Bump**: Update `version` in `package.json`
5. **Update Changelog**: Document changes

### Publish Command

The package is configured to publish to GitHub Packages:

```json
{
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  }
}
```

Publish with:

```bash
npm publish
```

### Pre-publish Hook

The `prepublishOnly` script automatically:
1. Runs tests (`npm run test:run`)
2. Builds library (`npm run build:lib`)

This ensures only tested, built code is published.

## Troubleshooting

### Build Fails with Module Not Found

**Issue:** TypeScript can't find modules in `storage/` directory.

**Solution:** The `storage/index.ts` has been updated to only export what exists. Ensure all imports in `src/index.ts` match available exports.

### Declaration Generation Fails

**Issue:** `.d.ts` files not generated.

**Solutions:**
1. Check `vite-plugin-dts` is installed
2. Verify `tsconfig.json` has `declaration: true`
3. Ensure no TypeScript errors exist

### Large Bundle Size

**Issue:** Bundle is larger than expected.

**Investigation:**
1. Check if dependencies are properly externalized
2. Use `npm run build:lib` and review console output
3. Consider lazy-loading heavy dependencies (e.g., Three.js)

### CSS Not Loading

**Issue:** Styles not applied in consuming application.

**Solution:** Import CSS separately:

```javascript
import '@fluidnotions/mindmesh/css'
```

## Development Workflow

### Making Changes

1. **Modify Source**: Edit files in `src/`
2. **Test Locally**: `npm run dev`
3. **Run Tests**: `npm test`
4. **Build Library**: `npm run build:lib`
5. **Verify Output**: Check `dist/` directory
6. **Version Bump**: Update `package.json`
7. **Publish**: `npm publish`

### Testing in Consumer Project

Before publishing, test the library in the consuming project:

1. **Build Library**: `npm run build:lib`
2. **Create Tarball**: `npm pack`
3. **Install in Consumer**:
   ```bash
   cd /path/to/consumer/project
   npm install /path/to/mindmesh/fluidnotions-mindmesh-1.0.0.tgz
   ```
4. **Test Integration**
5. **Fix Issues** and repeat

### Continuous Integration

Consider setting up CI/CD to:
- Run tests on every commit
- Build library on pull requests
- Auto-publish on version tags
- Generate bundle size reports

## Performance Considerations

### Bundle Size Optimization

Current bundle sizes are reasonable for a feature-rich library:
- ESM: 235 KB (gzipped)
- UMD: 203 KB (gzipped)

**Potential Optimizations:**
1. Lazy-load Three.js for graph view
2. Code-split i18n translations
3. Tree-shaking improvements in consuming apps

### Runtime Performance

The library is optimized for:
- Fast initial load with code splitting
- Efficient re-renders with React hooks
- Optimized storage with compression
- IndexedDB for local persistence

## Version History

### 1.0.0 (Current)

- Initial library build configuration
- Full TypeScript declarations
- ESM and UMD formats
- Complete API exports
- Documentation

## Related Documentation

- [Installation Guide](./INSTALLATION.md) - How to install and use MindMesh
- [API Documentation](./API_DOCUMENTATION.md) - Complete API reference
- [Development Guide](./DEVELOPMENT.md) - Contributing and development setup
- [DynamoDB Integration](./DYNAMODB_DESIGN.md) - Backend storage design
