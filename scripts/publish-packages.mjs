/**
 * publish-packages.mjs
 *
 * Publishes the four listed packages to https://registry.npmjs.org/, in the
 * order of PUBLISH_ORDER (a package is published after the packages it
 * depends on). No other workspace package is published.
 *
 * What is published are the tarballs that `node scripts/verify-release.cjs
 * --pack <dir>` packed and checked, not a fresh pack of each package folder, so
 * the files on npm are the files that were verified. The folder is given with
 * --tarballs <dir> or the environment variable ADAC_TARBALLS.
 *
 * Before anything is published, the script exits with code 1 if a listed
 * package is missing from packages/ or is private, or if the folder has no
 * tarball for a listed package, has two for one package, or holds a tarball
 * whose version differs from the version in packages/. It stops at the first
 * publish failure and does not try the packages after it. Versions that are
 * already on npm are skipped, so a re-run after a failure is safe.
 *
 * Usage:
 *   node scripts/publish-packages.mjs --tarballs <dir>            # publish
 *   node scripts/publish-packages.mjs --tarballs <dir> --dry-run  # dry run
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const packagesDir = path.resolve(root, 'packages');

const dryRun = process.argv.includes('--dry-run');

const tarballsFlag = process.argv.indexOf('--tarballs');
const tarballsArg =
  tarballsFlag === -1 ? undefined : process.argv[tarballsFlag + 1];
const tarballsDir = tarballsArg ?? process.env.ADAC_TARBALLS;

// The repository's .npmrc may map the @mindfiredigital scope to another
// registry, and a scope mapping wins over --registry; name the scope too, so
// both the "already published?" check and the publish go to npmjs.org.
const REGISTRY_FLAGS =
  '--registry=https://registry.npmjs.org/ --@mindfiredigital:registry=https://registry.npmjs.org/';

/** The packages that are published, in publish order. */
const PUBLISH_ORDER = [
  '@mindfiredigital/adac-validator',
  '@mindfiredigital/adac-icons-aws',
  '@mindfiredigital/adac-core',
  '@mindfiredigital/adac-diagram',
];

// ─── Helpers ───────────────────────────────────────────────
function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function isAlreadyPublished(name, version) {
  try {
    execSync(`npm view ${name}@${version} version ${REGISTRY_FLAGS}`, {
      stdio: 'pipe',
    });
    return true; // version already exists
  } catch {
    return false; // not yet published
  }
}

/** Every workspace package that has a package.json, in folder-name order. */
function readWorkspacePackages() {
  return fs
    .readdirSync(packagesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .filter((dir) => fs.existsSync(path.join(packagesDir, dir, 'package.json')))
    .map((dir) => ({
      dir,
      pkgJson: readJson(path.join(packagesDir, dir, 'package.json')),
    }));
}

/** The package.json inside a tarball made by `pnpm pack`. */
function readTarballManifest(file) {
  const tar = zlib.gunzipSync(fs.readFileSync(file));
  let offset = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const field = (start, length) =>
      header.toString('utf8', start, start + length).replace(/\0[\s\S]*$/, '');
    const size = parseInt(field(124, 12).trim() || '0', 8);
    const type = field(156, 1);
    const prefix = field(345, 155);
    const name = prefix ? `${prefix}/${field(0, 100)}` : field(0, 100);
    const body = offset + 512;
    if ((type === '0' || type === '') && name === 'package/package.json') {
      return JSON.parse(tar.toString('utf8', body, body + size));
    }
    offset = body + Math.ceil(size / 512) * 512;
  }
  throw new Error('no package/package.json in the tarball');
}

/**
 * The tarballs in a folder, by the name inside each one (not by file name).
 * `problems` receives a folder that cannot be read, a tarball that cannot be
 * read, and a package that has two tarballs.
 */
function readTarballs(dir, problems) {
  const byName = new Map();
  let files;
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.tgz'));
  } catch (err) {
    problems.push(`cannot read the tarball folder ${dir}: ${err.message}`);
    return byName;
  }
  for (const f of files.sort()) {
    const file = path.join(dir, f);
    try {
      const { name, version } = readTarballManifest(file);
      if (byName.has(name)) {
        problems.push(
          `${name} has two tarballs in ${dir}: ${path.basename(byName.get(name).file)} and ${f}`
        );
      } else {
        byName.set(name, { file, version });
      }
    } catch (err) {
      problems.push(`cannot read ${file}: ${err.message}`);
    }
  }
  return byName;
}

// ─── Main ──────────────────────────────────────────────────
async function main() {
  console.log(`\n🚀 ADAC Monorepo Publisher ${dryRun ? '(DRY RUN)' : ''}\n`);
  console.log('─'.repeat(60));

  const workspace = readWorkspacePackages();
  const byName = new Map(workspace.map((p) => [p.pkgJson.name, p]));

  // Check the whole release set before publishing anything
  const problems = [];
  for (const name of PUBLISH_ORDER) {
    const entry = byName.get(name);
    if (!entry) problems.push(`${name} is missing from packages/`);
    else if (entry.pkgJson.private) problems.push(`${name} is private`);
  }

  // What is published are the verified tarballs, each checked by the name and
  // the version inside it
  let tarballs = new Map();
  if (!tarballsDir) {
    problems.push(
      'no tarball folder: run "node scripts/verify-release.cjs --pack <dir>", then pass --tarballs <dir> (or set ADAC_TARBALLS)'
    );
  } else {
    tarballs = readTarballs(path.resolve(tarballsDir), problems);
    for (const name of PUBLISH_ORDER) {
      const entry = byName.get(name);
      const tarball = tarballs.get(name);
      if (!tarball) {
        problems.push(`${name} has no tarball in ${tarballsDir}`);
      } else if (entry && tarball.version !== entry.pkgJson.version) {
        problems.push(
          `${name}: the tarball is version ${tarball.version}, packages/${entry.dir} is ${entry.pkgJson.version}`
        );
      }
    }
  }
  if (problems.length > 0) {
    problems.forEach((p) => console.error(`❌ ${p}`));
    console.error('Nothing was published.');
    process.exit(1);
  }

  const results = { published: [], skipped: [], failed: [] };

  // Every workspace package that is not in the list is skipped
  for (const { dir, pkgJson } of workspace) {
    if (PUBLISH_ORDER.includes(pkgJson.name)) continue;
    console.log(
      `⏭️  ${pkgJson.name || dir} — not in the release set, skipping`
    );
    results.skipped.push(pkgJson.name || dir);
  }

  for (const name of PUBLISH_ORDER) {
    const { version } = byName.get(name).pkgJson;

    // Check if this version is already published
    if (isAlreadyPublished(name, version)) {
      console.log(`✅ ${name}@${version} — already published, skipping`);
      results.skipped.push(`${name}@${version}`);
      continue;
    }

    console.log(`📦 Publishing ${name}@${version}...`);

    // the tarball that was packed and verified, not a new pack of the folder
    const tarball = tarballs.get(name).file;

    try {
      if (dryRun) {
        console.log(
          `   🏜️  Would run: pnpm publish ${path.basename(tarball)} --access public --no-git-checks`
        );
      } else {
        execSync(
          `pnpm publish "${tarball}" --access public --no-git-checks ${REGISTRY_FLAGS}`,
          {
            cwd: root,
            stdio: 'inherit',
            env: { ...process.env },
          }
        );
      }
      console.log(`   ✅ ${name}@${version} published successfully`);
      results.published.push(`${name}@${version}`);
    } catch (err) {
      console.error(
        `   ❌ Failed to publish ${name}@${version}: ${err.message}`
      );
      results.failed.push(`${name}@${version}`);
      // the packages after this one may depend on it: do not try them
      console.error(
        '   Stopping: the packages after this one are not published.'
      );
      break;
    }
  }

  // ── Summary ────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60));
  console.log('📋 SUMMARY');
  console.log('─'.repeat(60));
  console.log(`  Published: ${results.published.length}`);
  results.published.forEach((p) => console.log(`    ✅ ${p}`));
  console.log(`  Skipped:   ${results.skipped.length}`);
  results.skipped.forEach((s) => console.log(`    ⏭️  ${s}`));
  console.log(`  Failed:    ${results.failed.length}`);
  results.failed.forEach((f) => console.log(`    ❌ ${f}`));

  if (results.failed.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
