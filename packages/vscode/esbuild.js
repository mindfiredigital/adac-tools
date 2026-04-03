// @ts-check
/* eslint-env node, commonjs */
const esbuild = require('esbuild');

const isProduction = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');

/** @type {esbuild.BuildOptions} */
const buildOptions = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode', 'web-worker'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: !isProduction,
  minify: isProduction,
  treeShaking: true,
};

async function main() {
  if (isWatch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    // console.log('[adac-vscode] Watching for changes...');
  } else {
    await esbuild.build(buildOptions);
    // console.log('[adac-vscode] Build complete.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
