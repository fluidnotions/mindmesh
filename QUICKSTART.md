# ObClone Quick Start

## What is ObClone?

ObClone is an Obsidian-like note-taking library with:
- **Wiki Links**: `[[keyword]]` connects notes via content keywords
- **Graph View**: Visualize note connections with zoom/pan
- **Hierarchical Folders**: Organize notes in nested folders
- **Keyword Matching**: Links find ANY note containing the keyword
- **Multi-language**: English, Spanish, French support

## Modes of Use

### 1. Standalone App (Current Setup)

Run as a standalone application:

```bash
npm install
npm run dev          # Development server
npm run build        # Production build
```

Open http://localhost:5173 - the app runs standalone!

### 2. Library in Your React App

Install as a package and embed:

```bash
npm install @your-username/obclone
```

```typescript
import { App, AppProvider } from '@your-username/obclone';
import '@your-username/obclone/css';

function MyApp() {
  return (
    <AppProvider>
      <App />
    </AppProvider>
  );
}
```

### 3. Programmatic Control (Facade API)

Control the app programmatically:

```typescript
import { NotesAppFacade } from '@your-username/obclone';

const notesApp = new NotesAppFacade();
notesApp.mount(document.getElementById('root'));

// Create files programmatically
await notesApp.createFile('My Note', '/My Note', '# Hello');

// Listen to events
notesApp.on('file:created', (event) => {
  console.log('Created:', event.file);
});
```

## Publishing to GitHub Packages

### One-Time Setup

1. **Update package.json** - Replace `@your-username` with your GitHub username

2. **Create GitHub Token**
   - Go to GitHub Settings → Developer settings → Personal access tokens
   - Generate token with `write:packages` scope

3. **Configure npm locally**
   ```bash
   echo "@YOUR_USERNAME:registry=https://npm.pkg.github.com" >> ~/.npmrc
   echo "//npm.pkg.github.com/:_authToken=YOUR_TOKEN" >> ~/.npmrc
   ```

### Publishing

```bash
# Bump version
npm version patch  # or minor, major

# Build and publish
npm run build:lib
npm publish
```

Or use GitHub Actions - automatically publishes on release!

## Key Features

### Wiki Links with Keyword Matching

```markdown
# JavaScript Basics

## Variables
Learn about variables...

## Functions
Learn about functions...
```

Now ANY note with `[[Variables]]` or `[[Functions]]` will link here!

### Multiple Matches

If `[[JavaScript]]` appears in 3 files, the link shows:
- `[[JavaScript[3]]]` - indicates 3 matches
- Click opens first match
- Graph shows all 3 connections

### Graph Navigation

- Mouse wheel: Zoom in/out
- Middle button drag: Pan around
- Click node: Open that file

### Storage Options

**LocalStorage** (Default)
```typescript
// Automatic - no config needed
```

**DynamoDB**
```typescript
import { DynamoDBStorage } from '@your-username/obclone';

const storage = new DynamoDBStorage({
  region: 'us-east-1',
  tableName: 'notes',
});
```

**Custom Backend**
```typescript
class MyStorage implements StorageBackend {
  async loadWorkspace(userId) { /* your logic */ }
  async saveWorkspace(userId, data) { /* your logic */ }
}
```

## File Structure

```
src/
  index.ts              # Library entry point
  main.tsx              # Standalone app entry
  App.tsx               # Main React component

  api/
    NotesAppFacade.ts   # Programmatic API

  components/           # React UI components
  context/              # React Context for state
  services/             # Business logic
  storage/              # Storage backends
  i18n/                 # Internationalization

dist/                   # Build output (library)
  obclone.es.js         # ESM bundle
  obclone.umd.js        # UMD bundle
  obclone.css           # Styles
  index.d.ts            # Types
```

## Build Scripts

```bash
# Development
npm run dev            # Standalone app dev server
npm run test           # Run tests with watch
npm run lint           # Lint code

# Building
npm run build          # Build standalone app
npm run build:lib      # Build library
npm run build:all      # Build both

# Publishing
npm run prepublishOnly # Auto-runs before publish (tests + build)
npm publish            # Publish to GitHub Packages
```

## Documentation

- **LIBRARY_USAGE.md** - Complete usage guide with examples
- **PUBLISHING.md** - Publishing instructions
- **API_DOCUMENTATION.md** - Full API reference
- **DYNAMODB_DESIGN.md** - DynamoDB storage design

## Next Steps

1. **To use standalone**: Just run `npm run dev`

2. **To publish as library**:
   - Update package.json with your username
   - Run `npm run build:lib`
   - Run `npm publish`

3. **To embed in your app**:
   - Publish the package
   - Install in your app
   - Import and use components

## Support

- Test the standalone app: `npm run dev`
- Test the library build: `npm run build:lib`
- Run tests: `npm run test:run`
- Check dist/ folder for build outputs

The app works both ways - standalone AND as a library! 🎉
