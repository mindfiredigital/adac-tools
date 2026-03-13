import { CostCalculator } from './calculator';
import { CostConfig } from './types';
import fs from 'fs';
import yaml from 'js-yaml';

interface YamlService {
  type?: string;
  subtype?: string;
  config?: {
    instance_class?: string;
    vcpu?: number;
    memory_gb?: number;
    count?: number;
  };
}

interface YamlCloud {
  services?: YamlService[];
}

interface YamlInfrastructure {
  infrastructure?: {
    clouds?: YamlCloud[];
  };
}

export function aggregateCostFromYaml(yamlPath: string) {
  const file = fs.readFileSync(yamlPath, 'utf8');
  const parsed = yaml.load(file) as YamlInfrastructure;

  // Extract services from YAML
  let clouds: YamlCloud[] = [];
  let services: YamlService[] = [];

  if (parsed && typeof parsed === 'object' && 'infrastructure' in parsed) {
    clouds = parsed.infrastructure?.clouds ?? [];

    if (clouds.length > 0 && clouds[0].services) {
      services = clouds[0].services;
    }
  }

  // Create CostConfig
  const costConfig: CostConfig = {
    compute: [],
    database: [],
    storage: [],
    networking: [],
  };

  // Map YAML services → cost config
  for (const svc of services) {
    if (svc.type === 'compute' && svc.subtype === 'ec2') {
      costConfig.compute?.push({
        type: 'ec2',
        instanceType: svc.config?.instance_class ?? 't3.micro',
        count: svc.config?.count ?? 1,
        pricingModel: 'on_demand',
      });
    } else if (svc.type === 'compute' && svc.subtype === 'ecs-fargate') {
      costConfig.compute?.push({
        type: 'ecs',
        vcpu: svc.config?.vcpu ?? 0.25,
        memoryGB: svc.config?.memory_gb ?? 0.5,
        count: svc.config?.count ?? 1,
        pricingModel: 'on_demand',
      });
    } else if (svc.type === 'database' && svc.subtype === 'rds-postgres') {
      costConfig.database?.push({
        type: 'rds',
        instanceType: svc.config?.instance_class ?? 'db.t3.micro',
        count: 1,
        pricingModel: 'on_demand',
      });
    } else if (
      svc.type === 'network' &&
      svc.subtype === 'application-load-balancer'
    ) {
      costConfig.networking?.push({
        type: 'data_transfer',
        transferGB: 200,
        pricingModel: 'on_demand',
      });
    }
  }

  const calculator = new CostCalculator();
  return calculator.calculate(costConfig, 'monthly');
}
