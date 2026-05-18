# @mindfiredigital/adac-icons-azure

Azure service icons and mappings for ADAC diagrams. Contains comprehensive Azure service icons.

## Features

- 🎨 Azure service icons
- 🗺️ Service-to-icon mappings
- 📦 SVG icons included
- 🔄 Dynamic icon loading

## Installation

```bash
npm install @mindfiredigital/adac-icons-azure
pnpm add @mindfiredigital/adac-icons-azure
```

## Usage

```typescript
import {
  getAzureIcon,
  getAzureServiceIcon,
} from '@mindfiredigital/adac-icons-azure';

// Get icon by service name
const appService = getAzureServiceIcon('appService');
console.log(appService.url);

// Get icon by icon code
const vm = getAzureIcon('vm');
console.log(vm.name);
```

## Icon Categories

- **Compute**: Virtual Machines, App Service, Functions, Container Instances
- **Database**: SQL Database, Cosmos DB, MySQL, PostgreSQL
- **Storage**: Blob Storage, File Share, Data Lake, Queue Storage
- **Networking**: Virtual Network, Load Balancer, Application Gateway
- **Integration**: Service Bus, Event Hub, Logic Apps
- **And more...**

## See Also

- [@mindfiredigital/adac-icons-aws](../icons-aws) - AWS icons
- [@mindfiredigital/adac-icons-gcp](../icons-gcp) - GCP icons
- [@mindfiredigital/adac-diagram](../diagram) - Diagram generator using these icons

## License

MIT
