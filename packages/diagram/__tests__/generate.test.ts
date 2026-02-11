import {
  generateDiagramSvg,
  generateDiagram,
  GenerationResult,
} from '../src/core/generate';
import * as parser from '@mindfiredigital/adac-parser';
import * as elkBuilder from '@mindfiredigital/adac-layout-elk';
import * as svgRenderer from '../src/renderers/svgRenderer';
import * as fs from 'fs-extra';

jest.mock('@mindfiredigital/adac-parser');
jest.mock('@mindfiredigital/adac-layout-elk');
jest.mock('../src/renderers/svgRenderer');
jest.mock('fs-extra');

const mockParser = parser as jest.Mocked<typeof parser>;
const mockElkBuilder = elkBuilder as jest.Mocked<typeof elkBuilder>;
const mockRenderer = svgRenderer as jest.Mocked<typeof svgRenderer>;
const mockFs = fs as jest.Mocked<typeof fs>;

describe('Diagram Generation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateDiagramSvg', () => {
    const mockAdacConfig = {
      applications: [
        {
          id: 'app-1',
          name: 'Test App',
          type: 'web',
        },
      ],
      infrastructure: {
        clouds: [],
      },
    };

    const mockElkGraph = {
      id: 'root',
      children: [],
    };

    it('should generate SVG from YAML content', async () => {
      mockParser.parseAdacFromContent.mockReturnValue(mockAdacConfig);
      mockElkBuilder.buildElkGraph.mockReturnValue(mockElkGraph);
      mockRenderer.renderSvg.mockResolvedValue('<svg></svg>');

      const result = await generateDiagramSvg('applications: []');

      expect(result.svg).toBe('<svg></svg>');
      expect(result.logs).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(mockParser.parseAdacFromContent).toHaveBeenCalledWith(
        'applications: []'
      );
    });

    it('should use ELK layout by default', async () => {
      mockParser.parseAdacFromContent.mockReturnValue(mockAdacConfig);
      mockElkBuilder.buildElkGraph.mockReturnValue(mockElkGraph);
      mockRenderer.renderSvg.mockResolvedValue('<svg></svg>');

      await generateDiagramSvg('applications: []');

      expect(mockRenderer.renderSvg).toHaveBeenCalledWith(mockElkGraph, 'elk');
    });

    it('should use layout override when provided', async () => {
      mockParser.parseAdacFromContent.mockReturnValue(mockAdacConfig);
      mockElkBuilder.buildElkGraph.mockReturnValue(mockElkGraph);
      mockRenderer.renderSvg.mockResolvedValue('<svg></svg>');

      await generateDiagramSvg('applications: []', 'dagre');

      expect(mockRenderer.renderSvg).toHaveBeenCalledWith(
        mockElkGraph,
        'dagre'
      );
    });

    it('should use layout from ADAC config if no override', async () => {
      const configWithLayout = { ...mockAdacConfig, layout: 'dagre' as const };
      mockParser.parseAdacFromContent.mockReturnValue(configWithLayout);
      mockElkBuilder.buildElkGraph.mockReturnValue(mockElkGraph);
      mockRenderer.renderSvg.mockResolvedValue('<svg></svg>');

      await generateDiagramSvg('applications: []');

      expect(mockRenderer.renderSvg).toHaveBeenCalledWith(
        mockElkGraph,
        'dagre'
      );
    });

    it('should include logs in result', async () => {
      mockParser.parseAdacFromContent.mockReturnValue(mockAdacConfig);
      mockElkBuilder.buildElkGraph.mockReturnValue(mockElkGraph);
      mockRenderer.renderSvg.mockResolvedValue('<svg></svg>');

      const result = await generateDiagramSvg('applications: []');

      expect(result.logs.length).toBeGreaterThan(0);
      expect(result.logs.some((log) => log.includes('Starting diagram'))).toBe(
        true
      );
      expect(result.logs.some((log) => log.includes('Parsing'))).toBe(true);
      expect(result.logs.some((log) => log.includes('Building ELK'))).toBe(
        true
      );
    });

    it('should handle errors and augment with logs', async () => {
      const error = new Error('Parse failed');
      mockParser.parseAdacFromContent.mockImplementation(() => {
        throw error;
      });

      await expect(generateDiagramSvg('invalid YAML')).rejects.toThrow(
        'Parse failed'
      );

      try {
        await generateDiagramSvg('invalid YAML');
      } catch (e) {
        const err = e as Error & { logs?: string[] };
        expect(err.logs).toBeDefined();
        expect(err.logs!.length).toBeGreaterThan(0);
      }
    });

    it('should track generation duration', async () => {
      mockParser.parseAdacFromContent.mockReturnValue(mockAdacConfig);
      mockElkBuilder.buildElkGraph.mockReturnValue(mockElkGraph);
      mockRenderer.renderSvg.mockResolvedValue('<svg></svg>');

      const result = await generateDiagramSvg('applications: []');

      expect(typeof result.duration).toBe('number');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should log node count from graph', async () => {
      const graphWithChildren = {
        id: 'root',
        children: [{ id: 'n1' }, { id: 'n2' }],
      };

      mockParser.parseAdacFromContent.mockReturnValue(mockAdacConfig);
      mockElkBuilder.buildElkGraph.mockReturnValue(graphWithChildren);
      mockRenderer.renderSvg.mockResolvedValue('<svg></svg>');

      const result = await generateDiagramSvg('applications: []');

      expect(result.logs.some((log) => log.includes('2 top-level nodes'))).toBe(
        true
      );
    });
  });

  describe('generateDiagram', () => {
    const mockSvg = '<svg><rect/></svg>';

    beforeEach(() => {
      // Mock readFile to return a promise with content
      (mockFs.readFile as any).mockResolvedValue('applications: []'); 
      mockParser.parseAdacFromContent.mockReturnValue({
        applications: [],
        infrastructure: { clouds: [] },
      });
      mockElkBuilder.buildElkGraph.mockReturnValue({
        id: 'root',
        children: [],
      });
      mockRenderer.renderSvg.mockResolvedValue(mockSvg);
      // Mock outputFile
      (mockFs.outputFile as any).mockResolvedValue(undefined);
    });

    it('should read input file and write SVG output', async () => {
      await generateDiagram('/input/test.yaml', '/output/test.svg');

      expect(mockFs.readFile).toHaveBeenCalledWith(
        '/input/test.yaml',
        'utf8'
      );
      expect(mockFs.outputFile).toHaveBeenCalledWith(
        '/output/test.svg',
        mockSvg
      );
    });

    it('should use layout override', async () => {
      await generateDiagram('/input/test.yaml', '/output/test.svg', 'dagre');

      expect(mockRenderer.renderSvg).toHaveBeenCalledWith(
        expect.anything(),
        'dagre'
      );
    });

    it('should log file paths', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await generateDiagram('/input/test.yaml', '/output/test.svg');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('/output/test.svg')
      );

      consoleSpy.mockRestore();
    });

    it('should handle file read errors', async () => {
      (mockFs.readFile as any).mockRejectedValue(new Error('File not found'));

      await expect(
        generateDiagram('/missing/file.yaml', '/output/test.svg')
      ).rejects.toThrow('File not found');
    });

    it('should handle file write errors', async () => {
      (mockFs.outputFile as any).mockRejectedValue(new Error('Write failed'));

      await expect(
        generateDiagram('/input/test.yaml', '/readonly/test.svg')
      ).rejects.toThrow('Write failed');
    });
  });

});
