import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const MAPPINGS_DIR = path.join(__dirname, '..', 'mappings');
const SERVICES_CONFIG_FILE = path.join(MAPPINGS_DIR, 'services.yaml');

interface ServiceInfo {
  name: string;
  category?: string;
  color: string;
}

describe('Azure Services YAML Configuration', () => {
  let serviceMappings: Record<string, ServiceInfo>;

  // Load and parse the YAML once before all tests
  it('should load and parse services.yaml successfully', () => {
    expect(fs.existsSync(SERVICES_CONFIG_FILE)).toBe(true);
    const content = fs.readFileSync(SERVICES_CONFIG_FILE, 'utf8');
    serviceMappings = yaml.load(content) as Record<string, ServiceInfo>;
    expect(serviceMappings).toBeDefined();
    expect(typeof serviceMappings).toBe('object');
  });

  it('should contain Azure service entries', () => {
    const content = fs.readFileSync(SERVICES_CONFIG_FILE, 'utf8');
    serviceMappings = yaml.load(content) as Record<string, ServiceInfo>;
    const keys = Object.keys(serviceMappings);
    expect(keys.length).toBeGreaterThan(0);
  });

  it('should have valid structure for each service entry', () => {
    const content = fs.readFileSync(SERVICES_CONFIG_FILE, 'utf8');
    serviceMappings = yaml.load(content) as Record<string, ServiceInfo>;

    for (const [key, info] of Object.entries(serviceMappings)) {
      // Each service must have a name
      expect(info.name).toBeDefined();
      expect(typeof info.name).toBe('string');
      expect(info.name.length).toBeGreaterThan(0);

      // Each service must have a color
      expect(info.color).toBeDefined();
      expect(typeof info.color).toBe('string');

      // Color should be a valid hex color
      expect(info.color).toMatch(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);

      // Key should be lowercase with hyphens (slug format)
      expect(key).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('should contain core compute services', () => {
    const content = fs.readFileSync(SERVICES_CONFIG_FILE, 'utf8');
    serviceMappings = yaml.load(content) as Record<string, ServiceInfo>;

    expect(serviceMappings['virtual-machines']).toBeDefined();
    expect(serviceMappings['azure-functions']).toBeDefined();
    expect(serviceMappings['app-service']).toBeDefined();
    expect(serviceMappings['azure-kubernetes-service']).toBeDefined();
  });

  it('should contain core database services', () => {
    const content = fs.readFileSync(SERVICES_CONFIG_FILE, 'utf8');
    serviceMappings = yaml.load(content) as Record<string, ServiceInfo>;

    expect(serviceMappings['azure-sql-database']).toBeDefined();
    expect(serviceMappings['cosmos-db']).toBeDefined();
    expect(serviceMappings['azure-cache-for-redis']).toBeDefined();
  });

  it('should contain core networking services', () => {
    const content = fs.readFileSync(SERVICES_CONFIG_FILE, 'utf8');
    serviceMappings = yaml.load(content) as Record<string, ServiceInfo>;

    expect(serviceMappings['virtual-network']).toBeDefined();
    expect(serviceMappings['azure-load-balancer']).toBeDefined();
    expect(serviceMappings['azure-firewall']).toBeDefined();
    expect(serviceMappings['azure-front-door']).toBeDefined();
  });

  it('should contain core storage services', () => {
    const content = fs.readFileSync(SERVICES_CONFIG_FILE, 'utf8');
    serviceMappings = yaml.load(content) as Record<string, ServiceInfo>;

    expect(serviceMappings['azure-blob-storage']).toBeDefined();
    expect(serviceMappings['azure-files']).toBeDefined();
    expect(serviceMappings['azure-data-lake-storage']).toBeDefined();
  });

  it('should contain core security services', () => {
    const content = fs.readFileSync(SERVICES_CONFIG_FILE, 'utf8');
    serviceMappings = yaml.load(content) as Record<string, ServiceInfo>;

    expect(serviceMappings['azure-key-vault']).toBeDefined();
    expect(serviceMappings['azure-active-directory']).toBeDefined();
    expect(serviceMappings['microsoft-defender-for-cloud']).toBeDefined();
  });

  it('should contain integration services', () => {
    const content = fs.readFileSync(SERVICES_CONFIG_FILE, 'utf8');
    serviceMappings = yaml.load(content) as Record<string, ServiceInfo>;

    expect(serviceMappings['azure-service-bus']).toBeDefined();
    expect(serviceMappings['azure-event-hubs']).toBeDefined();
    expect(serviceMappings['azure-logic-apps']).toBeDefined();
  });

  it('should contain analytics services', () => {
    const content = fs.readFileSync(SERVICES_CONFIG_FILE, 'utf8');
    serviceMappings = yaml.load(content) as Record<string, ServiceInfo>;

    expect(serviceMappings['azure-synapse-analytics']).toBeDefined();
    expect(serviceMappings['azure-databricks']).toBeDefined();
    expect(serviceMappings['azure-data-factory']).toBeDefined();
  });

  it('should contain AI/ML services', () => {
    const content = fs.readFileSync(SERVICES_CONFIG_FILE, 'utf8');
    serviceMappings = yaml.load(content) as Record<string, ServiceInfo>;

    expect(serviceMappings['azure-machine-learning']).toBeDefined();
    expect(serviceMappings['azure-openai-service']).toBeDefined();
    expect(serviceMappings['azure-cognitive-services']).toBeDefined();
  });

  it('should contain network topology containers', () => {
    const content = fs.readFileSync(SERVICES_CONFIG_FILE, 'utf8');
    serviceMappings = yaml.load(content) as Record<string, ServiceInfo>;

    expect(serviceMappings['subnet']).toBeDefined();
    expect(serviceMappings['resource-group']).toBeDefined();
    expect(serviceMappings['region']).toBeDefined();
    expect(serviceMappings['subscription']).toBeDefined();
  });

  it('should have category field for all entries', () => {
    const content = fs.readFileSync(SERVICES_CONFIG_FILE, 'utf8');
    serviceMappings = yaml.load(content) as Record<string, ServiceInfo>;

    for (const [, info] of Object.entries(serviceMappings)) {
      expect(info.category).toBeDefined();
      expect(typeof info.category).toBe('string');
      expect(info.category!.length).toBeGreaterThan(0);
    }
  });

  it('should contain service aliases (e.g., aks, vnet)', () => {
    const content = fs.readFileSync(SERVICES_CONFIG_FILE, 'utf8');
    serviceMappings = yaml.load(content) as Record<string, ServiceInfo>;

    // AKS should be an alias for Azure Kubernetes Service
    expect(serviceMappings['aks']).toBeDefined();
    expect(serviceMappings['aks'].name).toBe(
      serviceMappings['azure-kubernetes-service'].name
    );

    // vnet should be an alias for Virtual Network
    expect(serviceMappings['vnet']).toBeDefined();
    expect(serviceMappings['vnet'].name).toBe(
      serviceMappings['virtual-network'].name
    );
  });
});
