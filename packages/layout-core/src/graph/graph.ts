import { Node } from './node';
import { Edge } from './edge';

export class Graph {
  nodes: Map<string, Node> = new Map();
  edges: Edge[] = [];

  addNode(
    id: string,
    data: { width: number; height: number; [key: string]: unknown }
  ) {
    if (!this.nodes.has(id)) {
      this.nodes.set(id, new Node(id, data.width, data.height, data));
    }
  }

  addEdge(from: string, to: string, data?: Record<string, unknown>) {
    const edge = new Edge(from, to, data);
    this.edges.push(edge);

    this.nodes.get(from)?.outgoing.add(to);
    this.nodes.get(to)?.incoming.add(from);
  }

  nodeCount() {
    return this.nodes.size;
  }

  getNode(id: string) {
    return this.nodes.get(id);
  }
}
