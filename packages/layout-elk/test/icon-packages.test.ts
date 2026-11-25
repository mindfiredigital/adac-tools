import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Module from 'node:module';
import {
  loadIconSets,
  neededIconProviders,
  resolveProviderAssetPath,
  type IconProvider,
  type IconSearchContext,
} from '../src/icon-packages.js';
import { buildElkGraph } from '../src/elk-builder.js';

const ICON_MAP = { 'AWS::RDS': 'aws-icons/rds.svg' };

let tmp: string;

// Running through pnpm sets NODE_PATH to the workspace's node_modules, where
// the real icon package is linked; Node's global lookup would then find it from
// any folder. Take it away so the fixtures below are the only packages around.
type ModuleInternals = { _initPaths(): void };
const reloadModulePaths = () =>
  (Module as unknown as ModuleInternals)._initPaths();
let savedNodePath: string | undefined;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'adac-icons-'));
  savedNodePath = process.env.NODE_PATH;
  delete process.env.NODE_PATH;
  reloadModulePaths();
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(tmp, { recursive: true, force: true });
  if (savedNodePath === undefined) delete process.env.NODE_PATH;
  else process.env.NODE_PATH = savedNodePath;
  reloadModulePaths();
});

/** Writes a fake icon package under `<nodeModulesParent>/node_modules`. */
function installPackage(
  nodeModulesParent: string,
  provider: IconProvider = 'aws',
  { withIcon = true }: { withIcon?: boolean } = {}
): string {
  const dir = path.join(
    nodeModulesParent,
    'node_modules',
    '@mindfiredigital',
    `adac-icons-${provider}`
  );
  fs.mkdirSync(path.join(dir, 'mappings'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'assets', 'aws-icons'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: `@mindfiredigital/adac-icons-${provider}` })
  );
  fs.writeFileSync(
    path.join(dir, 'mappings', 'icon-map.json'),
    JSON.stringify(ICON_MAP)
  );
  if (withIcon) {
    fs.writeFileSync(
      path.join(dir, 'assets', 'aws-icons', 'rds.svg'),
      '<svg/>'
    );
  }
  return dir;
}

/** A search context whose folders hold no icon package unless one is installed. */
function context(): IconSearchContext & { project: string } {
  const project = path.join(tmp, 'project');
  const baseDir = path.join(tmp, 'app', 'dist');
  fs.mkdirSync(project, { recursive: true });
  fs.mkdirSync(baseDir, { recursive: true });
  return { baseDir, cwd: project, project };
}

const cloud = (provider?: string) => ({
  id: provider ?? 'c',
  ...(provider === undefined ? {} : { provider }),
  region: 'r',
  services: [],
});
const config = (providers: Array<string | undefined>, applications = false) =>
  ({
    version: '0.2',
    metadata: { name: 't', created: '2026-01-01' },
    infrastructure: { clouds: providers.map(cloud) },
    ...(applications ? { applications: [{ id: 'app', name: 'App' }] } : {}),
  }) as never;

describe('importing the layout builder', () => {
  it('prints nothing', async () => {
    const spies = (['log', 'info', 'warn', 'error'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined)
    );
    vi.resetModules();
    await import('../src/elk-builder.js');
    await import('../src/icon-packages.js');
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});

describe('neededIconProviders', () => {
  it.each([
    [['aws'], ['aws']],
    [[undefined], ['aws']],
    [['gcp'], ['gcp']],
    [['Azure'], ['azure']],
    [
      ['GCP', 'azure'],
      ['gcp', 'azure'],
    ],
    [
      ['aws', 'gcp'],
      ['aws', 'gcp'],
    ],
    [
      ['aws', 'azure'],
      ['aws', 'azure'],
    ],
  ])('%j draws with %j icons', (providers, expected) => {
    expect(neededIconProviders(config(providers))).toEqual(expected);
  });

  it('needs the AWS icons for applications, whatever the clouds', () => {
    expect(neededIconProviders(config(['gcp'], true))).toEqual(['aws', 'gcp']);
  });
});

describe('finding an icon package', () => {
  it('finds node_modules next to the running file', async () => {
    const ctx = context();
    const dir = installPackage(ctx.baseDir);
    const warn = vi.fn();
    const sets = await loadIconSets(['aws'], warn, ctx);
    expect(warn).not.toHaveBeenCalled();
    expect(sets.aws.map).toEqual(ICON_MAP);
    expect(
      await resolveProviderAssetPath('aws', 'aws-icons/rds.svg', warn, ctx)
    ).toBe(path.join(dir, 'assets', 'aws-icons', 'rds.svg'));
    expect(warn).not.toHaveBeenCalled();
  });

  it('finds node_modules of the working folder when the running file is elsewhere', async () => {
    const ctx = context();
    const dir = installPackage(ctx.project);
    const warn = vi.fn();
    const sets = await loadIconSets(['aws'], warn, ctx);
    expect(warn).not.toHaveBeenCalled();
    expect(sets.aws.map).toEqual(ICON_MAP);
    expect(
      await resolveProviderAssetPath('aws', 'aws-icons/rds.svg', warn, ctx)
    ).toBe(path.join(dir, 'assets', 'aws-icons', 'rds.svg'));
  });

  it('prefers the installed package over a monorepo-style folder', async () => {
    const ctx = context();
    installPackage(ctx.project);
    // <cwd>/icons-aws is one of the older candidates
    const old = path.join(ctx.project, 'icons-aws', 'mappings');
    fs.mkdirSync(old, { recursive: true });
    fs.writeFileSync(path.join(old, 'icon-map.json'), '{"old":"old.svg"}');
    const sets = await loadIconSets(['aws'], vi.fn(), ctx);
    expect(sets.aws.map).toEqual(ICON_MAP);
  });

  it('builds the normalised-key table for fuzzy lookups', async () => {
    const ctx = context();
    installPackage(ctx.baseDir);
    const sets = await loadIconSets(['aws'], vi.fn(), ctx);
    expect(sets.aws.normalized.get('awsrds')).toBe('AWS::RDS');
  });
});

describe('loading only the providers that are needed', () => {
  it('an AWS-only file with only the AWS package emits no GCP or Azure message', async () => {
    const ctx = context();
    installPackage(ctx.baseDir);
    const warn = vi.fn();
    const adac = config(['aws']);
    const sets = await loadIconSets(neededIconProviders(adac), warn, ctx);
    expect(warn).not.toHaveBeenCalled();
    expect(sets.gcp.map).toEqual({});
    expect(sets.azure.map).toEqual({});
  });

  it('building an AWS-only file reports nothing about GCP or Azure', async () => {
    const warnings: string[] = [];
    await buildElkGraph(config(['aws']), {
      onWarning: (m) => warnings.push(m),
    });
    expect(warnings.filter((m) => /GCP|Azure/.test(m))).toEqual([]);
  });
});

describe('a missing icon package', () => {
  it('yields exactly one message for that provider and no icons', async () => {
    const ctx = context();
    const warn = vi.fn();
    const sets = await loadIconSets(['aws'], warn, ctx);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toBe(
      'AWS icons are not installed, so AWS services are drawn without icons. ' +
        'Install @mindfiredigital/adac-icons-aws in the same place as ' +
        '@mindfiredigital/adac-diagram (the same project, or the same global install).'
    );
    expect(sets.aws.map).toEqual({});
    expect(sets.aws.normalized.size).toBe(0);
  });

  it('says that no icon package exists yet for GCP and for Azure', async () => {
    const warn = vi.fn();
    await loadIconSets(['gcp', 'azure'], warn, context());
    expect(warn.mock.calls.map((c) => c[0])).toEqual([
      'No icon package is available for GCP yet, so GCP services are drawn without icons.',
      'No icon package is available for Azure yet, so Azure services are drawn without icons.',
    ]);
  });

  it('draws no per-icon message for it', async () => {
    const ctx = context();
    const warn = vi.fn();
    const sets = await loadIconSets(['aws'], warn, ctx);
    // nothing in an empty map resolves to a file, so nothing is looked up
    expect(sets.aws.map['AWS::RDS']).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('is looked up again on the next call, and found once installed', async () => {
    const ctx = context();
    const warn = vi.fn();
    await loadIconSets(['aws'], warn, ctx);
    await loadIconSets(['aws'], warn, ctx);
    expect(warn).toHaveBeenCalledTimes(2);

    installPackage(ctx.baseDir);
    const later = vi.fn();
    const sets = await loadIconSets(['aws'], later, ctx);
    expect(later).not.toHaveBeenCalled();
    expect(sets.aws.map).toEqual(ICON_MAP);
  });

  it('skips an unreadable map like a missing one', async () => {
    const ctx = context();
    const dir = installPackage(ctx.baseDir);
    fs.writeFileSync(path.join(dir, 'mappings', 'icon-map.json'), '{not json');
    const warn = vi.fn();
    const sets = await loadIconSets(['aws'], warn, ctx);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(sets.aws.map).toEqual({});
  });
});

describe('a map that was loaded', () => {
  it('is kept for the next call', async () => {
    const ctx = context();
    const dir = installPackage(ctx.baseDir);
    await loadIconSets(['aws'], vi.fn(), ctx);
    fs.rmSync(dir, { recursive: true, force: true });
    const warn = vi.fn();
    const sets = await loadIconSets(['aws'], warn, ctx);
    expect(warn).not.toHaveBeenCalled();
    expect(sets.aws.map).toEqual(ICON_MAP);
  });
});

describe('an icon file missing from a found package', () => {
  it('is reported by its path', async () => {
    const ctx = context();
    installPackage(ctx.baseDir, 'aws', { withIcon: false });
    const warn = vi.fn();
    const found = await resolveProviderAssetPath(
      'aws',
      'aws-icons/rds.svg',
      warn,
      ctx
    );
    expect(found).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      'Could not resolve AWS icon path: aws-icons/rds.svg'
    );
  });

  it('returns nothing without a path, and says nothing', async () => {
    const warn = vi.fn();
    expect(
      await resolveProviderAssetPath('aws', undefined, warn, context())
    ).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });
});
