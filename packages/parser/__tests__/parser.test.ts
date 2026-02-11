import { parseAdac, parseAdacFromContent } from '../src/index';
import fs from 'fs';
import yaml from 'js-yaml';

jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('Parser', () => {
  describe('parseAdacFromContent', () => {
    it('should parse valid YAML content', () => {
      const yamlContent = `
applications:
  - id: app-1
    name: Test App
    type: web
infrastructure:
  clouds:
    - provider: aws
      services:
        - id: svc-1
          type: AWS::EC2::Instance
`;

      const result = parseAdacFromContent(yamlContent);

      expect(result.applications).toHaveLength(1);
      expect(result.applications[0].id).toBe('app-1');
      expect(result.infrastructure.clouds).toHaveLength(1);
    });

    it('should parse minimal valid configuration', () => {
      const yamlContent = `
applications: []
infrastructure:
  clouds: []
`;

      const result = parseAdacFromContent(yamlContent);

      expect(result.applications).toHaveLength(0);
      expect(result.infrastructure.clouds).toHaveLength(0);
    });

    it('should parse configuration with connections', () => {
      const yamlContent = `
applications:
  - id: app-1
    name: App
    type: web
infrastructure:
  clouds:
    - provider: aws
      services: []
connections:
  - from: app-1
    to: svc-1
    type: http
`;

      const result = parseAdacFromContent(yamlContent);

      expect(result.connections).toHaveLength(1);
      expect(result.connections![0].from).toBe('app-1');
      expect(result.connections![0].to).toBe('svc-1');
    });

    it('should parse configuration with layout setting', () => {
      const yamlContent = `
applications: []
infrastructure:
  clouds: []
layout: elk
`;

      const result = parseAdacFromContent(yamlContent);

      expect(result.layout).toBe('elk');
    });

    it('should parse configuration with dagre layout', () => {
      const yamlContent = `
applications: []
infrastructure:
  clouds: []
layout: dagre
`;

      const result = parseAdacFromContent(yamlContent);

      expect(result.layout).toBe('dagre');
    });

    it('should handle complex nested structure', () => {
      const yamlContent = `
applications:
  - id: frontend
    name: Web Frontend
    type: web
    technology: React
    ai_tags:
      icon: react
      group: ui
  - id: backend
    name: API Server
    type: api
    technology: Node.js
infrastructure:
  clouds:
    - provider: aws
      services:
        - id: ec2-1
          type: AWS::EC2::Instance
          name: Web Server
          runs: [frontend]
        - id: rds-1
          type: AWS::RDS::DBInstance
          name: Database
connections:
  - from: frontend
    to: backend
    type: http
  - from: backend
    to: rds-1
    type: tcp
`;

      const result = parseAdacFromContent(yamlContent);

      expect(result.applications).toHaveLength(2);
      expect(result.infrastructure.clouds[0].services).toHaveLength(2);
      expect(result.connections).toHaveLength(2);
    });
  });

  describe('parseAdac', () => {
    it('should read file and parse content', () => {
      const yamlContent = `
applications:
  - id: app-1
    name: Test
    type: web
infrastructure:
  clouds: []
`;

      mockFs.readFileSync.mockReturnValue(yamlContent);

      const result = parseAdac('/path/to/test.yaml');

      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        '/path/to/test.yaml',
        'utf8'
      );
      expect(result.applications).toHaveLength(1);
    });

    it('should handle different file paths', () => {
      const yamlContent = `
applications: []
infrastructure:
  clouds: []
`;

      mockFs.readFileSync.mockReturnValue(yamlContent);

      parseAdac('/another/path/config.adac.yaml');

      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        '/another/path/config.adac.yaml',
        'utf8'
      );
    });
  });
});
