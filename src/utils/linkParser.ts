// Link parser utility for extracting [[note-name]] syntax
// As per spec section 6.1

const LINK_REGEX = /\[\[([^\]]+)\]\]/g;

/**
 * Extract all wiki-style links from markdown content
 * @param content - Markdown content to parse
 * @returns Array of link names (or paths)
 */
export function extractLinks(content: string): string[] {
  const links: string[] = [];
  const matches = content.matchAll(LINK_REGEX);

  for (const match of matches) {
    if (match[1]) {
      links.push(match[1].trim());
    }
  }

  return links;
}

/**
 * Parse a link reference which can be:
 * - Simple name: [[MyNote]]
 * - Full path: [[/Folder/MyNote]]
 * - Relative path: [[Folder/MyNote]]
 * @param linkRef - Link reference from [[...]]
 * @returns Object with name and path information
 */
export function parseLinkReference(linkRef: string): {
  name: string;
  fullPath: string | null;
  isPath: boolean;
} {
  const trimmed = linkRef.trim();

  // Check if it contains a slash (path-based link)
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/').filter((p) => p);
    const name = parts[parts.length - 1] || trimmed;
    const fullPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;

    return {
      name,
      fullPath,
      isPath: true,
    };
  }

  // Simple name-based link
  return {
    name: trimmed,
    fullPath: null,
    isPath: false,
  };
}

/**
 * Check if a link exists in the content
 * @param content - Markdown content
 * @param linkName - Name of the link to find
 * @returns true if link exists
 */
export function hasLink(content: string, linkName: string): boolean {
  const links = extractLinks(content);
  return links.includes(linkName);
}

/**
 * Replace wiki-style links with clickable links
 * @param content - Markdown content
 * @param fileExists - Function to check if a file exists by name or path
 * @returns Content with processed links
 */
export function processLinks(
  content: string,
  fileExists: (nameOrPath: string) => boolean
): string {
  return content.replace(LINK_REGEX, (_match, linkRef) => {
    const parsed = parseLinkReference(linkRef);

    // Try to find the file by full path first, then by name
    let exists = false;
    if (parsed.isPath && parsed.fullPath) {
      exists = fileExists(parsed.fullPath);
    } else {
      exists = fileExists(parsed.name);
    }

    const className = exists ? 'wiki-link-exists' : 'wiki-link-missing';
    return `<span class="${className}" data-link="${linkRef.trim()}">${linkRef}</span>`;
  });
}
