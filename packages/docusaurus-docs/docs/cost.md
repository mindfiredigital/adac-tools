# Cost Package

## Introduction

`@mindfiredigital/adac-cost` provides cloud‑cost estimation based on an ADAC architecture model. It reads the generated resource list and calculates monthly/annual spend using pricing data for AWS, Azure, GCP, etc.

## Installation

```bash
npm install @mindfiredigital/adac-cost
# or
pnpm add @mindfiredigital/adac-cost
```

You can also install it as part of the monorepo workspace:

```bash
pnpm install -r @mindfiredigital/adac-cost
```

## Usage

```typescript
import { estimateCost } from '@mindfiredigital/adac-cost';

const cost = await estimateCost('architecture.adac.yaml', {
  period: 'monthly',
  pricingModel: 'on_demand',
});
console.log('Estimated monthly cost:', cost.total);
```
