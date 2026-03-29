import ELK from "elkjs/lib/elk.bundled.js";
import type {
  ElkNode,
  ElkExtendedEdge,
  ElkEdgeSection,
} from "elkjs/lib/elk-api";

import {
  LayoutEngine,
  LayoutOptions,
  LayoutResult,
} from "@mindfiredigital/adac-layout";

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
      id: "root",
      children: Array.from(this.nodes.values()),
      edges: this.edges,

      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": this.options.rankdir === "LR" ? "RIGHT" : "DOWN",

        "elk.edgeRouting": "ORTHOGONAL",
        "elk.layered.spacing.nodeNodeBetweenLayers":
          String(this.options.ranksep ?? 80),
        "elk.spacing.nodeNode": String(this.options.nodesep ?? 40),

        "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
        "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      },
    };

    const result = await this.elk.layout(graph);

    const nodes: Record<string, any> = {};
    const edges: Record<string, any> = {};

    result.children?.forEach((node: any) => {
      nodes[node.id] = {
        x: node.x ?? 0,
        y: node.y ?? 0,
        width: node.width ?? 0,
        height: node.height ?? 0,
      };
    });

    result.edges?.forEach((edge: any) => {
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