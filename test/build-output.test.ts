import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('빌드 결과', () => {
  it("editor 진입점만 맨 위에 'use client' 를 둔다", () => {
    execSync('npx tsup', { stdio: 'ignore' });
    expect(readFileSync('dist/editor.js', 'utf8')).toMatch(/^["']use client["'];/);
    expect(readFileSync('dist/viewer.js', 'utf8')).not.toMatch(/use client/);
  }, 120_000);
});
