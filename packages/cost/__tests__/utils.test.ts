/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect } from 'vitest';
import { convertCost, convertMonthlyCost } from '../src/utils/cost-converter';

describe('cost-converter', () => {
  describe('convertCost (hourly)', () => {
    it('should return same for hourly', () => {
      expect(convertCost(1, 'hourly')).toBe(1);
    });
    it('should convert hourly to daily', () => {
      expect(convertCost(1, 'daily')).toBe(24);
    });
    it('should convert hourly to monthly', () => {
      expect(convertCost(1, 'monthly')).toBe(730);
    });
    it('should convert hourly to yearly', () => {
      expect(convertCost(1, 'yearly')).toBe(730 * 12);
    });
    it('should default to monthly', () => {
      expect(convertCost(1, 'unsupported' as any)).toBe(730);
    });
  });

  describe('convertMonthlyCost', () => {
    it('should convert monthly to hourly', () => {
      expect(convertMonthlyCost(730, 'hourly')).toBe(1);
    });
    it('should convert monthly to daily', () => {
      expect(convertMonthlyCost(30.4167, 'daily')).toBe(1);
    });
    it('should convert monthly to yearly', () => {
      expect(convertMonthlyCost(1, 'yearly')).toBe(12);
    });
    it('should default to monthly', () => {
      expect(convertMonthlyCost(1, 'unsupported' as any)).toBe(1);
    });
  });
});
