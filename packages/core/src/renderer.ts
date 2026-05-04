import ELK from 'elkjs';
import { ElkNode, ElkEdge } from '@mindfiredigital/adac-layout-elk';
import fs from 'fs-extra';
import { layoutDagre } from '@mindfiredigital/adac-layout-dagre';

const CSS_STYLES = `
  /* ── Modern Design System ─────────────────────────────────────────── */
  :root {
    --bg-white: #ffffff;
    --text-main: #232f3e;
    --text-muted: #545b64;
    
    /* AWS Colors */
    --aws-orange: #ff9900;
    --aws-blue: #232f3e;
    --aws-purple: #8C4FFF;
    --aws-green: #6cae6c;
    --aws-light-blue: #007dbc;
    
    /* GCP Colors */
    --gcp-blue: #4285F4;
    --gcp-green: #34A853;
    --gcp-red: #EA4335;
    --gcp-yellow: #FBBC04;
  }

  svg {
    font-variant-ligatures: none;
    text-rendering: optimizeLegibility;
    shape-rendering: geometricPrecision;
  }

  /* ── AWS Styles ──────────────────────────────────────────────────── */
  .aws-container { fill: none; stroke-width: 1.5px; }
  .aws-root { fill: #f8fafc; stroke: none; }
  .aws-vpc { fill: #ffffff; stroke: var(--aws-purple); stroke-dasharray: 8,4; stroke-width: 2.5px; filter: url(#softShadow); }
  .aws-az { fill: #f8fafc; fill-opacity: 0.5; stroke: #94a3b8; stroke-dasharray: 4,4; stroke-width: 1px; }
  .aws-subnet-public { fill: #f0fdf4; stroke: #22c55e; stroke-dasharray: 4,2; } 
  .aws-subnet-private { fill: #f0f9ff; stroke: #0ea5e9; stroke-dasharray: 4,2; }
  .aws-compute-cluster { fill: #fff; stroke: var(--aws-orange); stroke-dasharray: 4,4; stroke-width: 1.5px; }
  .aws-label { font-family: "Amazon Ember", "Inter", sans-serif; font-size: 14px; fill: var(--text-main); font-weight: 800; letter-spacing: -0.01em; }
  .aws-label-sm { font-family: "Amazon Ember", "Inter", sans-serif; font-size: 12px; fill: var(--text-muted); font-weight: 600; }
  .aws-edge { stroke: #64748b; stroke-width: 2px; fill: none; transition: stroke 0.3s; }

  /* ── GCP Styles ──────────────────────────────────────────────────── */
  .gcp-vpc {
    fill: #f5f8ff;
    stroke: var(--gcp-blue);
    stroke-dasharray: 8, 4;
    stroke-width: 2px;
    filter: url(#softShadow);
  }

  .gcp-region {
    fill: #f6fdf8;
    stroke: var(--gcp-green);
    stroke-dasharray: 6, 3;
    stroke-width: 2px;
  }

  .gcp-zone {
    fill: #f0f6ff;
    stroke: var(--gcp-blue);
    stroke-width: 1.2px;
    stroke-dasharray: 4, 4;
    fill-opacity: 0.5;
  }

  .gcp-subnet {
    fill: #e8f0fe;
    stroke: var(--gcp-blue);
    stroke-width: 1.5px;
  }

  .gcp-compute-cluster {
    fill: #fff8f0;
    stroke: #FF6D00;
    stroke-dasharray: 4, 4;
    stroke-width: 1.5px;
  }

  .gcp-label {
    font-family: "Google Sans", "Product Sans", Roboto, sans-serif;
    font-size: 14px;
    fill: #202124;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  .gcp-label-sm {
    font-family: "Google Sans", "Product Sans", Roboto, sans-serif;
    font-size: 12px;
    fill: #5f6368;
    font-weight: 400;
  }

  .gcp-edge { stroke: var(--gcp-blue); stroke-width: 1.5px; fill: none; }

  /* ── Service Node Styles ─────────────────────────────────────────── */
  .service-node-bg {
    fill: #ffffff;
    stroke: #e2e8f0;
    stroke-width: 1px;
    filter: url(#nodeShadow);
  }
  
  .compliance-ok {
    filter: url(#glowGreen);
  }
  
  .compliance-fail {
    filter: url(#glowRed);
  }
`;

export async function renderSvg(
  graph: ElkNode,
  layoutEngine: 'elk' | 'dagre' = 'elk',
  complianceTooltipMap?: Record<
    string,
    { frameworks: string[]; violations: string[] }
  >,
  perServiceCosts?: Record<string, number>,
  period: 'hourly' | 'daily' | 'monthly' | 'yearly' = 'monthly'
): Promise<string> {
  const elk = new (ELK as unknown as {
    new (): { layout: (graph: ElkNode) => Promise<ElkNode> };
  })();

  // Layout Strategy
  let layout: ElkNode;

  if (layoutEngine === 'dagre') {
    layout = await layoutDagre(graph);
  } else {
    // ELK Layout with Architectural Rules
    const layoutOptions = {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNode': '60',
      'elk.spacing.componentComponent': '80',
      'elk.layered.spacing.nodeNodeLayered': '80',
      'elk.padding': '[top=60,left=40,bottom=40,right=40]',
      'org.eclipse.elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      ...(graph.layoutOptions || {}),
    };
    graph.layoutOptions = layoutOptions;
    layout = (await elk.layout(graph)) as ElkNode;
  }

  // --- Normalization Start ---
  const padding = 20;
  if (layout.children && layout.children.length > 0) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    layout.children.forEach((child: ElkNode) => {
      const cx = child.x || 0;
      const cy = child.y || 0;
      const cw = child.width || 0;
      const ch = child.height || 0;
      if (cx < minX) minX = cx;
      if (cy < minY) minY = cy;
      if (cx + cw > maxX) maxX = cx + cw;
      if (cy + ch > maxY) maxY = cy + ch;
    });

    if (minX !== Infinity) {
      const shiftX = -minX + padding;
      const shiftY = -minY + padding;

      layout.children.forEach((child: ElkNode) => {
        if (child.x !== undefined) child.x += shiftX;
        if (child.y !== undefined) child.y += shiftY;
      });

      layout.width = maxX - minX + 2 * padding;
      layout.height = maxY - minY + 2 * padding;
    }
  }
  // --- Normalization End ---

  const width = layout.width || 800;
  const height = layout.height || 600;

  // Helper to read Icon as Base64
  const getIconDataUri = (params: { path?: string }) => {
    if (!params.path || !fs.existsSync(params.path)) return null;
    try {
      const data = fs.readFileSync(params.path);
      const b64 = data.toString('base64');
      const ext = params.path.split('.').pop()?.toLowerCase();
      let mime = 'image/svg+xml';
      if (ext === 'png') mime = 'image/png';
      else if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
      return `data:${mime};base64,${b64}`;
    } catch (e) {
      console.warn(`Failed to read icon: ${params.path}`, e);
      return null;
    }
  };

  const nodeAbsPos = new Map<string, { x: number; y: number }>();

  const mapNodePositions = (
    node: ElkNode,
    offsetX: number,
    offsetY: number
  ) => {
    const currentX = offsetX + (node.x || 0);
    const currentY = offsetY + (node.y || 0);

    nodeAbsPos.set(node.id, { x: currentX, y: currentY });

    if (node.children) {
      node.children.forEach((child: ElkNode) =>
        mapNodePositions(child, currentX, currentY)
      );
    }
  };

  mapNodePositions(layout, 0, 0);

  const allEdges: ElkEdge[] = [];
  const processedEdgeIds = new Set<string>();

  const collectAndTransformEdges = (node: ElkNode) => {
    if (node.edges) {
      node.edges.forEach((edge: ElkEdge) => {
        if (edge.id && processedEdgeIds.has(edge.id)) return;
        if (edge.id) processedEdgeIds.add(edge.id);

        const containerId = edge.container;
        let containerOffset = { x: 0, y: 0 };

        if (containerId && nodeAbsPos.has(containerId)) {
          containerOffset = nodeAbsPos.get(containerId)!;
        } else if (nodeAbsPos.has(node.id)) {
          containerOffset = nodeAbsPos.get(node.id)!;
        }

        const globalEdge: ElkEdge = JSON.parse(JSON.stringify(edge));
        if (globalEdge.sections) {
          globalEdge.sections.forEach((sec) => {
            sec.startPoint.x += containerOffset.x;
            sec.startPoint.y += containerOffset.y;
            sec.endPoint.x += containerOffset.x;
            sec.endPoint.y += containerOffset.y;
            if (sec.bendPoints) {
              sec.bendPoints.forEach((bp) => {
                bp.x += containerOffset.x;
                bp.y += containerOffset.y;
              });
            }
          });
        }
        allEdges.push(globalEdge);
      });
    }
    if (node.children) {
      node.children.forEach((child: ElkNode) =>
        collectAndTransformEdges(child)
      );
    }
  };

  collectAndTransformEdges(layout);

  const defaultEdgeClass = layout.properties?.cssClass?.includes('gcp')
    ? 'gcp-edge'
    : 'aws-edge';

  let edgesOutput = '';
  allEdges.forEach((edge) => {
    if (edge.sections) {
      edge.sections.forEach((sec) => {
        let d = `M ${sec.startPoint.x} ${sec.startPoint.y}`;
        if (sec.bendPoints) {
          sec.bendPoints.forEach((bp) => {
            d += ` L ${bp.x} ${bp.y}`;
          });
        }
        d += ` L ${sec.endPoint.x} ${sec.endPoint.y}`;
        edgesOutput += `<path d="${d}" class="${defaultEdgeClass}" marker-end="url(#arrow)" />`;
      });
    }
  });

  const resolveNodeCost = (nodeId: string): number | undefined => {
    if (!perServiceCosts) return undefined;

    if (perServiceCosts[nodeId] !== undefined) {
      return perServiceCosts[nodeId];
    }

    const match = Object.entries(perServiceCosts).find(
      ([k]) => nodeId === k || nodeId.endsWith(k) || k.endsWith(nodeId)
    );

    return match?.[1];
  };

  const renderNode = (node: ElkNode): string => {
    let output = '';
    const nodeX = node.x || 0;
    const nodeY = node.y || 0;
    const nodeW = node.width || 0;
    const nodeH = node.height || 0;

    const props = node.properties || {};
    const label =
      node.labels && node.labels.length > 0 ? node.labels[0].text : '';

    const cost = resolveNodeCost(node.id);
    const costLabel =
      cost !== undefined ? `💰 ${cost.toFixed(2)}/${period}` : '';

    const escapeXml = (unsafe: string) => {
      const escapeMap: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        "'": '&apos;',
        '"': '&quot;',
      };
      return unsafe.replace(/[<>&'"]/g, (c) => escapeMap[c]);
    };

    const renderLabel = (
      text: string,
      x: number,
      y: number,
      cssClass: string,
      maxWidth: number,
      textAnchor: 'start' | 'middle' | 'end' = 'start'
    ) => {
      if (!text) return '';
      const charWidth = 7.5;
      const maxChars = Math.floor(maxWidth / charWidth);

      let displayText = text;
      if (text.length > maxChars + 2) {
        displayText = text.substring(0, maxChars).trim() + '...';
      }

      return `<text x="${x}" y="${y}" class="${cssClass}" text-anchor="${textAnchor}">${escapeXml(displayText)}</text>`;
    };

    output += `<g transform="translate(${nodeX}, ${nodeY})">`;

    let tooltipTitle = '';
    let complianceClass = '';
    const nodeId = (props as { id?: string }).id || node.id || '';

    // Apply compliance tooltip to any node that appears in the map.
    // Only skip pure layout containers (vpc, az, subnet) — they are never services.
    const isLayoutContainer =
      props.type === 'container' &&
      (props.cssClass === 'aws-vpc' ||
        props.cssClass === 'aws-az' ||
        props.cssClass === 'gcp-vpc' ||
        props.cssClass === 'gcp-region' ||
        props.cssClass === 'gcp-zone' ||
        props.cssClass === 'gcp-subnet' ||
        (typeof props.cssClass === 'string' &&
          (props.cssClass.includes('aws-subnet') ||
            props.cssClass.includes('gcp-subnet'))));

    if (complianceTooltipMap && !isLayoutContainer) {
      const entry = complianceTooltipMap[nodeId];
      if (entry) {
        if (entry.violations.length > 0) {
          tooltipTitle = `⚠ Compliance Violations (${entry.frameworks.join(', ')}): ${entry.violations.join(' | ')}`;
          complianceClass = 'compliance-fail';
        } else {
          tooltipTitle = `✅ Compliant with: ${entry.frameworks.join(', ')}`;
          complianceClass = 'compliance-ok';
        }
      }
    }

    let complianceLine = '';
    if (tooltipTitle) {
      complianceLine = escapeXml(tooltipTitle);
    }
    const costLine = costLabel ? escapeXml(costLabel) : '';
    if (complianceLine || costLine) {
      output += `<title>${[complianceLine, costLine].filter(Boolean).join('\n')}</title>`;
    }

    if (props.type === 'container') {
      let rectClass = 'aws-container';
      if (props.cssClass) rectClass += ` ${props.cssClass}`;
      if (complianceClass) rectClass += ` ${complianceClass}`;

      const labelClass = props.cssClass?.includes('gcp')
        ? 'gcp-label'
        : 'aws-label';

      output += `<rect width="${nodeW}" height="${nodeH}" class="${rectClass}" rx="12" ry="12" stroke-width="2" />`;
      output += renderLabel(label, 12, 25, labelClass, nodeW - 40, 'start');

      if (props.iconPath) {
        const iconUri = getIconDataUri({ path: props.iconPath });
        if (iconUri) {
          output += `<image href="${iconUri}" x="${nodeW - 32}" y="8" width="24" height="24" />`;
        }
      }

      if (node.children) {
        node.children.forEach((child: ElkNode) => {
          output += renderNode(child);
        });
      }
    } else {
      const iconUri = getIconDataUri({ path: props.iconPath });
      const iy = 12;
      const textY = 78;

      let rectClass = 'service-node-bg';
      if (complianceClass) rectClass += ` ${complianceClass}`;

      output += `<rect width="${nodeW}" height="${nodeH}" class="${rectClass}" rx="8" ry="8" />`;

      if (iconUri) {
        const ix = (nodeW - 48) / 2;
        // Background for icon to make it pop
        output += `<rect x="${ix - 2}" y="${iy - 2}" width="52" height="52" rx="6" ry="6" fill="#f8fafc" />`;
        output += `<image href="${iconUri}" x="${ix}" y="${iy}" width="48" height="48" />`;
      } else {
        output += `<rect width="${nodeW}" height="${nodeH}" fill="#f1f5f9" stroke="#cbd5e1" rx="8" ry="8" />`;
      }

      const labelSmClass = layout.properties?.cssClass?.includes('gcp')
        ? 'gcp-label-sm'
        : 'aws-label-sm';

      const words = label.split(' ');
      let line1 = label;
      let line2 = '';
      if (words.length > 2 || label.length > 14) {
        const mid = Math.ceil(words.length / 2);
        if (words.length > 1) {
          line1 = words.slice(0, mid).join(' ');
          line2 = words.slice(mid).join(' ');
        }
      }

      output += renderLabel(
        line1,
        nodeW / 2,
        textY,
        labelSmClass,
        nodeW - 10,
        'middle'
      );
      if (line2) {
        output += renderLabel(
          line2,
          nodeW / 2,
          textY + 14,
          labelSmClass,
          nodeW - 10,
          'middle'
        );
      }
    }

    output += `</g>`;
    return output;
  };

  const svgContent = renderNode(layout) + edgesOutput;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="width: 100%; height: auto; max-width: 100%; background-color: white;">
    <defs>
      <style>${CSS_STYLES}</style>
      <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
        <feOffset dx="1" dy="2" result="offsetblur" />
        <feComponentTransfer>
          <feFuncA type="linear" slope="0.2" />
        </feComponentTransfer>
        <feMerge>
          <feMergeNode />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="nodeShadow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
        <feOffset dx="0" dy="1" result="offsetblur" />
        <feComponentTransfer>
          <feFuncA type="linear" slope="0.15" />
        </feComponentTransfer>
        <feMerge>
          <feMergeNode />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glowGreen" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
        <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      <filter id="glowRed" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
        <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5"
        markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
      </marker>
      <marker id="arrow-gcp" viewBox="0 0 10 10" refX="9" refY="5"
        markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#4285F4" />
      </marker>
    </defs>
    ${svgContent}
  </svg>`;
}
