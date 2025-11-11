// Breadcrumb navigation component
import { useTranslation } from 'react-i18next';

interface BreadcrumbProps {
  path: string;
  onNavigate?: (path: string) => void;
}

export function Breadcrumb({ path, onNavigate }: BreadcrumbProps) {
  const { t } = useTranslation();

  // Build breadcrumb path segments
  const buildSegments = (fullPath: string): { name: string; path: string }[] => {
    if (!fullPath || fullPath === '/') {
      return [{ name: t('breadcrumb.root'), path: '/' }];
    }

    const segments: { name: string; path: string }[] = [{ name: t('breadcrumb.root'), path: '/' }];
    const parts = fullPath.split('/').filter((p) => p);

    let currentPath = '';
    for (const part of parts) {
      currentPath += `/${part}`;
      segments.push({ name: part, path: currentPath });
    }

    return segments;
  };

  const segments = buildSegments(path);

  return (
    <div className="flex items-center px-4 py-2 bg-card border-b border-border text-sm overflow-x-auto whitespace-nowrap">
      {segments.map((segment, index) => (
        <span key={segment.path} className="inline-flex items-center">
          {index > 0 && <span className="mx-2 text-muted-foreground/50">/</span>}
          <span
            className={`px-1 rounded transition-colors ${index === segments.length - 1 ? 'text-foreground font-medium' : 'text-primary hover:bg-secondary cursor-pointer'}`}
            onClick={() => onNavigate && index < segments.length - 1 && onNavigate(segment.path)}
          >
            {segment.name}
          </span>
        </span>
      ))}
    </div>
  );
}
