import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  minify: false,
  shims: true,
  noExternal: [
    '@mindfiredigital/adac-parser',
    '@mindfiredigital/adac-schema',
    '@mindfiredigital/adac-layout-elk',
    '@mindfiredigital/adac-layout-dagre',
    '@mindfiredigital/adac-layout-core',
  ],
});
