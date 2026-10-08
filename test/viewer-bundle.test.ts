import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('viewer 진입점', () => {
  it('tiptap·prosemirror 를 정적으로 import 하지 않는다', () => {
    execSync('npx tsup', { stdio: 'ignore' });
    const js = readFileSync('dist/viewer.js', 'utf8');
    expect(js).not.toMatch(/from\s*["'](@tiptap\/|prosemirror-)/);
    expect(js).not.toMatch(/require\(["'](@tiptap\/|prosemirror-)/);
  }, 120_000);
});
