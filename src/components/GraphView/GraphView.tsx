// Graph Visualization component - Shows document relationships
import React, { useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { buildGraphData } from '../../services/graphService';
import './GraphView.css';

export function GraphView() {
  const { files, currentFileId, showGraphView, toggleGraphView } = useApp();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [graphData, setGraphData] = React.useState<ReturnType<typeof buildGraphData>>({ nodes: [], links: [] });

  useEffect(() => {
    const data = buildGraphData(files);
    setGraphData(data);
  }, [files]);

  useEffect(() => {
    if (!canvasRef.current || !showGraphView) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Simple force-directed layout simulation
    // This is a basic implementation - can be enhanced with a proper graph library
    const nodes = graphData.nodes.map(node => ({
      ...node,
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: 0,
      vy: 0,
    }));

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw links
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1;
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
        ctx.arc(node.x, node.y, isCurrentFile ? 8 : 6, 0, 2 * Math.PI);
        ctx.fillStyle = isCurrentFile ? '#007acc' : '#4fc3f7';
        ctx.fill();
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = isCurrentFile ? 2 : 1;
        ctx.stroke();

        // Draw label
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '12px sans-serif';
        ctx.fillText(node.name, node.x + 10, node.y + 4);
      });
    };

    animate();
  }, [graphData, currentFileId, showGraphView]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicked on a node (simple distance check)
    // This would need proper node position tracking in production
    console.log('Canvas clicked at:', x, y);
  };

  if (!showGraphView) {
    return null;
  }

  return (
    <div className="graph-view">
      <div className="graph-header">
        <h2>Graph View</h2>
        <button onClick={toggleGraphView} className="btn-close">
          ×
        </button>
      </div>
      <div className="graph-canvas-container">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="graph-canvas"
        />
        {graphData.nodes.length === 0 && (
          <div className="graph-empty">
            <p>No connections yet</p>
            <p>Create links between notes using [[Note Name]]</p>
          </div>
        )}
      </div>
      <div className="graph-controls">
        <p className="graph-stats">
          {graphData.nodes.length} notes • {graphData.links.length} connections
        </p>
      </div>
    </div>
  );
}
