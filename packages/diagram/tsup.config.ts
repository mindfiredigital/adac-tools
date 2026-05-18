import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  minify: false,
  // Bundle internal workspace packages and all key dependencies
  noExternal: [
    '@mindfiredigital/adac-core',
    '@mindfiredigital/adac-cli',
    '@mindfiredigital/adac-cost',
    '@mindfiredigital/adac-export-terraform',
    'elkjs',
    'fs-extra',
    'axios',
    'adm-zip',
    'js-yaml',
  ],
  external: ['web-worker'],
  // Fix for __dirname in bundled code
  shims: true,
  async onSuccess() {
    const fs = await import('fs-extra');
    const path = await import('path');
    const root = process.cwd();
    await fs.copy(
      path.resolve(root, 'src/mappings'),
      path.resolve(root, 'dist/mappings')
    );
  },
});
