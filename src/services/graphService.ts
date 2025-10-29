// Graph data generation service
import { File, GraphData, GraphNode, GraphLink } from '../models/types';

/**
 * Build graph data from files and their links
 */
export function buildGraphData(files: Map<string, File>): GraphData {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const fileNameToId = new Map<string, string>();

  // Create nodes for all files
  files.forEach((file) => {
    nodes.push({
      id: file.id,
      name: file.name,
    });
    fileNameToId.set(file.name, file.id);
  });

  // Create links based on wiki-style references
  files.forEach((file) => {
    file.links.forEach((linkedFileName) => {
      const targetId = fileNameToId.get(linkedFileName);
      if (targetId) {
        links.push({
          source: file.id,
          target: targetId,
        });
      }
    });
  });

  return { nodes, links };
}

/**
 * Get connected nodes within N degrees of separation
 */
export function getConnectedSubgraph(
  graphData: GraphData,
  nodeId: string,
  degrees: number = 2
): GraphData {
  const connectedNodeIds = new Set<string>([nodeId]);
  const relevantLinks: GraphLink[] = [];

  // BFS to find connected nodes
  let currentLevel = new Set([nodeId]);
  for (let i = 0; i < degrees; i++) {
    const nextLevel = new Set<string>();

    graphData.links.forEach((link) => {
      if (currentLevel.has(link.source as string)) {
        connectedNodeIds.add(link.target as string);
        nextLevel.add(link.target as string);
        relevantLinks.push(link);
      }
      if (currentLevel.has(link.target as string)) {
        connectedNodeIds.add(link.source as string);
        nextLevel.add(link.source as string);
        relevantLinks.push(link);
      }
    });

    currentLevel = nextLevel;
  }

  const nodes = graphData.nodes.filter((node) =>
    connectedNodeIds.has(node.id)
  );

  return { nodes, links: relevantLinks };
}
