import type { LayoutEngine, LayoutOptions } from './interface';
import { analyzeComplexity, AdacModel } from './auto-selector';
import { CustomLayoutEngineAdapter } from './custom-layout-engine-adapter';

export type EngineType = 'auto' | 'custom' | 'elk';

/**
 * Creates and returns the appropriate LayoutEngine based on the provided type and options.
 * Handles 'auto' selection based on model complexity and gracefully falls back to the
 * custom engine if the 'elk' engine is requested but not installed.
 *
 * @param type - The requested engine type: 'auto', 'custom', or 'elk'.
 * @param options - Configuration options for the layout engine.
 * @param model - Optional model data, used for complexity analysis if type is 'auto'.
 * @returns A promise resolving to the selected LayoutEngine instance.
 * @throws If the specified engine type is completely unknown or unsupported.
 */
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
      console.warn(
        'ELK layout engine is unavailable. Install @mindfiredigital/adac-layout-elk to use the elk engine. Falling back to custom engine.',
        error
      );
      return new CustomLayoutEngineAdapter(options);
    }
  }

  throw new Error(`Unknown engine type: ${resolvedType}`);
}
