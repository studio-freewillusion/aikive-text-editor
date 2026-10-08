import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('패키지 골격', () => {
  it('진입점을 불러올 수 있다', async () => {
    await expect(import('../src/viewer')).resolves.toBeDefined();
    await expect(import('../src/editor')).resolves.toBeDefined();
  });
  it('tiptap 은 정확한 버전으로 고정한다 — 새 버전이 저장 HTML 을 바꿀 수 있다', () => {
    const { dependencies } = JSON.parse(readFileSync('package.json', 'utf8')) as { dependencies: Record<string, string> };
    const loose = Object.entries(dependencies).filter(([n, v]) => n.startsWith('@tiptap/') && !/^\d/.test(v));
    expect(loose).toEqual([]);
  });
});
