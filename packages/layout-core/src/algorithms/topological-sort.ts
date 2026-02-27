import { Graph } from '../graph/graph';

export function topologicalSort(graph: Graph): string[] {
  const inDegree = new Map<string, number>();
  const queue: string[] = [];
  const result: string[] = [];

  graph.nodes.forEach((node, id) => {
    inDegree.set(id, node.incoming.size);
    if (node.incoming.size === 0) queue.push(id);
  });

  while (queue.length) {
    const node = queue.shift()!;
    result.push(node);

    graph.getNode(node)?.outgoing.forEach((next) => {
      inDegree.set(next, inDegree.get(next)! - 1);
      if (inDegree.get(next) === 0) queue.push(next);
    });
  }

  return result;
}
