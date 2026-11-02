import type {
  DiagramLayoutEngine,
  GenerationResult,
} from '@mindfiredigital/adac-core';

type AdacCoreModule = typeof import('@mindfiredigital/adac-core');

let browserDeps: Promise<{
  generateDiagramSvg: AdacCoreModule['generateDiagramSvg'];
  iconResolver: ReturnType<AdacCoreModule['makeFetchIconResolver']>;
}>;

const assetsBase =
  import.meta.env.VITE_ASSETS_BASE_URL ?? `${import.meta.env.BASE_URL}assets`;

function getBrowserDeps() {
  return (browserDeps ??= import('@mindfiredigital/adac-core').then((core) => ({
    generateDiagramSvg: core.generateDiagramSvg,
    iconResolver: core.makeFetchIconResolver(assetsBase),
  })));
}

export async function generateDiagramBrowser(
  yaml: string,
  layout?: DiagramLayoutEngine
): Promise<GenerationResult> {
  const { generateDiagramSvg, iconResolver } = await getBrowserDeps();

  return generateDiagramSvg(
    yaml,
    layout,
    false,
    undefined,
    'monthly',
    false,
    undefined,
    iconResolver
  );
}
