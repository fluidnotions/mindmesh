// Markdown Preview component
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useApp } from '../../context/AppContext';
import './Preview.css';

interface PreviewProps {
  content: string;
}

export function Preview({ content }: PreviewProps) {
  const { files, setCurrentFile, createNewFile } = useApp();

  // Custom renderer for wiki-style links
  const processedContent = React.useMemo(() => {
    const linkRegex = /\[\[([^\]]+)\]\]/g;
    return content.replace(linkRegex, (_match, linkName) => {
      const linkedFile = Array.from(files.values()).find(
        (f) => f.name === linkName.trim()
      );

      if (linkedFile) {
        return `<span class="wiki-link wiki-link-exists" data-link="${linkName.trim()}">${linkName}</span>`;
      } else {
        return `<span class="wiki-link wiki-link-missing" data-link="${linkName.trim()}">${linkName}</span>`;
      }
    });
  }, [content, files]);

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('wiki-link')) {
      const linkName = target.getAttribute('data-link');
      if (!linkName) return;

      // Find existing file
      const linkedFile = Array.from(files.values()).find(
        (f) => f.name === linkName
      );

      if (linkedFile) {
        // Navigate to existing file
        setCurrentFile(linkedFile.id);
      } else {
        // Create new file
        if (confirm(`Note "${linkName}" doesn't exist. Create it?`)) {
          const newFile = createNewFile(linkName, `/${linkName}`, `# ${linkName}\n\n`);
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
