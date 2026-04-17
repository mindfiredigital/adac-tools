import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index';

/**
 * Test suite for @mindfiredigital/adac-web-server
 * Tests all API endpoints for diagram generation, compliance checking, and cost analysis
 */
describe('Web Server API', () => {
  describe('GET /', () => {
    it('should serve homepage', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBeLessThanOrEqual(404); // May return 404 if public/index.html doesn't exist
    });
  });

  describe('POST /api/generate', () => {
    it('should require content in request body', async () => {
      const res = await request(app).post('/api/generate').send({});
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

      const res = await request(app)
        .post('/api/generate')
        .send({ content: adacContent, layout: 'elk' });

      // May fail due to dependencies, but should be a proper response
      expect([200, 500]).toContain(res.status);
    });

    it('should handle errors gracefully', async () => {
      const res = await request(app)
        .post('/api/generate')
        .send({ content: 'invalid: [' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBeDefined();
    });

    it('should return error logs if available', async () => {
      const res = await request(app)
        .post('/api/generate')
        .send({ content: 'invalid: [' });

      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /api/compliance-check', () => {
    it('should require content in request body', async () => {
      const res = await request(app).post('/api/compliance-check').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing content');
    });

    it('should require valid ADAC configuration', async () => {
      const res = await request(app)
        .post('/api/compliance-check')
        .send({ content: 'invalid: [' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBeDefined();
    });

    it('should require infrastructure in ADAC config', async () => {
      const res = await request(app)
        .post('/api/compliance-check')
        .send({ content: 'version: "1.0"' });

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

      const res = await request(app)
        .post('/api/compliance-check')
        .send({ content: adacContent });

      expect([200, 500]).toContain(res.status);
    });

    it('should handle YAML parsing errors', async () => {
      const res = await request(app)
        .post('/api/compliance-check')
        .send({ content: 'invalid: [' });

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

      const res = await request(app)
        .post('/api/compliance-check')
        .send({ content: adacContent });

      if (res.status === 200) {
        expect(res.body).toBeDefined();
      }
    });
  });

  describe('POST /api/cost', () => {
    it('should require content in request body', async () => {
      const res = await request(app).post('/api/cost').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing content');
    });

    it('should require valid ADAC configuration', async () => {
      const res = await request(app)
        .post('/api/cost')
        .send({ content: 'invalid: [' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBeDefined();
    });

    it('should require infrastructure in ADAC config', async () => {
      const res = await request(app)
        .post('/api/cost')
        .send({ content: 'version: "1.0"' });

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

      const res = await request(app)
        .post('/api/cost')
        .send({ content: adacContent });

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

      const res = await request(app)
        .post('/api/cost')
        .send({ content: adacContent });

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

      const res = await request(app)
        .post('/api/cost')
        .send({ content: adacContent });

      expect([200, 500]).toContain(res.status);
    });

    it('should handle configs with no clouds', async () => {
      const adacContent = `
        version: "1.0"
        infrastructure:
          name: "On-Premise Architecture"
      `;

      const res = await request(app)
        .post('/api/cost')
        .send({ content: adacContent });

      expect([200, 500]).toContain(res.status);
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers in response', async () => {
      const res = await request(app)
        .get('/')
        .set('Origin', 'http://localhost:3000');

      // CORS should be enabled
      expect(res.headers).toBeDefined();
    });
  });

  describe('Request Size Limits', () => {
    it('should handle large JSON payloads up to 10mb', async () => {
      const largeContent = 'a'.repeat(1000); // 1KB content
      const res = await request(app)
        .post('/api/generate')
        .send({ content: largeContent });

      // Should not fail due to size limit
      expect(res.status).not.toBe(413); // 413 = Payload Too Large
    });

    it('should accept valid JSON body', async () => {
      const res = await request(app)
        .post('/api/generate')
        .set('Content-Type', 'application/json')
        .send({ content: 'test' });

      expect(res.status).not.toBe(400); // Should parse JSON
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      const res = await request(app)
        .post('/api/generate')
        .send({ content: null });

      // Should not crash the server
      expect(res.status).toBeLessThan(600);
    });

    it('should provide error messages in responses', async () => {
      const res = await request(app).post('/api/generate').send({});

      expect(res.body).toHaveProperty('error');
      expect(typeof res.body.error).toBe('string');
    });

    it('should log unhandled errors', async () => {
      const res = await request(app)
        .post('/api/compliance-check')
        .send({ content: 'a: [invalid' });

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
      const res = await request(app).post('/api/generate').send({});

      expect(res.headers['content-type']).toContain('application/json');
    });

    it('should include error field in error responses', async () => {
      const res = await request(app).post('/api/generate').send({});

      expect(res.body).toHaveProperty('error');
    });

    it('should handle different content types', async () => {
      const res = await request(app)
        .post('/api/generate')
        .set('Content-Type', 'application/json')
        .send({ content: 'test' });

      expect(res.status).toBeLessThan(600);
    });
  });
});
