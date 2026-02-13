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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const elk = new (ELK as any)();

  // Layout Strategy
  let layout: ElkNode;

  if (layoutEngine === 'dagre') {
    layout = await layoutDagre(graph);
  } else {
    // ELK Layout
    layout = (await elk.layout(graph)) as ElkNode;
  }

  // --- Normalization Start ---
  // Shift all content to top-left (padding: 20px) and resize root to fit content.
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

          layout.width = (maxX - minX) + (2 * padding);
          layout.height = (maxY - minY) + (2 * padding);
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

  // 1. Map all Nodes to their Absolute Positions
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

  // Start mapping from root.
  // Root node 'layout' itself:
  // Usually layout.x/y are 0 if it's the root, but let's respect them.
  // The edges in 'root' container are relative to 'root'.
  mapNodePositions(layout, 0, 0);

  // 2. Collect and Transform Edges
  const allEdges: ElkEdge[] = [];
  const processedEdgeIds = new Set<string>();

  const collectAndTransformEdges = (node: ElkNode) => {
    if (node.edges) {
      node.edges.forEach((edge: ElkEdge) => {
        // Prevent duplicates if ELK includes edges in multiple places
        if (edge.id && processedEdgeIds.has(edge.id)) return;
        if (edge.id) processedEdgeIds.add(edge.id);

        const containerId = edge.container;
        let containerOffset = { x: 0, y: 0 };

        // Resolve Container Offset
        if (containerId && nodeAbsPos.has(containerId)) {
          containerOffset = nodeAbsPos.get(containerId)!;
        } else {
          // Fallback strategies
          if (nodeAbsPos.has(node.id)) {
            // If explicit container is missing, assume relative to current node
            containerOffset = nodeAbsPos.get(node.id)!;
          }
        }

        // Clone and Transform coordinates to Global Space
        const globalEdge: ElkEdge = JSON.parse(JSON.stringify(edge));
        if (globalEdge.sections) {
          globalEdge.sections.forEach((sec: any) => {
            sec.startPoint.x += containerOffset.x;
            sec.startPoint.y += containerOffset.y;
            sec.endPoint.x += containerOffset.x;
            sec.endPoint.y += containerOffset.y;
            if (sec.bendPoints) {
              sec.bendPoints.forEach((bp: any) => {
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
      node.children.forEach((child: ElkNode) => collectAndTransformEdges(child));
    }
  };

  collectAndTransformEdges(layout);

  // 2. Render Edges (Background Layer)
  let edgesOutput = '';
  allEdges.forEach((edge) => {
    if (edge.sections) {
      edge.sections.forEach((sec: any) => {
        let d = `M ${sec.startPoint.x} ${sec.startPoint.y}`;
        if (sec.bendPoints) {
          sec.bendPoints.forEach((bp: any) => {
            d += ` L ${bp.x} ${bp.y}`;
          });
        }
        d += ` L ${sec.endPoint.x} ${sec.endPoint.y}`;
        edgesOutput += `<path d="${d}" class="aws-edge" marker-end="url(#arrow)" />`;
      });
    }
  });


  // 3. Render Nodes (Foreground Layer)
  // Recursive Render Function (No internal edge rendering)
  const renderNode = (node: ElkNode): string => {
    let output = '';
    const nodeX = node.x || 0;
    const nodeY = node.y || 0;
    const nodeW = node.width || 0;
    const nodeH = node.height || 0;

    // Determine Style
    const props = node.properties || {};
    const label =
      node.labels && node.labels.length > 0 ? node.labels[0].text : '';

    // Label Rendering Helper
    const escapeXml = (unsafe: string) => {
      return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
          case '<':
            return '&lt;';
          case '>':
            return '&gt;';
          case '&':
            return '&amp;';
          case "'":
            return '&apos;';
          case '"':
            return '&quot;';
        }
        return c;
      });
    };

    const renderLabel = (
      text: string,
      x: number,
      y: number,
      cssClass: string,
      maxWidth: number
    ) => {
      if (!text) return '';

      // Improved truncation: Average char width ~8px
      const charWidth = 8;
      const maxChars = Math.floor(maxWidth / charWidth);

      let displayText = text;
      // Only truncate if text is suspiciously long relative to width
      if (text.length > maxChars + 2) {
        displayText = text.substring(0, maxChars).trim() + '...';
      }

      return `<text x="${x}" y="${y}" class="${cssClass}">${escapeXml(displayText)}</text>`;
    };
    
        // Group for this node
    output += `<g transform="translate(${nodeX}, ${nodeY})">`;


    if (props.type === 'container') {
      // Render Container Rect
      let rectClass = 'aws-container';
      if (props.cssClass) rectClass += ` ${props.cssClass}`;

      // Use fill-opacity: 0 would mean transparent, but we want empty fill?
      // class aws-container has fill: none.
      // But we added opacity="0.9" in original code.
      // Let's stick to CSS class mainly.
      output += `<rect width="${nodeW}" height="${nodeH}" class="${rectClass}" rx="4" ry="4" stroke-width="2" />`;

      // Label (Top Left for containers)
      output += renderLabel(label, 10, 25, 'aws-label', nodeW - 40);

      // Render Icon for container if exists (check for duplicate child icon)
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

      // Render Children
      if (node.children) {
        node.children.forEach((child: ElkNode) => {
          output += renderNode(child);
        });
      }
    } else {
      // App or Service Node
      const iconUri = getIconDataUri({ path: props.iconPath });

      const iy = 10;
      const textY = 65;

      // Draw background for nodes (white) to cover any edges passing *behind* them
      output += `<rect width="${nodeW}" height="${nodeH}" fill="white" stroke="none" />`;

      if (iconUri) {
        const ix = (nodeW - 48) / 2;
        output += `<image href="${iconUri}" x="${ix}" y="${iy}" width="48" height="48" />`;
      } else {
        // Fallback Box
        output += `<rect width="${nodeW}" height="${nodeH}" fill="#eee" stroke="#ccc" />`;
      }

      // Label (Bottom center)
      const words = label.split(' ');
      let line1 = label;
      let line2 = '';
      // Smart split
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

  const nodesOutput = renderNode(layout);
  const svgContent = nodesOutput + edgesOutput;

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
