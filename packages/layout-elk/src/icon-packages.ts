import type { AdacConfig } from '@mindfiredigital/adac-validator';
import type { Warn } from './layout-properties.js';

/**
 * Finding and loading the icon packages (@mindfiredigital/adac-icons-<provider>).
 *
 * The packages are separate installs. They are looked up when a diagram is
 * built, only for the providers the file uses, so importing this module does
 * no I/O and prints nothing.
 */

export type IconProvider = 'aws' | 'gcp' | 'azure';

export interface IconSet {
  /** Service name to icon file, from the package's `mappings/icon-map.json`. */
  map: Record<string, string>;
  /** `normalizeKey(name)` to the name in `map`, for fuzzy lookups. */
  normalized: Map<string, string>;
}

export type IconSets = Record<IconProvider, IconSet>;

/** Where lookups start: the running file's folder and the working folder. */
export interface IconSearchContext {
  baseDir: string;
  cwd: string;
}

let fsPromise: Promise<typeof import('fs')> | undefined;
let pathPromise: Promise<typeof import('path')> | undefined;

const getFs = () => (fsPromise ??= import('fs'));
const getPath = () => (pathPromise ??= import('path'));

const isBrowser =
  typeof window !== 'undefined' && typeof document !== 'undefined';

const PROVIDER_FOLDERS: Record<IconProvider, string> = {
  aws: 'icons-aws',
  gcp: 'icons-gcp',
  azure: 'icons-azure',
};

const packageName = (provider: IconProvider) =>
  `@mindfiredigital/adac-${PROVIDER_FOLDERS[provider]}`;

const MISSING_PACKAGE_MESSAGE: Record<IconProvider, string> = {
  aws:
    'AWS icons are not installed, so AWS services are drawn without icons. ' +
    'Install @mindfiredigital/adac-icons-aws in the same place as ' +
    '@mindfiredigital/adac-diagram (the same project, or the same global install).',
  gcp: 'No icon package is available for GCP yet, so GCP services are drawn without icons.',
  azure:
    'No icon package is available for Azure yet, so Azure services are drawn without icons.',
};

export function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * The Node search context. Only the Node paths may call this: a browser has
 * neither `__dirname` nor `process`.
 */
function defaultContext(): IconSearchContext {
  return { baseDir: __dirname, cwd: process.cwd() };
}

const emptySet = (): IconSet => ({ map: {}, normalized: new Map() });

/**
 * The providers whose icons the file can use. AWS icons are the default, so
 * they are needed unless every cloud is GCP or Azure and nothing else is drawn.
 */
export function neededIconProviders(adac: AdacConfig): IconProvider[] {
  const providers = (adac.infrastructure?.clouds ?? []).map((c) =>
    (c.provider ?? '').toLowerCase()
  );
  const needed: IconProvider[] = [];
  const onlyGcpOrAzure = providers.every((p) => p === 'gcp' || p === 'azure');
  if (!onlyGcpOrAzure || (adac.applications ?? []).length > 0) {
    needed.push('aws');
  }
  if (providers.includes('gcp')) needed.push('gcp');
  if (providers.includes('azure')) needed.push('azure');
  return needed;
}

// Only successful lookups are kept: a package installed later is found by the
// next build.
const packageFolders = new Map<string, string>();
const iconSets = new Map<string, IconSet>();

const cacheKey = (provider: IconProvider, ctx: IconSearchContext) =>
  `${provider}|${ctx.baseDir}|${ctx.cwd}`;

/** The folder of the installed icon package, found the way `require` finds it. */
async function findPackageFolder(
  provider: IconProvider,
  ctx: IconSearchContext
): Promise<string | undefined> {
  const key = cacheKey(provider, ctx);
  const known = packageFolders.get(key);
  if (known) return known;
  try {
    const { createRequire } = await import('node:module');
    const path = await getPath();
    const req = createRequire(path.join(ctx.baseDir, 'resolve-anchor.js'));
    const manifest = req.resolve(`${packageName(provider)}/package.json`, {
      paths: [ctx.baseDir, ctx.cwd],
    });
    const folder = path.dirname(manifest);
    packageFolders.set(key, folder);
    return folder;
  } catch {
    return undefined;
  }
}

async function iconMapCandidates(
  provider: IconProvider,
  ctx: IconSearchContext
): Promise<string[]> {
  const folder = PROVIDER_FOLDERS[provider];
  const path = await getPath();
  const { baseDir, cwd } = ctx;
  const installed = await findPackageFolder(provider, ctx);
  return [
    ...(installed ? [path.join(installed, 'mappings', 'icon-map.json')] : []),
    path.resolve(baseDir, '..', '..', folder, 'mappings', 'icon-map.json'),
    path.resolve(
      baseDir,
      '..',
      '..',
      '..',
      '@mindfiredigital',
      `adac-${folder}`,
      'mappings',
      'icon-map.json'
    ),
    path.resolve(cwd, 'packages', folder, 'mappings', 'icon-map.json'),
    path.resolve(cwd, folder, 'mappings', 'icon-map.json'),
  ];
}

async function assetCandidates(
  provider: IconProvider,
  relativePath: string,
  ctx: IconSearchContext
): Promise<string[]> {
  const path = await getPath();
  const folder = PROVIDER_FOLDERS[provider];
  const { baseDir, cwd } = ctx;
  const installed = await findPackageFolder(provider, ctx);
  return [
    ...(installed ? [path.join(installed, 'assets', relativePath)] : []),
    // dist/assets — only AWS historically shipped icons inside the package
    path.resolve(baseDir, 'assets', relativePath),
    path.resolve(baseDir, '..', '..', folder, 'assets', relativePath),
    path.resolve(
      baseDir,
      '..',
      '..',
      '..',
      '@mindfiredigital',
      `adac-${folder}`,
      'assets',
      relativePath
    ),
    path.resolve(cwd, 'packages', folder, 'assets', relativePath),
    path.resolve(cwd, folder, 'assets', relativePath),
    path.resolve(cwd, 'assets', relativePath),
  ];
}

const isMap = (value: unknown): value is Record<string, string> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The icon map of a provider, or undefined when no usable one is found. `ctx`
 * is given on the Node path only.
 */
async function readIconMap(
  provider: IconProvider,
  ctx: IconSearchContext | undefined
): Promise<Record<string, string> | undefined> {
  if (isBrowser) {
    try {
      const resp = await fetch(`/mappings/${provider}-icons.json`);
      if (!resp.ok) return undefined;
      // a dev server answers a missing file with index.html (status 200);
      // await the parse so that is handled below instead of rejecting later
      const body: unknown = await resp.json();
      return isMap(body) ? body : undefined;
    } catch {
      return undefined;
    }
  }

  const fs = await getFs();
  const search = ctx ?? defaultContext();
  for (const p of await iconMapCandidates(provider, search)) {
    try {
      if (!fs.existsSync(p)) continue;
      const body: unknown = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (isMap(body)) return body;
    } catch {
      // an unreadable map is skipped like a missing one
    }
  }
  return undefined;
}

async function loadIconSet(
  provider: IconProvider,
  warn: Warn,
  ctx: IconSearchContext | undefined
): Promise<IconSet> {
  // the search context exists on the Node path only
  const search = isBrowser ? undefined : (ctx ?? defaultContext());
  const key = search ? cacheKey(provider, search) : `${provider}|browser`;
  const cached = iconSets.get(key);
  if (cached) return cached;

  const map = await readIconMap(provider, search);
  if (!map) {
    // the browser has no package to install, so it has nothing to advise
    if (!isBrowser) warn(MISSING_PACKAGE_MESSAGE[provider]);
    return emptySet();
  }
  const normalized = new Map<string, string>();
  for (const name of Object.keys(map)) normalized.set(normalizeKey(name), name);
  const set: IconSet = { map, normalized };
  iconSets.set(key, set);
  return set;
}

/**
 * Loads the icon maps of the given providers; every other provider gets an
 * empty map. A provider whose package is missing is reported once through
 * `warn`, and its services are drawn without icons.
 */
export async function loadIconSets(
  providers: readonly IconProvider[],
  warn: Warn,
  ctx?: IconSearchContext
): Promise<IconSets> {
  const sets: IconSets = {
    aws: emptySet(),
    gcp: emptySet(),
    azure: emptySet(),
  };
  const wanted = [...new Set(providers)];
  const loaded = await Promise.all(
    wanted.map((provider) => loadIconSet(provider, warn, ctx))
  );
  wanted.forEach((provider, i) => {
    sets[provider] = loaded[i];
  });
  return sets;
}

/**
 * The file of an icon, or undefined when it is not found (reported through
 * `warn`). In the browser the path is returned as is.
 */
export async function resolveProviderAssetPath(
  provider: IconProvider,
  relativePath: string | undefined,
  warn: Warn,
  ctx?: IconSearchContext
): Promise<string | undefined> {
  if (!relativePath) return undefined;
  if (isBrowser) return relativePath;

  const fs = await getFs();
  const search = ctx ?? defaultContext();
  for (const p of await assetCandidates(provider, relativePath, search)) {
    if (fs.existsSync(p)) return p;
  }
  warn(
    `Could not resolve ${provider.toUpperCase()} icon path: ${relativePath}`
  );
  return undefined;
}
