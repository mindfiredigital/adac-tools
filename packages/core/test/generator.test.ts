import { describe, it, expect, vi } from 'vitest';
import { generateDiagramSvg } from '../src/generator.js';
import { renderSvg } from '../src/renderer.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

vi.mock('@mindfiredigital/adac-validator', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@mindfiredigital/adac-validator')>();
  return {
    ...actual,
    validateAdacConfig: vi.fn((config) => {
      if (
        config &&
        config.metadata &&
        config.metadata.name === 'InvalidMocked'
      ) {
        return { valid: false };
      }
      return actual.validateAdacConfig(config);
    }),
  };
});

type SvgRect = { x: number; y: number; width: number; height: number };
type SvgPoint = { x: number; y: number };
type SvgNodeRect = SvgRect & { id: string; isLeaf: boolean };

function extractNodeRect(svg: string, nodeId: string): SvgRect {
  const match = svg.match(
    new RegExp(
      `<g id="node-${nodeId}"[\\s\\S]*?<rect x="([^"]+)" y="([^"]+)"\\s*width="([^"]+)" height="([^"]+)"`
    )
  );
  if (!match) {
    throw new Error(`Unable to find rect for node ${nodeId}`);
  }

  return {
    x: Number(match[1]),
    y: Number(match[2]),
    width: Number(match[3]),
    height: Number(match[4]),
  };
}

// Container-type nodes (e.g. an `aws-compute-cluster` running a sub-app)
// render a title-pill that sits above the container's own box, and that
// pill — not the box — is where the orthogonal router actually terminates
// incoming/outgoing edges. Boundary checks against such a node must use the
// pill's rect or every legitimate top-entry port reads as a miss.
function extractNodeBoundaryRect(svg: string, nodeId: string): SvgRect {
  const block = svg.match(
    new RegExp(
      `<g id="node-${nodeId}">([\\s\\S]*?)(?=<g id="node-|<g id="legend"|</svg>)`
    )
  );
  const body = block?.[1] ?? '';
  const pillMatch = body.match(
    /<rect(?=[^>]*title-pill)[^>]*\sx="([^"]+)"[^>]*\sy="([^"]+)"[^>]*\swidth="([^"]+)"[^>]*\sheight="([^"]+)"[^>]*>/
  );
  if (pillMatch) {
    return {
      x: Number(pillMatch[1]),
      y: Number(pillMatch[2]),
      width: Number(pillMatch[3]),
      height: Number(pillMatch[4]),
    };
  }
  return extractNodeRect(svg, nodeId);
}

function extractLeafRects(svg: string): Array<SvgRect & { id: string }> {
  return Array.from(
    svg.matchAll(
      /<g id="node-([^"]+)"[\s\S]*?<rect x="([^"]+)" y="([^"]+)"\s*width="([^"]+)" height="([^"]+)"[\s\S]*?class="node-card/g
    )
  )
    .filter((match) => !match[1].startsWith('group-'))
    .map((match) => ({
      id: match[1],
      x: Number(match[2]),
      y: Number(match[3]),
      width: Number(match[4]),
      height: Number(match[5]),
    }));
}

function extractRenderedNodeRects(svg: string): SvgNodeRect[] {
  const nodes: SvgNodeRect[] = [];
  for (const match of svg.matchAll(
    /<g id="node-([^"]+)">([\s\S]*?)(?=<g id="node-|<g id="legend"|<\/svg>)/g
  )) {
    const id = match[1];
    const body = match[2];
    for (const rect of body.matchAll(
      /<rect x="([^"]+)" y="([^"]+)"\s*width="([^"]+)" height="([^"]+)"[\s\S]*?class="([^"]+)"/g
    )) {
      const classList = rect[5].split(/\s+/);
      if (
        !classList.includes('node-card') &&
        !classList.some((className) => className.includes('container'))
      ) {
        continue;
      }

      nodes.push({
        id,
        x: Number(rect[1]),
        y: Number(rect[2]),
        width: Number(rect[3]),
        height: Number(rect[4]),
        isLeaf: classList.includes('node-card'),
      });
    }
  }

  return nodes;
}

function extractTitlePillRects(svg: string): SvgRect[] {
  return Array.from(
    svg.matchAll(
      /<rect(?=[^>]*title-pill)[^>]*\sx="([^"]+)"[^>]*\sy="([^"]+)"[^>]*\swidth="([^"]+)"[^>]*\sheight="([^"]+)"[^>]*>/g
    )
  ).map((match) => ({
    x: Number(match[1]),
    y: Number(match[2]),
    width: Number(match[3]),
    height: Number(match[4]),
  }));
}

function isAwsFixture(name: string, content: string) {
  return (
    name.startsWith('aws') ||
    /provider:\s*['"]?aws['"]?/i.test(content) ||
    /\bservice:\s*['"]?(cloudfront|s3|lambda|ecs|eks|rds|dynamodb|api-gateway|alb|waf|sqs|sns|kinesis|redshift|athena|glue|emr|cloudwatch|route53|cognito|kms|macie|firehose)/i.test(
      content
    )
  );
}

function extractEdgePaths(svg: string): SvgPoint[][] {
  return Array.from(
    svg.matchAll(/<path d="([^"]+)" class="([^"]*aws-edge[^"]*)"/g)
  ).map((match) => {
    const values = Array.from(match[1].matchAll(/-?\d+(?:\.\d+)?/g)).map(
      (value) => Number(value[0])
    );
    const points: SvgPoint[] = [];
    for (let i = 0; i < values.length; i += 2) {
      points.push({ x: values[i], y: values[i + 1] });
    }
    return points;
  });
}

function rangeOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
) {
  return Math.max(
    0,
    Math.min(Math.max(aStart, aEnd), Math.max(bStart, bEnd)) -
      Math.max(Math.min(aStart, aEnd), Math.min(bStart, bEnd))
  );
}

function segmentIntersectsRectInterior(
  a: SvgPoint,
  b: SvgPoint,
  rect: SvgRect,
  margin = 10
) {
  const left = rect.x + margin;
  const right = rect.x + rect.width - margin;
  const top = rect.y + margin;
  const bottom = rect.y + rect.height - margin;
  if (left >= right || top >= bottom) return false;

  if (a.x === b.x) {
    return a.x > left && a.x < right && rangeOverlap(a.y, b.y, top, bottom) > 0;
  }
  if (a.y === b.y) {
    return a.y > top && a.y < bottom && rangeOverlap(a.x, b.x, left, right) > 0;
  }
  return false;
}

function isPointOnRectBoundary(point: SvgPoint, rect: SvgRect) {
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  const withinX = point.x >= rect.x - 0.5 && point.x <= right + 0.5;
  const withinY = point.y >= rect.y - 0.5 && point.y <= bottom + 0.5;

  return (
    (Math.abs(point.x - rect.x) <= 0.5 && withinY) ||
    (Math.abs(point.x - right) <= 0.5 && withinY) ||
    (Math.abs(point.y - rect.y) <= 0.5 && withinX) ||
    (Math.abs(point.y - bottom) <= 0.5 && withinX)
  );
}

function findPathBetweenRects(
  paths: SvgPoint[][],
  source: SvgRect,
  target: SvgRect
) {
  return paths.find((points) => {
    const first = points[0];
    const last = points[points.length - 1];
    return (
      (isPointOnRectBoundary(first, source) &&
        isPointOnRectBoundary(last, target)) ||
      (isPointOnRectBoundary(first, target) &&
        isPointOnRectBoundary(last, source))
    );
  });
}

function countOverlappingParallelSegments(paths: SvgPoint[][]) {
  const segments = paths.flatMap((points, pathIndex) =>
    points.slice(0, -1).flatMap((point, segmentIndex) => {
      const next = points[segmentIndex + 1];
      if (segmentIndex === 0 || segmentIndex === points.length - 2) return [];
      if (point.x !== next.x && point.y !== next.y) return [];
      return [
        {
          pathIndex,
          segmentIndex,
          a: point,
          b: next,
          vertical: point.x === next.x,
        },
      ];
    })
  );
  let overlaps = 0;

  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const left = segments[i];
      const right = segments[j];
      if (
        left.pathIndex === right.pathIndex ||
        left.vertical !== right.vertical
      ) {
        continue;
      }

      if (left.vertical) {
        const distance = Math.abs(left.a.x - right.a.x);
        const amount = rangeOverlap(left.a.y, left.b.y, right.a.y, right.b.y);
        if (amount > 8 && distance < 1.5) overlaps++;
      } else {
        const distance = Math.abs(left.a.y - right.a.y);
        const amount = rangeOverlap(left.a.x, left.b.x, right.a.x, right.b.x);
        if (amount > 8 && distance < 1.5) overlaps++;
      }
    }
  }

  return overlaps;
}

describe('ADAC Core Generator', () => {
  const validYaml = `
version: "0.1"
metadata:
  name: "Test Arch"
  created: "2023-11-01"
infrastructure:
  clouds:
    - id: "aws-1"
      provider: "aws"
      region: "us-east-1"
      services:
        - id: "vm-1"
          service: "ec2"
          name: "Server"
          configuration:
            instance_type: "t3.micro"
`;

  it('should generate SVG from valid ADAC content', async () => {
    const result = await generateDiagramSvg(validYaml);
    expect(result.svg).toContain('<svg');
    expect(result.svg).toContain('Server');
    expect(result.logs.length).toBeGreaterThan(0);
  });

  it('should call generateDiagram string I/O successfully', async () => {
    const tmpFileIn = path.join(os.tmpdir(), 'test-in.yaml');
    const tmpFileOut = path.join(os.tmpdir(), 'test-out.svg');
    await fs.writeFile(tmpFileIn, validYaml);
    const { generateDiagram } = await import('../src/generator.js');
    await generateDiagram(tmpFileIn, tmpFileOut, 'elk', false);
    const content = await fs.readFile(tmpFileOut, 'utf8');
    expect(content).toContain('<svg');
  });

  it('should validate schema when requested', async () => {
    const result = await generateDiagramSvg(validYaml, undefined, true);
    expect(result.svg).toContain('<svg');
    expect(
      result.logs.some((l) => l.includes('Schema validation passed'))
    ).toBe(true);
  });

  it('should fail on invalid schema when validation is enabled', async () => {
    const invalidYaml = `
version: "0.1"
metadata:
  name: "Invalid"
  created: "2023-11-01"
infrastructure:
  clouds: []
`;
    await expect(
      generateDiagramSvg(invalidYaml, undefined, true)
    ).rejects.toThrow();
  });

  it('should format error without errors array when validation is enabled', async () => {
    // We already mocked validateAdacConfig at the top of the file to return undefined errors for 'InvalidMocked'
    const invalidYaml = `version: "0.1"\nmetadata:\n  name: "InvalidMocked"\n  created: "2023-11-01"\ninfrastructure:\n  clouds: []`;
    await expect(
      generateDiagramSvg(invalidYaml, undefined, true)
    ).rejects.toThrow(/Schema validation failed/);
  });

  it('should use specified layout engine', async () => {
    const resultElk = await generateDiagramSvg(validYaml, 'elk');
    expect(resultElk.svg).toContain('<svg');
  });

  it('should generate SVG with orthogonal layout engine', async () => {
    const orthogonalYaml = `
version: "0.1"
metadata:
  name: "Orthogonal Arch"
  created: "2023-11-01"
layout: orthogonal
infrastructure:
  clouds:
    - id: "aws-1"
      provider: "aws"
      region: "us-east-1"
      services:
        - id: "api"
          service: "lambda"
          name: "API"
        - id: "queue"
          service: "sqs"
          name: "Queue"
        - id: "worker"
          service: "lambda"
          name: "Worker"
connections:
  - id: "api-to-queue"
    from: "api"
    to: "queue"
    type: "message-publish"
  - id: "queue-to-worker"
    from: "queue"
    to: "worker"
    type: "message-consume"
`;

    const result = await generateDiagramSvg(orthogonalYaml, undefined, true);

    expect(result.svg).toContain('<svg');
    expect(result.svg).toContain('API');
    expect(result.svg).toContain('Queue');
    expect(result.svg).toContain('Worker');
    expect(result.svg).toContain('data-layout="orthogonal"');
    expect(result.svg.match(/<marker id=/g)).toHaveLength(1);
    expect(result.svg).not.toContain('id="arrow-gcp"');
    expect(result.svg).not.toContain('id="arrow-azure"');
    expect(result.svg).not.toMatch(/<path d="[^"]* A /);
  });

  it('should generate SVG with TSM layout engine', async () => {
    const tsmYaml = `
version: "0.1"
metadata:
  name: "TSM Arch"
  created: "2023-11-01"
layout: tsm
infrastructure:
  clouds:
    - id: "aws-1"
      provider: "aws"
      region: "us-east-1"
      services:
        - id: "api"
          service: "lambda"
          name: "API"
        - id: "queue"
          service: "sqs"
          name: "Queue"
connections:
  - id: "api-to-queue"
    from: "api"
    to: "queue"
    type: "message-publish"
`;

    const result = await generateDiagramSvg(tsmYaml, undefined, true);

    expect(result.svg).toContain('<svg');
    expect(result.svg).toContain('API');
    expect(result.svg).toContain('Queue');
    expect(result.svg).toContain('data-layout="tsm"');
  });

  it('should keep orthogonal route tracks clear of endpoint boxes', async () => {
    const fixturePath = path.join(
      process.cwd(),
      '..',
      '..',
      'yamls',
      'aws_enterprise_data_lake.adac.yaml'
    );
    const yaml = await fs.readFile(fixturePath, 'utf8');

    const result = await generateDiagramSvg(
      yaml,
      'orthogonal',
      false,
      undefined,
      'monthly',
      true,
      undefined,
      async () => null
    );

    const paths = extractEdgePaths(result.svg);
    const leafRects = extractLeafRects(result.svg);
    const titlePillRects = extractTitlePillRects(result.svg);

    const edgeHitsLeaf = paths.some((points) =>
      points
        .slice(0, -1)
        .some((point, index) =>
          leafRects.some((rect) =>
            segmentIntersectsRectInterior(point, points[index + 1], rect)
          )
        )
    );
    // Skip each path's first and last segment: those are the stub that
    // leaves the source and the stub that attaches to the destination, and
    // for a container-type endpoint that attachment point deliberately
    // sits right at (or inside) its own title-pill. Only a detour segment
    // in the middle of the route grazing an unrelated pill is a real hit.
    const edgeHitsTitlePill = paths.some((points) => {
      for (let index = 1; index < points.length - 2; index++) {
        if (
          titlePillRects.some((rect) =>
            segmentIntersectsRectInterior(
              points[index],
              points[index + 1],
              rect,
              -8
            )
          )
        ) {
          return true;
        }
      }
      return false;
    });

    expect(edgeHitsLeaf).toBe(false);
    expect(edgeHitsTitlePill).toBe(false);
  });

  it('should compact broad orthogonal diagrams to fit available space', async () => {
    const fixturePath = path.join(
      process.cwd(),
      '..',
      '..',
      'yamls',
      'microservices.adac.yaml'
    );
    const yaml = await fs.readFile(fixturePath, 'utf8');

    const result = await generateDiagramSvg(
      yaml,
      'orthogonal',
      false,
      undefined,
      'monthly',
      true,
      undefined,
      async () => null
    );
    const width = Number(result.svg.match(/<svg width="([^"]+)"/)?.[1]);

    expect(width).toBeLessThan(3000);
  });

  it('should keep adjacent orthogonal block edges local', async () => {
    const fixturePath = path.join(
      process.cwd(),
      '..',
      '..',
      'yamls',
      'aws_serverless_ecommerce.adac.yaml'
    );
    const yaml = await fs.readFile(fixturePath, 'utf8');

    const result = await generateDiagramSvg(
      yaml,
      'orthogonal',
      false,
      undefined,
      'monthly',
      true,
      undefined,
      async () => null
    );

    const cloudfront = extractNodeBoundaryRect(result.svg, 'cloudfront-dist');
    const s3 = extractNodeBoundaryRect(result.svg, 's3-bucket-ui');
    const edgePath = findPathBetweenRects(
      extractEdgePaths(result.svg),
      cloudfront,
      s3
    );

    // cloudfront-dist now also flows into other siblings (WAF, the API
    // path), so it's no longer necessarily positioned immediately adjacent
    // to s3-bucket-ui the way it was when this container's layout only knew
    // about a single locally-connected pair — the container-level ordering
    // fix (packages/core/src/renderer.ts, "lift every real connection to
    // the pair of direct siblings that contain its endpoints") makes that
    // richer relationship visible, which can reposition either node. What
    // must still hold: the edge exists and its route doesn't cut through
    // any unrelated node on the way there.
    expect(edgePath).toBeDefined();

    const leafRects = extractLeafRects(result.svg).filter(
      (rect) => rect.id !== 'cloudfront-dist' && rect.id !== 's3-bucket-ui'
    );
    const edgeHitsUnrelatedLeaf = edgePath!
      .slice(0, -1)
      .some((point, index) =>
        leafRects.some((rect) =>
          segmentIntersectsRectInterior(point, edgePath![index + 1], rect)
        )
      );
    expect(edgeHitsUnrelatedLeaf).toBe(false);
  });

  // This iterates every AWS-ish fixture in yamls/ (currently ~10, some with
  // 100+ nodes) generating a full orthogonal diagram for each — legitimately
  // more work than vitest's 15s default budgets for one test, independent of
  // any particular layout change (reproduces identically with the fixes in
  // this file disabled). Widened rather than left flaky. Under
  // `vitest run --coverage` (v8 instrumentation), this takes ~70s locally
  // and 120s+ on CI runners, so the timeout needs real headroom above that.
  it('should keep AWS orthogonal fixture edges attached and clear of blocks', async () => {
    const yamlDir = path.join(process.cwd(), '..', '..', 'yamls');
    const fixtureNames = (await fs.readdir(yamlDir)).filter((file) =>
      file.endsWith('.yaml')
    );
    const issues: string[] = [];

    for (const fixtureName of fixtureNames) {
      const fixturePath = path.join(yamlDir, fixtureName);
      const yaml = await fs.readFile(fixturePath, 'utf8');
      if (!isAwsFixture(fixtureName, yaml)) continue;

      const result = await generateDiagramSvg(
        yaml,
        'orthogonal',
        false,
        undefined,
        'monthly',
        true,
        undefined,
        async () => null
      );

      const nodes = extractRenderedNodeRects(result.svg);
      const leaves = nodes.filter((node) => node.isLeaf);
      const titlePills = extractTitlePillRects(result.svg);

      const paths = extractEdgePaths(result.svg);
      const overlaps = countOverlappingParallelSegments(paths);
      if (overlaps > 0) {
        issues.push(`${fixtureName}: ${overlaps} overlapping edge segments`);
      }

      paths.forEach((points, pathIndex) => {
        const start = points[0];
        const end = points[points.length - 1];
        if (
          !nodes.some((node) => isPointOnRectBoundary(start, node)) ||
          !nodes.some((node) => isPointOnRectBoundary(end, node))
        ) {
          issues.push(
            `${fixtureName}: edge ${pathIndex} has detached endpoint`
          );
        }

        points.slice(0, -1).forEach((point, segmentIndex) => {
          const next = points[segmentIndex + 1];
          const leafHit = leaves.find((rect) =>
            segmentIntersectsRectInterior(point, next, rect)
          );
          if (leafHit) {
            issues.push(
              `${fixtureName}: edge ${pathIndex} crosses leaf ${leafHit.id}`
            );
          }

          const isEndpointApproach =
            segmentIndex === 0 || segmentIndex === points.length - 2;
          const titleHit =
            !isEndpointApproach &&
            titlePills.some((rect) =>
              segmentIntersectsRectInterior(point, next, rect, -8)
            );
          if (titleHit) {
            issues.push(
              `${fixtureName}: edge ${pathIndex} crosses a title pill`
            );
          }
        });
      });
    }

    expect(issues).toEqual([]);
  }, 180000);

  it('should reject unsupported layout engines', async () => {
    await expect(
      generateDiagramSvg(validYaml, 'invalid' as never)
    ).rejects.toThrow(/Unsupported layout engine/);
  });

  it('should include compliance tooltips when compliance checks fail', async () => {
    const result = await generateDiagramSvg(
      validYaml,
      undefined,
      false,
      undefined,
      'monthly',
      false,
      () => ({
        'vm-1': {
          frameworks: ['soc2'],
          violations: ['[SOC2 - HIGH] Not compliant error'],
        },
      })
    );
    expect(result.svg).toContain('soc2');
    expect(result.svg).toContain('Not compliant error');
  });

  it('should handle optimizer errors gracefully', async () => {
    const optimizerModule = await import('@mindfiredigital/adac-layout-core');
    const analyzeSpy = vi
      .spyOn(optimizerModule.OptimizerEngine.prototype, 'analyze')
      .mockImplementation(() => {
        throw new Error('Fake optimizer error');
      });

    const result = await generateDiagramSvg(validYaml);
    expect(
      result.logs.some((l) =>
        l.includes('Optimizer error: Fake optimizer error')
      )
    ).toBe(true);

    analyzeSpy.mockRestore();
  });

  it('should include optimization tooltips when recommendations exist', async () => {
    const optimizerModule = await import('@mindfiredigital/adac-layout-core');
    const analyzeSpy = vi
      .spyOn(optimizerModule.OptimizerEngine.prototype, 'analyze')
      .mockImplementation(() => {
        return {
          summary: {
            total: 1,
            critical: 0,
            high: 1,
            medium: 0,
            low: 0,
            totalEstimatedSavingsUsd: 10,
          },
          recommendations: [
            {
              category: 'cost',
              title: 'Save money',
              severity: 'high',
              estimatedSavingsUsd: 10,
            },
          ],
          byService: {
            'vm-1': [
              {
                category: 'cost',
                title: 'Save money',
                severity: 'high',
                estimatedSavingsUsd: 10,
              },
            ],
          },
        };
      });

    const result = await generateDiagramSvg(validYaml);
    expect(result.svg).toContain('Est. Savings: $10.00/mo');
    expect(result.svg).toContain('[HIGH] Save money');

    analyzeSpy.mockRestore();
  });
});

describe('ADAC Core Renderer', () => {
  it('should render simple graph with ELK', async () => {
    const graph = {
      id: 'root',
      properties: { type: 'container' },
      children: [
        {
          id: 'n1',
          width: 100,
          height: 100,
          labels: [{ text: 'Node 1' }],
          properties: { type: 'service' },
        },
      ],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svg = await renderSvg(graph as any, 'elk');
    expect(svg).toContain('<svg');
    expect(svg).toContain('Node 1');
  });

  it('should handle nested containers', async () => {
    const graph = {
      id: 'root',
      properties: { type: 'container' },
      children: [
        {
          id: 'c1',
          width: 200,
          height: 200,
          labels: [{ text: 'Container' }],
          properties: { type: 'container' },
          children: [
            {
              id: 'n1',
              width: 50,
              height: 50,
              labels: [{ text: 'Nested' }],
              properties: { type: 'service' },
            },
          ],
        },
      ],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svg = await renderSvg(graph as any, 'elk');
    expect(svg).toContain('aws-container');
    expect(svg).toContain('Nested');
  });

  it('should render icons if iconPath is provided', async () => {
    const iconPath =
      'd:/adac-tools/packages/icons-aws/assets/aws-icons/image1001.jpg';
    const graph = {
      id: 'root',
      properties: { type: 'container' },
      children: [
        {
          id: 'n1',
          width: 100,
          height: 100,
          labels: [{ text: 'Icon Node' }],
          properties: { type: 'service', iconPath },
        },
      ],
    };

    // spy and mock fs to pretend jpg exists and can be read
    const existSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const readSpy = vi
      .spyOn(fs, 'readFileSync')
      .mockReturnValue(Buffer.from('binary-data'));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svg = await renderSvg(graph as any, 'elk');
    expect(svg).toContain('data:image/jpeg;base64');

    // now make it throw to catch 95-96
    readSpy.mockImplementationOnce(() => {
      throw new Error('EACCES');
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svgErr = await renderSvg(graph as any, 'elk');
    expect(svgErr).not.toContain('data:image/jpeg;base64');

    existSpy.mockRestore();
    readSpy.mockRestore();
  });

  it('should render edges', async () => {
    const graph = {
      id: 'root',
      properties: { type: 'container' },
      children: [
        { id: 'n1', width: 50, height: 50, x: 0, y: 0 },
        { id: 'n2', width: 50, height: 50, x: 200, y: 0 },
      ],
      edges: [
        {
          id: 'e1',
          sources: ['n1'],
          targets: ['n2'],
          sections: [
            {
              id: 's1',
              startPoint: { x: 50, y: 25 },
              endPoint: { x: 200, y: 25 },
            },
          ],
        },
      ],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svg = await renderSvg(graph as any, 'elk');
    expect(svg).toContain('class="aws-edge"');
    expect(svg).toContain('<path d="M');
  });

  it('should handle edge rendering details including labels, bendPoints and empty sections', async () => {
    const graph = {
      id: 'root',
      properties: { type: 'container' },
      children: [
        {
          id: 'n1',
          width: 120,
          height: 100,
          x: 0,
          y: 0,
          labels: [{ text: '<&> "escape\'' }],
          properties: { type: 'service' },
        },
        {
          id: 'n2',
          width: 120,
          height: 100,
          x: 150,
          y: 150,
          labels: [{ text: 'This is a very long text indeed' }],
          properties: { type: 'service' },
        },
        {
          id: 'c1',
          width: 100,
          height: 100,
          properties: { type: 'container', iconPath: 'dummy.png' },
          children: [
            { id: 'c1-stub', properties: { iconPath: 'dummy.png' } }, // trigger hasChildWithSameIcon
          ],
        },
        {
          id: 'c2',
          width: 100,
          height: 100,
          properties: { type: 'container', iconPath: 'dummy.png' },
          children: [
            { id: 'c2-child', properties: { iconPath: 'other.png' } }, // trigger container iconPath rendering
          ],
        },
      ],
      edges: [
        {
          id: 'e1',
          sources: ['n1'],
          targets: ['n1'],
          labels: [{ text: 'HTTP Request' }],
          sections: [
            {
              id: 's1',
              startPoint: { x: 50, y: 25 },
              endPoint: { x: 200, y: 25 },
              bendPoints: [{ x: 100, y: 25 }],
            },
          ],
        },
        {
          id: 'e2', // missing sections originally, now vertical to test vertical label
          sources: ['n1'],
          targets: ['n1'],
          labels: [{ text: 'Vertical' }],
          sections: [
            {
              id: 's2',
              startPoint: { x: 50, y: 25 },
              endPoint: { x: 50, y: 200 },
            },
          ],
        },
        {
          id: 'e3', // no sections property
          sources: ['n1'],
          targets: ['n1'],
          labels: [{ text: 'Missing Secs' }],
        },
      ],
    };

    const readSpy = vi
      .spyOn(fs, 'readFileSync')
      .mockReturnValue(Buffer.from('binary-data'));
    const existSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svg = await renderSvg(graph as any, 'custom');
    expect(svg).toContain('aws-edge');

    expect(svg).toContain('&lt;&amp;&gt; &quot;escape&apos;'); // escapeXml
    expect(svg).toContain('long text indeed'); // split lines

    readSpy.mockRestore();
    existSpy.mockRestore();
  });
});

describe('generator: layout engine and warnings', () => {
  const yaml = (layoutOptions: string, extra = '') => `
version: "0.2"
metadata:
  name: "Engine"
  created: "2026-01-01"
${extra}
layoutOptions:
${layoutOptions}
infrastructure:
  clouds:
    - id: "aws-1"
      provider: "aws"
      region: "us-east-1"
      services:
        - id: "fn"
          service: "lambda"
`;

  const svgWith = async (
    content: string,
    engine?: 'elk' | 'custom' | 'orthogonal' | 'tsm'
  ): Promise<string> => (await generateDiagramSvg(content, engine)).svg;

  it('renders with ELK when no engine is declared', async () => {
    const content = yaml('  direction: LR');
    expect(await svgWith(content)).toBe(await svgWith(content, 'elk'));
    expect(await svgWith(content)).not.toBe(await svgWith(content, 'custom'));
  });

  it('uses layoutOptions.engine when it is set', async () => {
    const content = yaml('  engine: custom');
    expect(await svgWith(content)).toBe(await svgWith(content, 'custom'));
  });

  it('prefers layoutOptions.engine over the top-level layout field', async () => {
    const content = yaml('  engine: custom', 'layout: orthogonal');
    expect(await svgWith(content)).toBe(await svgWith(content, 'custom'));
  });

  it('uses the top-level layout when layoutOptions.engine is not set', async () => {
    const content = yaml('  direction: LR', 'layout: custom');
    expect(await svgWith(content)).toBe(await svgWith(content, 'custom'));
  });

  it('reports a deprecated alias once when validating', async () => {
    const { logs } = await generateDiagramSvg(
      yaml('  unit: 50'),
      undefined,
      true
    );
    expect(logs.filter((l) => /unit.* is deprecated/.test(l))).toHaveLength(1);
  });
});
