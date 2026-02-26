import { CustomLayoutEngine } from '../src';

test('basic layout works', () => {
  const engine = new CustomLayoutEngine({ rankdir: 'TB' });

  engine.addNode('A', { width: 100, height: 50 });
  engine.addNode('B', { width: 100, height: 50 });
  engine.addEdge('A', 'B');

  const result = engine.layout();

  expect(result.nodes.A).toBeDefined();
  expect(result.nodes.B).toBeDefined();
  expect(Object.keys(result.edges).length).toBe(1);
});
