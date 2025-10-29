// Breadcrumb navigation component
import './Breadcrumb.css';

interface BreadcrumbProps {
  path: string;
  onNavigate?: (path: string) => void;
}

export function Breadcrumb({ path, onNavigate }: BreadcrumbProps) {
  // Build breadcrumb path segments
  const buildSegments = (fullPath: string): { name: string; path: string }[] => {
    if (!fullPath || fullPath === '/') {
      return [{ name: 'Root', path: '/' }];
    }

    const segments: { name: string; path: string }[] = [{ name: 'Root', path: '/' }];
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
    <div className="breadcrumb">
      {segments.map((segment, index) => (
        <span key={segment.path} className="breadcrumb-segment">
          {index > 0 && <span className="breadcrumb-separator">/</span>}
          <span
            className={`breadcrumb-item ${index === segments.length - 1 ? 'active' : ''}`}
            onClick={() => onNavigate && index < segments.length - 1 && onNavigate(segment.path)}
          >
            {segment.name}
          </span>
        </span>
      ))}
    </div>
  );
}
