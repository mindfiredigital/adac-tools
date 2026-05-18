import ELK from 'elkjs/lib/elk.bundled.js';
import type {
  ElkNode,
  ElkExtendedEdge,
  ElkEdgeSection,
} from 'elkjs/lib/elk-api';

import { LayoutEngine, LayoutOptions, LayoutResult } from './types.js';

export class ElkLayoutEngine implements LayoutEngine {
  private elk: InstanceType<typeof ELK>;
  private nodes: Map<string, ElkNode> = new Map();
  private edges: ElkExtendedEdge[] = [];
  private options: LayoutOptions;

  constructor(options: LayoutOptions = {}) {
    this.elk = new ELK();
    this.options = options;
  }

  addNode(
    id: string,
    data: {
      width: number;
      height: number;
      parent?: string;
    }
  ) {
    const node: ElkNode = {
      id,
      width: data.width,
      height: data.height,
      children: [],
    };

    this.nodes.set(id, node);

    // Handle hierarchy
    if (data.parent && this.nodes.has(data.parent)) {
      const parent = this.nodes.get(data.parent)!;

      if (!parent.children) {
        parent.children = [];
      }

      parent.children.push(node);
    }
  }

  addEdge(
    from: string,
    to: string,
    data?: {
      label?: string;
    }
  ) {
    const edge: ElkExtendedEdge = {
      id: `${from}-${to}`,
      sources: [from],
      targets: [to],
      labels: data?.label
        ? [
            {
              text: data.label,
            },
          ]
        : undefined,
    };

    this.edges.push(edge);
  }

  async layout(): Promise<LayoutResult> {
    const nodeCount = this.nodes.size;
    const edgeCount = this.edges.length;
    const isDenseGraph = nodeCount > 40 || edgeCount > 80;
    const edgeRoutingMode = isDenseGraph ? 'SPLINES' : 'ORTHOGONAL';
    const spacing = isDenseGraph
      ? {
          nodeNodeBetweenLayers: '140',
          edgeNodeBetweenLayers: '80',
          edgeEdgeBetweenLayers: '60',
          componentComponent: '80',
          aspectRatio: '2.0',
        }
      : {
          nodeNodeBetweenLayers: '100',
          edgeNodeBetweenLayers: '40',
          edgeEdgeBetweenLayers: '20',
          componentComponent: '48',
          aspectRatio: '1.8',
        };

    const graph: ElkNode = {
      id: 'root',
      children: Array.from(this.nodes.values()),
      edges: this.edges,

      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': this.options.rankdir === 'LR' ? 'RIGHT' : 'DOWN',

        'elk.hierarchyHandling': 'INCLUDE_CHILDREN',

        'elk.edgeRouting': edgeRoutingMode,
        'elk.layered.spacing.nodeNodeBetweenLayers': String(
          this.options.ranksep ?? parseInt(spacing.nodeNodeBetweenLayers)
        ),
        'elk.spacing.nodeNode': String(this.options.nodesep ?? 40),
        'elk.layered.spacing.edgeNodeBetweenLayers':
          spacing.edgeNodeBetweenLayers,
        'elk.layered.spacing.edgeEdgeBetweenLayers':
          spacing.edgeEdgeBetweenLayers,
        'elk.layered.nodePlacement.strategy':
          this.options.nodePlacementStrategy ?? 'BRANDES_KOEPF',
        'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
        'elk.layered.nodePlacement.favorStraightEdges': 'true',
        'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
        'elk.layered.layering.strategy': 'NETWORK_SIMPLEX',
        'elk.layered.thoroughness': isDenseGraph ? '7' : '10',

        'elk.layered.mergeEdges': isDenseGraph ? 'false' : 'true',
        'elk.layered.unnecessaryBendpoints': 'true',
        'elk.layered.feedbackEdges': 'true',
        'elk.separateConnectedComponents': 'true',
        'elk.spacing.componentComponent': spacing.componentComponent,

        'elk.aspectRatio': spacing.aspectRatio,
      },
    };

    const result = await this.elk.layout(graph);

    const nodes: LayoutResult['nodes'] = {};
    const edges: LayoutResult['edges'] = {};

    result.children?.forEach((node) => {
      nodes[node.id] = {
        x: node.x ?? 0,
        y: node.y ?? 0,
        width: node.width ?? 0,
        height: node.height ?? 0,
      };
    });

    result.edges?.forEach((edge) => {
      const sections: ElkEdgeSection[] = edge.sections ?? [];

      const points: { x: number; y: number }[] = [];

      sections.forEach((section) => {
        if (section.startPoint) {
          points.push(section.startPoint);
        }

        if (section.bendPoints) {
          points.push(...section.bendPoints);
        }

        if (section.endPoint) {
          points.push(section.endPoint);
        }
      });

      edges[edge.id] = {
        points,
      };
    });

    return {
      nodes,
      edges,
      bounds: {
        width: result.width ?? 0,
        height: result.height ?? 0,
      },
    };
  }
}
