import fs from 'fs-extra';
import { parseAdacFromContent } from '@mindfiredigital/adac-parser';
import { buildElkGraph } from '@mindfiredigital/adac-layout-elk';
import { validateAdacConfig } from '@mindfiredigital/adac-schema';
import { ComplianceChecker } from '@mindfiredigital/adac-compliance';
import { renderSvg, renderSvgFromPositionedGraph } from './renderer.js';

type CostPeriod = 'hourly' | 'daily' | 'monthly' | 'yearly';
type PositionedBounds = { x: number; y: number; width: number; height: number };

export interface GenerationResult {
  svg: string;
  logs: string[];
  duration: number;
}

export async function generateDiagramSvg(
  inputContent: string,
  layoutOverride?: 'elk' | 'dagre' | 'custom',
  validate: boolean = false,
  costData?: Record<string, number>,
  period: CostPeriod = 'monthly'
): Promise<GenerationResult> {
  const logs: string[] = [];
  const start = Date.now();
  const log = (msg: string) =>
    logs.push(`[${new Date().toISOString()}] ${msg}`);

  try {
    log('Starting diagram generation.');
    log('Parsing ADAC content...');
    const adac = parseAdacFromContent(inputContent, {
      validate: false,
    });
    if (validate) {
      log('Validating ADAC schema...');
      const validation = validateAdacConfig(adac);
      if (!validation.valid) {
        throw new Error(
          `Schema validation failed:\n${validation.errors?.join('\n')}`
        );
      }
      log('Schema validation passed.');
    }

    log('Parsing complete.');

    log('Building ELK Graph structure...');
    const graph = buildElkGraph(adac);
    log(`Graph built with ${graph.children?.length || 0} top-level nodes.`);

    const engine = layoutOverride || adac.layout || 'elk';
    log(`Layout engine selected: ${engine}`);

    // Run compliance checks driven entirely by per-service `compliance:` fields in the YAML.
    // Services without a `compliance:` key are silently skipped.
    log('Running per-service compliance checks from YAML declarations...');
    const checker = new ComplianceChecker();
    const { byService } = checker.checkCompliance(adac);

    // Build a per-service violation summary for the renderer tooltip
    // Shape: { [serviceId]: { frameworks: string[], violations: string[] } }
    const complianceTooltipMap: Record<
      string,
      { frameworks: string[]; violations: string[] }
    > = {};

    for (const [serviceId, results] of Object.entries(byService)) {
      const frameworks = results.map((r) => r.framework);
      const violations: string[] = [];

      for (const result of results) {
        if (!result.isCompliant) {
          log(
            `Service '${serviceId}' has ${result.violations.length} violations for framework '${result.framework}'`
          );
          for (const v of result.violations) {
            violations.push(
              `[${result.framework.toUpperCase()} - ${v.severity.toUpperCase()}] ${v.message}`
            );
          }
        } else {
          log(
            `Service '${serviceId}' complies with framework '${result.framework}'`
          );
        }
      }

      complianceTooltipMap[serviceId] = { frameworks, violations };
    }

    if (Object.keys(complianceTooltipMap).length === 0) {
      log(
        'No services with compliance declarations found — skipping compliance tooltips.'
      );
    }

    const perServiceCosts = costData;

    log('Rendering SVG (Computing Layout & Styles)...');

    let svg: string;

    if (engine === 'elk') {
      svg = await renderSvg(
        graph,
        engine,
        complianceTooltipMap,
        perServiceCosts,
        period
      );
    } else {
      // Dynamically import the layout factory at runtime to avoid bundler resolution
      // issues during build when the package is optional in this package's deps.
      let createLayoutEngine: any;
      try {
        const mod = await import('@mindfiredigital/adac-layout');
        createLayoutEngine = mod.createLayoutEngine ?? mod.default ?? mod;
      } catch (err) {
        throw new Error(
          "Custom layout requested but package '@mindfiredigital/adac-layout' was not found.\nInstall the layout package or use --layout elk|dagre. For monorepos run: `pnpm -w install` or add the package to the workspace."
        );
      }

      const layoutDirection =
        graph.layoutOptions?.['elk.direction'] === 'RIGHT' ? 'LR' : 'TB';

      // Use layout package to create a layout engine (custom)
      const layoutEngine = await createLayoutEngine(
        'custom',
        {
          rankdir: layoutDirection,
          nodesep: 80,
          ranksep: 110,
          marginx: 20,
          marginy: 20,
        },
        adac as any
      );

      const positionedGraph = JSON.parse(JSON.stringify(graph));
      const nodeMap = new Map<string, any>();
      const parentMap = new Map<string, string | undefined>();
      const allEdges: any[] = [];

      const collectNodes = (node: any, parentId?: string) => {
        if (!node?.id) return;
        nodeMap.set(node.id, node);
        parentMap.set(node.id, parentId);
        if (node.children) {
          node.children.forEach((child: any) => collectNodes(child, node.id));
        }
      };

      const collectEdges = (node: any) => {
        if (Array.isArray(node?.edges)) {
          allEdges.push(...node.edges);
        }
        if (node?.children) {
          node.children.forEach((child: any) => collectEdges(child));
        }
      };

      if (positionedGraph.children) {
        positionedGraph.children.forEach((child: any) => collectNodes(child));
      }
      collectEdges(positionedGraph);

      const leafNodeIds = new Set(
        [...nodeMap.values()]
          .filter((node) => !node.children || node.children.length === 0)
          .map((node) => node.id)
      );

      for (const nodeId of leafNodeIds) {
        const node = nodeMap.get(nodeId);
        layoutEngine.addNode(nodeId, {
          width: node.width ?? 80,
          height: node.height ?? 100,
        });
      }

      for (const edge of allEdges) {
        const from =
          edge.sources && edge.sources.length > 0 ? edge.sources[0] : undefined;
        const to =
          edge.targets && edge.targets.length > 0 ? edge.targets[0] : undefined;
        const label =
          edge.labels && edge.labels.length > 0 ? edge.labels[0].text : undefined;

        if (from && to && leafNodeIds.has(from) && leafNodeIds.has(to)) {
          layoutEngine.addEdge(from, to, { label });
        }
      }

      const layoutResult = await layoutEngine.layout();
      const absolutePositions = new Map<string, PositionedBounds>();
      const layoutNodes = (layoutResult.nodes || {}) as Record<
        string,
        PositionedBounds
      >;

      for (const [nodeId, pos] of Object.entries(layoutNodes)) {
        absolutePositions.set(nodeId, {
          x: pos.x,
          y: pos.y,
          width: pos.width,
          height: pos.height,
        });
      }

      const computeContainerBounds = (
        node: any
      ): PositionedBounds | undefined => {
        if (!node?.id) return undefined;

        const existing = absolutePositions.get(node.id);
        if (existing && (!node.children || node.children.length === 0)) {
          return existing;
        }

        const childBounds: PositionedBounds[] = (node.children || [])
          .map((child: any) => computeContainerBounds(child))
          .filter(
            (bound: PositionedBounds | undefined): bound is PositionedBounds =>
              bound !== undefined
          );

        if (childBounds.length === 0) {
          if (existing) return existing;

          const fallback = {
            x: 0,
            y: 0,
            width: node.width ?? 80,
            height: node.height ?? 100,
          };
          absolutePositions.set(node.id, fallback);
          return fallback;
        }

        const minX = Math.min(
          ...childBounds.map((bound: PositionedBounds) => bound.x)
        );
        const minY = Math.min(
          ...childBounds.map((bound: PositionedBounds) => bound.y)
        );
        const maxX = Math.max(
          ...childBounds.map(
            (bound: PositionedBounds) => bound.x + bound.width
          )
        );
        const maxY = Math.max(
          ...childBounds.map(
            (bound: PositionedBounds) => bound.y + bound.height
          )
        );

        const bounds = {
          x: minX - 20,
          y: minY - 40,
          width: maxX - minX + 40,
          height: maxY - minY + 60,
        };
        absolutePositions.set(node.id, bounds);
        return bounds;
      };

      if (positionedGraph.children) {
        positionedGraph.children.forEach((child: any) =>
          computeContainerBounds(child)
        );
      }

      const applyRelativePositions = (
        node: any,
        parentAbs?: { x: number; y: number }
      ) => {
        const abs = absolutePositions.get(node.id);
        if (abs) {
          node.x = parentAbs ? abs.x - parentAbs.x : abs.x;
          node.y = parentAbs ? abs.y - parentAbs.y : abs.y;
          node.width = abs.width;
          node.height = abs.height;
        }
        if (node.children) {
          const currentAbs = abs ? { x: abs.x, y: abs.y } : parentAbs;
          node.children.forEach((child: any) =>
            applyRelativePositions(child, currentAbs)
          );
        }
      };

      if (positionedGraph.children) {
        positionedGraph.children.forEach((child: any) =>
          applyRelativePositions(child)
        );
      }

      const getAncestors = (nodeId: string) => {
        const ancestors: string[] = [];
        let current = parentMap.get(nodeId);
        while (current) {
          ancestors.push(current);
          current = parentMap.get(current);
        }
        return ancestors;
      };

      const findNearestSharedContainer = (fromId: string, toId: string) => {
        const toAncestors = new Set(getAncestors(toId));
        for (const ancestor of getAncestors(fromId)) {
          if (toAncestors.has(ancestor)) return ancestor;
        }
        return undefined;
      };

      const getPathFromRoot = (nodeId: string) => {
        const path: string[] = [];
        let current: string | undefined = nodeId;
        while (current) {
          path.unshift(current);
          current = parentMap.get(current);
        }
        return path;
      };

      const getBranchBelowAncestor = (ancestorId: string, nodeId: string) => {
        const path = getPathFromRoot(nodeId);
        const ancestorIndex = path.indexOf(ancestorId);
        if (ancestorIndex === -1) return undefined;
        return path[ancestorIndex + 1];
      };

      const isBroadContainer = (nodeId: string) => {
        const node = nodeMap.get(nodeId);
        const cssClass = node?.properties?.cssClass;
        return (
          nodeId === 'root' ||
          cssClass === 'aws-vpc' ||
          cssClass === 'aws-az' ||
          cssClass === 'gcp-vpc' ||
          cssClass === 'gcp-region' ||
          cssClass === 'gcp-zone'
        );
      };

      const buildOrthogonalEdge = (
        from: PositionedBounds,
        to: PositionedBounds,
        fromId: string,
        toId: string
      ) => {
        if (layoutDirection === 'TB') {
          const midY = (from.y + from.height + to.y) / 2;
          return {
            startPoint: {
              x: from.x + from.width / 2,
              y: from.y + from.height,
            },
            endPoint: {
              x: to.x + to.width / 2,
              y: to.y,
            },
            bendPoints: [
              { x: from.x + from.width / 2, y: midY },
              { x: to.x + to.width / 2, y: midY },
            ],
          };
        }

        const start = {
          x: from.x + from.width,
          y: from.y + from.height / 2,
        };
        const end = {
          x: to.x,
          y: to.y + to.height / 2,
        };

        const commonContainerId = findNearestSharedContainer(fromId, toId);
        const targetBranchId =
          commonContainerId &&
          isBroadContainer(commonContainerId) &&
          commonContainerId !== toId
            ? getBranchBelowAncestor(commonContainerId, toId)
            : undefined;
        const laneContainerId = targetBranchId ?? commonContainerId;
        const laneBounds = laneContainerId
          ? absolutePositions.get(laneContainerId)
          : undefined;
        const laneY = laneBounds
          ? laneBounds.y + 44
          : Math.min(start.y, end.y) - 24;
        const startPoint = {
          x: start.x,
          y: laneY,
        };
        const endPoint = {
          x: end.x,
          y: laneY,
        };

        return {
          startPoint,
          endPoint,
          bendPoints: [],
        };
      };

      positionedGraph.edges = allEdges
        .map((edge: any) => {
          const fromId =
            edge.sources && edge.sources.length > 0 ? edge.sources[0] : undefined;
          const toId =
            edge.targets && edge.targets.length > 0 ? edge.targets[0] : undefined;

          if (!fromId || !toId) return undefined;

          const from = absolutePositions.get(fromId);
          const to = absolutePositions.get(toId);

          if (!from || !to) return undefined;

          return {
            id: edge.id ?? `${fromId}->${toId}`,
            sections: [buildOrthogonalEdge(from, to, fromId, toId)],
          };
        })
        .filter((edge: any) => edge !== undefined);

      // Render from the already-positioned ELK graph
      svg = renderSvgFromPositionedGraph(
        positionedGraph,
        complianceTooltipMap,
        perServiceCosts,
        period
      );
    }
    log('SVG Rendering complete.');

    // Removed cost summary injection

    const duration = Date.now() - start;
    log(`Total generation time: ${duration}ms`);

    return { svg, logs, duration };
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    log(`Error: ${error.message}`);
    (error as Error & { logs?: string[] }).logs = logs;
    throw error;
  }
}

export async function generateDiagram(
  input: string,
  output: string,
  layoutOverride?: 'elk' | 'dagre' | 'custom',
  validate: boolean = false,
  costData?: Record<string, number>,
  period: CostPeriod = 'monthly'
): Promise<void> {
  const raw = await fs.readFile(input, 'utf8');
  const { svg } = await generateDiagramSvg(
    raw,
    layoutOverride,
    validate,
    costData,
    period
  );

  await fs.outputFile(output, svg);
  console.log(`Diagram generated: ${output}`);
}
