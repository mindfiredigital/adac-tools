import { Graph } from '../graph/graph';

export function detectCycles(graph: Graph): string[][] {
  const visited = new Set<string>();
  const stack = new Set<string>();
  const cycles: string[][] = [];

  function dfs(nodeId: string, path: string[]) {
    if (stack.has(nodeId)) {
      cycles.push([...path, nodeId]);
      return;
    }
    if (visited.has(nodeId)) return;

    visited.add(nodeId);
    stack.add(nodeId);

    const node = graph.getNode(nodeId);
    node?.outgoing.forEach((next) => dfs(next, [...path, nodeId]));

    stack.delete(nodeId);
  }

  graph.nodes.forEach((_, id) => dfs(id, []));

  return cycles;
}

export function breakCycles(graph: Graph, cycles: string[][]) {
  cycles.forEach((cycle) => {
    const from = cycle[cycle.length - 2];
    const to = cycle[cycle.length - 1];

    graph.getNode(from)?.outgoing.delete(to);
    graph.getNode(to)?.incoming.delete(from);
  });
}
