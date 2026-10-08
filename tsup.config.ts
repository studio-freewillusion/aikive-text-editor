import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { viewer: 'src/viewer/index.ts', editor: 'src/editor/index.ts' },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  treeshake: true,
});
