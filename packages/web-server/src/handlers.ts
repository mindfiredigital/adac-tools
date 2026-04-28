import { generateDiagramSvg } from '@mindfiredigital/adac-diagram';
import { ComplianceChecker } from '@mindfiredigital/adac-compliance';
import {
  CostCalculator,
  mapAdacServicesToCostConfig,
} from '@mindfiredigital/adac-cost';
import { analyzeOptimizations } from '@mindfiredigital/adac-optimizer';
import jsYaml from 'js-yaml';
import type { AdacConfig } from '@mindfiredigital/adac-schema';
import type { Request, Response } from 'express';

const complianceChecker = new ComplianceChecker();
const costCalculator = new CostCalculator();

export function parseAdacConfig(content: string): AdacConfig {
  const config = jsYaml.load(content) as AdacConfig;
  if (!config || !config.infrastructure) {
    throw new Error('Invalid ADAC configuration: missing infrastructure');
  }
  return config;
}

export const generateDiagramHandler = async (req: Request, res: Response) => {
  try {
    const { content, layout } = req.body;
    if (!content) {
      res.status(400).json({ error: 'Missing content' });
      return;
    }
    const result = await generateDiagramSvg(content, layout);
    res.status(200).json(result);
  } catch (e: unknown) {
    console.error('Generation failed:', e);
    const error = e as Error & { logs?: string[] };
    res.status(500).json({
      error: error.message || 'Internal Server Error',
      logs: error.logs,
    });
  }
};

export const complianceCheckHandler = (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    if (!content) {
      res.status(400).json({ error: 'Missing content' });
      return;
    }
    const config = parseAdacConfig(content);
    const result = complianceChecker.checkCompliance(config);
    res.status(200).json(result);
  } catch (e: unknown) {
    console.error('Compliance check failed:', e);
    const error = e as Error;
    const isValidationError = error.message?.includes(
      'Invalid ADAC configuration'
    );
    res.status(isValidationError ? 400 : 500).json({
      error: error.message || 'Compliance check failed',
    });
  }
};

export const costAnalysisHandler = (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    if (!content) {
      res.status(400).json({ error: 'Missing content' });
      return;
    }
    const config = parseAdacConfig(content);
    const services =
      config.infrastructure.clouds?.flatMap((cloud) => cloud.services ?? []) ??
      [];
    const costConfig = mapAdacServicesToCostConfig(services);
    const result = costCalculator.calculate(costConfig);
    res.status(200).json(result);
  } catch (e: unknown) {
    console.error('Cost analysis failed:', e);
    const error = e as Error;
    const isValidationError = error.message?.includes(
      'Invalid ADAC configuration'
    );
    res.status(isValidationError ? 400 : 500).json({
      error: error.message || 'Cost analysis failed',
    });
  }
};

export const optimizeHandler = (req: Request, res: Response) => {
  try {
    const { content, options } = req.body;
    if (!content) {
      res.status(400).json({ error: 'Missing content' });
      return;
    }
    const config = parseAdacConfig(content);
    const result = analyzeOptimizations(config, options);
    res.status(200).json(result);
  } catch (e: unknown) {
    console.error('Optimization analysis failed:', e);
    const error = e as Error;
    const isValidationError = error.message?.includes(
      'Invalid ADAC configuration'
    );
    res.status(isValidationError ? 400 : 500).json({
      error: error.message || 'Optimization analysis failed',
    });
  }
};
