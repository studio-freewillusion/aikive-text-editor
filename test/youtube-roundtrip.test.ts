import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';
import { buildExtensions } from '../src/editor/use-editor-setup';
import { parseContent } from '../src/editor/parse-content';

let editor: Editor | undefined;
const open = (content: string) => {
  editor = new Editor({ element: document.createElement('div'), extensions: buildExtensions(true), content: parseContent(content) });
  return editor.getHTML();
};
afterEach(() => editor?.destroy());

describe('저장된 유튜브 주소는 열고 저장해도 그대로', () => {
  it('공유 주소 값(si·t)을 지우거나 controls=0 을 붙이지 않는다', () => {
    const html = open('<div data-youtube-video=""><iframe src="https://www.youtube-nocookie.com/embed/abc?si=X1&amp;t=127" width="480" height="270"></iframe></div>');
    expect(html).toContain('src="https://www.youtube-nocookie.com/embed/abc?si=X1&amp;t=127"');
    expect(html).not.toContain('controls=0');
  });
});

describe('JSON 이지만 문서가 아닌 본문은 지금 에디터처럼 다룬다', () => {
  it('JSON 문자열 값은 그 글자로 연다', () => {
    expect(open('"마트"')).toBe('<p>마트</p>');
  });
  it('JSON 숫자 값은 빈 문서로 연다', () => {
    const html = open('132');
    expect(html).not.toContain('132');
  });
});
