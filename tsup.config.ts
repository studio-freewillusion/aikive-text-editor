import { readFile, writeFile } from 'node:fs/promises';
import { defineConfig } from 'tsup';

const shared = {
  format: ['esm' as const],
  dts: true,
  sourcemap: true,
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  treeshake: true,
};

export default defineConfig([
  { ...shared, entry: { viewer: 'src/viewer/index.ts' }, clean: true },
  {
    ...shared,
    entry: { editor: 'src/editor/index.ts' },
    // esbuild 가 모듈 머리의 'use client' 를 지워 빌드 뒤 다시 붙인다 — 없으면 Next 서버 컴포넌트에서 불러질 때 깨진다
    onSuccess: async () => {
      const file = 'dist/editor.js';
      const js = await readFile(file, 'utf8');
      if (!js.startsWith('"use client";')) await writeFile(file, `"use client";\n${js}`);
    },
  },
]);
