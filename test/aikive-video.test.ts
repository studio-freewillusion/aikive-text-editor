import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';
import { parseContent } from '../src/editor/parse-content';
import { buildExtensions } from '../src/editor/use-editor-setup';
import { normalizeSourceHTML } from '../src/extensions';

const HOSTS = ['video.example.com'];
const SAVED =
  '<div data-aikive-video=""><iframe src="https://video.example.com/embed/watch/abc123" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen="true" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>';
const SHORT = '<div data-aikive-video=""><iframe src="https://video.example.com/embed/watch/abc123"></iframe></div>';

let editor: Editor | undefined;
const open = (content: string, hosts = HOSTS) => {
  editor = new Editor({
    element: document.createElement('div'),
    extensions: buildExtensions(true, {}, undefined, undefined, hosts),
    content: parseContent(content),
  });
  return editor;
};
afterEach(() => editor?.destroy());

describe('영상 블록 저장', () => {
  it('저장 모양 그대로 열고 저장한다', () => {
    expect([SAVED, SAVED + '<p></p>']).toContain(open(SAVED).getHTML());
  });

  it('줄여 쓴 모양은 저장 모양으로 정리한다', () => {
    expect([SAVED, SAVED + '<p></p>']).toContain(open(SHORT).getHTML());
  });

  it.each([
    ['허용 밖 호스트', '<div data-aikive-video=""><iframe src="https://other.example.com/embed/watch/abc123"></iframe></div>', HOSTS],
    ['미리 보기 주소', '<div data-aikive-video=""><iframe src="https://video.example.com/embed/watch/abc123?preview=1"></iframe></div>', HOSTS],
    ['호스트 목록 없음', SHORT, []],
  ])('%s 는 버린다', (_name, html, hosts) => {
    expect(open(html, hosts).getHTML()).not.toContain('data-aikive-video');
  });
});

describe('에디터 안 표시', () => {
  it('에디터 안 iframe 에만 preview=1 을 붙인다', () => {
    const ed = open(SAVED);
    expect(ed.view.dom.querySelector('[data-aikive-video] iframe')?.getAttribute('src')).toBe(
      'https://video.example.com/embed/watch/abc123?preview=1',
    );
    expect(ed.getHTML()).not.toContain('preview');
  });
});

describe('래퍼 보존', () => {
  it('HTML 모드 정리가 래퍼를 벗기지 않는다', () => {
    expect(normalizeSourceHTML(SHORT)).toBe(SHORT);
  });

  it('주소가 빈 래퍼는 불러올 때 지운다', () => {
    expect(parseContent('<p>a</p><div data-aikive-video=""><iframe src=""></iframe></div>')).toBe('<p>a</p>');
  });
});

describe('JSON 으로 들어온 영상 블록', () => {
  it('허용 밖 src 는 iframe 을 그리지도 저장하지도 않는다', () => {
    editor = new Editor({
      element: document.createElement('div'),
      extensions: buildExtensions(true, {}, undefined, undefined, HOSTS),
      content: { type: 'doc', content: [{ type: 'aikiveVideo', attrs: { src: 'javascript:parent.alert(1)//' } }] },
    });
    expect(editor.view.dom.querySelector('iframe')).toBeNull();
    expect(editor.getHTML()).not.toContain('javascript');
  });

  it('명령으로 넣거나 바꾼 허용 밖 영상 블록은 바로 지운다', () => {
    const ed = open('<p>a</p>');
    ed.commands.insertContent({ type: 'aikiveVideo', attrs: { src: 'javascript:parent.alert(1)//' } });
    expect(ed.getHTML()).not.toContain('data-aikive-video');
    ed.commands.insertContent({ type: 'aikiveVideo', attrs: { src: 'https://video.example.com/embed/watch/abc123' } });
    let pos = -1;
    ed.state.doc.descendants((node, p) => {
      if (node.type.name === 'aikiveVideo') pos = p;
    });
    ed.view.dispatch(ed.state.tr.setNodeMarkup(pos, undefined, { src: 'https://other.example.com/embed/watch/abc123' }));
    expect(ed.getHTML()).not.toContain('data-aikive-video');
  });
});
