import ELK from 'elkjs';
import { type ElkNode, type ElkEdge } from '@mindfiredigital/adac-layout-elk';
import {
  CustomLayoutEngine,
  OrthogonalLayoutEngine,
  Graph as FlowRankGraph,
  detectCycles as detectFlowRankCycles,
  breakCycles as breakFlowRankCycles,
  assignRanks as assignFlowRanks,
} from '@mindfiredigital/adac-layout-core';
import { routeAStar } from './routing';

let fsPromise: Promise<typeof import('fs-extra')> | undefined;

const getFs = () =>
  (fsPromise ??= import('fs-extra').then((res) => res.default));

const CSS_STYLES = `
  /* ── Design Tokens ──────────────────────────────────── */
  :root {
    /* Canvas */
    --canvas-bg:        #EEF2F7;
    --canvas-padding:   40px;

    /* Typography */
    --font-aws:         "Amazon Ember", "Inter", "Segoe UI",
                        system-ui, sans-serif;
    --font-gcp:         "Google Sans", "Product Sans",
                        Roboto, system-ui, sans-serif;
    --font-azure:       "Segoe UI", "Inter",
                        system-ui, sans-serif;

    /* Text colors */
    --text-900:         #0F172A;
    --text-600:         #475569;
    --text-400:         #94A3B8;

    /* Node card */
    --card-bg:          #FFFFFF;
    --card-border:      #DDE3ED;
    --card-radius:      10px;

    /* ── AWS Brand ── */
    --aws-orange:       #FF9900;
    --aws-dark:         #232F3E;
    --aws-hover:        #EC7211;

    --aws-vpc-bg:       #F9F4FF;
    --aws-vpc-border:   #7C3AED;

    --aws-az-bg:        #F8FAFC;
    --aws-az-border:    #B0BACC;

    --aws-pub-bg:       #F0FDF4;
    --aws-pub-border:   #16A34A;

    --aws-priv-bg:      #F0F9FF;
    --aws-priv-border:  #0369A1;

    --aws-cluster-bg:   #FFFBEB;
    --aws-cluster-border: #D97706;

    --aws-edge:         #8FA3BF;

    /* ── GCP Brand ── */
    --gcp-blue:         #1A73E8;
    --gcp-green:        #1E8E3E;
    --gcp-red:          #D93025;
    --gcp-yellow:       #F9AB00;

    --gcp-vpc-bg:       #EEF2FF;
    --gcp-vpc-border:   #1A73E8;

    --gcp-region-bg:    #F0FDF4;
    --gcp-region-border: #1E8E3E;

    --gcp-zone-bg:      #F5F8FF;
    --gcp-zone-border:  #4285F4;

    --gcp-subnet-bg:    #EEF2FF;
    --gcp-subnet-border: #1A73E8;

    --gcp-cluster-bg:   #FFF7ED;
    --gcp-cluster-border: #EA580C;

    --gcp-edge:         #4285F4;

    /* ── Azure Brand ── */
    --azure-blue:       #0078D4;
    --azure-dark:       #003366;

    --azure-rg-bg:      #EFF6FF;
    --azure-rg-border:  #0078D4;

    --azure-vnet-bg:    #DBEAFE;
    --azure-vnet-border: #2563EB;

    --azure-subnet-bg:  #EFF6FF;
    --azure-subnet-border: #0078D4;

    --azure-cluster-bg:  #FFF7ED;
    --azure-cluster-border: #EA580C;

    --azure-edge:       #0078D4;

    /* ── Compliance ── */
    --ok-color:         #16A34A;
    --fail-color:       #DC2626;
  }

  /* ── Base SVG ── */
  svg {
    font-variant-ligatures: none;
    text-rendering:         optimizeLegibility;
    shape-rendering:        geometricPrecision;
    background-color:       var(--canvas-bg);
  }

  /* ── Canvas roots ── */
  .title-pill {
    stroke-dasharray: none !important;
    stroke-width: 1.5px !important;
  }
  .aws-root, .gcp-root, .azure-root {
    fill:   var(--canvas-bg);
    stroke: none;
  }

  /* ═══════════════════════════════════════════════════
     AWS CONTAINERS
  ══════════════════════════════════════════════════ */
  .aws-container { fill: none; }

  .aws-vpc {
    fill:             var(--aws-vpc-bg);
    stroke:           var(--aws-vpc-border);
    stroke-dasharray: 10 5;
    stroke-width:     2px;
    filter:           url(#containerShadow);
  }
  .aws-az {
    fill:             var(--aws-az-bg);
    stroke:           var(--aws-az-border);
    stroke-dasharray: 6 4;
    stroke-width:     1.5px;
  }
  .aws-subnet-public {
    fill:             var(--aws-pub-bg);
    stroke:           var(--aws-pub-border);
    stroke-dasharray: 5 3;
    stroke-width:     1.5px;
  }
  .aws-subnet-private {
    fill:             var(--aws-priv-bg);
    stroke:           var(--aws-priv-border);
    stroke-dasharray: 5 3;
    stroke-width:     1.5px;
  }
  .aws-compute-cluster {
    fill:             var(--aws-cluster-bg);
    stroke:           var(--aws-cluster-border);
    stroke-dasharray: 6 3;
    stroke-width:     2px;
    filter:           url(#containerShadow);
  }

  /* AWS Typography */
  .aws-container-label {
    font-family:    var(--font-aws);
    font-size:      11px;
    font-weight:    700;
    fill:           var(--text-900);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .aws-node-label {
    font-family: var(--font-aws);
    font-size:   10px;
    font-weight: 500;
    fill:        var(--text-600);
  }
  .aws-edge {
    stroke:         var(--aws-edge);
    stroke-width:   1.5px;
    stroke-opacity: 0.85;
    fill:           none;
  }

  /* ── GCP CONTAINERS ── */
  .gcp-vpc {
    fill:             var(--gcp-vpc-bg);
    stroke:           var(--gcp-vpc-border);
    stroke-dasharray: 10 5;
    stroke-width:     2px;
    filter:           url(#containerShadow);
  }
  .gcp-region {
    fill:             var(--gcp-region-bg);
    stroke:           var(--gcp-region-border);
    stroke-dasharray: 6 3;
    stroke-width:     2px;
  }
  .gcp-zone {
    fill:             var(--gcp-zone-bg);
    stroke:           var(--gcp-zone-border);
    stroke-dasharray: 4 4;
    stroke-width:     1.2px;
  }
  .gcp-subnet {
    fill:             var(--gcp-subnet-bg);
    stroke:           var(--gcp-subnet-border);
    stroke-width:     1.5px;
  }
  .gcp-compute-cluster {
    fill:             var(--gcp-cluster-bg);
    stroke:           var(--gcp-cluster-border);
    stroke-dasharray: 5 3;
    stroke-width:     2px;
    filter:           url(#containerShadow);
  }

  /* GCP Typography */
  .gcp-container-label {
    font-family:    var(--font-gcp);
    font-size:      11px;
    font-weight:    700;
    fill:           var(--text-900);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .gcp-node-label {
    font-family: var(--font-gcp);
    font-size:   10px;
    font-weight: 400;
    fill:        var(--text-600);
  }
  .gcp-edge {
    stroke:         var(--gcp-edge);
    stroke-width:   1.5px;
    stroke-opacity: 0.75;
    fill:           none;
  }

  /* ── Azure Containers ── */
  .azure-rg {
    fill:             var(--azure-rg-bg);
    stroke:           var(--azure-rg-border);
    stroke-dasharray: 10 5;
    stroke-width:     2px;
    filter:           url(#containerShadow);
  }
  .azure-subscription {
    fill:             var(--azure-vnet-bg);
    stroke:           var(--azure-vnet-border);
    stroke-dasharray: 6 3;
    stroke-width:     2px;
  }
  .azure-container {
    fill:             var(--azure-subnet-bg);
    stroke:           var(--azure-subnet-border);
    stroke-dasharray: 5 3;
    stroke-width:     1.5px;
  }
  .azure-compute-cluster {
    fill:             var(--azure-cluster-bg);
    stroke:           var(--azure-cluster-border);
    stroke-dasharray: 5 3;
    stroke-width:     2px;
    filter:           url(#containerShadow);
  }

  /* Azure Typography */
  .azure-container-label {
    font-family:    var(--font-azure);
    font-size:      11px;
    font-weight:    700;
    fill:           var(--text-900);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .azure-node-label {
    font-family: var(--font-azure);
    font-size:   10px;
    font-weight: 400;
    fill:        var(--text-600);
  }
  .azure-edge {
    stroke:         var(--azure-edge);
    stroke-width:   1.5px;
    stroke-opacity: 0.70;
    fill:           none;
  }

  /* ── SERVICE NODE CARDS ── */
  .node-card {
    fill:   var(--card-bg);
    stroke: var(--card-border);
    stroke-width: 1px;
    filter: url(#nodeShadow);
  }
  .node-icon-bg {
    fill:   #F7FAFC;
    stroke: none;
  }

  /* ── COMPLIANCE ── */
  .compliance-ok {
    stroke:       var(--ok-color) !important;
    stroke-width: 2px !important;
  }
  .compliance-fail {
    stroke:       var(--fail-color) !important;
    stroke-width: 2px !important;
  }

  /* ── COST BADGE ── */
  .cost-badge-bg {
    fill:   #1E293B;
    rx:     4px;
  }
  .cost-badge-text {
    font-family: var(--font-aws);
    font-size:   9px;
    font-weight: 600;
    fill:        #FFFFFF;
  }

  /* ── Legend ── */
  .legend-box {
    fill:   #FFFFFF;
    stroke: #CBD5E1;
    stroke-width: 1px;
    rx:     6px;
  }
  .legend-title {
    font-family: var(--font-aws);
    font-size:   12px;
    font-weight: 700;
    fill:        #0F172A;
  }
  .legend-item-text {
    font-family: var(--font-aws);
    font-size:   10px;
    font-weight: 500;
    fill:        #475569;
  }
  .edge-label {
    font-family: var(--font-aws);
    font-size:   9px;
    font-weight: 500;
    fill:        #475569;
    paint-order: stroke;
    stroke:      #EEF2F7;
    stroke-width: 4px;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .content-box {
      fill: #fff;
      stroke: #c8c8c8;
      stroke-width: 1;
  }
  
  .contents {
      font-size: 11px;
      fill: #444;
      font-family: Arial, sans-serif;
  }
`;

function getProvider(node: ElkNode): 'aws' | 'gcp' | 'azure' {
  const cssClass = (node.properties?.cssClass as string) || '';
  if (cssClass.startsWith('gcp-')) return 'gcp';
  if (cssClass.startsWith('azure-')) return 'azure';
  if (cssClass.startsWith('aws-')) return 'aws';

  if (node.children) {
    for (const child of node.children) {
      const p = getProvider(child);
      if (p !== 'aws') return p;
    }
  }
  return 'aws';
}

const STRUCTURAL_CLASS_TOKENS = new Set([
  'aws-az',
  'aws-vpc',
  'aws-subnet',
  'aws-subnet-private',
  'aws-subnet-public',
  'gcp-region',
  'gcp-zone',
  'gcp-vpc',
  'gcp-subnet',
  'azure-subscription',
  'azure-rg',
  'azure-vnet',
  'azure-subnet',
]);

const ZONE_CLASS_TOKENS = new Set(['aws-az', 'gcp-zone']);

const hasCssClassToken = (node: ElkNode, tokens: Set<string>) => {
  const cssClass = node.properties?.cssClass;
  if (typeof cssClass !== 'string') return false;
  return cssClass.split(/\s+/).some((token) => tokens.has(token));
};
function calculateLabelDimensions(
  label: string | undefined,
  availableWidth: number
) {
  const safeLabel = label || '';
  const PILL_LABEL_CHAR_WIDTH = 7.5;
  const PILL_LABEL_PADDING = 40;

  const maxLabelW = Math.min(
    availableWidth - 56,
    safeLabel.length * PILL_LABEL_CHAR_WIDTH + PILL_LABEL_PADDING
  );
  const maxChars = Math.floor(
    (maxLabelW - PILL_LABEL_PADDING) / PILL_LABEL_CHAR_WIDTH
  );
  const displayLabel =
    safeLabel.length > maxChars + 2
      ? safeLabel.substring(0, maxChars).trim() + '…'
      : safeLabel;

  const actualLabelW =
    displayLabel.length * PILL_LABEL_CHAR_WIDTH + PILL_LABEL_PADDING;

  return { displayLabel, actualLabelW };
}

function getUniqueIconPaths(root: ElkNode): string[] {
  const iconPaths = new Set<string>();

  function traverse(node: ElkNode): void {
    const iconPath = node.properties?.iconPath;

    if (iconPath) {
      iconPaths.add(iconPath);
    }

    for (const child of node.children ?? []) {
      traverse(child);
    }
  }

  traverse(root);

  return [...iconPaths];
}

async function buildIconDataUriMap(
  iconPaths: string[],
  iconResolver: (path: string) => Promise<string | null>
): Promise<Map<string, string>> {
  const iconMap = new Map<string, string>();
  await Promise.all(
    iconPaths.map(async (path) => {
      try {
        const dataUri = await iconResolver(path);

        if (dataUri) {
          iconMap.set(path, dataUri);
        }
      } catch (e) {
        console.warn(`Failed to resolve icon: ${path}`, e);
      }
    })
  );

  return iconMap;
}

function simplifyOrthogonalPoints(points: { x: number; y: number }[]) {
  const deduped = points.filter((point, index) => {
    const prev = points[index - 1];
    return !prev || prev.x !== point.x || prev.y !== point.y;
  });

  return deduped.filter((point, index) => {
    const prev = deduped[index - 1];
    const next = deduped[index + 1];
    if (!prev || !next) return true;
    const sameVertical = prev.x === point.x && point.x === next.x;
    const sameHorizontal = prev.y === point.y && point.y === next.y;
    if (!sameVertical && !sameHorizontal) return true;
    return !isBetween(prev, point, next);
  });
}

function isBetween(
  prev: { x: number; y: number },
  point: { x: number; y: number },
  next: { x: number; y: number }
) {
  return (
    point.x >= Math.min(prev.x, next.x) &&
    point.x <= Math.max(prev.x, next.x) &&
    point.y >= Math.min(prev.y, next.y) &&
    point.y <= Math.max(prev.y, next.y)
  );
}

type RoutingObstacle = {
  id?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  isLeaf?: boolean;
};

function routeOrthogonalGlobalEdge(
  startPoint: { x: number; y: number },
  endPoint: { x: number; y: number },
  startStub: { x: number; y: number },
  endStub: { x: number; y: number },
  startSide: OrthogonalSide,
  endSide: OrthogonalSide,
  endpointBoxes: Array<{ x: number; y: number; w: number; h: number }>,
  obstacles: RoutingObstacle[],
  preferVertical: boolean,
  verticalTracks: Map<number, number>,
  horizontalTracks: Map<number, number>,
  routedSegments: Array<{
    a: { x: number; y: number };
    b: { x: number; y: number };
  }>
) {
  const margin = 28;
  const preferredVerticalTrack = (startStub.x + endStub.x) / 2;
  const preferredHorizontalTrack = (startStub.y + endStub.y) / 2;

  const xTracks = buildOrthogonalTrackCandidates(
    preferredVerticalTrack,
    'x',
    obstacles,
    verticalTracks,
    margin
  );
  const yTracks = buildOrthogonalTrackCandidates(
    preferredHorizontalTrack,
    'y',
    obstacles,
    horizontalTracks,
    margin
  );

  const routeOptions: Array<{
    points: { x: number; y: number }[];
    xTrack?: number;
    yTrack?: number;
    bends: number;
  }> = [];
  const startVertical = isVerticalOrthogonalSide(startSide);
  const endVertical = isVerticalOrthogonalSide(endSide);

  if (startVertical && !endVertical) {
    for (const yTrack of yTracks) {
      routeOptions.push({
        points: [
          startPoint,
          startStub,
          { x: startStub.x, y: yTrack },
          { x: endStub.x, y: yTrack },
          endStub,
          endPoint,
        ],
        yTrack,
        bends: 2,
      });
    }
  } else if (!startVertical && endVertical) {
    for (const xTrack of xTracks) {
      routeOptions.push({
        points: [
          startPoint,
          startStub,
          { x: xTrack, y: startStub.y },
          { x: xTrack, y: endStub.y },
          endStub,
          endPoint,
        ],
        xTrack,
        bends: 2,
      });
    }
  }

  if (preferVertical) {
    for (const yTrack of yTracks) {
      routeOptions.push({
        points: [
          startPoint,
          startStub,
          { x: startStub.x, y: yTrack },
          { x: endStub.x, y: yTrack },
          endStub,
          endPoint,
        ],
        yTrack,
        bends: 2,
      });
    }
  } else {
    for (const xTrack of xTracks) {
      routeOptions.push({
        points: [
          startPoint,
          startStub,
          { x: xTrack, y: startStub.y },
          { x: xTrack, y: endStub.y },
          endStub,
          endPoint,
        ],
        xTrack,
        bends: 2,
      });
    }
  }

  for (const yTrack of yTracks) {
    for (const xTrack of xTracks) {
      routeOptions.push(
        preferVertical
          ? {
              points: [
                startPoint,
                startStub,
                { x: startStub.x, y: yTrack },
                { x: xTrack, y: yTrack },
                { x: xTrack, y: endStub.y },
                endStub,
                endPoint,
              ],
              xTrack,
              yTrack,
              bends: 4,
            }
          : {
              points: [
                startPoint,
                startStub,
                { x: xTrack, y: startStub.y },
                { x: xTrack, y: yTrack },
                { x: endStub.x, y: yTrack },
                endStub,
                endPoint,
              ],
              xTrack,
              yTrack,
              bends: 4,
            }
      );
    }
  }

  const scoredRoutes = routeOptions
    .map((option, index) => {
      const points = simplifyOrthogonalPoints(
        option.points.map((point) => ({
          x: point.x,
          y: point.y,
        }))
      );
      return {
        ...option,
        index,
        points,
        length: orthogonalPathLength(points),
        approachViolations: countOrthogonalEndpointApproachViolations(
          points,
          startSide,
          endSide
        ),
        endpointCrossings: countEndpointBoxReentry(points, endpointBoxes),
        collisions: countOrthogonalRouteCollisions(points, obstacles, margin),
        containerIntrusion: countOrthogonalContainerIntrusion(
          points,
          obstacles
        ),
        endpointClearance: countOrthogonalEndpointClearanceIssues(
          points,
          endpointBoxes
        ),
        conflicts: countOrthogonalRouteSegmentConflicts(points, routedSegments),
        earlyTurns: countEarlyOrthogonalTurns(points),
      };
    })
    .sort((a, b) => {
      if (a.collisions !== b.collisions) return a.collisions - b.collisions;
      if (a.approachViolations !== b.approachViolations) {
        return a.approachViolations - b.approachViolations;
      }
      if (a.endpointCrossings !== b.endpointCrossings) {
        return a.endpointCrossings - b.endpointCrossings;
      }
      if (a.containerIntrusion !== b.containerIntrusion) {
        return a.containerIntrusion - b.containerIntrusion;
      }
      if (a.endpointClearance !== b.endpointClearance) {
        return a.endpointClearance - b.endpointClearance;
      }
      if (a.conflicts !== b.conflicts) return a.conflicts - b.conflicts;
      if (a.earlyTurns !== b.earlyTurns) return a.earlyTurns - b.earlyTurns;
      if (a.bends !== b.bends) return a.bends - b.bends;
      if (a.length !== b.length) return a.length - b.length;
      return a.index - b.index;
    });

  const best = scoredRoutes[0]?.points ?? [
    startPoint,
    startStub,
    endStub,
    endPoint,
  ];
  const selected = scoredRoutes[0];
  if (selected?.xTrack !== undefined) {
    markOrthogonalTrack(selected.xTrack, verticalTracks);
  }
  if (selected?.yTrack !== undefined) {
    markOrthogonalTrack(selected.yTrack, horizontalTracks);
  }

  return simplifyOrthogonalPoints(
    best.map((point) => ({
      x: point.x,
      y: point.y,
    }))
  ).slice(1, -1);
}

function routeMinimalOrthogonalEdge(
  startPoint: { x: number; y: number },
  endPoint: { x: number; y: number },
  startStub: { x: number; y: number },
  endStub: { x: number; y: number },
  endpointBoxes: Array<{ x: number; y: number; w: number; h: number }>,
  leafObstacles: RoutingObstacle[],
  activeObstacles: RoutingObstacle[],
  routedSegments: Array<{
    a: { x: number; y: number };
    b: { x: number; y: number };
  }>
) {
  const yLanes = new Set<number>([
    snapOrthogonalTrack(startStub.y),
    snapOrthogonalTrack(endStub.y),
  ]);
  const xLanes = new Set<number>([
    snapOrthogonalTrack(startStub.x),
    snapOrthogonalTrack(endStub.x),
  ]);
  const laneGap = 32;

  for (const baseY of [startStub.y, endStub.y]) {
    for (let i = 1; i <= 4; i++) {
      yLanes.add(snapOrthogonalTrack(baseY + i * laneGap));
      yLanes.add(snapOrthogonalTrack(baseY - i * laneGap));
    }
  }
  for (const baseX of [startStub.x, endStub.x]) {
    for (let i = 1; i <= 4; i++) {
      xLanes.add(snapOrthogonalTrack(baseX + i * laneGap));
      xLanes.add(snapOrthogonalTrack(baseX - i * laneGap));
    }
  }

  for (const obstacle of leafObstacles) {
    yLanes.add(snapOrthogonalTrack(obstacle.y - 28));
    yLanes.add(snapOrthogonalTrack(obstacle.y + obstacle.h + 28));
    xLanes.add(snapOrthogonalTrack(obstacle.x - 28));
    xLanes.add(snapOrthogonalTrack(obstacle.x + obstacle.w + 28));
  }

  for (const box of endpointBoxes) {
    yLanes.add(snapOrthogonalTrack(box.y - 36));
    yLanes.add(snapOrthogonalTrack(box.y + box.h + 36));
    xLanes.add(snapOrthogonalTrack(box.x - 36));
    xLanes.add(snapOrthogonalTrack(box.x + box.w + 36));
  }

  const candidates: { points: { x: number; y: number }[]; index: number }[] =
    [];
  const addCandidate = (points: { x: number; y: number }[]) => {
    candidates.push({ points, index: candidates.length });
  };

  addCandidate([
    startPoint,
    startStub,
    { x: endStub.x, y: startStub.y },
    endStub,
    endPoint,
  ]);
  addCandidate([
    startPoint,
    startStub,
    { x: startStub.x, y: endStub.y },
    endStub,
    endPoint,
  ]);

  for (const laneY of yLanes) {
    addCandidate([
      startPoint,
      startStub,
      { x: startStub.x, y: laneY },
      { x: endStub.x, y: laneY },
      endStub,
      endPoint,
    ]);
  }

  for (const laneX of xLanes) {
    addCandidate([
      startPoint,
      startStub,
      { x: laneX, y: startStub.y },
      { x: laneX, y: endStub.y },
      endStub,
      endPoint,
    ]);
  }

  for (const laneY of yLanes) {
    for (const laneX of xLanes) {
      addCandidate([
        startPoint,
        startStub,
        { x: startStub.x, y: laneY },
        { x: laneX, y: laneY },
        { x: laneX, y: endStub.y },
        endStub,
        endPoint,
      ]);
      addCandidate([
        startPoint,
        startStub,
        { x: laneX, y: startStub.y },
        { x: laneX, y: laneY },
        { x: endStub.x, y: laneY },
        endStub,
        endPoint,
      ]);
    }
  }

  const best = candidates
    .map((candidate) => {
      const points = simplifyOrthogonalPoints(candidate.points);
      return {
        ...candidate,
        points,
        leafCollisions: countOrthogonalRouteCollisions(
          points,
          leafObstacles,
          18
        ),
        containerCollisions: countOrthogonalRouteCollisions(
          points,
          activeObstacles.filter((obstacle) => !obstacle.isLeaf),
          12
        ),
        endpointReentry: countEndpointBoxReentry(points, endpointBoxes),
        conflicts: countOrthogonalRouteSegmentConflicts(points, routedSegments),
        length: orthogonalPathLength(points),
        bends: Math.max(0, points.length - 2),
      };
    })
    .sort((a, b) => {
      if (a.leafCollisions !== b.leafCollisions) {
        return a.leafCollisions - b.leafCollisions;
      }
      if (a.endpointReentry !== b.endpointReentry) {
        return a.endpointReentry - b.endpointReentry;
      }
      if (a.containerCollisions !== b.containerCollisions) {
        return a.containerCollisions - b.containerCollisions;
      }
      if (a.conflicts !== b.conflicts) return a.conflicts - b.conflicts;
      if (a.bends !== b.bends) return a.bends - b.bends;
      if (a.length !== b.length) return a.length - b.length;
      return a.index - b.index;
    })[0];

  if (!best || best.leafCollisions > 0 || best.endpointReentry > 0) {
    return undefined;
  }

  return best.points.slice(1, -1);
}

function countEndpointBoxReentry(
  points: { x: number; y: number }[],
  endpointBoxes: Array<{ x: number; y: number; w: number; h: number }>
) {
  let crossings = 0;
  for (let i = 1; i < points.length - 2; i++) {
    for (const box of endpointBoxes) {
      if (orthogonalSegmentIntersectsBox(points[i], points[i + 1], box, 0)) {
        crossings += 100;
      }
    }
  }
  return crossings;
}

function countOrthogonalEndpointClearanceIssues(
  points: { x: number; y: number }[],
  endpointBoxes: Array<{ x: number; y: number; w: number; h: number }>
) {
  const minimumClearance = 40;
  let issues = 0;

  for (let i = 2; i < points.length - 3; i++) {
    for (const box of endpointBoxes) {
      issues += orthogonalSegmentBoxClearancePenalty(
        points[i],
        points[i + 1],
        box,
        minimumClearance
      );
    }
  }

  return issues;
}

function countOrthogonalContainerIntrusion(
  points: { x: number; y: number }[],
  obstacles: RoutingObstacle[]
) {
  const clearance = 36;
  let score = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    for (const obstacle of obstacles) {
      if (obstacle.isLeaf) continue;
      score += orthogonalSegmentBoxClearancePenalty(a, b, obstacle, clearance);
    }
  }

  return score;
}

function orthogonalSegmentBoxClearancePenalty(
  a: { x: number; y: number },
  b: { x: number; y: number },
  box: { x: number; y: number; w: number; h: number },
  minimumClearance: number
) {
  const left = box.x;
  const right = box.x + box.w;
  const top = box.y;
  const bottom = box.y + box.h;

  if (a.x === b.x) {
    const overlap = rangeOverlap(a.y, b.y, top, bottom);
    if (overlap <= 0) return 0;

    const distance = a.x < left ? left - a.x : a.x > right ? a.x - right : 0;
    if (distance >= minimumClearance) return 0;
    return (minimumClearance - distance) * Math.max(1, overlap / 10);
  }

  if (a.y === b.y) {
    const overlap = rangeOverlap(a.x, b.x, left, right);
    if (overlap <= 0) return 0;

    const distance = a.y < top ? top - a.y : a.y > bottom ? a.y - bottom : 0;
    if (distance >= minimumClearance) return 0;
    return (minimumClearance - distance) * Math.max(1, overlap / 10);
  }

  return minimumClearance * 10;
}

function countOrthogonalEndpointApproachViolations(
  points: { x: number; y: number }[],
  startSide: OrthogonalSide,
  endSide: OrthogonalSide
) {
  if (points.length < 4) return 0;

  const startViolation = endpointApproachViolation(
    points[1],
    points[2],
    startSide,
    true
  );
  const endViolation = endpointApproachViolation(
    points[points.length - 2],
    points[points.length - 3],
    endSide,
    false
  );
  return startViolation + endViolation;
}

function endpointApproachViolation(
  stub: { x: number; y: number },
  next: { x: number; y: number },
  side: OrthogonalSide,
  isSource: boolean
) {
  if (side === 'top') {
    return next.y <= stub.y || next.y === stub.y ? 0 : isSource ? 1 : 10;
  }
  if (side === 'bottom') {
    return next.y >= stub.y || next.y === stub.y ? 0 : isSource ? 1 : 10;
  }
  if (side === 'left') {
    return next.x <= stub.x || next.x === stub.x ? 0 : isSource ? 1 : 10;
  }
  return next.x >= stub.x || next.x === stub.x ? 0 : isSource ? 1 : 10;
}

function countOrthogonalRouteSegmentConflicts(
  points: { x: number; y: number }[],
  routedSegments: Array<{
    a: { x: number; y: number };
    b: { x: number; y: number };
  }>
) {
  let conflicts = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const current = { a: points[i], b: points[i + 1] };
    for (const routed of routedSegments) {
      conflicts += orthogonalSegmentConflictScore(current, routed);
    }
  }
  return conflicts;
}

function orthogonalSegmentConflictScore(
  current: { a: { x: number; y: number }; b: { x: number; y: number } },
  routed: { a: { x: number; y: number }; b: { x: number; y: number } }
) {
  const currentVertical = current.a.x === current.b.x;
  const routedVertical = routed.a.x === routed.b.x;
  if (currentVertical !== routedVertical) return 0;

  if (currentVertical) {
    const distance = Math.abs(current.a.x - routed.a.x);
    const overlap = rangeOverlap(
      current.a.y,
      current.b.y,
      routed.a.y,
      routed.b.y
    );
    if (overlap <= 0) return 0;
    if (distance === 0) return overlap * 20;
    if (distance < 28) return overlap * 6;
    return 0;
  }

  const distance = Math.abs(current.a.y - routed.a.y);
  const overlap = rangeOverlap(
    current.a.x,
    current.b.x,
    routed.a.x,
    routed.b.x
  );
  if (overlap <= 0) return 0;
  if (distance === 0) return overlap * 20;
  if (distance < 28) return overlap * 6;
  return 0;
}

function appendOrthogonalSegments(
  points: { x: number; y: number }[],
  routedSegments: Array<{
    a: { x: number; y: number };
    b: { x: number; y: number };
  }>
) {
  for (let i = 0; i < points.length - 1; i++) {
    routedSegments.push({ a: points[i], b: points[i + 1] });
  }
}

function rangeOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
) {
  const aMin = Math.min(aStart, aEnd);
  const aMax = Math.max(aStart, aEnd);
  const bMin = Math.min(bStart, bEnd);
  const bMax = Math.max(bStart, bEnd);
  return Math.max(0, Math.min(aMax, bMax) - Math.max(aMin, bMin));
}

function buildOrthogonalTrackCandidates(
  preferred: number,
  axis: 'x' | 'y',
  obstacles: { x: number; y: number; w: number; h: number }[],
  tracks: Map<number, number>,
  margin: number
) {
  const values = new Set<number>();
  const snappedPreferred = snapOrthogonalTrack(preferred);
  const usage = tracks.get(snappedPreferred) || 0;
  const gap = 24;

  values.add(snappedPreferred);
  for (let i = 1; i <= 8; i++) {
    values.add(snappedPreferred + i * gap);
    values.add(snappedPreferred - i * gap);
  }
  if (usage > 0) {
    values.add(snappedPreferred + Math.ceil(usage / 2) * gap);
    values.add(snappedPreferred - Math.ceil(usage / 2) * gap);
  }

  for (const obstacle of obstacles) {
    if (axis === 'x') {
      values.add(snapOrthogonalTrack(obstacle.x - margin - 10));
      values.add(snapOrthogonalTrack(obstacle.x - margin - 70));
      values.add(snapOrthogonalTrack(obstacle.x + obstacle.w + margin + 10));
      values.add(snapOrthogonalTrack(obstacle.x + obstacle.w + margin + 70));
    } else {
      values.add(snapOrthogonalTrack(obstacle.y - margin - 10));
      values.add(snapOrthogonalTrack(obstacle.y - margin - 70));
      values.add(snapOrthogonalTrack(obstacle.y + obstacle.h + margin + 10));
      values.add(snapOrthogonalTrack(obstacle.y + obstacle.h + margin + 70));
    }
  }

  return [...values].sort((a, b) => {
    const distance = Math.abs(a - preferred) - Math.abs(b - preferred);
    return distance || a - b;
  });
}

function countOrthogonalRouteCollisions(
  points: { x: number; y: number }[],
  obstacles: { x: number; y: number; w: number; h: number }[],
  margin: number
) {
  let collisions = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (a.x !== b.x && a.y !== b.y) {
      collisions += 10;
      continue;
    }

    for (const obstacle of obstacles) {
      if (orthogonalSegmentIntersectsBox(a, b, obstacle, margin)) {
        collisions++;
      }
    }
  }
  return collisions;
}

// Minimum clearance a routed edge must keep from a container's title-pill
// label. Shared by the port-stub computation (which decides where an edge
// leaves/enters a container that has a pill) and the repair pass below (which
// nudges an edge sideways if it still ends up too close) so the two agree on
// what "clear" means instead of the stub landing exactly on the boundary the
// repair pass treats as a collision.
const ORTHOGONAL_TITLE_PILL_CLEARANCE = 8;

function repairOrthogonalTitlePillCollisions(
  points: { x: number; y: number }[],
  titlePills: { x: number; y: number; w: number; h: number }[],
  obstacles: RoutingObstacle[],
  routedSegments: Array<{
    a: { x: number; y: number };
    b: { x: number; y: number };
  }>
) {
  let repaired = simplifyOrthogonalPoints(points);
  const gateClearance = 64;
  const pillClearance = ORTHOGONAL_TITLE_PILL_CLEARANCE;

  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    const next: { x: number; y: number }[] = [repaired[0]];

    for (let i = 0; i < repaired.length - 1; i++) {
      const a = next[next.length - 1];
      const b = repaired[i + 1];
      const isEndpointApproach = i === 0 || i === repaired.length - 2;
      const hit = titlePills.find((pill) =>
        orthogonalSegmentIntersectsBox(a, b, pill, pillClearance)
      );

      if (!hit || isEndpointApproach) {
        next.push(b);
        continue;
      }

      changed = true;
      if (a.x === b.x) {
        const gateX = chooseTitlePillRepairPath(
          [
            snapOrthogonalTrack(hit.x + hit.w + gateClearance),
            snapOrthogonalTrack(hit.x - gateClearance),
          ].map((x) => [{ x, y: a.y }, { x, y: b.y }, b]),
          a,
          obstacles,
          routedSegments
        )[0].x;
        next.push({ x: gateX, y: a.y }, { x: gateX, y: b.y }, b);
      } else {
        const gateY = chooseTitlePillRepairPath(
          [
            snapOrthogonalTrack(hit.y + hit.h + gateClearance),
            snapOrthogonalTrack(hit.y - gateClearance),
          ].map((y) => [{ x: a.x, y }, { x: b.x, y }, b]),
          a,
          obstacles,
          routedSegments
        )[0].y;
        next.push({ x: a.x, y: gateY }, { x: b.x, y: gateY }, b);
      }
    }

    repaired = simplifyOrthogonalPoints(next);
    if (!changed) break;
  }

  return repaired;
}

function chooseTitlePillRepairPath(
  candidates: { x: number; y: number }[][],
  start: { x: number; y: number },
  obstacles: RoutingObstacle[],
  routedSegments: Array<{
    a: { x: number; y: number };
    b: { x: number; y: number };
  }>
) {
  return [...candidates].sort((left, right) => {
    const leftPoints = [start, ...left];
    const rightPoints = [start, ...right];
    const leftCollisions = countOrthogonalRouteCollisions(
      leftPoints,
      obstacles,
      18
    );
    const rightCollisions = countOrthogonalRouteCollisions(
      rightPoints,
      obstacles,
      18
    );
    if (leftCollisions !== rightCollisions) {
      return leftCollisions - rightCollisions;
    }

    const conflictDelta =
      countOrthogonalRouteSegmentConflicts(leftPoints, routedSegments) -
      countOrthogonalRouteSegmentConflicts(rightPoints, routedSegments);
    if (conflictDelta !== 0) return conflictDelta;
    return orthogonalPathLength(leftPoints) - orthogonalPathLength(rightPoints);
  })[0];
}

function repairOrthogonalLeafCollisions(
  points: { x: number; y: number }[],
  leafObstacles: RoutingObstacle[],
  endpointBoxes: Array<{ x: number; y: number; w: number; h: number }>,
  routedSegments: Array<{
    a: { x: number; y: number };
    b: { x: number; y: number };
  }>
) {
  let repaired = simplifyOrthogonalPoints(points);
  const clearance = 36;

  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    const next: { x: number; y: number }[] = [repaired[0]];

    for (let i = 0; i < repaired.length - 1; i++) {
      const a = next[next.length - 1];
      const b = repaired[i + 1];
      const hit = leafObstacles.find((obstacle) =>
        orthogonalSegmentIntersectsBox(a, b, obstacle, 18)
      );

      if (!hit) {
        next.push(b);
        continue;
      }

      changed = true;
      if (a.x === b.x) {
        const candidates = [
          snapOrthogonalTrack(hit.x - clearance),
          snapOrthogonalTrack(hit.x + hit.w + clearance),
        ].map((x) => [{ x, y: a.y }, { x, y: b.y }, b]);
        next.push(
          ...chooseLeafRepairPath(
            a,
            candidates,
            leafObstacles,
            endpointBoxes,
            routedSegments
          )
        );
      } else {
        const candidates = [
          snapOrthogonalTrack(hit.y - clearance),
          snapOrthogonalTrack(hit.y + hit.h + clearance),
        ].map((y) => [{ x: a.x, y }, { x: b.x, y }, b]);
        next.push(
          ...chooseLeafRepairPath(
            a,
            candidates,
            leafObstacles,
            endpointBoxes,
            routedSegments
          )
        );
      }
    }

    repaired = simplifyOrthogonalPoints(next);
    if (!changed) break;
  }

  return repaired;
}

function chooseLeafRepairPath(
  start: { x: number; y: number },
  candidates: { x: number; y: number }[][],
  leafObstacles: RoutingObstacle[],
  endpointBoxes: Array<{ x: number; y: number; w: number; h: number }>,
  routedSegments: Array<{
    a: { x: number; y: number };
    b: { x: number; y: number };
  }>
) {
  return [...candidates].sort((left, right) => {
    const leftPoints = [start, ...left];
    const rightPoints = [start, ...right];
    const leftLeafCollisions = countOrthogonalRouteCollisions(
      leftPoints,
      leafObstacles,
      18
    );
    const rightLeafCollisions = countOrthogonalRouteCollisions(
      rightPoints,
      leafObstacles,
      18
    );
    if (leftLeafCollisions !== rightLeafCollisions) {
      return leftLeafCollisions - rightLeafCollisions;
    }

    const leftEndpointReentry = countEndpointBoxReentry(
      leftPoints,
      endpointBoxes
    );
    const rightEndpointReentry = countEndpointBoxReentry(
      rightPoints,
      endpointBoxes
    );
    if (leftEndpointReentry !== rightEndpointReentry) {
      return leftEndpointReentry - rightEndpointReentry;
    }

    const conflictDelta =
      countOrthogonalRouteSegmentConflicts(leftPoints, routedSegments) -
      countOrthogonalRouteSegmentConflicts(rightPoints, routedSegments);
    if (conflictDelta !== 0) return conflictDelta;
    return orthogonalPathLength(leftPoints) - orthogonalPathLength(rightPoints);
  })[0];
}

function countOrthogonalTwists(points: { x: number; y: number }[]) {
  let twists = 0;
  for (let i = 0; i < points.length - 2; i++) {
    const a = points[i];
    const b = points[i + 1];
    const c = points[i + 2];
    const dx1 = Math.sign(b.x - a.x);
    const dy1 = Math.sign(b.y - a.y);
    const dx2 = Math.sign(c.x - b.x);
    const dy2 = Math.sign(c.y - b.y);
    if ((dx1 && dx2 && dx1 !== dx2) || (dy1 && dy2 && dy1 !== dy2)) {
      twists++;
    }
  }
  return twists;
}

function cleanupOrthogonalShortReversals(
  points: { x: number; y: number }[],
  leafObstacles: RoutingObstacle[],
  endpointBoxes: Array<{ x: number; y: number; w: number; h: number }>,
  routedSegments: Array<{
    a: { x: number; y: number };
    b: { x: number; y: number };
  }>
) {
  let cleaned = simplifyOrthogonalPoints(points);

  for (let pass = 0; pass < 4; pass++) {
    const currentMetrics = {
      leafCollisions: countOrthogonalRouteCollisions(
        cleaned,
        leafObstacles,
        18
      ),
      endpointReentry: countEndpointBoxReentry(cleaned, endpointBoxes),
      conflicts: countOrthogonalRouteSegmentConflicts(cleaned, routedSegments),
      twists: countOrthogonalTwists(cleaned),
    };
    if (currentMetrics.twists === 0) break;

    let accepted: { x: number; y: number }[] | undefined;
    for (let i = 1; i < cleaned.length - 1; i++) {
      const prev = cleaned[i - 1];
      const point = cleaned[i];
      const next = cleaned[i + 1];
      const horizontal = prev.y === point.y && point.y === next.y;
      const vertical = prev.x === point.x && point.x === next.x;
      if (!horizontal && !vertical) continue;

      const firstDirection = horizontal
        ? Math.sign(point.x - prev.x)
        : Math.sign(point.y - prev.y);
      const secondDirection = horizontal
        ? Math.sign(next.x - point.x)
        : Math.sign(next.y - point.y);
      if (
        !firstDirection ||
        !secondDirection ||
        firstDirection === secondDirection
      ) {
        continue;
      }

      const shortLeg = horizontal
        ? Math.min(Math.abs(point.x - prev.x), Math.abs(next.x - point.x))
        : Math.min(Math.abs(point.y - prev.y), Math.abs(next.y - point.y));
      if (shortLeg > 64) continue;

      const candidate = simplifyOrthogonalPoints([
        ...cleaned.slice(0, i),
        ...cleaned.slice(i + 1),
      ]);
      const candidateMetrics = {
        leafCollisions: countOrthogonalRouteCollisions(
          candidate,
          leafObstacles,
          18
        ),
        endpointReentry: countEndpointBoxReentry(candidate, endpointBoxes),
        conflicts: countOrthogonalRouteSegmentConflicts(
          candidate,
          routedSegments
        ),
        twists: countOrthogonalTwists(candidate),
      };

      if (
        candidateMetrics.twists < currentMetrics.twists &&
        candidateMetrics.leafCollisions <= currentMetrics.leafCollisions &&
        candidateMetrics.endpointReentry <= currentMetrics.endpointReentry &&
        candidateMetrics.conflicts <= currentMetrics.conflicts
      ) {
        accepted = candidate;
        break;
      }
    }

    if (!accepted) break;
    cleaned = accepted;
  }

  return cleaned;
}

function repairOrthogonalExactOverlaps(
  points: { x: number; y: number }[],
  routedSegments: Array<{
    a: { x: number; y: number };
    b: { x: number; y: number };
  }>,
  leafObstacles: RoutingObstacle[],
  endpointBoxes: Array<{ x: number; y: number; w: number; h: number }>
) {
  let repaired = simplifyOrthogonalPoints(points);
  const laneOffsets = [18, -18, 28, -28, 40, -40, 56, -56, 72, -72];

  for (let pass = 0; pass < 4; pass++) {
    const currentOverlap = countExactOrthogonalRouteOverlaps(
      repaired,
      routedSegments
    );
    if (currentOverlap === 0) break;

    let accepted: { x: number; y: number }[] | undefined;
    for (let i = 1; i < repaired.length - 2; i++) {
      const a = repaired[i];
      const b = repaired[i + 1];
      if (a.x !== b.x && a.y !== b.y) continue;
      if (countExactOrthogonalRouteOverlaps([a, b], routedSegments) === 0) {
        continue;
      }

      const candidates = laneOffsets.map((offset) => {
        if (a.x === b.x) {
          const x = snapOrthogonalTrack(a.x + offset);
          return simplifyOrthogonalPoints([
            ...repaired.slice(0, i + 1),
            { x, y: a.y },
            { x, y: b.y },
            ...repaired.slice(i + 1),
          ]);
        }

        const y = snapOrthogonalTrack(a.y + offset);
        return simplifyOrthogonalPoints([
          ...repaired.slice(0, i + 1),
          { x: a.x, y },
          { x: b.x, y },
          ...repaired.slice(i + 1),
        ]);
      });

      const best = candidates
        .map((candidate, index) => ({
          candidate,
          index,
          exactOverlaps: countExactOrthogonalRouteOverlaps(
            candidate,
            routedSegments
          ),
          leafCollisions: countOrthogonalRouteCollisions(
            candidate,
            leafObstacles,
            18
          ),
          endpointReentry: countEndpointBoxReentry(candidate, endpointBoxes),
          conflicts: countOrthogonalRouteSegmentConflicts(
            candidate,
            routedSegments
          ),
          twists: countOrthogonalTwists(candidate),
          length: orthogonalPathLength(candidate),
        }))
        .filter(
          (candidate) =>
            candidate.exactOverlaps < currentOverlap &&
            candidate.leafCollisions === 0 &&
            candidate.endpointReentry === 0
        )
        .sort((left, right) => {
          if (left.exactOverlaps !== right.exactOverlaps) {
            return left.exactOverlaps - right.exactOverlaps;
          }
          if (left.twists !== right.twists) return left.twists - right.twists;
          if (left.conflicts !== right.conflicts) {
            return left.conflicts - right.conflicts;
          }
          if (left.length !== right.length) return left.length - right.length;
          return left.index - right.index;
        })[0];

      if (best) {
        accepted = best.candidate;
        break;
      }
    }

    if (!accepted) break;
    repaired = accepted;
  }

  return repaired;
}

function countExactOrthogonalRouteOverlaps(
  points: { x: number; y: number }[],
  routedSegments: Array<{
    a: { x: number; y: number };
    b: { x: number; y: number };
  }>
) {
  let overlaps = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const current = { a: points[i], b: points[i + 1] };
    for (const routed of routedSegments) {
      if (exactOrthogonalSegmentOverlap(current, routed) > 8) overlaps++;
    }
  }
  return overlaps;
}

function exactOrthogonalSegmentOverlap(
  current: { a: { x: number; y: number }; b: { x: number; y: number } },
  routed: { a: { x: number; y: number }; b: { x: number; y: number } }
) {
  const currentVertical = current.a.x === current.b.x;
  const routedVertical = routed.a.x === routed.b.x;
  if (currentVertical !== routedVertical) return 0;

  if (currentVertical) {
    if (Math.abs(current.a.x - routed.a.x) >= 1.5) return 0;
    return rangeOverlap(current.a.y, current.b.y, routed.a.y, routed.b.y);
  }

  if (Math.abs(current.a.y - routed.a.y) >= 1.5) return 0;
  return rangeOverlap(current.a.x, current.b.x, routed.a.x, routed.b.x);
}

function orthogonalSegmentIntersectsBox(
  a: { x: number; y: number },
  b: { x: number; y: number },
  box: { x: number; y: number; w: number; h: number },
  margin: number
) {
  const left = box.x - margin;
  const right = box.x + box.w + margin;
  const top = box.y - margin;
  const bottom = box.y + box.h + margin;

  if (a.x === b.x) {
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    return a.x > left && a.x < right && maxY > top && minY < bottom;
  }

  if (a.y === b.y) {
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    return a.y > top && a.y < bottom && maxX > left && minX < right;
  }

  return true;
}

function orthogonalPathLength(points: { x: number; y: number }[]) {
  let length = 0;
  for (let i = 0; i < points.length - 1; i++) {
    length +=
      Math.abs(points[i].x - points[i + 1].x) +
      Math.abs(points[i].y - points[i + 1].y);
  }
  return length;
}

function markOrthogonalTrack(track: number, tracks: Map<number, number>) {
  const key = snapOrthogonalTrack(track);
  tracks.set(key, (tracks.get(key) || 0) + 1);
}

function snapOrthogonalTrack(value: number) {
  return Math.round(value / 10) * 10;
}

type OrthogonalSide = 'top' | 'right' | 'bottom' | 'left';
const ORTHOGONAL_SIDES: OrthogonalSide[] = ['top', 'right', 'bottom', 'left'];

function chooseOrthogonalSide(
  nodeId: string,
  preferred: OrthogonalSide,
  usage: Map<string, number>,
  connectionCount: number
) {
  const preferredUsage = usage.get(`${nodeId}:${preferred}`) || 0;
  const preferredCapacity = Math.max(2, Math.ceil(connectionCount / 2));
  if (connectionCount < 2 || preferredUsage <= preferredCapacity) {
    return preferred;
  }

  return [...ORTHOGONAL_SIDES].sort((a, b) => {
    const usageDelta =
      (usage.get(`${nodeId}:${a}`) || 0) - (usage.get(`${nodeId}:${b}`) || 0);
    if (usageDelta !== 0) return usageDelta;

    const preferenceDelta =
      orthogonalSideDistance(a, preferred) -
      orthogonalSideDistance(b, preferred);
    if (preferenceDelta !== 0) return preferenceDelta;

    return ORTHOGONAL_SIDES.indexOf(a) - ORTHOGONAL_SIDES.indexOf(b);
  })[0];
}

function isVerticalOrthogonalSide(side: OrthogonalSide) {
  return side === 'top' || side === 'bottom';
}

function countEarlyOrthogonalTurns(points: { x: number; y: number }[]) {
  if (points.length < 4) return 0;
  const minimumClearRun = 72;
  return (
    earlyOrthogonalTurnPenalty(points, minimumClearRun) +
    earlyOrthogonalTurnPenalty([...points].reverse(), minimumClearRun)
  );
}

function earlyOrthogonalTurnPenalty(
  points: { x: number; y: number }[],
  minimumClearRun: number
) {
  if (points.length < 3) return 0;
  const first = points[0];
  const second = points[1];
  const initialVertical = first.x === second.x;
  const initialHorizontal = first.y === second.y;
  if (!initialVertical && !initialHorizontal) return minimumClearRun * 8;

  let run = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const next = points[i];
    const sameDirection = initialVertical
      ? prev.x === next.x
      : prev.y === next.y;
    if (!sameDirection) break;
    run += Math.abs(prev.x - next.x) + Math.abs(prev.y - next.y);
  }

  return run >= minimumClearRun ? 0 : (minimumClearRun - run) * 8;
}

function orthogonalSideDistance(
  side: OrthogonalSide,
  preferred: OrthogonalSide
) {
  if (side === preferred) return 0;
  if (
    (side === 'top' && preferred === 'bottom') ||
    (side === 'bottom' && preferred === 'top') ||
    (side === 'left' && preferred === 'right') ||
    (side === 'right' && preferred === 'left')
  ) {
    return 2;
  }
  return 1;
}

function markOrthogonalSideUsage(
  nodeId: string,
  side: OrthogonalSide,
  usage: Map<string, number>
) {
  const key = `${nodeId}:${side}`;
  usage.set(key, (usage.get(key) || 0) + 1);
}

function markOrthogonalVisualPortUsage(
  nodeId: string,
  side: OrthogonalSide,
  usage: Map<string, number>
) {
  markOrthogonalSideUsage(nodeId, side, usage);
  const nodeKey = `${nodeId}:all`;
  usage.set(nodeKey, (usage.get(nodeKey) || 0) + 1);
}

function preferredOrthogonalSides(
  source: { x: number; y: number; w: number; h: number },
  target: { x: number; y: number; w: number; h: number },
  sourceBottom: number,
  targetTop: number
) {
  const sourceCx = source.x + source.w / 2;
  const sourceCy = source.y + source.h / 2;
  const targetCx = target.x + target.w / 2;
  const targetCy = target.y + target.h / 2;
  const isVertical =
    Math.abs(targetCx - sourceCx) < Math.abs(targetCy - sourceCy);

  if (isVertical) {
    return targetTop > sourceBottom - 10
      ? { sourceSide: 'bottom' as const, targetSide: 'top' as const }
      : { sourceSide: 'top' as const, targetSide: 'bottom' as const };
  }

  return targetCx > sourceCx
    ? { sourceSide: 'right' as const, targetSide: 'left' as const }
    : { sourceSide: 'left' as const, targetSide: 'right' as const };
}

function orthogonalSidePort(
  pos: {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    type?: string;
    label?: string;
  },
  side: OrthogonalSide,
  usage: Map<string, number>,
  topAdjust = 0
) {
  const key = `${pos.id}:${side}`;
  const count = usage.get(key) || 0;
  const nodeKey = `${pos.id}:all`;
  const nodeCount = usage.get(nodeKey) || 0;
  usage.set(key, count + 1);
  usage.set(nodeKey, nodeCount + 1);

  const offset = alternatingPortOffset(nodeCount);
  const inset = 16;
  const top = pos.y + topAdjust;
  const bottom = pos.y + pos.h;
  const left = pos.x;
  const right = pos.x + pos.w;

  if (side === 'left' || side === 'right') {
    const minY = Math.min(bottom - inset, top + inset);
    const maxY = Math.max(top + inset, bottom - inset);
    return {
      x: side === 'left' ? left : right,
      y: clamp(pos.y + pos.h / 2 + offset, minY, maxY),
      stubDistance: 20 + count * 16,
    };
  }

  const minX = Math.min(right - inset, left + inset);
  const maxX = Math.max(left + inset, right - inset);
  const x = clamp(pos.x + pos.w / 2 + offset, minX, maxX);
  const y = side === 'top' ? orthogonalTopPortY(pos, x, top) : bottom;

  return {
    x,
    y,
    stubDistance: 20 + count * 16,
  };
}

function chooseConflictAwareOrthogonalSides(
  source: {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    type?: string;
    label?: string;
  },
  target: {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    type?: string;
    label?: string;
  },
  preferredSourceSide: OrthogonalSide,
  preferredTargetSide: OrthogonalSide,
  visualPortUsage: Map<string, number>,
  activeObstacles: RoutingObstacle[],
  endpointBoxes: Array<{ x: number; y: number; w: number; h: number }>,
  routedSegments: Array<{
    a: { x: number; y: number };
    b: { x: number; y: number };
  }>,
  sourceTopAdjust: number,
  targetTopAdjust: number
) {
  const evaluateCandidate = (
    sourceSide: OrthogonalSide,
    targetSide: OrthogonalSide
  ) => {
    const usage = new Map(visualPortUsage);
    const sourcePort = orthogonalSidePort(
      source,
      sourceSide,
      usage,
      sourceTopAdjust
    );
    const targetPort = orthogonalSidePort(
      target,
      targetSide,
      usage,
      targetTopAdjust
    );
    const sourceStub = orthogonalStub(
      sourcePort,
      sourceSide,
      sourcePort.stubDistance
    );
    const targetStub = orthogonalStub(
      targetPort,
      targetSide,
      targetPort.stubDistance
    );
    const routeOptions = [
      simplifyOrthogonalPoints([
        sourcePort,
        sourceStub,
        { x: targetStub.x, y: sourceStub.y },
        targetStub,
        targetPort,
      ]),
      simplifyOrthogonalPoints([
        sourcePort,
        sourceStub,
        { x: sourceStub.x, y: targetStub.y },
        targetStub,
        targetPort,
      ]),
    ];
    const bestRoute = routeOptions
      .map((points) => ({
        points,
        collisions: countOrthogonalRouteCollisions(points, activeObstacles, 12),
        conflicts: countOrthogonalRouteSegmentConflicts(points, routedSegments),
        endpointReentry: countEndpointBoxReentry(points, endpointBoxes),
        endpointConflicts:
          countOrthogonalRouteSegmentConflicts(
            points.slice(0, 2),
            routedSegments
          ) +
          countOrthogonalRouteSegmentConflicts(
            points.slice(-2),
            routedSegments
          ),
        twists: countOrthogonalTwists(points),
        length: orthogonalPathLength(points),
      }))
      .sort((left, right) => {
        if (left.collisions !== right.collisions) {
          return left.collisions - right.collisions;
        }
        if (left.endpointReentry !== right.endpointReentry) {
          return left.endpointReentry - right.endpointReentry;
        }
        if (left.twists !== right.twists) return left.twists - right.twists;
        if (left.endpointConflicts !== right.endpointConflicts) {
          return left.endpointConflicts - right.endpointConflicts;
        }
        if (left.conflicts !== right.conflicts) {
          return left.conflicts - right.conflicts;
        }
        return left.length - right.length;
      })[0];

    const sideDistance =
      orthogonalSideDistance(sourceSide, preferredSourceSide) +
      orthogonalSideDistance(targetSide, preferredTargetSide);
    const sourceUsage = visualPortUsage.get(`${source.id}:${sourceSide}`) || 0;
    const targetUsage = visualPortUsage.get(`${target.id}:${targetSide}`) || 0;

    return {
      sourceSide,
      targetSide,
      sideDistance,
      sourceUsage,
      targetUsage,
      conflicts: bestRoute.conflicts,
      endpointConflicts: bestRoute.endpointConflicts,
      endpointReentry: bestRoute.endpointReentry,
      collisions: bestRoute.collisions,
      twists: bestRoute.twists,
      length: bestRoute.length,
    };
  };

  const horizontalLocalRelationship =
    (source.x + source.w <= target.x || target.x + target.w <= source.x) &&
    Math.max(source.y, target.y) <=
      Math.min(source.y + source.h, target.y + target.h);

  if (horizontalLocalRelationship) {
    return source.x + source.w <= target.x
      ? evaluateCandidate('right', 'left')
      : evaluateCandidate('left', 'right');
  }

  const preferred = evaluateCandidate(preferredSourceSide, preferredTargetSide);
  if (
    preferred.collisions === 0 &&
    preferred.endpointReentry === 0 &&
    preferred.endpointConflicts === 0
  ) {
    return preferred;
  }

  const candidates: Array<{
    sourceSide: OrthogonalSide;
    targetSide: OrthogonalSide;
    sideDistance: number;
    sourceUsage: number;
    targetUsage: number;
    conflicts: number;
    endpointConflicts: number;
    endpointReentry: number;
    collisions: number;
    twists: number;
    length: number;
  }> = [];

  for (const sourceSide of ORTHOGONAL_SIDES) {
    for (const targetSide of ORTHOGONAL_SIDES) {
      candidates.push(evaluateCandidate(sourceSide, targetSide));
    }
  }

  const best = candidates
    .filter(
      (candidate) =>
        candidate.collisions === 0 &&
        candidate.endpointReentry === 0 &&
        candidate.twists === 0 &&
        candidate.endpointConflicts < preferred.endpointConflicts
    )
    .sort((left, right) => {
      if (left.endpointConflicts !== right.endpointConflicts) {
        return left.endpointConflicts - right.endpointConflicts;
      }
      if (left.sideDistance !== right.sideDistance) {
        return left.sideDistance - right.sideDistance;
      }
      const usageDelta =
        left.sourceUsage +
        left.targetUsage -
        (right.sourceUsage + right.targetUsage);
      if (usageDelta !== 0) return usageDelta;
      if (left.conflicts !== right.conflicts) {
        return left.conflicts - right.conflicts;
      }
      return left.length - right.length;
    })[0];

  return best ?? preferred;
}

function orthogonalTopPortY(
  pos: { x: number; y: number; w: number; type?: string; label?: string },
  x: number,
  fallbackTop: number
) {
  if (pos.type !== 'container') return fallbackTop;

  const { actualLabelW } = calculateLabelDimensions(pos.label, pos.w);
  const pillLeft = pos.x + 16;
  const pillRight = pillLeft + actualLabelW;
  return x >= pillLeft - 5 && x <= pillRight + 5
    ? Math.min(fallbackTop, pos.y - 14)
    : fallbackTop;
}

function orthogonalStub(
  point: { x: number; y: number },
  side: OrthogonalSide,
  distance = 20
) {
  if (side === 'top') return { x: point.x, y: point.y - distance };
  if (side === 'bottom') return { x: point.x, y: point.y + distance };
  if (side === 'left') return { x: point.x - distance, y: point.y };
  return { x: point.x + distance, y: point.y };
}

function directOrthogonalConnection(
  source: {
    x: number;
    y: number;
    w: number;
    h: number;
    type?: string;
    label?: string;
  },
  target: {
    x: number;
    y: number;
    w: number;
    h: number;
    type?: string;
    label?: string;
  },
  sourceSide: OrthogonalSide,
  targetSide: OrthogonalSide,
  obstacles: { x: number; y: number; w: number; h: number }[]
) {
  const sourceCx = source.x + source.w / 2;
  const sourceCy = source.y + source.h / 2;
  const targetCx = target.x + target.w / 2;
  const targetCy = target.y + target.h / 2;
  const tolerance = 1;

  let startPoint: { x: number; y: number } | undefined;
  let endPoint: { x: number; y: number } | undefined;

  if (
    sourceSide === 'right' &&
    targetSide === 'left' &&
    source.x + source.w <= target.x &&
    Math.abs(sourceCy - targetCy) <= tolerance
  ) {
    startPoint = { x: source.x + source.w, y: sourceCy };
    endPoint = { x: target.x, y: targetCy };
  } else if (
    sourceSide === 'left' &&
    targetSide === 'right' &&
    target.x + target.w <= source.x &&
    Math.abs(sourceCy - targetCy) <= tolerance
  ) {
    startPoint = { x: source.x, y: sourceCy };
    endPoint = { x: target.x + target.w, y: targetCy };
  } else if (
    sourceSide === 'bottom' &&
    targetSide === 'top' &&
    source.y + source.h <= target.y &&
    Math.abs(sourceCx - targetCx) <= tolerance
  ) {
    startPoint = { x: sourceCx, y: source.y + source.h };
    endPoint = {
      x: targetCx,
      y: orthogonalTopPortY(target, targetCx, target.y),
    };
  } else if (
    sourceSide === 'top' &&
    targetSide === 'bottom' &&
    target.y + target.h <= source.y &&
    Math.abs(sourceCx - targetCx) <= tolerance
  ) {
    startPoint = {
      x: sourceCx,
      y: orthogonalTopPortY(source, sourceCx, source.y),
    };
    endPoint = { x: targetCx, y: target.y + target.h };
  }

  if (!startPoint || !endPoint) return undefined;

  const blocked = obstacles.some((obstacle) =>
    orthogonalSegmentIntersectsBox(startPoint, endPoint, obstacle, 16)
  );
  if (blocked) return undefined;

  return { startPoint, endPoint };
}

function alternatingPortOffset(index: number) {
  if (index === 0) return 0;
  const direction = index % 2 === 0 ? -1 : 1;
  return direction * Math.ceil(index / 2) * 15;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function compactOrthogonalSiblingColumns(
  children: ElkNode[],
  columnGap: number
) {
  if (children.length < 2) return children;

  const columns = new Map<number, ElkNode[]>();
  for (const child of children) {
    const key = Math.round((child.x || 0) / 10) * 10;
    const column = columns.get(key) || [];
    column.push(child);
    columns.set(key, column);
  }

  const orderedColumns = [...columns.entries()]
    .map(([x, nodes]) => ({
      x,
      nodes,
      minX: Math.min(...nodes.map((node) => node.x || 0)),
      maxX: Math.max(...nodes.map((node) => (node.x || 0) + (node.width || 0))),
    }))
    .sort((a, b) => a.minX - b.minX);

  if (orderedColumns.length < 2) return children;

  let nextMinX = orderedColumns[0].minX;
  const xShifts = new Map<ElkNode, number>();

  for (const column of orderedColumns) {
    // Not clamped to <= 0: a column whose x-range is nested inside an
    // earlier, wider column (e.g. a narrower same-rank node that
    // coordinate-assignment centered well to the right of a wide sibling,
    // landing it at a smaller rounded-x "column" than a later rank) must
    // still be pushed right of that wider column's true edge, not just
    // pulled closer when there's slack. Clamping to <= 0 here left such
    // columns exactly where they started, which could be inside — not just
    // near — the wider column, producing a visible box overlap.
    const shift = nextMinX - column.minX;
    for (const node of column.nodes) {
      xShifts.set(node, shift);
    }

    const shiftedMaxX = column.maxX + shift;
    // Track the rightmost edge established so far, not just the previous
    // column's: an intermediate column that's narrower than an earlier one
    // must not reset the floor lower than what that earlier column already
    // required.
    nextMinX = Math.max(nextMinX, shiftedMaxX + columnGap);
  }

  return children.map((child) => ({
    ...child,
    x: (child.x || 0) + (xShifts.get(child) || 0),
  }));
}

export async function renderSvg(
  graph: ElkNode,
  layoutEngine: 'elk' | 'custom' | 'orthogonal' | 'tsm' = 'elk',
  complianceTooltipMap?: Record<
    string,
    { frameworks: string[]; violations: string[] }
  >,
  optimizationTooltipMap?: Record<string, { recommendations: string[] }>,
  perServiceCosts?: Record<string, number>,
  period: 'hourly' | 'daily' | 'monthly' | 'yearly' = 'monthly',
  iconResolver?: (iconName: string) => Promise<string | null>
): Promise<string> {
  let layout: ElkNode;
  const isOrthogonalLayout =
    layoutEngine === 'orthogonal' || layoutEngine === 'tsm';
  const allNodeBoxes: {
    id: string;
    x: number;
    y: number;
    right: number;
    bottom: number;
    isContainer: boolean;
  }[] = [];

  if (layoutEngine === 'custom' || isOrthogonalLayout) {
    // ── Hierarchical custom layout ──────────────────────────────
    // Recursively lays out children within each container,
    // preserving the nesting. Children are arranged in a grid
    // when there are many siblings. Cross-container edges are
    // routed using absolute node positions with orthogonal paths.

    const CONTAINER_PAD = 40; // padding inside container boundaries
    const CONTAINER_TOP = 44; // extra top padding for label strip
    const NODE_GAP_X = 140; // horizontal gap between children
    const NODE_GAP_Y = 120; // vertical gap between rows

    // Collect ALL original edges from every level for rendering later
    const allOriginalEdges: ElkEdge[] = [];
    const seenOriginalEdges = new Set<string>();
    const collectAllEdges = (node: ElkNode) => {
      if (node.edges) {
        for (const edge of node.edges) {
          const edgeKey = [
            edge.id || '',
            edge.sources?.[0] || '',
            edge.targets?.[0] || '',
            edge.labels?.[0]?.text || '',
          ].join('|');
          if (seenOriginalEdges.has(edgeKey)) continue;
          seenOriginalEdges.add(edgeKey);
          allOriginalEdges.push(edge);
        }
      }
      node.children?.forEach(collectAllEdges);
    };
    collectAllEdges(graph);

    // Map every node id to its immediate parent id in the original
    // (pre-layout) tree. Used below to "lift" a real connection between two
    // deeply nested nodes up to whichever direct siblings actually contain
    // them — e.g. `secrets-manager -> ecs-fargate` (ecs-fargate nested three
    // levels inside `vpc-main`) becomes a hint that `secrets-manager` should
    // rank just before `vpc-main` at the level where they're both direct
    // siblings, instead of that relationship only being visible deep inside
    // `vpc-main` where `secrets-manager` never appears at all.
    const parentOf = new Map<string, string>();
    if (isOrthogonalLayout) {
      const recordParents = (n: ElkNode) => {
        n.children?.forEach((c) => {
          parentOf.set(c.id, n.id);
          recordParents(c);
        });
      };
      recordParents(graph);
    }

    // Walk up from `id` until hitting a member of `siblingIds` (or run out
    // of ancestors). Returns that member, or undefined if `id` isn't nested
    // under any of them.
    const findSiblingAncestor = (
      id: string,
      siblingIds: Set<string>
    ): string | undefined => {
      let cur: string | undefined = id;
      const visited = new Set<string>();
      while (cur !== undefined && !visited.has(cur)) {
        if (siblingIds.has(cur)) return cur;
        visited.add(cur);
        cur = parentOf.get(cur);
      }
      return undefined;
    };

    // For `orthogonal`, precompute a global flow-rank per node id (leaves AND
    // containers) from the full connection graph, ignoring nesting. When
    // siblings have no direct edge between them the masonry fallback below
    // has no way to know which one is the "entry" side and which is
    // "downstream" — without this it just packs them in declaration order,
    // which is why an entry point like a user/client node could land on the
    // wrong side of the diagram relative to everything it flows into. Custom
    // and elk are unaffected: this map is only consulted when
    // isOrthogonalLayout is true.
    const globalFlowRank = new Map<string, number>();
    if (isOrthogonalLayout) {
      const rankGraph = new FlowRankGraph();
      const collectIds = (n: ElkNode) => {
        rankGraph.addNode(n.id, { width: 1, height: 1 });
        n.children?.forEach(collectIds);
      };
      collectIds(graph);
      // Synthetic parent->child edges: a container's rank must be a real
      // upper bound on anything nested inside it. Without this, a "runs"
      // sub-app that happens to have no incoming connection of its own
      // (e.g. an app hosted by a service that receives traffic, but the
      // connection targets the service, not the app id) gets treated as a
      // rank-0 entry point by the earliest-pass below, which then drags its
      // entire container down to rank 0 too — even though the container
      // clearly sits downstream of other things.
      const addNestingEdges = (n: ElkNode) => {
        n.children?.forEach((c) => {
          rankGraph.addEdge(n.id, c.id);
          addNestingEdges(c);
        });
      };
      addNestingEdges(graph);
      for (const edge of allOriginalEdges) {
        const src = edge.sources?.[0];
        const tgt = edge.targets?.[0];
        if (
          src &&
          tgt &&
          src !== tgt &&
          rankGraph.getNode(src) &&
          rankGraph.getNode(tgt)
        ) {
          rankGraph.addEdge(src, tgt);
        }
      }
      const rankCycles = detectFlowRankCycles(rankGraph);
      if (rankCycles.length > 0) breakFlowRankCycles(rankGraph, rankCycles);
      assignFlowRanks(rankGraph);
      rankGraph.nodes.forEach((n, id) => globalFlowRank.set(id, n.rank));
    }

    // Bottom-up "effective" flow-rank: a leaf's is its own global rank; a
    // container's is the minimum rank among whatever is inside it, so a
    // container packs at the same relative position as its most upstream
    // child. Populated by layoutNode() as it recurses.
    const effectiveFlowRank = new Map<string, number>();

    /**
     * Recursively lay out a node's children.
     * Uses the core engine when there are edges between children
     * (to get proper rank-based ordering). Falls back to grid
     * layout when children are disconnected.
     */
    const layoutNode = async (node: ElkNode): Promise<ElkNode> => {
      // Leaf node: return as-is
      if (!node.children || node.children.length === 0) {
        if (isOrthogonalLayout) {
          effectiveFlowRank.set(
            node.id,
            globalFlowRank.get(node.id) ?? Infinity
          );
        }
        return {
          ...node,
          width: node.width || 96,
          height: node.height || 116,
          children: [],
          edges: [],
        };
      }

      // Container: recursively lay out children first
      let laidOutChildren: ElkNode[] = [];
      for (const child of node.children) {
        laidOutChildren.push(await layoutNode(child));
      }

      if (isOrthogonalLayout) {
        let minRank = Infinity;
        for (const child of laidOutChildren) {
          const r = effectiveFlowRank.get(child.id) ?? Infinity;
          if (r < minRank) minRank = r;
        }
        effectiveFlowRank.set(node.id, minRank);
      }

      // Check if there are any local edges between direct children.
      //
      // `node.edges` is only ever populated on the graph ROOT (buildElkGraph
      // attaches the full flat connection list there and nowhere else), so
      // for every non-root container this was always empty — the local-edge
      // rank-based layout branch below was effectively unreachable except at
      // the root. For `orthogonal`, fall back to scanning the pre-collected
      // `allOriginalEdges` (gathered from every level up front) so nested
      // containers with real local connections are actually detected.
      // `custom`'s behavior is intentionally left exactly as before.
      const childIds = new Set(laidOutChildren.map((c) => c.id));
      const localEdges: ElkEdge[] = [];
      if (isOrthogonalLayout) {
        for (const edge of allOriginalEdges) {
          if (childIds.has(edge.sources[0]) && childIds.has(edge.targets[0])) {
            localEdges.push(edge);
          }
        }
      } else if (node.edges) {
        for (const edge of node.edges) {
          if (childIds.has(edge.sources[0]) && childIds.has(edge.targets[0])) {
            localEdges.push(edge);
          }
        }
      }

      let positionedChildren: ElkNode[];

      const hasStructuralChildren = laidOutChildren.some((c) =>
        hasCssClassToken(c, STRUCTURAL_CLASS_TOKENS)
      );

      laidOutChildren = laidOutChildren.sort((a, b) => {
        const aFirst =
          a.layoutOptions?.['elk.layered.layering.layerConstraint'] === 'FIRST';
        const bFirst =
          b.layoutOptions?.['elk.layered.layering.layerConstraint'] === 'FIRST';

        if (aFirst && !bFirst) return -1;
        if (!aFirst && bFirst) return 1;

        // Preserve ELK's ordering
        return (a.x ?? 0) - (b.x ?? 0);
      });

      if (
        localEdges.length > 0 &&
        (isOrthogonalLayout ||
          (laidOutChildren.length <= 12 && !hasStructuralChildren))
      ) {
        // The orthogonal engine flows left-to-right (matching the `elk`
        // engine's `elk.direction: RIGHT`, and typical AWS architecture
        // diagram conventions). `custom` keeps its original top-to-bottom
        // behavior unchanged.
        const engineOptions = {
          rankdir: isOrthogonalLayout ? 'LR' : 'TB',
          nodesep: NODE_GAP_X,
          ranksep: NODE_GAP_Y,
        } as const;

        const engine = !isOrthogonalLayout
          ? new CustomLayoutEngine(engineOptions)
          : new OrthogonalLayoutEngine(engineOptions);

        for (const child of laidOutChildren) {
          engine.addNode(child.id, {
            width: child.width || 96,
            height: child.height || 116,
          });
        }
        if (isOrthogonalLayout) {
          // Lift every real connection to the pair of direct siblings that
          // actually contain its two endpoints, not just the ones whose
          // endpoints happen to be direct siblings themselves (that literal
          // subset is `localEdges`, and it's often only one or two edges —
          // e.g. a container with one connected pair plus several unrelated
          // siblings, where each of those siblings' real relationships live
          // several levels deeper and were invisible at this level before).
          // A pair can be lifted to the same edge multiple times (e.g. every
          // connection into a busy container); duplicates are harmless,
          // they just repeat the same ordering constraint.
          const childIds = new Set(laidOutChildren.map((c) => c.id));
          for (const edge of allOriginalEdges) {
            const src = edge.sources?.[0];
            const tgt = edge.targets?.[0];
            if (!src || !tgt) continue;
            const from = findSiblingAncestor(src, childIds);
            const to = findSiblingAncestor(tgt, childIds);
            if (from && to && from !== to) {
              engine.addEdge(from, to);
            }
          }
        } else {
          for (const edge of localEdges) {
            engine.addEdge(edge.sources[0], edge.targets[0]);
          }
        }

        const result = await engine.layout();
        positionedChildren = laidOutChildren.map((child) => {
          const pos = result.nodes[child.id];
          if (pos) {
            return {
              ...child,
              x: pos.x + CONTAINER_PAD,
              y: pos.y + CONTAINER_TOP,
            };
          }
          return child;
        });

        if (isOrthogonalLayout) {
          positionedChildren = compactOrthogonalSiblingColumns(
            positionedChildren,
            80
          );
        }
      } else {
        const direction = node.properties?.direction;
        const isVetical = direction === 'vertical';
        // Flow Layout (Masonry) for tightly packing mixed-size items
        const isAz = (c: ElkNode) => hasCssClassToken(c, ZONE_CLASS_TOKENS);
        const azChildren = laidOutChildren.filter((c) => isAz(c));
        const nonAzChildren = laidOutChildren.filter((c) => !isAz(c));
        if (isOrthogonalLayout) {
          // No local edges to derive an order from here, so fall back to the
          // precomputed global flow-rank — a stable sort keeps ties in their
          // original (declaration) order.
          nonAzChildren.sort(
            (a, b) =>
              (effectiveFlowRank.get(a.id) ?? Infinity) -
              (effectiveFlowRank.get(b.id) ?? Infinity)
          );
        }

        let currentX = 0;
        const columns: { x: number; w: number; y: number }[] = [];

        const positionedAzs = azChildren.map((c) => {
          const res = { ...c, x: currentX + CONTAINER_PAD, y: CONTAINER_TOP };
          columns.push({
            x: currentX,
            w: (c.width || 0) + NODE_GAP_X,
            y: CONTAINER_TOP + (c.height || 0) + NODE_GAP_Y,
          });
          currentX += (c.width || 0) + NODE_GAP_X;
          return res;
        });

        const positionedNonAz: ElkNode[] = [];
        // Keyed by node id (not object reference): compaction below returns
        // fresh copies of each node, so an identity-keyed map would no
        // longer resolve after that step, and centering has to happen
        // after compaction anyway — see the comment there.
        const colAssignment = new Map<string, number>();

        if (columns.length === 0 && nonAzChildren.length > 0) {
          let maxChildWidth = 0;
          let maxChildHeight = 0;

          if (isOrthogonalLayout) {
            maxChildWidth = 400;
            for (const c of nonAzChildren) {
              if (c.width && c.width > maxChildWidth) {
                maxChildWidth = c.width;
              }
            }
          }
          // Orthogonal favors a single vertical column over a square-ish
          // grid for small lists of leaves (e.g. API Service 1/2/3): it
          // reads as a clean stacked list and avoids widening the container
          // just to fit a second/third column. Restricted to small,
          // same-kind lists — a single column of a dozen-plus items turns
          // into an unreasonably tall tower, and mixing in an actual
          // container (which can be far larger than a leaf, e.g. a
          // catch-all wrapper sitting next to a lone entry-point node)
          // forces that tiny node into the same cramped column with no
          // room to be positioned sensibly. Both cases fall back to the
          // grid custom uses.
          const allLeaves = nonAzChildren.every(
            (c) => !c.children || c.children.length === 0
          );

          const numCols =
            isOrthogonalLayout && allLeaves && nonAzChildren.length <= 4
              ? 1
              : Math.min(Math.ceil(Math.sqrt(nonAzChildren.length)), 4);

          // -----------------------------
          // Compute Y of every row
          // -----------------------------

          const rows = Math.ceil(nonAzChildren.length / numCols);
          const rowHeights = new Array(rows).fill(0);

          for (const [index, c] of nonAzChildren.entries()) {
            if (c.width && c.width > maxChildWidth) {
              maxChildWidth = c.width;
            }
            if (c.height && c.height > maxChildHeight) {
              maxChildHeight = c.height;
            }

            const row = Math.floor(index / numCols);

            rowHeights[row] = Math.max(rowHeights[row], c.height || 0);
          }

          let x = 0;
          let y = CONTAINER_TOP;
          for (const c of nonAzChildren) {
            if (c.width && c.width > maxChildWidth) {
              maxChildWidth = c.width;
            }
          }

          for (let i = 0; i < numCols; i++) {
            const width = isOrthogonalLayout
              ? maxChildWidth
              : (nonAzChildren[i]?.width ?? maxChildWidth);
            const height = nonAzChildren[i]?.height ?? maxChildHeight;

            const colObj = {
              x: isOrthogonalLayout ? i * (maxChildWidth + NODE_GAP_X) : x,
              w: width,
              y: isOrthogonalLayout ? CONTAINER_TOP : y,
            };

            if (isVetical) y += NODE_GAP_Y + height;
            else x += width + NODE_GAP_X;

            columns.push(colObj);
          }

          const rowY = new Array(rows).fill(0);

          rowY[0] = CONTAINER_TOP;

          for (let i = 1; i < rows; i++) {
            rowY[i] = rowY[i - 1] + rowHeights[i - 1] + NODE_GAP_Y;
          }

          nonAzChildren.forEach((c, index) => {
            // let minCol = columns[0] || { x: 0, w: 0, y: CONTAINER_TOP };
            const minCol = columns[index % numCols];
            const row = Math.floor(index / numCols);
            // for (const col of columns) {
            //   if (col.y < minCol.y) minCol = col;
            // }

            colAssignment.set(c.id, minCol.x);

            positionedNonAz.push({
              ...c,
              x: minCol.x + CONTAINER_PAD,
              y: rowY[row],
            });

            minCol.w = Math.max(minCol.w, c.width || 0);

            // Update the height occupied by this column
            minCol.y += (c.height || 0) + NODE_GAP_Y;

            let currentX = 0;
            for (const col of columns) {
              col.x = currentX;
              currentX += col.w + NODE_GAP_X;
            }
          });
        }

        positionedChildren = [...positionedAzs, ...positionedNonAz];
        if (isOrthogonalLayout) {
          positionedChildren = compactOrthogonalSiblingColumns(
            positionedChildren,
            80
          );

          // Center each item within the width its column actually ends up
          // using (the widest sibling that landed there), not the column's
          // seed width (>= 400, used only for spacing multi-column grids)
          // — centering against that notional width left a lopsided gap
          // once the container shrank to fit the real (narrower) content,
          // since container sizing only ever looks at where children
          // actually are, not how wide their column was reserved to be.
          // Done *after* compaction above: compaction groups siblings by
          // rounded x to detect columns, and centering individual children
          // by different amounts before that would give same-column
          // siblings different x values, making compaction see several
          // single-node "columns" instead of one and scattering them apart.
          const trueColWidth = new Map<number, number>();
          positionedChildren.forEach((child) => {
            const colX = colAssignment.get(child.id);
            if (colX === undefined) return;
            trueColWidth.set(
              colX,
              Math.max(trueColWidth.get(colX) || 0, child.width || 0)
            );
          });
          positionedChildren = positionedChildren.map((child) => {
            const colX = colAssignment.get(child.id);
            if (colX === undefined) return child;
            const width = trueColWidth.get(colX) || 0;
            const offset = Math.max(0, (width - (child.width || 0)) / 2);
            return { ...child, x: (child.x || 0) + offset };
          });

          // Re-center an isolated satellite leaf (e.g. an entry point like
          // Users) against whichever sibling it actually connects to via a
          // lifted real edge, instead of leaving it pinned wherever the
          // grid packer's fill order happened to put it (typically the
          // very top). Left alone, that produces a long, straight edge
          // running the full height of the diagram to reach a target
          // that's really positioned mid-way down — height with no
          // structural meaning. Scoped to the diagram's outermost level
          // only: that's specifically where an unreferenced entry/exit
          // node ends up as a raw sibling of one large wrapper container
          // (the scenario this targets), and staying out of nested
          // containers avoids cascading repositioning through diagrams
          // with many independent satellites at deeper levels, which was
          // producing convoluted edge routing.
          if (node.id === 'root') {
            const siblingIds = new Set(positionedChildren.map((c) => c.id));
            const byId = new Map(positionedChildren.map((c) => [c.id, c]));
            for (const child of positionedChildren) {
              if (child.children && child.children.length > 0) continue;
              let partnerId: string | undefined;
              let singlePartner = true;
              for (const edge of allOriginalEdges) {
                const src = edge.sources?.[0];
                const tgt = edge.targets?.[0];
                if (!src || !tgt) continue;
                const otherEnd =
                  src === child.id ? tgt : tgt === child.id ? src : undefined;
                if (!otherEnd) continue;
                const lifted = findSiblingAncestor(otherEnd, siblingIds);
                if (!lifted || lifted === child.id) continue;
                if (partnerId === undefined) partnerId = lifted;
                else if (partnerId !== lifted) {
                  singlePartner = false;
                  break;
                }
              }
              if (!partnerId || !singlePartner) continue;
              const partner = byId.get(partnerId);
              if (!partner) continue;
              const partnerCenterY =
                (partner.y || 0) + (partner.height || 0) / 2;
              const desiredY = Math.max(
                CONTAINER_TOP,
                partnerCenterY - (child.height || 0) / 2
              );
              // Only move it into a spot that's actually clear — two
              // independently-positioned satellites (e.g. an entry point and
              // an unrelated secrets/monitoring node) can otherwise both want
              // roughly the same row and end up stacked on top of each other.
              // If the exact center is taken, walk outward in both directions
              // for the nearest clear row rather than giving up outright and
              // falling back to the original (usually far worse) position.
              const cx = child.x || 0;
              const cw = child.width || 0;
              const ch = child.height || 0;
              const overlapsAt = (y: number) =>
                positionedChildren.some((other) => {
                  if (other === child) return false;
                  const ox = other.x || 0;
                  const oy = other.y || 0;
                  const ow = other.width || 0;
                  const oh = other.height || 0;
                  return (
                    cx < ox + ow && cx + cw > ox && y < oy + oh && y + ch > oy
                  );
                });
              let bestY: number | undefined;
              for (let step = 0; step <= 6 && bestY === undefined; step++) {
                const offset = step * (NODE_GAP_Y + ch);
                for (const y of step === 0
                  ? [desiredY]
                  : [desiredY - offset, desiredY + offset]) {
                  const clamped = Math.max(CONTAINER_TOP, y);
                  if (!overlapsAt(clamped)) {
                    bestY = clamped;
                    break;
                  }
                }
              }
              if (bestY !== undefined) child.y = bestY;
            }
          }
        }
      }

      // Compute container size from children bounds
      let maxX = 0,
        maxY = 0;
      positionedChildren.forEach((child) => {
        maxX = Math.max(maxX, (child.x || 0) + (child.width || 0));
        maxY = Math.max(maxY, (child.y || 0) + (child.height || 0));
      });

      const labelText = node.labels?.[0]?.text || '';
      // Heuristic: ~8px per character + 80px padding for the pill structure
      const minLabelWidth = labelText.length * 8 + 80;
      const contentWidth = maxX + CONTAINER_PAD;

      // When a long title pill forces the container wider than its content
      // actually needs (e.g. "ECS Fargate Workers Cluster" next to a couple
      // of narrow stacked leaves), re-center the whole content block in the
      // extra space instead of leaving it pinned to the left edge under a
      // pill that overhangs empty space on the right.
      if (isOrthogonalLayout && minLabelWidth > contentWidth) {
        const shift = (minLabelWidth - contentWidth) / 2;
        positionedChildren.forEach((child) => {
          child.x = (child.x || 0) + shift;
        });
      }

      const width = isOrthogonalLayout
        ? Math.max(contentWidth, minLabelWidth)
        : Math.max(maxX + CONTAINER_PAD, minLabelWidth);
      const amn = {
        ...node,
        width,
        height: maxY + CONTAINER_PAD,
        children: positionedChildren,
        edges: [],
      };

      return amn;
    };

    layout = await layoutNode(graph);

    layout.properties = graph.properties;

    // Pass 1: Global absolute positioning calculation
    const absPositions = new Map<
      string,
      {
        id: string;
        x: number;
        y: number;
        w: number;
        h: number;
        isLeaf: boolean;
        type?: string;
        isStacked?: boolean;
        label?: string;
      }
    >();
    const parentChain = new Map<string, string>(); // childId -> parentId

    const buildAbsPositions = (n: ElkNode, ox: number, oy: number) => {
      const ax = ox + (n.x || 0);
      const ay = oy + (n.y || 0);
      const isLeaf = !n.children || n.children.length === 0;
      absPositions.set(n.id, {
        id: n.id,
        x: ax,
        y: ay,
        w: n.width || 0,
        h: n.height || 0,
        isLeaf,
        type: n.properties?.type,
        isStacked: n.properties?.isStacked,
        label: n.labels?.[0]?.text || '',
      });
      n.children?.forEach((c) => {
        parentChain.set(c.id, n.id);
        buildAbsPositions(c, ax, ay);
      });
    };
    buildAbsPositions(layout, 0, 0);

    const getPillBounds = (pos: { x: number; w: number; label?: string }) => {
      const { actualLabelW } = calculateLabelDimensions(pos.label, pos.w);
      return { left: pos.x + 16, right: pos.x + 16 + actualLabelW };
    };

    const allObstacles: RoutingObstacle[] = Array.from(
      absPositions.values()
    ).flatMap((p) => {
      const bounds: RoutingObstacle[] = [
        {
          id: p.id,
          x: p.x,
          y: p.y,
          w: p.w,
          h: p.h,
          isLeaf: p.isLeaf,
        },
      ];

      if (isOrthogonalLayout && !p.isLeaf) {
        const pillBounds = getPillBounds(p);
        bounds.push({
          id: `${p.id}:title-pill`,
          x: pillBounds.left,
          y: p.y - 14,
          w: pillBounds.right - pillBounds.left,
          h: 28,
          isLeaf: false,
        });
      }

      return bounds;
    });

    // ── Route ALL original edges using A* ──
    const routedEdges: ElkEdge[] = [];
    const verticalPortUsage = new Map<number, number>();
    const horizontalPortUsage = new Map<number, number>();
    const orthogonalVerticalTracks = new Map<number, number>();
    const orthogonalHorizontalTracks = new Map<number, number>();
    const orthogonalSourcePortUsage = new Map<string, number>();
    const orthogonalTargetPortUsage = new Map<string, number>();
    const orthogonalVisualPortUsage = new Map<string, number>();
    const orthogonalRoutedSegments: Array<{
      a: { x: number; y: number };
      b: { x: number; y: number };
    }> = [];
    const incomingEdgeCounts = new Map<string, number>();
    const outgoingEdgeCounts = new Map<string, number>();
    for (const edge of allOriginalEdges) {
      const source = edge.sources?.[0];
      const target = edge.targets?.[0];
      if (source) {
        outgoingEdgeCounts.set(
          source,
          (outgoingEdgeCounts.get(source) || 0) + 1
        );
      }
      if (target) {
        incomingEdgeCounts.set(
          target,
          (incomingEdgeCounts.get(target) || 0) + 1
        );
      }
    }

    const getVerticalOffset = (x: number) => {
      const key = Math.round(x / 5) * 5;
      const count = verticalPortUsage.get(key) || 0;
      verticalPortUsage.set(key, count + 1);
      const sign = count % 2 === 0 ? 1 : -1;
      const mag = Math.floor((count + 1) / 2) * 15;
      return sign * mag;
    };

    const getHorizontalOffset = (y: number) => {
      const key = Math.round(y / 5) * 5;
      const count = horizontalPortUsage.get(key) || 0;
      horizontalPortUsage.set(key, count + 1);
      const sign = count % 2 === 0 ? 1 : -1;
      const mag = Math.floor((count + 1) / 2) * 15;
      return sign * mag;
    };

    const getActiveObstacles = (srcId: string, tgtId: string) => {
      const skipIds = new Set<string>();
      const addParentChain = (nodeId: string) => {
        skipIds.add(nodeId);
        let cur = parentChain.get(nodeId);
        while (cur) {
          skipIds.add(cur);
          cur = parentChain.get(cur);
        }
      };
      addParentChain(srcId);
      addParentChain(tgtId);
      return allObstacles.filter((o) => !o.id || !skipIds.has(o.id));
    };

    const isAncestorOf = (ancestorId: string, nodeId: string) => {
      let current = parentChain.get(nodeId);
      while (current) {
        if (current === ancestorId) return true;
        current = parentChain.get(current);
      }
      return false;
    };

    const directPriority = (edge: ElkEdge) => {
      if (!isOrthogonalLayout) return 1;
      const srcId = edge.sources[0];
      const tgtId = edge.targets[0];
      const srcPos = absPositions.get(srcId);
      const tgtPos = absPositions.get(tgtId);
      if (!srcPos || !tgtPos) return 1;

      const { sourceSide, targetSide } = preferredOrthogonalSides(
        srcPos,
        tgtPos,
        srcPos.y + srcPos.h,
        tgtPos.y
      );

      return directOrthogonalConnection(
        srcPos,
        tgtPos,
        sourceSide,
        targetSide,
        getActiveObstacles(srcId, tgtId)
      )
        ? 0
        : 1;
    };

    const edgeRouteDistance = (edge: ElkEdge) => {
      const srcPos = absPositions.get(edge.sources[0]);
      const tgtPos = absPositions.get(edge.targets[0]);
      if (!srcPos || !tgtPos) return Number.POSITIVE_INFINITY;
      const srcCx = srcPos.x + srcPos.w / 2;
      const srcCy = srcPos.y + srcPos.h / 2;
      const tgtCx = tgtPos.x + tgtPos.w / 2;
      const tgtCy = tgtPos.y + tgtPos.h / 2;
      return Math.abs(srcCx - tgtCx) + Math.abs(srcCy - tgtCy);
    };

    const orderedOriginalEdges = isOrthogonalLayout
      ? [...allOriginalEdges].sort(
          (a, b) =>
            directPriority(a) - directPriority(b) ||
            edgeRouteDistance(a) - edgeRouteDistance(b)
        )
      : allOriginalEdges;

    orderedOriginalEdges.forEach((origEdge) => {
      const srcId = origEdge.sources[0];
      const tgtId = origEdge.targets[0];
      const srcPos = absPositions.get(srcId);
      const tgtPos = absPositions.get(tgtId);
      if (!srcPos || !tgtPos) return;

      const srcCx = srcPos.x + srcPos.w / 2;
      const srcCy = srcPos.y + srcPos.h / 2;
      const tgtCx = tgtPos.x + tgtPos.w / 2;
      const tgtCy = tgtPos.y + tgtPos.h / 2;

      let sOffX = 0,
        tOffX = 0;
      let sOffY = 0,
        tOffY = 0;

      // const isVertical = tgtCy != srcCy;

      const srcBottom = srcPos.y + srcPos.h;
      const tgtBottom = tgtPos.y + tgtPos.h;

      const overlapY =
        Math.min(srcBottom, tgtBottom) - Math.max(srcPos.y, tgtPos.y);
      const isVertical = !(overlapY > 0);

      if (isVertical) {
        if (Math.abs(srcCx - tgtCx) < 5) {
          const off = getVerticalOffset(srcCx);
          sOffX = off;
          tOffX = off;
        } else {
          sOffX = getVerticalOffset(srcCx);
          tOffX = getVerticalOffset(tgtCx);
        }
      } else {
        if (Math.abs(srcCy - tgtCy) < 5) {
          const off = getHorizontalOffset(srcCy);
          sOffY = off;
          tOffY = off;
        } else {
          sOffY = getHorizontalOffset(srcCy);
          tOffY = getHorizontalOffset(tgtCy);
        }
      }

      let srcTopAdjust = 0;
      if (srcPos?.type === 'container') {
        const bounds = getPillBounds(srcPos);
        if (
          srcCx + sOffX >= bounds.left - 5 &&
          srcCx + sOffX <= bounds.right + 5
        ) {
          srcTopAdjust = -14;
        }
      } else if (srcPos?.isStacked) srcTopAdjust = -8;

      let tgtTopAdjust = 0;
      if (tgtPos?.type === 'container') {
        const bounds = getPillBounds(tgtPos);
        if (
          tgtCx + tOffX >= bounds.left - 5 &&
          tgtCx + tOffX <= bounds.right + 5
        ) {
          tgtTopAdjust = -14;
        }
      } else if (tgtPos?.isStacked) tgtTopAdjust = -8;

      const srcBot = srcPos.y + srcPos.h;
      const srcTop = srcPos.y + srcTopAdjust;
      const tgtBot = tgtPos.y + tgtPos.h;
      const tgtTop = tgtPos.y + tgtTopAdjust;

      let startPt: { x: number; y: number };
      let endPt: { x: number; y: number };
      let startStub: { x: number; y: number };
      let endStub: { x: number; y: number };
      let routeSourceSide: OrthogonalSide | undefined;
      let routeTargetSide: OrthogonalSide | undefined;
      let directOrthogonalRoute = false;
      let presetOrthogonalBends: { x: number; y: number }[] | undefined;
      const endpointBoxes = [
        { x: srcPos.x, y: srcPos.y, w: srcPos.w, h: srcPos.h },
        { x: tgtPos.x, y: tgtPos.y, w: tgtPos.w, h: tgtPos.h },
      ];

      // Filter obstacles: treat all non-ancestor nodes (both leaf and container) as solid obstacles
      const activeObstacles = getActiveObstacles(srcId, tgtId);
      const leafObstacles = activeObstacles.filter(
        (obstacle) =>
          obstacle.isLeaf && obstacle.id !== srcId && obstacle.id !== tgtId
      );

      if (isOrthogonalLayout) {
        const sourceContainsTarget = isAncestorOf(srcId, tgtId);
        const targetContainsSource = isAncestorOf(tgtId, srcId);

        if (sourceContainsTarget || targetContainsSource) {
          const containerPos = sourceContainsTarget ? srcPos : tgtPos;
          const childPos = sourceContainsTarget ? tgtPos : srcPos;
          const sideLaneX = containerPos.x + containerPos.w + 36;
          const containerSideY = clamp(
            childPos.y + 20,
            containerPos.y + 56,
            containerPos.y + containerPos.h - 32
          );
          const childBottomY = childPos.y + childPos.h;
          const childBottomX = childPos.x + childPos.w / 2;
          const belowContainerY = containerPos.y + containerPos.h + 36;
          const aboveContainerY = containerPos.y - 36;
          const layoutBottom = layout.height || belowContainerY;
          const childApproachY =
            belowContainerY < layoutBottom - 32
              ? belowContainerY
              : aboveContainerY;
          const containerPort = {
            x: containerPos.x + containerPos.w,
            y: containerSideY,
          };
          const childPort = { x: childBottomX, y: childBottomY };
          const bendsFromContainer = simplifyOrthogonalPoints([
            containerPort,
            { x: sideLaneX, y: containerSideY },
            { x: sideLaneX, y: childApproachY },
            { x: childBottomX, y: childApproachY },
            childPort,
          ]).slice(1, -1);

          startPt = sourceContainsTarget ? containerPort : childPort;
          endPt = sourceContainsTarget ? childPort : containerPort;
          presetOrthogonalBends = sourceContainsTarget
            ? bendsFromContainer
            : [...bendsFromContainer].reverse();
          startStub = startPt;
          endStub = endPt;
          routeSourceSide = sourceContainsTarget ? 'right' : 'bottom';
          routeTargetSide = sourceContainsTarget ? 'bottom' : 'right';
        } else {
          let { sourceSide, targetSide } = preferredOrthogonalSides(
            srcPos,
            tgtPos,
            srcBot,
            tgtTop
          );
          const sourceConnectionCount =
            (incomingEdgeCounts.get(srcId) || 0) +
            (outgoingEdgeCounts.get(srcId) || 0);
          const targetConnectionCount =
            (incomingEdgeCounts.get(tgtId) || 0) +
            (outgoingEdgeCounts.get(tgtId) || 0);
          const directConnection = directOrthogonalConnection(
            srcPos,
            tgtPos,
            sourceSide,
            targetSide,
            activeObstacles
          );
          const directConnectionHasConflict = directConnection
            ? countOrthogonalRouteSegmentConflicts(
                [directConnection.startPoint, directConnection.endPoint],
                orthogonalRoutedSegments
              ) > 0
            : false;

          if (directConnection && !directConnectionHasConflict) {
            startPt = directConnection.startPoint;
            endPt = directConnection.endPoint;
            startStub = startPt;
            endStub = endPt;
            routeSourceSide = sourceSide;
            routeTargetSide = targetSide;
            directOrthogonalRoute = true;
            markOrthogonalSideUsage(
              srcId,
              sourceSide,
              orthogonalSourcePortUsage
            );
            markOrthogonalSideUsage(
              tgtId,
              targetSide,
              orthogonalTargetPortUsage
            );
            markOrthogonalVisualPortUsage(
              srcId,
              sourceSide,
              orthogonalVisualPortUsage
            );
            markOrthogonalVisualPortUsage(
              tgtId,
              targetSide,
              orthogonalVisualPortUsage
            );
            appendOrthogonalSegments(
              [startPt, endPt],
              orthogonalRoutedSegments
            );
          } else {
            if (!directConnection) {
              sourceSide = chooseOrthogonalSide(
                srcId,
                sourceSide,
                orthogonalVisualPortUsage,
                sourceConnectionCount
              );
              targetSide = chooseOrthogonalSide(
                tgtId,
                targetSide,
                orthogonalVisualPortUsage,
                targetConnectionCount
              );
            }
            const selectedSides = chooseConflictAwareOrthogonalSides(
              srcPos,
              tgtPos,
              sourceSide,
              targetSide,
              orthogonalVisualPortUsage,
              activeObstacles,
              endpointBoxes,
              orthogonalRoutedSegments,
              srcTopAdjust,
              tgtTopAdjust
            );
            sourceSide = selectedSides.sourceSide;
            targetSide = selectedSides.targetSide;
            markOrthogonalSideUsage(
              srcId,
              sourceSide,
              orthogonalSourcePortUsage
            );
            markOrthogonalSideUsage(
              tgtId,
              targetSide,
              orthogonalTargetPortUsage
            );
            routeSourceSide = sourceSide;
            routeTargetSide = targetSide;

            const sourcePort = orthogonalSidePort(
              srcPos,
              sourceSide,
              orthogonalVisualPortUsage,
              srcTopAdjust
            );
            const targetPort = orthogonalSidePort(
              tgtPos,
              targetSide,
              orthogonalVisualPortUsage,
              tgtTopAdjust
            );
            startPt = sourcePort;
            endPt = targetPort;
            startStub = orthogonalStub(
              startPt,
              sourceSide,
              sourcePort.stubDistance
            );
            endStub = orthogonalStub(
              endPt,
              targetSide,
              targetPort.stubDistance
            );
          }
        }
      } else if (isVertical) {
        if (tgtTop > srcBot - 10) {
          startPt = { x: srcCx + sOffX, y: srcBot };
          startStub = { x: srcCx + sOffX, y: srcBot + 20 };
          endPt = { x: tgtCx + tOffX, y: tgtTop };
          endStub = { x: tgtCx + tOffX, y: tgtTop - 20 };
        } else {
          startPt = { x: srcCx + sOffX, y: srcTop };
          startStub = { x: srcCx + sOffX, y: srcTop - 20 };
          endPt = { x: tgtCx + tOffX, y: tgtBot };
          endStub = { x: tgtCx + tOffX, y: tgtBot + 20 };
        }
      } else {
        if (tgtCx > srcCx) {
          startPt = { x: srcPos.x + srcPos.w, y: srcCy + sOffY };
          startStub = { x: srcPos.x + srcPos.w + 20, y: srcCy + sOffY };
          endPt = { x: tgtPos.x, y: tgtCy + tOffY };
          endStub = { x: tgtPos.x - 20, y: tgtCy + tOffY };
        } else {
          startPt = { x: srcPos.x, y: srcCy + sOffY };
          startStub = { x: srcPos.x - 20, y: srcCy + sOffY };
          endPt = { x: tgtPos.x + tgtPos.w, y: tgtCy + tOffY };
          endStub = { x: tgtPos.x + tgtPos.w + 20, y: tgtCy + tOffY };
        }
      }

      let mappedBends: { x: number; y: number }[];
      if (isOrthogonalLayout && presetOrthogonalBends) {
        mappedBends = presetOrthogonalBends;
      } else if (isOrthogonalLayout && directOrthogonalRoute) {
        mappedBends = [];
      } else if (isOrthogonalLayout) {
        mappedBends =
          routeMinimalOrthogonalEdge(
            startPt,
            endPt,
            startStub,
            endStub,
            endpointBoxes,
            leafObstacles,
            activeObstacles,
            orthogonalRoutedSegments
          ) ??
          routeOrthogonalGlobalEdge(
            startPt,
            endPt,
            startStub,
            endStub,
            routeSourceSide!,
            routeTargetSide!,
            endpointBoxes,
            activeObstacles,
            isVertical,
            orthogonalVerticalTracks,
            orthogonalHorizontalTracks,
            orthogonalRoutedSegments
          );
      } else {
        try {
          const astarResult = routeAStar(
            startStub,
            endStub,
            activeObstacles,
            20
          );
          mappedBends = astarResult.points.map((p) => ({
            x: p.x,
            y: p.y,
          }));
        } catch (err) {
          console.warn(
            `[ADAC Routing] A* routing failed for edge ${origEdge.id}:`,
            err
          );
          const midY = (startStub.y + endStub.y) / 2;
          mappedBends = [
            { x: startStub.x, y: midY },
            { x: endStub.x, y: midY },
          ];
        }
      }

      if (isOrthogonalLayout) {
        mappedBends = repairOrthogonalLeafCollisions(
          [startPt, ...mappedBends, endPt],
          leafObstacles,
          endpointBoxes,
          orthogonalRoutedSegments
        ).slice(1, -1);
        mappedBends = repairOrthogonalTitlePillCollisions(
          [startPt, ...mappedBends, endPt],
          allObstacles.filter((obstacle) =>
            obstacle.id?.endsWith(':title-pill')
          ),
          activeObstacles,
          orthogonalRoutedSegments
        ).slice(1, -1);
        mappedBends = cleanupOrthogonalShortReversals(
          [startPt, ...mappedBends, endPt],
          leafObstacles,
          endpointBoxes,
          orthogonalRoutedSegments
        ).slice(1, -1);
        if (!directOrthogonalRoute) {
          appendOrthogonalSegments(
            [startPt, ...mappedBends, endPt],
            orthogonalRoutedSegments
          );
        }
      }

      routedEdges.push({
        id: origEdge.id,
        sources: [srcId],
        targets: [tgtId],
        labels: origEdge.labels,
        sections: [
          {
            id: `global-s${origEdge.id}`,
            startPoint: startPt,
            endPoint: endPt,
            bendPoints: mappedBends,
          },
        ],
      });
    });

    // Attach routed edges at the root level
    layout.edges = routedEdges;

    const padding = 40;

    if (layout.children && layout.children.length > 0) {
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      layout.children.forEach((child) => {
        const cx = child.x || 0,
          cy = child.y || 0,
          cw = child.width || 0,
          ch = child.height || 0;
        minX = Math.min(minX, cx);
        minY = Math.min(minY, cy);
        maxX = Math.max(maxX, cx + cw);
        maxY = Math.max(maxY, cy + ch);
      });

      // Also include edge coordinates in bounds calculation
      // so that routed edges are never clipped
      if (layout.edges) {
        layout.edges.forEach((e) => {
          e.sections?.forEach((s) => {
            [s.startPoint, s.endPoint, ...(s.bendPoints || [])].forEach(
              (pt) => {
                minX = Math.min(minX, pt.x);
                minY = Math.min(minY, pt.y);
                maxX = Math.max(maxX, pt.x);
                maxY = Math.max(maxY, pt.y);
              }
            );
          });
        });
      }

      if (minX !== Infinity) {
        const shiftX = -minX + padding,
          shiftY = -minY + padding;
        layout.children.forEach((c) => {
          if (c.x !== undefined) c.x += shiftX;
          if (c.y !== undefined) c.y += shiftY;
        });

        // Shift edge coordinates by the same amount so they
        // stay aligned with the nodes after the viewBox adjustment
        if (layout.edges) {
          layout.edges.forEach((e) => {
            e.sections?.forEach((s) => {
              s.startPoint.x += shiftX;
              s.startPoint.y += shiftY;
              s.endPoint.x += shiftX;
              s.endPoint.y += shiftY;
              s.bendPoints?.forEach((b) => {
                b.x += shiftX;
                b.y += shiftY;
              });
            });
          });
        }

        layout.width = maxX - minX + 2 * padding;
        layout.height = maxY - minY + 2 * padding;
      }
    }
  } else {
    const elk = new ELK();
    layout = (await elk.layout(graph)) as ElkNode;
  }

  const width = layout.width || 800;
  const height = layout.height || 600;

  let iconDataUriMap = new Map<string, string>();

  if (iconResolver) {
    const uniqueIconPaths = getUniqueIconPaths(graph);
    iconDataUriMap = await buildIconDataUriMap(uniqueIconPaths, iconResolver);
  }

  const getIconDataUri = async (params: { path?: string }) => {
    try {
      if (!params.path) return null;
      if (iconResolver) return iconDataUriMap.get(params.path) || null;
      else {
        const fs = await getFs();
        if (!fs.existsSync(params.path)) return null;
        const data = fs.readFileSync(params.path);
        if (!data) return null;
        const b64 = data.toString('base64');
        const ext = params.path.split('.').pop()?.toLowerCase();
        let mime = 'image/svg+xml';
        if (ext === 'png') mime = 'image/png';
        else if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
        return `data:${mime};base64,${b64}`;
      }
    } catch (e) {
      console.warn(`Failed to read icon: ${params.path}`, e);
      return null;
    }
  };

  const nodeAbsPos = new Map<string, { x: number; y: number }>();
  const parentMap = new Map<string, string>();
  const nodesMap = new Map<string, ElkNode>();

  const mapNodePositions = (
    n: ElkNode,
    ox: number,
    oy: number,
    pid?: string
  ) => {
    const cx = ox + (n.x || 0),
      cy = oy + (n.y || 0);
    const nw = n.width || 0;
    const nh = n.height || 0;
    nodeAbsPos.set(n.id, { x: cx, y: cy });
    nodesMap.set(n.id, n);
    if (pid) parentMap.set(n.id, pid);
    if (pid) {
      const isContainer =
        n.properties?.type === 'container' ||
        Boolean(n.children && n.children.length > 0);
      allNodeBoxes.push({
        id: n.id,
        x: cx,
        y: cy,
        right: cx + nw,
        bottom: cy + nh,
        isContainer,
      });
    }
    if (n.children)
      n.children.forEach((c) => mapNodePositions(c, cx, cy, n.id));
  };
  mapNodePositions(layout, 0, 0);

  const allEdges: ElkEdge[] = [];
  const processedEdgeIds = new Set<string>();
  const processedLabelKeys = new Set<string>();
  const collectEdges = (n: ElkNode) => {
    if (n.edges) {
      n.edges.forEach((e) => {
        if (e.id && processedEdgeIds.has(e.id)) return;
        if (e.id) processedEdgeIds.add(e.id);

        let containerOffset = { x: 0, y: 0 };
        let currentContainerId = e.container || n.id;

        while (currentContainerId) {
          const pos = nodeAbsPos.get(currentContainerId);
          if (pos) {
            containerOffset = pos;
            break;
          }
          // Walk up using pre-computed parentMap
          currentContainerId = parentMap.get(currentContainerId) || '';
        }

        const ge: ElkEdge = JSON.parse(JSON.stringify(e));
        if (ge.sections) {
          ge.sections.forEach((s) => {
            s.startPoint.x += containerOffset.x;
            s.startPoint.y += containerOffset.y;
            s.endPoint.x += containerOffset.x;
            s.endPoint.y += containerOffset.y;
            s.bendPoints?.forEach((b) => {
              b.x += containerOffset.x;
              b.y += containerOffset.y;
            });
          });
        }
        allEdges.push(ge);
      });
    }
    n.children?.forEach(collectEdges);
  };
  collectEdges(layout);

  const orthogonalContainerVisualBounds = new Map<
    string,
    { x: number; y: number; w: number; h: number }
  >();

  if (isOrthogonalLayout) {
    const containerPadding = 20;
    const containerIds = Array.from(nodesMap.values())
      .filter((node) => {
        return (
          node.properties?.type === 'container' &&
          (node.children?.length || 0) > 1
        );
      })
      .map((node) => node.id);

    const isWithinContainer = (nodeId: string, containerId: string) => {
      let current = nodeId;
      while (current) {
        if (current === containerId) return true;
        current = parentMap.get(current) || '';
      }
      return false;
    };

    for (const containerId of containerIds) {
      const node = nodesMap.get(containerId);
      const pos = nodeAbsPos.get(containerId);
      if (!node || !pos) continue;

      let left = pos.x;
      let top = pos.y;
      let right = pos.x + (node.width || 0);
      let bottom = pos.y + (node.height || 0);
      const original = { left, top, right, bottom };

      for (const edge of allEdges) {
        const sourceInside = edge.sources?.some((source) =>
          isWithinContainer(source, containerId)
        );
        const targetInside = edge.targets?.some((target) =>
          isWithinContainer(target, containerId)
        );
        if (!sourceInside && !targetInside) continue;

        for (const section of edge.sections || []) {
          const points = [
            section.startPoint,
            ...(section.bendPoints || []),
            section.endPoint,
          ];

          for (let i = 0; i < points.length - 1; i++) {
            const a = points[i];
            const b = points[i + 1];
            const segLeft = Math.min(a.x, b.x);
            const segRight = Math.max(a.x, b.x);
            const segTop = Math.min(a.y, b.y);
            const segBottom = Math.max(a.y, b.y);
            const crossesContainerX =
              segRight >= original.left && segLeft <= original.right;
            const crossesContainerY =
              segBottom >= original.top && segTop <= original.bottom;

            if (sourceInside && targetInside && crossesContainerX) {
              top = Math.min(top, segTop - containerPadding);
              bottom = Math.max(bottom, segBottom + containerPadding);
            }
            if (sourceInside && targetInside && crossesContainerY) {
              left = Math.min(left, segLeft - containerPadding);
              right = Math.max(right, segRight + containerPadding);
            }
          }
        }
      }

      for (const box of allNodeBoxes) {
        if (box.id === containerId || isWithinContainer(box.id, containerId)) {
          continue;
        }

        const overlapsX = box.right > left && box.x < right;
        const overlapsY = box.bottom > top && box.y < bottom;

        if (overlapsX && box.bottom > top && box.y < original.top) {
          top = Math.min(
            original.top,
            Math.max(top, box.bottom + containerPadding)
          );
        }
        if (overlapsX && box.y < bottom && box.bottom > original.bottom) {
          bottom = Math.max(
            original.bottom,
            Math.min(bottom, box.y - containerPadding)
          );
        }
        if (overlapsY && box.right > left && box.x < original.left) {
          left = Math.min(
            original.left,
            Math.max(left, box.right + containerPadding)
          );
        }
        if (overlapsY && box.x < right && box.right > original.right) {
          right = Math.max(
            original.right,
            Math.min(right, box.x - containerPadding)
          );
        }
      }

      orthogonalContainerVisualBounds.set(containerId, {
        x: left,
        y: top,
        w: right - left,
        h: bottom - top,
      });

      const existingBox = allNodeBoxes.find((box) => box.id === containerId);
      if (existingBox) {
        existingBox.x = left;
        existingBox.y = top;
        existingBox.right = right;
        existingBox.bottom = bottom;
      }
    }

    const renderedTitlePills: RoutingObstacle[] = Array.from(nodesMap.values())
      .filter((node) => node.properties?.type === 'container')
      .flatMap((containerNode) => {
        const containerId = containerNode.id;
        const pos = nodeAbsPos.get(containerId);
        if (!pos) return [];

        const visualBounds = orthogonalContainerVisualBounds.get(containerId);
        const containerX = visualBounds?.x ?? pos.x;
        const containerY = visualBounds?.y ?? pos.y;
        const containerW = visualBounds?.w ?? containerNode.width ?? 0;
        const { actualLabelW } = calculateLabelDimensions(
          containerNode.labels?.[0]?.text || '',
          containerW
        );

        return [
          {
            id: `${containerId}:rendered-title-pill`,
            x: containerX + 16,
            y: containerY - 14,
            w: actualLabelW,
            h: 28,
            isLeaf: false,
          },
        ];
      });

    for (const edge of allEdges) {
      for (const section of edge.sections || []) {
        const repaired = repairOrthogonalTitlePillCollisions(
          [section.startPoint, ...(section.bendPoints || []), section.endPoint],
          renderedTitlePills,
          renderedTitlePills,
          []
        );
        section.bendPoints = repaired.slice(1, -1);
      }
    }

    const finalOrthogonalSegments: Array<{
      a: { x: number; y: number };
      b: { x: number; y: number };
    }> = [];
    for (const edge of allEdges) {
      const srcId = edge.sources?.[0];
      const tgtId = edge.targets?.[0];
      const srcPos = srcId ? nodeAbsPos.get(srcId) : undefined;
      const tgtPos = tgtId ? nodeAbsPos.get(tgtId) : undefined;
      const srcNode = srcId ? nodesMap.get(srcId) : undefined;
      const tgtNode = tgtId ? nodesMap.get(tgtId) : undefined;
      const endpointBoxes =
        srcPos && tgtPos && srcNode && tgtNode
          ? [
              {
                x: srcPos.x,
                y: srcPos.y,
                w: srcNode.width || 0,
                h: srcNode.height || 0,
              },
              {
                x: tgtPos.x,
                y: tgtPos.y,
                w: tgtNode.width || 0,
                h: tgtNode.height || 0,
              },
            ]
          : [];
      const leafObstacles =
        srcId && tgtId
          ? allNodeBoxes
              .filter(
                (box) =>
                  !box.isContainer && box.id !== srcId && box.id !== tgtId
              )
              .map((box) => ({
                id: box.id,
                x: box.x,
                y: box.y,
                w: box.right - box.x,
                h: box.bottom - box.y,
                isLeaf: true,
              }))
          : [];

      for (const section of edge.sections || []) {
        let repaired = repairOrthogonalExactOverlaps(
          [section.startPoint, ...(section.bendPoints || []), section.endPoint],
          finalOrthogonalSegments,
          leafObstacles,
          endpointBoxes
        );
        repaired = repairOrthogonalTitlePillCollisions(
          repaired,
          renderedTitlePills,
          renderedTitlePills,
          finalOrthogonalSegments
        );
        repaired = cleanupOrthogonalShortReversals(
          repaired,
          leafObstacles,
          endpointBoxes,
          finalOrthogonalSegments
        );
        section.bendPoints = repaired.slice(1, -1);
        appendOrthogonalSegments(repaired, finalOrthogonalSegments);
      }
    }
  }

  const rootCssProp = (layout.properties?.cssClass || '') as string;
  const defaultEdgeClass = rootCssProp.includes('gcp')
    ? 'gcp-edge'
    : rootCssProp.includes('azure')
      ? 'azure-edge'
      : 'aws-edge';

  const defaultArrow = rootCssProp.includes('gcp')
    ? 'url(#arrow-gcp)'
    : rootCssProp.includes('azure')
      ? 'url(#arrow-azure)'
      : 'url(#arrow)';

  const escapeXml = (s: string) =>
    s.replace(
      /[<>&'"]/g,
      (c) =>
        ({
          '<': '&lt;',
          '>': '&gt;',
          '&': '&amp;',
          "'": '&apos;',
          '"': '&quot;',
        })[c] || ''
    );

  const placedLabels: { l: number; r: number; t: number; b: number }[] = [];
  let edgePathsOutput = '';
  let edgeLabelsOutput = '';

  // Precompute all edge segment bounding boxes for fast collision detection
  const edgeSegmentsCache: {
    edgeId: string;
    sLeft: number;
    sRight: number;
    sTop: number;
    sBottom: number;
  }[] = [];
  allEdges.forEach((otherEdge) => {
    (otherEdge.sections || []).forEach((otherSec) => {
      const otherPts = [
        otherSec.startPoint,
        ...(otherSec.bendPoints || []),
        otherSec.endPoint,
      ];
      for (let j = 0; j < otherPts.length - 1; j++) {
        const p1 = otherPts[j];
        const p2 = otherPts[j + 1];
        edgeSegmentsCache.push({
          edgeId: otherEdge.id,
          sLeft: Math.min(p1.x, p2.x),
          sRight: Math.max(p1.x, p2.x),
          sTop: Math.min(p1.y, p2.y),
          sBottom: Math.max(p1.y, p2.y),
        });
      }
    });
  });

  allEdges.forEach((e) => {
    (e.sections || []).forEach((s) => {
      const pts = [s.startPoint, ...(s.bendPoints || []), s.endPoint];
      let d = `M ${pts[0].x} ${pts[0].y}`;
      const R = isOrthogonalLayout ? 0 : 12; // Orthogonal output stays crisp.

      for (let i = 1; i < pts.length - 1; i++) {
        const p0 = pts[i - 1];
        const p1 = pts[i];
        const p2 = pts[i + 1];

        const dx1 = p1.x - p0.x;
        const dy1 = p1.y - p0.y;
        const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);

        const dx2 = p2.x - p1.x;
        const dy2 = p2.y - p1.y;
        const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

        const r = Math.min(R, len1 / 2, len2 / 2);

        const cross = (dx1 / len1) * (dy2 / len2) - (dy1 / len1) * (dx2 / len2);

        if (!isOrthogonalLayout && r > 1 && Math.abs(cross) > 0.001) {
          const startX = p1.x - (dx1 / len1) * r;
          const startY = p1.y - (dy1 / len1) * r;
          d += ` L ${startX} ${startY}`;

          const endX = p1.x + (dx2 / len2) * r;
          const endY = p1.y + (dy2 / len2) * r;

          const sweep = cross > 0 ? 1 : 0;

          d += ` A ${r} ${r} 0 0 ${sweep} ${endX} ${endY}`;
        } else {
          d += ` L ${p1.x} ${p1.y}`;
        }
      }
      const last = pts[pts.length - 1];
      d += ` L ${last.x} ${last.y}`;

      let edgeClass = '';
      let tNode: ElkNode | undefined | null = null;
      if (e.targets && e.targets.length > 0) {
        let currTarget = e.targets[0];
        while (currTarget) {
          tNode = nodesMap.get(currTarget);
          if (tNode?.properties?.type === 'container') {
            const cCls = tNode.properties.cssClass;
            if (typeof cCls === 'string' && cCls) {
              const classToken = cCls.split(/\s+/).find(Boolean);
              if (classToken) {
                edgeClass = `dynamic-edge ${classToken}-edge`;
              }
            }
            break;
          }
          if (tNode) break; // Found the leaf target
          currTarget = parentMap.get(currTarget) || '';
        }
      }

      const finalClass = edgeClass
        ? `${edgeClass} ${defaultEdgeClass}`
        : defaultEdgeClass;
      edgePathsOutput += `<path d="${d}" class="${finalClass}" marker-end="${defaultArrow}"/>`;

      // Add edge label if available
      const edgeLabel = e.labels?.[0]?.text;
      if (edgeLabel) {
        let maxLen = -1;
        let longestSegStart = s.startPoint;
        let longestSegEnd = s.endPoint;

        let isVertical = false;

        for (let i = 0; i < pts.length - 1; i++) {
          const p1 = pts[i];
          const p2 = pts[i + 1];
          const len = Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y);
          if (len > maxLen) {
            maxLen = len;
            longestSegStart = p1;
            longestSegEnd = p2;
            isVertical = Math.abs(p1.y - p2.y) > Math.abs(p1.x - p2.x);
          }
        }

        const labelX =
          (longestSegStart.x + longestSegEnd.x) / 2 + (isVertical ? 6 : 0);
        const labelY =
          (longestSegStart.y + longestSegEnd.y) / 2 - (isVertical ? 0 : 6);

        let placed = false;
        let finalX = labelX,
          finalY = labelY;
        const textLen = edgeLabel.length * 6.5;
        const textW = isVertical ? 14 : textLen + 4;
        const textH = isVertical ? textLen + 4 : 14;

        const offsets = isVertical
          ? [
              { x: 0, y: 0 },
              { x: 16, y: 0 },
              { x: -16, y: 0 },
              { x: 32, y: 0 },
              { x: -32, y: 0 },
              { x: 0, y: textLen / 2 + 10 },
              { x: 0, y: -(textLen / 2 + 10) },
              { x: 48, y: 0 },
              { x: -48, y: 0 },
            ]
          : isOrthogonalLayout
            ? [
                { x: 0, y: 0 },
                { x: 0, y: 16 },
                { x: 0, y: 32 },
                { x: 0, y: 48 },
                { x: 0, y: -16 },
                { x: 0, y: -32 },
                { x: textLen / 2 + 10, y: 0 },
                { x: -(textLen / 2 + 10), y: 0 },
                { x: 0, y: 64 },
                { x: 0, y: -48 },
              ]
            : [
                { x: 0, y: 0 },
                { x: 0, y: 16 },
                { x: 0, y: -16 },
                { x: 0, y: 32 },
                { x: 0, y: -32 },
                { x: textLen / 2 + 10, y: 0 },
                { x: -(textLen / 2 + 10), y: 0 },
                { x: 0, y: 48 },
                { x: 0, y: -48 },
              ];

        for (const off of offsets) {
          const cx = labelX + off.x;
          const cy = labelY + off.y;

          const tLeft = cx - textW / 2;
          const tRight = cx + textW / 2;
          const tTop = cy - textH / 2;
          const tBottom = cy + textH / 2;

          const overlapsLabel = placedLabels.some((lb) => {
            return (
              tLeft <= lb.r && tRight >= lb.l && tTop <= lb.b && tBottom >= lb.t
            );
          });

          const overlapsNode = allNodeBoxes.some((b) => {
            if (b.isContainer) {
              // Check title banner + bottom/left/right borders
              const onTitle =
                tBottom > b.y &&
                tTop < b.y + 44 &&
                tRight > b.x &&
                tLeft < b.right;
              const onBottom =
                tBottom > b.bottom - 14 &&
                tTop < b.bottom &&
                tRight > b.x &&
                tLeft < b.right;
              const onLeft =
                tRight > b.x - 14 &&
                tLeft < b.x &&
                tBottom > b.y &&
                tTop < b.bottom;
              const onRight =
                tRight > b.right &&
                tLeft < b.right + 14 &&
                tBottom > b.y &&
                tTop < b.bottom;
              return onTitle || onBottom || onLeft || onRight;
            }

            // Solid block for leaf nodes
            return (
              tBottom > b.y &&
              tTop < b.bottom &&
              tRight > b.x &&
              tLeft < b.right
            );
          });

          const overlapsOtherEdge = edgeSegmentsCache.some((seg) => {
            if (seg.edgeId === e.id) return false;
            return (
              tLeft <= seg.sRight &&
              tRight >= seg.sLeft &&
              tTop <= seg.sBottom &&
              tBottom >= seg.sTop
            );
          });

          if (!overlapsLabel && !overlapsNode && !overlapsOtherEdge) {
            finalX = cx;
            finalY = cy;
            placed = true;
            break;
          }
        }

        if (!placed) {
          finalX = labelX;
          finalY = labelY + (isVertical ? 0 : 16);
        }

        const labelKey = `${finalX.toFixed(1)},${finalY.toFixed(1)},${edgeLabel}`;
        if (!processedLabelKeys.has(labelKey)) {
          processedLabelKeys.add(labelKey);
          placedLabels.push({
            l: finalX - textW / 2,
            r: finalX + textW / 2,
            t: finalY - textH / 2,
            b: finalY + textH / 2,
          });
          const transformAttr = isVertical
            ? ` transform="rotate(90 ${finalX} ${finalY})"`
            : '';
          edgeLabelsOutput += `<text x="${finalX}" y="${finalY}" class="edge-label" text-anchor="middle"${transformAttr}>${escapeXml(edgeLabel)}</text>`;
        }
      }
    });
  });

  const resolveNodeCost = (id: string): number | undefined => {
    if (!perServiceCosts) return undefined;
    return perServiceCosts[id];
  };

  const renderNode = async (
    node: ElkNode,
    offsetX = 0,
    offsetY = 0
  ): Promise<string> => {
    const nx = node.x || 0,
      ny = node.y || 0,
      nw = node.width || 0,
      nh = node.height || 0;

    const absX = nx + offsetX;
    const absY = ny + offsetY;

    const props = node.properties || {};
    const label = node.labels?.[0]?.text || '';
    const nodeId = node.id || '';
    const cost = resolveNodeCost(nodeId);
    const costLabel =
      cost !== undefined ? `💰 ${cost.toFixed(2)}/${period}` : '';

    const isLayoutContainer =
      props.type === 'container' &&
      /vpc|az|region|zone|subnet/.test(props.cssClass || '');

    const tooltips: string[] = [];
    if (!isLayoutContainer) {
      const comp = complianceTooltipMap?.[nodeId];
      if (comp) {
        if (comp.violations.length > 0) {
          tooltips.push(
            `⚠ Compliance Violations (${comp.frameworks.join(', ')}):`
          );
          comp.violations.forEach((v) => tooltips.push(`  • ${v}`));
        } else {
          tooltips.push(`✅ Compliant with: ${comp.frameworks.join(', ')}`);
        }
      }

      const opt = optimizationTooltipMap?.[nodeId];
      if (opt?.recommendations.length) {
        if (tooltips.length) tooltips.push('');
        tooltips.push(`💡 Optimization Suggestions:`);
        opt.recommendations.forEach((r) => tooltips.push(`  • ${r}`));
      }

      if (costLabel) {
        if (tooltips.length) tooltips.push('');
        tooltips.push(costLabel);
      }
    }

    let output = `<g id="node-${nodeId}">`;
    if (tooltips.length) {
      const tooltipText = tooltips.map(escapeXml).join('\n');
      output += `<title>${tooltipText}</title>`;
    }

    if (props.type === 'container') {
      const visualBounds = orthogonalContainerVisualBounds.get(nodeId);
      const containerX = visualBounds?.x ?? absX;
      const containerY = visualBounds?.y ?? absY;
      const containerW = visualBounds?.w ?? nw;
      const containerH = visualBounds?.h ?? nh;
      // Determine provider from cssClass
      const css = (props.cssClass || '') as string;
      const isGcpCont = css.includes('gcp');
      const isAzureCont = css.includes('azure');

      const labelCls = isAzureCont
        ? 'azure-container-label'
        : isGcpCont
          ? 'gcp-container-label'
          : 'aws-container-label';

      let rectClass = isGcpCont
        ? 'gcp-container'
        : isAzureCont
          ? 'azure-container'
          : 'aws-container';
      if (props.cssClass) rectClass += ` ${props.cssClass}`;
      // Note: complianceClass isn't defined here but exists in user logic,
      // I'll check if I need to calculate it. For now following prompt.
      // (Checking original code... it wasn't there but I'll add the hook)
      const comp = complianceTooltipMap?.[nodeId];
      const complianceClass = comp
        ? comp.violations.length > 0
          ? 'compliance-fail'
          : 'compliance-ok'
        : '';
      if (complianceClass) rectClass += ` ${complianceClass}`;

      const r = 14; // corner radius — consistent across all containers

      // 1. Container background + border
      output += `<rect x="${containerX}" y="${containerY}"
        width="${containerW}" height="${containerH}"
        class="${rectClass}"
        rx="${r}" ry="${r}"/>`;

      // 2. Label pill — standalone overlapping pill at the top-left
      const pillH = 28;
      const pillR = 14;

      const { displayLabel, actualLabelW } = calculateLabelDimensions(
        label,
        containerW
      );

      output += `<rect x="${containerX + 16}" y="${containerY - pillR}"
        width="${actualLabelW}" height="${pillH}"
        rx="${pillR}" ry="${pillR}"
        class="${rectClass} title-pill"/>`;

      output += `<text
        x="${containerX + 16 + actualLabelW / 2}" y="${containerY - pillR + pillH / 2}"
        class="${labelCls}"
        text-anchor="middle"
        dominant-baseline="middle">${escapeXml(displayLabel)}</text>`;

      // 4. Provider icon (top-right corner, 20×20)
      if (props.iconPath) {
        const iconUri = await getIconDataUri({ path: props.iconPath });
        if (iconUri) {
          output += `<image
            href="${iconUri}"
            x="${containerX + containerW - 28}" y="${containerY + 6}"
            width="20" height="20"
            preserveAspectRatio="xMidYMid meet"/>`;
        }
      }
    } else {
      const comp = complianceTooltipMap?.[nodeId];
      const complianceClass = comp
        ? comp.violations.length > 0
          ? 'compliance-fail'
          : 'compliance-ok'
        : '';

      // ── Constants ──────────────────────────────────────
      const ICON_SIZE = 42; // icon image size in px
      const ICON_BG_PAD = 5; // padding around icon background
      const CARD_W = nw;
      const CARD_H = nh;

      // Icon centered horizontally
      const iconX = absX + Math.round((CARD_W - ICON_SIZE) / 2);
      // Icon top margin: 10px from top of card
      const iconY = absY + 10;
      // Label starts 8px below icon bottom
      const labelStartY = iconY + ICON_SIZE + 9;

      // Provider detection for label class
      const rootCss = (layout.properties?.cssClass || '') as string;
      const isGcpLeaf = rootCss.includes('gcp');
      const isAzureLeaf = rootCss.includes('azure');
      const nodeLabelCls = isAzureLeaf
        ? 'azure-node-label'
        : isGcpLeaf
          ? 'gcp-node-label'
          : 'aws-node-label';

      // Compliance + base class
      let cardClass = 'node-card';
      if (complianceClass) cardClass += ` ${complianceClass}`;

      // ── Card background ─────────────────────────────────
      if (props.isStacked) {
        output += `<rect x="${absX + 8}" y="${absY - 8}"
          width="${CARD_W}" height="${CARD_H}"
          class="${cardClass}"
          rx="10" ry="10" fill-opacity="0.4" stroke-opacity="0.4"/>`;
        output += `<rect x="${absX + 4}" y="${absY - 4}"
          width="${CARD_W}" height="${CARD_H}"
          class="${cardClass}"
          rx="10" ry="10" fill-opacity="0.7" stroke-opacity="0.7"/>`;
      }

      output += `<rect x="${absX}" y="${absY}"
        width="${CARD_W}" height="${CARD_H}"
        class="${cardClass}"
        rx="10" ry="10"/>`;

      // ── Icon ─────────────────────────────────────────────
      const iconUri = await getIconDataUri({ path: props.iconPath });

      if (iconUri) {
        // Icon background pill
        output += `<rect
          x="${iconX - ICON_BG_PAD}"
          y="${iconY - ICON_BG_PAD}"
          width="${ICON_SIZE + ICON_BG_PAD * 2}"
          height="${ICON_SIZE + ICON_BG_PAD * 2}"
          rx="8" ry="8"
          class="node-icon-bg"/>`;
        output += `<image
          href="${iconUri}"
          x="${iconX}" y="${iconY}"
          width="${ICON_SIZE}" height="${ICON_SIZE}"
          preserveAspectRatio="xMidYMid meet"/>`;
      } else {
        // Fallback placeholder when no icon
        output += `<rect
          x="${iconX}" y="${iconY}"
          width="${ICON_SIZE}" height="${ICON_SIZE}"
          rx="8" ry="8"
          fill="#EDF2F7" stroke="#CBD5E1"
          stroke-width="1"/>`;
        // Placeholder "?" text
        output += `<text
          x="${iconX + ICON_SIZE / 2}"
          y="${iconY + ICON_SIZE / 2 + 1}"
          class="${nodeLabelCls}"
          text-anchor="middle"
          dominant-baseline="middle"
          fill="#94A3B8"
          font-size="16" font-weight="300">?</text>`;
      }

      // ── Cost badge (bottom-right, only if cost exists) ──
      if (cost !== undefined) {
        const badgeTxt = `$${cost.toFixed(2)}`;
        const badgeW = badgeTxt.length * 5.5 + 8;
        const badgeH = 14;
        const badgeX = absX + CARD_W - badgeW - 4;
        const badgeY = absY + CARD_H - badgeH - 4;
        output += `<rect
          x="${badgeX}" y="${badgeY}"
          width="${badgeW}" height="${badgeH}"
          rx="3" ry="3"
          fill="#1E293B"/>`;
        output += `<text
          x="${badgeX + badgeW / 2}"
          y="${badgeY + badgeH / 2 + 1}"
          class="cost-badge-text"
          text-anchor="middle"
          dominant-baseline="middle">${escapeXml(badgeTxt)}</text>`;
      }

      // ── Label (1 or 2 lines, centered) ──────────────────
      // Max label width = card width minus 6px padding each side
      const maxLabelChars = Math.floor((CARD_W - 12) / 6.0);

      // Word-wrap: try to split into max 2 lines at word boundary
      const words = label.split(' ');
      let line1 = label;
      let line2 = '';

      if (label.length > maxLabelChars && words.length > 1) {
        // Find split point that keeps both lines under maxLabelChars
        let bestSplit = Math.ceil(words.length / 2);
        for (let s = 1; s < words.length; s++) {
          const l1 = words.slice(0, s).join(' ');
          const l2 = words.slice(s).join(' ');
          if (l1.length <= maxLabelChars && l2.length <= maxLabelChars) {
            bestSplit = s;
            break;
          }
        }
        line1 = words.slice(0, bestSplit).join(' ');
        line2 = words.slice(bestSplit).join(' ');
      }

      // Truncate if still too long
      const truncate = (t: string) =>
        t.length > maxLabelChars + 2
          ? t.substring(0, maxLabelChars).trim() + '…'
          : t;

      const LINE_H = 13; // line height in px
      // If two lines, shift first line up by half LINE_H to center block
      const line1Y = line2
        ? labelStartY + Math.round(LINE_H / 2) - 2
        : labelStartY + 4;
      const line2Y = line1Y + LINE_H;

      output += `<text
        x="${absX + CARD_W / 2}" y="${line1Y}"
        class="${nodeLabelCls}"
        text-anchor="middle"
        dominant-baseline="auto">${escapeXml(truncate(line1))}</text>`;

      if (line2) {
        output += `<text
          x="${absX + CARD_W / 2}" y="${line2Y}"
          class="${nodeLabelCls}"
          text-anchor="middle"
          dominant-baseline="auto">${escapeXml(truncate(line2))}</text>`;
      }

      const contents: string[] = node?.properties?.contents || [];

      if (contents.length > 0) {
        const GROUP_PADDING = 16; // padding from card edge
        const INNER_PADDING = 12; // padding inside dashed border
        const ITEM_H = 26;
        const ITEM_GAP = 10;

        const groupX = absX + GROUP_PADDING;
        const groupY = line2Y + 18;
        const groupW = CARD_W - GROUP_PADDING * 2;

        const ITEM_W = groupW - INNER_PADDING * 2;

        const groupHeight =
          INNER_PADDING * 2 +
          contents.length * ITEM_H +
          Math.max(0, contents.length - 1) * ITEM_GAP;

        // Dashed container
        output += `<rect
              x="${groupX}"
              y="${groupY}"
              width="${groupW}"
              height="${groupHeight}"
              rx="4"
              ry="4"
              fill="none"
              stroke="#d2d2d2"
              stroke-dasharray="4 4"
            />
        `;

        let itemY = groupY + INNER_PADDING;

        contents.forEach((text) => {
          output += `<rect
                x="${groupX + INNER_PADDING}"
                y="${itemY}"
                width="${ITEM_W}"
                height="${ITEM_H}"
                rx="3"
                ry="3"
                class="content-box"
              />
            
              <text
                x="${groupX + groupW / 2}"
                y="${itemY + ITEM_H / 2}"
                class="contents"
                text-anchor="middle"
                dominant-baseline="middle">
                ${text}
              </text>
           `;

          itemY += ITEM_H + ITEM_GAP;
        });
      }
    }

    for (const c of node.children ?? []) {
      output += await renderNode(c, absX, absY);
    }
    output += '</g>';
    return output;
  };

  const provider = getProvider(layout);
  const arrowMarkerDefs =
    provider === 'gcp'
      ? `<marker id="arrow-gcp" viewBox="0 0 10 10"
      refX="9" refY="5"
      markerWidth="5" markerHeight="5"
      orient="auto-start-reverse">
      <path d="M0,1.5 L8.5,5 L0,8.5 Z"
        fill="#4285F4" stroke="none" fill-opacity="0.85"/>
    </marker>`
      : provider === 'azure'
        ? `<marker id="arrow-azure" viewBox="0 0 10 10"
      refX="9" refY="5"
      markerWidth="5" markerHeight="5"
      orient="auto-start-reverse">
      <path d="M0,1.5 L8.5,5 L0,8.5 Z"
        fill="#0078D4" stroke="none" fill-opacity="0.85"/>
    </marker>`
        : `<marker id="arrow" viewBox="0 0 10 10"
      refX="9" refY="5"
      markerWidth="5" markerHeight="5"
      orient="auto-start-reverse">
      <path d="M0,1.5 L8.5,5 L0,8.5 Z"
        fill="#8FA3BF" stroke="none"/>
    </marker>`;
  const rootRect = `<rect width="${width}" height="${height}" class="${provider}-root" />
                    <rect width="${width}" height="${height}" fill="url(#dotGrid)" pointer-events="none" />`;

  const nodesOutput = (
    await Promise.all((layout.children ?? []).map((n) => renderNode(n)))
  ).join('');

  // ── Legend ──
  const renderLegend = () => {
    const LEGEND_W = 160;
    const LEGEND_H = 80;
    // Legend bounds check: push left if there's a container collision.
    // For orthogonal, only leaf node cards count as a collision — container
    // backgrounds are a pale translucent wash (see `.aws-container { fill:
    // none }` plus a light per-type tint), not solid content, so the legend
    // sitting on top of one is harmless. Treating them as obstacles was
    // pushing the legend away from its default bottom-right corner (which
    // sits inside the outermost wrapper container that spans nearly the
    // whole canvas) all the way up next to whatever small node happens to
    // be at the top — usually the diagram's own entry point. custom/elk
    // keep the original behavior.
    const legendObstacles = isOrthogonalLayout
      ? allNodeBoxes.filter((box) => !box.isContainer)
      : allNodeBoxes;
    let LX = width - LEGEND_W - 20;
    let LY = height - LEGEND_H - 20;
    const legendOverlaps = (box: (typeof allNodeBoxes)[number]) =>
      LY < box.bottom &&
      LY + LEGEND_H > box.y &&
      LX < box.right &&
      LX + LEGEND_W > box.x;

    for (const box of legendObstacles) {
      if (legendOverlaps(box)) {
        LX = box.x - LEGEND_W - 20; // push outside container
      }
    }
    // Clamp legend to visible area — never render at negative coords
    if (LX < 20) LX = 20;
    // If clamped position still overlaps, try above the blocking box, then top-left.
    const blockingBox = legendObstacles.find((box) => legendOverlaps(box));
    if (blockingBox) {
      LY = Math.max(20, blockingBox.y - LEGEND_H - 20);
      if (legendObstacles.some((box) => legendOverlaps(box))) {
        LY = 20;
      }
    }
    const maxLegendY = Math.max(20, height - LEGEND_H - 20);
    const candidatePositions = isOrthogonalLayout
      ? // Prefer bottom-left outright, then scan upward only as far as
        // needed to clear a leaf node — the opposite order from custom/elk
        // below, which scan from the top and so tend to settle near the
        // diagram's entry point instead of the bottom corner.
        [
          { x: 20, y: maxLegendY },
          { x: LX, y: LY },
        ]
      : [
          { x: LX, y: LY },
          { x: 20, y: LY },
          { x: width - LEGEND_W - 20, y: 20 },
          { x: 20, y: 20 },
        ];
    if (isOrthogonalLayout) {
      for (let y = maxLegendY; y >= 20; y -= 20) {
        candidatePositions.push({ x: 20, y });
        candidatePositions.push({ x: width - LEGEND_W - 20, y });
      }
    } else {
      for (let y = 20; y <= maxLegendY; y += 20) {
        candidatePositions.push({ x: 20, y });
        candidatePositions.push({ x: width - LEGEND_W - 20, y });
      }
    }
    const clearPosition = candidatePositions.find((candidate) => {
      LX = Math.max(20, Math.min(candidate.x, width - LEGEND_W - 20));
      LY = Math.max(20, Math.min(candidate.y, maxLegendY));
      return !legendObstacles.some((box) => legendOverlaps(box));
    });
    if (clearPosition) {
      LX = Math.max(20, Math.min(clearPosition.x, width - LEGEND_W - 20));
      LY = Math.max(20, Math.min(clearPosition.y, maxLegendY));
    }
    const edgeColor =
      provider === 'gcp'
        ? '#4285F4'
        : provider === 'azure'
          ? '#0078D4'
          : '#8FA3BF';
    const items = [
      { color: edgeColor, label: 'Relationship' },
      { color: '#16A34A', label: 'Compliant' },
      { color: '#DC2626', label: 'Non-Compliant' },
    ];
    let legendContent = `<rect x="${LX}" y="${LY}" width="${LEGEND_W}" height="${LEGEND_H}" class="legend-box" />`;
    legendContent += `<text x="${LX + 10}" y="${LY + 22}" class="legend-title">Legend</text>`;
    items.forEach((item, i) => {
      const iy = LY + 42 + i * 14;
      legendContent += `<line x1="${LX + 10}" y1="${iy}" x2="${LX + 30}" y2="${iy}" stroke="${item.color}" stroke-width="2" />`;
      legendContent += `<text x="${LX + 35}" y="${iy + 4}" class="legend-item-text">${item.label}</text>`;
    });
    return `<g id="legend">${legendContent}</g>`;
  };
  const legendOutput = renderLegend();

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" data-layout="${escapeXml(layoutEngine)}" style="width: 100%; height: auto; max-width: 100%; background-color: #EEF2F7;">
  <defs>
    <style>${CSS_STYLES}</style>

    <!-- Dotted Grid Pattern -->
    <pattern id="dotGrid" width="24" height="24" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.5" fill="#CBD5E1" opacity="0.6"/>
    </pattern>

    <!-- Container drop shadow: soft, barely visible -->
    <filter id="containerShadow"
      x="-8%" y="-8%" width="116%" height="116%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="4"/>
      <feOffset dx="0" dy="2" result="blur"/>
      <feFlood flood-color="#000000" flood-opacity="0.06"/>
      <feComposite in2="blur" operator="in" result="shadow"/>
      <feMerge>
        <feMergeNode in="shadow"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <!-- Node card shadow: tight, crisp -->
    <filter id="nodeShadow"
      x="-15%" y="-15%" width="130%" height="130%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
      <feOffset dx="0" dy="1" result="blur"/>
      <feFlood flood-color="#000000" flood-opacity="0.08"/>
      <feComposite in2="blur" operator="in" result="shadow"/>
      <feMerge>
        <feMergeNode in="shadow"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <!-- Compliance OK: green ring glow -->
    <filter id="glowGreen"
      x="-15%" y="-15%" width="130%" height="130%">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feFlood flood-color="#16A34A" flood-opacity="0.4"
        result="color"/>
      <feComposite in="color" in2="blur" operator="in"
        result="glow"/>
      <feMerge>
        <feMergeNode in="glow"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <!-- Compliance FAIL: red ring glow -->
    <filter id="glowRed"
      x="-15%" y="-15%" width="130%" height="130%">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feFlood flood-color="#DC2626" flood-opacity="0.4"
        result="color"/>
      <feComposite in="color" in2="blur" operator="in"
        result="glow"/>
      <feMerge>
        <feMergeNode in="glow"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <!-- Arrow marker for the active provider only -->
    ${arrowMarkerDefs}
  </defs>
  ${rootRect}${nodesOutput}${edgePathsOutput}${edgeLabelsOutput}${legendOutput}
</svg>`;
}
