/* eslint-disable no-console */
import { PricingClient, GetProductsCommand } from '@aws-sdk/client-pricing';
import fs from 'fs';
import path from 'path';

const client = new PricingClient({ region: 'us-east-1' });

type AwsPriceItem = {
  terms: {
    OnDemand: Record<
      string,
      {
        priceDimensions: Record<
          string,
          {
            pricePerUnit: { USD: string };
          }
        >;
      }
    >;
  };
};

async function getEC2Price(instanceType: string) {
  const command = new GetProductsCommand({
    ServiceCode: 'AmazonEC2',
    Filters: [
      { Type: 'TERM_MATCH', Field: 'instanceType', Value: instanceType },
      { Type: 'TERM_MATCH', Field: 'location', Value: 'US East (N. Virginia)' },
      { Type: 'TERM_MATCH', Field: 'operatingSystem', Value: 'Linux' },
      { Type: 'TERM_MATCH', Field: 'tenancy', Value: 'Shared' },
      { Type: 'TERM_MATCH', Field: 'capacitystatus', Value: 'Used' },
    ],
    MaxResults: 1,
  });

  const response = await client.send(command);

  if (!response.PriceList || response.PriceList.length === 0) {
    return null;
  }

  const priceItem = JSON.parse(response.PriceList[0]) as AwsPriceItem;

  const terms = priceItem.terms.OnDemand;
  const termKey = Object.keys(terms)[0];

  const priceDimensions = terms[termKey].priceDimensions;
  const dimensionKey = Object.keys(priceDimensions)[0];

  const price = priceDimensions[dimensionKey].pricePerUnit.USD;

  return Number(price);
}

async function updatePricing() {
  console.log('Fetching AWS pricing...');

  const ec2Price = await getEC2Price('t3.micro');
  if (ec2Price === null) {
    throw new Error('Unable to fetch EC2 pricing for t3.micro');
  }

  const pricing = {
    ec2: {
      't3.micro': {
        on_demand: ec2Price,
        reserved: ec2Price * 0.6,
      },
    },
    lastUpdated: new Date().toISOString(),
  };

  const outputPath = path.resolve(
    __dirname,
    '../packages/cost/src/pricing/pricing.json'
  );

  fs.writeFileSync(outputPath, JSON.stringify(pricing, null, 2));

  console.log('pricing.json updated');
}

updatePricing();
