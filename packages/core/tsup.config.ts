import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  minify: false,
  shims: false,
  // Bundle internal workspace packages and key external dependencies
  noExternal: [
    '@mindfiredigital/adac-parser',
    '@mindfiredigital/adac-layout-core',
    '@mindfiredigital/adac-layout-elk',

    '@mindfiredigital/adac-layout-core',
    '@mindfiredigital/adac-cost',
    '@mindfiredigital/adac-layout-core',
    'elkjs',
    'fs-extra',
  ],
  external: ['web-worker'],
});
