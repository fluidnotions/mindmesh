// Link Index Service - Builds and maintains keyword-to-file mappings
// Uses IndexedDB for persistent caching

import { File } from '../models/types';
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface LinkIndexDB extends DBSchema {
  keywords: {
    key: string; // keyword
    value: {
      keyword: string;
      fileIds: string[]; // files containing this keyword
      lastUpdated: number;
    };
  };
  files: {
    key: string; // fileId
    value: {
      fileId: string;
      keywords: string[]; // keywords in this file
      contentHash: string; // hash of content for change detection
      lastUpdated: number;
    };
  };
  metadata: {
    key: string;
    value: {
      key: string;
      value: string | number;
    };
  };
}

const DB_NAME = 'notes-link-index';
const DB_VERSION = 1;

/**
 * Keyword index for quick lookups
 */
export interface KeywordIndex {
  // keyword -> fileIds that contain it
  keywordToFiles: Map<string, Set<string>>;
  // fileId -> keywords extracted from it
  fileToKeywords: Map<string, Set<string>>;
}

/**
 * Extract keywords from markdown content
 * Includes: headings, bold text, list items (simple heuristic)
 */
export function extractKeywords(content: string): Set<string> {
  const keywords = new Set<string>();

  // Extract markdown headings (# Heading)
  const headingRegex = /^#{1,6}\s+(.+)$/gm;
  let match;
  while ((match = headingRegex.exec(content)) !== null) {
    const heading = match[1].trim();
    if (heading) {
      keywords.add(heading);
      // Also add individual words from multi-word headings
      heading.split(/\s+/).forEach(word => {
        // Remove markdown formatting and punctuation
        const clean = word.replace(/[*_`[\]()!?.,:;]+/g, '');
        if (clean.length > 2) { // Skip very short words
          keywords.add(clean);
        }
      });
    }
  }

  // Extract bold text (**text** or __text__)
  const boldRegex = /(\*\*|__)(.*?)\1/g;
  while ((match = boldRegex.exec(content)) !== null) {
    const boldText = match[2].trim();
    if (boldText && boldText.length > 2) {
      keywords.add(boldText);
    }
  }

  // Extract from list items
  const listRegex = /^[\s]*[-*+]\s+(.+)$/gm;
  while ((match = listRegex.exec(content)) !== null) {
    const item = match[1].trim();
    // Extract first few words (likely to be key terms)
    const words = item.split(/\s+/).slice(0, 3);
    words.forEach(word => {
      // Clean up punctuation
      const clean = word.replace(/[.,!?;:()[\]{}]+$/, '');
      if (clean.length > 2) {
        keywords.add(clean);
      }
    });
  }

  return keywords;
}

/**
 * Simple hash function for content change detection
 */
function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Open or create the IndexedDB database
 */
async function getDB(): Promise<IDBPDatabase<LinkIndexDB>> {
  return openDB<LinkIndexDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create object stores
      if (!db.objectStoreNames.contains('keywords')) {
        db.createObjectStore('keywords', { keyPath: 'keyword' });
      }
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files', { keyPath: 'fileId' });
      }
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata', { keyPath: 'key' });
      }
    },
  });
}

/**
 * Build keyword index from all files
 */
export async function buildKeywordIndex(files: Map<string, File>): Promise<KeywordIndex> {
  const db = await getDB();
  const keywordToFiles = new Map<string, Set<string>>();
  const fileToKeywords = new Map<string, Set<string>>();

  // Check which files have changed
  const filesToUpdate: File[] = [];

  for (const file of files.values()) {
    const contentHash = hashContent(file.content);
    const cached = await db.get('files', file.id);

    if (!cached || cached.contentHash !== contentHash) {
      // File is new or has changed
      filesToUpdate.push(file);
    } else {
      // Use cached keywords
      const keywords = new Set(cached.keywords);
      fileToKeywords.set(file.id, keywords);

      keywords.forEach(keyword => {
        if (!keywordToFiles.has(keyword)) {
          keywordToFiles.set(keyword, new Set());
        }
        keywordToFiles.get(keyword)!.add(file.id);
      });
    }
  }

  // Update changed files
  for (const file of filesToUpdate) {
    const keywords = extractKeywords(file.content);

    // Also add the file name as a keyword
    keywords.add(file.name);
    // Add individual words from file name
    file.name.split(/\s+/).forEach(word => {
      const clean = word.replace(/[*_`[\]()!?.,:;]+/g, '');
      if (clean.length > 2) {
        keywords.add(clean);
      }
    });

    console.log(`[linkIndex] Extracted keywords from "${file.name}":`, Array.from(keywords).slice(0, 15));
    fileToKeywords.set(file.id, keywords);

    // Update keyword-to-files mapping
    keywords.forEach(keyword => {
      if (!keywordToFiles.has(keyword)) {
        keywordToFiles.set(keyword, new Set());
      }
      keywordToFiles.get(keyword)!.add(file.id);
    });

    // Cache in IndexedDB
    const contentHash = hashContent(file.content);
    await db.put('files', {
      fileId: file.id,
      keywords: Array.from(keywords),
      contentHash,
      lastUpdated: Date.now(),
    });

    // Update keyword entries
    for (const keyword of keywords) {
      const existing = await db.get('keywords', keyword);
      const fileIds = existing ? existing.fileIds : [];
      if (!fileIds.includes(file.id)) {
        fileIds.push(file.id);
      }
      await db.put('keywords', {
        keyword,
        fileIds,
        lastUpdated: Date.now(),
      });
    }
  }

  // Clean up deleted files
  const allCachedFiles = await db.getAllKeys('files');
  const currentFileIds = new Set(files.keys());

  for (const cachedFileId of allCachedFiles) {
    if (!currentFileIds.has(cachedFileId)) {
      // File was deleted
      const cached = await db.get('files', cachedFileId);
      if (cached) {
        // Remove from keyword mappings
        for (const keyword of cached.keywords) {
          const keywordEntry = await db.get('keywords', keyword);
          if (keywordEntry) {
            keywordEntry.fileIds = keywordEntry.fileIds.filter(id => id !== cachedFileId);
            if (keywordEntry.fileIds.length === 0) {
              await db.delete('keywords', keyword);
            } else {
              await db.put('keywords', keywordEntry);
            }
          }
        }
        await db.delete('files', cachedFileId);
      }
    }
  }

  // Update metadata
  await db.put('metadata', {
    key: 'lastIndexed',
    value: Date.now(),
  });

  return { keywordToFiles, fileToKeywords };
}

/**
 * Find files that contain a specific keyword
 */
export function findFilesWithKeyword(
  keyword: string,
  index: KeywordIndex
): string[] {
  // Try exact match first
  const exactMatch = index.keywordToFiles.get(keyword);
  if (exactMatch) {
    return Array.from(exactMatch);
  }

  // Try case-insensitive match
  const lowerKeyword = keyword.toLowerCase();
  const matches = new Set<string>();

  index.keywordToFiles.forEach((fileIds, indexedKeyword) => {
    if (indexedKeyword.toLowerCase() === lowerKeyword) {
      fileIds.forEach(id => matches.add(id));
    }
  });

  return Array.from(matches);
}

/**
 * Get all keywords for a file
 */
export function getFileKeywords(
  fileId: string,
  index: KeywordIndex
): string[] {
  const keywords = index.fileToKeywords.get(fileId);
  return keywords ? Array.from(keywords) : [];
}

/**
 * Clear the entire index cache
 */
export async function clearIndexCache(): Promise<void> {
  const db = await getDB();
  await db.clear('keywords');
  await db.clear('files');
  await db.clear('metadata');
}
