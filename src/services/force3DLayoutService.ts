import { GraphData } from '../models/types';
import * as THREE from 'three';

export interface Node3D {
  id: string;
  name: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  force: THREE.Vector3;
  depth: number; // Hierarchical depth from root node
}

/**
 * Calculate hierarchical depth for each node from a root node using BFS
 */
function calculateDepths(
  nodes: { id: string; name: string }[],
  links: { source: string; target: string }[],
  rootNodeId: string | null
): Map<string, number> {
  const depths = new Map<string, number>();

  if (!rootNodeId || !nodes.find(n => n.id === rootNodeId)) {
    // No root or invalid root - all nodes at depth 0
    nodes.forEach(node => depths.set(node.id, 0));
    return depths;
  }

  // Build adjacency list
  const adjacency = new Map<string, string[]>();
  nodes.forEach(node => adjacency.set(node.id, []));

  links.forEach(link => {
    adjacency.get(link.source)?.push(link.target);
    adjacency.get(link.target)?.push(link.source); // Undirected
  });

  // BFS to calculate depths
  const queue: Array<{ id: string; depth: number }> = [{ id: rootNodeId, depth: 0 }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;

    if (visited.has(id)) continue;
    visited.add(id);
    depths.set(id, depth);

    const neighbors = adjacency.get(id) || [];
    neighbors.forEach(neighborId => {
      if (!visited.has(neighborId)) {
        queue.push({ id: neighborId, depth: depth + 1 });
      }
    });
  }

  // Any unvisited nodes get max depth
  const maxDepth = Math.max(...Array.from(depths.values()), 0);
  nodes.forEach(node => {
    if (!depths.has(node.id)) {
      depths.set(node.id, maxDepth + 1);
    }
  });

  return depths;
}

/**
 * Initialize node positions with 3D distribution
 */
export function initializeNodes(
  graphData: GraphData,
  currentNodeId: string | null
): Node3D[] {
  const depths = calculateDepths(graphData.nodes, graphData.links, currentNodeId);
  const depthSpacing = 15; // Z-axis spacing between depth layers

  return graphData.nodes.map((node) => {
    const depth = depths.get(node.id) || 0;

    // Distribute nodes in 3D space with some randomness for natural look
    const nodesAtDepth = graphData.nodes.filter(n => depths.get(n.id) === depth);
    const indexAtDepth = nodesAtDepth.findIndex(n => n.id === node.id);
    const angleSpacing = (2 * Math.PI) / nodesAtDepth.length;
    const angle = indexAtDepth * angleSpacing;
    const radius = 20 + Math.random() * 10; // Add randomness to radius

    // Add some random vertical spread
    const randomY = (Math.random() - 0.5) * 20;

    return {
      id: node.id,
      name: node.name,
      position: new THREE.Vector3(
        radius * Math.cos(angle),
        radius * Math.sin(angle) + randomY,
        -depth * depthSpacing // Negative Z for depth into screen
      ),
      velocity: new THREE.Vector3(0, 0, 0),
      force: new THREE.Vector3(0, 0, 0),
      depth,
    };
  });
}

/**
 * Apply force-directed physics simulation step
 */
export function simulateForces(
  nodes: Node3D[],
  links: { source: string; target: string }[]
): void {
  const repulsionStrength = 100;
  const attractionStrength = 0.01;
  const dampingFactor = 0.8;
  const minDistance = 5;

  // Reset forces
  nodes.forEach(node => {
    node.force.set(0, 0, 0);
  });

  // Repulsion between all nodes (in all 3D directions)
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const nodeA = nodes[i];
      const nodeB = nodes[j];

      const delta = new THREE.Vector3().subVectors(nodeA.position, nodeB.position);
      const distance = Math.max(delta.length(), minDistance);
      const force = repulsionStrength / (distance * distance);

      const forceVector = delta.normalize().multiplyScalar(force);
      nodeA.force.add(forceVector);
      nodeB.force.sub(forceVector);
    }
  }

  // Attraction along edges
  links.forEach(link => {
    const source = nodes.find(n => n.id === link.source);
    const target = nodes.find(n => n.id === link.target);

    if (!source || !target) return;

    const delta = new THREE.Vector3().subVectors(target.position, source.position);
    const distance = delta.length();
    const force = attractionStrength * distance;

    const forceVector = delta.normalize().multiplyScalar(force);
    source.force.add(forceVector);
    target.force.sub(forceVector);
  });

  // Apply forces and update positions
  nodes.forEach(node => {
    // Update velocity
    node.velocity.add(node.force);
    node.velocity.multiplyScalar(dampingFactor);

    // Update position in all 3D directions
    node.position.add(node.velocity);
  });
}
