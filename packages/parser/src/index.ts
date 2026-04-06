import fs from 'fs';
import yaml from 'js-yaml';
import {
  AdacConfig,
  validateAdacConfig,
  ValidationResult,
} from '@mindfiredigital/adac-schema';

export interface CostBreakdown {
  compute: number;
  database: number;
  storage: number;
  networking: number;
  total: number;
  period: 'hourly' | 'daily' | 'monthly' | 'yearly';
  perService?: Record<string, number>;
}

export interface AdacConfigWithCosts extends AdacConfig {
  costs?: CostBreakdown;
}

export class AdacParseError extends Error {
  constructor(
    message: string,
    public errors?: string[]
  ) {
    super(message);
    this.name = 'AdacParseError';
  }
}

export interface ParseOptions {
  validate?: boolean;
}

export function parseAdacFromContent(
  content: string,
  options: ParseOptions = { validate: true }
): AdacConfigWithCosts {
  let parsed: unknown;

  try {
    parsed = yaml.load(content);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new AdacParseError(`Failed to parse YAML content: ${msg}`);
  }

  if (options.validate) {
    const validation: ValidationResult = validateAdacConfig(parsed);

    if (!validation.valid) {
      throw new AdacParseError('Schema validation failed', validation.errors);
    }
  }

  return parsed as AdacConfig;
}

export function parseAdac(
  filePath: string,
  options: ParseOptions = { validate: true }
): AdacConfigWithCosts {
  if (!fs.existsSync(filePath)) {
    throw new AdacParseError(`File not found: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf8');

  return parseAdacFromContent(raw, options);
}
