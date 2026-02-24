import dagre from 'dagre';
import { ElkNode, ElkEdge } from '@mindfiredigital/adac-layout-elk';

export async function layoutDagre(root: ElkNode): Promise<ElkNode> {
  const g = new dagre.graphlib.Graph({ compound: true });

  g.setGraph({
    rankdir: 'LR',
    align: 'DL', // UL, UR, DL, DR
    nodesep: 60,
    ranksep: 80,
    edgesep: 20,
    marginx: 40,
    marginy: 40,
  });

  g.setDefaultEdgeLabel(() => ({}));

  // Map to find nodes easily by ID to update them later
  const nodeMap = new Map<string, ElkNode>();
  const parentMap = new Map<string, string>();

  function traverse(node: ElkNode, parentId?: string) {
    const isRoot = node.id === root.id;

    // Skip root node in Dagre to avoid a top-level bounding box
    if (!isRoot) {
      nodeMap.set(node.id, node);

      const isContainer = node.children && node.children.length > 0;
      if (!node.id) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nodeConfig: any = {
        label: node.id,
      };

      if (!isContainer) {
        nodeConfig.width = node.width || 80;
        nodeConfig.height = node.height || 60;
      }

      g.setNode(node.id, nodeConfig);

      if (parentId && parentId !== root.id) {
        g.setParent(node.id, parentId);
        parentMap.set(node.id, parentId);
      }
    }

    if (node.children) {
      node.children.forEach((child) => traverse(child, node.id));
    }
  }

  // 1. Add Nodes
  traverse(root);

  // 2. Add Edges
  const allEdges: { edge: ElkEdge; containerId?: string }[] = [];

  function collectEdges(node: ElkNode) {
    if (node.edges) {
      node.edges.forEach((e) =>
        allEdges.push({ edge: e, containerId: node.id })
      );
    }
    if (node.children) {
      node.children.forEach((c) => collectEdges(c));
    }
  }

  collectEdges(root);

  // Helper: create or retrieve an anchor node for a container to prevent Dagre crashes
  // We place a 0-size "anchor" node inside the container and route edges to it.
  const anchorMap = new Map<string, string>();

  function getAnchor(nodeId: string): string {
    const node = nodeMap.get(nodeId);
    if (node && node.children && node.children.length > 0) {
      if (anchorMap.has(nodeId)) {
        return anchorMap.get(nodeId)!;
      }

      const anchorId = `${nodeId}__anchor`;
      g.setNode(anchorId, {
        label: '',
        width: 0,
        height: 0,
        dummy: true,
      });
      g.setParent(anchorId, nodeId);

      anchorMap.set(nodeId, anchorId);
      return anchorId;
    }
    return nodeId;
  }

  // Helper: check ancestor relationship
  function isAncestor(ancestor: string, node: string): boolean {
    let curr = parentMap.get(node);
    while (curr) {
      if (curr === ancestor) return true;
      curr = parentMap.get(curr);
    }
    return false;
  }

  allEdges.forEach(({ edge }) => {
    // Dagre only supports 1 source -> 1 target
    if (
      edge.sources &&
      edge.sources.length > 0 &&
      edge.targets &&
      edge.targets.length > 0
    ) {
      const uOrig = edge.sources[0];
      const vOrig = edge.targets[0];

      const u = getAnchor(uOrig);
      const v = getAnchor(vOrig);

      if (g.hasNode(u) && g.hasNode(v)) {
        if (u === v) return;
        if (isAncestor(u, v) || isAncestor(v, u)) return;

        try {
          g.setEdge(u, v, {
            id: edge.id,
          });
        } catch (e) {
          console.warn(`Dagre failed to set edge ${u} -> ${v}`, e);
        }
      }
    }
  });

  // 3. Run Layout
  try {
    dagre.layout(g);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('Dagre layout algorithm crashed:', msg);
    throw new Error('Dagre layout failed: ' + msg);
  }

  // 4. Update Node Positions
  const absPos = new Map<string, { x: number; y: number }>();

  g.nodes().forEach((v) => {
    const nodeFn = g.node(v);
    if (nodeFn) {
      absPos.set(v, {
        x: nodeFn.x - nodeFn.width / 2,
        y: nodeFn.y - nodeFn.height / 2,
      });
      // Update dimensions in elkNode as Dagre might have resized containers
      const elkNode = nodeMap.get(v);
      if (elkNode) {
        elkNode.width = nodeFn.width;
        elkNode.height = nodeFn.height;
      }
    }
  });

  g.nodes().forEach((v) => {
    const elkNode = nodeMap.get(v);
    if (elkNode && absPos.has(v)) {
      const myAbs = absPos.get(v)!;
      const parentId = parentMap.get(v);

      if (parentId && absPos.has(parentId)) {
        const parentAbs = absPos.get(parentId)!;
        elkNode.x = myAbs.x - parentAbs.x;
        elkNode.y = myAbs.y - parentAbs.y;
      } else {
        elkNode.x = myAbs.x;
        elkNode.y = myAbs.y;
      }
    }
  });

  // 5. Update Edge Paths
  allEdges.forEach(({ edge, containerId }) => {
    const u = edge.sources[0];
    const v = edge.targets[0];

    // Use original IDs to look up the Dagre edge (which might be between anchors)
    const uAnchor = getAnchor(u);
    const vAnchor = getAnchor(v);

    if (g.hasNode(uAnchor) && g.hasNode(vAnchor)) {
      const dagreEdge = g.edge(uAnchor, vAnchor);
      if (dagreEdge && dagreEdge.points) {
        let offsetX = 0;
        let offsetY = 0;

        const cId = containerId || root.id;
        if (cId && absPos.has(cId)) {
          const cAbs = absPos.get(cId)!;
          offsetX = cAbs.x;
          offsetY = cAbs.y;
        }

        const points = dagreEdge.points.map((p) => ({
          x: p.x - offsetX,
          y: p.y - offsetY,
        }));

        // Edge Clipping to Node Borders
        const getNodeBox = (
          id: string,
          relativeToX: number,
          relativeToY: number
        ) => {
          let realId = id;
          if (id.endsWith('__anchor')) {
            realId = id.replace('__anchor', '');
          }

          if (absPos.has(realId)) {
            const abs = absPos.get(realId)!;
            const n = nodeMap.get(realId);
            if (n) {
              return {
                x: abs.x - relativeToX,
                y: abs.y - relativeToY,
                width: n.width || 0,
                height: n.height || 0,
              };
            }
          }
          return null;
        };

        // Simplified Ray-Box intersection
        const intersectRect = (
          p1: { x: number; y: number },
          p2: { x: number; y: number },
          rect: { x: number; y: number; width: number; height: number }
        ) => {
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          if (dx === 0 && dy === 0) return p2;

          const minX = rect.x;
          const maxX = rect.x + rect.width;
          const minY = rect.y;
          const maxY = rect.y + rect.height;

          let bestT = Infinity;

          const check = (t: number) => {
            if (t >= 0 && t <= 1) {
              const ix = p1.x + t * dx;
              const iy = p1.y + t * dy;
              const epsilon = 0.1;
              if (
                ix >= minX - epsilon &&
                ix <= maxX + epsilon &&
                iy >= minY - epsilon &&
                iy <= maxY + epsilon
              ) {
                if (t < bestT) bestT = t;
              }
            }
          };

          if (dx !== 0) {
            check((minX - p1.x) / dx);
            check((maxX - p1.x) / dx);
          }
          if (dy !== 0) {
            check((minY - p1.y) / dy);
            check((maxY - p1.y) / dy);
          }

          if (bestT !== Infinity && bestT < 1) {
            return {
              x: p1.x + bestT * dx,
              y: p1.y + bestT * dy,
            };
          }

          return p2;
        };

        // Clip Start
        if (points.length > 1) {
          const box = getNodeBox(uAnchor, offsetX, offsetY);
          if (box) {
            // Trace backwards from P2 to P1 to find exit point
            points[0] = intersectRect(points[1], points[0], box);
          }
        }

        // Clip End
        if (points.length > 1) {
          const box = getNodeBox(vAnchor, offsetX, offsetY);
          if (box) {
            // Trace from P_prev to P_end
            points[points.length - 1] = intersectRect(
              points[points.length - 2],
              points[points.length - 1],
              box
            );
          }
        }

        edge.sections = [
          {
            startPoint: points[0],
            endPoint: points[points.length - 1],
            bendPoints: points.slice(1, points.length - 1),
          },
        ];
      }
    }
  });

  return root;
}
