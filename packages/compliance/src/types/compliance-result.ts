import { Violation } from './violation';

export interface ComplianceResult {
  framework: string;
  isCompliant: boolean;
  violations: Violation[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
}
