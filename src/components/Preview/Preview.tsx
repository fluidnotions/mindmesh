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

  // Custom renderer for wiki-style links
  const processedContent = React.useMemo(() => {
    const linkRegex = /\[\[([^\]]+)\]\]/g;
    return content.replace(linkRegex, (_match, linkRef) => {
      const parsed = parseLinkReference(linkRef.trim());
      const linkedFile = parsed.isPath && parsed.fullPath
        ? findFile(parsed.fullPath) || findFile(parsed.name)
        : findFile(parsed.name);

      if (linkedFile) {
        return `<span class="wiki-link wiki-link-exists" data-link="${linkRef.trim()}">${linkRef}</span>`;
      } else {
        return `<span class="wiki-link wiki-link-missing" data-link="${linkRef.trim()}">${linkRef}</span>`;
      }
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
          // Custom rendering can be added here if needed
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
