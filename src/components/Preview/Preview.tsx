// Markdown Preview component
import React from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useApp } from '../../context/AppContext';
import { parseLinkReference } from '../../utils/linkParser';
import { getParentPath } from '../../services/fileService';
import './Preview.css';

interface PreviewProps {
  content: string;
}

export function Preview({ content }: PreviewProps) {
  const { t } = useTranslation();
  const { files, setCurrentFile, createNewFile, getCurrentFile, keywordIndex } = useApp();
  const currentFile = getCurrentFile();

  // Helper to find files by keyword or exact name/path
  const findFilesByKeyword = (keyword: string): string[] => {
    if (!keywordIndex) {
      // Fallback to name matching if no index
      const file = Array.from(files.values()).find(
        (f) => f.name === keyword || f.path === keyword || f.path === `/${keyword}`
      );
      return file ? [file.id] : [];
    }

    // Use keyword index for matching
    const matches = keywordIndex.keywordToFiles.get(keyword);
    if (matches && matches.size > 0) {
      return Array.from(matches);
    }

    // Try case-insensitive match
    const lowerKeyword = keyword.toLowerCase();
    const allMatches = new Set<string>();
    keywordIndex.keywordToFiles.forEach((fileIds, indexedKeyword) => {
      if (indexedKeyword.toLowerCase() === lowerKeyword) {
        fileIds.forEach(id => allMatches.add(id));
      }
    });

    return Array.from(allMatches);
  };

  // Parse wiki links and replace with placeholders for custom rendering
  const processedContent = React.useMemo(() => {
    const linkRegex = /\[\[([^\]]+)\]\]/g;
    // Replace wiki links with markdown links temporarily
    return content.replace(linkRegex, (_match, linkRef) => {
      const keyword = linkRef.trim();
      const matchingFileIds = findFilesByKeyword(keyword);

      // Use markdown link syntax with custom class identifier
      const className = matchingFileIds.length > 0 ? 'wiki-exists' : 'wiki-missing';
      const count = matchingFileIds.length > 1 ? `[${matchingFileIds.length}]` : '';
      return `[${linkRef}${count}](wiki:${className}:${linkRef})`;
    });
  }, [content, files, keywordIndex]);

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('wiki-link')) {
      const linkRef = target.getAttribute('data-link');
      if (!linkRef) return;

      const keyword = linkRef.trim();
      const matchingFileIds = findFilesByKeyword(keyword);

      if (matchingFileIds.length === 0) {
        // No matching file - create new file
        const parsed = parseLinkReference(keyword);
        const fileName = parsed.name;
        const filePath = parsed.fullPath || (currentFile ? `${getParentPath(currentFile.path)}/${fileName}` : `/${fileName}`);

        if (confirm(t('preview.noteDoesntExist', { noteName: fileName }))) {
          const newFile = createNewFile(fileName, filePath, `# ${fileName}\n\n`);
          setCurrentFile(newFile.id);
        }
      } else if (matchingFileIds.length === 1) {
        // Single match - navigate to it
        setCurrentFile(matchingFileIds[0]);
      } else {
        // Multiple matches - show a menu (for now, just navigate to the first)
        // TODO: Show a dropdown or modal to select which file to open
        console.log(`Multiple files match keyword "${keyword}":`, matchingFileIds);
        setCurrentFile(matchingFileIds[0]);
      }
    }
  };

  return (
    <div className="preview" onClick={handleClick}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, href, children, ...props }) => {
            // Check if this is a wiki link
            if (href?.startsWith('wiki:')) {
              const parts = href.split(':');
              const className = parts[1]; // 'wiki-exists' or 'wiki-missing'
              const linkRef = parts.slice(2).join(':'); // Original link text

              return (
                <span
                  className={`wiki-link wiki-link-${className === 'wiki-exists' ? 'exists' : 'missing'}`}
                  data-link={linkRef}
                  {...props}
                >
                  {children}
                </span>
              );
            }
            // Regular markdown link
            return <a href={href} {...props}>{children}</a>;
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
