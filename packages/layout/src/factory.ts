import type { LayoutEngine, LayoutOptions } from './interface';
import { analyzeComplexity, AdacModel } from './auto-selector';
import { CustomLayoutEngineAdapter } from './custom-layout-engine-adapter';

export type EngineType = 'auto' | 'custom' | 'elk';

export async function createLayoutEngine(
  type: EngineType,
  options: LayoutOptions = {},
  model?: AdacModel
): Promise<LayoutEngine> {
  const resolvedType =
    type === 'auto' ? (analyzeComplexity(model) ? 'elk' : 'custom') : type;

  // CUSTOM ENGINE (Default)
  if (resolvedType === 'custom') {
    return new CustomLayoutEngineAdapter(options);
  }

  // ELK ENGINE (Optional install)
  if (resolvedType === 'elk') {
    try {
      const { ElkLayoutEngine } = await import('@mindfiredigital/adac-layout-elk');
      return new ElkLayoutEngine(options);
    } catch (error) {
      throw new Error(
        'ELK layout engine is unavailable. Install @mindfiredigital/adac-layout-elk to use the elk engine.',
        { cause: error }
      );
    }
  }

  throw new Error(`Unknown engine type: ${resolvedType}`);
}
