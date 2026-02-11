import express from 'express';
import request from 'supertest';
import * as diagram from '@mindfiredigital/adac-diagram';

jest.mock('@mindfiredigital/adac-diagram');

const mockDiagram = diagram as jest.Mocked<typeof diagram>;

describe('Web Server', () => {
  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a fresh Express app for each test
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Setup the generate endpoint
    app.post('/api/generate', async (req, res) => {
      try {
        const { content, layout } = req.body;

        if (!content) {
          res.status(400).json({ error: 'Missing content' });
          return;
        }

        const result = await mockDiagram.generateDiagramSvg(content, layout);
        res.status(200).json(result);
      } catch (e) {
        const error = e as Error & { logs?: string[] };
        console.error('Generation failed:', error);
        res.status(500).json({
          error: error.message || 'Internal Server Error',
          logs: error.logs,
        });
      }
    });
  });

  describe('POST /api/generate', () => {
    it('should generate diagram with valid content', async () => {
      const mockResult = {
        svg: '<svg></svg>',
        logs: ['Generated'],
        duration: 100,
      };

      mockDiagram.generateDiagramSvg.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/generate')
        .send({ content: 'applications: []' })
        .expect(200);

      expect(response.body).toEqual(mockResult);
      expect(mockDiagram.generateDiagramSvg).toHaveBeenCalledWith(
        'applications: []',
        undefined
      );
    });

    it('should accept layout parameter', async () => {
      const mockResult = {
        svg: '<svg></svg>',
        logs: ['Generated with dagre'],
        duration: 150,
      };

      mockDiagram.generateDiagramSvg.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/generate')
        .send({
          content: 'applications: []',
          layout: 'dagre',
        })
        .expect(200);

      expect(response.body).toEqual(mockResult);
      expect(mockDiagram.generateDiagramSvg).toHaveBeenCalledWith(
        'applications: []',
        'dagre'
      );
    });

    it('should return 400 when content is missing', async () => {
      const response = await request(app)
        .post('/api/generate')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Missing content');
      expect(mockDiagram.generateDiagramSvg).not.toHaveBeenCalled();
    });

    it('should handle generation errors', async () => {
      const error = new Error('Parse failed');
      mockDiagram.generateDiagramSvg.mockRejectedValue(error);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const response = await request(app)
        .post('/api/generate')
        .send({ content: 'invalid yaml' })
        .expect(500);

      expect(response.body.error).toBe('Parse failed');
      expect(consoleSpy).toHaveBeenCalledWith(
        'Generation failed:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should include logs in error response', async () => {
      const error = new Error('Generation failed');
      (error as Error & { logs?: string[] }).logs = [
        'Log 1',
        'Log 2',
        'Error occurred',
      ];

      mockDiagram.generateDiagramSvg.mockRejectedValue(error);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const response = await request(app)
        .post('/api/generate')
        .send({ content: 'test' })
        .expect(500);

      expect(response.body.logs).toEqual(['Log 1', 'Log 2', 'Error occurred']);

      consoleSpy.mockRestore();
    });

    it('should handle complex YAML content', async () => {
      const complexYaml = `
applications:
  - id: app-1
    name: Test App
    type: web
infrastructure:
  clouds:
    - provider: aws
      services:
        - id: ec2-1
          type: AWS::EC2::Instance
connections:
  - from: app-1
    to: ec2-1
    type: http
`;

      const mockResult = {
        svg: '<svg><rect/></svg>',
        logs: ['Complex diagram generated'],
        duration: 250,
      };

      mockDiagram.generateDiagramSvg.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/generate')
        .send({ content: complexYaml })
        .expect(200);

      expect(response.body.svg).toBe('<svg><rect/></svg>');
      expect(mockDiagram.generateDiagramSvg).toHaveBeenCalledWith(
        complexYaml,
        undefined
      );
    });

    it('should handle ELK layout option', async () => {
      const mockResult = {
        svg: '<svg></svg>',
        logs: ['ELK layout used'],
        duration: 120,
      };

      mockDiagram.generateDiagramSvg.mockResolvedValue(mockResult);

      await request(app)
        .post('/api/generate')
        .send({
          content: 'applications: []',
          layout: 'elk',
        })
        .expect(200);

      expect(mockDiagram.generateDiagramSvg).toHaveBeenCalledWith(
        'applications: []',
        'elk'
      );
    });

    it('should handle empty content string', async () => {
      const response = await request(app)
        .post('/api/generate')
        .send({ content: '' })
        .expect(400);

      expect(response.body.error).toBe('Missing content');
    });

    it('should return duration in response', async () => {
      const mockResult = {
        svg: '<svg></svg>',
        logs: ['Generated'],
        duration: 175,
      };

      mockDiagram.generateDiagramSvg.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/generate')
        .send({ content: 'applications: []' })
        .expect(200);

      expect(response.body.duration).toBe(175);
    });

    it('should return logs array in response', async () => {
      const mockResult = {
        svg: '<svg></svg>',
        logs: ['Step 1', 'Step 2', 'Step 3'],
        duration: 100,
      };

      mockDiagram.generateDiagramSvg.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/generate')
        .send({ content: 'applications: []' })
        .expect(200);

      expect(response.body.logs).toEqual(['Step 1', 'Step 2', 'Step 3']);
    });
  });
});
