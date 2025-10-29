// Graph Visualization component - Shows document relationships with zoom and pan
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../context/AppContext';
import { buildGraphData } from '../../services/graphService';
import './GraphView.css';

interface GraphNode {
  id: string;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export function GraphView() {
  const { t } = useTranslation();
  const { files, currentFileId, showGraphView, toggleGraphView, keywordIndex, setCurrentFile } = useApp();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [graphData, setGraphData] = React.useState<ReturnType<typeof buildGraphData>>({ nodes: [], links: [] });

  // Pan and zoom state
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [nodes, setNodes] = useState<GraphNode[]>([]);

  useEffect(() => {
    console.log('[GraphView] Building graph data', {
      fileCount: files.size,
      hasKeywordIndex: !!keywordIndex,
      keywordCount: keywordIndex?.keywordToFiles.size || 0,
    });
    const data = buildGraphData(files, keywordIndex || undefined);
    console.log('[GraphView] Graph data built:', {
      nodeCount: data.nodes.length,
      linkCount: data.links.length,
      links: data.links,
    });
    setGraphData(data);
  }, [files, keywordIndex]);

  // Initialize node positions when graph data changes
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) / 3;

    const initialNodes = graphData.nodes.map((node, index) => {
      const angle = (index / graphData.nodes.length) * 2 * Math.PI;
      return {
        ...node,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        vx: 0,
        vy: 0,
      };
    });

    setNodes(initialNodes);
  }, [graphData.nodes]);

  // Handle wheel for zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate zoom factor
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(5, transform.scale * zoomFactor));

    // Zoom towards mouse position
    const scaleDiff = newScale - transform.scale;
    const newX = transform.x - (mouseX - transform.x) * (scaleDiff / transform.scale);
    const newY = transform.y - (mouseY - transform.y) * (scaleDiff / transform.scale);

    setTransform({
      x: newX,
      y: newY,
      scale: newScale,
    });
  };

  // Handle mouse down for panning (middle button)
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Middle mouse button (button 1)
    if (e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    }
  };

  // Handle mouse move for panning
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      e.preventDefault();
      setTransform({
        ...transform,
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  // Handle mouse up
  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Prevent context menu on middle click
  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      e.preventDefault();
    }
  };

  // Reset zoom and pan
  const handleReset = () => {
    setTransform({ x: 0, y: 0, scale: 1 });
  };

  useEffect(() => {
    if (!canvasRef.current || !showGraphView) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Save context and apply transform
      ctx.save();
      ctx.translate(transform.x, transform.y);
      ctx.scale(transform.scale, transform.scale);

      // Draw links
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1 / transform.scale;
      graphData.links.forEach(link => {
        const source = nodes.find(n => n.id === link.source);
        const target = nodes.find(n => n.id === link.target);
        if (source && target) {
          ctx.beginPath();
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(target.x, target.y);
          ctx.stroke();
        }
      });

      // Draw nodes
      nodes.forEach(node => {
        const isCurrentFile = node.id === currentFileId;
        ctx.beginPath();
        const radius = (isCurrentFile ? 8 : 6) / transform.scale;
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = isCurrentFile ? '#007acc' : '#4fc3f7';
        ctx.fill();
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = (isCurrentFile ? 2 : 1) / transform.scale;
        ctx.stroke();

        // Draw label
        ctx.fillStyle = '#e0e0e0';
        ctx.font = `${12 / transform.scale}px sans-serif`;
        ctx.fillText(node.name, node.x + 10 / transform.scale, node.y + 4 / transform.scale);
      });

      ctx.restore();
    };

    animate();
  }, [graphData, currentFileId, showGraphView, nodes, transform]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Don't navigate if we're panning
    if (isPanning) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - transform.x) / transform.scale;
    const mouseY = (e.clientY - rect.top - transform.y) / transform.scale;

    // Check if clicked on a node
    for (const node of nodes) {
      const distance = Math.sqrt(Math.pow(mouseX - node.x, 2) + Math.pow(mouseY - node.y, 2));
      const nodeRadius = (node.id === currentFileId ? 8 : 6) / transform.scale;

      if (distance < nodeRadius * 2) { // Give a larger hit area for easier clicking
        // Navigate to the clicked file
        setCurrentFile(node.id);
        return;
      }
    }
  };

  if (!showGraphView) {
    return null;
  }

  return (
    <div className="graph-view">
      <div className="graph-header">
        <h2>{t('graphView.title')}</h2>
        <button onClick={toggleGraphView} className="btn-close">
          ×
        </button>
      </div>
      <div className="graph-canvas-container">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onContextMenu={handleContextMenu}
          className="graph-canvas"
          style={{ cursor: isPanning ? 'grabbing' : 'default' }}
        />
        {graphData.nodes.length === 0 && (
          <div className="graph-empty">
            <p>{t('graphView.noConnections')}</p>
            <p>{t('graphView.createLinksPrompt')}</p>
          </div>
        )}
      </div>
      <div className="graph-controls">
        <p className="graph-stats">
          {t('graphView.stats', { noteCount: graphData.nodes.length, linkCount: graphData.links.length })}
        </p>
        <div className="graph-zoom-controls">
          <button onClick={handleReset} className="btn-reset" title={t('graphView.reset')}>
            {t('graphView.reset')}
          </button>
          <span className="zoom-level">{Math.round(transform.scale * 100)}%</span>
        </div>
        <p className="graph-help">
          {t('graphView.zoomHelp')}
        </p>
      </div>
    </div>
  );
}
