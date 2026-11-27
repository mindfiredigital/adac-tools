#!/usr/bin/env node
/**
 * verify-release.cjs
 *
 * Verifies that the four release packages are fit to publish. It exits with
 * code 1 on the first violated check, prints one line per check, and never
 * publishes anything.
 *
 * Modes:
 *   --static          checks 1 to 5 (no build, no network)
 *   --pack <dir>      packs the four packages into <dir> with
 *                     `pnpm pack --pack-destination <dir>` and runs checks 6 to 10
 *   --smoke <dir>     runs smoke tests S1 to S8 with the tarballs in <dir>,
 *                     using the `node` that runs this script
 *   (no argument)     --static, then --pack into a temporary folder, then
 *                     --smoke on that folder
 *
 * ADAC_ROOT overrides the repository root. ADAC_PNPM overrides the pnpm
 * command used to pack (for example "corepack pnpm"): the first word is the
 * executable, the others are its fixed arguments (split on spaces, so a path
 * with a space cannot be used in it).
 */

'use strict';

// a .cjs file is CommonJS by definition
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { spawnSync } = require('child_process');
const { builtinModules, createRequire } = require('module');

const ROOT = path.resolve(process.env.ADAC_ROOT || path.join(__dirname, '..'));
const PACKAGES_DIR = path.join(ROOT, 'packages');
const rootRequire = createRequire(path.join(ROOT, 'package.json'));

/** The release set, in publish order. */
const RELEASE = [
  '@mindfiredigital/adac-validator',
  '@mindfiredigital/adac-icons-aws',
  '@mindfiredigital/adac-core',
  '@mindfiredigital/adac-diagram',
];
const [VALIDATOR, ICONS, CORE, DIAGRAM] = RELEASE;
const ICONS_AWS = ICONS;

const MB = 1024 * 1024;
/** Largest unpacked size of each tarball. */
const MAX_UNPACKED = {
  [DIAGRAM]: 60 * MB,
  [CORE]: 30 * MB,
  [VALIDATOR]: 2 * MB,
  [ICONS]: 35 * MB,
};

/** Files that each tarball must contain. */
const REQUIRED_FILES = {
  [DIAGRAM]: [
    'dist/cli.js',
    'dist/cli.mjs',
    'dist/index.js',
    'dist/index.mjs',
    'dist/index.d.ts',
    'README.md',
    'LICENSE',
  ],
  [CORE]: [
    'dist/index.js',
    'dist/index.mjs',
    'dist/index.d.ts',
    'README.md',
    'LICENSE',
  ],
  [VALIDATOR]: [
    'dist/index.js',
    'dist/index.cjs',
    'dist/index.d.ts',
    'dist/index.d.cts',
    'README.md',
    'LICENSE',
  ],
};

/** Workspace packages that must never appear in a published declaration file. */
const UNPUBLISHED_IMPORTS = [
  'adac-parser',
  'adac-layout-core',
  'adac-layout-elk',
  'adac-cli',
  'adac-cost',
  'adac-compliance',
  'adac-export-terraform',
  'adac-export-cloudformation',
  'adac-export-k8s',
  'adac-icons-aws',
  'adac-icons-gcp',
  'adac-icons-azure',
].map((n) => `@mindfiredigital/${n}`);

const ALWAYS_ALLOWED_REQUIRES = ['web-worker'];

// Temporary folders are removed when the script ends, also after a failure.
const tempFolders = [];
process.on('exit', () => {
  for (const folder of tempFolders) {
    try {
      fs.rmSync(folder, { recursive: true, force: true });
    } catch {
      // a leftover temporary folder is not a failure
    }
  }
});

// ─── Output ────────────────────────────────────────────────

/** A violated check: printed, then the script exits with code 1. */
class Violation extends Error {}

function pass(label, text) {
  console.log(`✔ ${label}: ${text}`);
}

function fail(label, text, detail) {
  console.error(`✖ ${label}: ${text}`);
  if (detail) {
    console.error(
      String(detail)
        .split('\n')
        .map((l) => `    ${l}`)
        .join('\n')
    );
  }
  process.exit(1);
}

/** Runs one check; a thrown Violation (or any error) fails the script. */
function check(label, text, fn) {
  try {
    fn();
  } catch (err) {
    if (err instanceof Violation) fail(label, text, err.message);
    fail(label, text, err && err.stack ? err.stack : err);
  }
  pass(label, text);
}

function expect(condition, message) {
  if (!condition) throw new Violation(message);
}

// ─── Small helpers ─────────────────────────────────────────

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const readText = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

/** Every workspace package that has a package.json, by name. */
function readWorkspace() {
  const packages = new Map();
  for (const dir of fs.readdirSync(PACKAGES_DIR).sort()) {
    const file = path.join(PACKAGES_DIR, dir, 'package.json');
    if (!fs.existsSync(file)) continue;
    const pkg = readJson(file);
    packages.set(pkg.name || dir, { dir: path.join(PACKAGES_DIR, dir), pkg });
  }
  return packages;
}

function releaseEntries() {
  const workspace = readWorkspace();
  return RELEASE.map((name) => {
    const entry = workspace.get(name);
    expect(entry, `${name} is missing from packages/`);
    return { name, ...entry };
  });
}

/** `@scope/name/sub/path` -> `@scope/name`; `name/sub` -> `name`. */
function packageNameOf(specifier) {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

function isBuiltin(specifier) {
  if (specifier.startsWith('node:')) return true;
  return (
    builtinModules.includes(specifier) ||
    builtinModules.includes(specifier.split('/')[0])
  );
}

const shortName = (name) => name.replace('@mindfiredigital/adac-', '');
const tarballPrefix = (name) => `mindfiredigital-adac-${shortName(name)}-`;

/** A dependency of the repository being checked, else of this script's own. */
function loadDependency(name) {
  try {
    return rootRequire(name);
  } catch {
    return require(name);
  }
}

function ts() {
  return loadDependency('typescript');
}

// ─── Static checks 1 to 5 ──────────────────────────────────

function runStatic() {
  console.log('Static checks');

  check(
    '1',
    'the publish allow-list is exactly the four release packages',
    () => {
      const text = readText(path.join(ROOT, 'scripts', 'publish-packages.mjs'));
      const match = /PUBLISH_ORDER\s*=\s*\[([\s\S]*?)\]/.exec(text);
      expect(match, 'scripts/publish-packages.mjs has no PUBLISH_ORDER list');
      const names = [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map(
        (m) => m[1]
      );
      expect(
        JSON.stringify(names) === JSON.stringify(RELEASE),
        `allow-list is ${JSON.stringify(names)}, expected ${JSON.stringify(RELEASE)}`
      );
    }
  );

  check('2', 'every changeset names only the release packages', () => {
    const dir = path.join(ROOT, '.changeset');
    for (const file of fs.readdirSync(dir).sort()) {
      if (file === 'README.md' || file === 'config.json') continue;
      const text = readText(path.join(dir, file));
      const front = /^---\n([\s\S]*?)\n---/.exec(text);
      expect(front, `.changeset/${file} has no front matter`);
      for (const rawLine of front[1].split('\n')) {
        // a YAML comment is a # at the start of the line or after a space; a
        // package name has no #, so nothing inside a quoted key is cut
        const line = rawLine.replace(/(^|\s)#.*$/, '');
        if (!line.trim()) continue;
        const m = /^\s*['"]?([^'":]+?)['"]?\s*:\s*\S+\s*$/.exec(line);
        expect(m, `.changeset/${file}: cannot read "${rawLine}"`);
        expect(
          RELEASE.includes(m[1]),
          `.changeset/${file} names ${m[1]}, which is not a release package`
        );
      }
    }
  });

  check('3', 'each release package.json is ready to publish', () => {
    const rootLicense = readText(path.join(ROOT, 'LICENSE'));
    for (const { name, dir, pkg } of releaseEntries()) {
      expect(!pkg.private, `${name} is private`);
      expect(
        pkg.publishConfig && pkg.publishConfig.access === 'public',
        `${name}: publishConfig.access is not "public"`
      );
      expect(pkg.license === 'MIT', `${name}: license is ${pkg.license}`);
      expect(
        pkg.engines && pkg.engines.node === '>=20',
        `${name}: engines.node is not ">=20"`
      );
      const licenseFile = path.join(dir, 'LICENSE');
      expect(fs.existsSync(licenseFile), `${name}: no LICENSE file`);
      expect(
        readText(licenseFile) === rootLicense,
        `${name}: LICENSE differs from the root LICENSE`
      );
      const files = pkg.files || [];
      expect(
        !files.some((f) => /\.map$/.test(f)),
        `${name}: files contains a .map pattern`
      );
      expect(
        files.some((f) => f.replace(/\/$/, '') === 'dist'),
        `${name}: files does not list dist`
      );
    }
  });

  check('4', 'the icon package is an optional peer, never a dependency', () => {
    const workspace = readWorkspace();
    for (const name of [CORE, DIAGRAM]) {
      const { pkg } = workspace.get(name) || {};
      expect(pkg, `${name} is missing from packages/`);
      expect(
        pkg.peerDependencies && ICONS_AWS in pkg.peerDependencies,
        `${name}: ${ICONS_AWS} is not in peerDependencies`
      );
      expect(
        pkg.peerDependenciesMeta &&
          pkg.peerDependenciesMeta[ICONS_AWS] &&
          pkg.peerDependenciesMeta[ICONS_AWS].optional === true,
        `${name}: ${ICONS_AWS} is not marked optional in peerDependenciesMeta`
      );
    }
    for (const [name, { pkg }] of workspace) {
      for (const field of ['dependencies', 'optionalDependencies']) {
        expect(
          !(pkg[field] && ICONS_AWS in pkg[field]),
          `${name}: ${ICONS_AWS} is in ${field}`
        );
      }
    }
    const diagramDeps = workspace.get(DIAGRAM).pkg.dependencies || {};
    const internal = Object.keys(diagramDeps).filter((d) =>
      d.startsWith('@mindfiredigital/')
    );
    expect(
      internal.length === 0,
      `${DIAGRAM} has @mindfiredigital dependencies: ${internal.join(', ')}`
    );
    const coreDeps = Object.keys(workspace.get(CORE).pkg.dependencies || {});
    const coreInternal = coreDeps.filter((d) =>
      d.startsWith('@mindfiredigital/')
    );
    expect(
      coreInternal.length === 1 && coreInternal[0] === VALIDATOR,
      `${CORE} dependencies on @mindfiredigital packages are [${coreInternal.join(', ')}], expected only ${VALIDATOR}`
    );
  });

  check(
    '5',
    'every other workspace package is private or not published',
    () => {
      const text = readText(path.join(ROOT, 'scripts', 'publish-packages.mjs'));
      const match = /PUBLISH_ORDER\s*=\s*\[([\s\S]*?)\]/.exec(text);
      const allowList = match
        ? [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1])
        : [];
      for (const [name, { pkg }] of readWorkspace()) {
        if (RELEASE.includes(name)) continue;
        expect(
          pkg.private === true || !allowList.includes(name),
          `${name} is not private and is in the publish allow-list`
        );
      }
    }
  );
}

// ─── Tarballs ──────────────────────────────────────────────

/** Reads a .tgz without external tools: entries by name, with sizes. */
function readTarball(file) {
  const raw = zlib.gunzipSync(fs.readFileSync(file));
  const text = (buf, start, length) => {
    const end = buf.indexOf(0, start);
    return buf.toString(
      'utf8',
      start,
      end === -1 || end > start + length ? start + length : end
    );
  };
  const entries = new Map();
  let offset = 0;
  let paxPath = null;
  let longName = null;
  while (offset + 512 <= raw.length) {
    const header = raw.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break;
    let name = text(header, 0, 100);
    const size = parseInt(text(header, 124, 12).trim() || '0', 8);
    const type = String.fromCharCode(header[156]);
    if (text(header, 257, 6).startsWith('ustar')) {
      const prefix = text(header, 345, 155);
      if (prefix) name = `${prefix}/${name}`;
    }
    const dataStart = offset + 512;
    if (type === 'x') {
      const data = raw.subarray(dataStart, dataStart + size);
      let p = 0;
      while (p < data.length) {
        const space = data.indexOf(0x20, p);
        const length = parseInt(data.toString('latin1', p, space), 10);
        if (!length) break;
        const record = data.toString('utf8', space + 1, p + length - 1);
        const eq = record.indexOf('=');
        if (record.slice(0, eq) === 'path') paxPath = record.slice(eq + 1);
        p += length;
      }
    } else if (type === 'L') {
      longName = text(raw, dataStart, size);
    } else if (type === '0' || type === '\0') {
      const full = paxPath || longName || name;
      paxPath = null;
      longName = null;
      // npm tarballs keep everything under "package/"
      entries.set(full.replace(/^[^/]+\//, ''), { offset: dataStart, size });
    } else if (type !== 'g') {
      paxPath = null;
      longName = null;
    }
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  return {
    names: [...entries.keys()],
    has: (n) => entries.has(n),
    sizeOf: (n) => entries.get(n).size,
    unpackedSize: () => [...entries.values()].reduce((s, e) => s + e.size, 0),
    read: (n) => {
      const e = entries.get(n);
      return raw.subarray(e.offset, e.offset + e.size);
    },
    readText: (n) => {
      const e = entries.get(n);
      return raw.toString('utf8', e.offset, e.offset + e.size);
    },
  };
}

function findTarball(dir, name) {
  const prefix = tarballPrefix(name);
  const matches = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && /^\d/.test(f.slice(prefix.length)))
    .filter((f) => f.endsWith('.tgz'));
  if (matches.length !== 1) {
    throw new Violation(
      `expected one tarball for ${name} in ${dir}, found ${matches.length}`
    );
  }
  return path.join(dir, matches[0]);
}

/** Module specifiers that a JavaScript or declaration file imports. */
function moduleSpecifiers(fileName, text, kind) {
  const T = ts();
  const sf = T.createSourceFile(
    fileName,
    text,
    T.ScriptTarget.Latest,
    false,
    kind === 'declaration' ? T.ScriptKind.TS : T.ScriptKind.JS
  );
  const found = new Set();
  const add = (node) => {
    if (node && T.isStringLiteralLike(node)) found.add(node.text);
  };
  (function walk(node) {
    if (T.isImportDeclaration(node) || T.isExportDeclaration(node)) {
      add(node.moduleSpecifier);
    } else if (T.isImportTypeNode(node)) {
      if (node.argument && T.isLiteralTypeNode(node.argument)) {
        add(node.argument.literal);
      }
    } else if (
      T.isImportEqualsDeclaration(node) &&
      T.isExternalModuleReference(node.moduleReference)
    ) {
      add(node.moduleReference.expression);
    } else if (T.isCallExpression(node) && node.arguments.length > 0) {
      const callee = node.expression;
      const isRequire =
        T.isIdentifier(callee) && /^(__)?require\d*$/.test(callee.text);
      if (isRequire || callee.kind === T.SyntaxKind.ImportKeyword) {
        add(node.arguments[0]);
      }
    }
    T.forEachChild(node, walk);
  })(sf);
  return [...found];
}

// ─── Pack checks 6 to 10 ───────────────────────────────────

function packAll(dir) {
  fs.mkdirSync(dir, { recursive: true });
  // The launcher is an executable and its fixed arguments ("corepack pnpm"),
  // kept apart from the destination folder, which is passed on as one argument
  // and never read by a shell (on Windows pnpm is a .cmd file, which `run`
  // starts through one with every argument quoted).
  const [launcher, ...launcherArgs] = (process.env.ADAC_PNPM || 'pnpm')
    .trim()
    .split(/\s+/);
  for (const { name, dir: pkgDir } of releaseEntries()) {
    const r = run(
      launcher,
      [...launcherArgs, 'pack', '--pack-destination', dir],
      { cwd: pkgDir, shell: true }
    );
    if (r.code !== 0) fail('pack', `could not pack ${name}`, r.out);
  }
}

function runPack(dir) {
  console.log(`Pack checks (tarballs in ${dir})`);
  packAll(dir);

  const tarballs = new Map();
  const packed = new Map();
  for (const name of RELEASE) {
    const file = findTarball(dir, name);
    const tar = readTarball(file);
    tarballs.set(name, { file, tar });
    packed.set(name, JSON.parse(tar.readText('package.json')));
  }

  check('6', 'the packed manifests have no workspace: range', () => {
    for (const [name, { tar }] of tarballs) {
      expect(
        !tar.readText('package.json').includes('workspace:'),
        `${name}: the packed package.json contains "workspace:"`
      );
    }
    const range = (packed.get(CORE).dependencies || {})[VALIDATOR];
    expect(
      typeof range === 'string' && range.startsWith('^'),
      `${CORE}: the ${VALIDATOR} range is ${JSON.stringify(range)}, expected one starting with ^`
    );
  });

  check('7', 'each tarball has the right files and size', () => {
    for (const [name, { tar }] of tarballs) {
      for (const required of REQUIRED_FILES[name] || []) {
        expect(tar.has(required), `${name}: the tarball has no ${required}`);
      }
      const bad = tar.names.filter((n) => /\.map$|(^|\/)\.DS_Store$/.test(n));
      expect(
        bad.length === 0,
        `${name}: the tarball contains ${bad.slice(0, 3).join(', ')}`
      );
      const size = tar.unpackedSize();
      expect(
        size <= MAX_UNPACKED[name],
        `${name}: unpacked size ${(size / MB).toFixed(1)} MB is over ${MAX_UNPACKED[name] / MB} MB`
      );
    }
  });

  check(
    '8',
    'the icon tarball holds every mapped icon and nothing else junk',
    () => {
      const { tar } = tarballs.get(ICONS);
      expect(tar.has('mappings/icon-map.json'), 'no mappings/icon-map.json');
      const map = JSON.parse(tar.readText('mappings/icon-map.json'));
      const files = [...new Set(Object.values(map))];
      const missing = files.filter((f) => !tar.has(`assets/${f}`));
      expect(
        missing.length === 0,
        `${missing.length} of ${files.length} mapped icons are not in assets/ (first: ${missing[0]})`
      );
      const junk = tar.names.filter((n) =>
        /(^|\/)\.DS_Store$|\.(zip|pptx)$/i.test(n)
      );
      expect(
        junk.length === 0,
        `the tarball contains ${junk.slice(0, 3).join(', ')}`
      );
    }
  );

  check('9', 'no declaration file imports an unpublished package', () => {
    for (const name of [DIAGRAM, CORE, VALIDATOR]) {
      const { tar } = tarballs.get(name);
      for (const file of tar.names.filter((n) => /\.d\.[cm]?ts$/.test(n))) {
        for (const spec of moduleSpecifiers(
          file,
          tar.readText(file),
          'declaration'
        )) {
          const hit = UNPUBLISHED_IMPORTS.find(
            (p) => spec === p || spec.startsWith(`${p}/`)
          );
          expect(!hit, `${name}: ${file} imports ${spec}`);
        }
      }
    }
  });

  check(
    '10',
    'every bare module a bundle loads is a built-in or a dependency',
    () => {
      for (const name of [DIAGRAM, CORE, VALIDATOR]) {
        const { tar } = tarballs.get(name);
        const dependencies = Object.keys(packed.get(name).dependencies || {});
        const bundles = tar.names.filter((n) =>
          /^dist\/[^/]+\.(c|m)?js$/.test(n)
        );
        expect(bundles.length > 0, `${name}: no bundle found under dist/`);
        for (const file of bundles) {
          for (const spec of moduleSpecifiers(
            file,
            tar.readText(file),
            'bundle'
          )) {
            if (spec.startsWith('.') || path.isAbsolute(spec)) continue;
            if (isBuiltin(spec)) continue;
            const pkgName = packageNameOf(spec);
            expect(
              dependencies.includes(pkgName) ||
                ALWAYS_ALLOWED_REQUIRES.includes(pkgName),
              `${name}: ${file} loads ${spec}, which is not a built-in, a dependency or web-worker`
            );
          }
        }
      }
    }
  );
}

// ─── Smoke tests S1 to S8 ──────────────────────────────────

const quote = (a) => (process.platform === 'win32' ? `"${a}"` : a);

/** Runs a command; returns its exit code and its output (stdout + stderr). */
function run(command, args, options = {}) {
  // npm is npm.cmd on Windows, which needs a shell; pass one quoted command
  // line then (arguments plus `shell: true` are deprecated since Node 24)
  const useShell = options.shell === true && process.platform === 'win32';
  const spawnOptions = {
    cwd: options.cwd,
    encoding: 'utf8',
    maxBuffer: 256 * MB,
    env: { ...process.env, ...(options.env || {}) },
  };
  const result = useShell
    ? spawnSync([command, ...args.map(quote)].join(' '), {
        ...spawnOptions,
        shell: true,
      })
    : spawnSync(command, args, spawnOptions);
  return {
    code: result.status === null ? 1 : result.status,
    // an error (the command could not be started) has no output of its own
    out: `${result.stdout || ''}${result.stderr || ''}${result.error ? `${result.error.message}\n` : ''}`,
  };
}

const npm = (args, cwd) => run('npm', args, { cwd, shell: true });
const node = (args, cwd) => run(process.execPath, args, { cwd });

function lines(out) {
  return out.split(/\r?\n/).filter((l) => l.trim());
}

const countIcons = (svg) => (svg.match(/data:image\//g) || []).length;

const FORBIDDEN_ICON_MESSAGES = [
  'Could not find',
  'Could not resolve',
  'Failed to load',
  'icons are not installed',
];

function runSmoke(dir) {
  console.log(`Smoke tests (tarballs in ${dir}, node ${process.version})`);
  const tgz = Object.fromEntries(
    RELEASE.map((n) => [shortName(n), findTarball(dir, n)])
  );
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'adac-smoke-'));
  tempFolders.push(base);
  if (base.startsWith(ROOT + path.sep)) {
    fail('smoke', 'the temporary folder is inside the repository', base);
  }
  let counter = 0;

  /** A new empty folder with a package.json and the sample files. */
  const freshProject = () => {
    const folder = path.join(base, `t${++counter}`);
    fs.mkdirSync(path.join(folder, 'yamls'), { recursive: true });
    fs.writeFileSync(
      path.join(folder, 'package.json'),
      JSON.stringify({ name: 'adac-smoke', version: '1.0.0', private: true })
    );
    for (const sample of [
      'aws.adac.yaml',
      'gcp.adac.yaml',
      'azure_enterprise_saas.adac.yaml',
    ]) {
      fs.copyFileSync(
        path.join(ROOT, 'yamls', sample),
        path.join(folder, 'yamls', sample)
      );
    }
    return folder;
  };

  const install = (folder, names) => {
    const r = npm(
      [
        'install',
        '--no-audit',
        '--no-fund',
        '--loglevel=error',
        ...names.map((n) => tgz[n]),
      ],
      folder
    );
    expect(r.code === 0, `npm install failed:\n${r.out}`);
  };

  const installGlobal = (prefix, names) => {
    const r = npm(
      [
        'install',
        '-g',
        '--prefix',
        prefix,
        '--no-audit',
        '--no-fund',
        '--loglevel=error',
        ...names.map((n) => tgz[n]),
      ],
      base
    );
    expect(r.code === 0, `npm install -g failed:\n${r.out}`);
  };

  const noProblems = (folder) => {
    const r = npm(['ls'], folder);
    expect(r.code === 0, `npm ls reports a problem:\n${r.out}`);
  };

  const localCli = (folder) =>
    path.join(
      folder,
      'node_modules',
      '@mindfiredigital',
      'adac-diagram',
      'dist',
      'cli.js'
    );
  const globalPackages = (prefix) =>
    process.platform === 'win32'
      ? path.join(prefix, 'node_modules')
      : path.join(prefix, 'lib', 'node_modules');
  const globalCli = (prefix) =>
    path.join(
      globalPackages(prefix),
      '@mindfiredigital',
      'adac-diagram',
      'dist',
      'cli.js'
    );
  const globalShim = (prefix) =>
    process.platform === 'win32'
      ? path.join(prefix, 'adac.cmd')
      : path.join(prefix, 'bin', 'adac');

  /** `adac diagram yamls/<sample> -o <out> --no-open`, run from `cwd`. */
  const draw = (cli, cwd, sample, out) => {
    const r = node(
      [cli, 'diagram', `yamls/${sample}`, '-o', out, '--no-open'],
      cwd
    );
    const svgFile = path.join(cwd, out);
    return {
      ...r,
      svg: fs.existsSync(svgFile) ? fs.readFileSync(svgFile, 'utf8') : '',
    };
  };

  /**
   * The same command, started through the installed `adac` shim (the file a
   * user's shell runs: bin/adac, or adac.cmd on Windows), not through cli.js.
   * The shim starts `node` from PATH, so the Node that runs this script goes
   * first there, as for every other smoke test.
   */
  const drawInstalled = (shim, cwd, sample, out) => {
    const pathKey =
      Object.keys(process.env).find((k) => k.toLowerCase() === 'path') ||
      'PATH';
    const r = run(
      quote(shim),
      ['diagram', `yamls/${sample}`, '-o', out, '--no-open'],
      {
        cwd,
        shell: true,
        env: {
          [pathKey]: `${path.dirname(process.execPath)}${path.delimiter}${process.env[pathKey] || ''}`,
        },
      }
    );
    const svgFile = path.join(cwd, out);
    return {
      ...r,
      svg: fs.existsSync(svgFile) ? fs.readFileSync(svgFile, 'utf8') : '',
    };
  };

  const step = (label, text, fn) => check(label, text, fn);

  {
    step(
      'S1',
      'validator, icons-aws, core and diagram draw AWS with icons',
      () => {
        const folder = freshProject();
        install(folder, ['validator', 'icons-aws', 'core', 'diagram']);
        noProblems(folder);
        const r = draw(localCli(folder), folder, 'aws.adac.yaml', 'out.svg');
        expect(r.code === 0, `adac exited ${r.code}:\n${r.out}`);
        for (const text of FORBIDDEN_ICON_MESSAGES) {
          expect(
            !r.out.includes(text),
            `the output contains "${text}":\n${r.out}`
          );
        }
        expect(
          countIcons(r.svg) >= 10,
          `the SVG has ${countIcons(r.svg)} icons, expected at least 10`
        );
      }
    );

    step(
      'S2',
      'without icons-aws, AWS draws with one message naming the package',
      () => {
        const folder = freshProject();
        install(folder, ['validator', 'core', 'diagram']);
        const r = draw(localCli(folder), folder, 'aws.adac.yaml', 'out.svg');
        expect(r.code === 0, `adac exited ${r.code}:\n${r.out}`);
        expect(r.svg.length > 0, 'out.svg was not written');
        const named = lines(r.out).filter((l) => l.includes(ICONS_AWS));
        expect(
          named.length === 1,
          `${named.length} lines name ${ICONS_AWS}, expected 1:\n${r.out}`
        );
      }
    );

    step(
      'S3',
      'GCP and Azure draw without icons and say no icon package exists',
      () => {
        const folder = freshProject();
        install(folder, ['validator', 'core', 'diagram']);
        for (const [sample, provider] of [
          ['gcp.adac.yaml', 'GCP'],
          ['azure_enterprise_saas.adac.yaml', 'Azure'],
        ]) {
          const r = draw(localCli(folder), folder, sample, `${provider}.svg`);
          expect(r.code === 0, `${sample}: adac exited ${r.code}:\n${r.out}`);
          expect(r.svg.length > 0, `${sample}: the SVG was not written`);
          const text = `No icon package is available for ${provider} yet`;
          const named = lines(r.out).filter((l) => l.includes(text));
          expect(
            named.length === 1,
            `${sample}: ${named.length} lines say "${text}", expected 1:\n${r.out}`
          );
        }
      }
    );

    step(
      'S4',
      'a global install of diagram and icons-aws draws AWS with icons',
      () => {
        const prefix = path.join(base, 'prefix-s4');
        installGlobal(prefix, ['diagram', 'icons-aws']);
        expect(
          fs.existsSync(globalShim(prefix)),
          `no adac command at ${globalShim(prefix)}`
        );
        const folder = freshProject();
        // the installed `adac` command itself, as a user runs it
        const r = drawInstalled(
          globalShim(prefix),
          folder,
          'aws.adac.yaml',
          'out.svg'
        );
        expect(r.code === 0, `adac exited ${r.code}:\n${r.out}`);
        expect(r.svg.length > 0, 'out.svg was not written');
        expect(
          countIcons(r.svg) >= 10,
          `the SVG has ${countIcons(r.svg)} icons, expected at least 10`
        );
      }
    );

    step(
      'S5',
      'a global diagram finds icons-aws installed in the working folder',
      () => {
        const prefix = path.join(base, 'prefix-s5');
        installGlobal(prefix, ['diagram']);
        const folder = freshProject();
        install(folder, ['icons-aws']);
        const r = draw(globalCli(prefix), folder, 'aws.adac.yaml', 'out.svg');
        expect(r.code === 0, `adac exited ${r.code}:\n${r.out}`);
        expect(
          countIcons(r.svg) >= 10,
          `the SVG has ${countIcons(r.svg)} icons, expected at least 10`
        );
      }
    );

    step(
      'S6',
      'core loads with require and import and draws AWS with icons',
      () => {
        const folder = freshProject();
        install(folder, ['core', 'validator', 'icons-aws']);
        fs.writeFileSync(
          path.join(folder, 's6.cjs'),
          [
            "const fs = require('fs');",
            "const core = require('@mindfiredigital/adac-core');",
            "core.generateDiagramSvg(fs.readFileSync('yamls/aws.adac.yaml', 'utf8'), 'elk')",
            "  .then((r) => console.log('ICONS=' + (r.svg.match(/data:image\\//g) || []).length));",
          ].join('\n')
        );
        fs.writeFileSync(
          path.join(folder, 's6.mjs'),
          [
            "import fs from 'fs';",
            "import * as core from '@mindfiredigital/adac-core';",
            "const r = await core.generateDiagramSvg(fs.readFileSync('yamls/aws.adac.yaml', 'utf8'), 'elk');",
            "console.log('ICONS=' + (r.svg.match(/data:image\\//g) || []).length);",
          ].join('\n')
        );
        for (const script of ['s6.cjs', 's6.mjs']) {
          const r = node([script], folder);
          expect(r.code === 0, `${script} exited ${r.code}:\n${r.out}`);
          const m = /ICONS=(\d+)/.exec(r.out);
          expect(
            m && Number(m[1]) >= 10,
            `${script}: the SVG has ${m ? m[1] : 'no'} icons, expected at least 10`
          );
        }
      }
    );

    step('S7', 'the validator loads with require and import', () => {
      const folder = freshProject();
      install(folder, ['validator']);
      const yaml = loadDependency('js-yaml');
      const sample = yaml.load(
        fs.readFileSync(path.join(ROOT, 'yamls', 'aws.adac.yaml'), 'utf8')
      );
      fs.writeFileSync(path.join(folder, 'aws.json'), JSON.stringify(sample));
      fs.writeFileSync(
        path.join(folder, 's7.cjs'),
        [
          "const v = require('@mindfiredigital/adac-validator');",
          "const cfg = require('./aws.json');",
          "console.log('RESULT=' + v.validateAdacConfig(cfg).valid + ',' + v.validateAdacConfig({}).valid);",
        ].join('\n')
      );
      fs.writeFileSync(
        path.join(folder, 's7.mjs'),
        [
          "import fs from 'fs';",
          "import * as v from '@mindfiredigital/adac-validator';",
          "const cfg = JSON.parse(fs.readFileSync('aws.json', 'utf8'));",
          "console.log('RESULT=' + v.validateAdacConfig(cfg).valid + ',' + v.validateAdacConfig({}).valid);",
        ].join('\n')
      );
      for (const script of ['s7.cjs', 's7.mjs']) {
        const r = node([script], folder);
        expect(r.code === 0, `${script} exited ${r.code}:\n${r.out}`);
        expect(
          r.out.includes('RESULT=true,false'),
          `${script}: expected valid for the AWS sample and invalid for {}:\n${r.out}`
        );
      }
    });

    step(
      'S8',
      'TypeScript compiles the main exports with skipLibCheck: false',
      () => {
        const folder = freshProject();
        install(folder, ['diagram', 'core', 'validator']);
        fs.writeFileSync(
          path.join(folder, 'index.ts'),
          [
            "import { generateDiagram } from '@mindfiredigital/adac-diagram';",
            "import { generateDiagramSvg, type GenerationResult } from '@mindfiredigital/adac-core';",
            "import { validateAdacConfig, type AdacConfig } from '@mindfiredigital/adac-validator';",
            '',
            'export async function main(yaml: string, config: AdacConfig): Promise<GenerationResult> {',
            '  validateAdacConfig(config);',
            "  await generateDiagram('in.adac.yaml', 'out.svg');",
            '  return generateDiagramSvg(yaml);',
            '}',
          ].join('\n')
        );
        const tsc = path.join(
          path.dirname(
            (() => {
              try {
                return rootRequire.resolve('typescript/package.json');
              } catch {
                return require.resolve('typescript/package.json');
              }
            })()
          ),
          'bin',
          'tsc'
        );
        for (const [resolution, module] of [
          ['node16', 'node16'],
          ['bundler', 'esnext'],
        ]) {
          const config = `tsconfig.${resolution}.json`;
          fs.writeFileSync(
            path.join(folder, config),
            JSON.stringify({
              compilerOptions: {
                target: 'es2022',
                module,
                moduleResolution: resolution,
                strict: true,
                skipLibCheck: false,
                noEmit: true,
                types: [],
              },
              files: ['index.ts'],
            })
          );
          const r = node([tsc, '-p', config], folder);
          expect(
            r.code === 0,
            `tsc failed with moduleResolution ${resolution}:\n${r.out}`
          );
        }
      }
    );
  }
}

// ─── Main ──────────────────────────────────────────────────

function usage(message) {
  console.error(message);
  console.error(
    'Usage: verify-release.cjs [--static | --pack <dir> | --smoke <dir>]'
  );
  process.exit(2);
}

function main() {
  try {
    runMode(process.argv.slice(2));
  } catch (err) {
    if (err instanceof Violation) fail('error', err.message);
    throw err;
  }
  console.log('All checks passed.');
}

function runMode(args) {
  const mode = args[0];
  const dirArg = args[1];

  if (mode === undefined) {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'adac-release-'));
    tempFolders.push(temp);
    runStatic();
    runPack(temp);
    runSmoke(temp);
  } else if (mode === '--static') {
    runStatic();
  } else if (mode === '--pack') {
    if (!dirArg) usage('--pack needs a folder');
    runPack(path.resolve(dirArg));
  } else if (mode === '--smoke') {
    if (!dirArg) usage('--smoke needs a folder');
    runSmoke(path.resolve(dirArg));
  } else {
    usage(`Unknown argument: ${mode}`);
  }
}

main();
