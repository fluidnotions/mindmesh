// Graph Visualization component - Shows document relationships in 3D
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../context/AppContext';
import { buildGraphData } from '../../services/graphService';
import { initializeNodes, simulateForces, Node3D } from '../../services/force3DLayoutService';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export function GraphView() {
  const { t } = useTranslation();
  // Note: setCurrentFile will be used in Phase 6 for node click navigation
  const { files, currentFileId, showGraphView, toggleGraphView, keywordIndex } = useApp();
  const [graphData, setGraphData] = React.useState<ReturnType<typeof buildGraphData>>({ nodes: [], links: [] });
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [nodes3D, setNodes3D] = useState<Node3D[]>([]);

  // Three.js refs
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const nodeMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const edgeMeshesRef = useRef<THREE.Mesh[]>([]);

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

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current || !showGraphView) return;

    const container = containerRef.current;
    const width = container.offsetWidth;
    const height = container.offsetHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1e1e1e); // Match existing background
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 0, 50);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting (enhanced for better node visibility)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight1.position.set(10, 10, 10);
    scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
    directionalLight2.position.set(-10, -10, -5);
    scene.add(directionalLight2);

    // Add OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // Smooth inertia
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false; // Keep panning in world space
    controls.minDistance = 10; // Minimum zoom
    controls.maxDistance = 200; // Maximum zoom
    controls.maxPolarAngle = Math.PI; // Allow full rotation
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    controlsRef.current = controls;

    // Render loop with physics simulation
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);

      // Simulate physics for natural 3D spreading
      if (nodes3D.length > 0) {
        simulateForces(nodes3D, graphData.links);

        // Update mesh positions from physics
        nodes3D.forEach(node => {
          const mesh = nodeMeshesRef.current.get(node.id);
          if (mesh) {
            mesh.position.copy(node.position);
          }
        });

        // Update edge geometries to follow nodes
        edgeMeshesRef.current.forEach(edgeMesh => {
          const { source, target } = edgeMesh.userData;
          const sourceMesh = nodeMeshesRef.current.get(source);
          const targetMesh = nodeMeshesRef.current.get(target);

          if (sourceMesh && targetMesh) {
            const curve = new THREE.LineCurve3(
              sourceMesh.position.clone(),
              targetMesh.position.clone()
            );
            edgeMesh.geometry.dispose();
            edgeMesh.geometry = new THREE.TubeGeometry(curve, 20, 0.1, 8, false);
          }
        });
      }

      controls.update(); // Required for damping
      renderer.render(scene, camera);
    };
    animate();

    // Handle window resize
    const handleResize = () => {
      const width = container.offsetWidth;
      const height = container.offsetHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      controls.dispose();
      container.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [showGraphView, nodes3D, graphData.links]);

  // Initialize 3D nodes with force-directed layout when graph data changes
  useEffect(() => {
    const initialNodes = initializeNodes(graphData, currentFileId);
    setNodes3D(initialNodes);
  }, [graphData, currentFileId]);

  // Handle fullscreen resize
  useEffect(() => {
    if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;

    const container = containerRef.current;
    const camera = cameraRef.current;
    const renderer = rendererRef.current;

    // Small delay to let CSS transitions complete
    setTimeout(() => {
      const width = container.offsetWidth;
      const height = container.offsetHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }, 100);
  }, [isFullscreen]);

  // Add effect to create/update nodes from nodes3D positions
  useEffect(() => {
    if (!sceneRef.current || !showGraphView || nodes3D.length === 0) return;

    const scene = sceneRef.current;

    // Clear existing nodes
    nodeMeshesRef.current.forEach(mesh => {
      scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    });
    nodeMeshesRef.current.clear();

    // Create sphere geometry (shared for all nodes)
    const nodeGeometry = new THREE.SphereGeometry(1, 32, 32);

    // Create nodes from 3D positions
    nodes3D.forEach(node => {
      // Determine if this is the current node
      const isCurrentNode = node.id === currentFileId;

      // Create material with different color for current node
      const material = new THREE.MeshStandardMaterial({
        color: isCurrentNode ? 0x007acc : 0x4fc3f7,
        emissive: isCurrentNode ? 0x003366 : 0x002233,
        metalness: 0.3,
        roughness: 0.7,
      });

      // Create mesh
      const sphere = new THREE.Mesh(nodeGeometry, material);
      sphere.position.copy(node.position);

      // Scale current node larger
      const scale = isCurrentNode ? 1.5 : 1.0;
      sphere.scale.setScalar(scale);

      // Store reference with node id as userData
      sphere.userData = { nodeId: node.id, nodeName: node.name };

      scene.add(sphere);
      nodeMeshesRef.current.set(node.id, sphere);
    });

    // Cleanup geometry on unmount
    return () => {
      nodeGeometry.dispose();
    };
  }, [nodes3D, currentFileId, showGraphView]);

  // Add effect to create/update edges when graphData or nodes change (Phase 4)
  useEffect(() => {
    if (!sceneRef.current || !showGraphView || graphData.nodes.length === 0) return;

    const scene = sceneRef.current;

    // Clear existing edges
    edgeMeshesRef.current.forEach(mesh => {
      scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    });
    edgeMeshesRef.current = [];

    // Create edges
    graphData.links.forEach(link => {
      const sourceMesh = nodeMeshesRef.current.get(link.source);
      const targetMesh = nodeMeshesRef.current.get(link.target);

      if (!sourceMesh || !targetMesh) return;

      // Calculate edge path
      const sourcePos = sourceMesh.position;
      const targetPos = targetMesh.position;

      // Create a curve between source and target
      const curve = new THREE.LineCurve3(
        sourcePos.clone(),
        targetPos.clone()
      );

      // Create tube geometry along the curve
      const tubeGeometry = new THREE.TubeGeometry(
        curve,
        20, // tubular segments
        0.1, // radius
        8, // radial segments
        false // closed
      );

      // Create material for edge
      const edgeMaterial = new THREE.MeshStandardMaterial({
        color: 0x444444,
        emissive: 0x222222,
        metalness: 0.2,
        roughness: 0.8,
      });

      // Create mesh
      const tube = new THREE.Mesh(tubeGeometry, edgeMaterial);
      tube.userData = {
        source: link.source,
        target: link.target
      };

      scene.add(tube);
      edgeMeshesRef.current.push(tube);
    });
  }, [graphData, showGraphView]);

  if (!showGraphView) {
    return null;
  }

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-background' : 'relative w-full h-full bg-background'}`}>
      <div className="p-4 border-b border-border bg-card flex justify-between items-center">
        <h2 className="text-foreground font-semibold">{t('graphView.title')}</h2>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="bg-none border-none text-muted-foreground cursor-pointer text-xl p-0 w-6 h-6 flex items-center justify-center rounded transition-all hover:text-foreground hover:scale-110"
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? '⤓' : '⤢'}
          </button>
          <button onClick={toggleGraphView} className="bg-none border-none text-muted-foreground cursor-pointer text-2xl p-0 w-6 h-6 flex items-center justify-center rounded transition-all hover:text-foreground hover:scale-110">
            ×
          </button>
        </div>
      </div>
      <div className="relative w-full h-full overflow-hidden">
        <div
          ref={containerRef}
          className="w-full h-full"
        />
        {graphData.nodes.length === 0 && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center text-muted-foreground pointer-events-none">
            <p>{t('graphView.noConnections')}</p>
            <p>{t('graphView.createLinksPrompt')}</p>
          </div>
        )}
      </div>
      <div className="absolute bottom-4 left-4 flex flex-col gap-2 bg-card/90 backdrop-blur p-3 rounded-lg border border-border shadow-lg">
        <p className="text-xs text-muted-foreground space-y-1">
          {t('graphView.stats', { noteCount: graphData.nodes.length, linkCount: graphData.links.length })}
        </p>
        <p className="text-xs text-muted-foreground font-italic">
          {t('graphView.zoomHelp')}
        </p>
      </div>
    </div>
  );
}
