// Markdown Preview component
import React from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useApp } from '../../context/AppContext';
import { parseLinkReference } from '../../utils/linkParser';
import { getParentPath } from '../../services/fileService';

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
    <div className="flex-1 overflow-y-auto p-6 bg-card text-foreground leading-relaxed max-w-3xl mx-auto" onClick={handleClick}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({children}) => <h1 className="text-3xl font-bold mb-4 text-foreground">{children}</h1>,
          h2: ({children}) => <h2 className="text-2xl font-semibold mb-3 mt-6 text-foreground">{children}</h2>,
          h3: ({children}) => <h3 className="text-xl font-semibold mb-3 mt-5 text-foreground">{children}</h3>,
          p: ({children}) => <p className="mb-4 text-foreground">{children}</p>,
          code: ({children}) => <code className="px-1.5 py-0.5 bg-secondary text-foreground rounded font-mono text-sm">{children}</code>,
          pre: ({children}) => <pre className="p-4 bg-secondary border border-border rounded overflow-x-auto mb-4 font-mono text-sm">{children}</pre>,
          blockquote: ({children}) => <blockquote className="pl-4 border-l-4 border-border text-muted-foreground italic my-4">{children}</blockquote>,
          table: ({children}) => <table className="w-full border-collapse mb-4">{children}</table>,
          th: ({children}) => <th className="bg-secondary text-foreground font-semibold p-2 border border-border">{children}</th>,
          td: ({children}) => <td className="p-2 border border-border text-foreground">{children}</td>,
          ul: ({children}) => <ul className="mb-4 ml-6 list-disc">{children}</ul>,
          ol: ({children}) => <ol className="mb-4 ml-6 list-decimal">{children}</ol>,
          li: ({children}) => <li className="mb-2">{children}</li>,
          a: ({ node, href, children, ...props }) => {
            // Check if this is a wiki link
            if (href?.startsWith('wiki:')) {
              const parts = href.split(':');
              const linkType = parts[1]; // 'wiki-exists' or 'wiki-missing'
              const linkRef = parts.slice(2).join(':'); // Original link text

              return (
                <span
                  className={`wiki-link font-medium cursor-pointer no-underline ${linkType === 'wiki-exists' ? 'text-blue-400 bg-blue-400/10 px-1 rounded hover:bg-blue-400/20' : 'text-warning bg-warning/10 px-1 rounded hover:bg-warning/20'}`}
                  data-link={linkRef}
                  {...props}
                >
                  {children}
                </span>
              );
            }
            // Regular markdown link
            return <a href={href} className="text-blue-400 no-underline hover:underline" {...props}>{children}</a>;
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
