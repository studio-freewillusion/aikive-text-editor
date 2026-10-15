import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ALT_MAX_LENGTH,
  LINK_EMPTY_MESSAGE,
  LINK_SCHEME_MESSAGE,
  YOUTUBE_INVALID_MESSAGE,
  applyAlt,
  applyLink,
  currentLink,
  insertYoutube,
  removeLink,
} from '../src/editor/popover-actions';
import { buildExtensions } from '../src/editor/use-editor-setup';

let editor: Editor;
const create = (content: string) => {
  editor = new Editor({ element: document.createElement('div'), extensions: buildExtensions(true), content });
  return editor;
};
const IMG = '<img src="https://cdn.example.com/a.png">';

afterEach(() => editor?.destroy());

describe('applyLink', () => {
  it('스킴 없는 주소는 https 를 붙여 새 탭 링크로 건다', () => {
    create('<p>안녕</p>').commands.selectAll();
    expect(applyLink(editor, ' example.com ', true)).toBeNull();
    const html = editor.getHTML();
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('같은 탭 링크는 다시 불러와도 HTML 이 같다', () => {
    create('<p>안녕</p>').commands.selectAll();
    applyLink(editor, 'https://example.com', false);
    const saved = editor.getHTML();
    expect(saved).toContain('target="_self"');
    editor.destroy();
    create(saved);
    expect(editor.getHTML()).toBe(saved);
  });

  it.each(['javascript:alert(1)', 'mailto:a@b.com', 'ftp://example.com'])('%s 는 거부하고 본문을 바꾸지 않는다', (input) => {
    create('<p>안녕</p>').commands.selectAll();
    expect(applyLink(editor, input, true)).toBe(LINK_SCHEME_MESSAGE);
    expect(editor.getHTML()).not.toContain('<a');
  });

  it('빈 주소는 거부한다', () => {
    create('<p>안녕</p>').commands.selectAll();
    expect(applyLink(editor, '   ', true)).toBe(LINK_EMPTY_MESSAGE);
  });

  it('선택 없이 커서만 있으면 주소를 글자로 넣고 링크를 건다', () => {
    create('<p>안녕</p>').commands.setTextSelection(3);
    expect(applyLink(editor, 'example.com', true)).toBeNull();
    expect(editor.getHTML()).toMatch(/<p>안녕<a [^>]*href="https:\/\/example.com"[^>]*>https:\/\/example.com<\/a><\/p>/);
  });

  it('링크 안에 커서가 있으면 그 링크 전체의 주소를 바꾼다', () => {
    create('<p><a href="https://a.example.com" target="_blank" rel="noopener noreferrer">글자</a></p>').commands.setTextSelection(2);
    applyLink(editor, 'https://b.example.com', true);
    expect(editor.getHTML()).toContain('href="https://b.example.com"');
    expect(editor.getHTML()).toContain('>글자</a>');
  });

  it('고른 이미지에는 이미지 링크로 건다', () => {
    create(IMG).commands.setNodeSelection(0);
    expect(applyLink(editor, 'example.com', true)).toBeNull();
    expect(editor.getHTML()).toContain('<a href="https://example.com" target="_blank"');
  });

  it('이미지 링크를 같은 탭으로 걸면 target·rel 이 남지 않는다', () => {
    create(`<a href="https://example.com" target="_blank">${IMG}</a>`).commands.setNodeSelection(0);
    applyLink(editor, 'https://example.com', false);
    expect(editor.getHTML()).toContain('<a href="https://example.com"');
    expect(editor.getHTML()).not.toMatch(/target=|rel=/);
  });
});

describe('currentLink·removeLink', () => {
  it('링크가 아니면 null', () => {
    create('<p>안녕</p>').commands.setTextSelection(2);
    expect(currentLink(editor)).toBeNull();
  });

  it('같은 탭 링크는 newTab false 로 읽고, 해제하면 글자만 남는다', () => {
    create('<p><a href="https://example.com" target="_self" rel="noopener noreferrer nofollow">글자</a></p>').commands.setTextSelection(2);
    expect(currentLink(editor)).toEqual({ href: 'https://example.com', newTab: false });
    removeLink(editor);
    expect(editor.getHTML()).toBe('<p>글자</p>');
  });

  it('이미지 링크를 읽고, 해제하면 이미지는 남긴다', () => {
    create(`<a href="https://example.com" target="_blank">${IMG}</a>`).commands.setNodeSelection(0);
    expect(currentLink(editor)).toEqual({ href: 'https://example.com', newTab: true });
    removeLink(editor);
    expect(editor.getHTML()).not.toContain('<a');
    expect(editor.getHTML()).toContain('<img');
  });
});

describe('insertYoutube', () => {
  it('유튜브 주소를 커서 자리에 넣는다', () => {
    create('<p>a</p>').commands.setTextSelection(2);
    expect(insertYoutube(editor, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(editor.getHTML()).toContain('data-youtube-video');
  });

  it('스킴 없는 짧은 주소도 넣는다', () => {
    create('<p>a</p>').commands.setTextSelection(2);
    expect(insertYoutube(editor, 'youtu.be/dQw4w9WgXcQ')).toBeNull();
    expect(editor.getHTML()).toContain('data-youtube-video');
  });

  it.each(['https://example.com/v', '', 'javascript:alert(1)'])('「%s」 는 거부한다', (input) => {
    create('<p>a</p>').commands.setTextSelection(2);
    expect(insertYoutube(editor, input)).toBe(YOUTUBE_INVALID_MESSAGE);
    expect(editor.getHTML()).not.toContain('data-youtube-video');
  });
});

describe('applyAlt', () => {
  it('대체 텍스트를 넣고, 비우면 지우고, 200자로 자른다', () => {
    create(IMG).commands.setNodeSelection(0);
    applyAlt(editor, ' 장면 ');
    expect(editor.getHTML()).toContain('alt="장면"');
    applyAlt(editor, '');
    expect(editor.getHTML()).not.toContain('alt=');
    applyAlt(editor, 'a'.repeat(250));
    expect(editor.getHTML()).toContain(`alt="${'a'.repeat(ALT_MAX_LENGTH)}"`);
  });
});
