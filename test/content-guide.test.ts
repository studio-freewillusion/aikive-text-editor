import { Editor } from '@tiptap/core';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseContent } from '../src/editor/parse-content';
import { buildExtensions } from '../src/editor/use-editor-setup';

const GUIDE = 'docs/content-guide.md';
const guide = () => readFileSync(GUIDE, 'utf8');

const save = (html: string) => {
  const ed = new Editor({ element: document.createElement('div'), extensions: buildExtensions(true), content: parseContent(html) });
  const out = ed.isEmpty ? '' : ed.getHTML();
  ed.destroy();
  return out;
};
// 보기 좋게 줄을 나눈 예시를 한 줄로 — 태그 사이 줄바꿈·들여쓰기만 지운다
const oneLine = (html: string) => html.trim().replace(/>\s*\n\s*</g, '><');
const blocks = (lang: string) => [...guide().matchAll(new RegExp('```' + lang + '\\n([\\s\\S]*?)```', 'g'))].map((m) => m[1]);
const listIn = (heading: string) => {
  const section = guide().split(/\n## /).find((s) => s.split('\n')[0].trim() === heading) ?? '';
  return [...section.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
};
const arrayIn = (src: string, name: string) =>
  [...(src.match(new RegExp(name + ' = \\[([\\s\\S]*?)\\];'))?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);

describe('AI 작성 가이드', () => {
  it('배포본에 들어간다', () => {
    expect(existsSync(GUIDE)).toBe(true);
    const files = JSON.parse(execSync('npm pack --dry-run --json --ignore-scripts', { encoding: 'utf8' }))[0].files.map(
      (f: { path: string }) => f.path,
    );
    expect(files).toContain(GUIDE);
  });

  it('그대로 쓰는 예시는 저장해도 한 글자도 바뀌지 않는다', () => {
    const examples = blocks('html');
    expect(examples.length).toBeGreaterThan(10);
    for (const ex of examples) expect(save(oneLine(ex))).toBe(oneLine(ex));
  });

  it('줄여 쓴 예시는 저장 뒤 다시 저장해도 같고 주소가 남는다', () => {
    const examples = blocks('html 줄여 쓰기');
    expect(examples.length).toBeGreaterThan(0);
    for (const ex of examples) {
      const once = save(oneLine(ex));
      expect(save(once)).toBe(once);
      for (const src of oneLine(ex).match(/https:\/\/[^"]+/g) ?? []) expect(once).toContain(src);
    }
  });

  it('글자 크기·글자색 목록이 툴바와 같다', () => {
    const toolbar = readFileSync('src/ui/toolbar.tsx', 'utf8');
    expect(listIn('글자 크기')).toEqual(arrayIn(toolbar, 'FONT_SIZE_OPTIONS'));
    const hex = [...toolbar.matchAll(/value: '(#[0-9a-f]{6})'/g)].map((m) => m[1]);
    const rgb = hex.map((h) => `rgb(${[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(', ')})`);
    expect(listIn('글자색').filter((v) => /^rgb\(\d/.test(v))).toEqual(rgb);
  });

  it('내부 구현 이름을 쓰지 않는다', () => {
    const text = guide();
    for (const word of ['tiptap', 'ProseMirror', 'prosemirror', 'DOMPurify', 'sanitize', 'normalize', 'parseContent', 'src/', 'isAllowed']) {
      expect(text).not.toContain(word);
    }
  });
});
