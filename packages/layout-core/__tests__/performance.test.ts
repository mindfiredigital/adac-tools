import { CustomLayoutEngine } from '../src';

test('50 nodes under 30ms', () => {
  const engine = new CustomLayoutEngine();

  for (let i = 0; i < 50; i++) {
    engine.addNode(`n${i}`, { width: 50, height: 30 });
    if (i > 0) engine.addEdge(`n${i - 1}`, `n${i}`);
  }

  const start = performance.now();
  engine.layout();
  const end = performance.now();

  expect(end - start).toBeLessThan(30);
});

test('100 nodes under 60ms', () => {
  const engine = new CustomLayoutEngine();

  for (let i = 0; i < 100; i++) {
    engine.addNode(`n${i}`, { width: 50, height: 30 });
    if (i > 0) engine.addEdge(`n${i - 1}`, `n${i}`);
  }

  const start = performance.now();
  engine.layout();
  const end = performance.now();

  expect(end - start).toBeLessThan(60);
});
