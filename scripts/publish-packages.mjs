/**
 * publish-packages.mjs
 *
 * Publishes the four listed packages to https://registry.npmjs.org/, in the
 * order of PUBLISH_ORDER (a package is published after the packages it
 * depends on). No other workspace package is published.
 *
 * Before anything is published, the script exits with code 1 if a listed
 * package is missing from packages/ or is private. It stops at the first
 * publish failure and does not try the packages after it. Versions that are
 * already on npm are skipped, so a re-run after a failure is safe.
 *
 * Usage:
 *   node scripts/publish-packages.mjs            # actual publish
 *   node scripts/publish-packages.mjs --dry-run   # dry run
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const packagesDir = path.resolve(root, 'packages');

const dryRun = process.argv.includes('--dry-run');

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
    const { dir } = byName.get(name);
    const { version } = byName.get(name).pkgJson;

    // Check if this version is already published
    if (isAlreadyPublished(name, version)) {
      console.log(`✅ ${name}@${version} — already published, skipping`);
      results.skipped.push(`${name}@${version}`);
      continue;
    }

    console.log(`📦 Publishing ${name}@${version}...`);

    const pkgDir = path.join(packagesDir, dir);

    try {
      if (dryRun) {
        console.log(
          `   🏜️  Would run: pnpm publish --access public --no-git-checks in ${dir}`
        );
      } else {
        execSync(
          `pnpm publish --access public --no-git-checks ${REGISTRY_FLAGS}`,
          {
            cwd: pkgDir,
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
