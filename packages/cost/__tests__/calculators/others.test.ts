import { describe, it, expect } from 'vitest';
import { DatabaseCalculator } from '../../src/calculators/database-calculator';
import { NetworkingCalculator } from '../../src/calculators/networking-calculator';
import { StorageCalculator } from '../../src/calculators/storage-calculator';

describe('Additional Calculators', () => {
  it('should calculate database costs (RDS + DynamoDB)', () => {
    const calc = new DatabaseCalculator();
    const config = {
      database: [
        { type: 'rds', instanceType: 'db.t3.micro', count: 1 },
        { type: 'dynamodb', readUnits: 10, writeUnits: 10, storageGB: 10 },
      ],
    };
    const cost = calc.calculate(config as any);
    expect(cost).toBeGreaterThan(0.017); // More than just RDS
  });

  it('should calculate networking costs', () => {
    const calc = new NetworkingCalculator();
    const cost = calc.calculate({ networking: [{ type: 'alb', count: 1 }] });
    expect(cost).toBeGreaterThan(0);
  });

  it('should calculate storage costs', () => {
    const calc = new StorageCalculator();
    const cost = calc.calculate({
      storage: [{ type: 's3', tier: 'standard', storageGB: 100 }],
    });
    expect(cost).toBeGreaterThan(0);
  });
});
