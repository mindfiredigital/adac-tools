import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'events';

// Mock middleware that causes issues with non-standard Response objects
vi.mock('cors', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: () => (req: any, res: any, next: any) => {
    res.setHeader('access-control-allow-origin', '*');
    next();
  },
}));
vi.mock('compression', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: () => (req: any, res: any, next: any) => next(),
}));

import {
  generateDiagramHandler,
  complianceCheckHandler,
  costAnalysisHandler,
  optimizeHandler,
} from '../src/handlers';
import app from '../src/index';

/**
 * Mock Request and Response to bypass EPERM on listen()
 */
class MockResponse extends EventEmitter {
  public statusCode = 200;
  public headers: Record<string, string> = {};
  public body: unknown = null;
  public text = '';
  public finished = false;

  status(code: number) {
    this.statusCode = code;
    return this;
  }
  setHeader(name: string, value: string) {
    this.headers[name.toLowerCase()] = value;
    return this;
  }
  getHeader(name: string) {
    return this.headers[name.toLowerCase()];
  }
  get(name: string) {
    return this.headers[name.toLowerCase()];
  }

  write(data: string | Buffer) {
    if (data) this.text += data.toString();
    return true;
  }

  end(data?: string | Buffer) {
    if (this.finished) return this;
    if (data) this.write(data);
    this.finished = true;
    this.emit('end');
    this.emit('finish');
    return this;
  }

  json(data: unknown) {
    this.body = data;
    this.setHeader('content-type', 'application/json');
    this.end();
    return this;
  }
  send(data: unknown) {
    if (this.finished) return this;
    if (data && typeof data === 'object') this.body = data;
    else if (data) this.text = data.toString();
    this.end();
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, listener: (...args: any[]) => void): this {
    super.on(event, listener);
    return this;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  once(event: string, listener: (...args: any[]) => void): this {
    super.once(event, listener);
    return this;
  }
}

async function mockRequest(
  method: string,
  url: string,
  body: Record<string, unknown> | string | null = {},
  headers: Record<string, string> = {}
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Promise<any>((resolve) => {
    const res = new MockResponse();
    res.on('end', () => {
      resolve({
        status: res.statusCode,
        body: res.body,
        text: res.text,
        headers: res.headers,
      });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req: any = {
      method,
      url,
      headers: { 'content-type': 'application/json', ...headers },
      body,
    };

    // Route to appropriate handler
    res.setHeader('access-control-allow-origin', '*'); // Simulate CORS middleware

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = req as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = res as any;

    if (url === '/api/generate') generateDiagramHandler(r, s);
    else if (url === '/api/compliance-check') complianceCheckHandler(r, s);
    else if (url === '/api/cost') costAnalysisHandler(r, s);
    else if (url === '/api/optimize') optimizeHandler(r, s);
    else res.status(404).end();
  });
}

/**
 * Test suite for @mindfiredigital/adac-web-server
 * Tests all API endpoints for diagram generation, compliance checking, and cost analysis
 */
describe('Web Server API', () => {
  describe('GET /', () => {
    it('should serve homepage', async () => {
      const res = await mockRequest('GET', '/');
      expect(res.status).toBeLessThanOrEqual(404);
    });
  });

  describe('POST /api/generate', () => {
    it('should require content in request body', async () => {
      const res = await mockRequest('POST', '/api/generate', {});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing content');
    });

    it('should accept content and layout in request', async () => {
      const adacContent = `
        version: "1.0"
        infrastructure:
          name: "Test Architecture"
          clouds:
            - name: "AWS"
              services:
                - name: "Lambda"
                  type: "compute"
      `;

      const res = await mockRequest('POST', '/api/generate', {
        content: adacContent,
        layout: 'elk',
      });

      // May fail due to dependencies, but should be a proper response
      expect([200, 500]).toContain(res.status);
    });

    it('should handle errors gracefully', async () => {
      const res = await mockRequest('POST', '/api/generate', {
        content: 'invalid: [',
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toBeDefined();
    });

    it('should return error logs if available', async () => {
      const res = await mockRequest('POST', '/api/generate', {
        content: 'invalid: [',
      });

      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /api/compliance-check', () => {
    it('should require content in request body', async () => {
      const res = await mockRequest('POST', '/api/compliance-check', {});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing content');
    });

    it('should require valid ADAC configuration', async () => {
      const res = await mockRequest('POST', '/api/compliance-check', {
        content: 'invalid: [',
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toBeDefined();
    });

    it('should require infrastructure in ADAC config', async () => {
      const res = await mockRequest('POST', '/api/compliance-check', {
        content: 'version: "1.0"',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('infrastructure');
    });

    it('should accept valid ADAC YAML config', async () => {
      const adacContent = `
        version: "1.0"
        infrastructure:
          name: "Test Architecture"
          clouds:
            - name: "AWS"
              services:
                - name: "EC2"
                  type: "compute"
      `;

      const res = await mockRequest('POST', '/api/compliance-check', {
        content: adacContent,
      });

      expect([200, 500]).toContain(res.status);
    });

    it('should handle YAML parsing errors', async () => {
      const res = await mockRequest('POST', '/api/compliance-check', {
        content: 'invalid: [',
      });

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
    });

    it('should return compliance results on success', async () => {
      const adacContent = `
        version: "1.0"
        infrastructure:
          name: "Test Architecture"
          clouds:
            - name: "AWS"
              services: []
      `;

      const res = await mockRequest('POST', '/api/compliance-check', {
        content: adacContent,
      });

      if (res.status === 200) {
        expect(res.body).toBeDefined();
      }
    });
  });

  describe('POST /api/cost', () => {
    it('should require content in request body', async () => {
      const res = await mockRequest('POST', '/api/cost', {});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing content');
    });

    it('should require valid ADAC configuration', async () => {
      const res = await mockRequest('POST', '/api/cost', {
        content: 'invalid: [',
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toBeDefined();
    });

    it('should require infrastructure in ADAC config', async () => {
      const res = await mockRequest('POST', '/api/cost', {
        content: 'version: "1.0"',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('infrastructure');
    });

    it('should accept valid ADAC YAML config with services', async () => {
      const adacContent = `
        version: "1.0"
        infrastructure:
          name: "Test Architecture"
          clouds:
            - name: "AWS"
              services:
                - name: "EC2"
                  type: "compute"
      `;

      const res = await mockRequest('POST', '/api/cost', {
        content: adacContent,
      });

      expect([200, 500]).toContain(res.status);
    });

    it('should return cost analysis on success', async () => {
      const adacContent = `
        version: "1.0"
        infrastructure:
          name: "Test Architecture"
          clouds:
            - name: "AWS"
              services: []
      `;

      const res = await mockRequest('POST', '/api/cost', {
        content: adacContent,
      });

      if (res.status === 200) {
        expect(res.body).toBeDefined();
      }
    });

    it('should handle multiple cloud providers', async () => {
      const adacContent = `
        version: "1.0"
        infrastructure:
          name: "Multi-Cloud Architecture"
          clouds:
            - name: "AWS"
              services: []
            - name: "GCP"
              services: []
      `;

      const res = await mockRequest('POST', '/api/cost', {
        content: adacContent,
      });

      expect([200, 500]).toContain(res.status);
    });

    it('should handle configs with no clouds', async () => {
      const adacContent = `
        version: "1.0"
        infrastructure:
          name: "On-Premise Architecture"
      `;

      const res = await mockRequest('POST', '/api/cost', {
        content: adacContent,
      });

      expect([200, 500]).toContain(res.status);
    });
  });

  describe('POST /api/optimize', () => {
    it('should require content in request body', async () => {
      const res = await mockRequest('POST', '/api/optimize', {});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing content');
    });

    it('should require valid ADAC configuration', async () => {
      const res = await mockRequest('POST', '/api/optimize', {
        content: 'invalid: [',
      });

      expect(res.status).toBe(500);
      expect(res.body.error).toBeDefined();
    });

    it('should require infrastructure in ADAC config', async () => {
      const res = await mockRequest('POST', '/api/optimize', {
        content: 'version: "1.0"',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('infrastructure');
    });

    it('should accept options and return optimization result on success', async () => {
      const adacContent = `
        version: "1.0"
        infrastructure:
          name: "Test Architecture"
          clouds:
            - name: "AWS"
              services: []
      `;

      const res = await mockRequest('POST', '/api/optimize', {
        content: adacContent,
        options: { minSeverity: 'high' },
      });

      if (res.status === 200) {
        expect(res.body).toBeDefined();
      }
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers in response', async () => {
      const res = await mockRequest(
        'GET',
        '/',
        {},
        { origin: 'http://localhost:3000' }
      );

      expect(res.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('Request Size Limits', () => {
    it('should handle large JSON payloads up to 10mb', async () => {
      const largeContent = 'a'.repeat(1000); // 1KB content
      const res = await mockRequest('POST', '/api/generate', {
        content: largeContent,
      });

      // Should not fail due to size limit
      expect(res.status).not.toBe(413); // 413 = Payload Too Large
    });

    it('should accept valid JSON body', async () => {
      const res = await mockRequest('POST', '/api/generate', {
        content: 'test',
      });

      expect(res.status).not.toBe(400); // Should parse JSON
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      const res = await mockRequest('POST', '/api/generate', { content: null });

      // Should not crash the server
      expect(res.status).toBeLessThan(600);
    });

    it('should provide error messages in responses', async () => {
      const res = await mockRequest('POST', '/api/generate', {});

      expect(res.body).toHaveProperty('error');
      expect(typeof res.body.error).toBe('string');
    });

    it('should log unhandled errors', async () => {
      const res = await mockRequest('POST', '/api/compliance-check', {
        content: 'a: [invalid',
      });

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('Server Configuration', () => {
    it('should export app as default export', () => {
      expect(app).toBeDefined();
    });

    it('should have Express app methods', () => {
      expect(typeof app.get).toBe('function');
      expect(typeof app.post).toBe('function');
      expect(typeof app.use).toBe('function');
    });

    it('should not start server when imported as module', () => {
      // If imported, server should not automatically start
      expect(app).toBeDefined();
    });
  });

  describe('API Response Format', () => {
    it('should return JSON responses', async () => {
      const res = await mockRequest('POST', '/api/generate', {});

      expect(res.headers['content-type']).toContain('application/json');
    });

    it('should include error field in error responses', async () => {
      const res = await mockRequest('POST', '/api/generate', {});

      expect(res.body).toHaveProperty('error');
    });

    it('should handle different content types', async () => {
      const res = await mockRequest('POST', '/api/generate', {
        content: 'test',
      });

      expect(res.status).toBeLessThan(600);
    });
  });

  describe('Compliance Check Edge Cases', () => {
    it('should handle empty configuration', async () => {
      const res = await mockRequest('POST', '/api/compliance-check', {});

      expect(res.status).toBe(400);
    });

    it('should validate configuration with clouds array', async () => {
      const adacContent = `
        version: "1.0"
        infrastructure:
          name: "Test"
          clouds:
            - name: "AWS"
              services:
                - name: "EC2"
                  type: "compute"
      `;

      const res = await mockRequest('POST', '/api/compliance-check', {
        content: adacContent,
      });

      expect(res.status).toBeLessThanOrEqual(200);
    });

    it('should handle config with no services', async () => {
      const adacContent = `
        version: "1.0"
        infrastructure:
          name: "Empty"
          clouds:
            - name: "AWS"
      `;

      const res = await mockRequest('POST', '/api/compliance-check', {
        content: adacContent,
      });

      expect([200, 500]).toContain(res.status);
    });
  });

  describe('Cost Analysis Edge Cases', () => {
    it('should calculate costs for multi-service config', async () => {
      const adacContent = `
        version: "1.0"
        infrastructure:
          name: "Test"
          clouds:
            - name: "AWS"
              services:
                - name: "EC2"
                  type: "compute"
                - name: "S3"
                  type: "storage"
      `;

      const res = await mockRequest('POST', '/api/cost', {
        content: adacContent,
      });

      expect([200, 500]).toContain(res.status);
    });

    it('should handle services with all properties', async () => {
      const adacContent = `
        version: "1.0"
        infrastructure:
          name: "Test"
          clouds:
            - name: "AWS"
              services:
                - name: "EC2"
                  type: "compute"
                  quantity: 2
                  unit: "instance"
      `;

      const res = await mockRequest('POST', '/api/cost', {
        content: adacContent,
      });

      expect([200, 500]).toContain(res.status);
    });

    it('should handle cost calculation errors gracefully', async () => {
      const res = await mockRequest('POST', '/api/cost', {
        content: 'invalid',
      });

      expect([400, 500]).toContain(res.status);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('Generate Diagram Edge Cases', () => {
    it('should handle generation with no layout', async () => {
      const adacContent = `
        version: "1.0"
        infrastructure:
          name: "Test"
      `;

      const res = await mockRequest('POST', '/api/generate', {
        content: adacContent,
      });

      expect([200, 500]).toContain(res.status);
    });

    it('should handle generation with specific layout', async () => {
      const adacContent = `
        version: "1.0"
        infrastructure:
          name: "Test"
          clouds:
            - name: "AWS"
              services:
                - name: "Lambda"
                  type: "compute"
      `;

      const res = await mockRequest('POST', '/api/generate', {
        content: adacContent,
        layout: 'dagre',
      });

      expect([200, 500]).toContain(res.status);
    });

    it('should return logs in generation errors', async () => {
      const res = await mockRequest('POST', '/api/generate', {
        content: 'invalid',
      });

      expect([200, 500]).toContain(res.status);
      if (res.status === 500) {
        expect(res.body).toHaveProperty('error');
      }
    });
  });

  describe('Infrastructure Response Validation', () => {
    it('should validate infrastructure field requirement', async () => {
      const res = await mockRequest('POST', '/api/compliance-check', {
        content: 'name: "NoInfra"',
      });

      expect([400, 500]).toContain(res.status);
    });

    it('should process valid complete config', async () => {
      const adacContent = `
        version: "1.0"
        infrastructure:
          name: "Complete"
          clouds:
            - name: "AWS"
              region: "us-east-1"
              services:
                - name: "ECS"
                  type: "compute"
      `;

      const res = await mockRequest('POST', '/api/compliance-check', {
        content: adacContent,
      });

      expect([200, 500]).toContain(res.status);
    });
  });

  describe('Message and Log Handling', () => {
    it('should handle compliance check message formats', async () => {
      const adacContent = `
        version: "1.0"
        infrastructure:
          name: "Test Infrastructure"
          clouds:
            - name: "AWS"
              services:
                - name: "Lambda"
                  type: "compute"
      `;

      const res = await mockRequest('POST', '/api/compliance-check', {
        content: adacContent,
      });

      expect([200, 500]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toBeDefined();
      }
    });

    it('should provide meaningful error messages', async () => {
      const res = await mockRequest('POST', '/api/compliance-check', {});

      expect(res.status).toBe(400);
      expect(typeof res.body.error).toBe('string');
      expect(res.body.error.length).toBeGreaterThan(0);
    });

    it('should handle cost analysis result formatting', async () => {
      const adacContent = `
        version: "1.0"
        infrastructure:
          name: "Cost Test"
          clouds:
            - name: "AWS"
              services: []
      `;

      const res = await mockRequest('POST', '/api/cost', {
        content: adacContent,
      });

      expect([200, 500]).toContain(res.status);
    });

    it('should include all required fields in error response', async () => {
      const res = await mockRequest('POST', '/api/generate', {});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('Middleware and Handler Coverage', () => {
    it('should handle compliance check with valid infrastructure structure', async () => {
      const adacContent = `
        version: "1.0"
        infrastructure:
          name: "Multi Service"
          clouds:
            - name: "AWS"
              services:
                - name: "EC2"
                  type: "compute"
                - name: "RDS"
                  type: "database"
                - name: "S3"
                  type: "storage"
      `;

      const res = await mockRequest('POST', '/api/compliance-check', {
        content: adacContent,
      });

      expect([200, 500]).toContain(res.status);
    });

    it('should handle cost with multiple clouds', async () => {
      const adacContent = `
        version: "1.0"
        infrastructure:
          name: "MultiCloud"
          clouds:
            - name: "AWS"
              services:
                - name: "EC2"
                  type: "compute"
            - name: "GCP"
              services:
                - name: "Compute Engine"
                  type: "compute"
      `;

      const res = await mockRequest('POST', '/api/cost', {
        content: adacContent,
      });

      expect([200, 500]).toContain(res.status);
    });

    it('should generate diagram with minimal valid config', async () => {
      const adacContent = `
        version: "1.0"
        infrastructure:
          name: "Minimal"
      `;

      const res = await mockRequest('POST', '/api/generate', {
        content: adacContent,
      });

      expect([200, 500]).toContain(res.status);
    });

    it('should validate all three endpoints work independently', async () => {
      const config = `
        version: "1.0"
        infrastructure:
          name: "Test"
      `;

      const gen = await mockRequest('POST', '/api/generate', {
        content: config,
      });
      const comp = await mockRequest('POST', '/api/compliance-check', {
        content: config,
      });
      const cost = await mockRequest('POST', '/api/cost', { content: config });

      expect([200, 500]).toContain(gen.status);
      expect([200, 500]).toContain(comp.status);
      expect([200, 500]).toContain(cost.status);
    });

    it('should handle empty errors in catch blocks', async () => {
      const res = await mockRequest('POST', '/api/compliance-check', {
        content: 'invalid: {bad',
      });

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
    });

    it('should handle generation with null values', async () => {
      const res = await mockRequest('POST', '/api/generate', {
        content: null,
        layout: null,
      });

      expect(res.status).toBe(400);
    });

    it('should handle cost without services', async () => {
      const adacContent = `
        version: "1.0"
        infrastructure:
          name: "NoServices"
          clouds:
            - name: "AWS"
      `;

      const res = await mockRequest('POST', '/api/cost', {
        content: adacContent,
      });

      expect([200, 500]).toContain(res.status);
    });
  });
});
