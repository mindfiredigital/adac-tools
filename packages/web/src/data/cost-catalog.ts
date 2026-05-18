/**
 * Cloud service pricing catalog and logic for architecture cost estimation.
 * Provides monthly cost maps for AWS/GCP services based on default instance sizes.
 * Each service type has multiple pricing tiers the user can select from.
 * Monthly costs are estimates in USD for a typical small-to-medium workload.
 */

export interface CostTier {
  name: string;
  monthlyCost: number;
  description: string;
}

export interface ServiceCostEntry {
  serviceType: string;
  displayName: string;
  provider: 'aws' | 'gcp' | 'azure';
  tiers: CostTier[];
}

// ─── AWS Service Pricing ────────────────────────────────────────────────────
const awsCatalog: ServiceCostEntry[] = [
  {
    serviceType: 'ec2',
    displayName: 'EC2',
    provider: 'aws',
    tiers: [
      { name: 't3.micro', monthlyCost: 7.59, description: '2 vCPU, 1 GiB' },
      { name: 't3.medium', monthlyCost: 30.37, description: '2 vCPU, 4 GiB' },
      { name: 'm5.large', monthlyCost: 69.12, description: '2 vCPU, 8 GiB' },
      { name: 'c5.xlarge', monthlyCost: 124.0, description: '4 vCPU, 8 GiB' },
    ],
  },
  {
    serviceType: 's3',
    displayName: 'S3',
    provider: 'aws',
    tiers: [
      {
        name: 'Standard 50GB',
        monthlyCost: 1.15,
        description: 'First 50 TB/month',
      },
      {
        name: 'Standard 500GB',
        monthlyCost: 11.5,
        description: '~500 GB storage',
      },
      { name: 'Standard 1TB', monthlyCost: 23.0, description: '~1 TB storage' },
      { name: 'Glacier 1TB', monthlyCost: 4.0, description: 'Archive storage' },
    ],
  },
  {
    serviceType: 'lambda',
    displayName: 'Lambda',
    provider: 'aws',
    tiers: [
      {
        name: 'Low (1M req)',
        monthlyCost: 0.2,
        description: '1M requests, 128MB',
      },
      {
        name: 'Medium (10M req)',
        monthlyCost: 6.0,
        description: '10M requests, 256MB',
      },
      {
        name: 'High (100M req)',
        monthlyCost: 48.0,
        description: '100M requests, 512MB',
      },
    ],
  },
  {
    serviceType: 'rds-mysql',
    displayName: 'RDS MySQL',
    provider: 'aws',
    tiers: [
      { name: 'db.t3.micro', monthlyCost: 12.41, description: '2 vCPU, 1 GiB' },
      {
        name: 'db.t3.medium',
        monthlyCost: 49.64,
        description: '2 vCPU, 4 GiB',
      },
      { name: 'db.m5.large', monthlyCost: 124.1, description: '2 vCPU, 8 GiB' },
      {
        name: 'db.r5.xlarge',
        monthlyCost: 288.0,
        description: '4 vCPU, 32 GiB',
      },
    ],
  },
  {
    serviceType: 'dynamodb',
    displayName: 'DynamoDB',
    provider: 'aws',
    tiers: [
      {
        name: 'On-Demand (Low)',
        monthlyCost: 6.25,
        description: '~5M read/write',
      },
      {
        name: 'On-Demand (Medium)',
        monthlyCost: 25.0,
        description: '~25M read/write',
      },
      {
        name: 'Provisioned',
        monthlyCost: 50.0,
        description: '100 RCU / 100 WCU',
      },
    ],
  },
  {
    serviceType: 'sqs',
    displayName: 'SQS',
    provider: 'aws',
    tiers: [
      { name: 'Standard (1M)', monthlyCost: 0.4, description: '1M messages' },
      {
        name: 'Standard (100M)',
        monthlyCost: 40.0,
        description: '100M messages',
      },
      { name: 'FIFO (1M)', monthlyCost: 0.5, description: '1M FIFO messages' },
    ],
  },
  {
    serviceType: 'sns',
    displayName: 'SNS',
    provider: 'aws',
    tiers: [
      { name: 'Standard (1M)', monthlyCost: 0.5, description: '1M publishes' },
      {
        name: 'Standard (100M)',
        monthlyCost: 50.0,
        description: '100M publishes',
      },
    ],
  },
  {
    serviceType: 'api-gateway-rest',
    displayName: 'API Gateway',
    provider: 'aws',
    tiers: [
      {
        name: 'REST (1M calls)',
        monthlyCost: 3.5,
        description: '1M REST API calls',
      },
      {
        name: 'REST (100M calls)',
        monthlyCost: 305.0,
        description: '100M REST API calls',
      },
      {
        name: 'HTTP (1M calls)',
        monthlyCost: 1.0,
        description: '1M HTTP API calls',
      },
    ],
  },
  {
    serviceType: 'cloudfront',
    displayName: 'CloudFront',
    provider: 'aws',
    tiers: [
      {
        name: '100GB/mo',
        monthlyCost: 8.5,
        description: '100GB data transfer',
      },
      { name: '1TB/mo', monthlyCost: 85.0, description: '1TB data transfer' },
    ],
  },
  {
    serviceType: 'route53',
    displayName: 'Route 53',
    provider: 'aws',
    tiers: [
      { name: 'Hosted Zone', monthlyCost: 0.5, description: 'Per hosted zone' },
      {
        name: '+ 1M queries',
        monthlyCost: 0.9,
        description: 'Zone + 1M queries',
      },
    ],
  },
  {
    serviceType: 'ecs-fargate',
    displayName: 'ECS Fargate',
    provider: 'aws',
    tiers: [
      {
        name: '0.25 vCPU / 512MB',
        monthlyCost: 9.22,
        description: 'Minimal task',
      },
      { name: '0.5 vCPU / 1GB', monthlyCost: 18.43, description: 'Small task' },
      {
        name: '1 vCPU / 2GB',
        monthlyCost: 36.86,
        description: 'Standard task',
      },
      { name: '2 vCPU / 4GB', monthlyCost: 73.72, description: 'Large task' },
    ],
  },
  {
    serviceType: 'eventbridge',
    displayName: 'EventBridge',
    provider: 'aws',
    tiers: [
      { name: '1M events', monthlyCost: 1.0, description: '1M custom events' },
      {
        name: '100M events',
        monthlyCost: 100.0,
        description: '100M custom events',
      },
    ],
  },
  {
    serviceType: 'athena',
    displayName: 'Athena',
    provider: 'aws',
    tiers: [
      {
        name: '10GB scanned',
        monthlyCost: 0.05,
        description: '10 GB data scanned',
      },
      {
        name: '1TB scanned',
        monthlyCost: 5.0,
        description: '1 TB data scanned',
      },
      {
        name: '10TB scanned',
        monthlyCost: 50.0,
        description: '10 TB data scanned',
      },
    ],
  },
  {
    serviceType: 'glue',
    displayName: 'Glue',
    provider: 'aws',
    tiers: [
      { name: '10 DPU-hours/mo', monthlyCost: 4.4, description: 'Light ETL' },
      {
        name: '100 DPU-hours/mo',
        monthlyCost: 44.0,
        description: 'Medium ETL',
      },
    ],
  },
  {
    serviceType: 'emr',
    displayName: 'EMR',
    provider: 'aws',
    tiers: [
      { name: 'm5.xlarge cluster', monthlyCost: 138.0, description: '3 nodes' },
      {
        name: 'r5.2xlarge cluster',
        monthlyCost: 382.0,
        description: '3 nodes',
      },
    ],
  },
  {
    serviceType: 'cognito',
    displayName: 'Cognito',
    provider: 'aws',
    tiers: [
      { name: 'Up to 50K MAU', monthlyCost: 0.0, description: 'Free tier' },
      { name: '50K-100K MAU', monthlyCost: 137.5, description: '$0.00275/MAU' },
    ],
  },
  {
    serviceType: 'vpc',
    displayName: 'VPC',
    provider: 'aws',
    tiers: [
      {
        name: 'VPC + NAT Gateway',
        monthlyCost: 32.4,
        description: 'NAT + processing',
      },
      { name: 'VPC Only', monthlyCost: 0.0, description: 'No NAT Gateway' },
    ],
  },
  {
    serviceType: 'iam',
    displayName: 'IAM',
    provider: 'aws',
    tiers: [
      { name: 'Free', monthlyCost: 0.0, description: 'No additional cost' },
    ],
  },
];

// ─── GCP Service Pricing ────────────────────────────────────────────────────
const gcpCatalog: ServiceCostEntry[] = [
  {
    serviceType: 'compute-engine',
    displayName: 'Compute Engine',
    provider: 'gcp',
    tiers: [
      { name: 'e2-micro', monthlyCost: 6.11, description: '0.25 vCPU, 1 GB' },
      { name: 'e2-medium', monthlyCost: 24.46, description: '1 vCPU, 4 GB' },
      {
        name: 'n2-standard-2',
        monthlyCost: 68.91,
        description: '2 vCPU, 8 GB',
      },
      {
        name: 'n2-standard-4',
        monthlyCost: 137.82,
        description: '4 vCPU, 16 GB',
      },
    ],
  },
  {
    serviceType: 'cloud-run',
    displayName: 'Cloud Run',
    provider: 'gcp',
    tiers: [
      {
        name: 'Low (1M req)',
        monthlyCost: 0.0,
        description: 'Free tier (2M req)',
      },
      {
        name: 'Medium (10M req)',
        monthlyCost: 18.0,
        description: '~10M requests, 1 vCPU',
      },
      {
        name: 'High (100M req)',
        monthlyCost: 150.0,
        description: '~100M requests, 2 vCPU',
      },
    ],
  },
  {
    serviceType: 'gke',
    displayName: 'GKE',
    provider: 'gcp',
    tiers: [
      {
        name: 'Autopilot Small',
        monthlyCost: 72.0,
        description: 'Cluster mgmt + 2 vCPU',
      },
      {
        name: 'Autopilot Medium',
        monthlyCost: 195.0,
        description: 'Cluster mgmt + 8 vCPU',
      },
      {
        name: 'Standard (3 nodes)',
        monthlyCost: 219.0,
        description: 'e2-standard-2 × 3',
      },
    ],
  },
  {
    serviceType: 'cloud-storage',
    displayName: 'Cloud Storage',
    provider: 'gcp',
    tiers: [
      {
        name: 'Standard 50GB',
        monthlyCost: 1.04,
        description: 'Standard class',
      },
      { name: 'Standard 500GB', monthlyCost: 10.4, description: '~500 GB' },
      { name: 'Standard 1TB', monthlyCost: 20.8, description: '~1 TB' },
      { name: 'Nearline 1TB', monthlyCost: 10.0, description: 'Archive 1 TB' },
    ],
  },
  {
    serviceType: 'bigquery',
    displayName: 'BigQuery',
    provider: 'gcp',
    tiers: [
      {
        name: 'On-demand (1TB)',
        monthlyCost: 6.25,
        description: '1 TB queries/mo',
      },
      {
        name: 'On-demand (10TB)',
        monthlyCost: 62.5,
        description: '10 TB queries/mo',
      },
      {
        name: 'Flat-rate 100 slots',
        monthlyCost: 2000.0,
        description: '100 slot reservation',
      },
    ],
  },
  {
    serviceType: 'cloud-sql',
    displayName: 'Cloud SQL',
    provider: 'gcp',
    tiers: [
      {
        name: 'db-f1-micro',
        monthlyCost: 7.67,
        description: 'Shared vCPU, 0.6 GB',
      },
      {
        name: 'db-custom-2-8192',
        monthlyCost: 70.0,
        description: '2 vCPU, 8 GB',
      },
      {
        name: 'db-custom-4-16384',
        monthlyCost: 140.0,
        description: '4 vCPU, 16 GB',
      },
    ],
  },
  {
    serviceType: 'cloud-functions',
    displayName: 'Cloud Functions',
    provider: 'gcp',
    tiers: [
      {
        name: 'Low (1M inv)',
        monthlyCost: 0.0,
        description: 'Free tier (2M inv)',
      },
      {
        name: 'Medium (10M inv)',
        monthlyCost: 4.0,
        description: '10M invocations',
      },
      {
        name: 'High (100M inv)',
        monthlyCost: 40.0,
        description: '100M invocations',
      },
    ],
  },
  {
    serviceType: 'pubsub',
    displayName: 'Pub/Sub',
    provider: 'gcp',
    tiers: [
      { name: '10GB/mo', monthlyCost: 0.0, description: 'Free tier' },
      { name: '100GB/mo', monthlyCost: 4.0, description: '~100 GB messages' },
      { name: '1TB/mo', monthlyCost: 40.0, description: '~1 TB messages' },
    ],
  },
  {
    serviceType: 'cloud-spanner',
    displayName: 'Cloud Spanner',
    provider: 'gcp',
    tiers: [
      {
        name: '100 PU',
        monthlyCost: 65.0,
        description: '100 processing units',
      },
      {
        name: '1 Node',
        monthlyCost: 650.0,
        description: '1000 processing units',
      },
      { name: '3 Nodes', monthlyCost: 1950.0, description: 'Multi-region' },
    ],
  },
  {
    serviceType: 'bigtable',
    displayName: 'Bigtable',
    provider: 'gcp',
    tiers: [
      { name: '1 Node', monthlyCost: 468.0, description: 'SSD, 1 node' },
      {
        name: '3 Nodes',
        monthlyCost: 1404.0,
        description: 'SSD, 3 nodes (production)',
      },
    ],
  },
  {
    serviceType: 'alloydb',
    displayName: 'AlloyDB',
    provider: 'gcp',
    tiers: [
      { name: '2 vCPU', monthlyCost: 130.0, description: '2 vCPU primary' },
      { name: '4 vCPU', monthlyCost: 260.0, description: '4 vCPU primary' },
    ],
  },
  {
    serviceType: 'vertex-ai',
    displayName: 'Vertex AI',
    provider: 'gcp',
    tiers: [
      {
        name: 'Prediction (low)',
        monthlyCost: 50.0,
        description: 'n1-standard-2 endpoint',
      },
      {
        name: 'Training (GPU)',
        monthlyCost: 350.0,
        description: 'T4 GPU, 100 hrs',
      },
    ],
  },
  {
    serviceType: 'cloud-build',
    displayName: 'Cloud Build',
    provider: 'gcp',
    tiers: [
      { name: 'Free tier', monthlyCost: 0.0, description: '120 build-min/day' },
      {
        name: 'Standard',
        monthlyCost: 3.0,
        description: '~100 extra build-min',
      },
    ],
  },
  {
    serviceType: 'vpc',
    displayName: 'VPC',
    provider: 'gcp',
    tiers: [
      {
        name: 'VPC + Cloud NAT',
        monthlyCost: 32.09,
        description: 'NAT gateway + processing',
      },
      { name: 'VPC Only', monthlyCost: 0.0, description: 'No NAT gateway' },
    ],
  },
];

// ─── Azure Service Pricing ──────────────────────────────────────────────────
const azureCatalog: ServiceCostEntry[] = [
  {
    serviceType: 'virtual-machine',
    displayName: 'Virtual Machine',
    provider: 'azure',
    tiers: [
      { name: 'B1s', monthlyCost: 7.59, description: '1 vCPU, 1 GiB' },
      { name: 'D2s v3', monthlyCost: 70.08, description: '2 vCPU, 8 GiB' },
      { name: 'D4s v3', monthlyCost: 140.16, description: '4 vCPU, 16 GiB' },
    ],
  },
  {
    serviceType: 'storage-account',
    displayName: 'Storage Account',
    provider: 'azure',
    tiers: [
      { name: 'Hot LRS 50GB', monthlyCost: 1.0, description: 'Standard tier' },
      {
        name: 'Hot LRS 500GB',
        monthlyCost: 10.0,
        description: 'Standard tier',
      },
      { name: 'Archive 1TB', monthlyCost: 1.0, description: 'LRS Archive' },
    ],
  },
  {
    serviceType: 'app-service',
    displayName: 'App Service',
    provider: 'azure',
    tiers: [
      { name: 'B1 (Basic)', monthlyCost: 12.41, description: '1.75 GB RAM' },
      { name: 'P1v2 (Premium)', monthlyCost: 146.0, description: '3.5 GB RAM' },
    ],
  },
  {
    serviceType: 'sql-database',
    displayName: 'SQL Database',
    provider: 'azure',
    tiers: [
      { name: 'S0 (Standard)', monthlyCost: 15.0, description: '10 DTU' },
      { name: 'P1 (Premium)', monthlyCost: 465.0, description: '125 DTU' },
    ],
  },
  {
    serviceType: 'cosmos-db',
    displayName: 'Cosmos DB',
    provider: 'azure',
    tiers: [
      { name: '400 RU/s', monthlyCost: 24.0, description: 'Provisioned' },
      { name: '1000 RU/s', monthlyCost: 60.0, description: 'Provisioned' },
    ],
  },
  {
    serviceType: 'aks',
    displayName: 'AKS',
    provider: 'azure',
    tiers: [
      {
        name: 'Standard (3 nodes)',
        monthlyCost: 210.0,
        description: 'D2s_v3 x 3',
      },
    ],
  },
  {
    serviceType: 'vnet',
    displayName: 'VNET',
    provider: 'azure',
    tiers: [
      { name: 'Free', monthlyCost: 0.0, description: 'No additional cost' },
    ],
  },
];

export const costCatalog: ServiceCostEntry[] = [
  ...awsCatalog,
  ...gcpCatalog,
  ...azureCatalog,
];

/**
 * Look up cost tiers for a given service type and provider.
 * Falls back to a "Custom" entry if the service isn't in the catalog.
 */
export function getCostTiers(
  serviceType: string,
  provider: 'aws' | 'gcp' | 'azure'
): CostTier[] {
  const entry = costCatalog.find(
    (e) => e.serviceType === serviceType && e.provider === provider
  );
  return (
    entry?.tiers ?? [
      { name: 'Custom', monthlyCost: 0, description: 'Enter custom cost' },
    ]
  );
}

/**
 * Available compliance frameworks.
 */
export const COMPLIANCE_FRAMEWORKS = [
  {
    id: 'pci-dss',
    name: 'PCI-DSS',
    description: 'Payment Card Industry Data Security Standard',
  },
  {
    id: 'hipaa',
    name: 'HIPAA',
    description: 'Health Insurance Portability and Accountability Act',
  },
  { id: 'soc2', name: 'SOC2', description: 'Service Organization Control 2' },
  {
    id: 'gdpr',
    name: 'GDPR',
    description: 'General Data Protection Regulation',
  },
  {
    id: 'iso27001',
    name: 'ISO 27001',
    description: 'Information Security Management',
  },
  {
    id: 'fedramp',
    name: 'FedRAMP',
    description: 'Federal Risk and Authorization Management',
  },
] as const;

export type ComplianceFrameworkId =
  (typeof COMPLIANCE_FRAMEWORKS)[number]['id'];
