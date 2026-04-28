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
    const graph: ElkNode = {
      id: 'root',
      children: Array.from(this.nodes.values()),
      edges: this.edges,

      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': this.options.rankdir === 'LR' ? 'RIGHT' : 'DOWN',

        // Hierarchical edge routing across nested containers — without this
        // option, edges that cross container boundaries get awkward kinks.
        'elk.hierarchyHandling': 'INCLUDE_CHILDREN',

        'elk.edgeRouting': 'ORTHOGONAL',
        'elk.layered.spacing.nodeNodeBetweenLayers': String(
          this.options.ranksep ?? 80
        ),
        'elk.spacing.nodeNode': String(this.options.nodesep ?? 40),

        // Aesthetic tuning — same defaults used by buildElkGraph so the two
        // entry points produce visually consistent layouts.
        'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
        'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
        'elk.layered.nodePlacement.favorStraightEdges': 'true',
        'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
        'elk.layered.layering.strategy': 'NETWORK_SIMPLEX',
        'elk.layered.thoroughness': '10',
        'elk.layered.mergeEdges': 'true',
        'elk.layered.unnecessaryBendpoints': 'true',
        'elk.layered.feedbackEdges': 'true',
        'elk.separateConnectedComponents': 'true',
        'elk.spacing.componentComponent': '60',
        'elk.aspectRatio': '1.6',
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
