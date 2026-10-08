import { Editor } from '@tiptap/core';
import { Slice } from '@tiptap/pm/model';
import { ReplaceStep } from '@tiptap/pm/transform';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseContent } from '../src/editor/parse-content';
import { applySourceContent } from '../src/editor/source-mode';
import { buildExtensions } from '../src/editor/use-editor-setup';

const GUIDE = 'docs/content-guide.md';
const guide = () => readFileSync(GUIDE, 'utf8');

// 불러오기만 하면 거치지 않는 정리(끝 빈 문단·이모지 등)가 있어, 내용은 그대로인 변경을 한 번 거친 뒤 본다
const save = (html: string) => {
  const ed = new Editor({ element: document.createElement('div'), extensions: buildExtensions(true), content: parseContent(html) });
  ed.view.dispatch(ed.state.tr.step(new ReplaceStep(0, 0, Slice.empty)));
  const out = ed.isEmpty ? '' : ed.getHTML();
  ed.destroy();
  return out;
};
// HTML 모드에 붙여 넣고 돌아왔을 때
const viaSourceMode = (html: string) => {
  const ed = new Editor({ element: document.createElement('div'), extensions: buildExtensions(true), content: '<p></p>' });
  applySourceContent(ed as never, html);
  ed.view.dispatch(ed.state.tr.step(new ReplaceStep(0, 0, Slice.empty)));
  const out = ed.getHTML();
  ed.destroy();
  return out;
};
// 끝 블록이 문단이 아니면 저장할 때 빈 문단이 하나 붙는다(가이드에 적어 둠)
const sameAsSaved = (out: string, ex: string) => expect([ex, ex + '<p></p>']).toContain(out);
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
  }, 30_000);

  it('그대로 쓰는 예시는 저장해도 한 글자도 바뀌지 않는다', () => {
    const examples = blocks('html');
    expect(examples.length).toBeGreaterThan(10);
    for (const ex of examples) {
      sameAsSaved(save(oneLine(ex)), oneLine(ex));
      sameAsSaved(viaSourceMode(oneLine(ex)), oneLine(ex));
    }
  });

  it('줄여 쓴 예시는 저장 뒤 다시 저장해도 같고 주소가 남는다', () => {
    const examples = blocks('html 줄여 쓰기');
    expect(examples.length).toBeGreaterThan(0);
    for (const ex of examples) {
      const once = save(oneLine(ex));
      expect(save(once)).toBe(once);
      const viaSource = viaSourceMode(oneLine(ex));
      expect(viaSourceMode(viaSource)).toBe(viaSource);
      for (const src of oneLine(ex).match(/https:\/\/[^"]+/g) ?? []) {
        expect(once).toContain(src);
        expect(viaSource).toContain(src);
      }
    }
  });

  it('글자 크기·글자색·줄간격 목록이 툴바와 같다', () => {
    const toolbar = readFileSync('src/ui/toolbar.tsx', 'utf8');
    expect(listIn('글자 크기')).toEqual(arrayIn(toolbar, 'FONT_SIZE_OPTIONS'));
    const hex = [...toolbar.matchAll(/value: '(#[0-9a-f]{6})'/g)].map((m) => m[1]);
    const rgb = hex.map((h) => `rgb(${[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(', ')})`);
    expect(listIn('글자색').filter((v) => /^rgb\(\d/.test(v))).toEqual(rgb);
    const lineHeights = [...(toolbar.match(/LINE_HEIGHT_OPTIONS = \[([\s\S]*?)\];/)?.[1] ?? '').matchAll(/value: '([^']+)'/g)].map((m) => m[1]);
    expect(listIn('줄간격')).toEqual(lineHeights);
  });

  it('내부 구현 이름을 쓰지 않는다', () => {
    const text = guide();
    for (const word of ['tiptap', 'ProseMirror', 'prosemirror', 'DOMPurify', 'sanitize', 'normalize', 'parseContent', 'src/', 'isAllowed']) {
      expect(text).not.toContain(word);
    }
  });
});
