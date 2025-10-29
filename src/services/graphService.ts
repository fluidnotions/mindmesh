// Graph data generation service
import { File, GraphData, GraphNode, GraphLink } from '../models/types';
import { KeywordIndex, findFilesWithKeyword } from './linkIndexService';

/**
 * Build graph data from files and their links using keyword matching
 */
export function buildGraphData(
  files: Map<string, File>,
  keywordIndex?: KeywordIndex
): GraphData {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const linkSet = new Set<string>(); // Prevent duplicate links

  // Create nodes for all files
  files.forEach((file) => {
    nodes.push({
      id: file.id,
      name: file.name,
    });
  });

  // If no keyword index provided, fall back to filename matching
  if (!keywordIndex) {
    const fileNameToId = new Map<string, string>();
    files.forEach((file) => {
      fileNameToId.set(file.name, file.id);
    });

    files.forEach((file) => {
      file.links.forEach((linkedFileName) => {
        const targetId = fileNameToId.get(linkedFileName);
        if (targetId && file.id !== targetId) {
          const linkKey = `${file.id}->${targetId}`;
          if (!linkSet.has(linkKey)) {
            links.push({
              source: file.id,
              target: targetId,
            });
            linkSet.add(linkKey);
          }
        }
      });
    });

    return { nodes, links };
  }

  // Create links based on keyword matching
  files.forEach((file) => {
    file.links.forEach((keyword) => {
      // Find all files that contain this keyword
      const matchingFileIds = findFilesWithKeyword(keyword, keywordIndex);

      matchingFileIds.forEach((targetId) => {
        // Don't link to self
        if (file.id !== targetId) {
          const linkKey = `${file.id}->${targetId}`;
          if (!linkSet.has(linkKey)) {
            links.push({
              source: file.id,
              target: targetId,
            });
            linkSet.add(linkKey);
          }
        }
      });
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
