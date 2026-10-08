import { describe, expect, it } from 'vitest';

describe('패키지 골격', () => {
  it('진입점을 불러올 수 있다', async () => {
    await expect(import('../src/viewer')).resolves.toBeDefined();
    await expect(import('../src/editor')).resolves.toBeDefined();
  });
});
