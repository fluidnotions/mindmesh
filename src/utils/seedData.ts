// Seed data with demo files and folders to showcase features

import { File, Folder } from '../models/types';
import { v4 as uuidv4 } from 'uuid';

export interface SeedData {
  files: Map<string, File>;
  folders: Map<string, Folder>;
}

export function createSeedData(): SeedData {
  const now = Date.now();
  const files = new Map<string, File>();
  const folders = new Map<string, Folder>();

  // Create folders
  const programmingFolder: Folder = {
    id: uuidv4(),
    name: 'Programming',
    path: '/Programming',
    parentPath: null,
    children: [],
  };

  const javascriptFolder: Folder = {
    id: uuidv4(),
    name: 'JavaScript',
    path: '/Programming/JavaScript',
    parentPath: '/Programming',
    children: [],
  };

  const reactFolder: Folder = {
    id: uuidv4(),
    name: 'React',
    path: '/Programming/React',
    parentPath: '/Programming',
    children: [],
  };

  const personalFolder: Folder = {
    id: uuidv4(),
    name: 'Personal',
    path: '/Personal',
    parentPath: null,
    children: [],
  };

  folders.set(programmingFolder.id, programmingFolder);
  folders.set(javascriptFolder.id, javascriptFolder);
  folders.set(reactFolder.id, reactFolder);
  folders.set(personalFolder.id, personalFolder);

  // Create files with links between them
  const welcomeFile: File = {
    id: uuidv4(),
    name: 'Welcome',
    path: '/Welcome',
    content: `# Welcome to Your Notes App! 🎉

This is a demo workspace with interconnected notes to showcase the features.

## Key Features

1. **Hierarchical Folders** - Organize notes in nested folders
2. **Wiki Links** - Connect notes using [[Note Name]] syntax
3. **Graph View** - Visualize connections between notes
4. **Drag and Drop** - Move files between folders

## Explore the Demo

Check out these connected notes:

- [[JavaScript Basics]] - Start learning JavaScript
- [[React Hooks]] - Modern React patterns
- [[My Learning Journey]] - Personal reflections

Try clicking the links above to navigate, or use the **Graph** button to see all connections!`,
    created: now,
    modified: now,
    links: ['JavaScript Basics', 'React Hooks', 'My Learning Journey'],
  };

  const jsBasicsFile: File = {
    id: uuidv4(),
    name: 'JavaScript Basics',
    path: '/Programming/JavaScript/JavaScript Basics',
    content: `# JavaScript Basics

JavaScript is a powerful programming language used for web development.

## Core Concepts

### Variables
\`\`\`javascript
const name = "Hello";
let count = 42;
\`\`\`

### Functions
\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}
\`\`\`

## Related Topics

- [[React Basics]] - Learn React framework
- [[TypeScript]] - Type-safe JavaScript
- [[Welcome]] - Back to welcome page

## Next Steps

After mastering the basics, explore:
- [[React Hooks]] - Modern React patterns
- [[State Management]] - Managing app state`,
    created: now - 1000,
    modified: now - 500,
    links: ['React Basics', 'TypeScript', 'Welcome', 'React Hooks', 'State Management'],
  };

  const reactBasicsFile: File = {
    id: uuidv4(),
    name: 'React Basics',
    path: '/Programming/React/React Basics',
    content: `# React Basics

React is a JavaScript library for building user interfaces.

## Components

Components are the building blocks of React apps:

\`\`\`jsx
function Welcome(props) {
  return <h1>Hello, {props.name}</h1>;
}
\`\`\`

## Props and State

- **Props**: Data passed to components
- **State**: Internal component data

Learn more about [[React Hooks]] for modern state management.

## Prerequisites

Make sure you understand [[JavaScript Basics]] before diving into React.

## Advanced Topics

- [[React Hooks]] - useState, useEffect, and more
- [[State Management]] - Redux, Context API`,
    created: now - 2000,
    modified: now - 1000,
    links: ['React Hooks', 'JavaScript Basics', 'State Management'],
  };

  const reactHooksFile: File = {
    id: uuidv4(),
    name: 'React Hooks',
    path: '/Programming/React/React Hooks',
    content: `# React Hooks

Hooks let you use state and other React features without writing classes.

## Common Hooks

### useState
\`\`\`jsx
const [count, setCount] = useState(0);
\`\`\`

### useEffect
\`\`\`jsx
useEffect(() => {
  // Side effect code
}, [dependencies]);
\`\`\`

### useContext
\`\`\`jsx
const value = useContext(MyContext);
\`\`\`

## Prerequisites

Before learning hooks, understand:
- [[React Basics]] - Component fundamentals
- [[JavaScript Basics]] - JS fundamentals

## Related

- [[State Management]] - Global state with hooks
- [[TypeScript]] - Type-safe hooks`,
    created: now - 3000,
    modified: now - 1500,
    links: ['React Basics', 'JavaScript Basics', 'State Management', 'TypeScript'],
  };

  const typeScriptFile: File = {
    id: uuidv4(),
    name: 'TypeScript',
    path: '/Programming/TypeScript',
    content: `# TypeScript

TypeScript is JavaScript with syntax for types.

## Why TypeScript?

- Type safety catches errors early
- Better IDE support
- Improved code documentation

## Basic Types

\`\`\`typescript
let name: string = "Alice";
let age: number = 30;
let isActive: boolean = true;
\`\`\`

## Interfaces

\`\`\`typescript
interface User {
  name: string;
  age: number;
}
\`\`\`

## Related

- [[JavaScript Basics]] - Learn JS first
- [[React Hooks]] - Typed React hooks
- [[State Management]] - Type-safe state`,
    created: now - 4000,
    modified: now - 2000,
    links: ['JavaScript Basics', 'React Hooks', 'State Management'],
  };

  const stateManagementFile: File = {
    id: uuidv4(),
    name: 'State Management',
    path: '/Programming/State Management',
    content: `# State Management

Managing application state effectively is crucial for scalable apps.

## Approaches

### 1. React Context
Built-in React solution for global state.
See [[React Hooks]] for useContext examples.

### 2. Redux
Popular state management library.

### 3. Zustand
Lightweight alternative.

## When to Use

- Small apps: [[React Hooks]] + Context
- Large apps: Redux or Zustand
- Type safety: [[TypeScript]]

## Prerequisites

- [[React Basics]] - Understand React first
- [[JavaScript Basics]] - JS fundamentals`,
    created: now - 5000,
    modified: now - 2500,
    links: ['React Hooks', 'TypeScript', 'React Basics', 'JavaScript Basics'],
  };

  const learningJourneyFile: File = {
    id: uuidv4(),
    name: 'My Learning Journey',
    path: '/Personal/My Learning Journey',
    content: `# My Learning Journey

## 2024 Goals

1. Master [[JavaScript Basics]]
2. Build projects with [[React Basics]]
3. Learn [[TypeScript]]

## Progress

### Completed ✅
- Basic JavaScript syntax
- First React component

### In Progress 🔄
- [[React Hooks]]
- [[State Management]]

## Resources

Check out [[Welcome]] for an overview of available notes.

## Next Steps

Continue with [[React Hooks]] and then explore [[TypeScript]].`,
    created: now - 6000,
    modified: now - 3000,
    links: ['JavaScript Basics', 'React Basics', 'TypeScript', 'React Hooks', 'State Management', 'Welcome'],
  };

  // Add files to map
  files.set(welcomeFile.id, welcomeFile);
  files.set(jsBasicsFile.id, jsBasicsFile);
  files.set(reactBasicsFile.id, reactBasicsFile);
  files.set(reactHooksFile.id, reactHooksFile);
  files.set(typeScriptFile.id, typeScriptFile);
  files.set(stateManagementFile.id, stateManagementFile);
  files.set(learningJourneyFile.id, learningJourneyFile);

  return { files, folders };
}
