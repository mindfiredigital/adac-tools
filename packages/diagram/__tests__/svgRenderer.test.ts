import { renderSvg } from '../src/renderers/svgRenderer';
import { ElkNode } from '@mindfiredigital/adac-layout-elk';
import fs from 'fs-extra';
import { layoutDagre } from '@mindfiredigital/adac-layout-dagre';

jest.mock('@mindfiredigital/adac-layout-dagre', () => ({
  layoutDagre: jest.fn(),
}));

jest.mock('elkjs', () => {
  return class ELK {
    layout(graph: ElkNode) {
      const enrich = (node: ElkNode) => {
        node.x = node.x || 0;
        node.y = node.y || 0;
        node.width = node.width || 100;
        node.height = node.height || 100;
        if (node.children) node.children.forEach(enrich);
        if (node.edges) node.edges.forEach(edge => {
            if (!edge.sections) {
                edge.sections = [{
                    startPoint: { x: 0, y: 0 },
                    endPoint: { x: 100, y: 100 }
                }];
            }
        });
        return node;
      };
      return Promise.resolve(enrich(JSON.parse(JSON.stringify(graph))));
    }
  };
});

jest.mock('fs-extra');
const mockFs = fs as jest.Mocked<typeof fs>;
const mockLayoutDagre = layoutDagre as jest.Mock;

describe('SVG Renderer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(Buffer.from('<svg>icon</svg>'));
    mockLayoutDagre.mockImplementation((graph) => Promise.resolve({ ...graph, width: 800, height: 600 }));
  });

  it('should render a simple graph', async () => {
    const graph: ElkNode = {
      id: 'root',
      properties: { type: 'container' },
      children: [
        {
          id: 'n1',
          width: 50,
          height: 50,
          labels: [{ text: 'Node 1' }],
          properties: { type: 'node', iconPath: '/icons/node.svg' }
        },
        {
            id: 'n2',
            width: 50,
            height: 50,
            labels: [{ text: 'Node 2' }],
            properties: { type: 'node' }
        }
      ],
      edges: [
        {
          id: 'e1',
          sources: ['n1'],
          targets: ['n2'],
          sections: [
            {
              startPoint: { x: 0, y: 0 },
              endPoint: { x: 100, y: 100 }
            }
          ]
        }
      ]
    };

    const svg = await renderSvg(graph);

    expect(svg).toContain('aws-label-sm');
    expect(svg).toContain('Node 1');
    expect(svg).toContain('Node 2');
    expect(svg).toContain('class="aws-edge"');
  });

  it('should render a container with children', async () => {
    const graph: ElkNode = {
      id: 'root',
      properties: { type: 'container' },
      children: [
        {
          id: 'vpc',
          width: 200,
          height: 200,
          labels: [{ text: 'VPC' }],
          properties: { type: 'container', cssClass: 'aws-vpc' },
          children: [
             {
               id: 'subnet',
               width: 100,
               height: 100,
               labels: [{ text: 'Subnet' }],
               properties: { type: 'container', cssClass: 'aws-subnet' }
             }
          ]
        }
      ]
    };

    const svg = await renderSvg(graph);

    expect(svg).toContain('aws-vpc');
    expect(svg).toContain('aws-subnet');
  });

  it('should use Dagre layout when requested', async () => {
     const graph: ElkNode = { id: 'root', children: [] };
     await renderSvg(graph, 'dagre');
     expect(mockLayoutDagre).toHaveBeenCalled();
  });

  it('should handle icon read errors', async () => {
    mockFs.readFileSync.mockImplementation(() => { throw new Error('Read error'); });
    const graph: ElkNode = {
        id: 'root',
        properties: { type: 'container' },
        children: [{ id: 'n1', width: 50, height: 50, properties: { type: 'node', iconPath: 'bad.png' } }]
    };
    const svg = await renderSvg(graph);
    // Should render fallback box for n1
    expect(svg).toContain('fill="#eee"');
    expect(svg).not.toContain('<image');
  });

  it('should handle edges with containers and bendpoints', async () => {
      // ... content is same ...
      const graph: ElkNode = {
          id: 'root',
          properties: { type: 'container' },
          children: [
            {
               id: 'c1',
               x: 10, y: 10, width: 200, height: 200,
               children: [],
               edges: [{
                   id: 'e1',
                   container: 'c1',
                   sources: ['n1'],
                   targets: ['n2'],
                   sections: [{
                       startPoint: { x: 0, y: 0 },
                       endPoint: { x: 50, y: 50 },
                       bendPoints: [{ x: 25, y: 25 }]
                   }]
               }]
            }
          ]
      };
      
      const svg = await renderSvg(graph);
      expect(svg).toContain('M 20 20 L 45 45 L 70 70'); 
  });

  it('should escape XML characters in labels', async () => {
      const graph: ElkNode = {
          id: 'root',
          properties: { type: 'container' },
          children: [{ 
              id: 'n1', 
              width: 100, 
              height: 100, 
              labels: [{ text: '<Node> & "Friend\'' }],
              properties: { type: 'node' } 
          }]
      };
      const svg = await renderSvg(graph);
      // Label is split into two lines
      expect(svg).toContain('&lt;Node&gt; &amp;');
      expect(svg).toContain('&quot;Friend&apos;');
  });

  it('should wrap long labels', async () => {
       const graph: ElkNode = {
          id: 'root',
          properties: { type: 'container' },
          children: [{ 
              id: 'n1', 
              width: 50, 
              height: 50,
              labels: [{ text: 'This is a very long label that should Wrap' }],
              properties: { type: 'node' }
          }]
      };
      const svg = await renderSvg(graph);
      // Expect wrapping (2 lines)
      const matches = svg.match(/<text/g);
      expect(matches!.length).toBeGreaterThanOrEqual(2);
      expect(svg).toContain('This is a very long');
      expect(svg).toContain('label that should Wrap');
  });

  it('should truncate container labels', async () => {
      const graph: ElkNode = {
          id: 'root',
          properties: { type: 'container' },
          children: [{ 
              id: 'c1', 
              width: 50, 
              height: 50,
              labels: [{ text: 'VeryLongContainerLabel' }],
              properties: { type: 'container' }
          }]
      };
      const svg = await renderSvg(graph);
      // Container labels use renderLabel which truncates
      expect(svg).toContain('...');
  });

   it('should not duplicate icons if child has same icon', async () => {
        const iconPath = 'icon.svg';
        mockFs.readFileSync.mockReturnValue(Buffer.from('<svg id="u1"></svg>'));
        
        const graph: ElkNode = {
            id: 'root',
            properties: { type: 'container' },
            children: [{
                id: 'c1',
                width: 100, height: 100,
                properties: { type: 'container', iconPath },
                children: [{
                    id: 'n1',
                    width: 50, height: 50,
                    properties: { type: 'node', iconPath }
                }]
            }]
        };
        const svg = await renderSvg(graph);
        // c1 should check if any child has same icon. n1 has same icon. 
        // So c1 should NOT render icon.
        // n1 SHOULD render icon.
        
        // Let's count occurrences of base64 data.
        // Or better, since tests run in known env, the base64 of <svg id="u1"></svg> is static.
        // PHN2ZyBpZD0idTEiPjwvc3ZnPg==
        
        const b64 = Buffer.from('<svg id="u1"></svg>').toString('base64');
        const count = (svg.match(new RegExp(b64, 'g')) || []).length;
        expect(count).toBe(1);
    });

    it('should fallback to relative offset if edge container not found', async () => {
        const graph: ElkNode = {
            id: 'root',
            properties: { type: 'container' },
            children: [{
                id: 'n1',
                x: 20, y: 20,
                edges: [{
                    id: 'e1',
                    container: 'missing', // invalid container
                    sources: ['n1'],
                    targets: ['n1'],
                    sections: [{
                        startPoint: { x: 0, y: 0 },
                        endPoint: { x: 10, y: 10 }
                    }]
                }]
            }]
        };
        // Should use n1's offset (20, 20) as fallback because nodeAbsPos.has(node.id)
        // start 0,0 -> 20,20
        // end 10,10 -> 30,30
        
         const svg = await renderSvg(graph);
         expect(svg).toContain('M 20 20 L 30 30');
    });

  it('should render container icon if no child has same icon', async () => {
       const iconPath = 'container-icon.svg';
       mockFs.readFileSync.mockReturnValue(Buffer.from('<svg id="c1"></svg>'));

       const graph: ElkNode = {
          id: 'root',
          properties: { type: 'container' },
          children: [{ 
              id: 'c1', 
              width: 100, 
              height: 100,
              properties: { type: 'container', iconPath },
              children: [] // No children, so no conflict
          }]
      };
      const svg = await renderSvg(graph);
      // c1 should render icon
      const b64 = Buffer.from('<svg id="c1"></svg>').toString('base64');
      const count = (svg.match(new RegExp(b64, 'g')) || []).length;
      expect(count).toBe(1);
  });
});
