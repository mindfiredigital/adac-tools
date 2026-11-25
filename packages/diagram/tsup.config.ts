import path from 'node:path';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['cjs', 'esm'],
  // the published types must not import any workspace package, none of which
  // is published with them; the second pattern lets the bundler follow the
  // relative imports inside those packages' declaration files
  dts: { resolve: [/^@mindfiredigital\//, /^\.\.?\//] },
  clean: true,
  splitting: false,
  sourcemap: false,
  minify: false,
  // Bundle internal workspace packages and all key dependencies
  noExternal: [
    '@mindfiredigital/adac-core',
    '@mindfiredigital/adac-cli',
    '@mindfiredigital/adac-cost',
    '@mindfiredigital/adac-export-terraform',
    '@mindfiredigital/adac-validator',
    '@mindfiredigital/adac-compliance',
    '@mindfiredigital/adac-parser',
    '@mindfiredigital/adac-layout-core',
    '@mindfiredigital/adac-layout-elk',
    '@mindfiredigital/adac-export-cloudformation',
    '@mindfiredigital/adac-export-k8s',
    'elkjs',
    'fs-extra',
    'axios',
    'adm-zip',
    'js-yaml',
  ],
  external: ['web-worker'],
  // Bundle core from its source. Core's own build keeps the validator
  // external (it is a dependency of core), so core's dist leaves a plain
  // require("@mindfiredigital/adac-validator") that this bundle cannot see;
  // from source, the validator is bundled like every other workspace package,
  // and diagram needs no dependency on it.
  esbuildOptions(options) {
    options.alias = {
      ...options.alias,
      '@mindfiredigital/adac-core': path.resolve(
        process.cwd(),
        '../core/src/index.ts'
      ),
    };
  },
  // Fix for __dirname in bundled code
  shims: true,
  async onSuccess() {
    const fs = await import('fs-extra');
    const root = process.cwd();
    await fs.copy(
      path.resolve(root, 'src/mappings'),
      path.resolve(root, 'dist/mappings')
    );
    // Copy templates for export-cloudformation which reads them at runtime
    await fs
      .copy(
        path.resolve(root, '../export-cloudformation/src/templates'),
        path.resolve(root, 'dist/templates')
      )
      .catch(() =>
        console.warn('Could not copy export-cloudformation templates')
      );
  },
});
