// Markdown Preview component
import React from 'react';
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
  const { files, setCurrentFile, createNewFile, getCurrentFile } = useApp();
  const currentFile = getCurrentFile();

  // Helper to find file by name or path
  const findFile = (nameOrPath: string) => {
    // First try to find by exact path
    const byPath = Array.from(files.values()).find(
      (f) => f.path === nameOrPath || f.path === `/${nameOrPath}`
    );
    if (byPath) return byPath;

    // Then try to find by name
    return Array.from(files.values()).find(
      (f) => f.name === nameOrPath
    );
  };

  // Parse wiki links and replace with placeholders for custom rendering
  const processedContent = React.useMemo(() => {
    const linkRegex = /\[\[([^\]]+)\]\]/g;
    // Replace wiki links with markdown links temporarily
    return content.replace(linkRegex, (_match, linkRef) => {
      const parsed = parseLinkReference(linkRef.trim());
      const linkedFile = parsed.isPath && parsed.fullPath
        ? findFile(parsed.fullPath) || findFile(parsed.name)
        : findFile(parsed.name);

      // Use markdown link syntax with custom class identifier
      const className = linkedFile ? 'wiki-exists' : 'wiki-missing';
      return `[${linkRef}](wiki:${className}:${linkRef})`;
    });
  }, [content, files]);

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('wiki-link')) {
      const linkRef = target.getAttribute('data-link');
      if (!linkRef) return;

      const parsed = parseLinkReference(linkRef);

      // Try to find existing file
      const linkedFile = parsed.isPath && parsed.fullPath
        ? findFile(parsed.fullPath) || findFile(parsed.name)
        : findFile(parsed.name);

      if (linkedFile) {
        // Navigate to existing file
        setCurrentFile(linkedFile.id);
      } else {
        // Create new file
        const fileName = parsed.name;
        const filePath = parsed.fullPath || (currentFile ? `${getParentPath(currentFile.path)}/${fileName}` : `/${fileName}`);

        if (confirm(`Note "${fileName}" doesn't exist. Create it?`)) {
          const newFile = createNewFile(fileName, filePath, `# ${fileName}\n\n`);
          setCurrentFile(newFile.id);
        }
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
