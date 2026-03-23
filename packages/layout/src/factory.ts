import type { LayoutEngine, LayoutOptions } from './interface';
import { analyzeComplexity, AdacModel } from './auto-selector';
import { CustomLayoutEngine } from '@mindfiredigital/adac-layout-core';
import { ElkLayoutEngine } from '@mindfiredigital/adac-layout-elk';

export type EngineType = 'auto' | 'custom' | 'elk';

export async function createLayoutEngine(
  type: EngineType,
  options: LayoutOptions = {},
  model?: AdacModel 
): Promise<LayoutEngine> {
      
  // AUTO MODE
  if (type === 'auto') {
    const useElk = analyzeComplexity(model);
    type = useElk ? 'elk' : 'custom';
  }
  
  // CUSTOM ENGINE (Default)
  if (type === 'custom') {
    return new CustomLayoutEngine(options);
  }

  // ELK ENGINE (Optional peer)
  if (type === 'elk') {
    return new ElkLayoutEngine(options);
  }

  throw new Error(`Unknown engine type: ${type}`);
}