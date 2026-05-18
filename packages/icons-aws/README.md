# @mindfiredigital/adac-icons-aws

AWS service icons and mappings for ADAC diagrams. Contains 1600+ AWS service icons.

## Features

- 🎨 1600+ AWS service icons
- 🗺️ Service-to-icon mappings
- 📦 SVG icons included
- 🔄 Dynamic icon loading

## Installation

```bash
npm install @mindfiredigital/adac-icons-aws
pnpm add @mindfiredigital/adac-icons-aws
```

## Usage

```typescript
import { getAwsIcon, getAwsServiceIcon } from '@mindfiredigital/adac-icons-aws';

// Get icon by service name
const lambda = getAwsServiceIcon('lambda');
console.log(lambda.url);

// Get icon by icon code
const ec2 = getAwsIcon('ec2');
console.log(ec2.name);
```

## Icon Sets

- **Compute**: EC2, Lambda, ECS, Batch
- **Database**: RDS, DynamoDB, Redshift, ElastiCache
- **Storage**: S3, EBS, EFS, Glacier
- **Networking**: VPC, EC2, Route 53, CloudFront
- **And 1500+ more...**

## See Also

- [@mindfiredigital/adac-icons-gcp](../icons-gcp) - GCP icons
- [@mindfiredigital/adac-icons-azure](../icons-azure) - Azure icons
- [@mindfiredigital/adac-diagram](../diagram) - Diagram generator using these icons

## License

MIT
