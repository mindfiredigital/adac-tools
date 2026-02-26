import ELK from 'elkjs';
import { ElkNode, ElkEdge } from '@mindfiredigital/adac-layout-elk';
import fs from 'fs-extra';
import { layoutDagre } from '@mindfiredigital/adac-layout-dagre';

const CSS_STYLES = `
  .aws-container { fill: none; stroke-width: 2px; }
  .aws-root { fill: #ffffff; stroke: none; }
  .aws-vpc { fill: #fcfcfc; stroke: #8C4FFF; stroke-dasharray: 5,5; }
  .aws-az { fill: none; stroke: #545b64; stroke-dasharray: 5,5; stroke-width: 1.5px; }
  .aws-subnet-public { fill: #e6f6e6; stroke: #6cae6c; } 
  .aws-subnet-private { fill: #e6f2f8; stroke: #007dbc; }
  .aws-vpc-rect { fill: #ffffff; stroke: #232f3e; stroke-width: 2px; }
  
  .aws-subnet-public { fill: #e6f6e6; stroke: #6cae6c; } /* Light Green */
  .aws-subnet-private { fill: #e6f2f8; stroke: #007dbc; } /* Light Blue */
  
  .aws-compute-cluster { fill: #fff; stroke: #d86613; stroke-dasharray: 4,4; }
  
  .aws-label { font-family: "Amazon Ember", sans-serif; font-size: 14px; fill: #232f3e; font-weight: bold;}
  .aws-label-sm { font-family: "Amazon Ember", sans-serif; font-size: 12px; fill: #545b64; }
  
  .aws-edge { stroke: #545b64; stroke-width: 2px; fill: none; }
`;

export async function renderSvg(
  graph: ElkNode,
  layoutEngine: 'elk' | 'dagre' = 'elk'
): Promise<string> {
  // Create ELK instance. We use 'any' cast only for the constructor if types are tricky,
  // but let's try to be cleaner.
  const elk = new (ELK as unknown as {
    new (): { layout: (graph: ElkNode) => Promise<ElkNode> };
  })();

  // Layout Strategy
  let layout: ElkNode;

  if (layoutEngine === 'dagre') {
    layout = await layoutDagre(graph);
  } else {
    // ELK Layout
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
        } else {
          if (nodeAbsPos.has(node.id)) {
            containerOffset = nodeAbsPos.get(node.id)!;
          }
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
        edgesOutput += `<path d="${d}" class="aws-edge" marker-end="url(#arrow)" />`;
      });
    }
  });

  const renderNode = (node: ElkNode): string => {
    let output = '';
    const nodeX = node.x || 0;
    const nodeY = node.y || 0;
    const nodeW = node.width || 0;
    const nodeH = node.height || 0;

    const props = node.properties || {};
    const label =
      node.labels && node.labels.length > 0 ? node.labels[0].text : '';

    const escapeXml = (unsafe: string) => {
      const escapeMap: Record<string, string> = {
        '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
      };
      return unsafe.replace(/[<>&'"]/g, (c) => escapeMap[c]);
    };

    const renderLabel = (
      text: string,
      x: number,
      y: number,
      cssClass: string,
      maxWidth: number
    ) => {
      if (!text) return '';
      const charWidth = 8;
      const maxChars = Math.floor(maxWidth / charWidth);

      let displayText = text;
      if (text.length > maxChars + 2) {
        displayText = text.substring(0, maxChars).trim() + '...';
      }

      return `<text x="${x}" y="${y}" class="${cssClass}">${escapeXml(displayText)}</text>`;
    };

    output += `<g transform="translate(${nodeX}, ${nodeY})">`;

    if (props.type === 'container') {
      let rectClass = 'aws-container';
      if (props.cssClass) rectClass += ` ${props.cssClass}`;

      output += `<rect width="${nodeW}" height="${nodeH}" class="${rectClass}" rx="4" ry="4" stroke-width="2" />`;
      output += renderLabel(label, 10, 25, 'aws-label', nodeW - 40);

      let shouldRenderIcon = true;
      if (props.iconPath && node.children) {
        const parentIcon = props.iconPath;
        const hasChildWithSameIcon = node.children.some((child: ElkNode) => {
          return (
            child.properties?.iconPath &&
            child.properties.iconPath === parentIcon
          );
        });
        if (hasChildWithSameIcon) shouldRenderIcon = false;
      }

      if (props.iconPath && shouldRenderIcon) {
        const iconUri = getIconDataUri({ path: props.iconPath });
        if (iconUri) {
          output += `<image href="${iconUri}" x="${nodeW - 28}" y="5" width="24" height="24" />`;
        }
      }

      if (node.children) {
        node.children.forEach((child: ElkNode) => {
          output += renderNode(child);
        });
      }
    } else {
      const iconUri = getIconDataUri({ path: props.iconPath });
      const iy = 10;
      const textY = 65;

      output += `<rect width="${nodeW}" height="${nodeH}" fill="white" stroke="none" />`;

      if (iconUri) {
        const ix = (nodeW - 48) / 2;
        output += `<image href="${iconUri}" x="${ix}" y="${iy}" width="48" height="48" />`;
      } else {
        output += `<rect width="${nodeW}" height="${nodeH}" fill="#eee" stroke="#ccc" />`;
      }

      const words = label.split(' ');
      let line1 = label;
      let line2 = '';
      if (words.length > 2 || label.length > 16) {
        const mid = Math.ceil(words.length / 2);
        if (words.length > 1) {
          line1 = words.slice(0, mid).join(' ');
          line2 = words.slice(mid).join(' ');
        }
      }

      output += `<text x="${nodeW / 2}" y="${textY}" text-anchor="middle" class="aws-label-sm">${escapeXml(line1)}</text>`;
      if (line2) {
        output += `<text x="${nodeW / 2}" y="${textY + 12}" text-anchor="middle" class="aws-label-sm">${escapeXml(line2)}</text>`;
      }
    }

    output += `</g>`;
    return output;
  };

  const svgContent = renderNode(layout) + edgesOutput;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="width: 100%; height: auto; max-width: 100%; background-color: white;">
    <defs>
      <style>${CSS_STYLES}</style>
      <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5"
        markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#545b64" />
    </marker>
    </defs>
    ${svgContent}
  </svg>`;
}
