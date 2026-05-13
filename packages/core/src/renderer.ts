import fs from 'fs-extra';
import ELK from 'elkjs';
import { type ElkNode, type ElkEdge } from '@mindfiredigital/adac-layout-elk';
import { layoutDagre } from '@mindfiredigital/adac-layout-dagre';

const CSS_STYLES = `
  .aws-container { fill: #f2f3f3; stroke: #232f3e; stroke-width: 2px; }
  .aws-vpc { fill: #fff; stroke: #232f3e; stroke-dasharray: 5,5; }
  .aws-az { fill: #fff; stroke: #007dbc; stroke-dasharray: 5,5; }
  .aws-subnet { fill: #fff; stroke: #00a1c9; }
  .aws-root { fill: #f2f3f3; stroke: none; }
  
  .azure-container { fill: #f2f3f3; stroke: #0078d4; stroke-width: 2px; }
  .azure-vnet { fill: #fff; stroke: #0078d4; stroke-dasharray: 5,5; }
  .azure-root { fill: #f2f3f3; stroke: none; }
  
  .gcp-container { fill: #f8f9fa; stroke: #5f6368; stroke-width: 2px; }
  .gcp-vpc { fill: #fff; stroke: #4285f4; stroke-dasharray: 5,5; }
  .gcp-root { fill: #f8f9fa; stroke: none; }
  
  .service-node { fill: #ffffff; stroke: #d5dbdb; stroke-width: 1px; }
  .aws-label { font-family: "Amazon Ember", Arial, sans-serif; font-size: 14px; font-weight: bold; fill: #232f3e; }
  .aws-label-sm { font-family: "Amazon Ember", Arial, sans-serif; font-size: 11px; fill: #545b64; }
  .aws-edge { stroke: #879196; stroke-width: 2px; fill: none; }
  
  .azure-label { font-family: "Segoe UI", Arial, sans-serif; font-size: 14px; font-weight: bold; fill: #0078d4; }
  .azure-label-sm { font-family: "Segoe UI", Arial, sans-serif; font-size: 11px; fill: #323130; }
  .azure-edge { stroke: #0078d4; stroke-width: 2px; fill: none; }

  .gcp-label { font-family: "Google Sans", Arial, sans-serif; font-size: 14px; font-weight: bold; fill: #3c4043; }
  .gcp-label-sm { font-family: "Google Sans", Arial, sans-serif; font-size: 11px; fill: #5f6368; }
  .gcp-edge { stroke: #4285f4; stroke-width: 2px; fill: none; }
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

export async function renderSvg(
  graph: ElkNode,
  layoutEngine: 'elk' | 'dagre' = 'elk',
  complianceTooltipMap?: Record<
    string,
    { frameworks: string[]; violations: string[] }
  >,
  optimizationTooltipMap?: Record<string, { recommendations: string[] }>,
  perServiceCosts?: Record<string, number>,
  period: 'hourly' | 'daily' | 'monthly' | 'yearly' = 'monthly'
): Promise<string> {
  const elk = new (ELK as unknown as {
    new (): { layout: (graph: ElkNode) => Promise<ElkNode> };
  })();

  const layout =
    layoutEngine === 'dagre'
      ? await layoutDagre(graph)
      : ((await elk.layout(graph)) as ElkNode);

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
    if (minX !== Infinity) {
      const shiftX = -minX + padding,
        shiftY = -minY + padding;
      layout.children.forEach((c) => {
        if (c.x !== undefined) c.x += shiftX;
        if (c.y !== undefined) c.y += shiftY;
      });
      layout.width = maxX - minX + 2 * padding;
      layout.height = maxY - minY + 2 * padding;
    }
  }

  const width = layout.width || 800;
  const height = layout.height || 600;

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
  const mapNodePositions = (n: ElkNode, ox: number, oy: number) => {
    const cx = ox + (n.x || 0),
      cy = oy + (n.y || 0);
    nodeAbsPos.set(n.id, { x: cx, y: cy });
    if (n.children) n.children.forEach((c) => mapNodePositions(c, cx, cy));
  };
  mapNodePositions(layout, 0, 0);

  const allEdges: ElkEdge[] = [];
  const processedEdgeIds = new Set<string>();
  const collectEdges = (n: ElkNode) => {
    if (n.edges) {
      n.edges.forEach((e) => {
        if (e.id && processedEdgeIds.has(e.id)) return;
        if (e.id) processedEdgeIds.add(e.id);
        const containerOffset = nodeAbsPos.get(e.container || n.id) || {
          x: 0,
          y: 0,
        };
        const ge: ElkEdge = structuredClone(e);
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

  const edgesOutput = allEdges
    .map((e) => {
      return (e.sections || [])
        .map((s) => {
          let d = `M ${s.startPoint.x} ${s.startPoint.y}`;
          s.bendPoints?.forEach((b) => (d += ` L ${b.x} ${b.y}`));
          d += ` L ${s.endPoint.x} ${s.endPoint.y}`;
          const provider = getProvider(layout);
          return `<path d="${d}" class="${provider}-edge" marker-end="url(#arrow)" />`;
        })
        .join('');
    })
    .join('');

  const resolveNodeCost = (id: string): number | undefined => {
    if (!perServiceCosts) return undefined;
    return perServiceCosts[id];
  };

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

  const renderNode = (node: ElkNode): string => {
    const nx = node.x || 0,
      ny = node.y || 0,
      nw = node.width || 0,
      nh = node.height || 0;
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

    let output = `<g id="node-${nodeId}" transform="translate(${nx}, ${ny})">`;
    if (tooltips.length) {
      const tooltipText = tooltips.map(escapeXml).join('\n');
      output += `<title>${tooltipText}</title>`;
    }

    if (props.type === 'container') {
      const p = getProvider(node);
      const cls = `${p}-container${node === layout ? ` ${getProvider(layout)}-root` : ''}${props.cssClass ? ` ${props.cssClass}` : ''}`;
      output += `<rect width="${nw}" height="${nh}" class="${cls}" rx="4" ry="4" stroke-width="2" />`;
      output += `<text x="${nw / 2}" y="25" class="${p}-label" text-anchor="middle">${escapeXml(label)}</text>`;
      if (props.iconPath) {
        const icon = getIconDataUri({ path: props.iconPath });
        if (icon)
          output += `<image href="${icon}" x="${nw - 30}" y="5" width="24" height="24" />`;
      }
    } else {
      const p = getProvider(node);
      output += `<rect width="${nw}" height="${nh}" class="service-node" rx="8" ry="8" />`;
      if (props.iconPath) {
        const icon = getIconDataUri({ path: props.iconPath });
        if (icon)
          output += `<image href="${icon}" x="${(nw - 48) / 2}" y="15" width="48" height="48" />`;
      }
      output += `<text x="${nw / 2}" y="75" class="${p}-label-sm" text-anchor="middle">${escapeXml(label)}</text>`;
    }
    node.children?.forEach((c) => (output += renderNode(c)));
    output += '</g>';
    return output;
  };

  const provider = getProvider(layout);
  const rootRect = `<rect width="${width}" height="${height}" class="${provider}-root" />`;
  const nodesOutput = (layout.children || []).map(renderNode).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orientation="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L9,3 z" fill="#888" />
    </marker>
    <style>${CSS_STYLES}</style>
  </defs>
  ${rootRect}${nodesOutput}${edgesOutput}
</svg>`;
}
