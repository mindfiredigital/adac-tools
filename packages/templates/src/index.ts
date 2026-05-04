import type { AdacConfig } from '@mindfiredigital/adac-schema';
import { aws3TierWeb } from './aws-3-tier.js';
import { awsServerlessApi } from './aws-serverless.js';
import { gcpMicroservices } from './gcp-microservices.js';

export { aws3TierWeb, awsServerlessApi, gcpMicroservices };

export interface AdacTemplate {
  id: string;
  name: string;
  description: string;
  config: AdacConfig;
}

export const templates: AdacTemplate[] = [
  {
    id: 'aws-3-tier-web',
    name: 'AWS 3-Tier Web Architecture',
    description:
      'A highly available, scalable 3-tier architecture on AWS using ALB, EC2, RDS, and ElastiCache.',
    config: aws3TierWeb,
  },
  {
    id: 'aws-serverless-api',
    name: 'AWS Serverless API',
    description:
      'A completely serverless REST API using API Gateway, Lambda, DynamoDB, and S3.',
    config: awsServerlessApi,
  },
  {
    id: 'gcp-microservices',
    name: 'GCP Microservices',
    description:
      'A containerized microservices architecture on GCP using GKE, Cloud SQL, and Pub/Sub.',
    config: gcpMicroservices,
  },
];

/**
 * Get all available architecture templates
 */
export function getAllTemplates(): AdacTemplate[] {
  return templates;
}

/**
 * Get a specific template by its ID
 */
export function getTemplateById(id: string): AdacTemplate | undefined {
  return templates.find((t) => t.id === id);
}

/**
 * Get just the ADAC configuration for a specific template
 */
export function getTemplateConfig(id: string): AdacConfig | undefined {
  return getTemplateById(id)?.config;
}
