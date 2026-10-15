import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });

describe('브라우저 기본 창', () => {
  it('src 에 prompt·confirm·alert 호출이 없다', () => {
    const hits = files('src')
      .filter((f) => /\.(ts|tsx)$/.test(f))
      .filter((f) => /\b(window\.)?(prompt|confirm|alert)\(/.test(readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '')));
    expect(hits).toEqual([]);
  });
});
