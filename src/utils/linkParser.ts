// Link parser utility for extracting [[note-name]] syntax
// As per spec section 6.1

const LINK_REGEX = /\[\[([^\]]+)\]\]/g;

/**
 * Extract all wiki-style links from markdown content
 * @param content - Markdown content to parse
 * @returns Array of link names
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
 * @param onLinkClick - Callback for link clicks
 * @returns Content with processed links
 */
export function processLinks(
  content: string,
  fileExists: (name: string) => boolean
): string {
  return content.replace(LINK_REGEX, (_match, linkName) => {
    const exists = fileExists(linkName.trim());
    const className = exists ? 'wiki-link-exists' : 'wiki-link-missing';
    return `<span class="${className}" data-link="${linkName.trim()}">${linkName}</span>`;
  });
}
