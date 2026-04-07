/**
 * ADAC service and schema metadata used by IntelliSense, hover, and completion providers.
 * Derived from the ADAC JSON Schema at packages/schema/src/adac.schema.json.
 */

import type { ServiceInfo } from './types/index';

/** All known AWS services from the schema */
/**
 * AWS_SERVICES
 * @description Provides IDE suggestions for AWS_SERVICES
 */
export const AWS_SERVICES: Record<string, ServiceInfo> = {
  ec2: {
    name: 'Amazon EC2',
    description: 'Elastic Compute Cloud - Scalable virtual servers',
    category: 'Compute',
    provider: 'aws',
  },
  'ecs-fargate': {
    name: 'Amazon ECS (Fargate)',
    description: 'Serverless container orchestration',
    category: 'Compute',
    provider: 'aws',
  },
  'ecs-ec2': {
    name: 'Amazon ECS (EC2)',
    description: 'Container orchestration on EC2 instances',
    category: 'Compute',
    provider: 'aws',
  },
  eks: {
    name: 'Amazon EKS',
    description: 'Managed Kubernetes service',
    category: 'Compute',
    provider: 'aws',
  },
  lambda: {
    name: 'AWS Lambda',
    description: 'Serverless compute - Run code without managing servers',
    category: 'Compute',
    provider: 'aws',
  },
  'elastic-beanstalk': {
    name: 'AWS Elastic Beanstalk',
    description: 'Application deployment and management',
    category: 'Compute',
    provider: 'aws',
  },
  lightsail: {
    name: 'Amazon Lightsail',
    description: 'Simple virtual private servers',
    category: 'Compute',
    provider: 'aws',
  },
  batch: {
    name: 'AWS Batch',
    description: 'Batch computing in the cloud',
    category: 'Compute',
    provider: 'aws',
  },
  'rds-mysql': {
    name: 'Amazon RDS (MySQL)',
    description: 'Managed MySQL database',
    category: 'Database',
    provider: 'aws',
  },
  'rds-postgres': {
    name: 'Amazon RDS (PostgreSQL)',
    description: 'Managed PostgreSQL database',
    category: 'Database',
    provider: 'aws',
  },
  'rds-mariadb': {
    name: 'Amazon RDS (MariaDB)',
    description: 'Managed MariaDB database',
    category: 'Database',
    provider: 'aws',
  },
  'rds-oracle': {
    name: 'Amazon RDS (Oracle)',
    description: 'Managed Oracle database',
    category: 'Database',
    provider: 'aws',
  },
  'rds-sqlserver': {
    name: 'Amazon RDS (SQL Server)',
    description: 'Managed SQL Server database',
    category: 'Database',
    provider: 'aws',
  },
  'rds-aurora-mysql': {
    name: 'Amazon Aurora (MySQL)',
    description: 'MySQL-compatible relational database',
    category: 'Database',
    provider: 'aws',
  },
  'rds-aurora-postgres': {
    name: 'Amazon Aurora (PostgreSQL)',
    description: 'PostgreSQL-compatible relational database',
    category: 'Database',
    provider: 'aws',
  },
  dynamodb: {
    name: 'Amazon DynamoDB',
    description: 'Managed NoSQL key-value and document database',
    category: 'Database',
    provider: 'aws',
  },
  documentdb: {
    name: 'Amazon DocumentDB',
    description: 'MongoDB-compatible document database',
    category: 'Database',
    provider: 'aws',
  },
  neptune: {
    name: 'Amazon Neptune',
    description: 'Managed graph database',
    category: 'Database',
    provider: 'aws',
  },
  'elasticache-redis': {
    name: 'Amazon ElastiCache (Redis)',
    description: 'Managed Redis cache',
    category: 'Database',
    provider: 'aws',
  },
  'elasticache-memcached': {
    name: 'Amazon ElastiCache (Memcached)',
    description: 'Managed Memcached cache',
    category: 'Database',
    provider: 'aws',
  },
  redshift: {
    name: 'Amazon Redshift',
    description: 'Data warehousing service',
    category: 'Database',
    provider: 'aws',
  },
  timestream: {
    name: 'Amazon Timestream',
    description: 'Time-series database',
    category: 'Database',
    provider: 'aws',
  },
  s3: {
    name: 'Amazon S3',
    description: 'Simple Storage Service - Object storage',
    category: 'Storage',
    provider: 'aws',
  },
  efs: {
    name: 'Amazon EFS',
    description: 'Elastic File System - Managed NFS',
    category: 'Storage',
    provider: 'aws',
  },
  fsx: {
    name: 'Amazon FSx',
    description: 'Managed file systems',
    category: 'Storage',
    provider: 'aws',
  },
  glacier: {
    name: 'Amazon S3 Glacier',
    description: 'Archive storage',
    category: 'Storage',
    provider: 'aws',
  },
  'storage-gateway': {
    name: 'AWS Storage Gateway',
    description: 'Hybrid cloud storage',
    category: 'Storage',
    provider: 'aws',
  },
  alb: {
    name: 'Application Load Balancer',
    description: 'Layer 7 load balancer for HTTP/HTTPS',
    category: 'Networking',
    provider: 'aws',
  },
  nlb: {
    name: 'Network Load Balancer',
    description: 'Layer 4 load balancer for TCP/UDP',
    category: 'Networking',
    provider: 'aws',
  },
  clb: {
    name: 'Classic Load Balancer',
    description: 'Legacy load balancer',
    category: 'Networking',
    provider: 'aws',
  },
  cloudfront: {
    name: 'Amazon CloudFront',
    description: 'Global CDN for content delivery',
    category: 'Networking',
    provider: 'aws',
  },
  route53: {
    name: 'Amazon Route 53',
    description: 'DNS and domain registration service',
    category: 'Networking',
    provider: 'aws',
  },
  'api-gateway-rest': {
    name: 'API Gateway (REST)',
    description: 'REST API management',
    category: 'Networking',
    provider: 'aws',
  },
  'api-gateway-http': {
    name: 'API Gateway (HTTP)',
    description: 'HTTP API management',
    category: 'Networking',
    provider: 'aws',
  },
  'api-gateway-websocket': {
    name: 'API Gateway (WebSocket)',
    description: 'WebSocket API management',
    category: 'Networking',
    provider: 'aws',
  },
  appsync: {
    name: 'AWS AppSync',
    description: 'GraphQL API service',
    category: 'Networking',
    provider: 'aws',
  },
  vpc: {
    name: 'Amazon VPC',
    description: 'Virtual Private Cloud',
    category: 'Networking',
    provider: 'aws',
  },
  'direct-connect': {
    name: 'AWS Direct Connect',
    description: 'Dedicated network connection to AWS',
    category: 'Networking',
    provider: 'aws',
  },
  vpn: {
    name: 'AWS VPN',
    description: 'Virtual private network connections',
    category: 'Networking',
    provider: 'aws',
  },
  'transit-gateway': {
    name: 'AWS Transit Gateway',
    description: 'Network transit hub',
    category: 'Networking',
    provider: 'aws',
  },
  'nat-gateway': {
    name: 'NAT Gateway',
    description: 'Network address translation gateway',
    category: 'Networking',
    provider: 'aws',
  },
  'internet-gateway': {
    name: 'Internet Gateway',
    description: 'VPC internet access gateway',
    category: 'Networking',
    provider: 'aws',
  },
  sqs: {
    name: 'Amazon SQS',
    description: 'Simple Queue Service - Message queuing',
    category: 'Messaging',
    provider: 'aws',
  },
  sns: {
    name: 'Amazon SNS',
    description: 'Simple Notification Service - Pub/sub messaging',
    category: 'Messaging',
    provider: 'aws',
  },
  'kinesis-streams': {
    name: 'Amazon Kinesis Data Streams',
    description: 'Real-time data streaming',
    category: 'Messaging',
    provider: 'aws',
  },
  'kinesis-firehose': {
    name: 'Amazon Kinesis Data Firehose',
    description: 'Data delivery to storage',
    category: 'Messaging',
    provider: 'aws',
  },
  msk: {
    name: 'Amazon MSK',
    description: 'Managed Streaming for Apache Kafka',
    category: 'Messaging',
    provider: 'aws',
  },
  eventbridge: {
    name: 'Amazon EventBridge',
    description: 'Serverless event bus',
    category: 'Messaging',
    provider: 'aws',
  },
  'step-functions': {
    name: 'AWS Step Functions',
    description: 'Serverless workflow orchestration',
    category: 'Messaging',
    provider: 'aws',
  },
  cloudwatch: {
    name: 'Amazon CloudWatch',
    description: 'Monitoring and observability',
    category: 'Monitoring',
    provider: 'aws',
  },
  'cloudwatch-logs': {
    name: 'CloudWatch Logs',
    description: 'Log management and analysis',
    category: 'Monitoring',
    provider: 'aws',
  },
  'x-ray': {
    name: 'AWS X-Ray',
    description: 'Distributed tracing',
    category: 'Monitoring',
    provider: 'aws',
  },
  cloudtrail: {
    name: 'AWS CloudTrail',
    description: 'API activity tracking',
    category: 'Monitoring',
    provider: 'aws',
  },
  iam: {
    name: 'AWS IAM',
    description: 'Identity and Access Management',
    category: 'Security',
    provider: 'aws',
  },
  cognito: {
    name: 'Amazon Cognito',
    description: 'User authentication and authorization',
    category: 'Security',
    provider: 'aws',
  },
  'secrets-manager': {
    name: 'AWS Secrets Manager',
    description: 'Secret storage and rotation',
    category: 'Security',
    provider: 'aws',
  },
  kms: {
    name: 'AWS KMS',
    description: 'Key Management Service - Encryption key management',
    category: 'Security',
    provider: 'aws',
  },
  waf: {
    name: 'AWS WAF',
    description: 'Web Application Firewall',
    category: 'Security',
    provider: 'aws',
  },
  shield: {
    name: 'AWS Shield',
    description: 'DDoS protection',
    category: 'Security',
    provider: 'aws',
  },
  guardduty: {
    name: 'Amazon GuardDuty',
    description: 'Threat detection service',
    category: 'Security',
    provider: 'aws',
  },
  sagemaker: {
    name: 'Amazon SageMaker',
    description: 'Machine learning platform',
    category: 'AI/ML',
    provider: 'aws',
  },
  bedrock: {
    name: 'Amazon Bedrock',
    description: 'Foundation model API service',
    category: 'AI/ML',
    provider: 'aws',
  },
  glue: {
    name: 'AWS Glue',
    description: 'ETL and data integration',
    category: 'Analytics',
    provider: 'aws',
  },
  athena: {
    name: 'Amazon Athena',
    description: 'Serverless query service for S3',
    category: 'Analytics',
    provider: 'aws',
  },
  emr: {
    name: 'Amazon EMR',
    description: 'Managed Hadoop/Spark cluster',
    category: 'Analytics',
    provider: 'aws',
  },
  quicksight: {
    name: 'Amazon QuickSight',
    description: 'Business intelligence dashboards',
    category: 'Analytics',
    provider: 'aws',
  },
  codepipeline: {
    name: 'AWS CodePipeline',
    description: 'CI/CD pipeline service',
    category: 'Developer Tools',
    provider: 'aws',
  },
  codebuild: {
    name: 'AWS CodeBuild',
    description: 'Build service for CI',
    category: 'Developer Tools',
    provider: 'aws',
  },
  ecr: {
    name: 'Amazon ECR',
    description: 'Elastic Container Registry',
    category: 'Developer Tools',
    provider: 'aws',
  },
  amplify: {
    name: 'AWS Amplify',
    description: 'Full-stack app platform',
    category: 'Developer Tools',
    provider: 'aws',
  },
  ses: {
    name: 'Amazon SES',
    description: 'Simple Email Service',
    category: 'Application Integration',
    provider: 'aws',
  },
  acm: {
    name: 'AWS Certificate Manager',
    description: 'SSL/TLS certificate management',
    category: 'Security',
    provider: 'aws',
  },
};

/** GCP services */
/**
 * GCP_SERVICES
 * @description Provides IDE suggestions for GCP_SERVICES
 */
export const GCP_SERVICES: Record<string, ServiceInfo> = {
  'cloud-run': {
    name: 'Cloud Run',
    description: 'Serverless container platform',
    category: 'Compute',
    provider: 'gcp',
  },
  'cloud-functions': {
    name: 'Cloud Functions',
    description: 'Serverless functions',
    category: 'Compute',
    provider: 'gcp',
  },
  gke: {
    name: 'Google Kubernetes Engine',
    description: 'Managed Kubernetes',
    category: 'Compute',
    provider: 'gcp',
  },
  'cloud-sql': {
    name: 'Cloud SQL',
    description: 'Managed relational databases',
    category: 'Database',
    provider: 'gcp',
  },
  'cloud-spanner': {
    name: 'Cloud Spanner',
    description: 'Globally distributed relational database',
    category: 'Database',
    provider: 'gcp',
  },
  bigquery: {
    name: 'BigQuery',
    description: 'Serverless data warehouse',
    category: 'Analytics',
    provider: 'gcp',
  },
  'cloud-storage': {
    name: 'Cloud Storage',
    description: 'Object storage',
    category: 'Storage',
    provider: 'gcp',
  },
  'pub-sub': {
    name: 'Pub/Sub',
    description: 'Messaging and event streaming',
    category: 'Messaging',
    provider: 'gcp',
  },
  'cloud-cdn': {
    name: 'Cloud CDN',
    description: 'Content delivery network',
    category: 'Networking',
    provider: 'gcp',
  },
  'cloud-dns': {
    name: 'Cloud DNS',
    description: 'DNS service',
    category: 'Networking',
    provider: 'gcp',
  },
  'cloud-armor': {
    name: 'Cloud Armor',
    description: 'DDoS protection and WAF',
    category: 'Security',
    provider: 'gcp',
  },
  memorystore: {
    name: 'Memorystore',
    description: 'Managed Redis and Memcached',
    category: 'Database',
    provider: 'gcp',
  },
  filestore: {
    name: 'Filestore',
    description: 'Managed NFS file storage',
    category: 'Storage',
    provider: 'gcp',
  },
  dataflow: {
    name: 'Dataflow',
    description: 'Stream and batch data processing',
    category: 'Analytics',
    provider: 'gcp',
  },
  dataproc: {
    name: 'Dataproc',
    description: 'Managed Spark and Hadoop',
    category: 'Analytics',
    provider: 'gcp',
  },
  'vertex-ai': {
    name: 'Vertex AI',
    description: 'Machine learning platform',
    category: 'AI/ML',
    provider: 'gcp',
  },
  'cloud-build': {
    name: 'Cloud Build',
    description: 'CI/CD platform',
    category: 'Developer Tools',
    provider: 'gcp',
  },
  'artifact-registry': {
    name: 'Artifact Registry',
    description: 'Container and package registry',
    category: 'Developer Tools',
    provider: 'gcp',
  },
  'cloud-logging': {
    name: 'Cloud Logging',
    description: 'Log management',
    category: 'Monitoring',
    provider: 'gcp',
  },
  'cloud-monitoring': {
    name: 'Cloud Monitoring',
    description: 'Infrastructure monitoring',
    category: 'Monitoring',
    provider: 'gcp',
  },
};

/** All services combined */
/**
 * ALL_SERVICES
 * @description Provides IDE suggestions for ALL_SERVICES
 */
export const ALL_SERVICES: Record<string, ServiceInfo> = {
  ...AWS_SERVICES,
  ...GCP_SERVICES,
};

/** Connection types */
/**
 * CONNECTION_TYPES
 * @description Provides IDE suggestions for CONNECTION_TYPES
 */
export const CONNECTION_TYPES = [
  'api-call',
  'database-query',
  'cache-read',
  'cache-write',
  'message-publish',
  'message-consume',
  'file-upload',
  'file-download',
  'stream-read',
  'stream-write',
  'replication',
  'backup',
  'failover',
  'cdn-origin',
  'dns-resolution',
  'vpn-tunnel',
  'direct-connect',
  'vpc-peering',
  'transit-gateway',
  'load-balancing',
  'authentication',
  'authorization',
  'database',
];

/** Protocols */
/**
 * PROTOCOLS
 * @description Provides IDE suggestions for PROTOCOLS
 */
export const PROTOCOLS = [
  'HTTP',
  'HTTPS',
  'HTTP/2',
  'HTTP/3',
  'WebSocket',
  'gRPC',
  'GraphQL',
  'REST',
  'SOAP',
  'TCP',
  'UDP',
  'MQTT',
  'AMQP',
  'Redis',
  'SQL',
  'MongoDB',
  'S3',
  'NFS',
  'SMB',
  'FTP',
  'SFTP',
  'SSH',
  'RDP',
  'PostgreSQL',
  'MySQL',
];

/** Application types */
/**
 * APPLICATION_TYPES
 * @description Provides IDE suggestions for APPLICATION_TYPES
 */
export const APPLICATION_TYPES = [
  'frontend',
  'backend',
  'api',
  'database',
  'cache',
  'queue',
  'worker',
  'batch-job',
  'mobile',
  'desktop',
  'iot',
  'ml-model',
  'data-pipeline',
  'microservice',
];

/** Environment values */
/**
 * ENVIRONMENTS
 * @description Provides IDE suggestions for ENVIRONMENTS
 */
export const ENVIRONMENTS = [
  'development',
  'staging',
  'production',
  'test',
  'demo',
];

/** Cloud providers */
/**
 * CLOUD_PROVIDERS
 * @description Provides IDE suggestions for CLOUD_PROVIDERS
 */
export const CLOUD_PROVIDERS = ['aws', 'gcp', 'azure', 'kubernetes'];

/** Tier values */
/**
 * TIERS
 * @description Provides IDE suggestions for TIERS
 */
export const TIERS = [
  'primary',
  'secondary',
  'failover',
  'disaster-recovery',
  'development',
  'test',
];

/** Compliance frameworks */
/**
 * COMPLIANCE_FRAMEWORKS
 * @description Provides IDE suggestions for COMPLIANCE_FRAMEWORKS
 */
export const COMPLIANCE_FRAMEWORKS = [
  'pci-dss',
  'hipaa',
  'gdpr',
  'soc2',
  'iso27001',
  'fedramp',
];

/** Layout engines */
/**
 * LAYOUT_ENGINES
 * @description Provides IDE suggestions for LAYOUT_ENGINES
 */
export const LAYOUT_ENGINES = ['elk', 'dagre'];

/** AWS regions */
/**
 * AWS_REGIONS
 * @description Provides IDE suggestions for AWS_REGIONS
 */
export const AWS_REGIONS = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-central-1',
  'eu-north-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'ap-northeast-2',
  'ap-northeast-3',
  'ap-south-1',
  'sa-east-1',
  'ca-central-1',
  'me-south-1',
  'af-south-1',
];

/** GCP regions */
/**
 * GCP_REGIONS
 * @description Provides IDE suggestions for GCP_REGIONS
 */
export const GCP_REGIONS = [
  'us-central1',
  'us-east1',
  'us-east4',
  'us-west1',
  'us-west2',
  'us-west3',
  'us-west4',
  'europe-west1',
  'europe-west2',
  'europe-west3',
  'europe-west4',
  'europe-west6',
  'europe-north1',
  'asia-east1',
  'asia-east2',
  'asia-northeast1',
  'asia-northeast2',
  'asia-northeast3',
  'asia-south1',
  'asia-southeast1',
  'asia-southeast2',
  'australia-southeast1',
];

/** Pricing models */
/**
 * PRICING_MODELS
 * @description Provides IDE suggestions for PRICING_MODELS
 */
export const PRICING_MODELS = [
  'on-demand',
  'reserved-1yr',
  'reserved-3yr',
  'spot',
  'savings-plan',
];
