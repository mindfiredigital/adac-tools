import type {
  AdacService,
  CloudProvider,
  TerraformOutput,
  TerraformResourceMapping,
  TerraformVariable,
} from '../types/index.js';
import { terraformLabel, terraformRef } from '../utils/terraform-names.js';

/**
 * Maps ADAC storage services to Terraform resource, variable, and output blocks.
 * Handles GCP GCS buckets and AWS S3 buckets.
 */
export function mapStorageServices(
  services: AdacService[],
  provider: CloudProvider,
  region?: string
): TerraformResourceMapping {
  const resources: string[] = [];
  const variables: TerraformVariable[] = [];
  const outputs: TerraformOutput[] = [];

  for (const service of services) {
    if (service.type !== 'storage') {
      continue;
    }

    const serviceProvider = service.cloud ?? provider;
    const resourceLabel = terraformLabel(service.id);

    if (serviceProvider === 'gcp' && service.subtype === 'gcs') {
      const storageClass =
        (service.config?.storage_class as string | undefined) ?? 'STANDARD';

      resources.push(
        `resource "google_storage_bucket" "${resourceLabel}" {\n  name          = "${service.id}"\n  location      = var.gcp_region\n  storage_class = "${storageClass}"\n}`
      );

      variables.push({
        name: 'gcp_region',
        type: 'string',
        description: 'GCP region for resources',
        default: region ?? 'us-central1',
      });

      outputs.push({
        name: `${service.id}_name`,
        description: `Bucket name for ${service.id}`,
        value: terraformRef('google_storage_bucket', service.id, 'name'),
      });
    }

    if (serviceProvider === 'aws' && service.subtype === 's3') {
      resources.push(
        `resource "aws_s3_bucket" "${resourceLabel}" {\n  bucket = "${service.id}"\n}`
      );

      outputs.push({
        name: `${service.id}_name`,
        description: `Bucket name for ${service.id}`,
        value: terraformRef('aws_s3_bucket', service.id, 'bucket'),
      });
    }
  }

  return {
    resources,
    variables,
    outputs,
  };
}
